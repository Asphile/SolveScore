from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import AIAnalysisStatus, RiskLevel
from app.models.user import _now, _uuid


class AIContentAnalysis(Base):
    """Stores a single AI-content-detection pass over a resource.

    Result is an indicator for human review only — see app.services.ai_detection
    for the provider interface and the rule that this must never drive automated
    decisions (rejection, disqualification, score changes).
    """

    __tablename__ = "ai_content_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    resource_id: Mapped[str] = mapped_column(String(36), ForeignKey("resources.id"))

    analysis_type: Mapped[str] = mapped_column(String(30))  # TEXT | TRANSCRIPT
    status: Mapped[AIAnalysisStatus] = mapped_column(String(30), default=AIAnalysisStatus.NOT_CHECKED)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-100, likelihood indicator
    risk_level: Mapped[RiskLevel | None] = mapped_column(String(20), nullable=True)
    detected_sections: Mapped[str] = mapped_column(String(4000), default="")
    analysis_summary: Mapped[str] = mapped_column(String(2000), default="")
    provider: Mapped[str] = mapped_column(String(50), default="stub")

    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    admin_notes: Mapped[str] = mapped_column(String(2000), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    resource: Mapped["Resource"] = relationship(back_populates="analyses")  # noqa: F821
