import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CATEGORIES, IMPLEMENTED_TYPES, catalogEntry, formatReference, segmentsToText,
  type Author, type ReferenceInput, type Segment, type SourceType,
} from "@shared/references";
import { Alert, Button, Card, Field, PageHeader, inputClass } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { listLocal, newClientId, saveLocal, syncLibrary } from "../../lib/library";

type AuthorForm = { kind: "person" | "group"; family: string; given: string; name: string; abbreviation: string };
type EditorForm = { family: string; given: string };
export type GeneratorValues = {
  source_type: SourceType;
  authors: AuthorForm[];
  editors: EditorForm[];
  year: string; month: string; day: string; noDate: boolean; suffix: string;
  title: string;
  extra: Record<string, string | boolean>;
};

const emptyAuthor = (): AuthorForm => ({ kind: "person", family: "", given: "", name: "", abbreviation: "" });

export function toInput(v: GeneratorValues): ReferenceInput {
  const authors: Author[] = v.authors.map((a) => a.kind === "group"
    ? { kind: "group", name: a.name, abbreviation: a.abbreviation || undefined }
    : { kind: "person", family: a.family, given: a.given });
  const base = {
    authors,
    date: { year: v.year, month: v.month, day: v.day, noDate: v.noDate, suffix: v.suffix },
    title: v.title,
  };
  const x = v.extra;
  const s = (k: string) => (typeof x[k] === "string" ? (x[k] as string) : undefined);
  switch (v.source_type) {
    case "book": return { ...base, source_type: "book", edition: s("edition"), publisher: s("publisher"), doi: s("doi"), url: s("url") };
    case "chapter": return { ...base, source_type: "chapter", editors: v.editors, book_title: s("book_title") ?? "", pages: s("pages"), edition: s("edition"), publisher: s("publisher"), doi: s("doi"), url: s("url") };
    case "journal_article": return { ...base, source_type: "journal_article", journal: s("journal") ?? "", volume: s("volume"), issue: s("issue"), pages: s("pages"), article_number: s("article_number"), doi: s("doi"), url: s("url") };
    case "webpage": return { ...base, source_type: "webpage", site_name: s("site_name"), url: s("url") ?? "", retrieved: s("retrieved") };
    case "thesis": return { ...base, source_type: "thesis", degree: (s("degree") as "licenciatura" | "maestria" | "doctorado") ?? "licenciatura", institution: s("institution") ?? "", published: Boolean(x.published), repository: s("repository"), url: s("url") };
    case "online_video": return { ...base, source_type: "online_video", platform: s("platform") ?? "", url: s("url") ?? "" };
    case "newspaper_article": return { ...base, source_type: "newspaper_article", newspaper: s("newspaper") ?? "", pages: s("pages"), url: s("url") };
    case "report": return { ...base, source_type: "report", report_number: s("report_number"), publisher: s("publisher"), url: s("url") };
  }
}

function fromInput(input: ReferenceInput): GeneratorValues {
  const { authors, date, title, source_type, ...rest } = input as ReferenceInput & Record<string, unknown>;
  const extra: Record<string, string | boolean> = {};
  for (const [k, val] of Object.entries(rest)) if (k !== "editors" && (typeof val === "string" || typeof val === "boolean")) extra[k] = val;
  return {
    source_type,
    authors: authors.map((a) => a.kind === "group" ? { ...emptyAuthor(), kind: "group", name: a.name, abbreviation: a.abbreviation ?? "" } : { ...emptyAuthor(), family: a.family, given: a.given }),
    editors: "editors" in input ? input.editors : [],
    year: date.year ?? "", month: date.month ?? "", day: date.day ?? "", noDate: Boolean(date.noDate), suffix: date.suffix ?? "",
    title, extra,
  };
}

export function SegmentsView({ segments }: { segments: Segment[] }) {
  return <>{segments.map((s, i) => (s.italic ? <i key={i}>{s.text}</i> : <span key={i}>{s.text}</span>))}</>;
}

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function copySegments(segments: Segment[]): Promise<void> {
  const text = segmentsToText(segments);
  const html = segments.map((s) => (s.italic ? `<i>${escapeHtml(s.text)}</i>` : escapeHtml(s.text))).join("");
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

export function GeneratorPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const editId = params.get("editar");
  const initialType = (catalogEntry(params.get("tipo") ?? "")?.source_type ?? "book") as SourceType;
  const [search, setSearch] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [clientId, setClientId] = useState<string | null>(editId);

  const form = useForm<GeneratorValues>({
    defaultValues: { source_type: initialType, authors: [emptyAuthor()], editors: [], year: "", month: "", day: "", noDate: false, suffix: "", title: "", extra: {} },
  });
  const { register, control, watch, reset, setValue } = form;
  const authors = useFieldArray({ control, name: "authors" });
  const editors = useFieldArray({ control, name: "editors" });
  const values = watch();
  const entry = catalogEntry(values.source_type)!;

  useEffect(() => {
    if (!editId || !user) return;
    listLocal(user.id).then((items) => {
      const item = items.find((i) => i.client_id === editId);
      if (item) reset(fromInput(item.input));
    });
  }, [editId, user, reset]);

  const result = useMemo(() => formatReference(toInput(values)), [values]);
  const errors = !result.ok && attempted ? result.errors : {};
  const filtered = IMPLEMENTED_TYPES.filter((t) => {
    const q = search.trim().toLowerCase();
    return !q || t.label.toLowerCase().includes(q) || t.keywords.some((k) => k.includes(q));
  });

  function chooseType(id: SourceType) {
    setValue("source_type", id);
    setParams((p) => { p.set("tipo", id); return p; }, { replace: true });
    setAttempted(false);
    setStatus(null);
  }

  async function copy(what: "reference" | "parenthetical" | "narrative") {
    setAttempted(true);
    if (!result.ok) return;
    try {
      if (what === "reference") await copySegments(result.output.segments);
      else await navigator.clipboard.writeText(what === "parenthetical" ? result.output.parenthetical_citation : result.output.narrative_citation);
      setStatus({ tone: "success", text: "Copiado al portapapeles." });
    } catch {
      setStatus({ tone: "error", text: "El navegador no permitió copiar. Selecciona el texto y cópialo manualmente." });
    }
  }

  async function save() {
    setAttempted(true);
    if (!result.ok || !user) return;
    const id = clientId ?? newClientId();
    await saveLocal(user.id, { client_id: id, source_type: values.source_type, input: toInput(values), output: result.output });
    setClientId(id);
    try {
      await syncLibrary(user.id);
      setStatus({ tone: "success", text: "Referencia guardada en tu biblioteca y sincronizada con el servidor." });
    } catch {
      setStatus({ tone: "info", text: "Referencia guardada en este dispositivo. Se sincronizará cuando haya conexión con el servidor." });
    }
  }

  const fieldError = (name: string) => errors[name];

  return (
    <div>
      <PageHeader title={editId ? "Editar referencia" : "Crear una referencia APA"} crumbs={[{ to: "/", label: "Inicio" }, { label: "Generador" }]}
        subtitle="Completa los datos tal como aparecen en tu fuente. APACH no inventa datos faltantes y funciona sin conexión." />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit">
          <label htmlFor="type-search" className="text-sm font-semibold">Tipo de fuente</label>
          <input id="type-search" type="search" className={`${inputClass} mt-1`} placeholder="Buscar: libro, revista, YouTube…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ul className="mt-3 space-y-1" aria-label="Tipos de fuente disponibles">
            {filtered.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => chooseType(t.source_type!)} aria-pressed={values.source_type === t.source_type}
                  className={`w-full rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-extrabold ${values.source_type === t.source_type ? "border-celeste bg-celeste-50 text-celeste-700" : "border-transparent hover:bg-fondo"}`}>
                  {t.label}<span className="block text-xs font-semibold text-tenue">{CATEGORIES.find((c) => c.id === t.category)?.label}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="text-sm text-tenue">Sin coincidencias. <Link className="underline" to="/referencias">Ver catálogo completo</Link></li>}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-black text-petroleo">{entry.label}</h2>
            <p className="text-sm text-tenue">{entry.when}</p>
            <form className="mt-4 space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
              <fieldset className="space-y-3">
                <legend className="text-sm font-black text-petroleo">Autoría</legend>
                {authors.fields.length === 0 && <p className="text-sm text-tenue">Sin autor: el título ocupará la posición del autor. Úsalo solo si la obra no indica autor ni institución.</p>}
                {authors.fields.map((f, i) => {
                  const kind = values.authors[i]?.kind;
                  return (
                    <div key={f.id} className="rounded-2xl border-2 border-borde p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-semibold">Autor {i + 1}</span>
                        <label className="flex items-center gap-1"><input type="radio" value="person" {...register(`authors.${i}.kind`)} /> Persona</label>
                        <label className="flex items-center gap-1"><input type="radio" value="group" {...register(`authors.${i}.kind`)} /> Institución o grupo</label>
                        <span className="ml-auto flex gap-1">
                          <Button type="button" variant="ghost" disabled={i === 0} onClick={() => authors.move(i, i - 1)} aria-label={`Subir autor ${i + 1}`}>↑</Button>
                          <Button type="button" variant="ghost" disabled={i === authors.fields.length - 1} onClick={() => authors.move(i, i + 1)} aria-label={`Bajar autor ${i + 1}`}>↓</Button>
                          <Button type="button" variant="ghost" onClick={() => authors.remove(i)} aria-label={`Quitar autor ${i + 1}`}>Quitar</Button>
                        </span>
                      </div>
                      {kind === "group" ? (
                        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                          <Field label="Nombre de la institución" htmlFor={`a${i}-name`} error={fieldError(`authors.${i}`)} required>
                            <input id={`a${i}-name`} className={inputClass} {...register(`authors.${i}.name`)} />
                          </Field>
                          <Field label="Sigla (opcional)" htmlFor={`a${i}-abbr`}><input id={`a${i}-abbr`} className={inputClass} {...register(`authors.${i}.abbreviation`)} /></Field>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Apellido(s)" htmlFor={`a${i}-family`} error={fieldError(`authors.${i}`)} required>
                            <input id={`a${i}-family`} className={inputClass} autoComplete="off" {...register(`authors.${i}.family`)} />
                          </Field>
                          <Field label="Nombre(s)" htmlFor={`a${i}-given`} help="Se convertirán en iniciales."><input id={`a${i}-given`} className={inputClass} autoComplete="off" {...register(`authors.${i}.given`)} /></Field>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button type="button" variant="secondary" onClick={() => authors.append(emptyAuthor())}>+ Agregar autor</Button>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-black text-petroleo">Fecha</legend>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Año" htmlFor="year" error={fieldError("date.year")} required={!values.noDate}>
                    <input id="year" inputMode="numeric" maxLength={4} className={inputClass} disabled={values.noDate} {...register("year")} />
                  </Field>
                  {entry.preciseDate && (
                    <>
                      <Field label="Mes" htmlFor="month" error={fieldError("date.month")}>
                        <select id="month" className={inputClass} disabled={values.noDate} {...register("month")}>
                          <option value="">—</option>
                          {["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                        </select>
                      </Field>
                      <Field label="Día" htmlFor="day" error={fieldError("date.day")}><input id="day" inputMode="numeric" maxLength={2} className={inputClass} disabled={values.noDate} {...register("day")} /></Field>
                    </>
                  )}
                  <Field label="Letra" htmlFor="suffix" error={fieldError("date.suffix")} help="2020a, 2020b…"><input id="suffix" maxLength={1} className={inputClass} {...register("suffix")} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("noDate")} /> La fuente no indica fecha (s. f.)</label>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-black text-petroleo">Datos de la obra</legend>
                <Field label="Título" htmlFor="title" error={fieldError("title")} required help="Escríbelo como aparece; en APA se usa tipo oración (mayúscula inicial y nombres propios).">
                  <input id="title" className={inputClass} {...register("title")} />
                </Field>
                {values.source_type === "chapter" && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Editores del libro</p>
                    {editors.fields.map((f, i) => (
                      <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input aria-label={`Apellido del editor ${i + 1}`} placeholder="Apellido" className={inputClass} {...register(`editors.${i}.family`)} />
                        <input aria-label={`Nombre del editor ${i + 1}`} placeholder="Nombre" className={inputClass} {...register(`editors.${i}.given`)} />
                        <Button type="button" variant="ghost" onClick={() => editors.remove(i)}>Quitar</Button>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={() => editors.append({ family: "", given: "" })}>+ Agregar editor</Button>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {entry.fields.map((fd) => (
                    <div key={`${values.source_type}-${fd.name}`} className={fd.kind === "checkbox" ? "sm:col-span-2" : ""}>
                      {fd.kind === "checkbox" ? (
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register(`extra.${fd.name}`)} /> {fd.label}</label>
                      ) : (
                        <Field label={fd.label} htmlFor={`f-${fd.name}`} error={fieldError(fd.name)} help={fd.help} required={fd.required}>
                          {fd.kind === "select" ? (
                            <select id={`f-${fd.name}`} className={inputClass} {...register(`extra.${fd.name}`)}>
                              {fd.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : (
                            <input id={`f-${fd.name}`} type={fd.kind === "date" ? "date" : fd.kind === "url" ? "url" : "text"} placeholder={fd.placeholder} className={inputClass} {...register(`extra.${fd.name}`)} />
                          )}
                        </Field>
                      )}
                    </div>
                  ))}
                </div>
              </fieldset>
            </form>
          </Card>

          <Card className="lg:sticky lg:bottom-4">
            <h2 className="text-lg font-black text-petroleo">Vista previa</h2>
            <div aria-live="polite">
              {result.ok ? (
                <>
                  <p className="hanging mt-3 rounded-2xl border-2 border-celeste bg-celeste-50 p-4 font-serif text-base leading-loose" data-testid="reference-preview"><SegmentsView segments={result.output.segments} /></p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="font-semibold">Cita parentética</dt><dd data-testid="parenthetical">{result.output.parenthetical_citation}</dd>
                      {result.output.subsequent_parenthetical && <dd className="text-xs text-tenue">Citas posteriores: {result.output.subsequent_parenthetical}</dd>}</div>
                    <div><dt className="font-semibold">Cita narrativa</dt><dd data-testid="narrative">{result.output.narrative_citation}</dd></div>
                  </dl>
                  {result.output.warnings.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 rounded-2xl border-2 border-naranja bg-naranja-50 p-3 pl-7 text-sm font-semibold">{result.output.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-tenue">{attempted ? "Revisa los campos marcados para generar la referencia." : "La vista previa aparecerá cuando completes los datos obligatorios (*)."}</p>
              )}
            </div>
            {status && <div className="mt-3"><Alert tone={status.tone}>{status.text}</Alert></div>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => copy("reference")}>Copiar referencia</Button>
              <Button type="button" variant="secondary" onClick={() => copy("parenthetical")}>Copiar cita parentética</Button>
              <Button type="button" variant="secondary" onClick={() => copy("narrative")}>Copiar cita narrativa</Button>
              {user ? (
                <Button type="button" variant="secondary" onClick={save}>{clientId ? "Guardar cambios" : "Guardar en mi biblioteca"}</Button>
              ) : <span className="self-center text-xs text-tenue">Inicia sesión para guardar en tu biblioteca.</span>}
              {clientId && <Button type="button" variant="ghost" onClick={() => navigate("/biblioteca")}>Ir a mi biblioteca</Button>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
