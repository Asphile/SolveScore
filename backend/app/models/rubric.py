from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import _now, _uuid


class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    competition_id: Mapped[str] = mapped_column(String(36), ForeignKey("competitions.id"))
    name: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    competition: Mapped["Competition"] = relationship(back_populates="rubrics")  # noqa: F821
    criteria: Mapped[list["RubricCriterion"]] = relationship(back_populates="rubric", cascade="all, delete-orphan", order_by="RubricCriterion.display_order")


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    rubric_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubrics.id"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(1000), default="")
    weight: Mapped[float] = mapped_column(Float)  # fraction, e.g. 0.40 for 40%
    minimum_score: Mapped[int] = mapped_column(Integer, default=1)
    maximum_score: Mapped[int] = mapped_column(Integer, default=10)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    rubric: Mapped["Rubric"] = relationship(back_populates="criteria")
