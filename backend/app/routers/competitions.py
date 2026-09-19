from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.models.competition import Competition, CompetitionParticipant
from app.models.enums import ParticipantStatus, UserRole
from app.models.school import School
from app.models.user import User
from app.schemas.competition import CompetitionCreateRequest, CompetitionResponse, CompetitionUpdateRequest
from app.services import audit
from app.services.competition_service import (
    AlreadyJoinedError,
    CompetitionFullError,
    CompetitionNotJoinableError,
    join_competition,
)

router = APIRouter(prefix="/api/competitions", tags=["competitions"])


def _to_response(db: Session, competition: Competition) -> CompetitionResponse:
    registered = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition.id,
            CompetitionParticipant.status == ParticipantStatus.JOINED,
        )
        .count()
    )
    return CompetitionResponse(
        id=competition.id,
        name=competition.name,
        description=competition.description,
        theme=competition.theme,
        eligibility=competition.eligibility,
        status=competition.status,
        max_participants=competition.max_participants,
        registered_count=registered,
        spaces_remaining=max(competition.max_participants - registered, 0),
        application_open_date=competition.application_open_date,
        application_close_date=competition.application_close_date,
        judging_open_date=competition.judging_open_date,
        judging_close_date=competition.judging_close_date,
        created_at=competition.created_at,
    )


@router.get("", response_model=list[CompetitionResponse])
def list_competitions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[CompetitionResponse]:
    competitions = db.query(Competition).order_by(Competition.created_at.desc()).all()
    return [_to_response(db, c) for c in competitions]


@router.get("/{competition_id}", response_model=CompetitionResponse)
def get_competition(
    competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> CompetitionResponse:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")
    return _to_response(db, competition)


@router.post("", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
def create_competition(
    payload: CompetitionCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
) -> CompetitionResponse:
    competition = Competition(
        name=payload.name,
        description=payload.description,
        theme=payload.theme,
        eligibility=payload.eligibility,
        max_participants=payload.max_participants,
        application_open_date=payload.application_open_date,
        application_close_date=payload.application_close_date,
        judging_open_date=payload.judging_open_date,
        judging_close_date=payload.judging_close_date,
        created_by=current_user.id,
    )
    db.add(competition)
    db.flush()
    audit.record(db, action="ADMIN_CREATED_COMPETITION", entity_type="Competition", entity_id=competition.id, user=current_user)
    db.commit()
    return _to_response(db, competition)


@router.put("/{competition_id}", response_model=CompetitionResponse)
def update_competition(
    competition_id: str,
    payload: CompetitionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CompetitionResponse:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(competition, field, value)

    audit.record(
        db,
        action="ADMIN_UPDATED_COMPETITION",
        entity_type="Competition",
        entity_id=competition.id,
        user=current_user,
        metadata=updates,
    )
    db.commit()
    return _to_response(db, competition)


@router.post("/{competition_id}/join", status_code=status.HTTP_201_CREATED)
def join(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role != UserRole.SCHOOL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only school accounts can join a competition")

    school = db.query(School).filter(School.user_id == current_user.id).first()
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School profile not found for this account")

    try:
        participant = join_competition(db, competition_id=competition_id, school=school)
    except CompetitionNotJoinableError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except CompetitionFullError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except AlreadyJoinedError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    audit.record(
        db,
        action="SCHOOL_JOINED_COMPETITION",
        entity_type="Competition",
        entity_id=competition_id,
        user=current_user,
        metadata={"school_id": school.id},
    )
    db.commit()
    return {"detail": "Joined competition successfully", "participant_id": participant.id}
