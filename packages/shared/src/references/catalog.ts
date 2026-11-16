/** Catálogo «Explora las referencias APA». Fuente única para el generador y las fichas. Ejemplos ficticios. */
import type { SourceType } from "./types";

export type FieldDef = {
  name: string;
  label: string;
  kind: "text" | "url" | "select" | "checkbox" | "date";
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type CategoryId = "libros" | "articulos" | "web" | "tesis-informes" | "redes" | "audiovisuales" | "software-ia" | "especiales";

export const CATEGORIES: Array<{ id: CategoryId; label: string }> = [
  { id: "libros", label: "Libros y capítulos" },
  { id: "articulos", label: "Artículos" },
  { id: "web", label: "Páginas web" },
  { id: "tesis-informes", label: "Tesis e informes" },
  { id: "redes", label: "Redes sociales" },
  { id: "audiovisuales", label: "Audiovisuales" },
  { id: "software-ia", label: "Software e IA" },
  { id: "especiales", label: "Casos especiales" },
];

export type CatalogEntry = {
  id: string;
  label: string;
  category: CategoryId;
  /** true: existe formulario y pruebas en el generador. false: solo ficha informativa. */
  implemented: boolean;
  source_type?: SourceType;
  when: string;
  structure: string;
  example: string;
  narrative: string;
  parenthetical: string;
  fields: FieldDef[];
  /** Usa fecha completa (año, mes, día). */
  preciseDate?: boolean;
  keywords: string[];
};

const doi: FieldDef = { name: "doi", label: "DOI", kind: "text", placeholder: "10.1234/abcd.2021.003", help: "Identificador digital. Si existe, se prefiere a la URL." };
const url: FieldDef = { name: "url", label: "URL", kind: "url", placeholder: "https://…" };

export const CATALOG: CatalogEntry[] = [
  {
    id: "book", source_type: "book", label: "Libro", category: "libros", implemented: true,
    when: "Obras completas publicadas por una editorial, impresas o digitales.",
    structure: "Autor, A. A. (Año). Título del libro en cursiva (ed.). Editorial. DOI o URL",
    example: "Castro, L. (2019). Medios digitales y ciudadanía (2.ª ed.). Editorial Ficticia.",
    narrative: "Castro (2019)", parenthetical: "(Castro, 2019)",
    fields: [
      { name: "edition", label: "Edición", kind: "text", placeholder: "2", help: "Solo si no es la primera edición." },
      { name: "publisher", label: "Editorial", kind: "text" },
      doi, url,
    ],
    keywords: ["libro", "ebook", "editorial", "manual"],
  },
  {
    id: "chapter", source_type: "chapter", label: "Capítulo de libro editado", category: "libros", implemented: true,
    when: "Capítulos escritos por autores distintos dentro de un libro con editores.",
    structure: "Autor, A. A. (Año). Título del capítulo. En E. Editor (Ed.), Título del libro (pp. xx–xx). Editorial.",
    example: "Ruiz, S. (2020). Narrativas juveniles en plataformas. En M. Vega (Ed.), Comunicación y cultura digital (pp. 33–58). Ediciones Imaginarias.",
    narrative: "Ruiz (2020)", parenthetical: "(Ruiz, 2020)",
    fields: [
      { name: "book_title", label: "Título del libro", kind: "text", required: true },
      { name: "pages", label: "Páginas del capítulo", kind: "text", placeholder: "33-58" },
      { name: "edition", label: "Edición", kind: "text" },
      { name: "publisher", label: "Editorial", kind: "text" },
      doi, url,
    ],
    keywords: ["capítulo", "compilación", "editor"],
  },
  {
    id: "journal_article", source_type: "journal_article", label: "Artículo de revista académica", category: "articulos", implemented: true,
    when: "Artículos publicados en revistas científicas o académicas.",
    structure: "Autor, A. A., & Autor, B. B. (Año). Título del artículo. Nombre de la Revista, volumen(número), páginas. https://doi.org/xxxx",
    example: "Martínez, R., & Ortiz, P. (2021). Lectura crítica en redes sociales. Revista Ficticia de Comunicación, 12(3), 45–60. https://doi.org/10.0000/rfc.2021.003",
    narrative: "Martínez y Ortiz (2021)", parenthetical: "(Martínez y Ortiz, 2021)",
    fields: [
      { name: "journal", label: "Nombre de la revista", kind: "text", required: true },
      { name: "volume", label: "Volumen", kind: "text" },
      { name: "issue", label: "Número", kind: "text" },
      { name: "pages", label: "Páginas", kind: "text", placeholder: "45-60" },
      { name: "article_number", label: "Número de artículo", kind: "text", help: "Solo si la revista usa números de artículo en lugar de páginas." },
      doi, url,
    ],
    keywords: ["revista", "paper", "artículo científico", "doi", "journal"],
  },
  {
    id: "webpage", source_type: "webpage", label: "Página web", category: "web", implemented: true, preciseDate: true,
    when: "Contenido de un sitio web que no encaja en otra categoría (noticias, blogs y videos tienen formato propio).",
    structure: "Autor, A. A. (Año, día de mes). Título de la página en cursiva. Nombre del sitio. URL",
    example: "Navarro, T. (2023, 4 de mayo). Cómo verificar una imagen viral. Observatorio Ficticio de Medios. https://observatorio.example.org/verificar",
    narrative: "Navarro (2023)", parenthetical: "(Navarro, 2023)",
    fields: [
      { name: "site_name", label: "Nombre del sitio", kind: "text", help: "Se omite si coincide con el autor." },
      { ...url, required: true },
      { name: "retrieved", label: "Fecha de consulta", kind: "date", help: "Solo si el contenido cambia con frecuencia y no está archivado." },
    ],
    keywords: ["sitio", "web", "internet", "página"],
  },
  {
    id: "thesis", source_type: "thesis", label: "Tesis o trabajo de grado", category: "tesis-informes", implemented: true,
    when: "Tesis de licenciatura, maestría o doctorado, publicadas en repositorios o inéditas.",
    structure: "Autor, A. A. (Año). Título de la tesis [Tesis de maestría, Institución]. Repositorio. URL",
    example: "López, M. (2022). Uso de podcasts en el aula universitaria [Tesis de maestría, Universidad Ficticia]. Repositorio Institucional Ficticio. https://repositorio.example.edu/123",
    narrative: "López (2022)", parenthetical: "(López, 2022)",
    fields: [
      { name: "degree", label: "Grado", kind: "select", required: true, options: [
        { value: "licenciatura", label: "Licenciatura" }, { value: "maestria", label: "Maestría" }, { value: "doctorado", label: "Doctorado" }] },
      { name: "institution", label: "Institución que otorga el grado", kind: "text", required: true },
      { name: "published", label: "Publicada en un repositorio o base de datos", kind: "checkbox" },
      { name: "repository", label: "Repositorio o base de datos", kind: "text" },
      url,
    ],
    keywords: ["tesis", "trabajo de graduación", "tesina", "repositorio"],
  },
  {
    id: "online_video", source_type: "online_video", label: "Video en línea", category: "audiovisuales", implemented: true, preciseDate: true,
    when: "Videos publicados en plataformas como YouTube o Vimeo.",
    structure: "Autor o canal. (Año, día de mes). Título del video en cursiva [Video]. Plataforma. URL",
    example: "Laboratorio Ficticio de Medios. (2024, 12 de febrero). Introducción al periodismo de datos [Video]. YouTube. https://www.youtube.com/watch?v=ejemplo",
    narrative: "Laboratorio Ficticio de Medios (2024)", parenthetical: "(Laboratorio Ficticio de Medios, 2024)",
    fields: [
      { name: "platform", label: "Plataforma", kind: "text", required: true, placeholder: "YouTube" },
      { ...url, required: true },
    ],
    keywords: ["youtube", "video", "vimeo", "canal"],
  },
  {
    id: "newspaper_article", source_type: "newspaper_article", label: "Artículo periodístico", category: "articulos", implemented: true, preciseDate: true,
    when: "Noticias, reportajes y columnas de periódicos impresos o digitales.",
    structure: "Autor, A. A. (Año, día de mes). Título del artículo. Nombre del Periódico. URL",
    example: "Herrera, D. (2025, 8 de agosto). Jóvenes y noticias en redes. Diario Ficticio. https://diario.example.com/jovenes-noticias",
    narrative: "Herrera (2025)", parenthetical: "(Herrera, 2025)",
    fields: [
      { name: "newspaper", label: "Nombre del periódico", kind: "text", required: true },
      { name: "pages", label: "Páginas (solo versión impresa)", kind: "text" },
      url,
    ],
    keywords: ["periódico", "noticia", "diario", "prensa"],
  },
  {
    id: "report", source_type: "report", label: "Informe institucional", category: "tesis-informes", implemented: true,
    when: "Informes de organismos, ministerios u organizaciones.",
    structure: "Organización. (Año). Título del informe en cursiva (Informe n.º xx). Editorial si es distinta. URL",
    example: "Organización Ficticia para la Educación. (2022). Informe sobre competencias digitales (Informe n.º 7). https://ofe.example.org/informe",
    narrative: "Organización Ficticia para la Educación (2022)", parenthetical: "(Organización Ficticia para la Educación, 2022)",
    fields: [
      { name: "report_number", label: "Número de informe", kind: "text" },
      { name: "publisher", label: "Editorial (si es distinta del autor)", kind: "text" },
      url,
    ],
    keywords: ["informe", "reporte", "ministerio", "organización"],
  },
  // ---------------- Fichas informativas (sin generador todavía)
  {
    id: "social_post", label: "Publicación en redes sociales", category: "redes", implemented: false,
    when: "Publicaciones de X, Instagram, Facebook o TikTok.",
    structure: "Autor [@usuario]. (Año, día de mes). Primeras 20 palabras de la publicación en cursiva [Descripción del tipo]. Plataforma. URL",
    example: "Observatorio Ficticio [@obs_ficticio]. (2024, 3 de marzo). Cinco señales de que una noticia podría ser falsa [Imagen]. Instagram. https://instagram.example/p/123",
    narrative: "Observatorio Ficticio (2024)", parenthetical: "(Observatorio Ficticio, 2024)", fields: [],
    keywords: ["tweet", "instagram", "tiktok", "facebook", "post"],
  },
  {
    id: "podcast", label: "Episodio de pódcast", category: "audiovisuales", implemented: false,
    when: "Episodios de programas de audio.",
    structure: "Anfitrión, A. A. (Anfitrión). (Año, día de mes). Título del episodio (N.º de episodio) [Episodio de pódcast]. En Nombre del pódcast. Productora. URL",
    example: "Vega, M. (Anfitriona). (2023, 10 de octubre). Algoritmos y noticias (N.º 12) [Episodio de pódcast]. En Voces Ficticias. Radio Ejemplo. https://podcast.example.com/12",
    narrative: "Vega (2023)", parenthetical: "(Vega, 2023)", fields: [], keywords: ["podcast", "audio", "episodio"],
  },
  {
    id: "image", label: "Fotografía o imagen", category: "audiovisuales", implemented: false,
    when: "Fotografías, ilustraciones o infografías tomadas de otra fuente.",
    structure: "Autor, A. A. (Año). Título de la imagen en cursiva [Fotografía]. Sitio. URL",
    example: "Ramírez, J. (2021). Mercado central al amanecer [Fotografía]. Archivo Visual Ficticio. https://archivo.example.org/foto/45",
    narrative: "Ramírez (2021)", parenthetical: "(Ramírez, 2021)", fields: [], keywords: ["foto", "imagen", "infografía", "ilustración"],
  },
  {
    id: "software", label: "Software o aplicación", category: "software-ia", implemented: false,
    when: "Programas o aplicaciones citados por su uso específico.",
    structure: "Autor o empresa. (Año). Nombre del software (Versión x) [Software]. Editorial. URL",
    example: "Estudio Ficticio. (2024). EditaFácil (Versión 3.2) [Software]. https://editafacil.example.com",
    narrative: "Estudio Ficticio (2024)", parenthetical: "(Estudio Ficticio, 2024)", fields: [], keywords: ["programa", "app", "aplicación"],
  },
  {
    id: "ai_tool", label: "Herramienta de inteligencia artificial", category: "software-ia", implemented: false,
    when: "Texto o resultados generados con un modelo de IA, cuando tu docente permite su uso. Describe en el texto la instrucción utilizada.",
    structure: "Empresa. (Año). Nombre del modelo (versión) [Modelo de lenguaje de gran tamaño]. URL",
    example: "Empresa Ficticia de IA. (2025). AsistenteX (versión del 2 de mayo) [Modelo de lenguaje de gran tamaño]. https://asistentex.example.com",
    narrative: "Empresa Ficticia de IA (2025)", parenthetical: "(Empresa Ficticia de IA, 2025)", fields: [], keywords: ["ia", "chatbot", "inteligencia artificial"],
  },
  {
    id: "legal", label: "Documento jurídico", category: "especiales", implemented: false,
    when: "Leyes, decretos y sentencias. Los formatos jurídicos varían por país; consulta a tu docente.",
    structure: "Nombre de la ley, Número de ley/decreto (Año). Fuente oficial. URL",
    example: "Ley Ficticia de Acceso a la Información, Decreto n.º 000 (2020). Diario Oficial Ficticio. https://diario-oficial.example.gob/000",
    narrative: "Ley Ficticia de Acceso a la Información (2020)", parenthetical: "(Ley Ficticia de Acceso a la Información, 2020)", fields: [],
    keywords: ["ley", "decreto", "sentencia", "jurídico"],
  },
];

export const IMPLEMENTED_TYPES = CATALOG.filter((c) => c.implemented);

export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.id === id);
}
