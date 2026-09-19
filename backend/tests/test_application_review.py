from app.models.enums import ResourceType, UserRole
from app.models.resource import Resource

from tests.conftest import auth_headers, make_school, make_user


def _draft_application(client, db_session):
    admin = make_user(db_session, UserRole.ADMIN, "admin@example.com")
    competition_id = client.post("/api/competitions", json={"name": "Review Test"}, headers=auth_headers(admin)).json()["id"]
    client.put(f"/api/competitions/{competition_id}", json={"status": "APPLICATIONS_OPEN"}, headers=auth_headers(admin))

    school_user, _ = make_school(db_session, "school@example.com", "Review School")
    headers = auth_headers(school_user)
    client.post(f"/api/competitions/{competition_id}/join", headers=headers)
    application_id = client.post("/api/applications", json={"competition_id": competition_id}, headers=headers).json()["id"]
    return admin, school_user, competition_id, application_id


def test_cannot_submit_without_required_fields(client, db_session):
    _, school_user, _, application_id = _draft_application(client, db_session)
    response = client.post(f"/api/applications/{application_id}/submit", headers=auth_headers(school_user))
    assert response.status_code == 400


def test_cannot_submit_without_documents(client, db_session):
    _, school_user, _, application_id = _draft_application(client, db_session)
    client.put(
        f"/api/applications/{application_id}",
        json={"project_title": "P", "problem_description": "X", "solution_description": "Y"},
        headers=auth_headers(school_user),
    )
    response = client.post(f"/api/applications/{application_id}/submit", headers=auth_headers(school_user))
    assert response.status_code == 400
    assert "document" in response.json()["detail"].lower()


def test_full_review_cycle_request_changes_then_approve(client, db_session):
    admin, school_user, _, application_id = _draft_application(client, db_session)
    headers = auth_headers(school_user)

    client.put(
        f"/api/applications/{application_id}",
        json={"project_title": "P", "problem_description": "X", "solution_description": "Y"},
        headers=headers,
    )
    db_session.add(
        Resource(
            application_id=application_id,
            resource_type=ResourceType.DOCUMENT,
            original_filename="a.pdf",
            secure_filename="a.pdf",
            file_type="pdf",
            mime_type="application/pdf",
            file_size=10,
            storage_location="/tmp/a.pdf",
        )
    )
    db_session.commit()

    submit = client.post(f"/api/applications/{application_id}/submit", headers=headers)
    assert submit.status_code == 200
    assert submit.json()["status"] == "SUBMITTED"

    changes = client.post(
        f"/api/admin/applications/{application_id}/request-changes",
        json={"notes": "Please add more detail on impact"},
        headers=auth_headers(admin),
    )
    assert changes.status_code == 200
    assert changes.json()["status"] == "CHANGES_REQUESTED"

    # School can edit again after changes were requested.
    edit = client.put(
        f"/api/applications/{application_id}",
        json={"impact_description": "Now with more detail"},
        headers=headers,
    )
    assert edit.status_code == 200
    assert edit.json()["status"] == "DRAFT"

    resubmit = client.post(f"/api/applications/{application_id}/submit", headers=headers)
    assert resubmit.status_code == 200

    approve = client.post(f"/api/admin/applications/{application_id}/approve", json={"notes": "Looks good"}, headers=auth_headers(admin))
    assert approve.status_code == 200
    assert approve.json()["status"] == "APPROVED"


def test_school_cannot_edit_after_submission(client, db_session):
    admin, school_user, _, application_id = _draft_application(client, db_session)
    headers = auth_headers(school_user)
    client.put(
        f"/api/applications/{application_id}",
        json={"project_title": "P", "problem_description": "X", "solution_description": "Y"},
        headers=headers,
    )
    db_session.add(
        Resource(
            application_id=application_id,
            resource_type=ResourceType.DOCUMENT,
            original_filename="a.pdf",
            secure_filename="a.pdf",
            file_type="pdf",
            mime_type="application/pdf",
            file_size=10,
            storage_location="/tmp/a.pdf",
        )
    )
    db_session.commit()
    client.post(f"/api/applications/{application_id}/submit", headers=headers)

    edit_attempt = client.put(f"/api/applications/{application_id}", json={"project_title": "Changed"}, headers=headers)
    assert edit_attempt.status_code == 400
