"""Hash de contraseñas (Argon2id) y tokens opacos (solo se guarda su SHA-256)."""
import hashlib
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()  # argon2id por defecto


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# Hash constante para igualar tiempos cuando el usuario no existe.
DUMMY_HASH = hash_password("apach-dummy-password-timing")


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def password_problems(password: str) -> list[str]:
    problems = []
    if len(password) < 10:
        problems.append("Debe tener al menos 10 caracteres.")
    if not re.search(r"[A-Za-zÁÉÍÓÚáéíóúÑñ]", password):
        problems.append("Debe incluir letras.")
    if not re.search(r"\d", password):
        problems.append("Debe incluir al menos un número.")
    if len(password) > 128:
        problems.append("No puede superar 128 caracteres.")
    return problems


def normalize_email(email: str) -> str:
    return email.strip().lower()
