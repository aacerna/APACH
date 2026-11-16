import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { IconArrow, IconBook, IconCompass, IconDocCheck, IconFolder, IconLibrary, IconQuote, IconTemplate } from "../../components/icons";
import { Alert, Card, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { DocumentItem, PublicSettings, Section } from "../../lib/types";

const ACTIONS = [
  { to: "/revisar", title: "Revisar mi documento", text: "Sube tu Word y descubre qué ajustar, con evidencia.", tone: "bg-naranja text-tinta", chip: "bg-white/40", Icon: IconDocCheck },
  { to: "/generador", title: "Crear una referencia", text: "Escribe los datos de tu fuente y copia la referencia lista.", tone: "bg-petroleo text-white", chip: "bg-white/15", Icon: IconQuote },
  { to: "/aprende", title: "Aprender APA", text: "Fichas cortas: qué es, cómo se aplica y cómo corregirlo.", tone: "bg-celeste text-tinta", chip: "bg-white/40", Icon: IconBook },
  { to: "/trabajos", title: "Mis trabajos", text: "Tus revisiones anteriores y los comentarios de tu docente.", tone: "bg-amarillo text-tinta", chip: "bg-white/45", Icon: IconFolder },
];

const QUICK = [
  { to: "/plantillas", label: "Plantillas de la escuela", Icon: IconTemplate, tone: "bg-terracota-50 text-terracota-700" },
  { to: "/biblioteca", label: "Mi biblioteca de referencias", Icon: IconLibrary, tone: "bg-celeste-50 text-celeste-700" },
  { to: "/referencias", label: "Explora las referencias APA", Icon: IconCompass, tone: "bg-amarillo-50 text-petroleo" },
];

export function StudentDashboard() {
  const { user } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<PublicSettings>("/settings/public") });
  const sections = useQuery({ queryKey: ["sections"], queryFn: () => api<Section[]>("/sections") });
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => api<DocumentItem[]>("/documents") });
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amarillo-100 via-naranja-50 to-celeste-50 p-6 shadow-suave sm:p-8">
        <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-naranja/20" />
        <div aria-hidden="true" className="absolute -bottom-12 right-24 h-28 w-28 rounded-full bg-celeste/25" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <img src="/brand/pacho.png" alt="Pacho, la mascota de APACH" className="pacho-saluda h-28 w-28 shrink-0 drop-shadow-lg sm:h-36 sm:w-36" />
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wider text-terracota-700">Apapacho · tu asistente de APA</p>
            <h1 className="mt-1 text-3xl font-bold text-petroleo sm:text-4xl">¡Hola, <span className="marca">{firstName}</span>!</h1>
            <p className="mt-2 max-w-xl text-lg text-tinta">¿Qué hacemos hoy con tu trabajo? Te muestro qué revisar y cómo corregirlo; la evaluación final siempre la hace tu docente.</p>
          </div>
        </div>
      </section>

      {settings.data?.welcome_video_url && (
        <Card>
          <h2 className="text-xl font-bold text-petroleo">Video de bienvenida</h2>
          <a className="mt-1 inline-block font-bold text-celeste-700 underline" href={settings.data.welcome_video_url} target="_blank" rel="noreferrer noopener">Ver video de bienvenida (se abre en otra pestaña)</a>
        </Card>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map(({ to, title, text, tone, chip, Icon }) => (
          <li key={to}>
            <Link to={to} className={`group flex h-full items-start gap-4 rounded-3xl p-5 shadow-suave transition hover:-translate-y-1 hover:shadow-lg sm:p-6 ${tone}`}>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${chip}`}><Icon /></span>
              <span className="flex-1">
                <span className="font-display text-xl font-bold">{title}</span>
                <span className="mt-1 block text-sm font-semibold opacity-90">{text}</span>
              </span>
              <IconArrow className="mt-1 h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <Card>
          <h2 className="mb-3 text-xl font-bold text-petroleo">Mis cursos</h2>
          {sections.isLoading ? <Spinner /> : sections.data?.length ? (
            <ul className="space-y-2 text-sm">
              {sections.data.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-fondo p-3">
                  <span aria-hidden="true" className={`h-10 w-2 rounded-full ${["bg-naranja", "bg-celeste", "bg-amarillo", "bg-terracota"][i % 4]}`} />
                  <span>
                    <span className="font-bold">{s.course.name}</span> · Sección {s.code} · {s.term.name}
                    {s.teachers.length > 0 && <span className="block text-tenue">Docente: {s.teachers.join(", ")}</span>}
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
          <h2 className="mb-3 text-xl font-bold text-petroleo">Accesos rápidos</h2>
          <ul className="space-y-2">
            {QUICK.map(({ to, label, Icon, tone }) => (
              <li key={to}>
                <Link to={to} className={`flex items-center gap-3 rounded-2xl p-3 text-sm font-bold transition hover:translate-x-1 ${tone}`}>
                  <Icon className="h-5 w-5" /> {label}
                </Link>
              </li>
            ))}
          </ul>
          {docs.data && docs.data.length > 0 && (
            <p className="mt-4 text-sm text-tenue">Tienes {docs.data.length} documento(s) cargado(s). <Link className="font-bold text-celeste-700 underline" to="/trabajos">Ver mis trabajos</Link></p>
          )}
        </Card>
      </div>
    </div>
  );
}
