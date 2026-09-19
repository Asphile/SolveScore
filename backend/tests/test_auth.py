def _register_payload(email="school1@example.com"):
    return {
        "school_name": "Test High School",
        "registration_number": "REG-100",
        "province": "Gauteng",
        "district": "Johannesburg",
        "address": "1 Main Road",
        "contact_name": "Jane Doe",
        "contact_email": email,
        "contact_phone": "0110000000",
        "email": email,
        "password": "StrongPass1",
        "confirm_password": "StrongPass1",
    }


def test_school_can_register(client):
    response = client.post("/api/auth/register", json=_register_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "SCHOOL"
    assert body["access_token"]


def test_duplicate_registration_rejected(client):
    client.post("/api/auth/register", json=_register_payload())
    response = client.post("/api/auth/register", json=_register_payload())
    assert response.status_code == 409


def test_weak_password_rejected(client):
    payload = _register_payload()
    payload["password"] = "weak"
    payload["confirm_password"] = "weak"
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


def test_mismatched_passwords_rejected(client):
    payload = _register_payload()
    payload["confirm_password"] = "SomethingElse1"
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


def test_login_success(client):
    client.post("/api/auth/register", json=_register_payload())
    response = client.post("/api/auth/login", json={"email": "school1@example.com", "password": "StrongPass1"})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_invalid_password_rejected(client):
    client.post("/api/auth/register", json=_register_payload())
    response = client.post("/api/auth/login", json={"email": "school1@example.com", "password": "WrongPass1"})
    assert response.status_code == 401


def test_login_unknown_email_rejected(client):
    response = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "StrongPass1"})
    assert response.status_code == 401


def test_me_requires_authentication(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
