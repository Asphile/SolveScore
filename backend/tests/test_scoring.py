from dataclasses import dataclass

import pytest

from app.schemas.evaluation import ScoreInput
from app.services.evaluation_service import ScoreValidationError, calculate_weighted_scores


@dataclass
class FakeCriterion:
    id: str
    name: str
    weight: float
    minimum_score: int = 1
    maximum_score: int = 10


CRITERIA = [
    FakeCriterion(id="innovation", name="Innovation", weight=0.40),
    FakeCriterion(id="feasibility", name="Feasibility", weight=0.30),
    FakeCriterion(id="impact", name="Impact", weight=0.30),
]


def test_weighted_score_matches_spec_example():
    scores = [
        ScoreInput(criterion_id="innovation", score=8),
        ScoreInput(criterion_id="feasibility", score=9),
        ScoreInput(criterion_id="impact", score=7),
    ]
    results, total = calculate_weighted_scores(CRITERIA, scores)

    assert results["innovation"][1] == pytest.approx(32.0)
    assert results["feasibility"][1] == pytest.approx(27.0)
    assert results["impact"][1] == pytest.approx(21.0)
    assert total == pytest.approx(80.0)


def test_perfect_scores_yield_100():
    scores = [ScoreInput(criterion_id=c.id, score=10) for c in CRITERIA]
    _, total = calculate_weighted_scores(CRITERIA, scores)
    assert total == pytest.approx(100.0)


def test_missing_criterion_raises():
    scores = [ScoreInput(criterion_id="innovation", score=8), ScoreInput(criterion_id="feasibility", score=9)]
    with pytest.raises(ScoreValidationError):
        calculate_weighted_scores(CRITERIA, scores)


def test_out_of_range_score_raises():
    scores = [
        ScoreInput(criterion_id="innovation", score=15),
        ScoreInput(criterion_id="feasibility", score=9),
        ScoreInput(criterion_id="impact", score=7),
    ]
    with pytest.raises(ScoreValidationError):
        calculate_weighted_scores(CRITERIA, scores)


def test_unknown_criterion_raises():
    scores = [
        ScoreInput(criterion_id="innovation", score=8),
        ScoreInput(criterion_id="feasibility", score=9),
        ScoreInput(criterion_id="impact", score=7),
        ScoreInput(criterion_id="not-a-real-criterion", score=5),
    ]
    with pytest.raises(ScoreValidationError):
        calculate_weighted_scores(CRITERIA, scores)
