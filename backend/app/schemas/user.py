from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = UserRole.INVESTIGATOR
    blockchain_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    blockchain_address: Optional[str] = Field(None, pattern=r"^0x[a-fA-F0-9]{40}$")
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

