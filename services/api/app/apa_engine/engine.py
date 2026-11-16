"""Orquestador del análisis. Determinista: mismo archivo + misma versión + mismas reglas => misma salida."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from app.apa_engine.extractor import extract_docx
from app.apa_engine.rules import RULES, Finding, RuleResult, build_context

RULE_SET_VERSION = "apa7-general-2026.11.1"


@dataclass
class AnalysisResult:
    rule_set_version: str
    findings: list[Finding]
    rule_results: list[RuleResult]
    summary: dict


def _sanitize(f: Finding) -> Finding:
    # Garantía central: un hallazgo no verificado nunca cuenta como ERROR.
    if f.severity == "ERROR" and f.verification_status != "CHECKED":
        f.severity = "POSSIBLE_PROBLEM"
    return f


def analyze_docx(path: Path | str, enabled_codes: set[str] | None = None) -> AnalysisResult:
    doc = extract_docx(path)
    ctx = build_context(doc)
    results: list[RuleResult] = []
    findings: list[Finding] = []
    for spec in RULES:
        if enabled_codes is not None and spec.code not in enabled_codes:
            continue
        result = spec.check(ctx)
        result.findings = [_sanitize(f) for f in result.findings]
        results.append(result)
        findings.extend(result.findings)

    counts = {
        "errors": sum(1 for f in findings if f.severity == "ERROR" and f.verification_status == "CHECKED"),
        "possible_problems": sum(1 for f in findings if f.severity == "POSSIBLE_PROBLEM"),
        "needs_teacher": sum(1 for f in findings if f.severity == "NEEDS_TEACHER"),
        "not_verifiable": sum(1 for f in findings if f.verification_status == "NOT_VERIFIABLE"),
    }
    refs = ctx.structure.references
    summary = {
        "counts": counts,
        "rules": [{"code": r.code, "outcome": r.outcome, "checked_items": r.checked_items, "findings": len(r.findings), "note": r.note}
                  for r in results],
        "document": {
            "paragraphs": len(doc.paragraphs),
            "non_empty_paragraphs": len(doc.body_paragraphs),
            "words": sum(p.word_count for p in doc.body_paragraphs),
            "sections": len(doc.sections),
            "tables": doc.table_count,
            "front_matter_detected": ctx.structure.front_matter_end is not None,
            "references_heading_found": refs.heading is not None,
            "references_reliable": refs.reliable,
            "reference_entries": len(ctx.references),
            "citations_detected": len(ctx.citations),
        },
        "limitations": [
            "No se calcula la paginación: las ubicaciones se expresan por párrafo, no por página.",
            "La detección de citas y referencias es heurística; sus hallazgos son «posibles problemas».",
            "No se evalúan portada, encabezados de página, tablas/figuras ni criterios institucionales ECC.",
        ],
    }
    return AnalysisResult(RULE_SET_VERSION, findings, results, summary)


def finding_to_dict(f: Finding) -> dict:
    return asdict(f)
