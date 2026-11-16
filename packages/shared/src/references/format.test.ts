/**
 * Pruebas golden. Las salidas esperadas aplican APA 7 (Manual, 7.ª ed., cap. 9–10): autores 1/2/3–20/21+,
 * autor corporativo, sin fecha («s. f.»), DOI como https://doi.org/, cursivas por tipo de fuente.
 * Convenciones en español documentadas en docs/DECISIONES.md. Todos los datos son ficticios.
 */
import { describe, expect, it } from "vitest";
import { CATALOG, formatReference, initials, normalizeDoi, referenceSortKey, segmentsToText, type ReferenceInput } from "./index";

const person = (family: string, given: string) => ({ kind: "person" as const, family, given });
const group = (name: string, abbreviation?: string) => ({ kind: "group" as const, name, abbreviation });

function fmt(input: ReferenceInput) {
  const r = formatReference(input);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.output;
}

describe("autores", () => {
  it("genera iniciales, incluidos nombres compuestos con guion", () => {
    expect(initials("Luisa María")).toBe("L. M.");
    expect(initials("Jean-Paul")).toBe("J.-P.");
    expect(initials("  ")).toBe("");
  });

  it("libro de un autor", () => {
    const out = fmt({ source_type: "book", authors: [person("Castro", "Luisa")], date: { year: "2019" }, title: "Medios digitales y ciudadanía", publisher: "Editorial Ficticia" });
    expect(segmentsToText(out.segments)).toBe("Castro, L. (2019). Medios digitales y ciudadanía. Editorial Ficticia.");
    expect(out.segments).toEqual([
      { text: "Castro, L. (2019). ", italic: false },
      { text: "Medios digitales y ciudadanía", italic: true },
      { text: ". Editorial Ficticia.", italic: false },
    ]);
    expect(out.parenthetical_citation).toBe("(Castro, 2019)");
    expect(out.narrative_citation).toBe("Castro (2019)");
  });

  it("dos autores: & en referencia, y en citas", () => {
    const out = fmt({ source_type: "book", authors: [person("Martínez", "Rosa"), person("Ortiz", "Pablo")], date: { year: "2021" }, title: "Escribir", publisher: "Editorial Ficticia" });
    expect(segmentsToText(out.segments)).toMatch(/^Martínez, R., & Ortiz, P\. \(2021\)\./);
    expect(out.parenthetical_citation).toBe("(Martínez y Ortiz, 2021)");
    expect(out.narrative_citation).toBe("Martínez y Ortiz (2021)");
  });

  it("tres autores: coma serial y et al. en citas", () => {
    const out = fmt({ source_type: "book", authors: [person("Pérez", "Ana"), person("Gómez", "Juan"), person("Ruiz", "Sara")], date: { year: "2020" }, title: "Escribir en la universidad", publisher: "Ediciones Imaginarias" });
    expect(segmentsToText(out.segments)).toBe("Pérez, A., Gómez, J., & Ruiz, S. (2020). Escribir en la universidad. Ediciones Imaginarias.");
    expect(out.parenthetical_citation).toBe("(Pérez et al., 2020)");
  });

  it("21 o más autores: 19 primeros, puntos suspensivos y el último", () => {
    const authors = Array.from({ length: 22 }, (_, i) => person(`Autor${i + 1}`, "Ana"));
    const text = segmentsToText(fmt({ source_type: "book", authors, date: { year: "2020" }, title: "Obra colectiva", publisher: "Editorial Ficticia" }).segments);
    expect(text).toContain("Autor19, A., . . . Autor22, A. (2020)");
    expect(text).not.toContain("Autor20");
  });

  it("autor corporativo con sigla y editorial igual al autor", () => {
    const out = fmt({ source_type: "report", authors: [group("Organización Ficticia para la Educación", "OFE")], date: { year: "2022" }, title: "Informe sobre competencias digitales", report_number: "7", publisher: "Organización Ficticia para la Educación", url: "https://ofe.example.org/informe" });
    expect(segmentsToText(out.segments)).toBe("Organización Ficticia para la Educación. (2022). Informe sobre competencias digitales (Informe n.º 7). https://ofe.example.org/informe");
    expect(out.parenthetical_citation).toBe("(Organización Ficticia para la Educación [OFE], 2022)");
    expect(out.subsequent_parenthetical).toBe("(OFE, 2022)");
    expect(out.narrative_citation).toBe("Organización Ficticia para la Educación (OFE, 2022)");
  });
});

describe("fechas", () => {
  it("sin fecha usa s. f. y advierte", () => {
    const out = fmt({ source_type: "webpage", authors: [person("Navarro", "Teresa")], date: { noDate: true }, title: "Cómo verificar una imagen", site_name: "Observatorio Ficticio", url: "https://obs.example.org/v" });
    expect(segmentsToText(out.segments)).toBe("Navarro, T. (s. f.). Cómo verificar una imagen. Observatorio Ficticio. https://obs.example.org/v");
    expect(out.parenthetical_citation).toBe("(Navarro, s. f.)");
    expect(out.warnings.some((w) => w.includes("s. f."))).toBe(true);
  });

  it("fecha completa para páginas web, sufijo de año", () => {
    const out = fmt({ source_type: "webpage", authors: [person("Navarro", "Teresa")], date: { year: "2023", month: "5", day: "4", suffix: "b" }, title: "Cómo verificar una imagen viral", site_name: "Observatorio Ficticio de Medios", url: "https://observatorio.example.org/verificar" });
    expect(segmentsToText(out.segments)).toBe("Navarro, T. (2023b, 4 de mayo). Cómo verificar una imagen viral. Observatorio Ficticio de Medios. https://observatorio.example.org/verificar");
    expect(out.parenthetical_citation).toBe("(Navarro, 2023b)");
  });
});

describe("tipos de fuente", () => {
  it("artículo con DOI: revista y volumen en cursiva, número en redonda", () => {
    const out = fmt({ source_type: "journal_article", authors: [person("Martínez", "Rosa"), person("Ortiz", "Pablo")], date: { year: "2021" }, title: "Lectura crítica en redes sociales", journal: "Revista Ficticia de Comunicación", volume: "12", issue: "3", pages: "45-60", doi: "doi:10.0000/rfc.2021.003" });
    expect(segmentsToText(out.segments)).toBe("Martínez, R., & Ortiz, P. (2021). Lectura crítica en redes sociales. Revista Ficticia de Comunicación, 12(3), 45–60. https://doi.org/10.0000/rfc.2021.003");
    expect(out.segments.find((s) => s.italic)?.text).toBe("Revista Ficticia de Comunicación, 12");
  });

  it("artículo con URL y número de artículo, sin DOI", () => {
    const out = fmt({ source_type: "journal_article", authors: [person("Soto", "Elena")], date: { year: "2024" }, title: "Audiencias jóvenes", journal: "Revista Ejemplo", volume: "5", article_number: "e123", url: "https://revista.example.org/e123" });
    expect(segmentsToText(out.segments)).toBe("Soto, E. (2024). Audiencias jóvenes. Revista Ejemplo, 5, Artículo e123. https://revista.example.org/e123");
  });

  it("video en línea con [Video] y plataforma", () => {
    const out = fmt({ source_type: "online_video", authors: [group("Laboratorio Ficticio de Medios")], date: { year: "2024", month: "2", day: "12" }, title: "Introducción al periodismo de datos", platform: "YouTube", url: "https://www.youtube.com/watch?v=ejemplo" });
    expect(segmentsToText(out.segments)).toBe("Laboratorio Ficticio de Medios. (2024, 12 de febrero). Introducción al periodismo de datos [Video]. YouTube. https://www.youtube.com/watch?v=ejemplo");
  });

  it("capítulo de libro editado", () => {
    const out = fmt({ source_type: "chapter", authors: [person("Ruiz", "Sara")], date: { year: "2020" }, title: "Narrativas juveniles en plataformas", editors: [{ family: "Vega", given: "Mónica" }], book_title: "Comunicación y cultura digital", pages: "33-58", publisher: "Ediciones Imaginarias" });
    expect(segmentsToText(out.segments)).toBe("Ruiz, S. (2020). Narrativas juveniles en plataformas. En M. Vega (Ed.), Comunicación y cultura digital (pp. 33–58). Ediciones Imaginarias.");
  });

  it("tesis de maestría publicada y libro con edición", () => {
    const thesis = fmt({ source_type: "thesis", authors: [person("López", "Marta")], date: { year: "2022" }, title: "Uso de podcasts en el aula universitaria", degree: "maestria", institution: "Universidad Ficticia", published: true, repository: "Repositorio Institucional Ficticio", url: "https://repositorio.example.edu/123" });
    expect(segmentsToText(thesis.segments)).toBe("López, M. (2022). Uso de podcasts en el aula universitaria [Tesis de maestría, Universidad Ficticia]. Repositorio Institucional Ficticio. https://repositorio.example.edu/123");
    const book = fmt({ source_type: "book", authors: [person("Castro", "Luisa")], date: { year: "2019" }, title: "Medios digitales", edition: "2", publisher: "Editorial Ficticia" });
    expect(segmentsToText(book.segments)).toBe("Castro, L. (2019). Medios digitales (2.ª ed.). Editorial Ficticia.");
  });

  it("artículo periodístico en línea", () => {
    const out = fmt({ source_type: "newspaper_article", authors: [person("Herrera", "Diego")], date: { year: "2025", month: "8", day: "8" }, title: "Jóvenes y noticias en redes", newspaper: "Diario Ficticio", url: "https://diario.example.com/j" });
    expect(segmentsToText(out.segments)).toBe("Herrera, D. (2025, 8 de agosto). Jóvenes y noticias en redes. Diario Ficticio. https://diario.example.com/j");
  });

  it("sin autor: el título pasa a la posición del autor", () => {
    const out = fmt({ source_type: "webpage", authors: [], date: { year: "2020" }, title: "Guía breve de verificación", site_name: "Sitio Ficticio", url: "https://sitio.example.org/guia" });
    expect(segmentsToText(out.segments)).toBe("Guía breve de verificación. (2020). Sitio Ficticio. https://sitio.example.org/guia");
    expect(out.parenthetical_citation).toBe("(Guía breve de verificación, 2020)");
  });

  it("título que termina en signo de interrogación no duplica puntuación", () => {
    const out = fmt({ source_type: "book", authors: [person("Castro", "Luisa")], date: { year: "2019" }, title: "¿Qué es la ciudadanía digital?", publisher: "Editorial Ficticia" });
    expect(segmentsToText(out.segments)).toBe("Castro, L. (2019). ¿Qué es la ciudadanía digital? Editorial Ficticia.");
  });
});

describe("validación sin inventar datos", () => {
  it("exige título, año o «sin fecha», y campos propios del tipo", () => {
    const r = formatReference({ source_type: "journal_article", authors: [person("", "Ana")], date: {}, title: "", journal: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["authors.0", "date.year", "journal", "title"]);
  });

  it("rechaza DOI y URL mal formados", () => {
    const r = formatReference({ source_type: "book", authors: [person("Castro", "L")], date: { year: "2019" }, title: "X", doi: "no-es-doi", url: "sitio" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toMatchObject({ doi: expect.any(String), url: expect.any(String) });
    expect(normalizeDoi("https://doi.org/10.1234/ABC.5")).toBe("https://doi.org/10.1234/ABC.5");
  });

  it("advierte sobre títulos en mayúsculas iniciales sin modificarlos", () => {
    const out = fmt({ source_type: "book", authors: [person("Castro", "L")], date: { year: "2019" }, title: "Medios Digitales Y Ciudadanía Activa", publisher: "E" });
    expect(segmentsToText(out.segments)).toContain("Medios Digitales Y Ciudadanía Activa");
    expect(out.warnings.some((w) => w.includes("tipo oración"))).toBe(true);
  });
});

describe("orden y catálogo", () => {
  it("nada precede a algo y años ascendentes", () => {
    const a = referenceSortKey({ source_type: "book", authors: [person("Pérez", "Zoe")], date: { year: "2018" }, title: "x" });
    const b = referenceSortKey({ source_type: "book", authors: [person("Pérez García", "Ana")], date: { year: "2016" }, title: "x" });
    const c = referenceSortKey({ source_type: "book", authors: [person("Pérez", "Zoe")], date: { noDate: true }, title: "y" });
    expect([b, a, c].sort()).toEqual([c, a, b]);
  });

  it("cada entrada implementada tiene source_type y las no implementadas no lo tienen", () => {
    for (const e of CATALOG) expect(Boolean(e.source_type)).toBe(e.implemented);
    expect(CATALOG.filter((e) => e.implemented).map((e) => e.id).sort()).toEqual(
      ["book", "chapter", "journal_article", "newspaper_article", "online_video", "report", "thesis", "webpage"]);
  });
});
