"""Pruebas del motor APA con DOCX reales generados (correcto / violación / ambiguo por regla)."""
from pathlib import Path

import pytest
from docx import Document
from docx.shared import Inches, Pt

from app.apa_engine.citations import citation_matches, find_citations, parse_reference
from app.apa_engine.engine import analyze_docx
from app.apa_engine.extractor import extract_docx
from tests.fixtures.builder import Spec, build, compliant


def outcomes(result) -> dict[str, str]:
    return {r.code: r.outcome for r in result.rule_results}


def codes(result, severity=None) -> set[str]:
    return {f.rule_code for f in result.findings if severity is None or f.severity == severity}


def test_compliant_document_passes_all_rules(docx_fixtures):
    result = analyze_docx(docx_fixtures["compliant.docx"])
    assert result.findings == []
    assert set(outcomes(result).values()) == {"PASSED"}
    assert result.summary["document"]["references_reliable"] is True
    assert result.summary["document"]["citations_detected"] == 5


def test_violations_document_produces_verified_errors(docx_fixtures):
    result = analyze_docx(docx_fixtures["violations.docx"])
    errors = codes(result, "ERROR")
    assert {"APA-01", "APA-02", "APA-03", "APA-04", "APA-06", "APA-07", "APA-10"} <= errors
    assert "APA-08" in codes(result, "POSSIBLE_PROBLEM")  # cita sin referencia: heurística, nunca ERROR
    assert "APA-09" in codes(result, "POSSIBLE_PROBLEM")
    margin = next(f for f in result.findings if f.rule_code == "APA-01")
    assert margin.evidence["margins_cm"]["left"] == 3.5


def test_ambiguous_document_never_reports_errors(docx_fixtures):
    result = analyze_docx(docx_fixtures["ambiguous.docx"])
    assert codes(result, "ERROR") == set()
    oc = outcomes(result)
    assert oc["APA-06"] == "NOT_VERIFIABLE" and oc["APA-07"] == "NOT_VERIFIABLE"
    spacing = [f for f in result.findings if f.rule_code == "APA-03"]
    assert spacing and all(f.verification_status == "NOT_VERIFIABLE" for f in spacing)
    font = next(f for f in result.findings if f.rule_code == "APA-02")
    assert font.severity == "NEEDS_TEACHER"
    assert any(f.rule_code == "APA-05" and "Bibliografía" in f.message for f in result.findings)


def test_missing_reference_list_is_reported(docx_fixtures):
    result = analyze_docx(docx_fixtures["no_references.docx"])
    assert "APA-05" in codes(result, "ERROR")
    assert outcomes(result)["APA-08"] == "NOT_VERIFIABLE"


def test_analysis_is_deterministic(docx_fixtures):
    a = analyze_docx(docx_fixtures["demo_trabajo_nodos.docx"])
    b = analyze_docx(docx_fixtures["demo_trabajo_nodos.docx"])
    assert [(f.rule_code, f.message, f.evidence, f.location) for f in a.findings] == \
           [(f.rule_code, f.message, f.evidence, f.location) for f in b.findings]


def test_unverified_findings_never_count_as_errors(docx_fixtures):
    for path in docx_fixtures.values():
        result = analyze_docx(path)
        for f in result.findings:
            if f.severity == "ERROR":
                assert f.verification_status == "CHECKED"
        assert result.summary["counts"]["errors"] == sum(1 for f in result.findings if f.severity == "ERROR")


def test_findings_have_guide_and_location(docx_fixtures):
    result = analyze_docx(docx_fixtures["violations.docx"])
    for f in result.findings:
        assert f.guide_slug
        assert "page" not in f.location  # nunca se inventa número de página


def test_enabled_rule_filter(docx_fixtures):
    result = analyze_docx(docx_fixtures["violations.docx"], enabled_codes={"APA-01"})
    assert {r.code for r in result.rule_results} == {"APA-01"}


# ------------------------------------------------------------------ casos por regla específicos
def test_style_inheritance_resolves_spacing_and_font(tmp_path: Path):
    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = "Georgia"
    normal.font.size = Pt(11)
    normal.paragraph_format.line_spacing = 2.0
    p = doc.add_paragraph("Texto heredado del estilo Normal sin formato directo en el párrafo.")
    p.paragraph_format.first_line_indent = Inches(0.5)
    path = tmp_path / "inherit.docx"
    doc.save(path)
    info = next(x for x in extract_docx(path).paragraphs if x.text.startswith("Texto"))
    assert info.line == 480 and info.line_rule in (None, "auto")
    assert info.runs[0].font == "Georgia" and info.runs[0].size_pt == 11


def test_theme_font_is_resolved(tmp_path: Path):
    doc = Document()  # la plantilla de python-docx usa fuentes del tema
    doc.add_paragraph("Texto con fuente del tema.")
    path = tmp_path / "theme.docx"
    doc.save(path)
    run = extract_docx(path).paragraphs[0].runs[0]
    assert run.font and run.font_assumed is False


def test_wrong_first_line_indent_size(tmp_path: Path):
    spec = compliant()
    spec.body_indent_in = 1.0
    result = analyze_docx(build(spec, tmp_path / "indent.docx"))
    f = next(f for f in result.findings if f.rule_code == "APA-04")
    assert f.severity == "ERROR" and f.evidence["examples"][0]["first_line_cm"] == 2.54


def test_block_quote_with_quotation_marks_and_short(tmp_path: Path):
    spec = compliant()
    spec.block_quote = "“Una cita breve en bloque con comillas.” (Castro, 2019, p. 3)."
    result = analyze_docx(build(spec, tmp_path / "bq.docx"))
    msgs = [f.message for f in result.findings if f.rule_code == "APA-10"]
    assert any("menos de 40" in m for m in msgs) and any("comillas" in m for m in msgs)


def test_same_author_year_order(tmp_path: Path):
    spec = Spec(body=["Texto con citas de Castro (2021) y luego Castro (2019) para comparar fuentes del mismo autor en clase."],
                references=["Castro, L. (2021). *Obra posterior*. Editorial Ficticia.", "Castro, L. (2019). *Obra anterior*. Editorial Ficticia."])
    result = analyze_docx(build(spec, tmp_path / "order.docx"))
    f = next(f for f in result.findings if f.rule_code == "APA-07")
    assert f.severity == "POSSIBLE_PROBLEM" and "2019" in f.message


def test_nothing_precedes_something_order(tmp_path: Path):
    spec = Spec(body=["Comparación entre Pérez (2018) y Pérez García (2016) en estudios ficticios sobre medios universitarios."],
                references=["Pérez, Z. (2018). *Uno*. Editorial Ficticia.", "Pérez García, A. (2016). *Dos*. Editorial Ficticia."])
    result = analyze_docx(build(spec, tmp_path / "nps.docx"))
    assert not [f for f in result.findings if f.rule_code == "APA-07"]


class P:
    def __init__(self, index, text):
        self.index, self.text = index, text


@pytest.mark.parametrize("text,expected", [
    ("Según Pérez y López (2020) el aprendizaje mejora.", [("Pérez y López", "2020", "narrative")]),
    ("Se ha demostrado (Ramírez, 2019; Soto, s. f.).", [("Ramírez", "2019", "parenthetical"), ("Soto", "s.f.", "parenthetical")]),
    ("Gómez et al. (2018, p. 12) lo describen.", [("Gómez et al.", "2018", "narrative")]),
    ("En el año (1995) hubo cambios.", []),
    ("La muestra fue grande (n = 300).", []),
])
def test_citation_detection(text, expected):
    found = [(c.authors, c.year, c.kind) for c in find_citations([P(0, text)])]
    assert found == expected


def test_group_author_with_abbreviation_matches():
    ref = parse_reference(0, "Organización Ficticia para la Educación [OFE]. (2022). *Informe*. https://ofe.example.org")
    cit = find_citations([P(1, "Los datos lo confirman (OFE, 2022).")])[0]
    assert ref.title_first is False and citation_matches(cit, ref)


def test_year_mismatch_does_not_match():
    ref = parse_reference(0, "Castro, L. (2019). *Medios*. Editorial Ficticia.")
    cit = find_citations([P(1, "Como dice Castro (2020), algo.")])[0]
    assert not citation_matches(cit, ref)
