from datetime import timedelta
from fastapi import APIRouter, Depends, Request, status
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
async def login(request: Request, db: Session = Depends(get_db)):
    """Authenticates user with email/username and password via JSON or Form-data."""
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            raise UnauthorizedException("Invalid JSON request body")
    else:
        try:
            form = await request.form()
            email = form.get("email") or form.get("username")
            password = form.get("password")
        except Exception:
            raise UnauthorizedException("Invalid form request")

    if not email or not password:
        raise UnauthorizedException("Email and password are required")

    user = UserService.get_by_email(db, str(email).strip().lower())
    if not user or not verify_password(str(password), user.password_hash):
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

