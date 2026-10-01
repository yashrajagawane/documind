from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)


class PublicUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr


class AuthResponse(BaseModel):
    user: PublicUser
    access_token: str
    token_type: str = "bearer"
