import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import httpx
from fastapi import HTTPException
from jose import JWTError, jwt
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func

from app.config import settings
from app.core.database import Base
from app.features.auth.schemas import SocialLoginRequest
from app.features.roles.entity import Role
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.users.entity import User
from app.features.users.repository import UserRepository


_PROVIDERS = {
    "google": ("https://www.googleapis.com/oauth2/v3/certs", "https://accounts.google.com"),
    "apple": ("https://appleid.apple.com/auth/keys", "https://appleid.apple.com"),
}
_EMAIL_ADAPTER = TypeAdapter(EmailStr)


class FederatedIdentity(Base):
    __tablename__ = "federated_identities"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    user = relationship("User", back_populates="federated_identities")
    __table_args__ = (UniqueConstraint("provider", "provider_subject"),)


class SocialAuthNonce(Base):
    __tablename__ = "social_auth_nonces"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    nonce_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


@lru_cache(maxsize=2)
def _provider_keys(provider: str) -> list[dict[str, object]]:
    keys_url, _ = _PROVIDERS[provider]
    try:
        response = httpx.get(keys_url, timeout=5.0)
        response.raise_for_status()
        keys = response.json()["keys"]
        if not isinstance(keys, list) or not all(isinstance(item, dict) for item in keys):
            raise ValueError("Invalid provider key set")
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(503, f"Impossible de vérifier l'identité auprès de {provider}.") from exc
    return keys


def _verified_claims(provider: str, identity_token: str) -> dict[str, object]:
    client_ids = settings.client_ids_for(provider)
    if not client_ids:
        raise HTTPException(503, f"La connexion {provider} n'est pas configurée.")
    try:
        header = jwt.get_unverified_header(identity_token)
        kid = header.get("kid")
        key = next((item for item in _provider_keys(provider)
                    if item.get("kid") == kid and item.get("kty") == "RSA"), None)
        if key is None:
            _provider_keys.cache_clear()
            key = next((item for item in _provider_keys(provider)
                        if item.get("kid") == kid and item.get("kty") == "RSA"), None)
        if key is None:
            raise HTTPException(401, "Jeton de connexion invalide.")
        unverified_claims = jwt.get_unverified_claims(identity_token)
        audience = unverified_claims.get("aud")
        if not isinstance(audience, str) or audience not in client_ids:
            raise HTTPException(401, "Jeton de connexion invalide.")
        claims = jwt.decode(
            identity_token,
            key,
            algorithms=["RS256"],
            audience=audience,
            options={"verify_iss": False},
        )
    except JWTError as exc:
        raise HTTPException(401, "Jeton de connexion invalide ou expiré.") from exc
    _, expected_issuer = _PROVIDERS[provider]
    valid_issuers = {"https://accounts.google.com", "accounts.google.com"} if provider == "google" else {
        expected_issuer
    }
    if claims.get("iss") not in valid_issuers:
        raise HTTPException(401, "Émetteur du jeton de connexion invalide.")
    return claims


class SocialAuthService:
    NONCE_TTL_SECONDS = 300

    @staticmethod
    def create_nonce(db: Session, provider: str) -> str:
        if not settings.client_ids_for(provider):
            raise HTTPException(503, f"La connexion {provider} n'est pas configurée.")
        nonce = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        db.execute(delete(SocialAuthNonce).where(
            (SocialAuthNonce.expires_at <= now)
            | (SocialAuthNonce.used_at.is_not(None))
        ))
        db.add(SocialAuthNonce(
            provider=provider,
            nonce_hash=hashlib.sha256(nonce.encode()).hexdigest(),
            expires_at=datetime.now(timezone.utc) + timedelta(
                seconds=SocialAuthService.NONCE_TTL_SECONDS
            ),
        ))
        db.commit()
        return nonce

    @staticmethod
    def login(db: Session, data: SocialLoginRequest) -> User:
        claims = _verified_claims(data.provider, data.id_token)
        subject = claims.get("sub")
        if not isinstance(subject, str):
            raise HTTPException(401, "Identifiant de compte du fournisseur invalide.")

        expected_nonce = (
            hashlib.sha256(data.nonce.encode()).hexdigest()
            if data.provider == "apple" else data.nonce
        )
        if claims.get("nonce") != expected_nonce:
            raise HTTPException(401, "La vérification de sécurité de la connexion a échoué.")

        now = datetime.now(timezone.utc)
        nonce_hash = hashlib.sha256(data.nonce.encode()).hexdigest()
        nonce = db.scalar(
            select(SocialAuthNonce)
            .where(
                SocialAuthNonce.provider == data.provider,
                SocialAuthNonce.nonce_hash == nonce_hash,
                SocialAuthNonce.used_at.is_(None),
                SocialAuthNonce.expires_at > now,
            )
            .with_for_update()
        )
        if nonce is None:
            raise HTTPException(401, "Code de connexion expiré ou déjà utilisé.")

        identity = db.scalar(
            select(FederatedIdentity).where(
                FederatedIdentity.provider == data.provider,
                FederatedIdentity.provider_subject == subject,
            )
        )
        try:
            if identity is not None:
                user = db.get(User, identity.user_id)
                if user is None:
                    raise HTTPException(401, "Compte de connexion indisponible.")
            else:
                email = claims.get("email")
                email_verified = claims.get("email_verified")
                if isinstance(email_verified, str):
                    email_verified = email_verified.lower() == "true"
                if not isinstance(email, str) or email_verified is not True:
                    raise HTTPException(
                        401, "Le fournisseur doit confirmer l'adresse e-mail pour créer ou lier le compte."
                    )
                try:
                    normalized_email = str(_EMAIL_ADAPTER.validate_python(email)).lower().strip()
                except ValidationError as exc:
                    raise HTTPException(401, "Adresse e-mail fournie par le fournisseur invalide.") from exc
                user = UserRepository.get_by_email(db, normalized_email)
                if user is None:
                    provider_name = claims.get("name")
                    full_name = (
                        data.full_name or (provider_name if isinstance(provider_name, str) else "")
                    ).strip()
                    phone_number = data.phone_number
                    if len(full_name) < 2 or phone_number is None:
                        raise HTTPException(
                            422,
                            "Pour terminer la création du compte, indiquez votre nom et votre numéro de téléphone.",
                        )
                    role = db.scalar(select(Role).where(Role.code == "USER"))
                    if role is None:
                        raise HTTPException(503, "Les rôles initiaux ne sont pas configurés.")
                    user = User(
                        full_name=full_name,
                        email=normalized_email,
                        phone_number=phone_number,
                        password_hash=None,
                        is_verified=True,
                        roles=[role],
                    )
                    db.add(user)
                    db.flush()
                    db.add(TokenWallet(
                        user_id=user.id,
                        free_tokens_remaining=settings.FREE_TOKEN_GRANT,
                        purchased_tokens_remaining=0,
                        next_free_refill_at=TokenWallet.next_refill_time(),
                    ))
                    db.add(TokenTransaction(
                        user_id=user.id,
                        bucket="free",
                        amount=settings.FREE_TOKEN_GRANT,
                        reason="signup_grant",
                    ))
                else:
                    user.is_verified = True
                db.add(FederatedIdentity(
                    user_id=user.id,
                    provider=data.provider,
                    provider_subject=subject,
                ))

            if not user.is_active:
                raise HTTPException(403, "Ce compte est désactivé.")
            nonce.used_at = now
            db.commit()
            return user
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, "Impossible de lier ce compte de connexion.") from exc
