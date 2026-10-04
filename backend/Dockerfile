FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

EXPOSE 8000

# Migrate, seed (idempotent: demo zones, households and the first admin), then serve.
# Render sets $PORT.
CMD ["sh", "-c", "python -m alembic upgrade head && python -m app.scripts.seed_reference_data && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
