from tests.conftest import auth_headers, make_school
from tests.test_results import _setup_approved_application


def _submit_evaluation(client, judge, application_id, criterion_id, score, strengths="Great work overall."):
    save = client.post(
        "/api/evaluations",
        json={"application_id": application_id, "scores": [{"criterion_id": criterion_id, "score": score}], "strengths": strengths},
        headers=auth_headers(judge),
    ).json()
    submit = client.post(f"/api/evaluations/{save['id']}/submit", headers=auth_headers(judge))
    assert submit.status_code == 200
    return save


def test_progress_visible_but_score_hidden_before_finalization(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)
    _submit_evaluation(client, judge, application_id, criterion_id, 10)

    # Find the owning school's user to authenticate as them.
    from app.models.application import Application
    from app.models.school import School

    application = db_session.get(Application, application_id)
    school = db_session.get(School, application.school_id)
    from app.models.user import User

    school_user = db_session.get(User, school.user_id)

    response = client.get(f"/api/school/applications/{application_id}/results", headers=auth_headers(school_user))
    assert response.status_code == 200
    body = response.json()
    assert body["judges_completed"] == 1
    assert body["judges_total"] == 1
    assert body["results_visible"] is False
    assert body["average_score"] is None
    assert body["rank"] is None
    assert body["criteria_breakdown"] == []
    assert body["strengths"] == []


def test_score_and_feedback_visible_after_finalization(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)
    _submit_evaluation(client, judge, application_id, criterion_id, 10, strengths="Excellent innovation.")

    client.put(f"/api/competitions/{competition_id}", json={"status": "JUDGING_CLOSED"}, headers=auth_headers(admin))
    finalize = client.post(f"/api/admin/competitions/{competition_id}/finalize", headers=auth_headers(admin))
    assert finalize.status_code == 200

    from app.models.application import Application
    from app.models.school import School
    from app.models.user import User

    application = db_session.get(Application, application_id)
    school = db_session.get(School, application.school_id)
    school_user = db_session.get(User, school.user_id)

    response = client.get(f"/api/school/applications/{application_id}/results", headers=auth_headers(school_user))
    assert response.status_code == 200
    body = response.json()
    assert body["results_visible"] is True
    assert body["average_score"] == 100.0
    assert body["rank"] == 1
    assert body["strengths"] == ["Excellent innovation."]
    assert len(body["criteria_breakdown"]) == 1
    assert body["criteria_breakdown"][0]["average_score"] == 10.0


def test_school_cannot_view_another_schools_results(client, db_session):
    admin, judge, competition_id, application_id, criterion_id = _setup_approved_application(client, db_session)
    _submit_evaluation(client, judge, application_id, criterion_id, 10)

    other_school_user, _ = make_school(db_session, "otherschool@example.com", "Other School")

    response = client.get(f"/api/school/applications/{application_id}/results", headers=auth_headers(other_school_user))
    assert response.status_code == 403
