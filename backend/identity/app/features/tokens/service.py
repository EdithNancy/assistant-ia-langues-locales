import uuid
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.usage.entity import UsageEvent


class TokenService:
    @staticmethod
    def _get_wallet(db: Session, user_id: uuid.UUID) -> TokenWallet:
        wallet = db.scalar(
            select(TokenWallet).where(TokenWallet.user_id == user_id).with_for_update()
        )
        if wallet is None:
            raise HTTPException(500, "Le portefeuille de tokens du compte est introuvable.")
        return wallet

    @staticmethod
    def _refresh_free_tokens(db: Session, wallet: TokenWallet, now: datetime) -> None:
        refill_at = wallet.next_free_refill_at
        if refill_at.tzinfo is None:
            refill_at = refill_at.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        now = now.astimezone(timezone.utc)
        refill_at = refill_at.astimezone(timezone.utc)
        if now < refill_at:
            return

        delta = settings.FREE_TOKEN_GRANT - wallet.free_tokens_remaining
        wallet.free_tokens_remaining = settings.FREE_TOKEN_GRANT
        tomorrow = now.date() + timedelta(days=1)
        wallet.next_free_refill_at = datetime.combine(
            tomorrow, time.min, tzinfo=timezone.utc
        )
        if delta:
            db.add(TokenTransaction(
                user_id=wallet.user_id,
                bucket="free",
                amount=delta,
                reason="daily_refill",
            ))
            db.add(UsageEvent(
                id=uuid.uuid4(),
                event_type="tokens.daily_refill",
                user_id=wallet.user_id,
                method="INTERNAL",
                route="token_wallet",
                status_code=200,
                duration_ms=0,
                details={"amount": delta},
            ))

    @staticmethod
    def get_balance(db: Session, user_id: uuid.UUID) -> dict[str, object]:
        wallet = TokenService._get_wallet(db, user_id)
        TokenService._refresh_free_tokens(db, wallet, datetime.now(timezone.utc))
        db.commit()
        return TokenService._as_balance(wallet)

    @staticmethod
    def has_tokens(db: Session, user_id: uuid.UUID, amount: int = 1) -> bool:
        if amount < 1:
            raise ValueError("amount must be a positive integer")
        balance = TokenService.get_balance(db, user_id)
        return int(balance["total_tokens"]) >= amount

    @staticmethod
    def consume_credit_tokens(
        db: Session, user_id: uuid.UUID, credit_tokens: int
    ) -> dict[str, object]:
        """Debit conversational credits; authentication credentials are never wallet units."""
        if credit_tokens < 1:
            raise ValueError("credit_tokens must be a positive integer")
        wallet = TokenService._get_wallet(db, user_id)
        TokenService._refresh_free_tokens(db, wallet, datetime.now(timezone.utc))
        available_credit_tokens = (
            wallet.free_tokens_remaining + wallet.purchased_tokens_remaining
        )
        if available_credit_tokens < credit_tokens:
            db.add(UsageEvent(
                id=uuid.uuid4(),
                event_type="tokens.consume_denied",
                user_id=user_id,
                method="INTERNAL",
                route="token_wallet",
                status_code=402,
                duration_ms=0,
                details={
                    "requested_credit_tokens": credit_tokens,
                    "available_credit_tokens": available_credit_tokens,
                },
            ))
            db.commit()
            raise HTTPException(402, "Tokens insuffisants. Attendez le prochain renouvellement.")

        free_used = min(wallet.free_tokens_remaining, credit_tokens)
        paid_used = credit_tokens - free_used
        wallet.free_tokens_remaining -= free_used
        wallet.purchased_tokens_remaining -= paid_used
        if free_used:
            db.add(TokenTransaction(
                user_id=user_id, bucket="free", amount=-free_used, reason="usage"
            ))
        if paid_used:
            db.add(TokenTransaction(
                user_id=user_id, bucket="purchased", amount=-paid_used, reason="usage"
            ))
        db.add(UsageEvent(
            id=uuid.uuid4(),
            event_type="tokens.consumed",
            user_id=user_id,
            method="INTERNAL",
            route="token_wallet",
            status_code=200,
            duration_ms=0,
            details={
                "credit_tokens": credit_tokens,
                "free_credit_tokens": free_used,
                "purchased_credit_tokens": paid_used,
            },
        ))
        db.commit()
        return TokenService._as_balance(wallet)

    @staticmethod
    def grant_purchased_tokens(
        db: Session, user_id: uuid.UUID, amount: int, payment_reference: str
    ) -> dict[str, object]:
        payment_reference = payment_reference.strip()
        if amount < 1 or not payment_reference:
            raise ValueError("A positive amount and payment reference are required")
        prior = db.scalar(
            select(TokenTransaction).where(
                TokenTransaction.external_reference == payment_reference
            )
        )
        if prior is not None:
            if (prior.user_id != user_id or prior.amount != amount
                    or prior.reason != "purchase_grant"):
                raise HTTPException(409, "Cette référence de paiement a déjà été utilisée.")
            return TokenService.get_balance(db, user_id)

        wallet = TokenService._get_wallet(db, user_id)
        TokenService._refresh_free_tokens(db, wallet, datetime.now(timezone.utc))
        prior = db.scalar(
            select(TokenTransaction).where(
                TokenTransaction.external_reference == payment_reference
            )
        )
        if prior is not None:
            if (prior.user_id != user_id or prior.amount != amount
                    or prior.reason != "purchase_grant"):
                raise HTTPException(409, "Cette référence de paiement a déjà été utilisée.")
            db.commit()
            return TokenService._as_balance(wallet)

        wallet.purchased_tokens_remaining += amount
        db.add(TokenTransaction(
            user_id=user_id,
            bucket="purchased",
            amount=amount,
            reason="purchase_grant",
            external_reference=payment_reference,
        ))
        db.add(UsageEvent(
            id=uuid.uuid4(),
            event_type="tokens.purchase_credit",
            user_id=user_id,
            method="INTERNAL",
            route="token_wallet",
            status_code=200,
            duration_ms=0,
            details={"amount": amount},
        ))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            prior = db.scalar(
                select(TokenTransaction).where(
                    TokenTransaction.external_reference == payment_reference
                )
            )
            if prior is None:
                raise
            if (prior.user_id != user_id or prior.amount != amount
                    or prior.reason != "purchase_grant"):
                raise HTTPException(409, "Cette référence de paiement a déjà été utilisée.")
            return TokenService.get_balance(db, user_id)
        return TokenService._as_balance(wallet)

    @staticmethod
    def _as_balance(wallet: TokenWallet) -> dict[str, object]:
        return {
            "user_id": wallet.user_id,
            "free_tokens_remaining": wallet.free_tokens_remaining,
            "purchased_tokens_remaining": wallet.purchased_tokens_remaining,
            "total_tokens": wallet.free_tokens_remaining + wallet.purchased_tokens_remaining,
            "has_tokens": wallet.free_tokens_remaining + wallet.purchased_tokens_remaining > 0,
            "next_free_refill_at": wallet.next_free_refill_at,
        }
