from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.application import Application
from app.models.enums import ApplicationStatus, UserRole
from app.models.resource import Resource
from app.models.school import School
from app.models.user import User
from app.schemas.resource import ResourceResponse
from app.services import audit
from app.services.ai_pipeline import run_analysis_for_resource
from app.services.file_storage import FileValidationError, generate_secure_filename, save_upload, validate_and_classify

router = APIRouter(prefix="/api/resources", tags=["resources"])
applications_router = APIRouter(prefix="/api/applications", tags=["resources"])


def _authorize_application_access(db: Session, application: Application, current_user: User) -> None:
    if current_user.role == UserRole.ADMIN:
        return
    if current_user.role == UserRole.SCHOOL:
        school = db.query(School).filter(School.user_id == current_user.id).first()
        if school is None or application.school_id != school.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this application's files")
        return
    if current_user.role == UserRole.JUDGE:
        if application.status not in (ApplicationStatus.APPROVED, ApplicationStatus.JUDGING, ApplicationStatus.COMPLETED):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This application is not yet available for judging")
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")


@applications_router.post("/{application_id}/resources", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def upload_resource(
    application_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResourceResponse:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if current_user.role != UserRole.SCHOOL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owning school can upload files")
    _authorize_application_access(db, application, current_user)
    if application.status not in (ApplicationStatus.DRAFT, ApplicationStatus.CHANGES_REQUESTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Files cannot be uploaded once the application is submitted")

    content = await file.read()

    try:
        resource_type, ext = validate_and_classify(file, len(content), header=content[:16])
    except FileValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    secure_name = generate_secure_filename(ext)
    storage_path = save_upload(application_id, secure_name, content)

    resource = Resource(
        application_id=application_id,
        resource_type=resource_type,
        original_filename=file.filename or secure_name,
        secure_filename=secure_name,
        file_type=ext.lstrip("."),
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        storage_location=storage_path,
    )
    db.add(resource)
    db.flush()

    action = "SCHOOL_UPLOADED_VIDEO" if resource_type.value == "VIDEO" else "SCHOOL_UPLOADED_DOCUMENT"
    audit.record(db, action=action, entity_type="Resource", entity_id=resource.id, user=current_user)
    db.commit()
    db.refresh(resource)

    run_analysis_for_resource(db, resource, triggered_by=current_user)

    return resource


@applications_router.get("/{application_id}/resources", response_model=list[ResourceResponse])
def list_resources(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[ResourceResponse]:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    _authorize_application_access(db, application, current_user)
    return db.query(Resource).filter(Resource.application_id == application_id).all()


@router.get("/{resource_id}/file")
def download_resource(resource_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> FileResponse:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")
    application = db.get(Application, resource.application_id)
    _authorize_application_access(db, application, current_user)

    return FileResponse(
        resource.storage_location,
        media_type=resource.mime_type,
        filename=resource.original_filename,
    )


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(resource_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")
    application = db.get(Application, resource.application_id)
    if current_user.role != UserRole.SCHOOL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owning school can delete files")
    _authorize_application_access(db, application, current_user)
    if application.status not in (ApplicationStatus.DRAFT, ApplicationStatus.CHANGES_REQUESTED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Files cannot be removed once the application is submitted")

    db.delete(resource)
    db.commit()
