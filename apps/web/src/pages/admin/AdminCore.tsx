import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Card, ErrorState, Field, PageHeader, Spinner, inputClass } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, roleLabel } from "../../lib/format";
import { RULE_NAMES } from "../../lib/guides";
import type { AccountLink, Course, FindingsByRule, Program, Role, Section, Term, User } from "../../lib/types";

export const useAdmin = <T,>(path: string) => useQuery({ queryKey: ["admin", path], queryFn: () => api<T>(`/admin${path}`) });

export function useAdminMutation<TVars>(fn: (v: TVars) => Promise<unknown>, invalidate: string[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate.forEach((p) => qc.invalidateQueries({ queryKey: ["admin", p] })) });
}

export function DevLink({ link }: { link: AccountLink | null }) {
  if (!link) return null;
  return (
    <Alert tone={link.dev_link ? "warning" : "info"} title={`Enlace de ${link.purpose === "ACTIVATION" ? "activación" : "restablecimiento"} para ${link.user.email}`}>
      {link.dev_link ? (
        <>
          <p className="break-all font-mono text-xs">{link.dev_link}</p>
          <p className="mt-1">Vence: {fmtDate(link.expires_at)}. {link.notice}</p>
          <Button className="mt-2" variant="secondary" onClick={() => navigator.clipboard.writeText(link.dev_link!)}>Copiar enlace</Button>
        </>
      ) : <p>{link.notice}</p>}
    </Alert>
  );
}

// ------------------------------------------------------------------ resumen / reportes
type Report = {
  generated_at: string; documents: number; students_with_documents: number; documents_by_status: Record<string, number>;
  findings_by_rule: FindingsByRule[]; users: Record<Role, number>; disclaimer: string;
};

export function AdminSummary() {
  const programs = useAdmin<Program[]>("/programs");
  const terms = useAdmin<Term[]>("/terms");
  const sections = useAdmin<Section[]>("/sections");
  const [filters, setFilters] = useState({ term_id: "", program_id: "", section_id: "" });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const report = useQuery({ queryKey: ["admin", "report", qs], queryFn: () => api<Report>(`/admin/reports/summary${qs ? `?${qs}` : ""}`) });
  return (
    <div className="space-y-6">
      <PageHeader title="Administración" subtitle="Resumen agregado de uso. Cada reporte generado queda registrado en la auditoría." />
      <Card>
        <h2 className="mb-3 font-semibold text-petroleo">Filtros del reporte</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ciclo" htmlFor="f-term"><select id="f-term" className={inputClass} value={filters.term_id} onChange={(e) => setFilters({ ...filters, term_id: e.target.value })}>
            <option value="">Todos</option>{terms.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Programa" htmlFor="f-prog"><select id="f-prog" className={inputClass} value={filters.program_id} onChange={(e) => setFilters({ ...filters, program_id: e.target.value })}>
            <option value="">Todos</option>{programs.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Sección" htmlFor="f-sec"><select id="f-sec" className={inputClass} value={filters.section_id} onChange={(e) => setFilters({ ...filters, section_id: e.target.value })}>
            <option value="">Todas</option>{sections.data?.map((s) => <option key={s.id} value={s.id}>{s.course.code}-{s.code} ({s.term.code})</option>)}</select></Field>
        </div>
      </Card>
      {report.isLoading ? <Spinner /> : report.error ? <ErrorState error={report.error} /> : report.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {([["Documentos", report.data.documents], ["Estudiantes con documentos", report.data.students_with_documents], ["Estudiantes", report.data.users.STUDENT], ["Docentes", report.data.users.TEACHER], ["Administradores", report.data.users.ADMIN]] as const).map(([l, n]) => (
              <Card key={l} className="text-center"><p className="text-3xl font-bold text-petroleo">{n}</p><p className="text-sm text-tenue">{l}</p></Card>
            ))}
          </div>
          <Card>
            <h2 className="mb-2 font-semibold text-petroleo">Hallazgos por regla (última revisión de cada documento)</h2>
            {report.data.findings_by_rule.length ? (
              <table className="w-full text-left text-sm">
                <thead><tr className="text-tenue"><th className="py-1">Regla</th><th>Errores verificados</th><th>Posibles / docente</th><th>No verificables</th></tr></thead>
                <tbody>{report.data.findings_by_rule.map((r) => (
                  <tr key={r.rule_code} className="border-t border-borde"><td className="py-1">{r.rule_code} · {RULE_NAMES[r.rule_code] ?? ""}</td><td>{r.verified_errors}</td><td>{r.possible_or_teacher}</td><td>{r.not_verifiable}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="text-sm text-tenue">Sin análisis en el alcance seleccionado.</p>}
            <p className="mt-3 text-xs text-tenue">{report.data.disclaimer} Generado: {fmtDate(report.data.generated_at)}.</p>
          </Card>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ usuarios
export function AdminUsers() {
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const qs = new URLSearchParams({ ...(role ? { role } : {}), ...(q ? { q } : {}) }).toString();
  const users = useQuery({ queryKey: ["admin", "/users", qs], queryFn: () => api<User[]>(`/admin/users${qs ? `?${qs}` : ""}`) });
  const programs = useAdmin<Program[]>("/programs");
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", role: "STUDENT", program_id: "" });
  const [link, setLink] = useState<AccountLink | null>(null);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "/users"] });
  const create = useMutation({
    mutationFn: () => api<AccountLink>("/admin/users", { method: "POST", json: { ...form, program_id: form.program_id ? Number(form.program_id) : null } }),
    onSuccess: (r) => { setLink(r); setForm({ email: "", first_name: "", last_name: "", role: "STUDENT", program_id: "" }); refresh(); },
  });
  const toggle = useMutation({ mutationFn: (u: User) => api(`/admin/users/${u.id}`, { method: "PATCH", json: { is_active: !u.is_active } }), onSuccess: refresh });
  const issue = useMutation({
    mutationFn: (u: User) => api<AccountLink>(`/admin/users/${u.id}/${u.is_active || u.must_change_password ? "reset-link" : "activation-link"}`, { method: "POST" }),
    onSuccess: setLink,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Usuarios" }]}
        subtitle="Solo la administración crea cuentas. Las cuentas nuevas quedan inactivas hasta que la persona use su enlace de activación." />
      <DevLink link={link} />
      {(toggle.error || issue.error) && <ErrorState error={toggle.error ?? issue.error} />}
      <Card>
        <h2 className="mb-3 font-semibold text-petroleo">Crear cuenta</h2>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }}>
          <Field label="Correo" htmlFor="u-email" required><input id="u-email" type="email" required className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Nombre" htmlFor="u-first" required><input id="u-first" required className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
          <Field label="Apellido" htmlFor="u-last" required><input id="u-last" required className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
          <Field label="Rol" htmlFor="u-role" required><select id="u-role" className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {(["STUDENT", "TEACHER", "ADMIN"] as const).map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></Field>
          <Field label="Programa" htmlFor="u-prog"><select id="u-prog" className={inputClass} value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
            <option value="">—</option>{programs.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <div className="sm:col-span-2 lg:col-span-5">{create.error && <ErrorState error={create.error} />}<Button type="submit" disabled={create.isPending}>Crear cuenta y generar enlace</Button></div>
        </form>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <Field label="Buscar" htmlFor="u-q"><input id="u-q" type="search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Rol" htmlFor="u-rf"><select id="u-rf" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos</option>{(["STUDENT", "TEACHER", "ADMIN"] as const).map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></Field>
        </div>
        {users.isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-tenue"><th className="py-2">Nombre</th><th>Correo</th><th>Rol</th><th>Programa</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{users.data?.map((u) => (
                <tr key={u.id} className="border-t border-borde">
                  <td className="py-2 pr-2 font-semibold">{u.full_name}</td><td className="pr-2">{u.email}</td><td className="pr-2">{roleLabel[u.role]}</td>
                  <td className="pr-2">{u.program?.code ?? "—"}</td><td className="pr-2">{u.is_active ? "Activa" : "Inactiva"}</td>
                  <td className="flex flex-wrap gap-1 py-1">
                    <Button variant="ghost" onClick={() => issue.mutate(u)}>{u.is_active ? "Enlace de restablecimiento" : "Enlace de activación"}</Button>
                    <Button variant="ghost" onClick={() => toggle.mutate(u)}>{u.is_active ? "Desactivar" : "Reactivar"}</Button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ estructura académica
function Section_({ title, children }: { title: string; children: ReactNode }) {
  return <Card><h2 className="mb-3 text-lg font-semibold text-petroleo">{title}</h2>{children}</Card>;
}

export function AdminAcademic() {
  const programs = useAdmin<Program[]>("/programs");
  const terms = useAdmin<Term[]>("/terms");
  const courses = useAdmin<Course[]>("/courses");
  const sections = useAdmin<Section[]>("/sections");
  const all = ["/programs", "/terms", "/courses", "/sections"];
  const [p, setP] = useState({ code: "", name: "" });
  const [t, setT] = useState({ code: "", name: "", start_date: "", end_date: "" });
  const [c, setC] = useState({ code: "", name: "", program_id: "" });
  const [s, setS] = useState({ course_id: "", term_id: "", code: "" });
  const useCreate = (path: string, body: () => unknown, after: () => void) => useAdminMutation(() => api(`/admin${path}`, { method: "POST", json: body() }).then(after), all);
  const addP = useCreate("/programs", () => ({ ...p, code: p.code.toUpperCase() }), () => setP({ code: "", name: "" }));
  const addT = useCreate("/terms", () => t, () => setT({ code: "", name: "", start_date: "", end_date: "" }));
  const addC = useCreate("/courses", () => ({ ...c, program_id: Number(c.program_id) }), () => setC({ code: "", name: "", program_id: "" }));
  const addS = useCreate("/sections", () => ({ ...s, course_id: Number(s.course_id), term_id: Number(s.term_id) }), () => setS({ course_id: "", term_id: "", code: "" }));
  const toggleP = useAdminMutation((x: Program) => api(`/admin/programs/${x.id}`, { method: "PUT", json: { code: x.code, name: x.name, active: !x.active } }), all);
  const toggleT = useAdminMutation((x: Term) => api(`/admin/terms/${x.id}`, { method: "PUT", json: { code: x.code, name: x.name, start_date: x.start_date, end_date: x.end_date, active: !x.active } }), all);
  const toggleC = useAdminMutation((x: Course) => api(`/admin/courses/${x.id}`, { method: "PUT", json: { code: x.code, name: x.name, program_id: x.program_id, active: !x.active } }), all);
  const toggleS = useAdminMutation((x: Section) => api(`/admin/sections/${x.id}`, { method: "PUT", json: { course_id: x.course.id, term_id: x.term.id, code: x.code, active: !x.active } }), all);
  const err = addP.error ?? addT.error ?? addC.error ?? addS.error ?? toggleP.error ?? toggleT.error ?? toggleC.error ?? toggleS.error;
  const row = "flex flex-wrap items-center justify-between gap-2 border-t border-borde py-2 text-sm";
  const toggleBtn = (active: boolean, onClick: () => void) => <Button variant="ghost" onClick={onClick}>{active ? "Desactivar" : "Activar"}</Button>;

  return (
    <div className="space-y-6">
      <PageHeader title="Estructura académica" crumbs={[{ to: "/admin", label: "Administración" }, { label: "Estructura académica" }]}
        subtitle="Programas, ciclos, asignaturas y secciones. Se prefiere desactivar en lugar de borrar." />
      {err && <ErrorState error={err} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section_ title="Programas">
          <form className="mb-3 grid gap-2 sm:grid-cols-[8rem_1fr_auto]" onSubmit={(e) => { e.preventDefault(); addP.mutate(undefined); }}>
            <input aria-label="Código del programa" placeholder="Código" required className={inputClass} value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} />
            <input aria-label="Nombre del programa" placeholder="Nombre" required className={inputClass} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            <Button type="submit">Agregar</Button>
          </form>
          {programs.data?.map((x) => <div key={x.id} className={row}><span><strong>{x.code}</strong> · {x.name} {!x.active && "(inactivo)"}</span>{toggleBtn(x.active, () => toggleP.mutate(x))}</div>)}
        </Section_>
        <Section_ title="Ciclos académicos">
          <form className="mb-3 grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); addT.mutate(undefined); }}>
            <input aria-label="Código del ciclo" placeholder="Código (2027-01)" required className={inputClass} value={t.code} onChange={(e) => setT({ ...t, code: e.target.value })} />
            <input aria-label="Nombre del ciclo" placeholder="Nombre" required className={inputClass} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
            <label className="text-xs">Inicio<input type="date" required className={inputClass} value={t.start_date} onChange={(e) => setT({ ...t, start_date: e.target.value })} /></label>
            <label className="text-xs">Fin<input type="date" required className={inputClass} value={t.end_date} onChange={(e) => setT({ ...t, end_date: e.target.value })} /></label>
            <Button type="submit" className="sm:col-span-2">Agregar ciclo</Button>
          </form>
          {terms.data?.map((x) => <div key={x.id} className={row}><span><strong>{x.code}</strong> · {x.name} ({x.start_date} → {x.end_date}) {!x.active && "(inactivo)"}</span>{toggleBtn(x.active, () => toggleT.mutate(x))}</div>)}
        </Section_>
        <Section_ title="Asignaturas">
          <form className="mb-3 grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); addC.mutate(undefined); }}>
            <input aria-label="Código de asignatura" placeholder="Código" required className={inputClass} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} />
            <input aria-label="Nombre de asignatura" placeholder="Nombre" required className={inputClass} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <select aria-label="Programa de la asignatura" required className={inputClass} value={c.program_id} onChange={(e) => setC({ ...c, program_id: e.target.value })}>
              <option value="">Programa…</option>{programs.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <Button type="submit">Agregar asignatura</Button>
          </form>
          {courses.data?.map((x) => <div key={x.id} className={row}><span><strong>{x.code}</strong> · {x.name} · {x.program.code} {!x.active && "(inactiva)"}</span>{toggleBtn(x.active, () => toggleC.mutate(x))}</div>)}
        </Section_>
        <Section_ title="Secciones">
          <form className="mb-3 grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); addS.mutate(undefined); }}>
            <select aria-label="Asignatura de la sección" required className={inputClass} value={s.course_id} onChange={(e) => setS({ ...s, course_id: e.target.value })}>
              <option value="">Asignatura…</option>{courses.data?.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}</select>
            <select aria-label="Ciclo de la sección" required className={inputClass} value={s.term_id} onChange={(e) => setS({ ...s, term_id: e.target.value })}>
              <option value="">Ciclo…</option>{terms.data?.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}</select>
            <input aria-label="Código de sección" placeholder="01" required className={inputClass} value={s.code} onChange={(e) => setS({ ...s, code: e.target.value })} />
            <Button type="submit" className="sm:col-span-3">Agregar sección</Button>
          </form>
          {sections.data?.map((x) => (
            <div key={x.id} className={row}>
              <span><strong>{x.course.code}-{x.code}</strong> · {x.term.code} · {x.student_count ?? 0} estudiantes · Docente: {x.teachers.join(", ") || "sin asignar"} {!x.active && "(inactiva)"}</span>
              {toggleBtn(x.active, () => toggleS.mutate(x))}
            </div>
          ))}
        </Section_>
      </div>
    </div>
  );
}
