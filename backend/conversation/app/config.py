import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./conversation.db")
IDENTITY_URL = os.environ.get("IDENTITY_URL", "http://127.0.0.1:8001").rstrip("/")
IDENTITY_TIMEOUT = float(os.environ.get("IDENTITY_TIMEOUT", "10"))
