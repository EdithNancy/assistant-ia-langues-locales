from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .request_model import RequestModel

Level = Literal["debutant", "intermediaire", "avance"]


class ScenarioCreate(RequestModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    level: Level
    objectives: list[str] = Field(default_factory=list)
    published: bool = True


class ScenarioOut(ScenarioCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str


class AttemptStart(RequestModel):
    scenario_id: str


class AttemptComplete(RequestModel):
    score: int = Field(ge=0, le=100)


class AttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    scenario_id: str
    status: str
    score: int | None
    conversation_id: str | None
    started_at: datetime
    completed_at: datetime | None


class LevelProgress(BaseModel):
    completed: int
    average_score: float | None


class Progress(BaseModel):
    attempts: int
    completed: int
    average_score: float | None
    by_level: dict[str, LevelProgress]
