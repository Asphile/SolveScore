from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ResourceType
from app.models.user import _now, _uuid


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"))
    resource_type: Mapped[ResourceType] = mapped_column(String(20))

    original_filename: Mapped[str] = mapped_column(String(500))
    secure_filename: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(20))
    mime_type: Mapped[str] = mapped_column(String(120))
    file_size: Mapped[int] = mapped_column(Integer)
    storage_location: Mapped[str] = mapped_column(String(1000))

    upload_status: Mapped[str] = mapped_column(String(30), default="UPLOADED")
    ai_analysis_status: Mapped[str] = mapped_column(String(30), default="NOT_CHECKED")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    application: Mapped["Application"] = relationship(back_populates="resources")  # noqa: F821
    analyses: Mapped[list["AIContentAnalysis"]] = relationship(back_populates="resource", cascade="all, delete-orphan")  # noqa: F821
