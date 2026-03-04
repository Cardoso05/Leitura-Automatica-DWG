 FROM python:3.11-slim AS base

 ENV PYTHONDONTWRITEBYTECODE=1 \
     PYTHONUNBUFFERED=1 \
     PIP_NO_CACHE_DIR=off

 RUN apt-get update && \
     apt-get install -y build-essential && \
     rm -rf /var/lib/apt/lists/*

 WORKDIR /app

 COPY pyproject.toml README.md ./
 RUN pip install --upgrade pip && pip install .

 COPY app ./app

 EXPOSE 8000
 CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
