
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=8

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY observability /srv/observability
COPY identity /srv/identity
WORKDIR /srv/identity
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --uid 10001 --create-home app \
    && chown -R app:app /srv/identity
USER 10001

EXPOSE 8001

CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed_rbac && uvicorn app.main:app --host 0.0.0.0 --port 8001 --no-access-log"]
