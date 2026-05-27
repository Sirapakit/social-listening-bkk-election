FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer-cached when requirements unchanged)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download PyThaiNLP newmm tokenizer corpus so the container
# works offline at runtime (no internet call on first request)
RUN python -c "from pythainlp.tokenize import word_tokenize; word_tokenize('ทดสอบ')"

# Copy application code
COPY . .

# Ensure the data directory exists for SQLite
RUN mkdir -p data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
