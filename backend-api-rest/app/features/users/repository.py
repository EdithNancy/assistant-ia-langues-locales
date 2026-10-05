from sqlalchemy import select
from sqlalchemy.orm import Session
from app.features.users.entity import User

class UserRepository:
    @staticmethod
    def get_by_id(db: Session, user_id):
        return db.get(User, user_id)
    @staticmethod
    def get_by_email(db: Session, email: str):
        return db.scalar(select(User).where(User.email == email.lower().strip()))
    @staticmethod
    def list_users(db: Session, offset=0, limit=50):
        return list(db.scalars(select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)).all())
