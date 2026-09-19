from app.models.enums import UserRole

from tests.conftest import auth_headers, make_school, make_user


def _create_open_competition(client, db_session, max_participants=20):
    admin = make_user(db_session, UserRole.ADMIN, "admin@example.com")
    response = client.post(
        "/api/competitions",
        json={"name": "Solve for Tomorrow", "max_participants": max_participants},
        headers=auth_headers(admin),
    )
    assert response.status_code == 201
    competition_id = response.json()["id"]

    # Publish it so schools can join.
    update = client.put(
        f"/api/competitions/{competition_id}",
        json={"status": "APPLICATIONS_OPEN"},
        headers=auth_headers(admin),
    )
    assert update.status_code == 200
    return competition_id


def test_school_can_join_open_competition(client, db_session):
    competition_id = _create_open_competition(client, db_session)
    school_user, _ = make_school(db_session, "school@example.com")

    response = client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(school_user))
    assert response.status_code == 201


def test_duplicate_join_blocked(client, db_session):
    competition_id = _create_open_competition(client, db_session)
    school_user, _ = make_school(db_session, "school@example.com")

    first = client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(school_user))
    assert first.status_code == 201

    second = client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(school_user))
    assert second.status_code == 409


def test_21st_school_blocked_when_capacity_is_20(client, db_session):
    competition_id = _create_open_competition(client, db_session, max_participants=20)

    for i in range(20):
        school_user, _ = make_school(db_session, f"school{i}@example.com", f"School {i}")
        response = client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(school_user))
        assert response.status_code == 201, f"School {i} should have been able to join"

    overflow_user, _ = make_school(db_session, "school21@example.com", "School 21")
    response = client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(overflow_user))
    assert response.status_code == 409
    assert "full" in response.json()["detail"].lower()


def test_join_blocked_when_competition_not_open(client, db_session):
    admin = make_user(db_session, UserRole.ADMIN, "admin@example.com")
    response = client.post("/api/competitions", json={"name": "Draft Competition"}, headers=auth_headers(admin))
    competition_id = response.json()["id"]  # still in DRAFT status

    school_user, _ = make_school(db_session, "school@example.com")
    join_response = client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(school_user))
    assert join_response.status_code == 400


def test_capacity_display_reflects_registered_count(client, db_session):
    competition_id = _create_open_competition(client, db_session)
    admin = make_user(db_session, UserRole.ADMIN, "admin2@example.com")

    for i in range(3):
        school_user, _ = make_school(db_session, f"capschool{i}@example.com", f"Cap School {i}")
        client.post(f"/api/competitions/{competition_id}/join", headers=auth_headers(school_user))

    response = client.get(f"/api/competitions/{competition_id}", headers=auth_headers(admin))
    body = response.json()
    assert body["registered_count"] == 3
    assert body["spaces_remaining"] == 17
