from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, not_found, require_roles
from app.core.config import get_settings
from app.core.db import get_db
from app.models import (
    AnalysisRun,
    Document,
    ReviewStatus,
    Role,
    RunStatus,
    Section,
    TeacherComment,
    User,
)
from app.schemas import (
    AnalysisOut,
    CommentIn,
    CommentOut,
    DocumentOut,
    FindingOut,
    ReviewStatusIn,
    RunListItem,
)
from app.services import access, audit, storage
from app.services.analysis import run_analysis
from app.services.upload_validation import UploadError, validate_docx

router = APIRouter(prefix="/documents", tags=["documents"])


def section_label(section: Section) -> str:
    return f"{section.course.code} · {section.course.name} · Sección {section.code} ({section.term.code})"


def latest_run(db: Session, document_id: int) -> AnalysisRun | None:
    return db.scalars(select(AnalysisRun).where(AnalysisRun.document_id == document_id)
                      .order_by(AnalysisRun.id.desc()).limit(1)).first()


def to_document_out(db: Session, d: Document) -> DocumentOut:
    run = latest_run(db, d.id)
    comments = db.scalar(select(func.count()).select_from(TeacherComment).where(TeacherComment.document_id == d.id))
    return DocumentOut(
        id=d.id, original_filename=d.original_filename, size_bytes=d.size_bytes, sha256=d.sha256,
        status=d.status.value, review_status=d.review_status.value, created_at=d.created_at, updated_at=d.updated_at,
        section_id=d.section_id, section_label=section_label(d.section), student_id=d.student_id,
        student_name=d.student.full_name,
        latest_counts=(run.summary or {}).get("counts") if run and run.status == RunStatus.COMPLETED else None,
        comment_count=comments or 0,
    )


def _get_document(db: Session, user: User, document_id: int) -> Document:
    doc = access.get_document_for(db, user, document_id)
    if doc is None:
        raise not_found("Documento")
    return doc


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    section_id: int = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_roles(Role.STUDENT)),
    db: Session = Depends(get_db),
):
    if not access.is_enrolled(db, user.id, section_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No estás matriculado en esa sección.")
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    try:
        validated = validate_docx(file.filename, file.content_type, data)
    except UploadError as exc:
        code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if exc.code == "file_too_large" else 422
        raise HTTPException(code, detail={"code": exc.code, "message": exc.message}) from exc
    doc = Document(student_id=user.id, section_id=section_id, original_filename=validated.filename,
                   mime_type=validated.mime_type, size_bytes=len(validated.data), sha256=validated.sha256)
    db.add(doc)
    db.flush()
    storage.save(doc.storage_key, validated.data)
    audit.record(db, user, "document.upload", "document", doc.id, sha256=validated.sha256)
    db.commit()
    db.refresh(doc)
    return to_document_out(db, doc)


@router.get("", response_model=list[DocumentOut])
def list_documents(section_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = access.scope_documents(select(Document), user).options(
        selectinload(Document.section).selectinload(Section.course), selectinload(Document.student))
    if section_id is not None:
        stmt = stmt.where(Document.section_id == section_id)
    docs = db.scalars(stmt.order_by(Document.created_at.desc())).all()
    return [to_document_out(db, d) for d in docs]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return to_document_out(db, _get_document(db, user, document_id))


@router.get("/{document_id}/download")
def download_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    path = storage.path_for(doc.storage_key)
    if not path.exists():
        raise not_found("Archivo")
    if user.role == Role.ADMIN:
        audit.record(db, user, "document.download_admin", "document", doc.id)
        db.commit()
    return FileResponse(path, media_type=doc.mime_type, filename=doc.original_filename,
                        headers={"Cache-Control": "no-store"})


@router.post("/{document_id}/analyze", response_model=AnalysisOut)
def analyze_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    if user.role == Role.TEACHER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="El análisis lo solicita el estudiante o la administración.")
    run = run_analysis(db, doc)
    audit.record(db, user, "document.analyze", "document", doc.id, run_id=run.id, status=run.status.value)
    db.commit()
    return _analysis_out(db, run)


def _analysis_out(db: Session, run: AnalysisRun) -> AnalysisOut:
    run = db.scalars(select(AnalysisRun).where(AnalysisRun.id == run.id).options(selectinload(AnalysisRun.findings))).one()
    return AnalysisOut(run_id=run.id, document_id=run.document_id, status=run.status.value,
                       rule_set_version=run.rule_set_version, started_at=run.started_at, finished_at=run.finished_at,
                       error_message=run.error_message, summary=run.summary or {},
                       findings=[FindingOut.model_validate(f) for f in run.findings])


@router.get("/{document_id}/analysis", response_model=AnalysisOut)
def get_analysis(document_id: int, run_id: int | None = None, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    if run_id is None:
        run = latest_run(db, doc.id)
    else:
        run = db.scalars(select(AnalysisRun).where(AnalysisRun.id == run_id, AnalysisRun.document_id == doc.id)).first()
    if run is None:
        raise not_found("Análisis")
    return _analysis_out(db, run)


@router.get("/{document_id}/runs", response_model=list[RunListItem])
def list_runs(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    runs = db.scalars(select(AnalysisRun).where(AnalysisRun.document_id == doc.id).order_by(AnalysisRun.id.desc())).all()
    return [RunListItem(id=r.id, status=r.status.value, rule_set_version=r.rule_set_version, started_at=r.started_at,
                        counts=(r.summary or {}).get("counts")) for r in runs]


# ------------------------------------------------------------------ comentarios docentes
def _comment_out(c: TeacherComment) -> CommentOut:
    return CommentOut(id=c.id, document_id=c.document_id, teacher_id=c.teacher_id, teacher_name=c.teacher.full_name,
                      body=c.body, created_at=c.created_at, updated_at=c.updated_at)


@router.get("/{document_id}/comments", response_model=list[CommentOut])
def list_comments(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    comments = db.scalars(select(TeacherComment).where(TeacherComment.document_id == doc.id)
                          .order_by(TeacherComment.created_at)).all()
    return [_comment_out(c) for c in comments]


@router.post("/{document_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(document_id: int, payload: CommentIn, user: User = Depends(require_roles(Role.TEACHER)),
                db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)  # filtra por secciones asignadas
    comment = TeacherComment(document_id=doc.id, teacher_id=user.id, body=payload.body.strip())
    db.add(comment)
    audit.record(db, user, "comment.create", "document", doc.id)
    db.commit()
    db.refresh(comment)
    return _comment_out(comment)


@router.patch("/{document_id}/comments/{comment_id}", response_model=CommentOut)
def edit_comment(document_id: int, comment_id: int, payload: CommentIn, user: User = Depends(require_roles(Role.TEACHER)),
                 db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    comment = db.scalars(select(TeacherComment).where(TeacherComment.id == comment_id, TeacherComment.document_id == doc.id,
                                                      TeacherComment.teacher_id == user.id)).first()
    if comment is None:
        raise not_found("Comentario")
    comment.body = payload.body.strip()
    db.commit()
    db.refresh(comment)
    return _comment_out(comment)


@router.delete("/{document_id}/comments/{comment_id}", status_code=204)
def delete_comment(document_id: int, comment_id: int, user: User = Depends(require_roles(Role.TEACHER)),
                   db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    comment = db.scalars(select(TeacherComment).where(TeacherComment.id == comment_id, TeacherComment.document_id == doc.id,
                                                      TeacherComment.teacher_id == user.id)).first()
    if comment is None:
        raise not_found("Comentario")
    db.delete(comment)
    audit.record(db, user, "comment.delete", "document", doc.id)
    db.commit()


@router.patch("/{document_id}/review-status", response_model=DocumentOut)
def set_review_status(document_id: int, payload: ReviewStatusIn, user: User = Depends(require_roles(Role.TEACHER)),
                      db: Session = Depends(get_db)):
    doc = _get_document(db, user, document_id)
    doc.review_status = ReviewStatus(payload.review_status)
    audit.record(db, user, "document.review_status", "document", doc.id, value=payload.review_status)
    db.commit()
    db.refresh(doc)
    return to_document_out(db, doc)
