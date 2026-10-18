import base64
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.database import Base
from app.features.auth.schemas import SocialLoginRequest
from app.features.auth.social import (
    FederatedIdentity,
    SocialAuthNonce,
    SocialAuthService,
    _verified_claims,
)
from app.features.permissions.entity import Permission
from app.features.roles.entity import Role
from app.features.sessions.entity import UserSession
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.tokens.service import TokenService
from app.features.usage.entity import UsageEvent
from app.features.users.entity import User
from app.features.users.schemas import UserRegister
from app.features.users.service import UserService
from scripts import create_super_admin


class TokenWalletTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_grant = settings.FREE_TOKEN_GRANT
        self.original_google_client_ids = settings.GOOGLE_CLIENT_IDS
        settings.FREE_TOKEN_GRANT = 1000
        settings.GOOGLE_CLIENT_IDS = "test-google-client"
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.db.add_all([
            Role(code="USER", name="Utilisateur"),
            Role(code="SUPER_ADMIN", name="Super administrateur"),
            Permission(code="test", name="Test"),
        ])
        self.user = User(
            full_name="Test User",
            email=f"{uuid.uuid4()}@example.com",
            phone_number="+2250102030405",
            password_hash=None,
        )
        self.db.add(self.user)
        self.db.flush()
        self.db.add(TokenWallet(
            user_id=self.user.id,
            free_tokens_remaining=1000,
            purchased_tokens_remaining=0,
            next_free_refill_at=datetime.now(timezone.utc) + timedelta(days=30),
        ))
        self.db.add(TokenTransaction(
            user_id=self.user.id,
            bucket="free",
            amount=1000,
            reason="signup_grant",
        ))
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        settings.FREE_TOKEN_GRANT = self.original_grant
        settings.GOOGLE_CLIENT_IDS = self.original_google_client_ids

    def test_balance_and_atomic_consumption(self) -> None:
        TokenService.consume_credit_tokens(self.db, self.user.id, 250)
        balance = TokenService.get_balance(self.db, self.user.id)

        self.assertEqual(balance["free_tokens_remaining"], 750)
        self.assertEqual(balance["total_tokens"], 750)
        self.assertTrue(TokenService.has_tokens(self.db, self.user.id))
        usage_event = self.db.scalar(select(UsageEvent).where(
            UsageEvent.event_type == "tokens.consumed"
        ))
        self.assertEqual(usage_event.details["credit_tokens"], 250)

    def test_bootstrap_super_admin_receives_token_wallet(self) -> None:
        email = f"{uuid.uuid4()}@example.com"
        with (
            patch.dict(os.environ, {
                "BOOTSTRAP_ADMIN_NAME": "Bootstrap Admin",
                "BOOTSTRAP_ADMIN_EMAIL": email,
                "BOOTSTRAP_ADMIN_PASSWORD": "secure-test-password",
            }),
            patch.object(create_super_admin, "SessionLocal", return_value=self.db),
        ):
            create_super_admin.main()

        user = self.db.scalar(select(User).where(User.email == email))
        self.assertIsNotNone(user)
        assert user is not None
        wallet = self.db.get(TokenWallet, user.id)
        self.assertIsNotNone(wallet)
        assert wallet is not None
        self.assertEqual(wallet.free_tokens_remaining, settings.FREE_TOKEN_GRANT)
        grant = self.db.scalar(select(TokenTransaction).where(
            TokenTransaction.user_id == user.id,
            TokenTransaction.reason == "signup_grant",
        ))
        self.assertIsNotNone(grant)

    def test_refill_resets_free_allowance_at_utc_midnight_without_carryover(self) -> None:
        wallet = self.db.get(TokenWallet, self.user.id)
        wallet.free_tokens_remaining = 12
        now = datetime(2026, 10, 15, 0, 0, tzinfo=timezone.utc)
        wallet.next_free_refill_at = now
        self.db.commit()

        TokenService._refresh_free_tokens(self.db, wallet, now)
        self.db.commit()

        self.assertEqual(wallet.free_tokens_remaining, settings.FREE_TOKEN_GRANT)
        self.assertEqual(wallet.purchased_tokens_remaining, 0)
        self.assertEqual(
            wallet.next_free_refill_at,
            datetime(2026, 10, 16, 0, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(
            self.db.scalar(select(TokenTransaction).where(
                TokenTransaction.reason == "daily_refill"
            )).amount,
            settings.FREE_TOKEN_GRANT - 12,
        )

    def test_free_tokens_do_not_refill_before_utc_midnight(self) -> None:
        wallet = self.db.get(TokenWallet, self.user.id)
        wallet.free_tokens_remaining = 12
        wallet.next_free_refill_at = datetime(2026, 10, 16, 0, 0, tzinfo=timezone.utc)
        now = datetime(2026, 10, 15, 23, 59, tzinfo=timezone.utc)

        TokenService._refresh_free_tokens(self.db, wallet, now)

        self.assertEqual(wallet.free_tokens_remaining, 12)

    def test_purchased_tokens_are_spent_after_free_tokens(self) -> None:
        reference = f"payment-{uuid.uuid4()}"
        TokenService.grant_purchased_tokens(
            self.db, self.user.id, 50, reference
        )
        TokenService.grant_purchased_tokens(self.db, self.user.id, 50, reference)
        TokenService.consume_credit_tokens(
            self.db, self.user.id, settings.FREE_TOKEN_GRANT + 20
        )
        balance = TokenService.get_balance(self.db, self.user.id)

        self.assertEqual(balance["free_tokens_remaining"], 0)
        self.assertEqual(balance["purchased_tokens_remaining"], 30)
        self.assertEqual(balance["total_tokens"], 30)

    def test_registration_normalizes_phone_and_creates_wallet(self) -> None:
        data = UserRegister(
            full_name="Nouvel utilisateur",
            email=f"{uuid.uuid4()}@example.com",
            phone_number=" +225 (01) 02-03-04-05 ",
            password="mot-de-passe-long",
        )

        user = UserService.register(self.db, data)
        balance = TokenService.get_balance(self.db, user.id)

        self.assertEqual(user.phone_number, "+2250102030405")
        self.assertEqual(balance["free_tokens_remaining"], settings.FREE_TOKEN_GRANT)

    def test_insufficient_balance_does_not_debit_tokens(self) -> None:
        with self.assertRaises(HTTPException) as error:
            TokenService.consume_credit_tokens(
                self.db, self.user.id, settings.FREE_TOKEN_GRANT + 1
            )

        self.assertEqual(error.exception.status_code, 402)
        self.assertEqual(
            TokenService.get_balance(self.db, self.user.id)["total_tokens"],
            settings.FREE_TOKEN_GRANT,
        )

    def test_linked_social_identity_can_login_without_email_claim(self) -> None:
        nonce = SocialAuthService.create_nonce(self.db, "google")
        identity = FederatedIdentity(
            user_id=self.user.id,
            provider="google",
            provider_subject="google-subject",
        )
        self.db.add(identity)
        self.db.commit()
        request = SocialLoginRequest(
            provider="google",
            id_token="verified-by-mock",
            nonce=nonce,
        )

        with patch(
            "app.features.auth.social._verified_claims",
            return_value={"sub": "google-subject", "nonce": nonce},
        ):
            user = SocialAuthService.login(self.db, request)

        self.assertEqual(user.id, self.user.id)
        self.assertIsNotNone(self.db.scalar(select(SocialAuthNonce)).used_at)

    def test_new_social_account_gets_wallet_and_identity(self) -> None:
        nonce = SocialAuthService.create_nonce(self.db, "google")
        request = SocialLoginRequest(
            provider="google",
            id_token="verified-by-mock",
            nonce=nonce,
            full_name="Social User",
            phone_number="+225 01 02 03 04 05",
        )

        with patch(
            "app.features.auth.social._verified_claims",
            return_value={
                "sub": "new-google-subject",
                "nonce": nonce,
                "email": "social@example.com",
                "email_verified": True,
            },
        ):
            user = SocialAuthService.login(self.db, request)

        balance = TokenService.get_balance(self.db, user.id)
        identity = self.db.scalar(select(FederatedIdentity).where(
            FederatedIdentity.user_id == user.id
        ))
        self.assertEqual(user.phone_number, "+2250102030405")
        self.assertEqual(balance["free_tokens_remaining"], settings.FREE_TOKEN_GRANT)
        self.assertEqual(identity.provider_subject, "new-google-subject")

    def test_google_identity_token_signature_audience_and_issuer_are_checked(self) -> None:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_numbers = private_key.public_key().public_numbers()

        def encode_integer(value: int) -> str:
            raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
            return base64.urlsafe_b64encode(raw).decode().rstrip("=")

        jwk = {
            "kid": "test-key",
            "kty": "RSA",
            "alg": "RS256",
            "use": "sig",
            "n": encode_integer(public_numbers.n),
            "e": encode_integer(public_numbers.e),
        }
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        claims = {
            "iss": "https://accounts.google.com",
            "aud": "test-google-client",
            "sub": "google-subject",
            "exp": int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()),
            "nonce": "test-nonce",
        }
        identity_token = jwt.encode(
            claims, pem, algorithm="RS256", headers={"kid": "test-key"}
        )

        with patch("app.features.auth.social._provider_keys", return_value=[jwk]):
            self.assertEqual(
                _verified_claims("google", identity_token)["sub"],
                "google-subject",
            )
            invalid_audience = jwt.encode(
                {**claims, "aud": "unexpected-client"},
                pem,
                algorithm="RS256",
                headers={"kid": "test-key"},
            )
            with self.assertRaises(HTTPException):
                _verified_claims("google", invalid_audience)
            invalid_issuer = jwt.encode(
                {**claims, "iss": "https://attacker.example"},
                pem,
                algorithm="RS256",
                headers={"kid": "test-key"},
            )
            with self.assertRaises(HTTPException):
                _verified_claims("google", invalid_issuer)


if __name__ == "__main__":
    unittest.main()
