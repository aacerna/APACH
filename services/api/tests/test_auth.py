from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_token
from app.models import AccountToken, User
from app.scripts.seed_demo import DEMO_PASSWORD, DOMAIN


def test_health(make_client, seeded):
    r = make_client().get("/api/v1/health")
    assert r.status_code == 200 and r.json()["database"] == "ok" and r.json()["migration"] == "0001"


def test_login_success_sets_httponly_cookie(make_client, seeded):
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": f"ESTUDIANTE1@{DOMAIN}", "password": DEMO_PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "STUDENT"
    cookie = r.headers.get_list("set-cookie")
    assert any("apach_session=" in h and "HttpOnly" in h for h in cookie)
    assert "password_hash" not in r.text


def test_login_wrong_password_generic_message(make_client, seeded):
    c = make_client()
    r1 = c.post("/api/v1/auth/login", json={"email": f"estudiante1@{DOMAIN}", "password": "incorrecta123"})
    r2 = c.post("/api/v1/auth/login", json={"email": f"noexiste@{DOMAIN}", "password": "incorrecta123"})
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["detail"] == r2.json()["detail"]


def test_login_rate_limited(make_client, seeded):
    c = make_client()
    for _ in range(5):
        c.post("/api/v1/auth/login", json={"email": f"estudiante2@{DOMAIN}", "password": "malamala123"})
    r = c.post("/api/v1/auth/login", json={"email": f"estudiante2@{DOMAIN}", "password": DEMO_PASSWORD})
    assert r.status_code == 429


def test_me_requires_session(make_client, seeded):
    assert make_client().get("/api/v1/me").status_code == 401
    assert make_client("estudiante1").get("/api/v1/me").json()["user"]["email"] == f"estudiante1@{DOMAIN}"


def test_csrf_required_for_unsafe_methods(make_client, seeded):
    c = make_client("estudiante1")
    c.headers.pop("X-CSRF-Token")
    assert c.post("/api/v1/auth/logout").status_code == 403


def test_logout_invalidates_session(make_client, seeded):
    c = make_client("estudiante1")
    assert c.post("/api/v1/auth/logout").status_code == 204
    assert c.get("/api/v1/me").status_code == 401


def test_activation_flow_single_use(make_client, seeded, db):
    admin = make_client("admin")
    r = admin.post("/api/v1/admin/users", json={"email": f"nuevo@{DOMAIN}", "first_name": "Nuevo", "last_name": "Ficticio",
                                                "role": "STUDENT"})
    assert r.status_code == 201
    link = r.json()["dev_link"]
    assert link and "activar?token=" in link
    token = link.split("token=")[1]
    anon = make_client()
    assert anon.post("/api/v1/auth/login", json={"email": f"nuevo@{DOMAIN}", "password": "Clave-Nueva-2026"}).status_code == 401
    assert anon.post("/api/v1/auth/activate", json={"token": token, "password": "corta"}).status_code == 422
    ok = anon.post("/api/v1/auth/activate", json={"token": token, "password": "Clave-Nueva-2026"})
    assert ok.status_code == 200 and ok.json()["user"]["is_active"] is True
    again = make_client().post("/api/v1/auth/activate", json={"token": token, "password": "Otra-Clave-2026"})
    assert again.status_code == 400
    stored = db.scalars(select(AccountToken)).all()
    assert all(t.token_hash != token for t in stored)  # solo se guarda el hash


def test_expired_reset_token_rejected(make_client, seeded, db):
    admin = make_client("admin")
    user = db.scalars(select(User).where(User.email == f"estudiante3@{DOMAIN}")).one()
    token = admin.post(f"/api/v1/admin/users/{user.id}/reset-link").json()["dev_link"].split("token=")[1]
    record = db.scalars(select(AccountToken).where(AccountToken.token_hash == hash_token(token))).one()
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert make_client().post("/api/v1/auth/reset", json={"token": token, "password": "Clave-Nueva-2026"}).status_code == 400


def test_reset_flow_and_old_sessions_closed(make_client, seeded, db):
    student = make_client("estudiante3")
    admin = make_client("admin")
    user = db.scalars(select(User).where(User.email == f"estudiante3@{DOMAIN}")).one()
    token = admin.post(f"/api/v1/admin/users/{user.id}/reset-link").json()["dev_link"].split("token=")[1]
    assert make_client().post("/api/v1/auth/reset", json={"token": token, "password": "Clave-Reset-2026"}).status_code == 200
    assert student.get("/api/v1/me").status_code == 401
    assert make_client().post("/api/v1/auth/reset", json={"token": token, "password": "Clave-Reset-2027"}).status_code == 400
    assert make_client("estudiante3", password="Clave-Reset-2026").get("/api/v1/me").status_code == 200


def test_request_reset_does_not_reveal_existence(make_client, seeded):
    c = make_client()
    a = c.post("/api/v1/auth/request-reset", json={"email": f"estudiante1@{DOMAIN}"})
    b = c.post("/api/v1/auth/request-reset", json={"email": f"nadie@{DOMAIN}"})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()


def test_deactivated_user_cannot_login(make_client, seeded, db):
    admin = make_client("admin")
    user = db.scalars(select(User).where(User.email == f"estudiante2@{DOMAIN}")).one()
    session_client = make_client("estudiante2")
    assert admin.patch(f"/api/v1/admin/users/{user.id}", json={"is_active": False}).status_code == 200
    assert session_client.get("/api/v1/me").status_code == 401
    r = make_client().post("/api/v1/auth/login", json={"email": f"estudiante2@{DOMAIN}", "password": DEMO_PASSWORD})
    assert r.status_code == 403


def test_no_public_registration_route(app):
    paths = {route.path for route in app.routes}
    assert not any("register" in p or "signup" in p for p in paths)
