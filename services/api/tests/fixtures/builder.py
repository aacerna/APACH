"""Construcción reproducible de DOCX de prueba con propiedades OOXML controladas.

Uso:  python -m tests.fixtures.builder   (desde services/api)  -> escribe tests/fixtures/docx/*.docx
Todos los nombres, obras y datos son ficticios.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt

OUT_DIR = Path(__file__).parent / "docx"

LOREM = (
    "La comunicación digital en contextos universitarios transforma la manera en que los estudiantes "
    "investigan, contrastan fuentes y construyen argumentos propios a partir de evidencia verificable"
)

LONG_QUOTE = (
    "Los entornos de aprendizaje mediados por plataformas exigen que cada estudiante desarrolle criterios "
    "para evaluar la procedencia de la información, distinguir entre opinión y evidencia, reconocer el aporte "
    "de otros autores y documentar con precisión cada fuente utilizada durante el proceso de escritura académica"
)  # 45 palabras


@dataclass
class Spec:
    margins_cm: tuple[float, float, float, float] = (2.54, 2.54, 2.54, 2.54)  # top, bottom, left, right
    font: str | None = "Times New Roman"
    size: float | None = 12
    line_spacing: float | None = 2.0
    line_exact_pt: float | None = None
    space_after_pt: float = 0
    body_indent_in: float | None = 0.5
    title_page: bool = True
    references_label: str | None = "Referencias"
    references_heading_bold_center: bool = True
    hanging: bool = True
    body: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    block_quote: str | None = None
    extra_label: str | None = None


def _apply_base(doc, spec: Spec) -> None:
    for section in doc.sections:
        top, bottom, left, right = spec.margins_cm
        section.top_margin, section.bottom_margin = Cm(top), Cm(bottom)
        section.left_margin, section.right_margin = Cm(left), Cm(right)
    normal = doc.styles["Normal"]
    if spec.font:
        normal.font.name = spec.font
        rpr = normal.element.get_or_add_rPr()
        rfonts = rpr.get_or_add_rFonts()
        for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            rfonts.attrib.pop(qn(attr), None)
    if spec.size:
        normal.font.size = Pt(spec.size)
    fmt = normal.paragraph_format
    fmt.space_after = Pt(spec.space_after_pt)
    fmt.space_before = Pt(0)
    if spec.line_exact_pt:
        fmt.line_spacing_rule = WD_LINE_SPACING.EXACTLY
        fmt.line_spacing = Pt(spec.line_exact_pt)
    elif spec.line_spacing:
        fmt.line_spacing = spec.line_spacing


def _heading(doc, text: str, bold_center: bool = True):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold_center
    if bold_center:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    return p


def build(spec: Spec, path: Path) -> Path:
    doc = Document()
    _apply_base(doc, spec)
    if spec.title_page:
        for line, bold in (("Alfabetización informacional en la era digital", True), ("Estudiante Ficticia Uno", False),
                           ("Escuela de Ciencias de la Comunicación", False), ("Taller de Redacción Académica", False),
                           ("Docente Ficticio", False), ("24 de noviembre de 2026", False)):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run(line).bold = bold
        doc.paragraphs[-1].add_run().add_break(WD_BREAK.PAGE)
    _heading(doc, "Introducción")
    for i, text in enumerate(spec.body):
        p = doc.add_paragraph(text)
        if spec.body_indent_in is not None:
            p.paragraph_format.first_line_indent = Inches(spec.body_indent_in)
        if spec.block_quote and i == 0:
            q = doc.add_paragraph(spec.block_quote)
            q.paragraph_format.left_indent = Inches(0.5)
            q.paragraph_format.first_line_indent = Inches(0)
    if spec.extra_label:
        _heading(doc, spec.extra_label)
        doc.add_paragraph("Lecturas recomendadas por la cátedra para ampliar el tema.")
    if spec.references_label:
        h = _heading(doc, spec.references_label, spec.references_heading_bold_center)
        h.paragraph_format.page_break_before = True
        for ref in spec.references:
            p = doc.add_paragraph()
            _add_reference_runs(p, ref)
            if spec.hanging:
                p.paragraph_format.left_indent = Inches(0.5)
                p.paragraph_format.first_line_indent = Inches(-0.5)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    return path


def _add_reference_runs(p, ref: str) -> None:
    """Admite *cursiva* marcada con asteriscos para títulos."""
    parts = ref.split("*")
    for i, part in enumerate(parts):
        if part:
            p.add_run(part).italic = i % 2 == 1


GOOD_REFS = [
    "Castro, L. (2019). *Medios digitales y ciudadanía*. Editorial Ficticia.",
    "Martínez, R., & Ortiz, P. (2021). Lectura crítica en redes sociales. *Revista Ficticia de Comunicación, 12*(3), 45–60. https://doi.org/10.0000/rfc.2021.003",
    "Organización Ficticia para la Educación [OFE]. (2022). *Informe sobre competencias digitales*. https://ofe.example.org/informe",
    "Pérez, A., Gómez, J., & Ruiz, S. (2020). *Escribir en la universidad*. Ediciones Imaginarias.",
]

GOOD_BODY = [
    f"{LOREM}. Según Castro (2019), la ciudadanía digital requiere habilidades de verificación que se aprenden de forma gradual en el aula universitaria.",
    f"{LOREM}, tal como describen Martínez y Ortiz (2021) en su estudio sobre lectura crítica, y como recomienda la Organización Ficticia para la Educación [OFE] (2022).",
    f"Diversos equipos han documentado prácticas de escritura colaborativa en la universidad (Pérez et al., 2020). {LOREM}.",
]


def compliant() -> Spec:
    return Spec(body=GOOD_BODY, references=GOOD_REFS,
                block_quote=f"{LONG_QUOTE} (Castro, 2019, p. 14).")


def violations() -> Spec:
    return Spec(
        margins_cm=(2.54, 2.54, 3.5, 2.54),
        font="Arial",
        size=14,
        line_spacing=1.0,
        space_after_pt=8,
        body_indent_in=None,
        hanging=False,
        body=[
            f"{LOREM}. Como afirma Castro (2019), existe una brecha entre consumo y producción de contenidos.",
            f"El autor sostiene que “{LONG_QUOTE}” (Castro, 2019, p. 22). {LOREM}.",
            f"Otros trabajos discuten la desinformación en plataformas (Herrera, 2018). {LOREM}.",
        ],
        references=[
            "Pérez, A., Gómez, J., & Ruiz, S. (2020). *Escribir en la universidad*. Ediciones Imaginarias.",
            "Castro, L. (2019). *Medios digitales y ciudadanía*. Editorial Ficticia.",
        ],
    )


def ambiguous() -> Spec:
    return Spec(
        font="Comic Sans MS",
        size=11,
        line_spacing=None,
        line_exact_pt=24,
        references_label="Bibliografía",
        references_heading_bold_center=False,
        body=[
            f"{LOREM}. En la historia de los medios (1995) hubo cambios relevantes, señala Vega (2017) en un ensayo.",
            f"Un participante escribió: \"{LONG_QUOTE}\" y la discusión continuó con otros temas del curso.",
        ],
        references=[
            "Vega, M. (2017). *Historia breve de los medios*. Editorial Ficticia.",
            "Apuntes de clase sobre periodismo de datos y visualización en contextos locales.",
        ],
    )


def no_references() -> Spec:
    return Spec(references_label=None, body=GOOD_BODY[:2])


def demo() -> Spec:
    """Trabajo de demostración para Feria NODOS: mezcla aciertos y errores verificables."""
    return Spec(
        margins_cm=(2.54, 2.54, 2.54, 2.54),
        font="Calibri",
        size=11,
        line_spacing=1.5,
        body_indent_in=0.5,
        hanging=False,
        body=GOOD_BODY + [
            f"La investigadora explica que “{LONG_QUOTE}” (Castro, 2019, p. 30). {LOREM}.",
            f"Finalmente, se retoman aportes sobre audiencias jóvenes (Navarro, 2023). {LOREM}.",
        ],
        references=[GOOD_REFS[1], GOOD_REFS[0], GOOD_REFS[2], GOOD_REFS[3],
                    "Zamora, T. (2018). *Narrativas transmedia*. Editorial Ficticia."],
    )


FIXTURES = {
    "compliant.docx": compliant,
    "violations.docx": violations,
    "ambiguous.docx": ambiguous,
    "no_references.docx": no_references,
    "demo_trabajo_nodos.docx": demo,
}


def build_all(out_dir: Path = OUT_DIR) -> dict[str, Path]:
    return {name: build(factory(), out_dir / name) for name, factory in FIXTURES.items()}


if __name__ == "__main__":
    for name, path in build_all().items():
        print(f"{name}: {path}")
