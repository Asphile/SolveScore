from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole


class SchoolRegisterRequest(BaseModel):
    school_name: str = Field(min_length=2, max_length=255)
    registration_number: str = Field(min_length=1, max_length=100)
    province: str = Field(min_length=1, max_length=120)
    district: str = Field(min_length=1, max_length=120)
    address: str = Field(min_length=1, max_length=500)
    contact_name: str = Field(min_length=1, max_length=255)
    contact_email: EmailStr
    contact_phone: str = Field(min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one uppercase letter and one digit")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    first_name: str
    last_name: str


class CurrentUserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    role: UserRole
    school_id: str | None = None

    model_config = {"from_attributes": True}
