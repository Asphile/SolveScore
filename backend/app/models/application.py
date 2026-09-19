from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ApplicationStatus
from app.models.user import _now, _uuid


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("competition_id", "school_id", name="uq_application_competition_school"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    competition_id: Mapped[str] = mapped_column(String(36), ForeignKey("competitions.id"))
    school_id: Mapped[str] = mapped_column(String(36), ForeignKey("schools.id"))

    project_title: Mapped[str] = mapped_column(String(255), default="")
    problem_description: Mapped[str] = mapped_column(String(4000), default="")
    solution_description: Mapped[str] = mapped_column(String(4000), default="")
    innovation_description: Mapped[str] = mapped_column(String(4000), default="")
    impact_description: Mapped[str] = mapped_column(String(4000), default="")
    implementation_plan: Mapped[str] = mapped_column(String(4000), default="")
    technology_used: Mapped[str] = mapped_column(String(1000), default="")
    category: Mapped[str] = mapped_column(String(255), default="")
    teacher_coordinator: Mapped[str] = mapped_column(String(255), default="")

    status: Mapped[ApplicationStatus] = mapped_column(String(30), default=ApplicationStatus.DRAFT)
    review_notes: Mapped[str] = mapped_column(String(2000), default="")

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    team_members: Mapped[list["TeamMember"]] = relationship(back_populates="application", cascade="all, delete-orphan")
    resources: Mapped[list["Resource"]] = relationship(back_populates="application", cascade="all, delete-orphan")  # noqa: F821


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"))
    name: Mapped[str] = mapped_column(String(255))
    grade: Mapped[str] = mapped_column(String(50), default="")
    role: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    application: Mapped["Application"] = relationship(back_populates="team_members")
