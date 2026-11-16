"""Almacenamiento privado de documentos: fuera de cualquier carpeta servida, nombre UUID sin extensión."""
from pathlib import Path

from app.core.config import get_settings


def storage_root() -> Path:
    root = Path(get_settings().storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def path_for(storage_key: str) -> Path:
    if not storage_key.isalnum():
        raise ValueError("Clave de almacenamiento inválida")
    return storage_root() / storage_key


def save(storage_key: str, data: bytes) -> Path:
    path = path_for(storage_key)
    path.write_bytes(data)
    return path
