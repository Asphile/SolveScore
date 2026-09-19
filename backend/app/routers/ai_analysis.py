from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.models.ai_analysis import AIContentAnalysis
from app.models.application import Application
from app.models.resource import Resource
from app.models.user import User
from app.routers.resources import _authorize_application_access
from app.schemas.ai_analysis import AIApplicationReportResponse, AIAnalysisResponse, AIAnalysisReviewRequest
from app.services import audit
from app.services.ai_pipeline import run_analysis_for_resource

router = APIRouter(prefix="/api/resources", tags=["ai-analysis"])
applications_router = APIRouter(prefix="/api/applications", tags=["ai-analysis"])


def _authorize_resource_view(db: Session, resource: Resource, current_user: User) -> None:
    """Admins, the owning school, and judges assigned to (and permitted to view)
    this application may all view its AI content-analysis results -- the same
    rule already used for viewing/downloading the underlying files.
    """
    application = db.get(Application, resource.application_id)
    _authorize_application_access(db, application, current_user)


@router.post("/{resource_id}/analyze", response_model=AIAnalysisResponse)
def trigger_analysis(resource_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> AIAnalysisResponse:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")

    analysis = run_analysis_for_resource(db, resource, triggered_by=current_user)
    if analysis is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "AI content analysis is not supported for this resource type",
        )
    return analysis


@router.get("/{resource_id}/analysis", response_model=list[AIAnalysisResponse])
def get_analysis(resource_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AIAnalysisResponse]:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")
    _authorize_resource_view(db, resource, current_user)
    return db.query(AIContentAnalysis).filter(AIContentAnalysis.resource_id == resource_id).all()


@router.post("/analysis/{analysis_id}/review", response_model=AIAnalysisResponse)
def mark_reviewed(
    analysis_id: str,
    payload: AIAnalysisReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> AIAnalysisResponse:
    analysis = db.get(AIContentAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")

    analysis.status = "REVIEWED"
    analysis.admin_notes = payload.admin_notes
    analysis.reviewed_by = current_user.id
    analysis.reviewed_at = datetime.now(timezone.utc)

    audit.record(db, action="ADMIN_REVIEWED_AI_RESULT", entity_type="AIContentAnalysis", entity_id=analysis.id, user=current_user)
    db.commit()
    db.refresh(analysis)
    return analysis


_RISK_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}


@applications_router.get("/{application_id}/ai-report", response_model=AIApplicationReportResponse)
def get_application_ai_report(
    application_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> AIApplicationReportResponse:
    """Consolidated AI content-detection report for every resource on an
    application -- the single place judges and admins can see, at a glance,
    whether anything submitted was flagged for human review.
    """
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    _authorize_application_access(db, application, current_user)

    resources = db.query(Resource).filter(Resource.application_id == application_id).all()
    items = []
    overall_risk: str | None = None
    for resource in resources:
        latest = (
            db.query(AIContentAnalysis)
            .filter(AIContentAnalysis.resource_id == resource.id)
            .order_by(AIContentAnalysis.created_at.desc())
            .first()
        )
        items.append(
            {
                "resource_id": resource.id,
                "filename": resource.original_filename,
                "resource_type": resource.resource_type,
                "ai_status": resource.ai_analysis_status,
                "latest_analysis": latest,
            }
        )
        if latest is not None and latest.risk_level:
            if overall_risk is None or _RISK_RANK.get(latest.risk_level, 0) > _RISK_RANK.get(overall_risk, 0):
                overall_risk = latest.risk_level

    return {"application_id": application_id, "overall_risk": overall_risk, "items": items}
