import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, ConfirmButton, EmptyState, ErrorState, Field, PageHeader, Spinner, inputClass } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import type { Membership, Program, Rule, Section, Template, User } from "../../lib/types";
import { useAdmin, useAdminMutation } from "./AdminCore";

// ------------------------------------------------------------------ matrículas y asignaciones
export function AdminMemberships() {
  const sections = useAdmin<Section[]>("/sections");
  const students = useAdmin<User[]>("/users?role=STUDENT");
  const teachers = useAdmin<User[]>("/users?role=TEACHER");
  const enrollments = useAdmin<Membership[]>("/enrollments");
  const assignments = useAdmin<Membership[]>("/assignments");
  const inv = ["/enrollments", "/assignments", "/sections"];
  const [en, setEn] = useState({ student_id: "", section_id: "" });
  const [as, setAs] = useState({ teacher_id: "", section_id: "" });
  const addEn = useAdminMutation(() => api("/admin/enrollments", { method: "POST", json: { student_id: Number(en.student_id), section_id: Number(en.section_id) } }), inv);
  const addAs = useAdminMutation(() => api("/admin/assignments", { method: "POST", json: { teacher_id: Number(as.teacher_id), section_id: Number(as.section_id) } }), inv);
  const delEn = useAdminMutation((id: number) => api(`/admin/enrollments/${id}`, { method: "DELETE" }), inv);
  const delAs = useAdminMutation((id: number) => api(`/admin/assignments/${id}`, { method: "DELETE" }), inv);
  const err = addEn.error ?? addAs.error ?? delEn.error ?? delAs.error;
  const sectionOptions = sections.data?.map((s) => <option key={s.id} value={s.id}>{s.course.code}-{s.code} · {s.course.name} ({s.term.code})</option>);
  const list = (items: Membership[] | undefined, onRemove: (id: number) => void, msg: string) => items?.length ? (
    <ul className="divide-y divide-borde text-sm">{items.map((m) => (
      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span><strong>{m.user_name}</strong> <span className="text-tenue">({m.user_email})</span><span className="block text-xs text-tenue">{m.section_label}</span></span>
        <ConfirmButton message={msg} onConfirm={() => onRemove(m.id)}>Retirar</ConfirmButton>
      </li>))}</ul>
  ) : <p className="text-sm text-tenue">Sin registros.</p>;
  return (
    <div className="space-y-6">
      <PageHeader title="Matrículas y asignaciones" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Matrículas y asignaciones" }]} />
      {err && <ErrorState error={err} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-black text-petroleo">Matricular estudiante</h2>
          <form className="mb-4 grid gap-2" onSubmit={(e) => { e.preventDefault(); addEn.mutate(undefined); }}>
            <select aria-label="Estudiante" required className={inputClass} value={en.student_id} onChange={(e) => setEn({ ...en, student_id: e.target.value })}>
              <option value="">Estudiante…</option>{students.data?.map((u) => <option key={u.id} value={u.id}>{u.full_name} · {u.email}</option>)}</select>
            <select aria-label="Sección para matrícula" required className={inputClass} value={en.section_id} onChange={(e) => setEn({ ...en, section_id: e.target.value })}>
              <option value="">Sección…</option>{sectionOptions}</select>
            <Button type="submit">Matricular</Button>
          </form>
          {list(enrollments.data, (id) => delEn.mutate(id), "¿Retirar esta matrícula? Si el estudiante ya tiene documentos en la sección, el sistema lo impedirá.")}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-black text-petroleo">Asignar docente</h2>
          <form className="mb-4 grid gap-2" onSubmit={(e) => { e.preventDefault(); addAs.mutate(undefined); }}>
            <select aria-label="Docente" required className={inputClass} value={as.teacher_id} onChange={(e) => setAs({ ...as, teacher_id: e.target.value })}>
              <option value="">Docente…</option>{teachers.data?.map((u) => <option key={u.id} value={u.id}>{u.full_name} · {u.email}</option>)}</select>
            <select aria-label="Sección para asignación" required className={inputClass} value={as.section_id} onChange={(e) => setAs({ ...as, section_id: e.target.value })}>
              <option value="">Sección…</option>{sectionOptions}</select>
            <Button type="submit">Asignar</Button>
          </form>
          {list(assignments.data, (id) => delAs.mutate(id), "¿Retirar esta asignación? El docente dejará de ver los documentos de la sección.")}
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ CSV
type PreviewRow = { line: number; first_name: string; last_name: string; email: string; section_label: string | null; action: string; errors: string[] };
type Preview = { batch_id: number; summary: Record<string, number>; rows: PreviewRow[] };
type ConfirmResult = { result: Record<string, number>; activation_links: Array<{ email: string; dev_link: string | null }>; notice: string | null };
const ACTION_LABEL: Record<string, string> = { CREATE_AND_ENROLL: "Crear cuenta y matricular", ENROLL_EXISTING: "Matricular cuenta existente", ALREADY_ENROLLED: "Ya matriculado (se omite)", ERROR: "Error" };

export function AdminImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<ConfirmResult | null>(null);
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: () => { const fd = new FormData(); fd.append("file", file!); return api<Preview>("/admin/imports/preview", { method: "POST", body: fd }); },
    onSuccess: (p) => { setPreview(p); setDone(null); },
  });
  const confirm = useMutation({
    mutationFn: () => api<ConfirmResult>(`/admin/imports/${preview!.batch_id}/confirm`, { method: "POST" }),
    onSuccess: (r) => { setDone(r); qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Importar estudiantes autorizados (CSV)" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Importar CSV" }]}
        subtitle="Proceso: cargar → revisar vista previa → confirmar. La importación es transaccional y no duplica cuentas ni matrículas." />
      <Card>
        <p className="text-sm">Archivo UTF-8 con encabezados exactos:</p>
        <code className="mt-1 block overflow-x-auto rounded bg-fondo p-2 text-xs">first_name,last_name,email,program,academic_term,course_code,section_code</code>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (file) upload.mutate(); }}>
          <Field label="Archivo CSV" htmlFor="csv"><input id="csv" type="file" accept=".csv,text/csv" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <Button type="submit" disabled={!file || upload.isPending}>Validar y previsualizar</Button>
        </form>
        {upload.error && <div className="mt-3"><ErrorState error={upload.error} /></div>}
      </Card>
      {preview && (
        <Card>
          <h2 className="mb-2 text-lg font-black text-petroleo">Vista previa (lote #{preview.batch_id})</h2>
          <p className="text-sm">Total: {preview.summary.total} · Crear y matricular: {preview.summary.create_and_enroll} · Matricular existentes: {preview.summary.enroll_existing} · Ya matriculados: {preview.summary.already_enrolled} · Con errores: <strong>{preview.summary.errors}</strong></p>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-tenue"><th className="py-1">Fila</th><th>Nombre</th><th>Correo</th><th>Sección</th><th>Acción</th></tr></thead>
              <tbody>{preview.rows.map((r) => (
                <tr key={r.line} className={`border-t border-borde ${r.action === "ERROR" ? "bg-terracota-50" : ""}`}>
                  <td className="py-1">{r.line}</td><td>{r.first_name} {r.last_name}</td><td>{r.email}</td><td>{r.section_label ?? "—"}</td>
                  <td>{ACTION_LABEL[r.action]}{r.errors.length > 0 && <ul className="text-xs text-terracota-700">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {!done && <div className="mt-4 flex flex-wrap items-center gap-3">
            <ConfirmButton variant="primary" message={`Se importarán las filas válidas (${preview.summary.total - preview.summary.errors}). Las filas con error se omiten. ¿Confirmar?`} onConfirm={() => confirm.mutate()} disabled={confirm.isPending}>Confirmar importación</ConfirmButton>
            {confirm.error && <ErrorState error={confirm.error} />}
          </div>}
        </Card>
      )}
      {done && (
        <Card>
          <Alert tone="success" title="Importación completada">
            Cuentas creadas: {done.result.users_created} · Matrículas creadas: {done.result.enrollments_created} · Omitidas (ya existían): {done.result.skipped_existing} · Filas con error: {done.result.rows_with_errors}
          </Alert>
          {done.activation_links.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-semibold">Enlaces de activación</p>
              <p className="text-xs text-tenue">{done.notice}</p>
              <ul className="mt-2 space-y-1">{done.activation_links.map((l) => <li key={l.email}><strong>{l.email}</strong>{l.dev_link && <span className="block break-all font-mono text-xs">{l.dev_link}</span>}</li>)}</ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ plantillas
const emptyTemplate = { name: "", description: "", template_type: "", url: "", program_id: "", active: true };

export function AdminTemplates() {
  const templates = useAdmin<Template[]>("/templates");
  const programs = useAdmin<Program[]>("/programs");
  const [form, setForm] = useState(emptyTemplate);
  const [editing, setEditing] = useState<number | null>(null);
  const body = () => ({ ...form, program_id: form.program_id ? Number(form.program_id) : null });
  const save = useAdminMutation(() => api(editing ? `/admin/templates/${editing}` : "/admin/templates", { method: editing ? "PUT" : "POST", json: body() })
    .then(() => { setForm(emptyTemplate); setEditing(null); }), ["/templates"]);
  const remove = useAdminMutation((id: number) => api(`/admin/templates/${id}`, { method: "DELETE" }), ["/templates"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Plantillas (Google Drive)" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Plantillas" }]}
        subtitle="Registra los enlaces HTTPS oficiales. Mientras no existan, los estudiantes ven un estado vacío (sin enlaces ficticios)." />
      <Card>
        <h2 className="mb-3 font-black text-petroleo">{editing ? "Editar plantilla" : "Nueva plantilla"}</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Nombre" htmlFor="t-name" required><input id="t-name" required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Tipo" htmlFor="t-type" required help="Ej.: Trabajo escrito, Ensayo, Informe."><input id="t-type" required className={inputClass} value={form.template_type} onChange={(e) => setForm({ ...form, template_type: e.target.value })} /></Field>
          <Field label="URL HTTPS" htmlFor="t-url" required><input id="t-url" type="url" required pattern="https://.*" className={inputClass} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
          <Field label="Programa" htmlFor="t-prog" help="Vacío = visible para todos los programas."><select id="t-prog" className={inputClass} value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
            <option value="">Todos</option>{programs.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Descripción" htmlFor="t-desc"><textarea id="t-desc" className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible para estudiantes</label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{editing ? "Guardar cambios" : "Agregar plantilla"}</Button>
            {editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(emptyTemplate); }}>Cancelar</Button>}
          </div>
          {save.error && <div className="sm:col-span-2"><ErrorState error={save.error} /></div>}
        </form>
      </Card>
      {templates.isLoading ? <Spinner /> : templates.data?.length ? (
        <ul className="space-y-3">{templates.data.map((t) => (
          <Card as="li" key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{t.name} {!t.active && <span className="text-xs text-tenue">(oculta)</span>}</p>
                <p className="text-xs text-tenue">{t.template_type} · {t.program_name ?? "Todos los programas"} · Actualizada por {t.updated_by ?? "—"} el {fmtDate(t.updated_at)}</p>
                <p className="break-all text-xs">{t.url}</p></div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setEditing(t.id); setForm({ name: t.name, description: t.description, template_type: t.template_type, url: t.url, program_id: t.program_id ? String(t.program_id) : "", active: t.active }); }}>Editar</Button>
                <ConfirmButton message={`¿Eliminar la plantilla «${t.name}»?`} onConfirm={() => remove.mutate(t.id)}>Eliminar</ConfirmButton>
              </div>
            </div>
          </Card>))}</ul>
      ) : <EmptyState title="Enlaces de plantillas pendientes de configuración">Agrega aquí los enlaces de Google Drive cuando la Escuela los proporcione.</EmptyState>}
    </div>
  );
}

// ------------------------------------------------------------------ reglas
export function AdminRules() {
  const rules = useAdmin<Rule[]>("/rules");
  const [form, setForm] = useState({ code: "ECC-", name: "", version: "", source: "", description: "" });
  const create = useAdminMutation(() => api("/admin/rules", { method: "POST", json: form }).then(() => setForm({ code: "ECC-", name: "", version: "", source: "", description: "" })), ["/rules"]);
  const toggle = useAdminMutation((r: Rule) => api(`/admin/rules/${r.id}`, { method: "PATCH", json: { enabled: !r.enabled } }), ["/rules"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Reglas de revisión" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Reglas" }]}
        subtitle="Las reglas APA generales están programadas y probadas. Las reglas ECC solo registran metadatos hasta recibir la guía oficial: no pueden habilitarse sin implementación." />
      <Alert tone="info" title="Guía institucional ECC: pendiente">No se aplican criterios ECC de portada, índice ni evaluación hasta contar con la fuente oficial.</Alert>
      {(toggle.error || create.error) && <ErrorState error={toggle.error ?? create.error} />}
      <Card>
        <table className="w-full text-left text-sm">
          <thead><tr className="text-tenue"><th className="py-2">Código</th><th>Regla</th><th>Ámbito</th><th>Versión</th><th>Estado</th><th></th></tr></thead>
          <tbody>{rules.data?.map((r) => (
            <tr key={r.id} className="border-t border-borde">
              <td className="py-2 font-semibold">{r.code}</td><td>{r.name}<span className="block text-xs text-tenue">{r.description}</span></td>
              <td>{r.scope}</td><td className="text-xs">{r.version}</td>
              <td>{r.enabled ? "Habilitada" : "Deshabilitada"}{!r.implemented && <span className="block text-xs text-tenue">Sin implementación</span>}</td>
              <td><Button variant="ghost" disabled={!r.implemented} onClick={() => toggle.mutate(r)}>{r.enabled ? "Deshabilitar" : "Habilitar"}</Button></td>
            </tr>))}</tbody>
        </table>
      </Card>
      <Card>
        <h2 className="mb-3 font-black text-petroleo">Registrar regla institucional (solo metadatos)</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          <Field label="Código" htmlFor="r-code" required help="Formato ECC-NOMBRE"><input id="r-code" required pattern="ECC-[A-Z0-9\-]+" className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Nombre" htmlFor="r-name" required><input id="r-name" required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Versión" htmlFor="r-ver" required><input id="r-ver" required className={inputClass} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
          <Field label="Fuente oficial" htmlFor="r-src" required><input id="r-src" required className={inputClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
          <Field label="Descripción" htmlFor="r-desc"><textarea id="r-desc" className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="self-end"><Button type="submit">Registrar (deshabilitada)</Button></div>
        </form>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ ajustes y auditoría
export function AdminSettings() {
  const settings = useAdmin<{ institutional_contact: string; welcome_video_url: string | null }>("/settings");
  const [form, setForm] = useState({ institutional_contact: "", welcome_video_url: "" });
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (settings.data) setForm({ institutional_contact: settings.data.institutional_contact, welcome_video_url: settings.data.welcome_video_url ?? "" }); }, [settings.data]);
  const save = useAdminMutation(() => api("/admin/settings", { method: "PUT", json: form }).then(() => setSaved(true)), ["/settings"]);
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Ajustes" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Ajustes" }]} />
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSaved(false); save.mutate(undefined); }}>
          <Field label="Contacto institucional" htmlFor="s-contact" help="Se muestra a estudiantes sin cursos asignados."><input id="s-contact" className={inputClass} value={form.institutional_contact} onChange={(e) => setForm({ ...form, institutional_contact: e.target.value })} /></Field>
          <Field label="Video de bienvenida (URL HTTPS, opcional)" htmlFor="s-video" help="Si se deja vacío, el inicio muestra una bienvenida textual."><input id="s-video" type="url" className={inputClass} value={form.welcome_video_url} onChange={(e) => setForm({ ...form, welcome_video_url: e.target.value })} /></Field>
          {save.error && <ErrorState error={save.error} />}
          {saved && <Alert tone="success">Ajustes guardados.</Alert>}
          <Button type="submit">Guardar ajustes</Button>
        </form>
      </Card>
    </div>
  );
}

type AuditEvent = { id: number; actor: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };

export function AdminAudit() {
  const events = useAdmin<AuditEvent[]>("/audit?limit=200");
  return (
    <div>
      <PageHeader title="Auditoría" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Auditoría" }]} subtitle="Últimos 200 eventos: accesos, cambios de privilegios, asignaciones, importaciones y descargas administrativas." />
      {events.isLoading ? <Spinner /> : (
        <Card>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="text-tenue"><th className="py-2">Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Detalles</th></tr></thead>
            <tbody>{events.data?.map((e) => (
              <tr key={e.id} className="border-t border-borde align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(e.created_at)}</td><td className="pr-2">{e.actor ?? "—"}</td><td className="pr-2 font-mono text-xs">{e.action}</td>
                <td className="pr-2">{e.entity_type} {e.entity_id ?? ""}</td><td className="font-mono text-xs">{Object.keys(e.details).length ? JSON.stringify(e.details) : ""}</td>
              </tr>))}</tbody>
          </table></div>
        </Card>
      )}
    </div>
  );
}
