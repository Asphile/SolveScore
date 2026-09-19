from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.application import Application, TeamMember
from app.models.competition import Competition, CompetitionParticipant
from app.models.enums import ApplicationStatus, CompetitionStatus, ParticipantStatus, ResourceType, UserRole
from app.models.resource import Resource
from app.models.school import School
from app.models.user import User
from app.schemas.application import ApplicationResponse, ApplicationUpdateRequest
from app.services import audit

router = APIRouter(prefix="/api/applications", tags=["applications"])


class CreateApplicationRequest(BaseModel):
    competition_id: str


def _school_for(db: Session, current_user: User) -> School:
    school = db.query(School).filter(School.user_id == current_user.id).first()
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School profile not found")
    return school


def _authorize_school_owner(application: Application, db: Session, current_user: User) -> None:
    """Ensures a school can only act on its own application -- never another school's."""
    if current_user.role != UserRole.SCHOOL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owning school may modify this application")
    school = _school_for(db, current_user)
    if application.school_id != school.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this application")


def _get_application_or_404(db: Session, application_id: str) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return application


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: CreateApplicationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ApplicationResponse:
    if current_user.role != UserRole.SCHOOL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only school accounts can create applications")
    school = _school_for(db, current_user)

    participation = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == payload.competition_id,
            CompetitionParticipant.school_id == school.id,
            CompetitionParticipant.status == ParticipantStatus.JOINED,
        )
        .first()
    )
    if participation is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your school must join this competition before starting an application")

    existing = (
        db.query(Application)
        .filter(Application.competition_id == payload.competition_id, Application.school_id == school.id)
        .first()
    )
    if existing:
        return existing

    application = Application(competition_id=payload.competition_id, school_id=school.id)
    db.add(application)
    db.commit()
    return application


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ApplicationResponse:
    application = _get_application_or_404(db, application_id)

    if current_user.role == UserRole.SCHOOL:
        _authorize_school_owner(application, db, current_user)
    elif current_user.role == UserRole.ADMIN:
        pass
    elif current_user.role == UserRole.JUDGE:
        # Judges may only view APPROVED applications, and only via the judging
        # router which also checks assignment; direct access here is limited
        # to approved/judging/completed applications as a read-only fallback.
        if application.status not in (ApplicationStatus.APPROVED, ApplicationStatus.JUDGING, ApplicationStatus.COMPLETED):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This application is not yet available for judging")
    return application


@router.put("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: str,
    payload: ApplicationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApplicationResponse:
    application = _get_application_or_404(db, application_id)
    _authorize_school_owner(application, db, current_user)

    if application.status not in (ApplicationStatus.DRAFT, ApplicationStatus.CHANGES_REQUESTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This application can no longer be edited")

    updates = payload.model_dump(exclude_unset=True, exclude={"team_members"})
    for field, value in updates.items():
        setattr(application, field, value)

    if payload.team_members is not None:
        db.query(TeamMember).filter(TeamMember.application_id == application.id).delete()
        for member in payload.team_members:
            db.add(TeamMember(application_id=application.id, name=member.name, grade=member.grade, role=member.role))

    if application.status == ApplicationStatus.CHANGES_REQUESTED:
        application.status = ApplicationStatus.DRAFT

    db.commit()
    db.refresh(application)
    return application


@router.post("/{application_id}/submit", response_model=ApplicationResponse)
def submit_application(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ApplicationResponse:
    application = _get_application_or_404(db, application_id)
    _authorize_school_owner(application, db, current_user)

    competition = db.get(Competition, application.competition_id)
    if competition.status not in (
        CompetitionStatus.PUBLISHED,
        CompetitionStatus.APPLICATIONS_OPEN,
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Applications are not currently being accepted for this competition")

    now = datetime.now(timezone.utc)
    close_date = competition.application_close_date
    if close_date:
        aware_close = close_date if close_date.tzinfo else close_date.replace(tzinfo=timezone.utc)
        if aware_close < now:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The application deadline has passed")

    if application.status not in (ApplicationStatus.DRAFT, ApplicationStatus.CHANGES_REQUESTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This application has already been submitted")

    required_fields = [
        application.project_title,
        application.problem_description,
        application.solution_description,
    ]
    if not all(f.strip() for f in required_fields):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Project title, problem description, and solution description are required before submitting",
        )

    resource_count = db.query(Resource).filter(Resource.application_id == application.id).count()
    if resource_count == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one supporting document must be uploaded before submitting")

    application.status = ApplicationStatus.SUBMITTED
    application.submitted_at = now

    audit.record(
        db,
        action="SCHOOL_SUBMITTED_APPLICATION",
        entity_type="Application",
        entity_id=application.id,
        user=current_user,
    )
    db.commit()
    db.refresh(application)
    return application
