import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LinkButton, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, reviewLabel, statusLabel } from "../../lib/format";
import type { DocumentItem } from "../../lib/types";

export function DocumentTable({ docs, showStudent = false }: { docs: DocumentItem[]; showStudent?: boolean }) {
  return (
    <div className="tile overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-fondo text-xs font-extrabold uppercase tracking-wide text-tenue">
          <tr>
            <th className="p-3">Documento</th>
            {showStudent && <th className="p-3">Estudiante</th>}
            <th className="p-3">Curso</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Hallazgos</th>
            <th className="p-3">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-t-2 border-borde font-semibold">
              <td className="p-3"><Link className="font-extrabold text-celeste-700 hover:underline" to={`/trabajos/${d.id}`}>{d.original_filename}</Link></td>
              {showStudent && <td className="p-3">{d.student_name}</td>}
              <td className="p-3">{d.section_label}</td>
              <td className="p-3">{statusLabel[d.status]}<span className="block text-xs text-tenue">{reviewLabel[d.review_status]}{d.comment_count ? ` · ${d.comment_count} comentario(s)` : ""}</span></td>
              <td className="p-3">
                {d.latest_counts ? (
                  <span className="text-xs">
                    <strong>{d.latest_counts.errors}</strong> verificados · {d.latest_counts.possible_problems} posibles · {d.latest_counts.needs_teacher} para docente
                  </span>
                ) : "—"}
              </td>
              <td className="p-3 whitespace-nowrap">{fmtDate(d.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentsPage() {
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => api<DocumentItem[]>("/documents") });
  return (
    <div>
      <PageHeader title="Mis trabajos" crumbs={[{ to: "/inicio", label: "Inicio" }, { label: "Mis trabajos" }]} actions={<LinkButton to="/revisar">Revisar otro documento</LinkButton>} />
      {docs.isLoading ? <Spinner /> : docs.error ? <ErrorState error={docs.error} /> : docs.data?.length ? <DocumentTable docs={docs.data} /> : (
        <EmptyState title="Aún no has cargado documentos" action={<LinkButton to="/revisar">Revisar mi documento</LinkButton>}>
          Carga tu primer trabajo en formato .docx para recibir hallazgos con evidencia.
        </EmptyState>
      )}
    </div>
  );
}
