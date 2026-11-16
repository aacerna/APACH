import data from "@content/guides.json";

export type Guide = {
  slug: string; title: string; category: string; version: string; summary: string; what: string; how: string[];
  example: { label: string; text: string }; common_errors: string[]; fix: string[]; ecc_pending?: boolean;
};
export const GUIDES = data.guides as Guide[];
export const GUIDE_CATEGORIES = data.categories as Array<{ id: string; label: string }>;
export const GUIDE_SOURCE_NOTE = data.source_note as string;
export const ECC_NOTE = data.ecc_note as string;
export const guideBySlug = (slug: string | null | undefined) => GUIDES.find((g) => g.slug === slug);
export const RULE_NAMES: Record<string, string> = {
  "APA-01": "Márgenes", "APA-02": "Fuente y tamaño", "APA-03": "Interlineado", "APA-04": "Sangría de primera línea",
  "APA-05": "Sección de referencias", "APA-06": "Sangría francesa", "APA-07": "Orden alfabético", "APA-08": "Citas sin referencia",
  "APA-09": "Referencias sin cita", "APA-10": "Citas de 40 palabras o más",
};
