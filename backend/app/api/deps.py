from typing import Callable, List
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.errors import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token, is_token_revoked
from app.db.session import get_db
from app.models.user import User, UserRole

security_scheme = HTTPBearer(auto_error=False)


def get_token(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> str:
    if not credentials:
        raise UnauthorizedException("Authentication token missing")
    token = credentials.credentials
    if is_token_revoked(token):
        raise UnauthorizedException("Token has been revoked or expired")
    return token


def get_current_user(
    token: str = Depends(get_token),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedException("Invalid or expired authentication token")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise UnauthorizedException("User associated with this token not found")

    if not user.is_active:
        raise UnauthorizedException("User account is inactive. Please contact administrator")

    return user


def require_role(required_role: UserRole) -> Callable[[User], User]:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role:
            raise ForbiddenException(
                f"Action requires '{required_role.value}' role, user has '{current_user.role.value}'"
            )
        return current_user

    return role_checker


def require_any_role(allowed_roles: List[UserRole]) -> Callable[[User], User]:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            allowed_names = [r.value for r in allowed_roles]
            raise ForbiddenException(
                f"Action requires one of {allowed_names}, user has '{current_user.role.value}'"
            )
        return current_user

    return role_checker

