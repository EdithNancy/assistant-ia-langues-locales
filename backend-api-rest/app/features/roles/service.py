from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.features.roles.entity import Role
from app.features.roles.schemas import RoleCreate

class RoleService:
    @staticmethod
    def list_all(db: Session):
        return db.query(Role).order_by(Role.code).all()
    @staticmethod
    def create(db: Session, data: RoleCreate):
        if db.query(Role).filter_by(code=data.code).first():
            raise HTTPException(409, "Ce rôle existe déjà.")
        role = Role(code=data.code, name=data.name.strip(), description=data.description)
        db.add(role)
        try:
            db.commit()
            db.refresh(role)
        except Exception:
            db.rollback()
            raise
        return role
