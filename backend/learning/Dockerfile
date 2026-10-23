FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=8
WORKDIR /srv
COPY observability /srv/observability
COPY learning /srv/learning
WORKDIR /srv/learning
RUN pip install --no-cache-dir /srv/observability
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --uid 10001 --create-home app
USER 10001
EXPOSE 8003
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--no-access-log"]
