from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.apa_engine.engine import RULE_SET_VERSION, analyze_docx
from app.apa_engine.rules import RULES
from app.models import (
    AnalysisFinding,
    AnalysisRun,
    ApaRule,
    Document,
    DocumentStatus,
    RuleScope,
    RunStatus,
)
from app.services import storage


def sync_rule_registry(db: Session) -> None:
    """Registra en `apa_rules` las reglas programadas. No reactiva reglas que un ADMIN desactivó."""
    existing = {r.code: r for r in db.scalars(select(ApaRule))}
    for spec in RULES:
        rule = existing.get(spec.code)
        if rule is None:
            db.add(ApaRule(code=spec.code, name=spec.name, description=spec.description, scope=RuleScope.GENERAL,
                           version=RULE_SET_VERSION, enabled=True, implemented=True, guide_slug=spec.guide_slug,
                           source="APA (2020). Publication Manual of the American Psychological Association (7.ª ed.)."))
        else:
            rule.name, rule.description, rule.guide_slug = spec.name, spec.description, spec.guide_slug
            rule.version, rule.implemented = RULE_SET_VERSION, True
    db.commit()


def enabled_rule_codes(db: Session) -> set[str]:
    return set(db.scalars(select(ApaRule.code).where(
        ApaRule.enabled.is_(True), ApaRule.implemented.is_(True), ApaRule.scope == RuleScope.GENERAL)))


def run_analysis(db: Session, document: Document) -> AnalysisRun:
    enabled = enabled_rule_codes(db)
    run = AnalysisRun(document_id=document.id, rule_set_version=RULE_SET_VERSION, status=RunStatus.RUNNING)
    document.status = DocumentStatus.ANALYZING
    db.add(run)
    db.commit()
    try:
        result = analyze_docx(storage.path_for(document.storage_key), enabled)
    except Exception as exc:  # el documento original se conserva; se registra el fallo
        run.status = RunStatus.FAILED
        run.error_message = f"No se pudo analizar el documento: {type(exc).__name__}"
        run.finished_at = datetime.now(timezone.utc)
        document.status = DocumentStatus.FAILED
        db.commit()
        return run
    for f in result.findings:
        run.findings.append(AnalysisFinding(
            rule_code=f.rule_code, severity=f.severity, verification_status=f.verification_status, message=f.message,
            evidence=f.evidence, location=f.location, suggestion=f.suggestion, guide_slug=f.guide_slug,
            rule_set_version=result.rule_set_version))
    run.summary = {**result.summary, "enabled_rules": sorted(enabled)}
    run.status = RunStatus.COMPLETED
    run.finished_at = datetime.now(timezone.utc)
    document.status = DocumentStatus.ANALYZED
    db.commit()
    return run
