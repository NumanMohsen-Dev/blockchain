from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.errors import ConflictException, EntityNotFoundException
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    @staticmethod
    def get_by_id(db: Session, user_id: int) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise EntityNotFoundException(f"User with ID {user_id} not found")
        return user

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower()).first()

    @staticmethod
    def list_users(
        db: Session,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[User]:
        query = db.query(User)
        if role is not None:
            query = query.filter(User.role == role)
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        return query.order_by(User.id.asc()).offset(skip).limit(limit).all()

    @staticmethod
    def create(db: Session, user_in: UserCreate) -> User:
        existing = UserService.get_by_email(db, user_in.email)
        if existing:
            raise ConflictException(f"User with email '{user_in.email}' already exists")

        # Check for duplicate blockchain address
        existing_addr = (
            db.query(User)
            .filter(User.blockchain_address == user_in.blockchain_address.lower())
            .first()
        )
        if existing_addr:
            raise ConflictException(
                f"User with blockchain address '{user_in.blockchain_address}' already registered"
            )

        db_user = User(
            full_name=user_in.full_name,
            email=user_in.email.lower(),
            password_hash=get_password_hash(user_in.password),
            role=user_in.role,
            blockchain_address=user_in.blockchain_address.lower(),
            is_active=True,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def update(db: Session, user_id: int, user_in: UserUpdate) -> User:
        user = UserService.get_by_id(db, user_id)

        if user_in.email and user_in.email.lower() != user.email:
            existing = UserService.get_by_email(db, user_in.email)
            if existing:
                raise ConflictException(f"Email '{user_in.email}' already taken")
            user.email = user_in.email.lower()

        if user_in.blockchain_address:
            addr = user_in.blockchain_address.lower()
            if addr != user.blockchain_address:
                existing_addr = (
                    db.query(User).filter(User.blockchain_address == addr).first()
                )
                if existing_addr:
                    raise ConflictException(
                        f"Address '{user_in.blockchain_address}' already registered"
                    )
                user.blockchain_address = addr

        if user_in.full_name is not None:
            user.full_name = user_in.full_name

        if user_in.role is not None:
            user.role = user_in.role

        if user_in.password is not None:
            user.password_hash = get_password_hash(user_in.password)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_status(db: Session, user_id: int, is_active: bool) -> User:
        user = UserService.get_by_id(db, user_id)
        user.is_active = is_active
        db.commit()
        db.refresh(user)
        return user

