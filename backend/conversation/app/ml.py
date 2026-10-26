"""Interfaces des services ML (STT / Dialogue / TTS).

Étape 2 : implémentations *mock* pour développer l'orchestration sans GPU.
Étape 3 : remplacer par des clients HTTP/gRPC vers les vrais services,
sans toucher au reste du code (même interface).
"""
import re
from dataclasses import dataclass
from typing import AsyncIterator, Protocol


@dataclass(frozen=True)
class DialogueReply:
    content: str
    input_tokens: int
    output_tokens: int
    estimated_usage: bool = False
    reformulated_content: str | None = None
    understood_as: str | None = None

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


class STT(Protocol):
    async def transcribe(
        self, audio: bytes, language: str | None = None
    ) -> str: ...


class OrthographyNormalizer(Protocol):
    async def normalize(self, text: str, language: str) -> str: ...


class Dialogue(Protocol):
    async def reply(self, history: list[dict]) -> DialogueReply: ...


class TTS(Protocol):
    def synthesize(
        self, text: str, language: str | None = None
    ) -> AsyncIterator[bytes]: ...


class MockSTT:
    async def transcribe(
        self, audio: bytes, language: str | None = None
    ) -> str:
        return f"[audio de {len(audio)} octets]"


class PassThroughNormalizer:
    """Pluggable seam for language-specific orthography normalization.

    Keep the transcript unchanged until a language's spelling conventions and
    validated correction data are available; guessing corrections is unsafe.
    """

    async def normalize(self, text: str, language: str) -> str:
        return text


class MockDialogue:
    async def reply(self, history: list[dict]) -> DialogueReply:
        last = history[-1]["content"] if history else ""
        answer = f"Je t'ai entendu : {last}"
        prompt = "\n".join(
            f"{item['role']}: {item['content']}" for item in history
        )
        return DialogueReply(
            content=answer,
            input_tokens=_estimate_tokens(prompt),
            output_tokens=_estimate_tokens(answer),
            estimated_usage=True,
        )


def _estimate_tokens(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


class MockTTS:
    async def synthesize(
        self, text: str, language: str | None = None
    ) -> AsyncIterator[bytes]:
        data = text.encode()
        for i in range(0, len(data), 16):     # simule un flux audio par morceaux
            yield data[i:i + 16]


stt: STT = MockSTT()
orthography: OrthographyNormalizer = PassThroughNormalizer()
dialogue: Dialogue = MockDialogue()
tts: TTS = MockTTS()
