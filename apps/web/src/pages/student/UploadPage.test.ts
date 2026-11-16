import { describe, expect, it } from "vitest";
import { validateFile } from "./UploadPage";

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

describe("validación previa del archivo", () => {
  it("acepta .docx y rechaza otros formatos, vacíos o grandes", () => {
    expect(validateFile(file("trabajo.docx", 2048))).toBeNull();
    expect(validateFile(file("trabajo.doc", 2048))).toMatch(/\.docx/);
    expect(validateFile(file("trabajo.pdf", 2048))).toMatch(/\.docx/);
    expect(validateFile(file("vacio.docx", 0))).toMatch(/vacío/);
    expect(validateFile(file("grande.docx", 11 * 1024 * 1024))).toMatch(/10 MB/);
    expect(validateFile(null)).toMatch(/Selecciona/);
  });
});
