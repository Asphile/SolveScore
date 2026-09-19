from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.competition import Competition, CompetitionParticipant
from app.models.enums import CompetitionStatus, ParticipantStatus
from app.models.school import School


class CompetitionJoinError(Exception):
    """Base class for join-competition failures the API translates to 4xx responses."""


class CompetitionNotJoinableError(CompetitionJoinError):
    pass


class CompetitionFullError(CompetitionJoinError):
    pass


class AlreadyJoinedError(CompetitionJoinError):
    pass


def join_competition(db: Session, *, competition_id: str, school: School) -> CompetitionParticipant:
    """Adds a school to a competition, enforcing the hard capacity limit and
    duplicate-participation rule at the database layer (never trust the frontend).

    Locks the competition row for the duration of the transaction (on
    PostgreSQL this is a real row lock via SELECT ... FOR UPDATE; on SQLite the
    engine already serializes writers, and the unique constraint below is the
    final backstop against a race between two concurrent join attempts).
    """
    competition = (
        db.query(Competition)
        .filter(Competition.id == competition_id)
        .with_for_update()
        .first()
    )
    if competition is None:
        raise CompetitionNotJoinableError("Competition not found")

    if competition.status not in (CompetitionStatus.PUBLISHED, CompetitionStatus.APPLICATIONS_OPEN):
        raise CompetitionNotJoinableError("This competition is not currently open for schools to join")

    now = datetime.now(timezone.utc)
    if competition.application_close_date and _aware(competition.application_close_date) < now:
        raise CompetitionNotJoinableError("The application deadline for this competition has passed")

    current_count = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition_id,
            CompetitionParticipant.status == ParticipantStatus.JOINED,
        )
        .count()
    )
    if current_count >= competition.max_participants:
        raise CompetitionFullError(
            f"Competition is full ({competition.max_participants}/{competition.max_participants} schools registered)"
        )

    existing = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.competition_id == competition_id,
            CompetitionParticipant.school_id == school.id,
        )
        .first()
    )
    if existing:
        raise AlreadyJoinedError("This school has already joined this competition")

    participant = CompetitionParticipant(competition_id=competition_id, school_id=school.id)
    db.add(participant)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise AlreadyJoinedError("This school has already joined this competition") from exc

    return participant


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
