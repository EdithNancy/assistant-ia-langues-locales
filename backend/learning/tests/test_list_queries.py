import asyncio
import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.requests import Request

from app.api import list_scenarios
from app.db import Base
from app.deps import CurrentUser
from app.models import Scenario
from app.pagination import ListRequest


class LearningListQueryTests(unittest.TestCase):
    def test_filters_searches_and_sorts_scenarios(self) -> None:
        async def exercise() -> None:
            engine = create_async_engine("sqlite+aiosqlite:///:memory:")
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            session_factory = async_sessionmaker(engine, expire_on_commit=False)

            async with session_factory() as session:
                session.add_all(
                    [
                        Scenario(
                            id="s1",
                            title="Zulu Dioula",
                            description="Prononciation",
                            level="debutant",
                            published=True,
                        ),
                        Scenario(
                            id="s2",
                            title="Alpha Dioula",
                            description="Vocabulaire",
                            level="debutant",
                            published=True,
                        ),
                        Scenario(
                            id="s3",
                            title="Zulu avancé",
                            description="Prononciation",
                            level="avance",
                            published=True,
                        ),
                    ]
                )
                await session.commit()
                request = Request(
                    {"type": "http", "query_string": b"level=debutant"}
                )

                response = await list_scenarios(
                    http_request=request,
                    level="debutant",
                    list_query=ListRequest(
                        search="dioula",
                        sort_by="title",
                        sort_order="asc",
                    ),
                    _=CurrentUser(id="user-1", roles=frozenset({"pro"})),
                    session=session,
                )

                self.assertEqual(response.pagination.total, 2)
                self.assertEqual(
                    [item.id for item in response.items], ["s2", "s1"]
                )

            await engine.dispose()

        asyncio.run(exercise())
