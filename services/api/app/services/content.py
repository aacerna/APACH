"""Contenido compartido (fuente única con el frontend): guías y catálogo de referencias."""
import json
from functools import lru_cache

from app.core.config import get_settings


@lru_cache
def guides() -> list[dict]:
    path = get_settings().shared_content_dir / "guides.json"
    return json.loads(path.read_text(encoding="utf-8"))["guides"]


def guide_by_slug(slug: str) -> dict | None:
    return next((g for g in guides() if g["slug"] == slug), None)
