from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator

from app.models import Role


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------ auth
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=1, max_length=128)


class RequestResetIn(BaseModel):
    email: EmailStr


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ProgramRef(ORM):
    id: int
    code: str
    name: str


class UserOut(ORM):
    id: int
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: Role
    is_active: bool
    must_change_password: bool
    program: ProgramRef | None = None
    created_at: datetime


class MeOut(BaseModel):
    user: UserOut
    csrf_token: str


# ------------------------------------------------------------------ catálogo académico
class ProgramIn(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r"^[A-Z0-9_\-]+$")
    name: str = Field(min_length=3, max_length=200)
    active: bool = True


class ProgramOut(ORM):
    id: int
    code: str
    name: str
    active: bool


class TermIn(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_\-]+$")
    name: str = Field(min_length=3, max_length=200)
    start_date: date
    end_date: date
    active: bool = True

    @field_validator("end_date")
    @classmethod
    def check_dates(cls, v, info):
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("La fecha de fin debe ser posterior a la de inicio.")
        return v


class TermOut(ORM):
    id: int
    code: str
    name: str
    start_date: date
    end_date: date
    active: bool


class CourseIn(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_\-]+$")
    name: str = Field(min_length=3, max_length=200)
    program_id: int
    active: bool = True


class CourseOut(ORM):
    id: int
    code: str
    name: str
    program_id: int
    active: bool
    program: ProgramRef


class SectionIn(BaseModel):
    course_id: int
    term_id: int
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_\-]+$")
    active: bool = True


class SectionOut(BaseModel):
    id: int
    code: str
    active: bool
    course: CourseOut
    term: TermOut
    teachers: list[str] = []
    student_count: int | None = None


class UserCreateIn(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    role: Role
    program_id: int | None = None


class UserUpdateIn(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    program_id: int | None = None
    is_active: bool | None = None
    role: Role | None = None


class AccountLinkOut(BaseModel):
    user: UserOut
    purpose: str
    expires_at: datetime
    dev_link: str | None = Field(None, description="Solo en desarrollo/demo. Nunca se envía correo desde APACH.")
    notice: str


class EnrollmentIn(BaseModel):
    student_id: int
    section_id: int


class AssignmentIn(BaseModel):
    teacher_id: int
    section_id: int


class MembershipOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    section_id: int
    section_label: str


# ------------------------------------------------------------------ documentos y análisis
class DocumentOut(BaseModel):
    id: int
    original_filename: str
    size_bytes: int
    sha256: str
    status: str
    review_status: str
    created_at: datetime
    updated_at: datetime
    section_id: int
    section_label: str
    student_id: int
    student_name: str
    latest_counts: dict[str, int] | None = None
    comment_count: int = 0


class FindingOut(ORM):
    id: int
    rule_code: str
    severity: str
    verification_status: str
    message: str
    evidence: dict[str, Any]
    location: dict[str, Any]
    suggestion: str
    guide_slug: str | None
    rule_set_version: str


class AnalysisOut(BaseModel):
    run_id: int
    document_id: int
    status: str
    rule_set_version: str
    started_at: datetime
    finished_at: datetime | None
    error_message: str | None
    summary: dict[str, Any]
    findings: list[FindingOut]


class RunListItem(BaseModel):
    id: int
    status: str
    rule_set_version: str
    started_at: datetime
    counts: dict[str, int] | None


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentOut(BaseModel):
    id: int
    document_id: int
    teacher_id: int
    teacher_name: str
    body: str
    created_at: datetime
    updated_at: datetime


class ReviewStatusIn(BaseModel):
    review_status: Literal["PENDING", "REVIEWED"]


# ------------------------------------------------------------------ reglas, guías
class RuleOut(ORM):
    id: int
    code: str
    name: str
    description: str
    scope: str
    version: str
    enabled: bool
    implemented: bool
    guide_slug: str | None
    source: str
    effective_from: date | None


class RuleCreateIn(BaseModel):
    code: str = Field(min_length=3, max_length=40, pattern=r"^ECC-[A-Z0-9\-]+$")
    name: str = Field(min_length=3, max_length=200)
    description: str = ""
    version: str = Field(min_length=1, max_length=40)
    source: str = Field(min_length=3, description="Fuente oficial (documento ECC).")
    effective_from: date | None = None
    guide_slug: str | None = None


class RuleUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    version: str | None = None
    source: str | None = None
    effective_from: date | None = None
    enabled: bool | None = None


# ------------------------------------------------------------------ referencias
class Segment(BaseModel):
    text: str = Field(max_length=4000)
    italic: bool = False


class ReferenceOutputModel(BaseModel):
    segments: list[Segment] = Field(min_length=1, max_length=60)
    parenthetical_citation: str = Field(max_length=1000)
    narrative_citation: str = Field(max_length=1000)
    warnings: list[str] = Field(default_factory=list, max_length=30)
    rules_version: str = Field(max_length=40)


class ReferenceUpsertIn(BaseModel):
    source_type: str = Field(min_length=2, max_length=40, pattern=r"^[a-z_]+$")
    input: dict[str, Any]
    output: ReferenceOutputModel
    updated_at: datetime


class ReferenceOut(BaseModel):
    client_id: str
    source_type: str
    input: dict[str, Any]
    output: dict[str, Any]
    rules_version: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


# ------------------------------------------------------------------ plantillas, ajustes
class TemplateIn(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    program_id: int | None = None
    template_type: str = Field(min_length=2, max_length=80)
    url: HttpUrl
    active: bool = True

    @field_validator("url")
    @classmethod
    def https_only(cls, v: HttpUrl):
        if v.scheme != "https":
            raise ValueError("La URL debe usar HTTPS.")
        return v


class TemplateOut(BaseModel):
    id: int
    name: str
    description: str
    program_id: int | None
    program_name: str | None
    template_type: str
    url: str
    active: bool
    updated_by: str | None
    updated_at: datetime


class PublicSettingsOut(BaseModel):
    institutional_contact: str
    welcome_video_url: str | None
    ecc_guide_status: str
    environment: str


class SettingsIn(BaseModel):
    institutional_contact: str | None = Field(default=None, max_length=300)
    welcome_video_url: str | None = Field(default=None, max_length=1000)

    @field_validator("welcome_video_url")
    @classmethod
    def https_video(cls, v):
        if v and not v.startswith("https://"):
            raise ValueError("El enlace del video debe usar HTTPS.")
        return v
