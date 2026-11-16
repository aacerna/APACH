/** Modelo estructurado de referencias APA 7. Se guarda la entrada, nunca HTML. */

export const GENERATOR_RULES_VERSION = "apa7-gen-2026.11.1";

export type PersonAuthor = { kind: "person"; family: string; given: string };
export type GroupAuthor = { kind: "group"; name: string; abbreviation?: string };
export type Author = PersonAuthor | GroupAuthor;

export type PersonName = { family: string; given: string };

export type DateParts = {
  /** Año de publicación (4 dígitos). Vacío + noDate=true => «s. f.». */
  year?: string;
  month?: string; // 1-12
  day?: string;
  noDate?: boolean;
  /** Sufijo para obras del mismo autor y año: a, b, c… */
  suffix?: string;
};

type Common = {
  authors: Author[];
  date: DateParts;
  title: string;
};

export type BookInput = Common & {
  source_type: "book";
  edition?: string;
  publisher?: string;
  doi?: string;
  url?: string;
};

export type ChapterInput = Common & {
  source_type: "chapter";
  editors: PersonName[];
  book_title: string;
  pages?: string;
  edition?: string;
  publisher?: string;
  doi?: string;
  url?: string;
};

export type JournalArticleInput = Common & {
  source_type: "journal_article";
  journal: string;
  volume?: string;
  issue?: string;
  pages?: string;
  article_number?: string;
  doi?: string;
  url?: string;
};

export type WebpageInput = Common & {
  source_type: "webpage";
  site_name?: string;
  url: string;
  retrieved?: string; // AAAA-MM-DD, solo si el contenido cambia con el tiempo
};

export type ThesisInput = Common & {
  source_type: "thesis";
  degree: "licenciatura" | "maestria" | "doctorado";
  institution: string;
  published: boolean;
  repository?: string;
  url?: string;
};

export type OnlineVideoInput = Common & {
  source_type: "online_video";
  channel?: string;
  platform: string;
  url: string;
};

export type NewspaperArticleInput = Common & {
  source_type: "newspaper_article";
  newspaper: string;
  pages?: string;
  url?: string;
};

export type ReportInput = Common & {
  source_type: "report";
  report_number?: string;
  publisher?: string;
  url?: string;
};

export type ReferenceInput =
  | BookInput
  | ChapterInput
  | JournalArticleInput
  | WebpageInput
  | ThesisInput
  | OnlineVideoInput
  | NewspaperArticleInput
  | ReportInput;

export type SourceType = ReferenceInput["source_type"];

export type Segment = { text: string; italic: boolean };

export type ReferenceOutput = {
  segments: Segment[];
  parenthetical_citation: string;
  narrative_citation: string;
  /** Forma abreviada para citas posteriores (autores corporativos con sigla). */
  subsequent_parenthetical?: string;
  warnings: string[];
  rules_version: string;
};

export type FormatResult =
  | { ok: true; output: ReferenceOutput }
  | { ok: false; errors: Record<string, string> };
