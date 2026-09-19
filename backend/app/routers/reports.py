import csv
import io

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.competition import Competition
from app.models.user import User
from app.services.results_service import compute_leaderboard

router = APIRouter(prefix="/api/admin/reports", tags=["reports"])


def _leaderboard_dataframe(db: Session, competition_id: str) -> pd.DataFrame:
    rows = compute_leaderboard(db, competition_id)
    return pd.DataFrame(rows)


@router.get("/score-report.csv")
def score_report_csv(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    df = _leaderboard_dataframe(db, competition_id)
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=score_report.csv"},
    )


@router.get("/score-report.pdf")
def score_report_pdf(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")

    rows = compute_leaderboard(db, competition_id)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = [Paragraph(f"Official Score Report — {competition.name}", styles["Title"]), Spacer(1, 12)]

    table_data = [["Rank", "School", "Project", "Judges Completed", "Average Score"]]
    for row in rows:
        table_data.append([
            row["rank"] or "-",
            row["school_name"],
            row["project_title"] or "-",
            f"{row['judges_completed']}/{row['judges_total']}",
            row["average_score"] if row["average_score"] is not None else "Incomplete",
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#071D49")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F6F8")]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=score_report.pdf"},
    )


@router.get("/audit-report.csv")
def audit_report_csv(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(5000).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["timestamp", "user_id", "role", "action", "entity_type", "entity_id", "metadata"])
    for log in logs:
        writer.writerow([log.timestamp, log.user_id, log.role, log.action, log.entity_type, log.entity_id, log.metadata_json])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_report.csv"},
    )


@router.get("/competition-report.csv")
def competition_report_csv(competition_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    applications = db.query(Application).filter(Application.competition_id == competition_id).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["application_id", "school_id", "project_title", "status", "submitted_at"])
    for app_ in applications:
        writer.writerow([app_.id, app_.school_id, app_.project_title, app_.status, app_.submitted_at])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=competition_report.csv"},
    )
