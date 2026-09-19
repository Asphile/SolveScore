from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import _now, _uuid


class School(Base):
    __tablename__ = "schools"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True)

    school_name: Mapped[str] = mapped_column(String(255))
    registration_number: Mapped[str] = mapped_column(String(100))
    province: Mapped[str] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(500))
    contact_name: Mapped[str] = mapped_column(String(255))
    contact_email: Mapped[str] = mapped_column(String(255))
    contact_phone: Mapped[str] = mapped_column(String(50))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="school")  # noqa: F821
    participations: Mapped[list["CompetitionParticipant"]] = relationship(back_populates="school")  # noqa: F821
