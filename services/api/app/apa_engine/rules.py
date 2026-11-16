"""Reglas APA 7 deterministas. Cada regla devuelve un resultado y hallazgos con evidencia medida.

Criterio de severidad (docs/04-MOTOR-APA.md):
  ERROR            -> solo si la propiedad se midió (CHECKED) y contradice APA 7 sin ambigüedad.
  POSSIBLE_PROBLEM -> heurística o desviación que admite excepciones.
  NEEDS_TEACHER    -> requiere criterio humano (p. ej. fuente no listada, estructura ambigua).
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

from app.apa_engine.citations import (
    Citation,
    ReferenceEntry,
    citation_matches,
    find_citations,
    parse_reference,
)
from app.apa_engine.extractor import ExtractedDocument, ParagraphInfo, twips_to_cm
from app.apa_engine.structure import (
    HALF_INCH,
    INDENT_TOLERANCE,
    DocumentStructure,
    Role,
    analyze_structure,
)
from app.apa_engine.text_utils import norm_token

ERROR, POSSIBLE, TEACHER = "ERROR", "POSSIBLE_PROBLEM", "NEEDS_TEACHER"
CHECKED, NOT_VERIFIABLE, NOT_APPLICABLE = "CHECKED", "NOT_VERIFIABLE", "NOT_APPLICABLE"
MAX_EXAMPLES = 25

ONE_INCH = 1440
MARGIN_TOLERANCE = 36  # twips (~0.06 cm)

# APA 7, sección 2.19: combinaciones recomendadas de fuente y tamaño.
RECOMMENDED_FONTS = {
    "calibri": 11,
    "arial": 11,
    "lucida sans unicode": 10,
    "times new roman": 12,
    "georgia": 11,
    "computer modern": 10,
}

TEXT_ROLES = {Role.FRONT, Role.HEADING, Role.ABSTRACT, Role.BODY, Role.BLOCK_QUOTE, Role.REFERENCES_HEADING,
              Role.REFERENCE_ENTRY, Role.CAPTION, Role.LIST, Role.CENTERED}
CITATION_ROLES = {Role.BODY, Role.BLOCK_QUOTE, Role.ABSTRACT, Role.LIST, Role.CAPTION, Role.NOTE, Role.CENTERED}


@dataclass
class Finding:
    rule_code: str
    severity: str
    verification_status: str
    message: str
    suggestion: str
    guide_slug: str
    evidence: dict = field(default_factory=dict)
    location: dict = field(default_factory=dict)


@dataclass
class RuleResult:
    code: str
    outcome: str  # PASSED | FINDINGS | NOT_APPLICABLE | NOT_VERIFIABLE
    checked_items: int
    findings: list[Finding] = field(default_factory=list)
    note: str = ""


@dataclass
class Context:
    doc: ExtractedDocument
    structure: DocumentStructure
    citations: list[Citation]
    references: list[ReferenceEntry]

    def paragraphs(self, *roles: Role) -> list[ParagraphInfo]:
        return self.structure.with_role(self.doc, *roles)


def build_context(doc: ExtractedDocument) -> Context:
    structure = analyze_structure(doc)
    citations = find_citations(structure.with_role(doc, *CITATION_ROLES))
    ref_paragraphs = structure.references.entries or structure.loose_reference_like
    references = [parse_reference(p.index, p.text) for p in ref_paragraphs]
    return Context(doc=doc, structure=structure, citations=citations, references=references)


def _loc(p: ParagraphInfo, ctx: Context | None = None) -> dict:
    loc = {"paragraph_index": p.index, "section_index": p.section_index, "excerpt": p.excerpt()}
    if ctx is not None:
        loc["region"] = ctx.structure.roles.get(p.index, Role.BODY).value
    return loc


def _examples(items: list[tuple[ParagraphInfo, dict]]) -> list[dict]:
    return [{"paragraph_index": p.index, "excerpt": p.excerpt(90), **extra} for p, extra in items[:MAX_EXAMPLES]]


def _result(code: str, checked: int, findings: list[Finding], *, empty_outcome: str = "PASSED", note: str = "") -> RuleResult:
    if findings:
        outcome = "FINDINGS"
    else:
        outcome = empty_outcome if checked == 0 and empty_outcome != "PASSED" else ("PASSED" if checked else "NOT_APPLICABLE")
    return RuleResult(code=code, outcome=outcome, checked_items=checked, findings=findings, note=note)


# ---------------------------------------------------------------- APA-01 Márgenes
def rule_margins(ctx: Context) -> RuleResult:
    findings: list[Finding] = []
    for s in ctx.doc.sections:
        values = s.margins_twips
        if any(v is None for v in values.values()):
            findings.append(Finding("APA-01", TEACHER, NOT_VERIFIABLE,
                f"La sección {s.index + 1} no declara todos sus márgenes; dependen de la aplicación que abra el archivo.",
                "Configura márgenes explícitos de 2.54 cm (1 pulgada) en Diseño → Márgenes.", "margins",
                {"margins_cm": s.margins_cm}, {"section_index": s.index}))
            continue
        wrong = {k: twips_to_cm(v) for k, v in values.items() if abs(v - ONE_INCH) > MARGIN_TOLERANCE}
        if wrong:
            findings.append(Finding("APA-01", ERROR, CHECKED,
                f"Sección {s.index + 1}: márgenes distintos de 2.54 cm ({', '.join(f'{_side(k)} {v} cm' for k, v in wrong.items())}).",
                "En Word: Diseño de página → Márgenes → Normal (2.54 cm en los cuatro lados).", "margins",
                {"margins_cm": s.margins_cm, "expected_cm": 2.54, "tolerance_cm": 0.06}, {"section_index": s.index}))
        if s.gutter_twips:
            findings.append(Finding("APA-01", POSSIBLE, CHECKED,
                f"Sección {s.index + 1}: hay un margen de encuadernación de {twips_to_cm(s.gutter_twips)} cm que reduce el margen efectivo.",
                "Coloca el margen de encuadernación en 0 cm salvo indicación docente.", "margins",
                {"gutter_cm": twips_to_cm(s.gutter_twips)}, {"section_index": s.index}))
    distinct = {tuple(s.margins_twips.values()) for s in ctx.doc.sections}
    note = "Las secciones tienen márgenes diferentes entre sí." if len(distinct) > 1 else ""
    return _result("APA-01", len(ctx.doc.sections), findings, note=note)


def _side(key: str) -> str:
    return {"top": "superior", "bottom": "inferior", "left": "izquierdo", "right": "derecho"}[key]


# ---------------------------------------------------------------- APA-02 Fuente y tamaño
def rule_fonts(ctx: Context) -> RuleResult:
    combos: dict[tuple[str, float], dict] = defaultdict(lambda: {"chars": 0, "paragraphs": [], "assumed": False})
    total = 0
    paragraphs = ctx.paragraphs(*TEXT_ROLES)
    for p in paragraphs:
        for r in p.runs:
            n = len(r.text.strip())
            if not n:
                continue
            key = ((r.font or "?").strip(), r.size_pt or 0)
            c = combos[key]
            c["chars"] += n
            c["assumed"] = c["assumed"] or r.font_assumed or r.size_assumed
            if p.index not in c["paragraphs"]:
                c["paragraphs"].append(p.index)
            total += n
    findings: list[Finding] = []
    if not total:
        return _result("APA-02", 0, findings)
    distribution = [
        {"font": f, "size_pt": s, "share": round(c["chars"] / total, 3), "assumed": c["assumed"]}
        for (f, s), c in sorted(combos.items(), key=lambda kv: -kv[1]["chars"])
    ]
    for (font, size), c in sorted(combos.items(), key=lambda kv: -kv[1]["chars"]):
        share = round(c["chars"] / total, 3)
        first = ctx.doc.paragraphs[c["paragraphs"][0]]
        evidence = {"font": font, "size_pt": size, "share_of_text": share, "paragraphs": c["paragraphs"][:MAX_EXAMPLES],
                    "distribution": distribution}
        if c["assumed"]:
            findings.append(Finding("APA-02", TEACHER, NOT_VERIFIABLE,
                f"No se pudo determinar con certeza la fuente o el tamaño de parte del texto ({share:.0%}); el archivo no lo declara y depende del programa.",
                "Aplica explícitamente la fuente y el tamaño al estilo Normal.", "fonts", evidence, _loc(first, ctx)))
            continue
        recommended = RECOMMENDED_FONTS.get(font.lower())
        if size < 10 or size > 12:
            findings.append(Finding("APA-02", ERROR, CHECKED,
                f"Texto en {font} {size:g} pt ({share:.0%} del texto): ninguna combinación recomendada por APA 7 usa ese tamaño.",
                "Usa, por ejemplo, Times New Roman 12, Calibri 11, Arial 11 o Georgia 11.", "fonts", evidence, _loc(first, ctx)))
        elif recommended is None:
            findings.append(Finding("APA-02", TEACHER, CHECKED,
                f"La fuente «{font}» ({share:.0%} del texto) no figura entre las recomendadas por APA 7; puede aceptarse si tu docente lo autoriza.",
                "Opciones recomendadas: Times New Roman 12, Georgia 11, Calibri 11, Arial 11, Lucida Sans Unicode 10.", "fonts",
                evidence, _loc(first, ctx)))
        elif recommended != size:
            findings.append(Finding("APA-02", POSSIBLE, CHECKED,
                f"{font} aparece en {size:g} pt ({share:.0%} del texto); la combinación recomendada es {font} {recommended} pt.",
                f"Ajusta el tamaño a {recommended} pt para mantener la legibilidad prevista por APA 7.", "fonts", evidence, _loc(first, ctx)))
    body_fonts = {f for (f, _), c in combos.items() if c["chars"] / total > 0.05}
    if len(body_fonts) > 1:
        findings.append(Finding("APA-02", POSSIBLE, CHECKED,
            f"Se usan varias fuentes en proporción significativa: {', '.join(sorted(body_fonts))}.",
            "Usa una sola fuente en todo el trabajo (salvo figuras o código).", "fonts", {"distribution": distribution}, {}))
    return _result("APA-02", len(paragraphs), findings)


# ---------------------------------------------------------------- APA-03 Interlineado
def _spacing_label(line: int | None, rule: str | None) -> str:
    if line is None:
        return "no declarado"
    if rule in (None, "auto"):
        return f"{line / 240:.2f}".rstrip("0").rstrip(".")
    return f"{line / 20:g} pt ({'exacto' if rule == 'exact' else 'mínimo'})"


def rule_line_spacing(ctx: Context) -> RuleResult:
    paragraphs = ctx.paragraphs(*TEXT_ROLES)
    not_double, unverifiable, extra_space = [], [], []
    for p in paragraphs:
        if p.line is None:
            unverifiable.append((p, {"measured": "no declarado"}))
        elif p.line_rule not in (None, "auto"):
            unverifiable.append((p, {"measured": _spacing_label(p.line, p.line_rule)}))
        elif not 470 <= p.line <= 490:
            not_double.append((p, {"measured": _spacing_label(p.line, p.line_rule)}))
        if (p.space_after or 0) > 0 or (p.space_before or 0) > 0:
            extra_space.append((p, {"before_pt": (p.space_before or 0) / 20, "after_pt": (p.space_after or 0) / 20}))
    findings = []
    if not_double:
        measured = sorted({e["measured"] for _, e in not_double})
        findings.append(Finding("APA-03", ERROR, CHECKED,
            f"{len(not_double)} de {len(paragraphs)} párrafos no tienen interlineado doble (medido: {', '.join(measured)}).",
            "Selecciona todo el texto → Párrafo → Interlineado: Doble.", "line-spacing",
            {"count": len(not_double), "checked": len(paragraphs), "examples": _examples(not_double)}, _loc(not_double[0][0], ctx)))
    if unverifiable:
        findings.append(Finding("APA-03", TEACHER, NOT_VERIFIABLE,
            f"En {len(unverifiable)} párrafos el interlineado es fijo o no está declarado; no se puede confirmar que sea doble.",
            "Usa interlineado «Doble» (múltiple) en lugar de un valor fijo en puntos.", "line-spacing",
            {"count": len(unverifiable), "examples": _examples(unverifiable)}, _loc(unverifiable[0][0], ctx)))
    if extra_space:
        findings.append(Finding("APA-03", POSSIBLE, CHECKED,
            f"{len(extra_space)} párrafos tienen espacio adicional antes o después; APA 7 indica no añadir espacio extra entre párrafos.",
            "Párrafo → Espaciado: Anterior 0 pt y Posterior 0 pt.", "line-spacing",
            {"count": len(extra_space), "examples": _examples(extra_space)}, _loc(extra_space[0][0], ctx)))
    return _result("APA-03", len(paragraphs), findings)


# ---------------------------------------------------------------- APA-04 Sangría de primera línea
def rule_first_line_indent(ctx: Context) -> RuleResult:
    body = [p for p in ctx.paragraphs(Role.BODY) if p.word_count >= 15]
    prev_role: dict[int, Role] = {}
    last = None
    for p in ctx.doc.paragraphs:
        role = ctx.structure.roles.get(p.index)
        if role in (Role.EMPTY, None):
            continue
        prev_role[p.index] = last
        last = role
    missing, wrong_size, spaces, hanging = [], [], [], []
    checked = 0
    for p in body:
        if prev_role.get(p.index) == Role.BLOCK_QUOTE and p.text[:1].islower():
            continue  # continuación del párrafo tras una cita en bloque: no lleva sangría
        checked += 1
        if p.text.startswith("\t"):
            continue
        if re.match(r"^ {2,}", p.text):
            spaces.append((p, {}))
            continue
        first = p.ind_first_line or 0
        if (p.ind_hanging or 0) > 0:
            hanging.append((p, {"hanging_cm": twips_to_cm(p.ind_hanging)}))
        elif first == 0:
            missing.append((p, {"first_line_cm": 0}))
        elif abs(first - HALF_INCH) > INDENT_TOLERANCE:
            wrong_size.append((p, {"first_line_cm": twips_to_cm(first)}))
    findings = []
    if missing:
        findings.append(Finding("APA-04", ERROR, CHECKED,
            f"{len(missing)} párrafos del cuerpo no tienen sangría de primera línea.",
            "Párrafo → Sangría especial: Primera línea, 1.27 cm.", "paragraph-indentation",
            {"count": len(missing), "checked": checked, "expected_cm": 1.27, "examples": _examples(missing)}, _loc(missing[0][0], ctx)))
    if wrong_size:
        findings.append(Finding("APA-04", ERROR, CHECKED,
            f"{len(wrong_size)} párrafos tienen sangría de primera línea distinta de 1.27 cm.",
            "Ajusta la sangría de primera línea a 1.27 cm (0.5 pulgadas).", "paragraph-indentation",
            {"count": len(wrong_size), "expected_cm": 1.27, "examples": _examples(wrong_size)}, _loc(wrong_size[0][0], ctx)))
    if spaces:
        findings.append(Finding("APA-04", POSSIBLE, CHECKED,
            f"{len(spaces)} párrafos parecen sangrados con espacios en blanco.",
            "Elimina los espacios iniciales y usa la sangría de párrafo o la tecla Tab.", "paragraph-indentation",
            {"count": len(spaces), "examples": _examples(spaces)}, _loc(spaces[0][0], ctx)))
    if hanging:
        findings.append(Finding("APA-04", POSSIBLE, CHECKED,
            f"{len(hanging)} párrafos del cuerpo tienen sangría francesa (reservada a la lista de referencias).",
            "Cambia la sangría especial a «Primera línea».", "paragraph-indentation",
            {"count": len(hanging), "examples": _examples(hanging)}, _loc(hanging[0][0], ctx)))
    return _result("APA-04", checked, findings)


# ---------------------------------------------------------------- APA-05 Sección de referencias
def rule_reference_section(ctx: Context) -> RuleResult:
    refs = ctx.structure.references
    findings: list[Finding] = []
    if refs.heading is None:
        near_miss = [p for p in ctx.paragraphs(Role.HEADING, Role.CENTERED)
                     if re.search(r"referen|bibliogr", p.text, re.IGNORECASE)]
        if near_miss:
            p = near_miss[-1]
            findings.append(Finding("APA-05", POSSIBLE, NOT_VERIFIABLE,
                f"Se encontró el título «{p.excerpt(60)}», pero no coincide con la etiqueta APA «Referencias»; no se pudo delimitar la lista.",
                "Titula la lista exactamente «Referencias», centrado y en negrita.", "references-list", {"heading_text": p.text}, _loc(p, ctx)))
        elif len(ctx.structure.loose_reference_like) >= 2:
            first = ctx.structure.loose_reference_like[0]
            findings.append(Finding("APA-05", POSSIBLE, CHECKED,
                f"Al final hay {len(ctx.structure.loose_reference_like)} párrafos con forma de referencia, pero sin el título «Referencias».",
                "Agrega el título «Referencias» en una página nueva, centrado y en negrita.", "references-list",
                {"reference_like_paragraphs": [p.index for p in ctx.structure.loose_reference_like]}, _loc(first, ctx)))
        elif ctx.citations:
            findings.append(Finding("APA-05", ERROR, CHECKED,
                f"Se detectaron {len(ctx.citations)} citas en el texto, pero ninguna lista de referencias.",
                "Incluye al final la lista «Referencias» con cada obra citada.", "references-list",
                {"citations_detected": len(ctx.citations)}, {}))
        else:
            return RuleResult("APA-05", "NOT_APPLICABLE", 0, [], "No se detectaron citas ni lista de referencias.")
        return _result("APA-05", 1, findings)

    h = refs.heading
    if len(refs.candidates) > 1:
        findings.append(Finding("APA-05", TEACHER, NOT_VERIFIABLE,
            f"Hay {len(refs.candidates)} párrafos titulados como referencias; se analizó el último.",
            "Deja un único título «Referencias».", "references-list", {"candidate_paragraphs": refs.candidates}, _loc(h, ctx)))
    if not refs.label_is_apa:
        findings.append(Finding("APA-05", POSSIBLE, CHECKED,
            f"La lista se titula «{h.text.strip()}». APA 7 usa «Referencias» para las obras citadas (una bibliografía incluye además lecturas no citadas).",
            "Cambia el título a «Referencias» si la lista contiene solo obras citadas.", "references-list",
            {"heading_text": h.text.strip()}, _loc(h, ctx)))
    fmt_issues = []
    if h.alignment != "center":
        fmt_issues.append("no está centrado")
    if not h.all_bold:
        fmt_issues.append("no está en negrita")
    if fmt_issues:
        findings.append(Finding("APA-05", POSSIBLE, CHECKED,
            f"El título de la lista de referencias {' y '.join(fmt_issues)}.",
            "Formato APA 7: «Referencias» centrado y en negrita, al inicio de una página nueva.", "references-list",
            {"alignment": h.alignment or "left", "bold": h.all_bold}, _loc(h, ctx)))
    if not refs.entries:
        findings.append(Finding("APA-05", ERROR, CHECKED, "El título de referencias no va seguido de ninguna entrada.",
            "Agrega las referencias de todas las obras citadas debajo del título.", "references-list", {}, _loc(h, ctx)))
    elif refs.reference_like_ratio < 0.6:
        findings.append(Finding("APA-05", TEACHER, NOT_VERIFIABLE,
            f"Solo el {refs.reference_like_ratio:.0%} de los párrafos tras el título tiene la forma «Autor (año)»; la lista podría estar incompleta o mal formateada.",
            "Revisa que cada entrada siga el patrón Autor, A. A. (año). Título.", "references-list",
            {"reference_like_ratio": refs.reference_like_ratio, "entries": len(refs.entries)}, _loc(h, ctx)))
    return _result("APA-05", 1, findings)


# ---------------------------------------------------------------- APA-06 Sangría francesa
def rule_hanging_indent(ctx: Context) -> RuleResult:
    refs = ctx.structure.references
    if not refs.reliable:
        return RuleResult("APA-06", "NOT_VERIFIABLE", 0, [],
                          "No se identificó con fiabilidad la lista de referencias; no se evaluó la sangría francesa.")
    missing, wrong, outdented, manual_breaks = [], [], [], []
    for p in refs.entries:
        hanging, left, first = p.ind_hanging or 0, p.ind_left or 0, p.ind_first_line or 0
        info = {"hanging_cm": twips_to_cm(hanging), "left_cm": twips_to_cm(left), "first_line_cm": twips_to_cm(first)}
        if "\n" in p.text.strip():
            manual_breaks.append((p, info))
        if hanging == 0:
            missing.append((p, info))
        elif abs(hanging - HALF_INCH) > INDENT_TOLERANCE:
            wrong.append((p, info))
        elif left < HALF_INCH - INDENT_TOLERANCE:
            outdented.append((p, info))
    findings = []
    if missing:
        findings.append(Finding("APA-06", ERROR, CHECKED,
            f"{len(missing)} de {len(refs.entries)} referencias no tienen sangría francesa.",
            "Selecciona la lista → Párrafo → Sangría especial: Francesa, 1.27 cm.", "hanging-indent",
            {"count": len(missing), "checked": len(refs.entries), "examples": _examples(missing)}, _loc(missing[0][0], ctx)))
    if wrong:
        findings.append(Finding("APA-06", ERROR, CHECKED,
            f"{len(wrong)} referencias tienen sangría francesa distinta de 1.27 cm.",
            "Ajusta la sangría francesa a 1.27 cm.", "hanging-indent",
            {"count": len(wrong), "expected_cm": 1.27, "examples": _examples(wrong)}, _loc(wrong[0][0], ctx)))
    if outdented:
        findings.append(Finding("APA-06", POSSIBLE, CHECKED,
            f"En {len(outdented)} referencias la primera línea sobresale del margen izquierdo.",
            "Deja la sangría izquierda en 0 cm y la especial «Francesa» en 1.27 cm.", "hanging-indent",
            {"count": len(outdented), "examples": _examples(outdented)}, _loc(outdented[0][0], ctx)))
    if manual_breaks:
        findings.append(Finding("APA-06", POSSIBLE, CHECKED,
            f"{len(manual_breaks)} referencias contienen saltos de línea manuales, que suelen imitar la sangría francesa.",
            "Elimina los saltos manuales y deja que el párrafo fluya con sangría francesa.", "hanging-indent",
            {"count": len(manual_breaks), "examples": _examples(manual_breaks)}, _loc(manual_breaks[0][0], ctx)))
    return _result("APA-06", len(refs.entries), findings)


# ---------------------------------------------------------------- APA-07 Orden alfabético
def _order_key(ref: ReferenceEntry) -> tuple[str, str]:
    authors = ref.authors or ""
    first, _, rest = authors.partition(",")
    clean = lambda s: " ".join(norm_token(w) for w in s.split() if norm_token(w))  # noqa: E731
    return clean(first), clean(rest)


def rule_alphabetical_order(ctx: Context) -> RuleResult:
    refs = ctx.structure.references
    if not refs.reliable:
        return RuleResult("APA-07", "NOT_VERIFIABLE", 0, [], "Lista de referencias no identificada con fiabilidad.")
    parsed = [r for r in ctx.references if r.parsed]
    unparsed = [r for r in ctx.references if not r.parsed]
    findings: list[Finding] = []
    by_index = {p.index: p for p in ctx.doc.paragraphs}
    for a, b in zip(parsed, parsed[1:], strict=False):
        ka, kb = _order_key(a), _order_key(b)
        if ka > kb:
            certain = not (a.title_first or b.title_first)
            findings.append(Finding("APA-07", ERROR if certain else POSSIBLE, CHECKED,
                f"Orden alfabético: «{b.authors}» debería ir antes de «{a.authors}».",
                "Ordena la lista por el apellido del primer autor (letra por letra; «nada precede a algo»).", "reference-order",
                {"previous": a.text[:120], "current": b.text[:120], "previous_key": " ".join(ka), "current_key": " ".join(kb),
                 "title_first_involved": not certain},
                _loc(by_index[b.paragraph_index], ctx)))
        elif ka == kb and a.year and b.year and a.year[:4].isdigit() and b.year[:4].isdigit() and a.year > b.year:
            findings.append(Finding("APA-07", POSSIBLE, CHECKED,
                f"Mismo autor: la obra de {b.year} debería ir antes que la de {a.year}.",
                "Para un mismo autor, ordena las obras por año (de la más antigua a la más reciente).", "reference-order",
                {"previous": a.text[:120], "current": b.text[:120]}, _loc(by_index[b.paragraph_index], ctx)))
    if unparsed:
        findings.append(Finding("APA-07", TEACHER, NOT_VERIFIABLE,
            f"{len(unparsed)} entradas no tienen la forma «Autor (año)» y no se incluyeron en la comprobación de orden.",
            "Revisa manualmente la posición de estas entradas.", "reference-order",
            {"entries": [r.text[:120] for r in unparsed[:MAX_EXAMPLES]]}, _loc(by_index[unparsed[0].paragraph_index], ctx)))
    return _result("APA-07", len(parsed), findings)


# ---------------------------------------------------------------- APA-08 Citas sin referencia
def rule_citations_without_reference(ctx: Context) -> RuleResult:
    if not ctx.citations:
        return RuleResult("APA-08", "NOT_APPLICABLE", 0, [], "No se detectaron citas con formato autor-año.")
    by_index = {p.index: p for p in ctx.doc.paragraphs}
    if not ctx.references:
        return RuleResult("APA-08", "NOT_VERIFIABLE", len(ctx.citations), [Finding("APA-08", POSSIBLE, NOT_VERIFIABLE,
            f"Se detectaron {len(ctx.citations)} citas, pero no hay lista de referencias con la que contrastarlas.",
            "Agrega la lista «Referencias».", "citation-reference-match",
            {"citations": [c.raw for c in ctx.citations[:MAX_EXAMPLES]]}, _loc(by_index[ctx.citations[0].paragraph_index], ctx))])
    unmatched: dict[str, list[Citation]] = defaultdict(list)
    for c in ctx.citations:
        if not any(citation_matches(c, r) for r in ctx.references):
            unmatched[c.key].append(c)
    findings = []
    for occurrences in unmatched.values():
        c = occurrences[0]
        findings.append(Finding("APA-08", POSSIBLE, CHECKED,
            f"La cita «{c.raw}» no coincide con ninguna referencia (autor y año).",
            "Verifica que el apellido y el año coincidan con una entrada de «Referencias» o agrega la referencia faltante.",
            "citation-reference-match",
            {"citation": c.raw, "author": c.authors, "year": c.year, "occurrences": len(occurrences),
             "paragraphs": sorted({o.paragraph_index for o in occurrences}), "heuristic": True},
            _loc(by_index[c.paragraph_index], ctx)))
    return _result("APA-08", len(ctx.citations), findings)


# ---------------------------------------------------------------- APA-09 Referencias sin cita
def rule_references_without_citation(ctx: Context) -> RuleResult:
    if not ctx.references:
        return RuleResult("APA-09", "NOT_APPLICABLE", 0, [], "No se detectó lista de referencias.")
    by_index = {p.index: p for p in ctx.doc.paragraphs}
    parsed = [r for r in ctx.references if r.parsed]
    findings = []
    if not ctx.citations:
        findings.append(Finding("APA-09", POSSIBLE, CHECKED,
            f"Hay {len(ctx.references)} referencias, pero no se detectó ninguna cita autor-año en el texto.",
            "Cada referencia debe citarse al menos una vez en el texto (Autor, año).", "citation-reference-match",
            {"references": len(ctx.references)}, {}))
        return _result("APA-09", len(parsed), findings)
    for r in parsed:
        if not any(citation_matches(c, r) for c in ctx.citations):
            findings.append(Finding("APA-09", POSSIBLE, CHECKED,
                f"No se encontró en el texto una cita para «{r.authors} ({r.year})».",
                "Cita la obra en el texto o elimínala si no se usó (APA 7 lista solo obras citadas).", "citation-reference-match",
                {"reference": r.text[:200], "author": r.authors, "year": r.year, "heuristic": True},
                _loc(by_index[r.paragraph_index], ctx)))
    unparsed = [r for r in ctx.references if not r.parsed]
    if unparsed:
        findings.append(Finding("APA-09", TEACHER, NOT_VERIFIABLE,
            f"{len(unparsed)} entradas de la lista no pudieron interpretarse como «Autor (año)».",
            "Revisa que cada entrada empiece por autor y año entre paréntesis.", "references-list",
            {"entries": [r.text[:120] for r in unparsed[:MAX_EXAMPLES]]}, _loc(by_index[unparsed[0].paragraph_index], ctx)))
    return _result("APA-09", len(parsed), findings)


# ---------------------------------------------------------------- APA-10 Citas de 40 palabras o más
QUOTE_RE = re.compile(r"“([^”]{20,})”|«([^»]{20,})»|\"([^\"]{20,})\"")
FOLLOWING_CITATION_RE = re.compile(r"^\s*[\.,]?\s*\(([^()]*)\)")


def rule_long_quotations(ctx: Context) -> RuleResult:
    findings: list[Finding] = []
    checked = 0
    for p in ctx.paragraphs(Role.BODY, Role.ABSTRACT, Role.LIST):
        for m in QUOTE_RE.finditer(p.text):
            quote = next(g for g in m.groups() if g)
            words = len(quote.split())
            checked += 1
            if words < 40:
                continue
            after = FOLLOWING_CITATION_RE.match(p.text[m.end(): m.end() + 120])
            has_locator = bool(after and re.search(r"\b(pp?\.|párr\.|para\.)", after.group(1)))
            evidence = {"word_count": words, "quote_start": quote[:100], "citation_after": after.group(0).strip() if after else None}
            if has_locator:
                findings.append(Finding("APA-10", ERROR, CHECKED,
                    f"Cita textual de {words} palabras entre comillas dentro del párrafo; desde 40 palabras APA 7 exige cita en bloque.",
                    "Coloca la cita en un párrafo aparte, sin comillas, con sangría izquierda de 1.27 cm.", "block-quotations",
                    evidence, _loc(p, ctx)))
            else:
                findings.append(Finding("APA-10", POSSIBLE, CHECKED,
                    f"Texto entrecomillado de {words} palabras; si es una cita textual, debe ir en bloque.",
                    "Si es cita textual, preséntala en bloque y agrega la página; si no, revisa el uso de comillas.", "block-quotations",
                    evidence, _loc(p, ctx)))
    for p in ctx.paragraphs(Role.BLOCK_QUOTE):
        checked += 1
        content = re.sub(r"\([^()]*\d{4}[^()]*\)\s*\.?\s*$", "", p.text.strip())
        words = len(content.split())
        if words < 40:
            findings.append(Finding("APA-10", POSSIBLE, CHECKED,
                f"Párrafo con formato de cita en bloque de solo {words} palabras; las citas de menos de 40 palabras van dentro del texto entre comillas.",
                "Integra la cita en el párrafo entre comillas, o verifica que sea realmente una cita.", "block-quotations",
                {"word_count": words}, _loc(p, ctx)))
        if re.match(r"^\s*[“«\"]", p.text) and re.search(r"[”»\"]\s*(\([^()]*\))?\s*\.?\s*$", p.text):
            findings.append(Finding("APA-10", POSSIBLE, CHECKED,
                "La cita en bloque está entre comillas; APA 7 indica no usar comillas en citas en bloque.",
                "Elimina las comillas de apertura y cierre de la cita en bloque.", "block-quotations", {}, _loc(p, ctx)))
    return _result("APA-10", checked, findings)


@dataclass(frozen=True)
class RuleSpec:
    code: str
    name: str
    description: str
    guide_slug: str
    check: Callable[[Context], RuleResult]


RULES: list[RuleSpec] = [
    RuleSpec("APA-01", "Márgenes", "Márgenes de 2.54 cm en todas las secciones.", "margins", rule_margins),
    RuleSpec("APA-02", "Fuente y tamaño", "Fuente legible recomendada por APA 7 en tamaño adecuado.", "fonts", rule_fonts),
    RuleSpec("APA-03", "Interlineado", "Interlineado doble y sin espacio adicional entre párrafos.", "line-spacing", rule_line_spacing),
    RuleSpec("APA-04", "Sangría de primera línea", "Párrafos del cuerpo con sangría de 1.27 cm.", "paragraph-indentation", rule_first_line_indent),
    RuleSpec("APA-05", "Sección de referencias", "Presencia y formato del título «Referencias».", "references-list", rule_reference_section),
    RuleSpec("APA-06", "Sangría francesa", "Entradas de referencia con sangría francesa de 1.27 cm.", "hanging-indent", rule_hanging_indent),
    RuleSpec("APA-07", "Orden alfabético", "Referencias ordenadas alfabéticamente por primer autor.", "reference-order", rule_alphabetical_order),
    RuleSpec("APA-08", "Citas sin referencia", "Cada cita autor-año tiene su referencia (heurístico).", "citation-reference-match", rule_citations_without_reference),
    RuleSpec("APA-09", "Referencias sin cita", "Cada referencia aparece citada en el texto (heurístico).", "citation-reference-match", rule_references_without_citation),
    RuleSpec("APA-10", "Citas de 40 palabras o más", "Citas textuales largas en formato de bloque.", "block-quotations", rule_long_quotations),
]
RULES_BY_CODE = {r.code: r for r in RULES}
