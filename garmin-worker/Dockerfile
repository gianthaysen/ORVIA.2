FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY orvia_worker ./orvia_worker

# Non-root-Betrieb
RUN useradd --create-home --uid 10001 orvia && chown -R orvia:orvia /app
USER orvia

EXPOSE 8000

# PORT wird von Railway gesetzt; Fallback 8000
CMD ["sh", "-c", "uvicorn orvia_worker.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
