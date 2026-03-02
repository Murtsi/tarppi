FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create models directory (Railway Volume will mount here if configured)
RUN mkdir -p /models

# Train the initial model during build — serves as fallback if no volume
RUN python train.py --data data/sample_labelled_events.csv --out /models

# Default env vars (override in Railway)
ENV PORT=8100
ENV MODEL_DIR=/models
EXPOSE 8100

# Railway Volume: mount /models via Railway dashboard (Settings → Volumes)

CMD ["python", "serve.py"]
