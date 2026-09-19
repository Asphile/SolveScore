from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.ai_analysis import AIContentAnalysis
from app.models.enums import AIAnalysisStatus, ResourceType, RiskLevel
from app.models.resource import Resource
from app.models.user import User
from app.services import audit
from app.services.ai_detection import AIDetectionNotConfiguredError, get_provider
from app.services.text_extraction import extract_text, extract_text_from_video

RISK_TO_STATUS = {
    RiskLevel.LOW: AIAnalysisStatus.LOW_INDICATION,
    RiskLevel.MEDIUM: AIAnalysisStatus.REVIEW_REQUIRED,
    RiskLevel.HIGH: AIAnalysisStatus.REVIEW_REQUIRED,
}


def run_analysis_for_resource(db: Session, resource: Resource, *, triggered_by: User | None = None) -> AIContentAnalysis | None:
    """Runs the AI content-detection pipeline for a single resource.

    Implements: extract content -> analyze -> store result -> status update.
    DOCUMENT/PRESENTATION resources are analyzed via text extraction. VIDEO
    resources go through the same pipeline, but transcription is a documented,
    unimplemented integration point (see text_extraction.py) -- until a
    transcription provider is wired up, video resources are recorded as
    NOT_CHECKED with an explicit explanation, rather than silently skipped, so
    judges and admins always see an honest status instead of a blank one.

    The result is always an indicator awaiting human review -- see
    app/services/ai_detection.py for why this never drives automated decisions.
    """
    if resource.resource_type not in (ResourceType.DOCUMENT, ResourceType.PRESENTATION, ResourceType.VIDEO):
        return None

    is_video = resource.resource_type == ResourceType.VIDEO
    audit.record(db, action="AI_ANALYSIS_STARTED", entity_type="Resource", entity_id=resource.id, user=triggered_by)

    analysis = AIContentAnalysis(
        resource_id=resource.id,
        analysis_type="TRANSCRIPT" if is_video else "TEXT",
        status=AIAnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    resource.ai_analysis_status = AIAnalysisStatus.PROCESSING.value
    db.flush()

    try:
        text = extract_text_from_video(resource.storage_location) if is_video else extract_text(resource.storage_location)
        provider = get_provider()
        result = provider.analyze_text(text)

        analysis.confidence = result.confidence
        analysis.risk_level = result.risk_level
        analysis.analysis_summary = result.summary
        analysis.detected_sections = result.detected_sections
        analysis.provider = result.provider
        analysis.status = RISK_TO_STATUS.get(RiskLevel(result.risk_level), AIAnalysisStatus.REVIEW_REQUIRED)
        analysis.completed_at = datetime.now(timezone.utc)
    except NotImplementedError as exc:
        analysis.status = AIAnalysisStatus.NOT_CHECKED
        analysis.analysis_summary = str(exc)
    except AIDetectionNotConfiguredError as exc:
        analysis.status = AIAnalysisStatus.ERROR
        analysis.analysis_summary = str(exc)
    except Exception as exc:  # defensive: never let a detection failure break the upload flow
        analysis.status = AIAnalysisStatus.ERROR
        analysis.analysis_summary = f"Analysis failed: {exc}"

    resource.ai_analysis_status = analysis.status.value if hasattr(analysis.status, "value") else analysis.status

    audit.record(
        db,
        action="AI_ANALYSIS_COMPLETED",
        entity_type="Resource",
        entity_id=resource.id,
        user=triggered_by,
        metadata={"status": str(analysis.status), "confidence": analysis.confidence},
    )
    db.commit()
    db.refresh(analysis)
    return analysis
