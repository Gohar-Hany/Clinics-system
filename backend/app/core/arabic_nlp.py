"""
Arabic NLP & Dialect Utilities for Clinic AI System.
Parses Egyptian dialect dates, times, and phone numbers written in words.
"""

import re
from datetime import datetime, timedelta

ARABIC_DIGITS_MAP = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
}

ARABIC_WORD_DIGITS = {
    "زيرو": "0", "صفر": "0",
    "واحد": "1", "واحده": "1", "واحدة": "1",
    "اتنين": "2", "اثنين": "2", "إثنين": "2",
    "تلاته": "3", "ثلاثة": "3", "تلاتة": "3", "ثلاثه": "3",
    "اربعه": "4", "أربعة": "4", "اربعة": "4", "أربعه": "4",
    "خمسه": "5", "خمسة": "5",
    "سته": "6", "ستة": "6",
    "سبعه": "7", "سبعة": "7",
    "تمانيه": "8", "ثمانية": "8", "تمانية": "8", "ثمانيه": "8",
    "تسعه": "9", "تسعة": "9",
    "عشره": "10", "عشرة": "10",
    "حداشر": "11", "أحد عشر": "11", "احد عشر": "11", "احداشر": "11",
    "اتناشر": "12", "إثنا عشر": "12", "اثنا عشر": "12", "اثناعشر": "12",
}

HOUR_MAP_EGY = {
    "تسعة": "09", "تسعه": "09", "9": "09", "09": "09",
    "عشرة": "10", "عشره": "10", "10": "10",
    "حداشر": "11", "احداشر": "11", "أحد عشر": "11", "احد عشر": "11", "11": "11",
    "اتناشر": "12", "اثنا عشر": "12", "12": "12",
    "واحدة": "13", "واحده": "13", "واحد": "13", "1": "13", "01": "13",
    "اتنين": "14", "اثنين": "14", "2": "14", "02": "14",
    "تلاتة": "15", "تلاته": "15", "ثلاثة": "15", "3": "15", "03": "15",
    "أربعة": "16", "اربعه": "16", "اربعة": "16", "4": "16", "04": "16",
    "خمسة": "17", "خمسه": "17", "5": "17", "05": "17",
}


def normalize_arabic_digits(text: str) -> str:
    """Convert Eastern Arabic numerals (٠-٩) to Western (0-9)."""
    if not text:
        return ""
    result = text
    for ar_digit, en_digit in ARABIC_DIGITS_MAP.items():
        result = result.replace(ar_digit, en_digit)
    return result


def parse_spelled_phone_number(text: str) -> str | None:
    """
    Extract phone number even if written in Arabic words:
    e.g. 'رقمي زيرو عشره اتناشر تسعه تمانيه واحد اتنين تلاته اربعه خمسه' -> '01012981234'
    """
    cleaned = normalize_arabic_digits(text)

    # 1. Direct standard regex check first
    direct_match = re.search(r'(01[0125]\d{8}|\+?201[0125]\d{8})', cleaned)
    if direct_match:
        raw = direct_match.group(1)
        if raw.startswith("+20"):
            return "0" + raw[3:]
        elif raw.startswith("20"):
            return "0" + raw[2:]
        return raw

    # 2. Check for spelled out words
    words = text.replace("،", " ").replace("-", " ").split()
    digit_stream = []
    for w in words:
        w_clean = w.strip()
        if w_clean in ARABIC_WORD_DIGITS:
            digit_stream.append(ARABIC_WORD_DIGITS[w_clean])
        elif w_clean.isdigit():
            digit_stream.append(w_clean)

    joined = "".join(digit_stream)
    match = re.search(r'(01[0125]\d{8}|201[0125]\d{8})', joined)
    if match:
        raw = match.group(1)
        if raw.startswith("20"):
            return "0" + raw[2:]
        return raw

    return None


def parse_arabic_time(text: str) -> str | None:
    """
    Extract time from Egyptian dialect phrases or standard strings:
    '03:00' -> '03:00'
    '23:00' -> '23:00'
    'حداشر ونص الصبح' -> '11:30'
    'واحدة الضهر' -> '13:00'
    'اربعه العصر' -> '16:00'
    """
    cleaned = normalize_arabic_digits(text).strip()

    # 1. Direct standard numeric HH:MM check (handles any hour 00-23)
    time_match = re.search(r'\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b', cleaned)
    if time_match:
        h = int(time_match.group(1))
        m = time_match.group(2)
        return f"{h:02d}:{m}"

    # 2. Standalone Arabic hour word matching
    for hour_kw, hour_val in HOUR_MAP_EGY.items():
        # Only match words, not single digit characters inside text
        if re.search(rf'(^|\s){re.escape(hour_kw)}(\s|$)', cleaned):
            if re.search(r'(^|\s)(ونص|نص|ونصف|نصف)(\s|$)', cleaned):
                return f"{hour_val}:30"
            elif re.search(r'(^|\s)(وربع|ربع)(\s|$)', cleaned):
                return f"{hour_val}:15"
            elif re.search(r'(^|\s)(وتلت|تلت|وثلث|ثلث)(\s|$)', cleaned):
                return f"{hour_val}:20"
            else:
                return f"{hour_val}:00"

    return None
