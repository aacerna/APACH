"""Detección heurística de citas en el texto y de entradas de referencia (APA 7).

Es una aproximación por patrones: puede omitir citas atípicas o confundir paréntesis con
años. Por ello los hallazgos derivados nunca se clasifican como ERROR.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.apa_engine.text_utils import is_capitalized, norm_token, strip_accents

YEAR = r"(?:\d{4}[a-z]?|s\.\s?f\.|n\.\s?d\.|en prensa|in press)"
YEAR_RE = re.compile(YEAR, re.IGNORECASE)
PAREN_RE = re.compile(r"\(([^()]{1,400})\)")
LOCATOR_RE = re.compile(r",\s*(?:pp?\.|párr\.|parr\.|para\.|cap\.|min\.)", re.IGNORECASE)
CONNECTORS = {"y", "&", "and", "e", "para", "por", "en", "sobre", "of", "for", "the", "de", "del", "la", "las", "los", "el", "van", "von", "der", "den", "da", "do", "dos", "di", "le"}
ETAL = {"et", "al", "al."}
SENTENCE_STARTERS = {
    "segun", "en", "como", "para", "por", "desde", "asi", "sin", "con", "el", "la", "los", "las", "de", "del",
    "ademas", "asimismo", "este", "esta", "estos", "estas", "ese", "esa", "aunque", "sin embargo", "tambien",
    "una", "un", "al", "a", "ya", "pero", "cuando", "donde", "mientras", "tal", "luego", "finalmente", "por ultimo",
    "the", "in", "as", "according", "for", "this", "these", "however", "while", "vease", "ver", "cf",
}


def normalize_year(year: str) -> str:
    y = strip_accents(year).lower().replace(" ", "")
    return {"n.d.": "s.f.", "inpress": "enprensa"}.get(y, y)


def _sig_tokens(text: str) -> list[str]:
    tokens = []
    for raw in re.split(r"[\s,]+", text):
        bracket = raw.startswith("[") or raw.endswith("]")
        tok = norm_token(raw)
        if not tok or tok in CONNECTORS or tok in ETAL:
            continue
        if is_capitalized(raw) or bracket or raw.isupper():
            tokens.append(tok)
    return tokens


@dataclass
class Citation:
    paragraph_index: int
    raw: str
    authors: str
    year: str
    kind: str  # narrative | parenthetical
    tokens: list[str] = field(default_factory=list)
    has_locator: bool = False

    @property
    def key(self) -> str:
        return f"{self.tokens[0] if self.tokens else '?'}|{self.year}"


@dataclass
class ReferenceEntry:
    paragraph_index: int
    text: str
    authors: str | None
    year: str | None
    first_author_tokens: list[str]
    all_tokens: list[str]
    sort_key: str | None
    title_first: bool

    @property
    def parsed(self) -> bool:
        return self.authors is not None and self.year is not None


def _narrative_authors(before: str) -> str | None:
    """Recorre hacia atrás las palabras previas a «(año)» y conserva el bloque de autor."""
    picked: list[str] = []
    for tok in reversed(before.rstrip().split()[-10:]):
        low = norm_token(tok)
        if tok in ("et", "al.", "al", "&") or (tok.islower() and low in CONNECTORS):
            picked.append(tok)
            continue
        if is_capitalized(tok):
            if low in SENTENCE_STARTERS or tok.endswith((".", ":", ";", ",")):
                break
            picked.append(tok)
            continue
        break
    picked.reverse()
    while picked and (picked[0] in ("et", "al.", "al", "&") or picked[0].islower()):
        picked.pop(0)
    if not picked:
        return None
    return " ".join(picked).strip(",;: ")


def _plausible_year(year: str) -> bool:
    digits = re.match(r"\d{4}", year)
    return not digits or 1500 <= int(digits.group()) <= 2100


def find_citations(paragraphs) -> list[Citation]:
    found: list[Citation] = []
    for p in paragraphs:
        text = p.text
        for m in PAREN_RE.finditer(text):
            content = m.group(1).strip()
            # Caso narrativo: (2020) o (2020, p. 4) precedido por autor.
            only_year = re.fullmatch(rf"({YEAR})(?:\s*,\s*{YEAR})*(\s*,.*)?", content, re.IGNORECASE)
            if only_year:
                year = only_year.group(1)
                authors = _narrative_authors(text[: m.start()])
                if authors and _plausible_year(year):
                    found.append(Citation(p.index, f"{authors} ({content})", authors, normalize_year(year), "narrative",
                                          _sig_tokens(authors), bool(LOCATOR_RE.search(content))))
                continue
            for part in content.split(";"):
                part = re.sub(r"^\s*(?:v[ée]ase|ver|cf\.|p\.\s?ej\.,?|e\.\s?g\.,?)\s+(?:también\s+)?", "", part.strip(), flags=re.IGNORECASE)
                ym = re.search(rf",\s*({YEAR})(?=[\s,.;]|$)", part, re.IGNORECASE)
                if not ym:
                    continue
                authors = part[: ym.start()].strip()
                year = ym.group(1)
                if not authors or len(authors) > 160 or not any(is_capitalized(t) for t in authors.split()):
                    continue
                if not _plausible_year(year):
                    continue
                found.append(Citation(p.index, f"({part.strip()})", authors, normalize_year(year), "parenthetical",
                                      _sig_tokens(authors), bool(LOCATOR_RE.search(part[ym.end():]))))
    return found


def parse_reference(paragraph_index: int, text: str) -> ReferenceEntry:
    clean = " ".join(text.split())
    m = re.search(rf"\(\s*({YEAR})(?:\s*,[^)]*)?\)", clean[:300], re.IGNORECASE)
    if not m or m.start() == 0:
        return ReferenceEntry(paragraph_index, clean, None, None, [], [], None, False)
    authors = clean[: m.start()].strip(" .")
    year = normalize_year(m.group(1))
    # Si el bloque previo al año no contiene comas ni iniciales probablemente es un título (obra sin autor).
    words = [w for w in authors.split() if norm_token(w) and norm_token(w) not in CONNECTORS]
    capitalized_ratio = sum(1 for w in words if is_capitalized(w)) / len(words) if words else 0
    title_first = (
        "," not in authors and "[" not in authors and not re.search(r"\b[A-ZÁÉÍÓÚÑ]\.", authors)
        and len(words) > 2 and capitalized_ratio < 0.6
    )
    first_segment = authors.split(",")[0]
    sort_key = re.sub(r"[^a-z0-9 ]", "", strip_accents(authors).lower())
    sort_key = re.sub(r"\s+", " ", sort_key).strip()
    all_tokens = [norm_token(t) for t in re.split(r"[\s,\[\]]+", authors) if norm_token(t)]
    return ReferenceEntry(
        paragraph_index=paragraph_index,
        text=clean,
        authors=authors,
        year=year,
        first_author_tokens=[norm_token(t) for t in first_segment.split() if norm_token(t)],
        all_tokens=all_tokens,
        sort_key=sort_key,
        title_first=title_first,
    )


def citation_matches(citation: Citation, ref: ReferenceEntry) -> bool:
    if not ref.parsed or not citation.tokens or citation.year != ref.year:
        return False
    first = citation.tokens[0]
    if first in ref.first_author_tokens:
        return True
    # Autor corporativo o abreviatura entre corchetes: coincidencia con cualquier token significativo.
    return any(tok in ref.all_tokens for tok in citation.tokens if len(tok) >= 3)
