"""Administración académica (solo ADMIN). Toda acción que cambia privilegios o asignaciones se audita."""
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import not_found, require_roles
from app.api.routes.catalog import section_out
from app.api.routes.documents import latest_run, section_label
from app.api.routes.public import read_settings, template_out
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import hash_token, new_token, normalize_email
from app.models import (
    AcademicTerm,
    AccountToken,
    ApaRule,
    AuditEvent,
    Course,
    CsvImportBatch,
    Document,
    Enrollment,
    Program,
    Role,
    RuleScope,
    Section,
    SystemSetting,
    TeacherAssignment,
    TemplateLink,
    TokenPurpose,
    User,
    UserSession,
)
from app.schemas import (
    AccountLinkOut,
    AssignmentIn,
    CourseIn,
    CourseOut,
    EnrollmentIn,
    MembershipOut,
    ProgramIn,
    ProgramOut,
    RuleCreateIn,
    RuleOut,
    RuleUpdateIn,
    SectionIn,
    SectionOut,
    SettingsIn,
    TemplateIn,
    TemplateOut,
    TermIn,
    TermOut,
    UserCreateIn,
    UserOut,
    UserUpdateIn,
)
from app.services import audit, csv_import

router = APIRouter(prefix="/admin", tags=["admin"])
Admin = Depends(require_roles(Role.ADMIN))


def _commit(db: Session, conflict_message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail=conflict_message) from exc


def _get(db: Session, model, entity_id: int, label: str):
    obj = db.get(model, entity_id)
    if obj is None:
        raise not_found(label)
    return obj


# ------------------------------------------------------------------ programas
@router.get("/programs", response_model=list[ProgramOut])
def list_programs(_: User = Admin, db: Session = Depends(get_db)):
    return db.scalars(select(Program).order_by(Program.name)).all()


@router.post("/programs", response_model=ProgramOut, status_code=201)
def create_program(payload: ProgramIn, admin: User = Admin, db: Session = Depends(get_db)):
    program = Program(**payload.model_dump())
    db.add(program)
    _commit(db, "Ya existe un programa con ese código.")
    audit.record(db, admin, "program.create", "program", program.id)
    db.commit()
    return program


@router.put("/programs/{program_id}", response_model=ProgramOut)
def update_program(program_id: int, payload: ProgramIn, admin: User = Admin, db: Session = Depends(get_db)):
    program = _get(db, Program, program_id, "Programa")
    for k, v in payload.model_dump().items():
        setattr(program, k, v)
    audit.record(db, admin, "program.update", "program", program.id)
    _commit(db, "Ya existe un programa con ese código.")
    return program


# ------------------------------------------------------------------ ciclos
@router.get("/terms", response_model=list[TermOut])
def list_terms(_: User = Admin, db: Session = Depends(get_db)):
    return db.scalars(select(AcademicTerm).order_by(AcademicTerm.start_date.desc())).all()


@router.post("/terms", response_model=TermOut, status_code=201)
def create_term(payload: TermIn, admin: User = Admin, db: Session = Depends(get_db)):
    term = AcademicTerm(**payload.model_dump())
    db.add(term)
    _commit(db, "Ya existe un ciclo con ese código.")
    audit.record(db, admin, "term.create", "term", term.id)
    db.commit()
    return term


@router.put("/terms/{term_id}", response_model=TermOut)
def update_term(term_id: int, payload: TermIn, admin: User = Admin, db: Session = Depends(get_db)):
    term = _get(db, AcademicTerm, term_id, "Ciclo")
    for k, v in payload.model_dump().items():
        setattr(term, k, v)
    audit.record(db, admin, "term.update", "term", term.id)
    _commit(db, "Ya existe un ciclo con ese código.")
    return term


# ------------------------------------------------------------------ asignaturas
@router.get("/courses", response_model=list[CourseOut])
def list_courses(_: User = Admin, db: Session = Depends(get_db)):
    return db.scalars(select(Course).options(selectinload(Course.program)).order_by(Course.code)).all()


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(payload: CourseIn, admin: User = Admin, db: Session = Depends(get_db)):
    _get(db, Program, payload.program_id, "Programa")
    course = Course(**payload.model_dump())
    db.add(course)
    _commit(db, "Ya existe una asignatura con ese código.")
    audit.record(db, admin, "course.create", "course", course.id)
    db.commit()
    db.refresh(course)
    return course


@router.put("/courses/{course_id}", response_model=CourseOut)
def update_course(course_id: int, payload: CourseIn, admin: User = Admin, db: Session = Depends(get_db)):
    course = _get(db, Course, course_id, "Asignatura")
    _get(db, Program, payload.program_id, "Programa")
    for k, v in payload.model_dump().items():
        setattr(course, k, v)
    audit.record(db, admin, "course.update", "course", course.id)
    _commit(db, "Ya existe una asignatura con ese código.")
    db.refresh(course)
    return course


# ------------------------------------------------------------------ secciones
@router.get("/sections", response_model=list[SectionOut])
def list_sections(_: User = Admin, db: Session = Depends(get_db)):
    stmt = select(Section).options(selectinload(Section.course).selectinload(Course.program), selectinload(Section.term))
    return [section_out(db, s, with_counts=True) for s in db.scalars(stmt.order_by(Section.id)).all()]


@router.post("/sections", response_model=SectionOut, status_code=201)
def create_section(payload: SectionIn, admin: User = Admin, db: Session = Depends(get_db)):
    _get(db, Course, payload.course_id, "Asignatura")
    _get(db, AcademicTerm, payload.term_id, "Ciclo")
    section = Section(**payload.model_dump())
    db.add(section)
    _commit(db, "Ya existe esa sección para la asignatura y el ciclo.")
    audit.record(db, admin, "section.create", "section", section.id)
    db.commit()
    db.refresh(section)
    return section_out(db, section, with_counts=True)


@router.put("/sections/{section_id}", response_model=SectionOut)
def update_section(section_id: int, payload: SectionIn, admin: User = Admin, db: Session = Depends(get_db)):
    section = _get(db, Section, section_id, "Sección")
    for k, v in payload.model_dump().items():
        setattr(section, k, v)
    audit.record(db, admin, "section.update", "section", section.id)
    _commit(db, "Ya existe esa sección para la asignatura y el ciclo.")
    db.refresh(section)
    return section_out(db, section, with_counts=True)


# ------------------------------------------------------------------ usuarios
@router.get("/users", response_model=list[UserOut])
def list_users(role: Role | None = None, q: str | None = None, _: User = Admin, db: Session = Depends(get_db)):
    stmt = select(User).options(selectinload(User.program))
    if role:
        stmt = stmt.where(User.role == role)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(User.email).like(like), func.lower(User.first_name).like(like),
                              func.lower(User.last_name).like(like)))
    return db.scalars(stmt.order_by(User.role, User.last_name)).all()


def _issue_token(db: Session, user: User, purpose: TokenPurpose) -> AccountLinkOut:
    s = get_settings()
    raw = new_token()
    ttl = timedelta(hours=s.activation_token_hours) if purpose == TokenPurpose.ACTIVATION else timedelta(minutes=s.reset_token_minutes)
    now = datetime.now(timezone.utc)
    # Invalida tokens anteriores del mismo propósito.
    for old in db.scalars(select(AccountToken).where(AccountToken.user_id == user.id, AccountToken.purpose == purpose,
                                                     AccountToken.used_at.is_(None))):
        old.used_at = now
    token = AccountToken(token_hash=hash_token(raw), user_id=user.id, purpose=purpose, expires_at=now + ttl)
    db.add(token)
    path = "activar" if purpose == TokenPurpose.ACTIVATION else "restablecer"
    link = f"{s.public_base_url}/{path}?token={raw}" if s.dev_links_enabled else None
    notice = ("Enlace de desarrollo: entrégalo por un canal institucional seguro. APACH no envía correos."
              if link else "Entorno de producción: el envío del enlace requiere configurar SMTP institucional (pendiente).")
    return AccountLinkOut(user=UserOut.model_validate(user), purpose=purpose.value, expires_at=token.expires_at,
                          dev_link=link, notice=notice)


@router.post("/users", response_model=AccountLinkOut, status_code=201)
def create_user(payload: UserCreateIn, admin: User = Admin, db: Session = Depends(get_db)):
    if payload.program_id is not None:
        _get(db, Program, payload.program_id, "Programa")
    user = User(email=normalize_email(payload.email), first_name=payload.first_name.strip(),
                last_name=payload.last_name.strip(), role=payload.role, program_id=payload.program_id, is_active=False)
    db.add(user)
    _commit(db, "Ya existe una cuenta con ese correo.")
    out = _issue_token(db, user, TokenPurpose.ACTIVATION)
    audit.record(db, admin, "user.create", "user", user.id, role=user.role.value)
    db.commit()
    return out


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdateIn, admin: User = Admin, db: Session = Depends(get_db)):
    user = _get(db, User, user_id, "Usuario")
    data = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and (data.get("is_active") is False or (data.get("role") and data["role"] != Role.ADMIN)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No puedes desactivar ni cambiar el rol de tu propia cuenta.")
    if "role" in data and data["role"] != user.role:
        has_links = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.student_id == user.id)) or \
            db.scalar(select(func.count()).select_from(TeacherAssignment).where(TeacherAssignment.teacher_id == user.id))
        if has_links:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Retira primero matrículas o asignaciones antes de cambiar el rol.")
        audit.record(db, admin, "user.role_change", "user", user.id, old=user.role.value, new=data["role"].value)
    for k, v in data.items():
        setattr(user, k, v)
    if data.get("is_active") is False:
        db.query(UserSession).filter(UserSession.user_id == user.id).delete()
        audit.record(db, admin, "user.deactivate", "user", user.id)
    elif data.get("is_active") is True:
        audit.record(db, admin, "user.reactivate", "user", user.id)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/activation-link", response_model=AccountLinkOut)
def activation_link(user_id: int, admin: User = Admin, db: Session = Depends(get_db)):
    user = _get(db, User, user_id, "Usuario")
    if user.password_hash:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="La cuenta ya fue activada; genera un enlace de restablecimiento.")
    out = _issue_token(db, user, TokenPurpose.ACTIVATION)
    audit.record(db, admin, "user.activation_link", "user", user.id)
    db.commit()
    return out


@router.post("/users/{user_id}/reset-link", response_model=AccountLinkOut)
def reset_link(user_id: int, admin: User = Admin, db: Session = Depends(get_db)):
    user = _get(db, User, user_id, "Usuario")
    if not user.password_hash:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="La cuenta aún no se activa; genera un enlace de activación.")
    out = _issue_token(db, user, TokenPurpose.RESET)
    audit.record(db, admin, "user.reset_link", "user", user.id)
    db.commit()
    return out


# ------------------------------------------------------------------ matrículas y asignaciones
def _membership_out(db: Session, mid: int, user: User, section: Section) -> MembershipOut:
    return MembershipOut(id=mid, user_id=user.id, user_name=user.full_name, user_email=user.email,
                         section_id=section.id, section_label=section_label(section))


@router.get("/enrollments", response_model=list[MembershipOut])
def list_enrollments(section_id: int | None = None, _: User = Admin, db: Session = Depends(get_db)):
    stmt = select(Enrollment).options(selectinload(Enrollment.student), selectinload(Enrollment.section))
    if section_id:
        stmt = stmt.where(Enrollment.section_id == section_id)
    return [_membership_out(db, e.id, e.student, e.section) for e in db.scalars(stmt.order_by(Enrollment.id)).all()]


@router.post("/enrollments", response_model=MembershipOut, status_code=201)
def create_enrollment(payload: EnrollmentIn, admin: User = Admin, db: Session = Depends(get_db)):
    student = _get(db, User, payload.student_id, "Estudiante")
    section = _get(db, Section, payload.section_id, "Sección")
    if student.role != Role.STUDENT:
        raise HTTPException(422, detail="Solo se matriculan cuentas de estudiante.")
    enrollment = Enrollment(student_id=student.id, section_id=section.id)
    db.add(enrollment)
    _commit(db, "El estudiante ya está matriculado en esa sección.")
    audit.record(db, admin, "enrollment.create", "enrollment", enrollment.id, student_id=student.id, section_id=section.id)
    db.commit()
    return _membership_out(db, enrollment.id, student, section)


@router.delete("/enrollments/{enrollment_id}", status_code=204)
def delete_enrollment(enrollment_id: int, admin: User = Admin, db: Session = Depends(get_db)):
    enrollment = _get(db, Enrollment, enrollment_id, "Matrícula")
    has_docs = db.scalar(select(func.count()).select_from(Document).where(
        Document.student_id == enrollment.student_id, Document.section_id == enrollment.section_id))
    if has_docs:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="El estudiante tiene documentos en esta sección; desactiva la cuenta en lugar de retirar la matrícula.")
    audit.record(db, admin, "enrollment.delete", "enrollment", enrollment.id,
                 student_id=enrollment.student_id, section_id=enrollment.section_id)
    db.delete(enrollment)
    db.commit()


@router.get("/assignments", response_model=list[MembershipOut])
def list_assignments(_: User = Admin, db: Session = Depends(get_db)):
    stmt = select(TeacherAssignment).options(selectinload(TeacherAssignment.teacher), selectinload(TeacherAssignment.section))
    return [_membership_out(db, a.id, a.teacher, a.section) for a in db.scalars(stmt.order_by(TeacherAssignment.id)).all()]


@router.post("/assignments", response_model=MembershipOut, status_code=201)
def create_assignment(payload: AssignmentIn, admin: User = Admin, db: Session = Depends(get_db)):
    teacher = _get(db, User, payload.teacher_id, "Docente")
    section = _get(db, Section, payload.section_id, "Sección")
    if teacher.role != Role.TEACHER:
        raise HTTPException(422, detail="Solo se asignan cuentas docentes.")
    assignment = TeacherAssignment(teacher_id=teacher.id, section_id=section.id)
    db.add(assignment)
    _commit(db, "El docente ya está asignado a esa sección.")
    audit.record(db, admin, "assignment.create", "assignment", assignment.id, teacher_id=teacher.id, section_id=section.id)
    db.commit()
    return _membership_out(db, assignment.id, teacher, section)


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, admin: User = Admin, db: Session = Depends(get_db)):
    assignment = _get(db, TeacherAssignment, assignment_id, "Asignación")
    audit.record(db, admin, "assignment.delete", "assignment", assignment.id,
                 teacher_id=assignment.teacher_id, section_id=assignment.section_id)
    db.delete(assignment)
    db.commit()


# ------------------------------------------------------------------ CSV
@router.post("/imports/preview")
async def csv_preview(file: UploadFile = File(...), admin: User = Admin, db: Session = Depends(get_db)):
    data = await file.read(csv_import.MAX_BYTES + 1)
    try:
        rows = csv_import.parse_csv(data)
    except csv_import.CsvFormatError as exc:
        raise HTTPException(422, detail=str(exc)) from exc
    validated = csv_import.validate_rows(db, rows)
    batch = CsvImportBatch(created_by_id=admin.id, filename=(file.filename or "import.csv")[:255], rows=validated,
                           report={"preview": csv_import.summarize(validated)})
    db.add(batch)
    db.commit()
    return {"batch_id": batch.id, "summary": batch.report["preview"], "rows": validated}


@router.post("/imports/{batch_id}/confirm")
def csv_confirm(batch_id: int, admin: User = Admin, db: Session = Depends(get_db)):
    batch = _get(db, CsvImportBatch, batch_id, "Lote de importación")
    if batch.status != "PREVIEW":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Este lote ya fue importado.")
    # Se revalida contra el estado actual de la base para evitar importar datos desactualizados.
    current = []
    for r in batch.rows:
        if r["action"] == "ERROR":
            current.append(r)
            continue
        exists_user = db.scalars(select(User).where(User.email == r["email"])).first()
        if exists_user is not None and exists_user.role != Role.STUDENT:
            current.append({**r, "action": "ERROR", "errors": ["El correo pertenece a una cuenta que no es de estudiante."]})
        else:
            current.append(r)
    report, created = csv_import.apply_rows(db, current)
    links = [_issue_token(db, u, TokenPurpose.ACTIVATION) for u in created]
    batch.status = "IMPORTED"
    batch.imported_at = datetime.now(timezone.utc)
    batch.report = {**batch.report, "result": report}
    audit.record(db, admin, "csv.import", "csv_batch", batch.id, **report)
    db.commit()
    return {"batch_id": batch.id, "result": report,
            "activation_links": [{"email": link.user.email, "dev_link": link.dev_link} for link in links],
            "notice": links[0].notice if links else None}


@router.get("/imports")
def list_imports(_: User = Admin, db: Session = Depends(get_db)):
    batches = db.scalars(select(CsvImportBatch).order_by(CsvImportBatch.id.desc()).limit(50)).all()
    return [{"id": b.id, "filename": b.filename, "status": b.status, "report": b.report, "created_at": b.created_at,
             "imported_at": b.imported_at} for b in batches]


# ------------------------------------------------------------------ plantillas
@router.get("/templates", response_model=list[TemplateOut])
def list_templates(_: User = Admin, db: Session = Depends(get_db)):
    stmt = select(TemplateLink).options(selectinload(TemplateLink.program), selectinload(TemplateLink.updated_by))
    return [template_out(t) for t in db.scalars(stmt.order_by(TemplateLink.name)).all()]


@router.post("/templates", response_model=TemplateOut, status_code=201)
def create_template(payload: TemplateIn, admin: User = Admin, db: Session = Depends(get_db)):
    if payload.program_id is not None:
        _get(db, Program, payload.program_id, "Programa")
    template = TemplateLink(**{**payload.model_dump(), "url": str(payload.url)}, updated_by_id=admin.id)
    db.add(template)
    db.flush()
    audit.record(db, admin, "template.create", "template", template.id)
    db.commit()
    db.refresh(template)
    return template_out(template)


@router.put("/templates/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, payload: TemplateIn, admin: User = Admin, db: Session = Depends(get_db)):
    template = _get(db, TemplateLink, template_id, "Plantilla")
    for k, v in {**payload.model_dump(), "url": str(payload.url)}.items():
        setattr(template, k, v)
    template.updated_by_id = admin.id
    audit.record(db, admin, "template.update", "template", template.id)
    db.commit()
    db.refresh(template)
    return template_out(template)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, admin: User = Admin, db: Session = Depends(get_db)):
    template = _get(db, TemplateLink, template_id, "Plantilla")
    audit.record(db, admin, "template.delete", "template", template.id, name=template.name)
    db.delete(template)
    db.commit()


# ------------------------------------------------------------------ reglas
@router.get("/rules", response_model=list[RuleOut])
def list_rules(_: User = Admin, db: Session = Depends(get_db)):
    return db.scalars(select(ApaRule).order_by(ApaRule.scope, ApaRule.code)).all()


@router.post("/rules", response_model=RuleOut, status_code=201)
def create_ecc_rule(payload: RuleCreateIn, admin: User = Admin, db: Session = Depends(get_db)):
    """Solo metadatos de reglas ECC: quedan deshabilitadas y sin implementación hasta programarlas y probarlas."""
    rule = ApaRule(**payload.model_dump(), scope=RuleScope.ECC, enabled=False, implemented=False)
    db.add(rule)
    _commit(db, "Ya existe una regla con ese código.")
    audit.record(db, admin, "rule.create", "rule", rule.code)
    db.commit()
    return rule


@router.patch("/rules/{rule_id}", response_model=RuleOut)
def update_rule(rule_id: int, payload: RuleUpdateIn, admin: User = Admin, db: Session = Depends(get_db)):
    rule = _get(db, ApaRule, rule_id, "Regla")
    data = payload.model_dump(exclude_unset=True)
    if data.get("enabled") and not rule.implemented:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="No se puede habilitar una regla sin comprobación programada y probada.")
    if rule.scope == RuleScope.GENERAL:
        data = {k: v for k, v in data.items() if k == "enabled"}  # metadatos generales provienen del código
    for k, v in data.items():
        setattr(rule, k, v)
    audit.record(db, admin, "rule.update", "rule", rule.code, **{k: str(v) for k, v in data.items()})
    db.commit()
    return rule


# ------------------------------------------------------------------ ajustes
@router.get("/settings")
def get_admin_settings(_: User = Admin, db: Session = Depends(get_db)):
    return read_settings(db)


@router.put("/settings")
def put_settings(payload: SettingsIn, admin: User = Admin, db: Session = Depends(get_db)):
    for key, value in payload.model_dump(exclude_unset=True).items():
        row = db.get(SystemSetting, key)
        if row is None:
            db.add(SystemSetting(key=key, value={"value": value}))
        else:
            row.value = {"value": value}
    audit.record(db, admin, "settings.update", "settings", None, keys=list(payload.model_dump(exclude_unset=True)))
    db.commit()
    return read_settings(db)


# ------------------------------------------------------------------ reportes y auditoría
@router.get("/reports/summary")
def report_summary(term_id: int | None = None, program_id: int | None = None, section_id: int | None = None,
                   admin: User = Admin, db: Session = Depends(get_db)):
    stmt = select(Document).join(Section, Section.id == Document.section_id).join(Course, Course.id == Section.course_id)
    if term_id:
        stmt = stmt.where(Section.term_id == term_id)
    if program_id:
        stmt = stmt.where(Course.program_id == program_id)
    if section_id:
        stmt = stmt.where(Section.id == section_id)
    docs = db.scalars(stmt).all()
    by_rule: dict[str, Counter] = {}
    status_counter: Counter = Counter()
    for d in docs:
        status_counter[d.status.value] += 1
        run = latest_run(db, d.id)
        if run is None:
            continue
        for f in run.findings:
            bucket = by_rule.setdefault(f.rule_code, Counter())
            if f.verification_status.value != "CHECKED":
                bucket["not_verifiable"] += 1
            elif f.severity.value == "ERROR":
                bucket["verified_errors"] += 1
            else:
                bucket["possible_or_teacher"] += 1
    generated_at = datetime.now(timezone.utc)
    scope = {"term_id": term_id, "program_id": program_id, "section_id": section_id}
    audit.record(db, admin, "report.generate", "report", None, **{k: v for k, v in scope.items() if v})
    db.commit()
    return {
        "generated_at": generated_at,
        "scope": scope,
        "documents": len(docs),
        "students_with_documents": len({d.student_id for d in docs}),
        "documents_by_status": dict(status_counter),
        "findings_by_rule": [{"rule_code": k, **{x: v.get(x, 0) for x in ("verified_errors", "possible_or_teacher", "not_verifiable")}}
                             for k, v in sorted(by_rule.items())],
        "users": {r.value: db.scalar(select(func.count()).select_from(User).where(User.role == r)) for r in Role},
        "disclaimer": "Datos agregados orientativos; no constituyen evaluación académica.",
    }


@router.get("/audit")
def audit_log(limit: int = 100, _: User = Admin, db: Session = Depends(get_db)):
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(min(limit, 500))).all()
    names = {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_({e.actor_id for e in events if e.actor_id})))}
    return [{"id": e.id, "actor": names.get(e.actor_id), "action": e.action, "entity_type": e.entity_type,
             "entity_id": e.entity_id, "details": e.details, "created_at": e.created_at} for e in events]
