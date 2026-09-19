"""Section 50 of the spec: the critical cross-tenant isolation tests.

Judge A must never be able to read Judge B's evaluation, and School A must
never be able to read School B's application, even though both are
authenticated, legitimate users of the system.
"""

from app.models.enums import ApplicationStatus, ResourceType, UserRole
from app.models.resource import Resource

from tests.conftest import auth_headers, make_school, make_user


def _setup_competition(client, db_session):
    admin = make_user(db_session, UserRole.ADMIN, "admin@example.com")
    competition_id = client.post(
        "/api/competitions", json={"name": "Isolation Test Competition"}, headers=auth_headers(admin)
    ).json()["id"]
    client.put(f"/api/competitions/{competition_id}", json={"status": "APPLICATIONS_OPEN"}, headers=auth_headers(admin))
    return admin, competition_id


def _submit_application(client, db_session, competition_id, school_user, title):
    headers = auth_headers(school_user)
    client.post(f"/api/competitions/{competition_id}/join", headers=headers)
    application_id = client.post("/api/applications", json={"competition_id": competition_id}, headers=headers).json()["id"]

    client.put(
        f"/api/applications/{application_id}",
        json={
            "project_title": title,
            "problem_description": "A problem",
            "solution_description": "A solution",
        },
        headers=headers,
    )

    # Bypass the multipart upload endpoint for test speed; insert the resource directly.
    db_session.add(
        Resource(
            application_id=application_id,
            resource_type=ResourceType.DOCUMENT,
            original_filename="proposal.pdf",
            secure_filename="proposal.pdf",
            file_type="pdf",
            mime_type="application/pdf",
            file_size=100,
            storage_location="/tmp/proposal.pdf",
        )
    )
    db_session.commit()

    submit_response = client.post(f"/api/applications/{application_id}/submit", headers=headers)
    assert submit_response.status_code == 200
    return application_id


def test_school_cannot_access_another_schools_application(client, db_session):
    _, competition_id = _setup_competition(client, db_session)
    school_a, _ = make_school(db_session, "schoola@example.com", "School A")
    school_b, _ = make_school(db_session, "schoolb@example.com", "School B")

    application_a_id = _submit_application(client, db_session, competition_id, school_a, "Project A")

    response = client.get(f"/api/applications/{application_a_id}", headers=auth_headers(school_b))
    assert response.status_code == 403


def test_judge_cannot_access_another_judges_evaluation(client, db_session):
    admin, competition_id = _setup_competition(client, db_session)
    school_a, _ = make_school(db_session, "schoola@example.com", "School A")
    application_id = _submit_application(client, db_session, competition_id, school_a, "Project A")

    approve = client.post(f"/api/admin/applications/{application_id}/approve", json={"notes": ""}, headers=auth_headers(admin))
    assert approve.status_code == 200

    rubric_response = client.post(
        f"/api/admin/competitions/{competition_id}/rubric",
        json={
            "name": "Standard",
            "criteria": [
                {"name": "Innovation", "weight": 0.4},
                {"name": "Feasibility", "weight": 0.3},
                {"name": "Impact", "weight": 0.3},
            ],
        },
        headers=auth_headers(admin),
    )
    assert rubric_response.status_code == 201
    criteria = rubric_response.json()["criteria"]

    judge_a = make_user(db_session, UserRole.JUDGE, "judgea@example.com")
    judge_b = make_user(db_session, UserRole.JUDGE, "judgeb@example.com")
    for judge in (judge_a, judge_b):
        assign = client.post(
            f"/api/admin/competitions/{competition_id}/judges", json={"judge_id": judge.id}, headers=auth_headers(admin)
        )
        assert assign.status_code == 201

    client.put(f"/api/competitions/{competition_id}", json={"status": "JUDGING_OPEN"}, headers=auth_headers(admin))

    save_response = client.post(
        "/api/evaluations",
        json={
            "application_id": application_id,
            "scores": [{"criterion_id": c["id"], "score": 8} for c in criteria],
            "strengths": "Great work",
        },
        headers=auth_headers(judge_a),
    )
    assert save_response.status_code == 200
    evaluation_id = save_response.json()["id"]

    submit_response = client.post(f"/api/evaluations/{evaluation_id}/submit", headers=auth_headers(judge_a))
    assert submit_response.status_code == 200

    # Judge A can read their own evaluation.
    own = client.get(f"/api/evaluations/{evaluation_id}", headers=auth_headers(judge_a))
    assert own.status_code == 200

    # Judge B must be rejected when trying to read Judge A's evaluation.
    other = client.get(f"/api/evaluations/{evaluation_id}", headers=auth_headers(judge_b))
    assert other.status_code == 403

    # Judge B's "my evaluation for this application" view must come back empty, not Judge A's data.
    judge_b_view = client.get(f"/api/judge/applications/{application_id}/evaluation", headers=auth_headers(judge_b))
    assert judge_b_view.status_code == 200
    assert judge_b_view.json() is None


def test_unassigned_judge_cannot_access_application(client, db_session):
    admin, competition_id = _setup_competition(client, db_session)
    school_a, _ = make_school(db_session, "schoola@example.com", "School A")
    application_id = _submit_application(client, db_session, competition_id, school_a, "Project A")
    client.post(f"/api/admin/applications/{application_id}/approve", json={"notes": ""}, headers=auth_headers(admin))

    unassigned_judge = make_user(db_session, UserRole.JUDGE, "unassigned@example.com")
    response = client.get(f"/api/judge/applications/{application_id}", headers=auth_headers(unassigned_judge))
    assert response.status_code == 403
