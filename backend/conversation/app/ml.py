"""Interfaces des services ML (STT / Dialogue / TTS).

Étape 2 : implémentations *mock* pour développer l'orchestration sans GPU.
Étape 3 : remplacer par des clients HTTP/gRPC vers les vrais services,
sans toucher au reste du code (même interface).
"""
from typing import AsyncIterator, Protocol


class STT(Protocol):
    async def transcribe(self, audio: bytes) -> str: ...


class Dialogue(Protocol):
    async def reply(self, history: list[dict]) -> str: ...


class TTS(Protocol):
    def synthesize(self, text: str) -> AsyncIterator[bytes]: ...


class MockSTT:
    async def transcribe(self, audio: bytes) -> str:
        return f"[audio de {len(audio)} octets]"


class MockDialogue:
    async def reply(self, history: list[dict]) -> str:
        last = history[-1]["content"] if history else ""
        return f"Je t'ai entendu : {last}"


class MockTTS:
    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        data = text.encode()
        for i in range(0, len(data), 16):     # simule un flux audio par morceaux
            yield data[i:i + 16]


stt: STT = MockSTT()
dialogue: Dialogue = MockDialogue()
tts: TTS = MockTTS()
