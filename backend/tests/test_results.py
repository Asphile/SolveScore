from app.models.enums import UserRole

from tests.conftest import auth_headers, make_school, make_user


def _setup_approved_application(client, db_session):
    admin = make_user(db_session, UserRole.ADMIN, "admin@example.com")
    competition_id = client.post("/api/competitions", json={"name": "Results Test"}, headers=auth_headers(admin)).json()["id"]
    client.put(f"/api/competitions/{competition_id}", json={"status": "APPLICATIONS_OPEN"}, headers=auth_headers(admin))

    school_user, _ = make_school(db_session, "school@example.com", "Results School")
    headers = auth_headers(school_user)
    client.post(f"/api/competitions/{competition_id}/join", headers=headers)
    application_id = client.post("/api/applications", json={"competition_id": competition_id}, headers=headers).json()["id"]
    client.put(
        f"/api/applications/{application_id}",
        json={"project_title": "P", "problem_description": "X", "solution_description": "Y"},
        headers=headers,
    )

    from app.models.resource import Resource
    from app.models.enums import ResourceType

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
    client.post(f"/api/admin/applications/{application_id}/approve", json={"notes": ""}, headers=auth_headers(admin))

    rubric = client.post(
        f"/api/admin/competitions/{competition_id}/rubric",
        json={"name": "R", "criteria": [{"name": "Innovation", "weight": 1.0}]},
        headers=auth_headers(admin),
    ).json()
    criterion_id = rubric["criteria"][0]["id"]

    judge = make_user(db_session, UserRole.JUDGE, "judge@example.com")
    client.post(f"/api/admin/competitions/{competition_id}/judges", json={"judge_id": judge.id}, headers=auth_headers(admin))
    client.put(f"/api/competitions/{competition_id}", json={"status": "JUDGING_OPEN"}, headers=auth_headers(admin))

    return admin, judge, competition_id, application_id, criterion_id


def test_draft_evaluation_excluded_from_results(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)

    # Save a draft but never submit it.
    client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": 9}]},
        headers=auth_headers(judge),
    )

    results = client.get(f"/api/admin/results?competition_id={competition_id}", headers=auth_headers(admin)).json()
    row = next(r for r in results if r["application_id"] == application_id)
    assert row["judges_completed"] == 0
    assert row["average_score"] is None


def test_submitted_evaluation_included_in_results(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)

    save = client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": 10}]},
        headers=auth_headers(judge),
    ).json()
    submit = client.post(f"/api/evaluations/{save['id']}/submit", headers=auth_headers(judge))
    assert submit.status_code == 200

    results = client.get(f"/api/admin/results?competition_id={competition_id}", headers=auth_headers(admin)).json()
    row = next(r for r in results if r["application_id"] == application_id)
    assert row["judges_completed"] == 1
    assert row["average_score"] == 100.0


def test_locked_evaluation_cannot_be_edited(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)

    save = client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": 10}]},
        headers=auth_headers(judge),
    ).json()
    client.post(f"/api/evaluations/{save['id']}/submit", headers=auth_headers(judge))

    second_submit = client.post(f"/api/evaluations/{save['id']}/submit", headers=auth_headers(judge))
    assert second_submit.status_code == 400

    edit_attempt = client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": 1}]},
        headers=auth_headers(judge),
    )
    assert edit_attempt.status_code == 400


def test_admin_can_reopen_locked_evaluation(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)

    save = client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": 10}]},
        headers=auth_headers(judge),
    ).json()
    client.post(f"/api/evaluations/{save['id']}/submit", headers=auth_headers(judge))

    reopen = client.post(
        f"/api/admin/evaluations/{save['id']}/reopen", json={"reason": "Judge reported a mistake"}, headers=auth_headers(admin)
    )
    assert reopen.status_code == 200

    edit_attempt = client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": 5}]},
        headers=auth_headers(judge),
    )
    assert edit_attempt.status_code == 200
