import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert, Card, PachoPlaceholder, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { DocumentItem, PublicSettings, Section } from "../../lib/types";

const ACTIONS = [
  { to: "/revisar", title: "Revisar mi documento", text: "Carga tu trabajo en Word (.docx) y recibe hallazgos con evidencia.", tone: "bg-terracota-700 text-white" },
  { to: "/generador", title: "Crear una referencia", text: "Genera la referencia y las citas APA a partir de los datos de tu fuente.", tone: "bg-petroleo text-white" },
  { to: "/aprende", title: "Aprender APA", text: "Fichas breves: qué es, cómo se aplica y cómo corregirlo.", tone: "bg-celeste-700 text-white" },
  { to: "/trabajos", title: "Mis trabajos", text: "Consulta tus revisiones anteriores y los comentarios de tu docente.", tone: "bg-white text-petroleo border border-petroleo/30" },
];

export function StudentDashboard() {
  const { user } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<PublicSettings>("/settings/public") });
  const sections = useQuery({ queryKey: ["sections"], queryFn: () => api<Section[]>("/sections") });
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => api<DocumentItem[]>("/documents") });
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title={`¡Hola, ${firstName}!`} subtitle="¿Qué quieres hacer hoy con tu trabajo académico?" />
      <PachoPlaceholder message="Soy tu asistente de APA. Te muestro qué revisar y cómo corregirlo; la evaluación final siempre la hace tu docente." />
      {settings.data?.welcome_video_url && (
        <Card>
          <h2 className="font-semibold text-petroleo">Video de bienvenida</h2>
          <a className="mt-1 inline-block text-celeste-700 underline" href={settings.data.welcome_video_url} target="_blank" rel="noreferrer noopener">Ver video de bienvenida (se abre en otra pestaña)</a>
        </Card>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <li key={a.to}>
            <Link to={a.to} className={`block h-full rounded-xl p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow ${a.tone}`}>
              <span className="text-lg font-bold">{a.title}</span>
              <span className="mt-1 block text-sm opacity-90">{a.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-petroleo">Mis cursos</h2>
          {sections.isLoading ? <Spinner /> : sections.data?.length ? (
            <ul className="space-y-2 text-sm">
              {sections.data.map((s) => (
                <li key={s.id} className="rounded-lg bg-fondo p-3">
                  <span className="font-semibold">{s.course.name}</span> · Sección {s.code} · {s.term.name}
                  {s.teachers.length > 0 && <span className="block text-tenue">Docente: {s.teachers.join(", ")}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <Alert tone="info" title="Aún no tienes cursos asignados">
              Para cargar documentos necesitas estar matriculado en una sección. Contacta a: {settings.data?.institutional_contact ?? "la coordinación académica"}.
            </Alert>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-petroleo">Accesos rápidos</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-celeste-700 underline" to="/plantillas">Plantillas de la escuela</Link></li>
            <li><Link className="text-celeste-700 underline" to="/biblioteca">Mi biblioteca de referencias</Link></li>
            <li><Link className="text-celeste-700 underline" to="/referencias">Explora las referencias APA</Link></li>
          </ul>
          {docs.data && docs.data.length > 0 && (
            <p className="mt-4 text-sm text-tenue">Tienes {docs.data.length} documento(s) cargado(s). <Link className="text-celeste-700 underline" to="/trabajos">Ver mis trabajos</Link></p>
          )}
        </Card>
      </div>
    </div>
  );
}
