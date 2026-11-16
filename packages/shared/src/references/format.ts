/**
 * Formateador APA 7 determinista, sin red ni IA. Fuente única para el generador web (offline).
 * Convenciones de idioma (ver docs/DECISIONES.md): referencias con «&» entre autores;
 * citas en el texto con «y»; fechas y rótulos en español («s. f.», «En», «(2.ª ed.)», «[Video]»).
 * No inventa datos: si falta información obligatoria devuelve errores por campo.
 */
import {
  GENERATOR_RULES_VERSION,
  type Author,
  type DateParts,
  type FormatResult,
  type PersonName,
  type ReferenceInput,
  type Segment,
} from "./types";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const stripEndPunct = (s: string) => clean(s).replace(/[.\s]+$/, "");

/** Añade punto final salvo que el texto ya termine en ? o ! (APA no duplica puntuación). */
function terminate(s: string): string {
  const t = clean(s);
  if (!t) return t;
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

export function initials(given: string): string {
  return clean(given)
    .split(" ")
    .filter(Boolean)
    .map((name) =>
      name
        .split("-")
        .map((part) => {
          const letter = part.replace(/[^\p{L}]/gu, "").charAt(0);
          return letter ? `${letter.toUpperCase()}.` : "";
        })
        .filter(Boolean)
        .join("-"),
    )
    .filter(Boolean)
    .join(" ");
}

function personInverted(a: { family: string; given: string }): string {
  const ini = initials(a.given);
  return ini ? `${clean(a.family)}, ${ini}` : clean(a.family);
}

function authorForReference(a: Author): string {
  if (a.kind === "group") return clean(a.name);
  return personInverted(a);
}

/** Lista de autores para la referencia: 1, 2 (con &), 3–20 (coma serial + &), 21+ (19 … último). */
export function formatAuthorList(authors: Author[]): string {
  const names = authors.map(authorForReference).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

function editorsList(editors: PersonName[]): string {
  const names = editors.map((e) => [initials(e.given), clean(e.family)].filter(Boolean).join(" ")).filter(Boolean);
  if (names.length === 0) return "";
  const joined = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return `${joined} (${names.length === 1 ? "Ed." : "Eds."})`;
}

export function yearLabel(d: DateParts): string {
  const suffix = clean(d.suffix).toLowerCase();
  if (d.noDate || !clean(d.year)) return suffix ? `s. f.-${suffix}` : "s. f.";
  return `${clean(d.year)}${suffix}`;
}

function dateLabel(d: DateParts, precise: boolean): string {
  const base = yearLabel(d);
  if (!precise || d.noDate || !clean(d.year) || !clean(d.month)) return `(${base})`;
  const month = MONTHS[Number(d.month) - 1];
  if (!month) return `(${base})`;
  const day = clean(d.day);
  return `(${base}, ${day ? `${Number(day)} de ` : ""}${month})`;
}

export function normalizeDoi(raw: string | undefined): string | undefined {
  const v = clean(raw);
  if (!v) return undefined;
  const m = v.match(/10\.\d{4,9}\/\S+/);
  return m ? `https://doi.org/${m[0].replace(/[.,;]+$/, "")}` : undefined;
}

function editionLabel(edition: string | undefined): string {
  const e = clean(edition);
  if (!e || e === "1") return "";
  return /^\d+$/.test(e) ? `${e}.ª ed.` : e;
}

function pagesLabel(pages: string | undefined): string {
  return clean(pages).replace(/\s*-+\s*/g, "–");
}

// ------------------------------------------------------------------ citas en el texto
function citationName(a: Author, withAbbreviation: boolean): string {
  if (a.kind === "person") return clean(a.family);
  const abbr = clean(a.abbreviation);
  return withAbbreviation && abbr ? `${clean(a.name)} [${abbr}]` : clean(a.name);
}

function citationAuthors(authors: Author[], firstCitation = true): string {
  if (authors.length === 0) return "";
  const first = authors[0];
  const useAbbr = !firstCitation && first.kind === "group" && clean(first.abbreviation);
  const firstName = useAbbr ? clean((first as { abbreviation?: string }).abbreviation) : citationName(first, firstCitation);
  if (authors.length === 1) return firstName;
  if (authors.length === 2) return `${firstName} y ${citationName(authors[1], false)}`;
  return `${firstName} et al.`;
}

function hasGroupAbbreviation(authors: Author[]): boolean {
  return authors.length > 0 && authors[0].kind === "group" && !!clean((authors[0] as { abbreviation?: string }).abbreviation);
}

// ------------------------------------------------------------------ validación
function validate(input: ReferenceInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!clean(input.title)) errors.title = "El título es obligatorio.";
  input.authors.forEach((a, i) => {
    if (a.kind === "person" && !clean(a.family)) errors[`authors.${i}`] = "Escribe el apellido o elimina este autor.";
    if (a.kind === "group" && !clean(a.name)) errors[`authors.${i}`] = "Escribe el nombre del grupo o institución.";
  });
  const y = clean(input.date.year);
  if (!input.date.noDate && !y) errors["date.year"] = "Indica el año o marca «Sin fecha».";
  if (y && !/^\d{4}$/.test(y)) errors["date.year"] = "El año debe tener 4 dígitos.";
  if (clean(input.date.month) && !(Number(input.date.month) >= 1 && Number(input.date.month) <= 12)) errors["date.month"] = "Mes inválido.";
  if (clean(input.date.day) && !(Number(input.date.day) >= 1 && Number(input.date.day) <= 31)) errors["date.day"] = "Día inválido.";
  if (clean(input.date.suffix) && !/^[a-z]$/i.test(clean(input.date.suffix))) errors["date.suffix"] = "Usa una sola letra (a, b, c…).";
  const urlFields: Array<[string, string | undefined]> = [["url", (input as { url?: string }).url]];
  for (const [field, value] of urlFields) {
    if (clean(value) && !/^https?:\/\/\S+\.\S+/.test(clean(value))) errors[field] = "Escribe una URL completa (https://…).";
  }
  if ("doi" in input && clean(input.doi) && !normalizeDoi(input.doi)) errors.doi = "El DOI debe tener la forma 10.xxxx/xxxxx.";
  switch (input.source_type) {
    case "chapter":
      if (!clean(input.book_title)) errors.book_title = "El título del libro es obligatorio.";
      break;
    case "journal_article":
      if (!clean(input.journal)) errors.journal = "El nombre de la revista es obligatorio.";
      break;
    case "webpage":
      if (!clean(input.url)) errors.url = "La URL es obligatoria para páginas web.";
      break;
    case "thesis":
      if (!clean(input.institution)) errors.institution = "La institución es obligatoria.";
      break;
    case "online_video":
      if (!clean(input.platform)) errors.platform = "Indica la plataforma (por ejemplo, YouTube).";
      if (!clean(input.url)) errors.url = "La URL del video es obligatoria.";
      break;
    case "newspaper_article":
      if (!clean(input.newspaper)) errors.newspaper = "El nombre del periódico es obligatorio.";
      break;
  }
  return errors;
}

function titleCaseWarning(title: string, field: string): string | null {
  const words = clean(title).split(" ").filter((w) => /^\p{L}/u.test(w));
  if (words.length < 4) return null;
  const capitalized = words.slice(1).filter((w) => /^\p{Lu}/u.test(w)).length;
  return capitalized / (words.length - 1) > 0.5
    ? `Revisa ${field}: en la referencia APA se escribe en tipo oración (solo mayúscula inicial y nombres propios). APACH no lo cambia automáticamente.`
    : null;
}

// ------------------------------------------------------------------ formateo principal
export function formatReference(input: ReferenceInput): FormatResult {
  const errors = validate(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const warnings: string[] = [];
  const segs: Segment[] = [];
  const push = (text: string, italic = false) => {
    if (text) segs.push({ text, italic });
  };
  const authors = input.authors.filter((a) => (a.kind === "person" ? clean(a.family) : clean(a.name)));
  const authorText = formatAuthorList(authors);
  const precise = ["webpage", "online_video", "newspaper_article"].includes(input.source_type);
  const date = dateLabel(input.date, precise);
  const italicTitle = !["chapter", "journal_article", "newspaper_article"].includes(input.source_type);
  const title = stripEndPunct(input.title);
  const titleWarning = titleCaseWarning(title, "el título");
  if (titleWarning) warnings.push(titleWarning);

  // Bloque de título con su descripción entre corchetes o paréntesis.
  const titleBlock = (): void => {
    const extra: string[] = [];
    let bracket = "";
    switch (input.source_type) {
      case "book": {
        const ed = editionLabel(input.edition);
        if (ed) extra.push(`(${ed})`);
        break;
      }
      case "report":
        if (clean(input.report_number)) extra.push(`(Informe n.º ${clean(input.report_number)})`);
        break;
      case "thesis": {
        const degree = { licenciatura: "Tesis de licenciatura", maestria: "Tesis de maestría", doctorado: "Tesis doctoral" }[input.degree];
        bracket = `[${degree}${input.published ? "" : " no publicada"}, ${clean(input.institution)}]`;
        break;
      }
      case "online_video":
        bracket = "[Video]";
        break;
    }
    if (italicTitle) {
      push(title, true);
      const tail = [...extra, bracket].filter(Boolean).join(" ");
      push(tail ? ` ${tail}. ` : /[?!]$/.test(title) ? " " : ". ");
    } else {
      push(`${terminate(title)} `);
    }
  };

  if (authorText) {
    push(`${terminate(authorText)} ${date}. `);
    titleBlock();
  } else {
    // Sin autor: el título pasa a la posición del autor.
    warnings.push("Sin autor: el título ocupa la posición del autor. Verifica que la obra realmente no indique autor ni institución responsable.");
    titleBlock();
    push(`${date}. `);
  }

  const doi = "doi" in input ? normalizeDoi(input.doi) : undefined;
  const url = clean((input as { url?: string }).url);
  const link = doi ?? (url || undefined);

  switch (input.source_type) {
    case "book":
    case "report": {
      const publisher = clean(input.publisher);
      const groupNames = authors.filter((a) => a.kind === "group").map((a) => clean((a as { name: string }).name).toLowerCase());
      if (publisher && !groupNames.includes(publisher.toLowerCase())) push(`${terminate(publisher)} `);
      if (input.source_type === "book" && !publisher) warnings.push("Falta la editorial. Si la obra no la indica, revisa la fuente original.");
      break;
    }
    case "chapter": {
      const eds = editorsList(input.editors.filter((e) => clean(e.family)));
      push(eds ? `En ${eds}, ` : "En ");
      push(stripEndPunct(input.book_title), true);
      const parts = [editionLabel(input.edition), clean(input.pages) ? `pp. ${pagesLabel(input.pages)}` : ""].filter(Boolean);
      push(parts.length ? ` (${parts.join(", ")}). ` : ". ");
      if (clean(input.publisher)) push(`${terminate(input.publisher!)} `);
      if (!eds) warnings.push("No indicaste editores del libro; agrégalos si la obra los menciona.");
      break;
    }
    case "journal_article": {
      const volume = clean(input.volume);
      push(stripEndPunct(input.journal) + (volume ? `, ${volume}` : ""), true);
      if (clean(input.issue)) push(`(${clean(input.issue)})`);
      if (clean(input.article_number)) push(`, Artículo ${clean(input.article_number)}`);
      else if (clean(input.pages)) push(`, ${pagesLabel(input.pages)}`);
      push(". ");
      if (!volume) warnings.push("Falta el volumen de la revista.");
      if (!doi && !url) warnings.push("Si el artículo tiene DOI, inclúyelo; es el identificador preferido por APA 7.");
      break;
    }
    case "webpage": {
      const site = clean(input.site_name);
      const authorNames = authors.map((a) => (a.kind === "group" ? clean(a.name).toLowerCase() : ""));
      if (site && !authorNames.includes(site.toLowerCase())) push(`${terminate(site)} `);
      if (clean(input.retrieved)) {
        const [y, m, d] = clean(input.retrieved).split("-");
        const month = MONTHS[Number(m) - 1];
        if (y && month && d) {
          push(`Recuperado el ${Number(d)} de ${month} de ${y}, de ${url}`);
          return finish();
        }
      }
      break;
    }
    case "thesis":
      if (clean(input.repository)) push(`${terminate(input.repository!)} `);
      break;
    case "online_video":
      push(`${terminate(input.platform)} `);
      break;
    case "newspaper_article":
      push(stripEndPunct(input.newspaper), true);
      push(clean(input.pages) && !url ? `, ${pagesLabel(input.pages)}. ` : ". ");
      break;
  }
  if (link) push(link);
  return finish();

  function finish(): FormatResult {
    // Normaliza espacios finales y fusiona segmentos contiguos con el mismo estilo.
    const merged: Segment[] = [];
    for (const s of segs) {
      const last = merged[merged.length - 1];
      if (last && last.italic === s.italic) last.text += s.text;
      else merged.push({ ...s });
    }
    if (merged.length) merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, "");

    const year = yearLabel(input.date);
    let parenthetical: string;
    let narrative: string;
    let subsequent: string | undefined;
    if (authors.length) {
      const first = citationAuthors(authors, true);
      parenthetical = `(${first}, ${year})`;
      narrative = authors[0].kind === "group" && hasGroupAbbreviation(authors)
        ? `${citationName(authors[0], false)} (${clean((authors[0] as { abbreviation?: string }).abbreviation)}, ${year})`
        : `${first} (${year})`;
      if (hasGroupAbbreviation(authors)) subsequent = `(${citationAuthors(authors, false)}, ${year})`;
    } else {
      const shortTitle = title.split(" ").slice(0, 6).join(" ") + (title.split(" ").length > 6 ? "…" : "");
      const quoted = italicTitle ? shortTitle : `“${shortTitle}”`;
      parenthetical = `(${quoted}, ${year})`;
      narrative = `${quoted} (${year})`;
      if (italicTitle) warnings.push("En la cita sin autor, escribe el título en cursiva.");
    }
    if (input.date.noDate) warnings.push("Obra sin fecha: se usa «s. f.». Confirma que la fuente realmente no indica año.");
    return {
      ok: true,
      output: {
        segments: merged,
        parenthetical_citation: parenthetical,
        narrative_citation: narrative,
        subsequent_parenthetical: subsequent,
        warnings,
        rules_version: GENERATOR_RULES_VERSION,
      },
    };
  }
}

export function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => s.text).join("");
}

/** Clave de ordenación APA: primer apellido/grupo, luego resto, luego año (s. f. primero). */
export function referenceSortKey(input: ReferenceInput): string {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const first = input.authors[0];
  const head = first ? (first.kind === "group" ? norm(first.name) : norm(first.family)) : norm(input.title.replace(/^(el|la|los|las|un|una|the|a|an)\s+/i, ""));
  const rest = input.authors.slice(1).map((a) => (a.kind === "group" ? norm(a.name) : norm(a.family))).join(" ");
  const year = input.date.noDate || !input.date.year ? "0000" : input.date.year;
  return `${head}\u0000${first?.kind === "person" ? norm(first.given) : ""}\u0000${rest}\u0000${year}${input.date.suffix ?? ""}`;
}
