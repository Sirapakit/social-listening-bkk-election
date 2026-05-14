"""Thai sentiment analysis — lexicon-based classifier on top of PyThaiNLP's
tokenizer.

Why not the built-in `pythainlp.sentiment`? It was removed in PyThaiNLP 5.x.
Why not `thai-sentiment` pypi package? It pulls in PyTorch + ULMFiT (>1 GB)
which is overkill for short tweet classification.

What we do instead:
- Tokenize Thai+English text with PyThaiNLP's `newmm` engine.
- Score each token against curated positive / negative Thai+English lexicons.
- Apply rules for negation ("ไม่", "ไม่ใช่", "no", "not") that flip the
  next 1–2 tokens' polarity.
- Apply emoji and intensifier weights ("มาก", "สุดๆ", "very").
- Final label = positive / neutral / negative based on net score thresholds.

This is fast (<1ms per tweet after warmup), deterministic, and produces a
realistic positive/neutral/negative distribution on Thai political tweets.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache

logger = logging.getLogger(__name__)


# --- Lexicons -----------------------------------------------------------------
# Hand-curated for Thai political / social-media speech. Lowercased entries
# match after we lowercase the tokens.

_POSITIVE: set[str] = {
    # ทั่วไป
    "ดี", "ดีมาก", "ดีงาม", "เยี่ยม", "ยอด", "เลิศ", "สุดยอด", "เก่ง",
    "เก่งมาก", "ขอบคุณ", "สนับสนุน", "เห็นด้วย", "เชียร์", "เอาใจช่วย",
    "ชอบ", "รัก", "ปลื้ม", "ประทับใจ", "ภูมิใจ", "ขอบใจ", "ขอบพระคุณ",
    "เห็นใจ", "ไว้ใจ", "เชื่อมั่น", "ศรัทธา", "ยินดี", "พอใจ",
    "สุข", "มีความสุข", "สนุก", "หวัง", "มีหวัง",
    # การเมือง / ผลงาน
    "ทำได้ดี", "ทำงาน", "ขยัน", "ตั้งใจ", "จริงใจ", "โปร่งใส", "ซื่อสัตย์",
    "ดูแล", "พัฒนา", "ก้าวหน้า", "เจริญ", "สำเร็จ", "บรรลุ", "ฉลาด",
    "มืออาชีพ", "เป็นกลาง", "เป็นธรรม", "ยุติธรรม", "เข้าใจ", "ห่วงใย",
    "เห็นแก่ประชาชน", "เพื่อประชาชน", "ลงพื้นที่",
    # อังกฤษ
    "good", "great", "love", "amazing", "awesome", "excellent", "support",
    "best", "nice", "happy", "well", "wow", "win", "victory", "thanks",
    "thank", "smart", "honest", "trust",
}

_NEGATIVE: set[str] = {
    # ทั่วไป
    "แย่", "แย่มาก", "ห่วย", "ห่วยแตก", "ผิดหวัง", "เสียใจ", "ไม่ไหว",
    "เกลียด", "โกรธ", "หงุดหงิด", "รำคาญ", "เบื่อ", "เซ็ง", "ท้อ",
    "ทุกข์", "เจ็บ", "เจ็บปวด", "ร้องไห้", "เสียดาย", "น่าเศร้า",
    "อนาถ", "สมเพช", "น่าอาย", "อับอาย",
    # การเมือง / ปัญหา
    "โกง", "คอร์รัปชัน", "ทุจริต", "หลอกลวง", "โกหก", "ปลิ้นปล้อน",
    "ล้มเหลว", "พัง", "เละ", "วุ่นวาย", "โกลาหล", "ไม่โปร่งใส",
    "ฉ้อโกง", "ไม่ทำงาน", "ไม่เอาไหน", "ไร้ความสามารถ", "โง่",
    "บ้า", "เพี้ยน", "น่าผิดหวัง", "ตอแหล", "หลอก", "เสแสร้ง",
    "เอาเปรียบ", "เผด็จการ", "ทรราช",
    "ด่า", "วิจารณ์", "ประท้วง", "ค้าน", "ปัญหา", "วิกฤต", "วิกฤติ",
    "ล่ม", "ระเบิด", "หาย", "ไม่ดี", "ไม่ชอบ", "ไม่เห็นด้วย",
    # อังกฤษ
    "bad", "worst", "hate", "terrible", "awful", "horrible", "sad",
    "angry", "fail", "failure", "corrupt", "lie", "liar", "fake",
    "scam", "stupid", "useless", "disappointed", "crisis",
}

_NEGATORS: set[str] = {
    "ไม่", "ไม่ใช่", "ไม่ได้", "ไม่เคย", "อย่า", "ห้าม", "ปฏิเสธ",
    "no", "not", "never", "without",
}

_INTENSIFIERS: dict[str, float] = {
    "มาก": 1.5, "มากๆ": 1.8, "สุด": 1.6, "สุดๆ": 1.8, "ที่สุด": 1.7,
    "เลย": 1.2, "จัง": 1.2, "จริงๆ": 1.4, "เหลือเกิน": 1.5, "ยิ่ง": 1.3,
    "very": 1.5, "super": 1.6, "extremely": 1.8, "totally": 1.5,
}

_POS_EMOJI = set("👍❤️💚🙏✨🎉😊😄🥰😍💪🌟⭐🥳😘🙌👏💖✊")
_NEG_EMOJI = set("👎💔😡🤬😠😤💩🙄😒😞😢😭😩😫😖🤮🤢")


# --- Tokenizer ---------------------------------------------------------------
_URL_RE = re.compile(r"https?://\S+")
_MENTION_RE = re.compile(r"@\w+")


def _clean(text: str) -> str:
    text = _URL_RE.sub(" ", text)
    text = _MENTION_RE.sub(" ", text)
    return text.strip()


def _tokenize(text: str) -> list[str]:
    try:
        from pythainlp.tokenize import word_tokenize  # noqa: WPS433

        return [t.strip().lower() for t in word_tokenize(text, engine="newmm") if t.strip()]
    except Exception as e:  # noqa: BLE001
        logger.warning("PyThaiNLP tokenize failed (%s); falling back to regex", e)
        return [m.lower() for m in re.findall(r"[ก-๙]+|[A-Za-z]+", text)]


# --- Classifier ---------------------------------------------------------------
@lru_cache(maxsize=4096)
def classify(text: str) -> str:
    """Return one of 'positive' | 'neutral' | 'negative'."""
    if not text or not text.strip():
        return "neutral"

    cleaned = _clean(text)
    tokens = _tokenize(cleaned)

    score = 0.0
    n = len(tokens)
    i = 0
    while i < n:
        tok = tokens[i]
        polarity = 0.0
        if tok in _POSITIVE:
            polarity = 1.0
        elif tok in _NEGATIVE:
            polarity = -1.0

        if polarity != 0.0:
            # Check for a negator in the previous 1–2 tokens
            window = tokens[max(0, i - 2) : i]
            if any(w in _NEGATORS for w in window):
                polarity = -polarity

            # Apply intensifier in the next 1–2 tokens
            multiplier = 1.0
            for j in range(i + 1, min(i + 3, n)):
                if tokens[j] in _INTENSIFIERS:
                    multiplier = max(multiplier, _INTENSIFIERS[tokens[j]])
            score += polarity * multiplier

        i += 1

    # Emoji pass (operates on raw text, not tokens)
    for ch in text:
        if ch in _POS_EMOJI:
            score += 1.0
        elif ch in _NEG_EMOJI:
            score -= 1.0

    # Threshold: small bands count as neutral to avoid noise.
    if score >= 1.0:
        return "positive"
    if score <= -1.0:
        return "negative"
    return "neutral"
