import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import type { Template } from "../../lib/types";

export function TemplatesPage() {
  const q = useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/templates") });
  return (
    <div>
      <PageHeader title="Plantillas de la escuela" crumbs={[{ to: "/", label: "Inicio" }, { label: "Plantillas" }]}
        subtitle="Plantillas oficiales publicadas por la administración. Se abren en Google Drive y requieren conexión a internet." />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorState error={q.error} /> : q.data?.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {q.data.map((t) => (
            <Card as="li" key={t.id}>
              <h2 className="font-black text-petroleo">{t.name}</h2>
              <p className="text-xs text-tenue">{t.template_type}{t.program_name ? ` · ${t.program_name}` : " · Todos los programas"}</p>
              {t.description && <p className="mt-2 text-sm">{t.description}</p>}
              <a className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-terracota-700 px-4 text-sm font-semibold text-white hover:bg-terracota" href={t.url} target="_blank" rel="noreferrer noopener">Abrir plantilla (Google Drive)</a>
            </Card>
          ))}
        </ul>
      ) : (
        <EmptyState title="Aún no hay plantillas disponibles">
          La Escuela de Ciencias de la Comunicación publicará aquí sus plantillas cuando la administración configure los enlaces.
        </EmptyState>
      )}
    </div>
  );
}
