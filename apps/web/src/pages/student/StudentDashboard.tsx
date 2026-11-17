import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { IconArrow, IconBook, IconCompass, IconDocCheck, IconFolder, IconLibrary, IconQuote, IconTemplate } from "../../components/icons";
import { Alert, Card, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { DocumentItem, PublicSettings, Section } from "../../lib/types";

const ACTIONS = [
  { to: "/revisar", title: "Revisar mi documento", text: "Sube tu Word y descubre qué ajustar.", tone: "bg-naranja border-naranja-600 text-tinta", Icon: IconDocCheck },
  { to: "/generador", title: "Crear una referencia", text: "Datos de tu fuente → referencia lista.", tone: "bg-petroleo border-petroleo-700 text-white", Icon: IconQuote },
  { to: "/aprende", title: "Aprender APA", text: "Fichas cortas para corregir.", tone: "bg-celeste border-celeste-600 text-tinta", Icon: IconBook },
  { to: "/trabajos", title: "Mis trabajos", text: "Revisiones y comentarios de tu docente.", tone: "bg-amarillo border-amarillo-600 text-tinta", Icon: IconFolder },
];

const QUICK = [
  { to: "/plantillas", label: "Plantillas", Icon: IconTemplate, tone: "text-terracota-700 bg-terracota-50" },
  { to: "/biblioteca", label: "Mi biblioteca", Icon: IconLibrary, tone: "text-celeste-700 bg-celeste-50" },
  { to: "/referencias", label: "Explorar referencias", Icon: IconCompass, tone: "text-petroleo bg-amarillo-50" },
];

export function StudentDashboard() {
  const { user } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<PublicSettings>("/settings/public") });
  const sections = useQuery({ queryKey: ["sections"], queryFn: () => api<Section[]>("/sections") });
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => api<DocumentItem[]>("/documents") });
  const firstName = user?.full_name.split(" ")[0] ?? "";
  const analyzed = docs.data?.filter((d) => d.status === "ANALYZED").length ?? 0;
  const reviewed = docs.data?.filter((d) => d.review_status === "REVIEWED").length ?? 0;
  const stats = [
    { label: "Documentos revisados", short: "Revisados", value: analyzed, tone: "text-naranja-600" },
    { label: "Con revisión docente", short: "Con docente", value: reviewed, tone: "text-celeste-700" },
    { label: "Cursos", short: "Cursos", value: sections.data?.length ?? 0, tone: "text-terracota-700" },
  ];

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-3 sm:gap-4">
        <img src="/brand/pacho.png" alt="Pacho, la mascota de APACH" className="pacho-saluda h-20 w-20 shrink-0 sm:h-32 sm:w-32" />
        <div className="relative min-w-0 rounded-3xl border-2 border-b-4 border-borde bg-white px-4 py-3 sm:px-5 sm:py-4">
          <span aria-hidden="true" className="absolute -left-[10px] top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-borde bg-white" />
          <h1 className="text-2xl text-petroleo sm:text-4xl">¡Hola, {firstName}!</h1>
          <p className="mt-1 text-sm font-bold text-tenue sm:text-base">¿Qué hacemos hoy con tu trabajo? Yo te ayudo con APA; la evaluación final la hace tu docente.</p>
        </div>
      </section>

      <ul className="grid grid-cols-3 gap-3" aria-label="Tu actividad">
        {stats.map((s) => (
          <li key={s.label} className="tile px-3 py-3 text-center">
            <span className={`block text-3xl font-black ${s.tone}`}>{docs.isLoading ? "–" : s.value}</span>
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-tenue sm:text-xs"><span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.label}</span></span>
          </li>
        ))}
      </ul>

      {settings.data?.welcome_video_url && (
        <a className="tile flex items-center gap-3 p-4 font-extrabold text-celeste-700" href={settings.data.welcome_video_url} target="_blank" rel="noreferrer noopener">
          ▶ Ver video de bienvenida (se abre en otra pestaña)
        </a>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map(({ to, title, text, tone, Icon }) => (
          <li key={to}>
            <Link to={to} className={`btn-3d group flex h-full items-center gap-4 rounded-3xl p-5 ${tone}`}>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/25"><Icon className="h-9 w-9" /></span>
              <span className="flex-1">
                <span className="block text-xl font-black">{title}</span>
                <span className="mt-0.5 block text-sm font-bold opacity-90">{text}</span>
              </span>
              <IconArrow className="h-6 w-6 shrink-0 transition group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <Card>
          <h2 className="mb-4 text-2xl text-petroleo">Mis cursos</h2>
          {sections.isLoading ? <Spinner /> : sections.data?.length ? (
            <ul className="space-y-3">
              {sections.data.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border-2 border-borde p-3">
                  <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black ${["bg-naranja text-tinta", "bg-celeste text-tinta", "bg-amarillo text-tinta", "bg-petroleo text-white"][i % 4]}`}>{s.course.name.charAt(0)}</span>
                  <span className="text-sm">
                    <span className="block font-extrabold">{s.course.name}</span>
                    <span className="font-semibold text-tenue">Sección {s.code} · {s.term.name}{s.teachers.length > 0 && <> · {s.teachers.join(", ")}</>}</span>
                  </span>
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
          <h2 className="mb-4 text-2xl text-petroleo">Accesos rápidos</h2>
          <ul className="space-y-3">
            {QUICK.map(({ to, label, Icon, tone }) => (
              <li key={to}>
                <Link to={to} className="btn-3d flex items-center gap-3 rounded-2xl border-2 border-b-4 border-borde bg-white p-3 text-sm font-extrabold uppercase tracking-wide text-petroleo">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-6 w-6" /></span> {label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
