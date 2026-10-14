from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.features.permissions.entity import Permission
from app.features.permissions.schemas import PermissionCreate

class PermissionService:
    @staticmethod
    def list_all(db: Session):
        return db.query(Permission).order_by(Permission.code).all()
    @staticmethod
    def create(db: Session, data: PermissionCreate):
        if db.query(Permission).filter_by(code=data.code).first():
            raise HTTPException(409, "Cette permission existe déjà.")
        item = Permission(code=data.code, name=data.name.strip(), description=data.description)
        db.add(item)
        try:
            db.commit()
            db.refresh(item)
        except Exception:
            db.rollback()
            raise
        return item
