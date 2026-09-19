import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.core.security import hash_password
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.competition import Competition, CompetitionParticipant, JudgeAssignment
from app.models.enums import ApplicationStatus, CompetitionStatus, EvaluationStatus, ParticipantStatus, UserRole
from app.models.evaluation import Evaluation, EvaluationScore
from app.models.rubric import Rubric, RubricCriterion
from app.models.school import School
from app.models.user import User
from app.schemas.application import ApplicationResponse, ReviewDecisionRequest
from app.schemas.rubric import RubricCreateRequest, RubricResponse
from app.services import audit
from app.services.results_service import compute_leaderboard

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---- Judge & school account management --------------------------------------

class CreateJudgeRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


@router.post("/judges", status_code=status.HTTP_201_CREATED)
def create_judge(payload: CreateJudgeRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> dict:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    judge = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.JUDGE,
    )
    db.add(judge)
    db.flush()
    audit.record(db, action="ADMIN_CREATED_JUDGE", entity_type="User", entity_id=judge.id, user=current_user)
    db.commit()
    return {"id": judge.id, "email": judge.email}


@router.get("/judges")
def list_judges(db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> list[dict]:
    judges = db.query(User).filter(User.role == UserRole.JUDGE).all()
    return [{"id": j.id, "name": f"{j.first_name} {j.last_name}", "email": j.email, "active": j.active} for j in judges]


@router.get("/schools")
def list_schools(db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> list[dict]:
    schools = db.query(School).all()
    return [
        {
            "id": s.id,
            "school_name": s.school_name,
            "province": s.province,
            "district": s.district,
            "contact_email": s.contact_email,
        }
        for s in schools
    ]


class SetActiveRequest(BaseModel):
    active: bool


@router.patch("/users/{user_id}/active")
def set_user_active(
    user_id: str, payload: SetActiveRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.active = payload.active
    audit.record(
        db, action="ADMIN_SET_USER_ACTIVE", entity_type="User", entity_id=user.id, user=current_user,
        metadata={"active": payload.active},
    )
    db.commit()
    return {"id": user.id, "active": user.active}


# ---- Application review ---------------------------------------------------

@router.get("/applications", response_model=list[ApplicationResponse])
def list_applications(
    competition_id: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> list[ApplicationResponse]:
    query = db.query(Application)
    if competition_id:
        query = query.filter(Application.competition_id == competition_id)
    return query.order_by(Application.updated_at.desc()).all()


def _get_application(db: Session, application_id: str) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return application


@router.post("/applications/{application_id}/approve", response_model=ApplicationResponse)
def approve_application(
    application_id: str, payload: ReviewDecisionRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> ApplicationResponse:
    application = _get_application(db, application_id)
    if application.status not in (ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only submitted applications can be approved")

    application.status = ApplicationStatus.APPROVED
    application.approved_at = datetime.now(timezone.utc)
    application.review_notes = payload.notes

    audit.record(db, action="ADMIN_APPROVED_APPLICATION", entity_type="Application", entity_id=application.id, user=current_user)
    db.commit()
    db.refresh(application)
    return application


@router.post("/applications/{application_id}/reject", response_model=ApplicationResponse)
def reject_application(
    application_id: str, payload: ReviewDecisionRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> ApplicationResponse:
    application = _get_application(db, application_id)
    if application.status not in (ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only submitted applications can be rejected")

    application.status = ApplicationStatus.REJECTED
    application.review_notes = payload.notes

    audit.record(db, action="ADMIN_REJECTED_APPLICATION", entity_type="Application", entity_id=application.id, user=current_user)
    db.commit()
    db.refresh(application)
    return application


@router.post("/applications/{application_id}/request-changes", response_model=ApplicationResponse)
def request_changes(
    application_id: str, payload: ReviewDecisionRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> ApplicationResponse:
    application = _get_application(db, application_id)
    if application.status not in (ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only submitted applications can have changes requested")
    if not payload.notes.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please explain what changes are required")

    application.status = ApplicationStatus.CHANGES_REQUESTED
    application.review_notes = payload.notes

    audit.record(db, action="ADMIN_REQUESTED_CHANGES", entity_type="Application", entity_id=application.id, user=current_user)
    db.commit()
    db.refresh(application)
    return application


# ---- Rubric management ------------------------------------------------------

@router.post("/competitions/{competition_id}/rubric", response_model=RubricResponse, status_code=status.HTTP_201_CREATED)
def create_rubric(
    competition_id: str, payload: RubricCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> RubricResponse:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")

    db.query(Rubric).filter(Rubric.competition_id == competition_id).update({"active": False})

    rubric = Rubric(competition_id=competition_id, name=payload.name, active=True)
    db.add(rubric)
    db.flush()
    for order, criterion in enumerate(payload.criteria):
        db.add(
            RubricCriterion(
                rubric_id=rubric.id,
                name=criterion.name,
                description=criterion.description,
                weight=criterion.weight,
                minimum_score=criterion.minimum_score,
                maximum_score=criterion.maximum_score,
                display_order=criterion.display_order or order,
            )
        )

    audit.record(db, action="ADMIN_CREATED_RUBRIC", entity_type="Rubric", entity_id=rubric.id, user=current_user)
    db.commit()
    db.refresh(rubric)
    return rubric


@router.get("/competitions/{competition_id}/rubric", response_model=RubricResponse)
def get_active_rubric(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> RubricResponse:
    rubric = db.query(Rubric).filter(Rubric.competition_id == competition_id, Rubric.active == True).first()  # noqa: E712
    if rubric is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active rubric configured for this competition")
    return rubric


# ---- Judge assignment -------------------------------------------------------

class AssignJudgeRequest(BaseModel):
    judge_id: str


@router.post("/competitions/{competition_id}/judges", status_code=status.HTTP_201_CREATED)
def assign_judge(
    competition_id: str, payload: AssignJudgeRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> dict:
    judge = db.get(User, payload.judge_id)
    if judge is None or judge.role != UserRole.JUDGE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The specified user is not a judge account")

    existing = (
        db.query(JudgeAssignment)
        .filter(JudgeAssignment.competition_id == competition_id, JudgeAssignment.judge_id == payload.judge_id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "This judge is already assigned to this competition")

    assignment = JudgeAssignment(competition_id=competition_id, judge_id=payload.judge_id)
    db.add(assignment)
    audit.record(db, action="ADMIN_ASSIGNED_JUDGE", entity_type="Competition", entity_id=competition_id, user=current_user, metadata={"judge_id": payload.judge_id})
    db.commit()
    return {"detail": "Judge assigned"}


@router.get("/competitions/{competition_id}/judges")
def list_assigned_judges(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> list[dict]:
    rows = db.query(JudgeAssignment, User).join(User, User.id == JudgeAssignment.judge_id).filter(
        JudgeAssignment.competition_id == competition_id
    ).all()
    return [{"judge_id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email, "assigned_at": a.assigned_at} for a, u in rows]


# ---- Monitoring & statistics -------------------------------------------------

@router.get("/statistics")
def statistics(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> dict:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")

    registered = db.query(CompetitionParticipant).filter(
        CompetitionParticipant.competition_id == competition_id, CompetitionParticipant.status == ParticipantStatus.JOINED
    ).count()
    approved = db.query(Application).filter(
        Application.competition_id == competition_id, Application.status.in_([
            ApplicationStatus.APPROVED, ApplicationStatus.JUDGING, ApplicationStatus.COMPLETED
        ])
    ).count()
    judges = db.query(JudgeAssignment).filter(JudgeAssignment.competition_id == competition_id).count()

    expected_evaluations = approved * judges
    submitted = db.query(Evaluation).filter(
        Evaluation.competition_id == competition_id, Evaluation.status == EvaluationStatus.SUBMITTED
    ).count()
    drafts = db.query(Evaluation).filter(
        Evaluation.competition_id == competition_id, Evaluation.status == EvaluationStatus.DRAFT
    ).count()
    not_started = max(expected_evaluations - submitted - drafts, 0)

    return {
        "max_schools": competition.max_participants,
        "registered_schools": registered,
        "approved_schools": approved,
        "judges": judges,
        "expected_evaluations": expected_evaluations,
        "submitted_evaluations": submitted,
        "draft_evaluations": drafts,
        "not_started": not_started,
        "completion_pct": round((submitted / expected_evaluations) * 100, 1) if expected_evaluations else 0.0,
    }


# ---- Results consolidation ---------------------------------------------------

@router.get("/results")
def results(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> list[dict]:
    """Official leaderboard. Only SUBMITTED evaluations contribute -- drafts are excluded."""
    return compute_leaderboard(db, competition_id)


# ---- Finalize / lifecycle ----------------------------------------------------

@router.post("/competitions/{competition_id}/finalize")
def finalize_competition(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> dict:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")
    if competition.status != CompetitionStatus.JUDGING_CLOSED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Judging must be closed before results can be finalized")

    competition.status = CompetitionStatus.RESULTS_FINALIZED
    audit.record(db, action="ADMIN_FINALIZED_RESULTS", entity_type="Competition", entity_id=competition.id, user=current_user)
    db.commit()
    return {"detail": "Results finalized", "status": competition.status}


class ReopenRequest(BaseModel):
    reason: str


@router.post("/evaluations/{evaluation_id}/reopen")
def reopen_evaluation(
    evaluation_id: str, payload: ReopenRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> dict:
    if not payload.reason.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to reopen an evaluation")

    evaluation = db.get(Evaluation, evaluation_id)
    if evaluation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation not found")

    competition = db.get(Competition, evaluation.competition_id)
    if competition.status == CompetitionStatus.RESULTS_FINALIZED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot reopen an evaluation after results have been finalized")

    evaluation.status = EvaluationStatus.DRAFT
    evaluation.submitted_at = None

    audit.record(
        db, action="ADMIN_REOPENED_EVALUATION", entity_type="Evaluation", entity_id=evaluation.id, user=current_user,
        metadata={"reason": payload.reason},
    )
    db.commit()
    return {"detail": "Evaluation reopened"}


@router.post("/applications/{application_id}/reopen")
def reopen_application(
    application_id: str, payload: ReopenRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> dict:
    if not payload.reason.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to reopen an application")

    application = _get_application(db, application_id)
    application.status = ApplicationStatus.CHANGES_REQUESTED
    application.review_notes = f"[Reopened by admin] {payload.reason}"

    audit.record(
        db, action="ADMIN_REOPENED_APPLICATION", entity_type="Application", entity_id=application.id, user=current_user,
        metadata={"reason": payload.reason},
    )
    db.commit()
    return {"detail": "Application reopened for editing"}


# ---- Audit logs ---------------------------------------------------------------

@router.get("/audit-logs")
def get_audit_logs(
    entity_type: str | None = None, limit: int = 200, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> list[dict]:
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(min(limit, 1000)).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "role": log.role,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "metadata": json.loads(log.metadata_json or "{}"),
            "timestamp": log.timestamp,
        }
        for log in logs
    ]
