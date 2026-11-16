"""Extracción de propiedades reales de un DOCX (OOXML) con resolución de herencia.

Orden de resolución (por atributo):
  formato directo del párrafo/run → estilo de carácter → estilo de párrafo y su cadena
  basedOn → estilo de párrafo por defecto → w:docDefaults → (fuentes) tema del documento.

Límites conocidos (documentados en docs/04-MOTOR-APA.md):
  - No se calcula paginación: no existen números de página en la evidencia.
  - La sangría aportada por numeración (w:numPr) no se resuelve.
  - Si ningún nivel define fuente o tamaño, el valor depende de la aplicación (se marca `assumed`).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import docx
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
W = f"{{{W_NS}}}"
NS = {"w": W_NS, "a": A_NS}

TWIPS_PER_CM = 1440 / 2.54
HEADING_STYLE_RE = re.compile(r"^(heading|t[ií]tulo|title|encabezado)\b", re.IGNORECASE)
CAPTION_STYLE_RE = re.compile(r"(caption|descripci[oó]n|epígrafe|leyenda)", re.IGNORECASE)
LIST_STYLE_RE = re.compile(r"(list|lista|vi[ñn]eta)", re.IGNORECASE)


def twips_to_cm(value: int | None) -> float | None:
    return None if value is None else round(value / TWIPS_PER_CM, 2)


def _int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


@dataclass
class SectionInfo:
    index: int
    margins_twips: dict[str, int | None]
    gutter_twips: int | None
    page_width_twips: int | None
    page_height_twips: int | None
    break_type: str | None

    @property
    def margins_cm(self) -> dict[str, float | None]:
        return {k: twips_to_cm(v) for k, v in self.margins_twips.items()}


@dataclass
class RunInfo:
    text: str
    font: str | None
    font_assumed: bool
    size_pt: float | None
    size_assumed: bool
    bold: bool
    italic: bool


@dataclass
class ParagraphInfo:
    index: int
    text: str
    style_id: str | None
    style_name: str | None
    section_index: int
    in_table: bool
    is_heading_style: bool
    outline_level: int | None
    alignment: str | None
    line: int | None
    line_rule: str | None
    space_before: int | None
    space_after: int | None
    ind_left: int | None
    ind_first_line: int | None
    ind_hanging: int | None
    has_numbering: bool
    page_break_before: bool
    contains_page_break: bool
    runs: list[RunInfo] = field(default_factory=list)

    @property
    def word_count(self) -> int:
        return len(self.text.split())

    @property
    def all_bold(self) -> bool:
        visible = [r for r in self.runs if r.text.strip()]
        return bool(visible) and all(r.bold for r in visible)

    @property
    def is_caption_style(self) -> bool:
        return bool(self.style_name and CAPTION_STYLE_RE.search(self.style_name))

    @property
    def is_list(self) -> bool:
        return self.has_numbering or bool(self.style_name and LIST_STYLE_RE.search(self.style_name))

    def excerpt(self, length: int = 120) -> str:
        text = " ".join(self.text.split())
        return text if len(text) <= length else text[: length - 1] + "…"


@dataclass
class ExtractedDocument:
    paragraphs: list[ParagraphInfo]
    sections: list[SectionInfo]
    core_properties: dict[str, str | None]
    table_count: int
    warnings: list[str] = field(default_factory=list)

    @property
    def body_paragraphs(self) -> list[ParagraphInfo]:
        return [p for p in self.paragraphs if not p.in_table and p.text.strip()]


class StyleResolver:
    """Resuelve propiedades efectivas siguiendo la cadena de estilos del documento."""

    def __init__(self, document: docx.document.Document):
        styles_el = document.styles.element
        self.styles: dict[str, etree._Element] = {}
        self.default_paragraph_style: str | None = None
        self.default_character_style: str | None = None
        for st in styles_el.findall(f"{W}style"):
            sid = st.get(f"{W}styleId")
            if sid is None:
                continue
            self.styles[sid] = st
            if st.get(f"{W}default") in ("1", "true"):
                if st.get(f"{W}type") == "paragraph":
                    self.default_paragraph_style = sid
                elif st.get(f"{W}type") == "character":
                    self.default_character_style = sid
        defaults = styles_el.find(f"{W}docDefaults")
        self.doc_ppr = defaults.find(f"{W}pPrDefault/{W}pPr") if defaults is not None else None
        self.doc_rpr = defaults.find(f"{W}rPrDefault/{W}rPr") if defaults is not None else None
        self.theme_fonts = self._load_theme_fonts(document)

    @staticmethod
    def _load_theme_fonts(document) -> dict[str, str]:
        fonts: dict[str, str] = {}
        try:
            theme_part = document.part.part_related_by(RT.THEME)
        except KeyError:
            return fonts
        try:
            root = etree.fromstring(theme_part.blob, parser=etree.XMLParser(resolve_entities=False, no_network=True))
        except etree.XMLSyntaxError:
            return fonts
        for kind in ("major", "minor"):
            latin = root.find(f".//a:{kind}Font/a:latin", NS)
            if latin is not None and latin.get("typeface"):
                fonts[kind] = latin.get("typeface")
        return fonts

    def style_name(self, sid: str | None) -> str | None:
        if sid is None or sid not in self.styles:
            return None
        name = self.styles[sid].find(f"{W}name")
        return name.get(f"{W}val") if name is not None else sid

    def _chain(self, sid: str | None) -> list[etree._Element]:
        chain, seen = [], set()
        while sid and sid in self.styles and sid not in seen:
            seen.add(sid)
            st = self.styles[sid]
            chain.append(st)
            based = st.find(f"{W}basedOn")
            sid = based.get(f"{W}val") if based is not None else None
        return chain

    def paragraph_style_id(self, p_el) -> str | None:
        ps = p_el.find(f"{W}pPr/{W}pStyle")
        return ps.get(f"{W}val") if ps is not None else self.default_paragraph_style

    def ppr_levels(self, p_el) -> list[etree._Element]:
        levels = []
        direct = p_el.find(f"{W}pPr")
        if direct is not None:
            levels.append(direct)
        for st in self._chain(self.paragraph_style_id(p_el)):
            ppr = st.find(f"{W}pPr")
            if ppr is not None:
                levels.append(ppr)
        if self.doc_ppr is not None:
            levels.append(self.doc_ppr)
        return levels

    def rpr_levels(self, r_el, p_el) -> list[etree._Element]:
        levels = []
        direct = r_el.find(f"{W}rPr")
        if direct is not None:
            levels.append(direct)
            rs = direct.find(f"{W}rStyle")
            if rs is not None:
                for st in self._chain(rs.get(f"{W}val")):
                    rpr = st.find(f"{W}rPr")
                    if rpr is not None:
                        levels.append(rpr)
        for st in self._chain(self.paragraph_style_id(p_el)):
            rpr = st.find(f"{W}rPr")
            if rpr is not None:
                levels.append(rpr)
        if self.doc_rpr is not None:
            levels.append(self.doc_rpr)
        return levels

    @staticmethod
    def first_attr(levels, child: str, attr: str) -> str | None:
        for level in levels:
            el = level.find(f"{W}{child}")
            if el is not None and el.get(f"{W}{attr}") is not None:
                return el.get(f"{W}{attr}")
        return None

    @staticmethod
    def first_toggle(levels, child: str) -> bool:
        for level in levels:
            el = level.find(f"{W}{child}")
            if el is not None:
                return el.get(f"{W}val") not in ("0", "false", "off")
        return False

    def resolve_font(self, levels) -> tuple[str | None, bool]:
        for level in levels:
            rf = level.find(f"{W}rFonts")
            if rf is None:
                continue
            theme = rf.get(f"{W}asciiTheme") or rf.get(f"{W}hAnsiTheme")
            if theme:
                kind = "major" if theme.startswith("major") else "minor"
                if kind in self.theme_fonts:
                    return self.theme_fonts[kind], False
            font = rf.get(f"{W}ascii") or rf.get(f"{W}hAnsi")
            if font:
                return font, False
        return "Times New Roman", True  # predeterminado de la aplicación, no verificable

    def resolve_indent(self, levels) -> tuple[int | None, int | None, int | None]:
        left = first = hanging = None
        left_found = special_found = False
        for level in levels:
            ind = level.find(f"{W}ind")
            if ind is None:
                continue
            if not left_found:
                value = ind.get(f"{W}left") or ind.get(f"{W}start")
                if value is not None:
                    left, left_found = _int(value), True
            if not special_found and (ind.get(f"{W}firstLine") is not None or ind.get(f"{W}hanging") is not None):
                first, hanging = _int(ind.get(f"{W}firstLine")), _int(ind.get(f"{W}hanging"))
                special_found = True
        return left or 0, first or 0, hanging or 0


def _paragraph_text(p_el) -> str:
    parts: list[str] = []
    for el in p_el.iter():
        if any(anc.tag == f"{W}del" for anc in el.iterancestors()):
            continue
        if el.tag == f"{W}t":
            parts.append(el.text or "")
        elif el.tag == f"{W}tab" and el.getparent() is not None and el.getparent().tag == f"{W}r":
            parts.append("\t")
        elif el.tag in (f"{W}br", f"{W}cr") and el.get(f"{W}type") != "page":
            parts.append("\n")
    return "".join(parts)


def _iter_block_paragraphs(container, in_table: bool = False):
    for child in container:
        if child.tag == f"{W}p":
            yield child, in_table
        elif child.tag == f"{W}tbl":
            for p in child.iter(f"{W}p"):
                yield p, True
        elif child.tag == f"{W}sdt":
            content = child.find(f"{W}sdtContent")
            if content is not None:
                yield from _iter_block_paragraphs(content, in_table)
        elif child.tag in (f"{W}ins", f"{W}customXml", f"{W}smartTag"):
            yield from _iter_block_paragraphs(child, in_table)


def _section_info(index: int, sect_pr) -> SectionInfo:
    pg_mar = sect_pr.find(f"{W}pgMar") if sect_pr is not None else None
    pg_sz = sect_pr.find(f"{W}pgSz") if sect_pr is not None else None
    sect_type = sect_pr.find(f"{W}type") if sect_pr is not None else None
    margins = {k: _int(pg_mar.get(f"{W}{k}")) if pg_mar is not None else None for k in ("top", "bottom", "left", "right")}
    return SectionInfo(
        index=index,
        margins_twips=margins,
        gutter_twips=_int(pg_mar.get(f"{W}gutter")) if pg_mar is not None else None,
        page_width_twips=_int(pg_sz.get(f"{W}w")) if pg_sz is not None else None,
        page_height_twips=_int(pg_sz.get(f"{W}h")) if pg_sz is not None else None,
        break_type=sect_type.get(f"{W}val") if sect_type is not None else None,
    )


def extract_docx(path: Path | str) -> ExtractedDocument:
    document = docx.Document(str(path))
    resolver = StyleResolver(document)
    body = document.element.body

    paragraphs: list[ParagraphInfo] = []
    sections: list[SectionInfo] = []
    section_index = 0
    table_count = len(body.findall(f"{W}tbl"))

    for idx, (p_el, in_table) in enumerate(_iter_block_paragraphs(body)):
        levels = resolver.ppr_levels(p_el)
        sid = resolver.paragraph_style_id(p_el)
        sname = resolver.style_name(sid)
        outline = _int(resolver.first_attr(levels, "outlineLvl", "val"))
        left, first, hanging = resolver.resolve_indent(levels)
        has_page_break = any(br.get(f"{W}type") == "page" for br in p_el.iter(f"{W}br"))
        runs: list[RunInfo] = []
        for r_el in p_el.iter(f"{W}r"):
            if any(anc.tag == f"{W}del" for anc in r_el.iterancestors()):
                continue
            text = "".join(t.text or "" for t in r_el.findall(f"{W}t"))
            if not text:
                continue
            rlevels = resolver.rpr_levels(r_el, p_el)
            font, font_assumed = resolver.resolve_font(rlevels)
            sz = _int(resolver.first_attr(rlevels, "sz", "val"))
            runs.append(
                RunInfo(
                    text=text,
                    font=font,
                    font_assumed=font_assumed,
                    size_pt=(sz / 2) if sz else 10.0,
                    size_assumed=sz is None,
                    bold=resolver.first_toggle(rlevels, "b"),
                    italic=resolver.first_toggle(rlevels, "i"),
                )
            )
        paragraphs.append(
            ParagraphInfo(
                index=idx,
                text=_paragraph_text(p_el),
                style_id=sid,
                style_name=sname,
                section_index=section_index,
                in_table=in_table,
                is_heading_style=bool(sname and HEADING_STYLE_RE.search(sname)) or (outline is not None and outline < 9),
                outline_level=outline,
                alignment=resolver.first_attr(levels, "jc", "val"),
                line=_int(resolver.first_attr(levels, "spacing", "line")),
                line_rule=resolver.first_attr(levels, "spacing", "lineRule"),
                space_before=_int(resolver.first_attr(levels, "spacing", "before")),
                space_after=_int(resolver.first_attr(levels, "spacing", "after")),
                ind_left=left,
                ind_first_line=first,
                ind_hanging=hanging,
                has_numbering=p_el.find(f"{W}pPr/{W}numPr") is not None,
                page_break_before=resolver.first_toggle(levels, "pageBreakBefore"),
                contains_page_break=has_page_break,
                runs=runs,
            )
        )
        inline_sect = p_el.find(f"{W}pPr/{W}sectPr")
        if inline_sect is not None and not in_table:
            sections.append(_section_info(section_index, inline_sect))
            section_index += 1

    sections.append(_section_info(section_index, body.find(f"{W}sectPr")))

    cp = document.core_properties
    core = {"title": cp.title or None, "author": cp.author or None, "language": cp.language or None}
    return ExtractedDocument(paragraphs=paragraphs, sections=sections, core_properties=core, table_count=table_count)
