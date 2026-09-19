from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.school import School
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, LoginRequest, SchoolRegisterRequest, TokenResponse
from app.services import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_school(payload: SchoolRegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        first_name=payload.contact_name.split(" ")[0] if payload.contact_name else payload.school_name,
        last_name=" ".join(payload.contact_name.split(" ")[1:]) or "-",
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.SCHOOL,
    )
    db.add(user)
    db.flush()

    school = School(
        user_id=user.id,
        school_name=payload.school_name,
        registration_number=payload.registration_number,
        province=payload.province,
        district=payload.district,
        address=payload.address,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
    )
    db.add(school)

    audit.record(db, action="SCHOOL_REGISTERED", entity_type="School", entity_id=school.id, user=user)
    db.commit()

    token = create_access_token(subject=user.id, role=user.role)
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")

    token = create_access_token(subject=user.id, role=user.role)
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@router.post("/logout")
def logout() -> dict:
    # Stateless JWTs: logout is handled client-side by discarding the token.
    return {"detail": "Logged out"}


@router.get("/me", response_model=CurrentUserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CurrentUserResponse:
    school_id = None
    if current_user.role == UserRole.SCHOOL:
        school = db.query(School).filter(School.user_id == current_user.id).first()
        school_id = school.id if school else None

    return CurrentUserResponse(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        role=current_user.role,
        school_id=school_id,
    )
