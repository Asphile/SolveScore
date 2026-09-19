from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.competition import JudgeAssignment
from app.models.enums import ApplicationStatus, EvaluationStatus
from app.models.evaluation import Evaluation
from app.models.school import School


def compute_leaderboard(db: Session, competition_id: str) -> list[dict]:
    """The official, ranked leaderboard for a competition.

    Only SUBMITTED evaluations contribute -- drafts are always excluded. Shared
    by the admin results endpoint, report generation, and the school-facing
    results view, so ranking logic lives in exactly one place.
    """
    applications = db.query(Application).filter(
        Application.competition_id == competition_id,
        Application.status.in_([ApplicationStatus.APPROVED, ApplicationStatus.JUDGING, ApplicationStatus.COMPLETED]),
    ).all()
    judges_total = db.query(JudgeAssignment).filter(JudgeAssignment.competition_id == competition_id).count()

    rows = []
    for app_ in applications:
        school = db.get(School, app_.school_id)
        submitted_evals = db.query(Evaluation).filter(
            Evaluation.application_id == app_.id, Evaluation.status == EvaluationStatus.SUBMITTED
        ).all()
        scores = [e.weighted_total for e in submitted_evals if e.weighted_total is not None]
        average = round(sum(scores) / len(scores), 2) if scores else None
        rows.append(
            {
                "application_id": app_.id,
                "school_id": app_.school_id,
                "school_name": school.school_name if school else "Unknown",
                "project_title": app_.project_title,
                "judges_completed": len(scores),
                "judges_total": judges_total,
                "average_score": average,
                "highest_score": max(scores) if scores else None,
                "lowest_score": min(scores) if scores else None,
                "complete": len(scores) == judges_total and judges_total > 0,
            }
        )

    ranked = sorted((r for r in rows if r["average_score"] is not None), key=lambda r: r["average_score"], reverse=True)
    unranked = [r for r in rows if r["average_score"] is None]
    rank = 0
    previous_score = None
    for i, row in enumerate(ranked, start=1):
        if row["average_score"] != previous_score:
            rank = i
            previous_score = row["average_score"]
        row["rank"] = rank
    for row in unranked:
        row["rank"] = None

    return ranked + unranked
