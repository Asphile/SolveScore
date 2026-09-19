from datetime import datetime

from pydantic import BaseModel

from app.models.enums import AIAnalysisStatus, RiskLevel


class AIAnalysisResponse(BaseModel):
    id: str
    resource_id: str
    analysis_type: str
    status: AIAnalysisStatus
    confidence: float | None
    risk_level: RiskLevel | None
    analysis_summary: str
    provider: str
    reviewed_by: str | None
    reviewed_at: datetime | None
    admin_notes: str
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class AIAnalysisReviewRequest(BaseModel):
    admin_notes: str = ""


class AIResourceReportItem(BaseModel):
    resource_id: str
    filename: str
    resource_type: str
    ai_status: str
    latest_analysis: AIAnalysisResponse | None

    model_config = {"from_attributes": True}


class AIApplicationReportResponse(BaseModel):
    application_id: str
    overall_risk: RiskLevel | None
    items: list[AIResourceReportItem]
