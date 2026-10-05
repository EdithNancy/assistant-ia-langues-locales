import unittest
import uuid

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import Base
from app.features.auth.social import FederatedIdentity, SocialAuthNonce
from app.features.data.entity import Language, VocabularyEntry
from app.features.data.schemas import (
    LanguageCreate,
    VocabularyEntryCreate,
    VocabularyEntryUpdate,
)
from app.features.data.service import DataService
from app.features.permissions.entity import Permission
from app.features.roles.entity import Role
from app.features.sessions.entity import UserSession
from app.features.tokens.entity import TokenTransaction, TokenWallet
from app.features.users.entity import User


class LanguageDataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.user = User(
            full_name="Linguiste",
            email=f"{uuid.uuid4()}@example.com",
            phone_number="+2250102030405",
            password_hash=None,
        )
        self.source = Language(code="dyu", name="Dioula", native_name="Julakan")
        self.target = Language(code="fr", name="Français")
        self.db.add_all([self.user, self.source, self.target])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_create_and_search_translation(self) -> None:
        entry = DataService.create_entry(
            self.db,
            VocabularyEntryCreate(
                source_language_id=self.source.id,
                target_language_id=self.target.id,
                source_text="  i ni ce  ",
                target_text="Bonjour",
                kind="expression",
                pronunciation=" i ni tchê ",
                example_source="I ni ce wa?",
                example_target="Comment vas-tu ?",
            ),
            self.user,
        )

        result = DataService.list_entries(
            self.db, "dyu", "fr", "Bonjour", "expression", 0, 20
        )
        self.assertEqual(entry.source_text, "i ni ce")
        self.assertEqual(entry.source_language.code, "dyu")
        self.assertEqual([row.id for row in result], [entry.id])

    def test_create_language_normalizes_code_and_rejects_duplicate(self) -> None:
        created = DataService.create_language(
            self.db, LanguageCreate(code="  NKO  ", name="N'Ko")
        )

        self.assertEqual(created.code, "nko")
        with self.assertRaises(HTTPException) as error:
            DataService.create_language(
                self.db, LanguageCreate(code="NKO", name="Autre nom")
            )
        self.assertEqual(error.exception.status_code, 409)

    def test_entry_cannot_use_same_language_twice(self) -> None:
        with self.assertRaises(HTTPException) as error:
            DataService.create_entry(
                self.db,
                VocabularyEntryCreate(
                    source_language_id=self.source.id,
                    target_language_id=self.source.id,
                    source_text="terme",
                    target_text="traduction",
                ),
                self.user,
            )
        self.assertEqual(error.exception.status_code, 422)

    def test_update_keeps_examples_in_pairs(self) -> None:
        entry = VocabularyEntry(
            source_language_id=self.source.id,
            target_language_id=self.target.id,
            source_text="terme",
            target_text="traduction",
            example_source="exemple",
            example_target="example",
        )
        self.db.add(entry)
        self.db.commit()

        updated = DataService.update_entry(
            self.db, entry.id, VocabularyEntryUpdate(example_source="nouvel exemple")
        )
        self.assertEqual(updated.example_source, "nouvel exemple")

        with self.assertRaises(HTTPException) as error:
            DataService.update_entry(
                self.db, entry.id, VocabularyEntryUpdate(example_source=None)
            )
        self.assertEqual(error.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
