import os
import tempfile
from pathlib import Path

# Configuración aislada ANTES de importar la app.
os.environ.setdefault("APACH_DATABASE_URL", "postgresql+psycopg://apach:apach_dev@localhost:5433/apach_test")
os.environ["APACH_ENV"] = "test"
os.environ["APACH_STORAGE_DIR"] = tempfile.mkdtemp(prefix="apach-test-storage-")
os.environ["APACH_LOGIN_MAX_FAILURES"] = "5"

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core.db import get_engine, session_factory  # noqa: E402
from app.main import create_app  # noqa: E402
from app.scripts.seed_demo import DEMO_PASSWORD, DOMAIN, seed  # noqa: E402
from tests.fixtures.builder import FIXTURES, build  # noqa: E402

API_DIR = Path(__file__).resolve().parents[1]
FIXTURE_DIR = Path(tempfile.mkdtemp(prefix="apach-fixtures-"))


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "alembic"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def clean_db(migrated_database):
    with get_engine().begin() as conn:
        tables = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'")).scalars().all()
        conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db():
    with session_factory()() as session:
        yield session


@pytest.fixture
def seeded(db):
    seed(db)
    return db


@pytest.fixture(scope="session")
def docx_fixtures() -> dict[str, Path]:
    return {name: build(factory(), FIXTURE_DIR / name) for name, factory in FIXTURES.items()}


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
def make_client(app):
    def _make(email_local: str | None = None, password: str = DEMO_PASSWORD) -> TestClient:
        client = TestClient(app)
        if email_local:
            r = client.post("/api/v1/auth/login", json={"email": f"{email_local}@{DOMAIN}", "password": password})
            assert r.status_code == 200, r.text
            client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
        return client
    return _make


def section_id(client: TestClient, course_code: str) -> int:
    sections = client.get("/api/v1/sections").json()
    return next(s["id"] for s in sections if s["course"]["code"] == course_code)


def upload(client: TestClient, path: Path, sid: int, name: str | None = None, mime: str | None = None):
    with open(path, "rb") as fh:
        return client.post("/api/v1/documents", data={"section_id": str(sid)},
                           files={"file": (name or path.name, fh, mime or "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
