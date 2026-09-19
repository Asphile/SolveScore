from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ResourceType


class ResourceResponse(BaseModel):
    id: str
    application_id: str
    resource_type: ResourceType
    original_filename: str
    file_type: str
    mime_type: str
    file_size: int
    upload_status: str
    ai_analysis_status: str
    created_at: datetime

    model_config = {"from_attributes": True}
