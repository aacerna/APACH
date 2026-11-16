import re
import unicodedata


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize_label(text: str) -> str:
    """Texto de encabezado normalizado: minúsculas, sin tildes ni puntuación final."""
    t = strip_accents(" ".join(text.split())).lower()
    return re.sub(r"[\s:.\-–]+$", "", t).strip()


def norm_token(token: str) -> str:
    return re.sub(r"[^a-z0-9]", "", strip_accents(token).lower())


def is_capitalized(token: str) -> bool:
    clean = token.strip("[]().,;:“”\"'«»")
    return bool(clean) and clean[0].isalpha() and clean[0].isupper()
