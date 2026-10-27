import asyncio
import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import service
from app.db import Base
from app.models import Conversation, Message


class ConversationListQueryTests(unittest.TestCase):
    def test_filters_and_sorts_conversations_and_messages(self) -> None:
        async def exercise() -> None:
            engine = create_async_engine("sqlite+aiosqlite:///:memory:")
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            session_factory = async_sessionmaker(engine, expire_on_commit=False)

            async with session_factory() as session:
                session.add_all(
                    [
                        Conversation(id="c1", user_id="u1", title="Zulu"),
                        Conversation(id="c2", user_id="u1", title="Alpha"),
                        Conversation(id="c3", user_id="u2", title="Alpha other user"),
                    ]
                )
                session.add_all(
                    [
                        Message(
                            id=1,
                            conversation_id="c1",
                            role="user",
                            content="bonjour",
                        ),
                        Message(
                            id=2,
                            conversation_id="c1",
                            role="assistant",
                            content="Bonjour à vous",
                        ),
                    ]
                )
                await session.commit()

                conversations, total = await service.list_conversations_page(
                    session,
                    "u1",
                    0,
                    1,
                    "alpha",
                    "title",
                    "asc",
                )
                self.assertEqual(total, 1)
                self.assertEqual([item.id for item in conversations], ["c2"])

                messages, message_total = await service.list_messages_page(
                    session,
                    "c1",
                    0,
                    1,
                    "bonjour",
                    "created_at",
                    "asc",
                )
                self.assertEqual(message_total, 2)
                self.assertEqual([item.id for item in messages], [1])

            await engine.dispose()

        asyncio.run(exercise())
