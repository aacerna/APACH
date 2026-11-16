"""Modelo relacional de APACH. Toda tabla aquí tiene migración Alembic."""
import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"


class DocumentStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    ANALYZING = "ANALYZING"
    ANALYZED = "ANALYZED"
    FAILED = "FAILED"


class ReviewStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"


class RunStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Severity(str, enum.Enum):
    ERROR = "ERROR"
    POSSIBLE_PROBLEM = "POSSIBLE_PROBLEM"
    NEEDS_TEACHER = "NEEDS_TEACHER"


class VerificationStatus(str, enum.Enum):
    CHECKED = "CHECKED"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class TokenPurpose(str, enum.Enum):
    ACTIVATION = "ACTIVATION"
    RESET = "RESET"


class RuleScope(str, enum.Enum):
    GENERAL = "GENERAL"
    ECC = "ECC"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, values_callable=lambda x: [m.value for m in x])


class Program(Base):
    __tablename__ = "programs"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AcademicTerm(Base):
    __tablename__ = "academic_terms"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id", ondelete="RESTRICT"), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    program: Mapped[Program] = relationship()


class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (UniqueConstraint("course_id", "term_id", "code", name="uq_section_course_term_code"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"), index=True)
    term_id: Mapped[int] = mapped_column(ForeignKey("academic_terms.id", ondelete="RESTRICT"), index=True)
    code: Mapped[str] = mapped_column(String(40))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    course: Mapped[Course] = relationship()
    term: Mapped[AcademicTerm] = relationship()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(_enum(Role, "user_role"))
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    program_id: Mapped[int | None] = mapped_column(ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    program: Mapped[Program | None] = relationship()

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "section_id", name="uq_enrollment"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    student: Mapped[User] = relationship()
    section: Mapped[Section] = relationship()


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"
    __table_args__ = (UniqueConstraint("teacher_id", "section_id", name="uq_teacher_assignment"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    teacher: Mapped[User] = relationship()
    section: Mapped[Section] = relationship()


class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    user: Mapped[User] = relationship()


class AccountToken(Base):
    __tablename__ = "account_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[TokenPurpose] = mapped_column(_enum(TokenPurpose, "token_purpose"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = (Index("ix_login_attempts_email_created", "email", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254))
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="RESTRICT"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True, default=lambda: uuid.uuid4().hex)
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[DocumentStatus] = mapped_column(_enum(DocumentStatus, "document_status"), default=DocumentStatus.UPLOADED)
    review_status: Mapped[ReviewStatus] = mapped_column(_enum(ReviewStatus, "review_status"), default=ReviewStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    student: Mapped[User] = relationship()
    section: Mapped[Section] = relationship()


class ApaRule(Base):
    __tablename__ = "apa_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    scope: Mapped[RuleScope] = mapped_column(_enum(RuleScope, "rule_scope"), default=RuleScope.GENERAL)
    version: Mapped[str] = mapped_column(String(40))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    implemented: Mapped[bool] = mapped_column(Boolean, default=False)
    guide_slug: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source: Mapped[str] = mapped_column(Text, default="")
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    rule_set_version: Mapped[str] = mapped_column(String(40))
    status: Mapped[RunStatus] = mapped_column(_enum(RunStatus, "run_status"), default=RunStatus.RUNNING)
    summary: Mapped[dict] = mapped_column(JSONType, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    findings: Mapped[list["AnalysisFinding"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="AnalysisFinding.id"
    )


class AnalysisFinding(Base):
    __tablename__ = "analysis_findings"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), index=True)
    rule_code: Mapped[str] = mapped_column(String(40), index=True)
    severity: Mapped[Severity] = mapped_column(_enum(Severity, "finding_severity"))
    verification_status: Mapped[VerificationStatus] = mapped_column(_enum(VerificationStatus, "verification_status"))
    message: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSONType, default=dict)
    location: Mapped[dict] = mapped_column(JSONType, default=dict)
    suggestion: Mapped[str] = mapped_column(Text, default="")
    guide_slug: Mapped[str | None] = mapped_column(String(80), nullable=True)
    rule_set_version: Mapped[str] = mapped_column(String(40))
    run: Mapped[AnalysisRun] = relationship(back_populates="findings")


class TeacherComment(Base):
    __tablename__ = "teacher_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    teacher: Mapped[User] = relationship()


class ReferenceRecord(Base):
    __tablename__ = "reference_records"
    __table_args__ = (UniqueConstraint("owner_id", "client_id", name="uq_reference_owner_client"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(40))
    input: Mapped[dict] = mapped_column(JSONType)
    output: Mapped[dict] = mapped_column(JSONType)
    rules_version: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TemplateLink(Base):
    __tablename__ = "template_links"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    program_id: Mapped[int | None] = mapped_column(ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    template_type: Mapped[str] = mapped_column(String(80))
    url: Mapped[str] = mapped_column(String(1000))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    program: Mapped[Program | None] = relationship()
    updated_by: Mapped[User | None] = relationship()


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONType)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    details: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class CsvImportBatch(Base):
    __tablename__ = "csv_import_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="PREVIEW")  # PREVIEW | IMPORTED
    rows: Mapped[list] = mapped_column(JSONType, default=list)
    report: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
