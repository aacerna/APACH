import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GuideContent } from "../../components/GuideContent";
import { Alert, Button, Card, ConfirmButton, EmptyState, ErrorState, PageHeader, SeverityBadge, Spinner, inputClass } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fmtDate, fmtSize, outcomeLabel, reviewLabel, severityLabel, statusLabel } from "../../lib/format";
import { guideBySlug, RULE_NAMES } from "../../lib/guides";
import type { Analysis, Comment, DocumentItem, Finding, RunItem, Severity } from "../../lib/types";

type Filter = "ALL" | Severity | "NOT_VERIFIABLE";

const EVIDENCE_LABELS: Record<string, string> = {
  margins_cm: "Márgenes medidos (cm)", expected_cm: "Valor esperado (cm)", font: "Fuente", size_pt: "Tamaño (pt)", share_of_text: "Proporción del texto",
  count: "Párrafos afectados", checked: "Párrafos revisados", heading_text: "Título encontrado", alignment: "Alineación", bold: "Negrita",
  citation: "Cita detectada", author: "Autor", year: "Año", occurrences: "Apariciones", reference: "Referencia", word_count: "Palabras",
  citation_after: "Cita posterior", reference_like_ratio: "Proporción con forma de referencia", gutter_cm: "Encuadernación (cm)",
  previous: "Entrada anterior", current: "Entrada actual", citations_detected: "Citas detectadas", quote_start: "Inicio del texto citado",
};

const EXAMPLE_LABELS: Record<string, string> = {
  measured: "medido", first_line_cm: "sangría 1.ª línea (cm)", hanging_cm: "sangría francesa (cm)", left_cm: "sangría izquierda (cm)",
  before_pt: "espacio antes (pt)", after_pt: "espacio después (pt)",
};

function renderValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number") return v > 0 && v < 1 ? `${Math.round(v * 100)} %` : String(v);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const sides: Record<string, string> = { top: "sup.", bottom: "inf.", left: "izq.", right: "der." };
    return Object.entries(v).map(([k, x]) => `${sides[k] ?? k} ${x ?? "—"}`).join(" · ");
  }
  return String(v ?? "—");
}

function Evidence({ finding }: { finding: Finding }) {
  const ev = finding.evidence;
  const simple = Object.entries(ev).filter(([k, v]) => EVIDENCE_LABELS[k] && v !== null && v !== undefined && !Array.isArray(v));
  const examples = Array.isArray(ev.examples) ? (ev.examples as Array<Record<string, unknown>>) : [];
  return (
    <details className="mt-3 rounded-lg bg-fondo p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-petroleo">Ver evidencia medida</summary>
      {simple.length > 0 && (
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
          {simple.map(([k, v]) => (<Fragment key={k}><dt className="text-tenue">{EVIDENCE_LABELS[k]}</dt><dd className="break-words">{renderValue(v)}</dd></Fragment>))}
        </dl>
      )}
      {examples.length > 0 && (
        <ul className="mt-2 space-y-1">
          {examples.slice(0, 8).map((ex, i) => (
            <li key={i} className="rounded bg-white p-2">
              <span className="font-semibold">Párrafo {Number(ex.paragraph_index) + 1}:</span> «{String(ex.excerpt)}»
              {Object.entries(ex).filter(([k]) => !["paragraph_index", "excerpt"].includes(k)).map(([k, v]) => (
                <span key={k} className="ml-2 text-xs text-tenue">{EXAMPLE_LABELS[k] ?? k.replace(/_/g, " ")}: {renderValue(v)}</span>
              ))}
            </li>
          ))}
          {examples.length > 8 && <li className="text-xs text-tenue">…y {examples.length - 8} más.</li>}
        </ul>
      )}
      {Boolean(ev.heuristic) && <p className="mt-2 text-xs text-tenue">Detección heurística: puede haber falsos positivos (nombres propios, citas atípicas).</p>}
    </details>
  );
}

function GuideDialog({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const guide = guideBySlug(slug);
  useEffect(() => {
    if (slug) ref.current?.showModal?.();
    else ref.current?.close?.();
  }, [slug]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="guide-title" className="m-auto max-h-[85vh] w-[min(42rem,92vw)] overflow-y-auto rounded-xl p-0 backdrop:bg-black/40">
      {guide && (
        <div className="p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 id="guide-title" className="text-xl font-bold text-petroleo">Aprender a corregir: {guide.title}</h2>
            <Button variant="ghost" onClick={onClose} aria-label="Cerrar guía">✕</Button>
          </div>
          <GuideContent guide={guide} headingLevel={3} />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onClose}>Volver a mis resultados</Button>
            <Link className="inline-flex min-h-11 items-center px-3 text-sm text-celeste-700 underline" to={`/aprende/${guide.slug}`}>Abrir ficha completa</Link>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Comments({ doc }: { doc: DocumentItem }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const comments = useQuery({ queryKey: ["comments", doc.id], queryFn: () => api<Comment[]>(`/documents/${doc.id}/comments`) });
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["comments", doc.id] }); qc.invalidateQueries({ queryKey: ["document", doc.id] }); };
  const add = useMutation({ mutationFn: () => api(`/documents/${doc.id}/comments`, { method: "POST", json: { body } }), onSuccess: () => { setBody(""); refresh(); } });
  const edit = useMutation({ mutationFn: (c: { id: number; body: string }) => api(`/documents/${doc.id}/comments/${c.id}`, { method: "PATCH", json: { body: c.body } }), onSuccess: () => { setEditing(null); refresh(); } });
  const remove = useMutation({ mutationFn: (id: number) => api(`/documents/${doc.id}/comments/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const review = useMutation({
    mutationFn: (value: "PENDING" | "REVIEWED") => api(`/documents/${doc.id}/review-status`, { method: "PATCH", json: { review_status: value } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["document", doc.id] }); qc.invalidateQueries({ queryKey: ["teacher-sections"] }); },
  });
  const isTeacher = user?.role === "TEACHER";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-petroleo">Comentarios del docente</h2>
        {isTeacher && (
          <Button variant="secondary" onClick={() => review.mutate(doc.review_status === "REVIEWED" ? "PENDING" : "REVIEWED")} disabled={review.isPending}>
            {doc.review_status === "REVIEWED" ? "Marcar como pendiente" : "Marcar como revisado"}
          </Button>
        )}
      </div>
      {comments.isLoading ? <Spinner /> : comments.data?.length ? (
        <ul className="space-y-3">
          {comments.data.map((c) => (
            <li key={c.id} className="rounded-lg bg-fondo p-3 text-sm">
              <p className="text-xs text-tenue">{c.teacher_name} · {fmtDate(c.created_at)}{new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000 ? " (editado)" : ""}</p>
              {editing?.id === c.id ? (
                <div className="mt-2 space-y-2">
                  <label className="sr-only" htmlFor={`edit-${c.id}`}>Editar comentario</label>
                  <textarea id={`edit-${c.id}`} className={inputClass} rows={3} value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} />
                  <div className="flex gap-2"><Button onClick={() => edit.mutate(editing)} disabled={!editing.body.trim()}>Guardar</Button><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button></div>
                </div>
              ) : <p className="mt-1 whitespace-pre-line">{c.body}</p>}
              {isTeacher && c.teacher_id === user?.id && editing?.id !== c.id && (
                <div className="mt-2 flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing({ id: c.id, body: c.body })}>Editar</Button>
                  <ConfirmButton message="¿Eliminar este comentario? Esta acción no se puede deshacer." onConfirm={() => remove.mutate(c.id)}>Eliminar</ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-tenue">Todavía no hay comentarios del docente.</p>}
      {isTeacher && (
        <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}>
          <label htmlFor="new-comment" className="text-sm font-semibold">Nueva observación para el estudiante</label>
          <textarea id="new-comment" className={inputClass} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
          {add.error && <ErrorState error={add.error} />}
          <Button type="submit" disabled={!body.trim() || add.isPending}>Publicar comentario</Button>
        </form>
      )}
    </Card>
  );
}

export function DocumentResultsPage() {
  const { id } = useParams();
  const docId = Number(id);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [runId, setRunId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [ruleFilter, setRuleFilter] = useState("ALL");
  const [guideSlug, setGuideSlug] = useState<string | null>(null);
  const doc = useQuery({ queryKey: ["document", docId], queryFn: () => api<DocumentItem>(`/documents/${docId}`) });
  const runs = useQuery({ queryKey: ["runs", docId], queryFn: () => api<RunItem[]>(`/documents/${docId}/runs`) });
  const analysis = useQuery({
    queryKey: ["analysis", docId, runId],
    queryFn: () => api<Analysis>(`/documents/${docId}/analysis${runId ? `?run_id=${runId}` : ""}`),
    retry: false,
    enabled: (runs.data?.length ?? 0) > 0,
  });
  const reanalyze = useMutation({
    mutationFn: () => api<Analysis>(`/documents/${docId}/analyze`, { method: "POST" }),
    onSuccess: () => { setRunId(null); ["runs", "analysis", "document", "documents"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
  });

  const findings = useMemo(() => (analysis.data?.findings ?? []).filter((f) => {
    if (ruleFilter !== "ALL" && f.rule_code !== ruleFilter) return false;
    if (filter === "ALL") return true;
    if (filter === "NOT_VERIFIABLE") return f.verification_status === "NOT_VERIFIABLE";
    return f.severity === filter;
  }), [analysis.data, filter, ruleFilter]);

  if (doc.isLoading) return <Spinner />;
  if (doc.error) return <ErrorState error={doc.error} />;
  const d = doc.data!;
  const counts = analysis.data?.summary.counts;
  const back = user?.role === "TEACHER" ? { to: `/docente/secciones/${d.section_id}`, label: "Sección" } : user?.role === "ADMIN" ? { to: "/admin", label: "Administración" } : { to: "/trabajos", label: "Mis trabajos" };

  return (
    <div className="space-y-6">
      <PageHeader title={d.original_filename} crumbs={[back, { label: "Resultados" }]}
        subtitle={<>{d.section_label}{user?.role !== "STUDENT" && <> · Estudiante: {d.student_name}</>} · {fmtSize(d.size_bytes)} · {statusLabel[d.status]} · {reviewLabel[d.review_status]}</>}
        actions={<>
          <a className="inline-flex min-h-11 items-center rounded-lg border border-petroleo/30 bg-white px-4 text-sm font-semibold text-petroleo hover:bg-petroleo-50" href={`/api/v1/documents/${d.id}/download`}>Descargar original</a>
          {user?.role !== "TEACHER" && <Button onClick={() => reanalyze.mutate()} disabled={reanalyze.isPending}>{reanalyze.isPending ? "Analizando…" : "Volver a analizar"}</Button>}
        </>} />

      {reanalyze.error && <ErrorState error={reanalyze.error} />}
      {runs.data && runs.data.length === 0 && <EmptyState title="Este documento aún no se ha analizado">Pulsa «Volver a analizar» para ejecutar la revisión.</EmptyState>}
      {analysis.isLoading && <Spinner label="Cargando resultados…" />}
      {analysis.data?.status === "FAILED" && <Alert tone="error" title="El análisis no pudo completarse">{analysis.data.error_message} Tu archivo original se conserva; verifica que se abra correctamente en Word y vuelve a intentarlo.</Alert>}

      {analysis.data && analysis.data.status === "COMPLETED" && counts && (
        <>
          <Alert tone="info">
            Resultados orientativos generados por reglas programadas (versión {analysis.data.rule_set_version}). No son una calificación ni garantizan el cumplimiento total de APA 7.
            Los elementos «no verificables» no se cuentan como errores.
          </Alert>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([
              ["ERROR", "Errores verificados", counts.errors, "bg-terracota-700 text-white"],
              ["POSSIBLE_PROBLEM", "Posibles problemas", counts.possible_problems, "bg-naranja-50 ring-1 ring-naranja"],
              ["NEEDS_TEACHER", "Para revisión docente", counts.needs_teacher, "bg-celeste-50 ring-1 ring-celeste"],
              ["NOT_VERIFIABLE", "No verificables", counts.not_verifiable, "bg-white ring-1 ring-borde"],
            ] as const).map(([key, label, n, cls]) => (
              <button key={key} onClick={() => setFilter(filter === key ? "ALL" : key)} aria-pressed={filter === key}
                className={`rounded-xl p-4 text-left shadow-sm ${cls} ${filter === key ? "outline outline-3 outline-celeste-700" : ""}`}>
                <span className="block text-3xl font-bold">{n}</span><span className="text-sm">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="rule-filter" className="block text-sm font-semibold">Filtrar por regla</label>
              <select id="rule-filter" className={inputClass} value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)}>
                <option value="ALL">Todas las reglas</option>
                {Object.entries(RULE_NAMES).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
              </select>
            </div>
            {runs.data && runs.data.length > 1 && (
              <div>
                <label htmlFor="run" className="block text-sm font-semibold">Revisión</label>
                <select id="run" className={inputClass} value={runId ?? ""} onChange={(e) => setRunId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Más reciente</option>
                  {runs.data.map((r) => <option key={r.id} value={r.id}>#{r.id} · {fmtDate(r.started_at)}</option>)}
                </select>
              </div>
            )}
            {(filter !== "ALL" || ruleFilter !== "ALL") && <Button variant="ghost" onClick={() => { setFilter("ALL"); setRuleFilter("ALL"); }}>Quitar filtros</Button>}
          </div>

          <section aria-labelledby="findings-title">
            <h2 id="findings-title" className="mb-3 text-lg font-semibold text-petroleo">Hallazgos ({findings.length})</h2>
            {findings.length === 0 ? (
              <EmptyState title={analysis.data.findings.length ? "Ningún hallazgo con estos filtros" : "No se encontraron problemas en las reglas comprobadas"}>
                {analysis.data.findings.length ? null : "Revisa también la tabla de reglas: algunas pueden no aplicar o no ser verificables en tu documento."}
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {findings.map((f) => (
                  <Card as="li" key={f.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-petroleo-50 px-2 py-0.5 text-xs font-bold text-petroleo">{f.rule_code} · {RULE_NAMES[f.rule_code] ?? ""}</span>
                      <SeverityBadge severity={f.severity} verification={f.verification_status} />
                    </div>
                    <p className="mt-2 font-medium">{f.message}</p>
                    {f.location.paragraph_index !== undefined ? (
                      <p className="mt-1 text-sm text-tenue">Ubicación: párrafo {f.location.paragraph_index + 1}{f.location.excerpt ? <> — «{f.location.excerpt}»</> : null}</p>
                    ) : f.location.section_index !== undefined ? (
                      <p className="mt-1 text-sm text-tenue">Ubicación: sección {f.location.section_index + 1} del documento</p>
                    ) : <p className="mt-1 text-sm text-tenue">Ubicación: todo el documento</p>}
                    <p className="mt-2 text-sm"><strong>Sugerencia:</strong> {f.suggestion}</p>
                    <Evidence finding={f} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {f.guide_slug && <Button variant="secondary" onClick={() => setGuideSlug(f.guide_slug)}>Aprender a corregir</Button>}
                      {f.rule_code === "APA-08" && user?.role === "STUDENT" && f.verification_status === "CHECKED" && (
                        <Link className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-celeste-700 underline" to="/generador">Crear la referencia faltante</Link>
                      )}
                    </div>
                  </Card>
                ))}
              </ul>
            )}
          </section>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-petroleo">Reglas comprobadas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-tenue"><th className="py-2 pr-3">Regla</th><th className="py-2 pr-3">Resultado</th><th className="py-2 pr-3">Elementos revisados</th><th className="py-2">Nota</th></tr></thead>
                <tbody>
                  {(analysis.data.summary.rules ?? []).map((r) => (
                    <tr key={r.code} className="border-t border-borde">
                      <td className="py-2 pr-3 font-semibold">{r.code} · {RULE_NAMES[r.code]}</td>
                      <td className="py-2 pr-3">{outcomeLabel[r.outcome]}{r.findings ? ` (${r.findings})` : ""}</td>
                      <td className="py-2 pr-3">{r.checked_items}</td>
                      <td className="py-2 text-tenue">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-4 font-semibold text-petroleo">Límites de esta revisión</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-tenue">{(analysis.data.summary.limitations ?? []).map((l) => <li key={l}>{l}</li>)}</ul>
            <p className="mt-2 text-xs text-tenue">Leyenda: {Object.values(severityLabel).join(" · ")}.</p>
          </Card>
        </>
      )}

      <Comments doc={d} />
      <GuideDialog slug={guideSlug} onClose={() => setGuideSlug(null)} />
    </div>
  );
}
