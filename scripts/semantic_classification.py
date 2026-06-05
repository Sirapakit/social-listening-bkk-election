"""
Sentiment classification for BKK election tweets using a local HuggingFace model.

Model: cardiffnlp/twitter-xlm-roberta-base-sentiment
- Trained on multilingual Twitter data → same domain as our dataset
- Supports Thai text
- Labels: Negative / Neutral / Positive
- ~280M params, runs on Apple M2 (MPS)

Install deps before running:
    pip install torch transformers pandas tqdm sentencepiece
"""

import csv
import os
from pathlib import Path
from tqdm import tqdm
import torch
import pandas as pd
from transformers import pipeline

# ── paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
INPUT_CSV = ROOT / "results.csv"
OUTPUT_CSV = ROOT / "processed_results.csv"

# ── device ─────────────────────────────────────────────────────────────────
if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

print(f"Using device: {DEVICE}")

# ── model ──────────────────────────────────────────────────────────────────
MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
BATCH_SIZE = 32  # tune down to 16 if you hit MPS OOM

# cardiffnlp label mapping  (model outputs Negative/Neutral/Positive)
LABEL_MAP = {
    "Negative": "negative",
    "Neutral": "neutral",
    "Positive": "positive",
}


def load_classifier():
    print(f"Loading model: {MODEL_NAME}")
    clf = pipeline(
        "text-classification",
        model=MODEL_NAME,
        device=DEVICE,
        truncation=True,
        max_length=512,
    )
    print("Model loaded.\n")
    return clf


def load_already_processed() -> set:
    """Return set of IDs already saved in OUTPUT_CSV (for resume support)."""
    if not OUTPUT_CSV.exists():
        return set()
    df = pd.read_csv(OUTPUT_CSV, usecols=["id"])
    return set(df["id"].astype(str))


def classify(clf, texts: list[str]) -> list[str]:
    """Run batch inference; return list of 'positive'/'negative'/'neutral'."""
    results = clf(texts, batch_size=BATCH_SIZE)
    return [r["label"].lower() for r in results]


def main():
    df = pd.read_csv(INPUT_CSV)
    print(f"Loaded {len(df)} rows from {INPUT_CSV.name}")

    already_done = load_already_processed()
    if already_done:
        print(f"Resuming — {len(already_done)} rows already processed, skipping.\n")

    # rows that still need classification
    todo_mask = ~df["id"].astype(str).isin(already_done)
    todo_df = df[todo_mask].copy()
    print(f"Rows to classify: {len(todo_df)}")

    if todo_df.empty:
        print("Nothing to do — all rows already classified.")
        return

    clf = load_classifier()

    # ── batch classify ──────────────────────────────────────────────────────
    texts = todo_df["text"].fillna("").tolist()
    sentiments: list[str] = []

    for i in tqdm(range(0, len(texts), BATCH_SIZE), desc="Classifying"):
        batch = texts[i : i + BATCH_SIZE]
        sentiments.extend(classify(clf, batch))

    todo_df = todo_df.copy()
    todo_df["sentiment"] = sentiments

    # ── write output ────────────────────────────────────────────────────────
    if OUTPUT_CSV.exists():
        existing = pd.read_csv(OUTPUT_CSV)
        combined = pd.concat([existing, todo_df], ignore_index=True)
    else:
        combined = todo_df

    combined.to_csv(OUTPUT_CSV, index=False)
    print(f"\nDone. {len(combined)} rows saved to {OUTPUT_CSV.name}")

    # quick summary
    dist = combined["sentiment"].value_counts()
    print("\nSentiment distribution:")
    for label, count in dist.items():
        pct = count / len(combined) * 100
        print(f"  {label:10s} {count:5d}  ({pct:.1f}%)")


if __name__ == "__main__":
    main()
