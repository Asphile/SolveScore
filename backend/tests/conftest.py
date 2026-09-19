import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import create_access_token, hash_password
from app.database import Base
from app.main import app
from app.models.enums import UserRole
from app.models.school import School
from app.models.user import User


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_user(db_session, role: UserRole, email: str) -> User:
    user = User(first_name="Test", last_name=role.value.title(), email=email, password_hash=hash_password("Password1"), role=role)
    db_session.add(user)
    db_session.flush()
    db_session.commit()
    return user


def make_school(db_session, email: str = "school@example.com", name: str = "Test School") -> tuple[User, School]:
    user = make_user(db_session, UserRole.SCHOOL, email)
    school = School(
        user_id=user.id,
        school_name=name,
        registration_number="REG-1",
        province="Gauteng",
        district="Johannesburg",
        address="1 Test Street",
        contact_name="Contact Person",
        contact_email=email,
        contact_phone="0110000000",
    )
    db_session.add(school)
    db_session.flush()
    db_session.commit()
    return user, school


def auth_headers(user: User) -> dict:
    token = create_access_token(subject=user.id, role=user.role)
    return {"Authorization": f"Bearer {token}"}
