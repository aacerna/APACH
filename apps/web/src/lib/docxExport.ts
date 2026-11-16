/** Exportación de la lista de referencias a Word con cursivas semánticas, doble espacio y sangría francesa. */
import { AlignmentType, Document, LineRuleType, Packer, Paragraph, TextRun } from "docx";
import type { Segment } from "@shared/references";

const FONT = "Times New Roman";
const SIZE = 24; // medios puntos = 12 pt
const spacing = { line: 480, lineRule: LineRuleType.AUTO, before: 0, after: 0 };

export function buildReferencesDocument(entries: Segment[][]): Document {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing, children: [new TextRun({ text: "Referencias", bold: true, font: FONT, size: SIZE })] }),
    ...entries.map((segments) => new Paragraph({
      spacing,
      indent: { left: 720, hanging: 720 },
      children: segments.map((s) => new TextRun({ text: s.text, italics: s.italic, font: FONT, size: SIZE })),
    })),
  ];
  return new Document({
    creator: "APACH",
    title: "Referencias",
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
  });
}

export async function downloadReferencesDocx(entries: Segment[][], filename = "referencias-apa.docx") {
  const blob = await Packer.toBlob(buildReferencesDocument(entries));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
