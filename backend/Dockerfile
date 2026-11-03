FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser
ENV HOME=/home/appuser \
    HF_HOME=/home/appuser/.cache/huggingface
COPY pyproject.toml ./
RUN pip install --no-cache-dir ".[processing,indexing,rag]"
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
