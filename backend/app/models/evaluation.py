from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EvaluationStatus
from app.models.user import _now, _uuid


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        UniqueConstraint("competition_id", "judge_id", "application_id", name="uq_evaluation_judge_application"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    competition_id: Mapped[str] = mapped_column(String(36), ForeignKey("competitions.id"))
    judge_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"))

    status: Mapped[EvaluationStatus] = mapped_column(String(20), default=EvaluationStatus.DRAFT)
    weighted_total: Mapped[float | None] = mapped_column(Float, nullable=True)

    strengths: Mapped[str] = mapped_column(String(2000), default="")
    improvements: Mapped[str] = mapped_column(String(2000), default="")
    comments: Mapped[str] = mapped_column(String(2000), default="")

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    scores: Mapped[list["EvaluationScore"]] = relationship(back_populates="evaluation", cascade="all, delete-orphan")


class EvaluationScore(Base):
    __tablename__ = "evaluation_scores"
    __table_args__ = (UniqueConstraint("evaluation_id", "criterion_id", name="uq_evaluation_criterion"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(String(36), ForeignKey("evaluations.id"))
    criterion_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubric_criteria.id"))
    score: Mapped[float] = mapped_column(Float)
    weighted_contribution: Mapped[float] = mapped_column(Float)

    evaluation: Mapped["Evaluation"] = relationship(back_populates="scores")
