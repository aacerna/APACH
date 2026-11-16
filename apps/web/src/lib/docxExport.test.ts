import JSZip from "jszip";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { buildReferencesDocument } from "./docxExport";

describe("exportación a Word", () => {
  it("conserva cursivas, doble espacio y sangría francesa", async () => {
    const doc = buildReferencesDocument([[{ text: "Castro, L. (2019). ", italic: false }, { text: "Medios digitales", italic: true }, { text: ". Editorial Ficticia.", italic: false }]]);
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Referencias");
    expect(xml).toMatch(/<w:ind w:left="720" w:hanging="720"\/>/);
    expect(xml).toMatch(/<w:spacing[^>]*w:line="480"/);
    expect(xml).toMatch(/<w:r><w:rPr>(?:(?!<\/w:rPr>).)*<w:i\/>(?:(?!<\/w:rPr>).)*<\/w:rPr><w:t xml:space="preserve">Medios digitales<\/w:t>/);
  });
});
