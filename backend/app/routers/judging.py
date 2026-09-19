from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_judge
from app.models.application import Application
from app.models.competition import Competition, CompetitionParticipant, JudgeAssignment
from app.models.enums import ApplicationStatus, CompetitionStatus, EvaluationStatus, ParticipantStatus, UserRole
from app.models.evaluation import Evaluation, EvaluationScore
from app.models.rubric import Rubric
from app.models.user import User
from app.schemas.application import ApplicationResponse
from app.schemas.evaluation import EvaluationResponse, EvaluationSaveRequest, ScoreInput
from app.schemas.rubric import RubricResponse
from app.services import audit
from app.services.evaluation_service import ScoreValidationError, calculate_weighted_scores

router = APIRouter(prefix="/api/judge", tags=["judging"])
evaluations_router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


def _assigned_competition_ids(db: Session, judge_id: str) -> list[str]:
    rows = db.query(JudgeAssignment.competition_id).filter(JudgeAssignment.judge_id == judge_id).all()
    return [r[0] for r in rows]


@router.get("/assignments")
def get_assignments(db: Session = Depends(get_db), current_user: User = Depends(require_judge)) -> list[dict]:
    competition_ids = _assigned_competition_ids(db, current_user.id)
    results = []
    for competition_id in competition_ids:
        competition = db.get(Competition, competition_id)
        applications = (
            db.query(Application)
            .filter(Application.competition_id == competition_id, Application.status.in_([
                ApplicationStatus.APPROVED, ApplicationStatus.JUDGING, ApplicationStatus.COMPLETED,
            ]))
            .all()
        )
        evaluations = {
            e.application_id: e
            for e in db.query(Evaluation).filter(
                Evaluation.competition_id == competition_id, Evaluation.judge_id == current_user.id
            )
        }

        schools = []
        completed = in_progress = not_started = 0
        for app_ in applications:
            evaluation = evaluations.get(app_.id)
            if evaluation and evaluation.status == EvaluationStatus.SUBMITTED:
                app_status = "SUBMITTED"
                completed += 1
            elif evaluation:
                app_status = "IN_PROGRESS"
                in_progress += 1
            else:
                app_status = "NOT_STARTED"
                not_started += 1
            schools.append({"application_id": app_.id, "project_title": app_.project_title, "status": app_status})

        total = len(applications)
        results.append(
            {
                "competition_id": competition.id,
                "competition_name": competition.name,
                "schools_assigned": total,
                "completed": completed,
                "in_progress": in_progress,
                "not_started": not_started,
                "completion_pct": round((completed / total) * 100, 1) if total else 0.0,
                "schools": schools,
            }
        )
    return results


def _authorize_judge_for_application(db: Session, application: Application, judge_id: str) -> None:
    assignment = (
        db.query(JudgeAssignment)
        .filter(JudgeAssignment.competition_id == application.competition_id, JudgeAssignment.judge_id == judge_id)
        .first()
    )
    if assignment is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to this competition")
    if application.status not in (ApplicationStatus.APPROVED, ApplicationStatus.JUDGING, ApplicationStatus.COMPLETED):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This application has not been approved for judging")


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_application_for_judging(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_judge)
) -> ApplicationResponse:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    _authorize_judge_for_application(db, application, current_user.id)
    return application


@router.get("/applications/{application_id}/evaluation", response_model=EvaluationResponse | None)
def get_my_evaluation(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_judge)
) -> EvaluationResponse | None:
    """Returns ONLY the current judge's own evaluation for this application.

    This is the critical judge-independence boundary: there is no endpoint that
    returns another judge's scores, comments, or draft state to a judge.
    """
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    _authorize_judge_for_application(db, application, current_user.id)

    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.application_id == application_id, Evaluation.judge_id == current_user.id)
        .first()
    )
    return evaluation


def _get_rubric_criteria(db: Session, competition_id: str):
    rubric = db.query(Rubric).filter(Rubric.competition_id == competition_id, Rubric.active == True).first()  # noqa: E712
    if rubric is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active rubric is configured for this competition")
    return rubric.criteria


@router.get("/competitions/{competition_id}/rubric", response_model=RubricResponse)
def get_rubric_for_judging(
    competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_judge)
) -> RubricResponse:
    if competition_id not in _assigned_competition_ids(db, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to this competition")

    rubric = db.query(Rubric).filter(Rubric.competition_id == competition_id, Rubric.active == True).first()  # noqa: E712
    if rubric is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active rubric is configured for this competition")
    return rubric


def _get_or_create_draft(db: Session, application: Application, judge: User) -> Evaluation:
    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.application_id == application.id, Evaluation.judge_id == judge.id)
        .first()
    )
    if evaluation is None:
        evaluation = Evaluation(
            competition_id=application.competition_id,
            judge_id=judge.id,
            application_id=application.id,
        )
        db.add(evaluation)
        db.flush()
    if evaluation.status == EvaluationStatus.SUBMITTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This evaluation has already been submitted and is locked")
    return evaluation


@evaluations_router.post("", response_model=EvaluationResponse)
def save_draft(
    payload: EvaluationSaveRequest, db: Session = Depends(get_db), current_user: User = Depends(require_judge)
) -> EvaluationResponse:
    application = db.get(Application, payload.application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    _authorize_judge_for_application(db, application, current_user.id)

    competition = db.get(Competition, application.competition_id)
    if competition.status != CompetitionStatus.JUDGING_OPEN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Judging is not currently open for this competition")

    evaluation = _get_or_create_draft(db, application, current_user)

    criteria = _get_rubric_criteria(db, application.competition_id)
    criteria_by_id = {c.id: c for c in criteria}
    valid_inputs = [s for s in payload.scores if s.criterion_id in criteria_by_id]

    db.query(EvaluationScore).filter(EvaluationScore.evaluation_id == evaluation.id).delete()

    # Drafts may be incomplete (not every criterion scored yet), but any score
    # that IS provided must still be within its criterion's valid range.
    scored: dict[str, tuple[float, float]] = {}
    for s in valid_inputs:
        criterion = criteria_by_id[s.criterion_id]
        if not (criterion.minimum_score <= s.score <= criterion.maximum_score):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Score for '{criterion.name}' must be between {criterion.minimum_score} and {criterion.maximum_score}",
            )
        contribution = (s.score / criterion.maximum_score) * criterion.weight * 100
        scored[s.criterion_id] = (s.score, contribution)

    weighted_total = sum(c for _, c in scored.values()) if len(scored) == len(criteria_by_id) else None
    for criterion_id, (score, contribution) in scored.items():
        db.add(EvaluationScore(evaluation_id=evaluation.id, criterion_id=criterion_id, score=score, weighted_contribution=contribution))

    evaluation.strengths = payload.strengths
    evaluation.improvements = payload.improvements
    evaluation.comments = payload.comments
    evaluation.weighted_total = weighted_total
    evaluation.last_saved_at = datetime.now(timezone.utc)

    audit.record(db, action="JUDGE_SAVED_DRAFT", entity_type="Evaluation", entity_id=evaluation.id, user=current_user)
    db.commit()
    db.refresh(evaluation)
    return evaluation


@evaluations_router.post("/{evaluation_id}/submit", response_model=EvaluationResponse)
def submit_evaluation(
    evaluation_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_judge)
) -> EvaluationResponse:
    evaluation = db.get(Evaluation, evaluation_id)
    if evaluation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation not found")
    if evaluation.judge_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only submit your own evaluation")
    if evaluation.status == EvaluationStatus.SUBMITTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This evaluation has already been submitted")

    competition = db.get(Competition, evaluation.competition_id)
    if competition.status != CompetitionStatus.JUDGING_OPEN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Judging is not currently open for this competition")

    application = db.get(Application, evaluation.application_id)
    _authorize_judge_for_application(db, application, current_user.id)

    criteria = _get_rubric_criteria(db, evaluation.competition_id)
    existing_scores = db.query(EvaluationScore).filter(EvaluationScore.evaluation_id == evaluation.id).all()
    score_inputs = [ScoreInput(criterion_id=s.criterion_id, score=s.score) for s in existing_scores]

    try:
        scored, weighted_total = calculate_weighted_scores(criteria, score_inputs)
    except ScoreValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    db.query(EvaluationScore).filter(EvaluationScore.evaluation_id == evaluation.id).delete()
    for criterion_id, (score, contribution) in scored.items():
        db.add(EvaluationScore(evaluation_id=evaluation.id, criterion_id=criterion_id, score=score, weighted_contribution=contribution))

    evaluation.weighted_total = weighted_total
    evaluation.status = EvaluationStatus.SUBMITTED
    evaluation.submitted_at = datetime.now(timezone.utc)

    audit.record(
        db,
        action="JUDGE_SUBMITTED_EVALUATION",
        entity_type="Evaluation",
        entity_id=evaluation.id,
        user=current_user,
        metadata={"weighted_total": weighted_total},
    )
    db.commit()
    db.refresh(evaluation)
    return evaluation


@evaluations_router.get("/{evaluation_id}", response_model=EvaluationResponse)
def get_evaluation(evaluation_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> EvaluationResponse:
    """A judge may only ever fetch their OWN evaluation. Admins may view any
    evaluation for consolidation/audit purposes; other judges are always rejected."""
    evaluation = db.get(Evaluation, evaluation_id)
    if evaluation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation not found")

    if current_user.role == UserRole.ADMIN:
        return evaluation
    if current_user.role == UserRole.JUDGE and evaluation.judge_id == current_user.id:
        return evaluation

    raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this evaluation")
