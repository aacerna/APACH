"""Autenticación por cookie HttpOnly con sesión en servidor y protección CSRF (token por sesión)."""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import hash_token
from app.models import Role, User, UserSession

SESSION_COOKIE = "apach_session"
CSRF_COOKIE = "apach_csrf"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _unauthorized(detail: str = "Tu sesión no es válida o expiró. Inicia sesión de nuevo.") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_current_session(request: Request, db: Session = Depends(get_db)) -> UserSession:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise _unauthorized("Necesitas iniciar sesión.")
    session = db.scalars(select(UserSession).where(UserSession.token_hash == hash_token(token))).first()
    if session is None or session.expires_at <= datetime.now(timezone.utc):
        raise _unauthorized()
    if not session.user.is_active:
        raise _unauthorized("Tu cuenta está desactivada.")
    if request.method not in SAFE_METHODS:
        header = request.headers.get(CSRF_HEADER)
        if not header or header != session.csrf_token:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Solicitud rechazada por protección CSRF. Recarga la página.")
    return session


def get_current_user(session: UserSession = Depends(get_current_session)) -> User:
    return session.user


def require_roles(*roles: Role):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No tienes permiso para esta acción.")
        return user

    return checker


def not_found(entity: str = "Recurso") -> HTTPException:
    # 404 también cuando el recurso existe pero no pertenece al usuario: no revela su existencia.
    return HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{entity} no encontrado.")
