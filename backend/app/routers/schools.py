from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.application import Application
from app.models.competition import Competition, CompetitionParticipant, JudgeAssignment
from app.models.enums import CompetitionStatus, EvaluationStatus, ParticipantStatus, UserRole
from app.models.evaluation import Evaluation, EvaluationScore
from app.models.rubric import Rubric
from app.models.school import School
from app.models.user import User
from app.services.results_service import compute_leaderboard

router = APIRouter(prefix="/api/school", tags=["school"])


def _get_school(db: Session, current_user: User) -> School:
    if current_user.role != UserRole.SCHOOL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This endpoint is only available to school accounts")
    school = db.query(School).filter(School.user_id == current_user.id).first()
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School profile not found")
    return school


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    school = _get_school(db, current_user)
    return {
        "id": school.id,
        "school_name": school.school_name,
        "registration_number": school.registration_number,
        "province": school.province,
        "district": school.district,
        "address": school.address,
        "contact_name": school.contact_name,
        "contact_email": school.contact_email,
        "contact_phone": school.contact_phone,
    }


@router.get("/competitions")
def my_competitions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    school = _get_school(db, current_user)
    participations = (
        db.query(CompetitionParticipant)
        .filter(
            CompetitionParticipant.school_id == school.id,
            CompetitionParticipant.status == ParticipantStatus.JOINED,
        )
        .all()
    )
    results = []
    leaderboard_cache: dict[str, list[dict]] = {}
    for p in participations:
        competition = db.get(Competition, p.competition_id)
        application = (
            db.query(Application)
            .filter(Application.competition_id == p.competition_id, Application.school_id == school.id)
            .first()
        )

        rank = None
        average_score = None
        if application is not None and competition.status == CompetitionStatus.RESULTS_FINALIZED:
            if competition.id not in leaderboard_cache:
                leaderboard_cache[competition.id] = compute_leaderboard(db, competition.id)
            own_row = next((r for r in leaderboard_cache[competition.id] if r["application_id"] == application.id), None)
            if own_row:
                rank = own_row["rank"]
                average_score = own_row["average_score"]

        results.append(
            {
                "competition_id": competition.id,
                "competition_name": competition.name,
                "competition_status": competition.status,
                "joined_at": p.joined_at,
                "application_id": application.id if application else None,
                "application_status": application.status if application else None,
                "rank": rank,
                "average_score": average_score,
            }
        )
    return results


@router.get("/applications/{application_id}/results")
def get_application_results(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    """A school's own judging progress and (once results are finalized) its
    consolidated score, rank, per-criterion breakdown, and anonymized judge
    comments. Individual judge identities and other schools' data are never
    exposed -- only the competition-wide leaderboard used for this school's
    own row, and the applicant's own evaluations.
    """
    school = _get_school(db, current_user)
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if application.school_id != school.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this application")

    competition = db.get(Competition, application.competition_id)

    judges_total = db.query(JudgeAssignment).filter(JudgeAssignment.competition_id == competition.id).count()
    submitted_evals = (
        db.query(Evaluation)
        .filter(Evaluation.application_id == application.id, Evaluation.status == EvaluationStatus.SUBMITTED)
        .all()
    )

    results_visible = competition.status == CompetitionStatus.RESULTS_FINALIZED

    response: dict = {
        "application_id": application.id,
        "application_status": application.status,
        "competition_status": competition.status,
        "judges_total": judges_total,
        "judges_completed": len(submitted_evals),
        "results_visible": results_visible,
        "average_score": None,
        "rank": None,
        "criteria_breakdown": [],
        "strengths": [],
        "improvements": [],
    }

    if not results_visible:
        return response

    leaderboard = compute_leaderboard(db, competition.id)
    own_row = next((r for r in leaderboard if r["application_id"] == application.id), None)
    if own_row:
        response["average_score"] = own_row["average_score"]
        response["rank"] = own_row["rank"]

    response["strengths"] = [e.strengths for e in submitted_evals if e.strengths.strip()]
    response["improvements"] = [e.improvements for e in submitted_evals if e.improvements.strip()]

    rubric = db.query(Rubric).filter(Rubric.competition_id == competition.id, Rubric.active == True).first()  # noqa: E712
    if rubric:
        eval_ids = [e.id for e in submitted_evals]
        for criterion in rubric.criteria:
            values = []
            if eval_ids:
                scores = (
                    db.query(EvaluationScore)
                    .filter(EvaluationScore.criterion_id == criterion.id, EvaluationScore.evaluation_id.in_(eval_ids))
                    .all()
                )
                values = [s.score for s in scores]
            response["criteria_breakdown"].append(
                {
                    "criterion_id": criterion.id,
                    "name": criterion.name,
                    "weight": criterion.weight,
                    "maximum_score": criterion.maximum_score,
                    "average_score": round(sum(values) / len(values), 2) if values else None,
                }
            )

    return response
