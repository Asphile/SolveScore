from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import CompetitionStatus, ParticipantStatus
from app.models.user import _now, _uuid


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(4000), default="")
    theme: Mapped[str] = mapped_column(String(500), default="")
    eligibility: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[CompetitionStatus] = mapped_column(String(30), default=CompetitionStatus.DRAFT)
    max_participants: Mapped[int] = mapped_column(Integer, default=20)

    application_open_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    application_close_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    judging_open_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    judging_close_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    participants: Mapped[list["CompetitionParticipant"]] = relationship(back_populates="competition")
    rubrics: Mapped[list["Rubric"]] = relationship(back_populates="competition")  # noqa: F821
    judge_assignments: Mapped[list["JudgeAssignment"]] = relationship(back_populates="competition")  # noqa: F821


class CompetitionParticipant(Base):
    __tablename__ = "competition_participants"
    __table_args__ = (UniqueConstraint("competition_id", "school_id", name="uq_competition_school"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    competition_id: Mapped[str] = mapped_column(String(36), ForeignKey("competitions.id"))
    school_id: Mapped[str] = mapped_column(String(36), ForeignKey("schools.id"))
    status: Mapped[ParticipantStatus] = mapped_column(String(20), default=ParticipantStatus.JOINED)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    competition: Mapped["Competition"] = relationship(back_populates="participants")
    school: Mapped["School"] = relationship(back_populates="participations")  # noqa: F821


class JudgeAssignment(Base):
    __tablename__ = "judge_assignments"
    __table_args__ = (UniqueConstraint("competition_id", "judge_id", name="uq_competition_judge"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    competition_id: Mapped[str] = mapped_column(String(36), ForeignKey("competitions.id"))
    judge_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    competition: Mapped["Competition"] = relationship(back_populates="judge_assignments")
