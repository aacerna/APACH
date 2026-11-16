"""Clasificación conservadora de párrafos y detección de la sección de referencias."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from app.apa_engine.extractor import ExtractedDocument, ParagraphInfo
from app.apa_engine.text_utils import normalize_label

REFERENCE_LABELS_APA = {"referencias", "references", "lista de referencias"}
REFERENCE_LABELS_OTHER = {"bibliografia", "referencias bibliograficas", "bibliography", "fuentes", "fuentes consultadas", "obras citadas", "works cited"}
ABSTRACT_LABELS = {"resumen", "abstract"}
APPENDIX_RE = re.compile(r"^(ap[eé]ndice|anexo|appendix)\b", re.IGNORECASE)
CAPTION_TEXT_RE = re.compile(r"^(tabla|figura|table|figure)\s+\d+", re.IGNORECASE)
NOTE_RE = re.compile(r"^(nota|note)\.", re.IGNORECASE)
TOC_STYLE_RE = re.compile(r"^(toc|tdc)\b", re.IGNORECASE)

HALF_INCH = 720  # twips
INDENT_TOLERANCE = 72  # ±0.127 cm


class Role(str, Enum):
    FRONT = "FRONT"
    HEADING = "HEADING"
    ABSTRACT = "ABSTRACT"
    BODY = "BODY"
    BLOCK_QUOTE = "BLOCK_QUOTE"
    REFERENCES_HEADING = "REFERENCES_HEADING"
    REFERENCE_ENTRY = "REFERENCE_ENTRY"
    CAPTION = "CAPTION"
    NOTE = "NOTE"
    LIST = "LIST"
    CENTERED = "CENTERED"
    TOC = "TOC"
    TABLE = "TABLE"
    EMPTY = "EMPTY"


@dataclass
class ReferenceSection:
    heading: ParagraphInfo | None
    label_is_apa: bool
    candidates: list[int]
    entries: list[ParagraphInfo] = field(default_factory=list)
    reference_like_ratio: float = 0.0

    @property
    def reliable(self) -> bool:
        return self.heading is not None and len(self.candidates) == 1 and len(self.entries) > 0 and self.reference_like_ratio >= 0.6


@dataclass
class DocumentStructure:
    roles: dict[int, Role]
    front_matter_end: int | None
    references: ReferenceSection
    loose_reference_like: list[ParagraphInfo]

    def with_role(self, doc: ExtractedDocument, *roles: Role) -> list[ParagraphInfo]:
        return [p for p in doc.paragraphs if self.roles.get(p.index) in roles]


def is_manual_heading(p: ParagraphInfo) -> bool:
    text = p.text.strip()
    return 0 < p.word_count <= 12 and p.all_bold and not text.endswith(".") and "\t" not in text


REF_START_RE = re.compile(
    r"^\s*[A-ZÁÉÍÓÚÑ\[][^()]{0,200}?\.\s*\(\s*(\d{4}[a-z]?|s\.\s?f\.|n\.\s?d\.|en prensa|in press)(?:\s*,[^)]*)?\)",
    re.IGNORECASE,
)


def looks_like_reference(p: ParagraphInfo) -> bool:
    """Forma «Autor. (año)» al inicio del párrafo (también cubre «Título. (año)»)."""
    return bool(REF_START_RE.match(p.text))


def _is_block_quote(p: ParagraphInfo) -> bool:
    return abs((p.ind_left or 0) - HALF_INCH) <= INDENT_TOLERANCE * 2 and (p.ind_first_line or 0) == 0 and (p.ind_hanging or 0) == 0


def _detect_front_matter(doc: ExtractedDocument) -> int | None:
    """Índice del último párrafo de portada si hay salto de página/sección temprano y explícito."""
    non_empty = [p for p in doc.paragraphs if p.text.strip() and not p.in_table]
    if len(non_empty) < 6:
        return None
    limit = min(25, int(len(doc.paragraphs) * 0.4))
    for p in doc.paragraphs[: limit + 1]:
        if p.page_break_before and p.index > 0:
            return p.index - 1
        if p.contains_page_break:
            return p.index
        if p.section_index > 0:
            return p.index - 1
    return None


def analyze_structure(doc: ExtractedDocument) -> DocumentStructure:
    roles: dict[int, Role] = {}
    front_end = _detect_front_matter(doc)

    candidates = [
        p.index
        for p in doc.paragraphs
        if not p.in_table
        and p.word_count <= 4
        and not (p.style_name and TOC_STYLE_RE.search(p.style_name))
        and normalize_label(p.text) in (REFERENCE_LABELS_APA | REFERENCE_LABELS_OTHER)
    ]
    heading = doc.paragraphs[candidates[-1]] if candidates else None
    ref_section = ReferenceSection(
        heading=heading,
        label_is_apa=bool(heading and normalize_label(heading.text) in REFERENCE_LABELS_APA),
        candidates=candidates,
    )

    in_abstract = False
    in_references = False
    for p in doc.paragraphs:
        text = p.text.strip()
        if p.in_table:
            roles[p.index] = Role.TABLE
            continue
        if not text:
            roles[p.index] = Role.EMPTY
            continue
        if p.style_name and TOC_STYLE_RE.search(p.style_name):
            roles[p.index] = Role.TOC
            continue
        if front_end is not None and p.index <= front_end:
            roles[p.index] = Role.FRONT
            continue
        if heading is not None and p.index == heading.index:
            roles[p.index] = Role.REFERENCES_HEADING
            in_references, in_abstract = True, False
            continue
        heading_like = p.is_heading_style or is_manual_heading(p)
        if in_references:
            if heading_like and (APPENDIX_RE.search(text) or p.is_heading_style):
                in_references = False
            else:
                roles[p.index] = Role.REFERENCE_ENTRY
                ref_section.entries.append(p)
                continue
        if CAPTION_TEXT_RE.search(text) or p.is_caption_style:
            roles[p.index] = Role.CAPTION
            continue
        if NOTE_RE.search(text):
            roles[p.index] = Role.NOTE
            continue
        if heading_like:
            roles[p.index] = Role.HEADING
            in_abstract = normalize_label(text) in ABSTRACT_LABELS
            continue
        if in_abstract:
            roles[p.index] = Role.ABSTRACT
            continue
        if p.is_list:
            roles[p.index] = Role.LIST
            continue
        if p.alignment == "center":
            roles[p.index] = Role.CENTERED
            continue
        if _is_block_quote(p):
            roles[p.index] = Role.BLOCK_QUOTE
            continue
        roles[p.index] = Role.BODY

    if ref_section.entries:
        like = sum(1 for e in ref_section.entries if looks_like_reference(e))
        ref_section.reference_like_ratio = round(like / len(ref_section.entries), 2)

    loose = []
    if heading is None:
        # Bloque final de párrafos con forma de referencia sin título detectable.
        tail = [p for p in doc.paragraphs if roles.get(p.index) in (Role.BODY, Role.BLOCK_QUOTE)]
        for p in reversed(tail):
            if looks_like_reference(p) and p.word_count < 80:
                loose.append(p)
            else:
                break
        loose.reverse()
    return DocumentStructure(roles=roles, front_matter_end=front_end, references=ref_section, loose_reference_like=loose)
