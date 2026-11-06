from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
def list_users(
    role: Optional[UserRole] = Query(None, description="Filter users by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List application users.
    Admins can view all users. Other authenticated roles can view active users to select custody recipients.
    """
    if current_user.role != UserRole.ADMIN:
        # Non-admins can only see active users for custody transfers
        is_active = True

    users = UserService.list_users(
        db=db, role=role, is_active=is_active, skip=skip, limit=limit
    )
    return [UserResponse.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific user. Non-admins may only view themselves or active users."""
    user = UserService.get_by_id(db, user_id)
    return UserResponse.model_validate(user)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to register a new user with an assigned role and blockchain address."""
    user = UserService.create(db, user_in)
    return UserResponse.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to update user details, role, or credentials."""
    updated = UserService.update(db, user_id, user_in)
    return UserResponse.model_validate(updated)


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def set_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to activate or deactivate a user account."""
    updated = UserService.update_status(db, user_id, status_in.is_active)
    return UserResponse.model_validate(updated)

