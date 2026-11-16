from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    CSRF_COOKIE,
    SESSION_COOKIE,
    get_current_session,
    get_current_user,
)
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import (
    DUMMY_HASH,
    hash_password,
    hash_token,
    new_token,
    normalize_email,
    password_problems,
    verify_password,
)
from app.models import AccountToken, LoginAttempt, TokenPurpose, User, UserSession
from app.schemas import (
    ChangePasswordIn,
    LoginIn,
    MeOut,
    RequestResetIn,
    TokenPasswordIn,
    UserOut,
)
from app.services import audit

router = APIRouter(prefix="/auth", tags=["auth"])

GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos."


def _set_session_cookies(response: Response, token: str, csrf: str) -> None:
    s = get_settings()
    max_age = s.session_ttl_hours * 3600
    response.set_cookie(SESSION_COOKIE, token, max_age=max_age, httponly=True, secure=s.cookie_secure,
                        samesite=s.cookie_samesite, path="/")
    response.set_cookie(CSRF_COOKIE, csrf, max_age=max_age, httponly=False, secure=s.cookie_secure,
                        samesite=s.cookie_samesite, path="/")


def _clear_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def create_session(db: Session, user: User, response: Response) -> UserSession:
    token, csrf = new_token(), new_token()
    session = UserSession(token_hash=hash_token(token), csrf_token=csrf, user_id=user.id,
                          expires_at=datetime.now(timezone.utc) + timedelta(hours=get_settings().session_ttl_hours))
    db.add(session)
    db.commit()
    _set_session_cookies(response, token, csrf)
    return session


@router.post("/login", response_model=MeOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    s = get_settings()
    email = normalize_email(payload.email)
    since = datetime.now(timezone.utc) - timedelta(minutes=s.login_window_minutes)
    failures = db.scalar(select(func.count()).select_from(LoginAttempt).where(
        LoginAttempt.email == email, LoginAttempt.success.is_(False), LoginAttempt.created_at >= since))
    if failures >= s.login_max_failures:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            detail=f"Demasiados intentos fallidos. Espera {s.login_window_minutes} minutos e inténtalo de nuevo.")
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is not None and user.password_hash:
        ok = verify_password(user.password_hash, payload.password)
    else:
        verify_password(DUMMY_HASH, payload.password)  # iguala el tiempo de respuesta
        ok = False
    ip = request.client.host if request.client else None
    db.add(LoginAttempt(email=email, ip=ip, success=bool(ok and user and user.is_active)))
    if not ok or user is None:
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)
    if not user.is_active:
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Tu cuenta no está activa. Contacta a la coordinación académica.")
    audit.record(db, user, "auth.login", "user", user.id)
    session = create_session(db, user, response)
    return MeOut(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/logout", status_code=204)
def logout(response: Response, session: UserSession = Depends(get_current_session), db: Session = Depends(get_db)):
    db.delete(db.merge(session))
    db.commit()
    _clear_cookies(response)
    response.status_code = 204
    return response


def _consume_token(db: Session, raw: str, purpose: TokenPurpose) -> AccountToken:
    token = db.scalars(select(AccountToken).where(AccountToken.token_hash == hash_token(raw),
                                                  AccountToken.purpose == purpose)).first()
    if token is None or token.used_at is not None or token.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="El enlace no es válido, ya se usó o expiró. Solicita uno nuevo.")
    return token


def _check_password(password: str) -> None:
    problems = password_problems(password)
    if problems:
        raise HTTPException(422, detail=" ".join(problems))


@router.get("/token-status")
def token_status(token: str, purpose: TokenPurpose, db: Session = Depends(get_db)):
    record = db.scalars(select(AccountToken).where(AccountToken.token_hash == hash_token(token),
                                                   AccountToken.purpose == purpose)).first()
    valid = record is not None and record.used_at is None and record.expires_at > datetime.now(timezone.utc)
    return {"valid": valid}


@router.post("/activate", response_model=MeOut)
def activate(payload: TokenPasswordIn, response: Response, db: Session = Depends(get_db)):
    _check_password(payload.password)
    token = _consume_token(db, payload.token, TokenPurpose.ACTIVATION)
    user = db.get(User, token.user_id)
    user.password_hash = hash_password(payload.password)
    user.is_active = True
    user.must_change_password = False
    token.used_at = datetime.now(timezone.utc)
    audit.record(db, user, "auth.activate", "user", user.id)
    session = create_session(db, user, response)
    return MeOut(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/request-reset")
def request_reset(payload: RequestResetIn, db: Session = Depends(get_db)):
    """Respuesta idéntica exista o no el correo. APACH no envía correos: el ADMIN genera el enlace."""
    email = normalize_email(payload.email)
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is not None:
        audit.record(db, None, "auth.reset_requested", "user", user.id)
        db.commit()
    return {"message": "Si el correo pertenece a una cuenta autorizada, la coordinación académica podrá generarte un enlace de restablecimiento."}


@router.post("/reset", response_model=MeOut)
def reset(payload: TokenPasswordIn, response: Response, db: Session = Depends(get_db)):
    _check_password(payload.password)
    token = _consume_token(db, payload.token, TokenPurpose.RESET)
    user = db.get(User, token.user_id)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="La cuenta está desactivada.")
    user.password_hash = hash_password(payload.password)
    user.must_change_password = False
    token.used_at = datetime.now(timezone.utc)
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))  # cierra sesiones previas
    audit.record(db, user, "auth.reset", "user", user.id)
    session = create_session(db, user, response)
    return MeOut(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/change-password", status_code=204)
def change_password(payload: ChangePasswordIn, session: UserSession = Depends(get_current_session),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.merge(user)
    if not user.password_hash or not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta.")
    _check_password(payload.new_password)
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.id != session.id))
    audit.record(db, user, "auth.change_password", "user", user.id)
    db.commit()
    return Response(status_code=204)


me_router = APIRouter(tags=["auth"])


@me_router.get("/me", response_model=MeOut)
def me(session: UserSession = Depends(get_current_session)):
    return MeOut(user=UserOut.model_validate(session.user), csrf_token=session.csrf_token)
