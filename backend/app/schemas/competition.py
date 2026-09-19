from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import CompetitionStatus


class CompetitionCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ""
    theme: str = ""
    eligibility: str = ""
    max_participants: int = Field(default=20, ge=1, le=20)
    application_open_date: datetime | None = None
    application_close_date: datetime | None = None
    judging_open_date: datetime | None = None
    judging_close_date: datetime | None = None


class CompetitionUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    theme: str | None = None
    eligibility: str | None = None
    status: CompetitionStatus | None = None
    max_participants: int | None = Field(default=None, ge=1, le=20)
    application_open_date: datetime | None = None
    application_close_date: datetime | None = None
    judging_open_date: datetime | None = None
    judging_close_date: datetime | None = None


class CompetitionResponse(BaseModel):
    id: str
    name: str
    description: str
    theme: str
    eligibility: str
    status: CompetitionStatus
    max_participants: int
    registered_count: int
    spaces_remaining: int
    application_open_date: datetime | None
    application_close_date: datetime | None
    judging_open_date: datetime | None
    judging_close_date: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
