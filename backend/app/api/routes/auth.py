from datetime import timedelta
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_token
from app.core.config import settings
from app.core.errors import UnauthorizedException
from app.core.security import create_access_token, revoke_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageResponse, TokenResponse
from app.schemas.user import UserResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates user with email and password, returning JWT access token."""
    user = UserService.get_by_email(db, login_data.email)
    if not user:
        raise UnauthorizedException("Invalid email or password")

    if not verify_password(login_data.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password")

    if not user.is_active:
        raise UnauthorizedException("Account is deactivated. Contact an administrator")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.id,
        role=user.role.value,
        email=user.email,
        expires_delta=access_token_expires,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    token: str = Depends(get_token),
    current_user: User = Depends(get_current_user),
):
    """Logs out the current user by invalidating the bearer token session."""
    revoke_token(token)
    return MessageResponse(
        message="Successfully logged out and session revoked",
        detail=f"Token invalidated for user {current_user.email}",
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile and permissions."""
    return UserResponse.model_validate(current_user)

