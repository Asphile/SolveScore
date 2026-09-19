from app.models.rubric import RubricCriterion
from app.schemas.evaluation import ScoreInput


class ScoreValidationError(Exception):
    pass


def calculate_weighted_scores(
    criteria: list[RubricCriterion], score_inputs: list[ScoreInput]
) -> tuple[dict[str, tuple[float, float]], float]:
    """Server-side scoring engine -- the only source of truth for official scores.

    Returns {criterion_id: (score, weighted_contribution)} and the weighted total
    (0-100 scale). Raises ScoreValidationError if inputs are out of range or
    incomplete relative to the active rubric.
    """
    criteria_by_id = {c.id: c for c in criteria}
    inputs_by_id = {s.criterion_id: s.score for s in score_inputs}

    missing = set(criteria_by_id) - set(inputs_by_id)
    if missing:
        names = ", ".join(criteria_by_id[c].name for c in missing)
        raise ScoreValidationError(f"Missing scores for required criteria: {names}")

    extra = set(inputs_by_id) - set(criteria_by_id)
    if extra:
        raise ScoreValidationError("Scores were submitted for criteria that do not belong to this rubric")

    results: dict[str, tuple[float, float]] = {}
    total = 0.0
    for criterion_id, criterion in criteria_by_id.items():
        score = inputs_by_id[criterion_id]
        if score < criterion.minimum_score or score > criterion.maximum_score:
            raise ScoreValidationError(
                f"Score for '{criterion.name}' must be between {criterion.minimum_score} and {criterion.maximum_score}"
            )
        contribution = (score / criterion.maximum_score) * criterion.weight * 100
        results[criterion_id] = (score, contribution)
        total += contribution

    return results, round(total, 2)
