import logging
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

DEMO_USERS = [
    {
        "full_name": "System Administrator",
        "email": "admin@evidence.org",
        "password": "Password123!",
        "role": UserRole.ADMIN,
        "blockchain_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    },
    {
        "full_name": "Officer Sarah (Collector)",
        "email": "collector@evidence.org",
        "password": "Password123!",
        "role": UserRole.EVIDENCE_COLLECTOR,
        "blockchain_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    },
    {
        "full_name": "Detective Miller (Investigator)",
        "email": "investigator@evidence.org",
        "password": "Password123!",
        "role": UserRole.INVESTIGATOR,
        "blockchain_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    },
    {
        "full_name": "Dr. Alex Chen (Forensic Analyst)",
        "email": "analyst@evidence.org",
        "password": "Password123!",
        "role": UserRole.FORENSIC_ANALYST,
        "blockchain_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    },
    {
        "full_name": "Hon. Justice Davis (Court Reviewer)",
        "email": "court@evidence.org",
        "password": "Password123!",
        "role": UserRole.COURT_REVIEWER,
        "blockchain_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    },
]


def seed_demo_users(db: Session) -> None:
    """Seeds the 5 standard development role accounts if they do not already exist."""
    logger.info("Checking and seeding demonstration user accounts...")
    created_count = 0

    for user_info in DEMO_USERS:
        existing = db.query(User).filter(User.email == user_info["email"]).first()
        if not existing:
            new_user = User(
                full_name=user_info["full_name"],
                email=user_info["email"],
                password_hash=get_password_hash(user_info["password"]),
                role=user_info["role"],
                blockchain_address=user_info["blockchain_address"].lower(),
                is_active=True,
            )
            db.add(new_user)
            created_count += 1
            logger.info(f"Seeded demo account: {user_info['email']} ({user_info['role'].value})")

    db.commit()
    logger.info(f"Seeding completed. {created_count} accounts created.")


if __name__ == "__main__":
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        seed_demo_users(db)
    finally:
        db.close()
