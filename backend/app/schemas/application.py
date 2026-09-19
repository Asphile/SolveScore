from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ApplicationStatus


class TeamMemberInput(BaseModel):
    name: str
    grade: str = ""
    role: str = ""


class ApplicationUpdateRequest(BaseModel):
    project_title: str | None = None
    problem_description: str | None = None
    solution_description: str | None = None
    innovation_description: str | None = None
    impact_description: str | None = None
    implementation_plan: str | None = None
    technology_used: str | None = None
    category: str | None = None
    teacher_coordinator: str | None = None
    team_members: list[TeamMemberInput] | None = None


class TeamMemberResponse(BaseModel):
    id: str
    name: str
    grade: str
    role: str

    model_config = {"from_attributes": True}


class ApplicationResponse(BaseModel):
    id: str
    competition_id: str
    school_id: str
    project_title: str
    problem_description: str
    solution_description: str
    innovation_description: str
    impact_description: str
    implementation_plan: str
    technology_used: str
    category: str
    teacher_coordinator: str
    status: ApplicationStatus
    review_notes: str
    submitted_at: datetime | None
    approved_at: datetime | None
    updated_at: datetime
    team_members: list[TeamMemberResponse] = []

    model_config = {"from_attributes": True}


class ReviewDecisionRequest(BaseModel):
    notes: str = ""
