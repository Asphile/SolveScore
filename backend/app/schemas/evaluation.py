from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import EvaluationStatus


class ScoreInput(BaseModel):
    criterion_id: str
    score: float = Field(ge=0)


class EvaluationSaveRequest(BaseModel):
    application_id: str
    scores: list[ScoreInput] = []
    strengths: str = ""
    improvements: str = ""
    comments: str = ""


class EvaluationScoreResponse(BaseModel):
    criterion_id: str
    score: float
    weighted_contribution: float

    model_config = {"from_attributes": True}


class EvaluationResponse(BaseModel):
    id: str
    competition_id: str
    application_id: str
    status: EvaluationStatus
    weighted_total: float | None
    strengths: str
    improvements: str
    comments: str
    submitted_at: datetime | None
    last_saved_at: datetime
    scores: list[EvaluationScoreResponse] = []

    model_config = {"from_attributes": True}
