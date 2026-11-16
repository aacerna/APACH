import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { RULE_NAMES } from "../../lib/guides";
import type { DocumentItem, Section, SectionStats } from "../../lib/types";
import { DocumentTable } from "../student/DocumentsPage";

type TeacherSection = { section: Section; stats: SectionStats };

function StatsTable({ stats }: { stats: SectionStats }) {
  if (!stats.findings_by_rule.length) return <p className="text-sm text-tenue">Sin hallazgos registrados todavía.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Hallazgos por regla en la última revisión de cada documento</caption>
        <thead><tr className="text-tenue"><th className="py-1 pr-2">Regla</th><th className="py-1 pr-2">Errores verificados</th><th className="py-1 pr-2">Posibles / docente</th><th className="py-1">No verificables</th></tr></thead>
        <tbody>
          {stats.findings_by_rule.map((r) => (
            <tr key={r.rule_code} className="border-t border-borde">
              <td className="py-1 pr-2">{r.rule_code} · {RULE_NAMES[r.rule_code]}</td>
              <td className="py-1 pr-2">{r.verified_errors}</td><td className="py-1 pr-2">{r.possible_or_teacher}</td><td className="py-1">{r.not_verifiable}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeacherDashboard() {
  const q = useQuery({ queryKey: ["teacher-sections"], queryFn: () => api<TeacherSection[]>("/teacher/sections") });
  return (
    <div>
      <PageHeader title="Mis secciones" subtitle="Solo ves las secciones que la administración te asignó. Los indicadores son orientativos y no equivalen a una nota." />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorState error={q.error} /> : q.data?.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {q.data.map(({ section: s, stats }) => (
            <Card as="li" key={s.id}>
              <h2 className="text-lg font-semibold text-petroleo"><Link className="hover:underline" to={`/docente/secciones/${s.id}`}>{s.course.name} · Sección {s.code}</Link></h2>
              <p className="text-sm text-tenue">{s.course.code} · {s.term.name} · {s.course.program.name}</p>
              <dl className="my-4 grid grid-cols-4 gap-2 text-center">
                {([["Estudiantes", stats.students], ["Documentos", stats.documents], ["Revisados", stats.reviewed], ["Pendientes", stats.pending]] as const).map(([l, n]) => (
                  <div key={l} className="rounded-lg bg-fondo p-2"><dt className="text-xs text-tenue">{l}</dt><dd className="text-xl font-bold">{n}</dd></div>
                ))}
              </dl>
              <StatsTable stats={stats} />
              <Link className="mt-3 inline-block text-sm font-semibold text-celeste-700 underline" to={`/docente/secciones/${s.id}`}>Ver documentos y estudiantes</Link>
            </Card>
          ))}
        </ul>
      ) : <EmptyState title="No tienes secciones asignadas">La administración académica debe asignarte a una sección.</EmptyState>}
    </div>
  );
}

type StudentRow = { id: number; full_name: string; email: string; is_active: boolean; documents: number };

export function TeacherSectionPage() {
  const { id } = useParams();
  const sid = Number(id);
  const sections = useQuery({ queryKey: ["teacher-sections"], queryFn: () => api<TeacherSection[]>("/teacher/sections") });
  const students = useQuery({ queryKey: ["section-students", sid], queryFn: () => api<StudentRow[]>(`/teacher/sections/${sid}/students`), retry: false });
  const docs = useQuery({ queryKey: ["documents", sid], queryFn: () => api<DocumentItem[]>(`/documents?section_id=${sid}`) });
  const current = sections.data?.find((x) => x.section.id === sid);
  if (students.error) return <ErrorState error={students.error} />;
  return (
    <div className="space-y-6">
      <PageHeader title={current ? `${current.section.course.name} · Sección ${current.section.code}` : "Sección"} crumbs={[{ to: "/docente", label: "Mis secciones" }, { label: "Sección" }]}
        subtitle={current?.stats.disclaimer} />
      <section aria-labelledby="docs-title">
        <h2 id="docs-title" className="mb-3 text-lg font-semibold text-petroleo">Documentos cargados</h2>
        {docs.isLoading ? <Spinner /> : docs.data?.length ? <DocumentTable docs={docs.data} showStudent /> : <EmptyState title="Aún no hay documentos en esta sección" />}
      </section>
      <section aria-labelledby="students-title">
        <h2 id="students-title" className="mb-3 text-lg font-semibold text-petroleo">Estudiantes matriculados</h2>
        {students.isLoading ? <Spinner /> : (
          <Card>
            <ul className="divide-y divide-borde text-sm">
              {students.data?.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span><strong>{s.full_name}</strong> <span className="text-tenue">· {s.email}</span>{!s.is_active && <span className="ml-2 text-xs text-tenue">(cuenta sin activar)</span>}</span>
                  <span>{s.documents} documento(s)</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
