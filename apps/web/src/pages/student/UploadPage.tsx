import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Field, inputClass, PageHeader, Spinner } from "../../components/ui";
import { api, uploadWithProgress } from "../../lib/api";
import type { Analysis, DocumentItem, PublicSettings, Section } from "../../lib/types";

const MAX_MB = 10;

export function validateFile(file: File | null): string | null {
  if (!file) return "Selecciona un archivo.";
  if (!file.name.toLowerCase().endsWith(".docx")) return "Solo se aceptan documentos Word con extensión .docx (no .doc ni .pdf).";
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_MB * 1024 * 1024) return `El archivo supera ${MAX_MB} MB.`;
  return null;
}

export function UploadPage() {
  const sections = useQuery({ queryKey: ["sections"], queryFn: () => api<Section[]>("/sections") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<PublicSettings>("/settings/public") });
  const [sectionId, setSectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analyzing">("idle");
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validateFile(file);
    setFileError(problem);
    if (problem || !sectionId) return;
    const form = new FormData();
    form.append("section_id", sectionId);
    form.append("file", file!);
    try {
      setPhase("uploading");
      const doc = await uploadWithProgress<DocumentItem>("/documents", form, setProgress);
      setPhase("analyzing");
      await api<Analysis>(`/documents/${doc.id}/analyze`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["documents"] });
      navigate(`/trabajos/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el documento.");
      setPhase("idle");
      setProgress(null);
    }
  }

  if (sections.isLoading) return <Spinner />;
  const list = sections.data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Revisar mi documento" crumbs={[{ to: "/inicio", label: "Inicio" }, { label: "Revisar documento" }]}
        subtitle="APACH analiza formato, citas y referencias con reglas programadas. No usa inteligencia artificial ni califica tu trabajo." />
      {list.length === 0 ? (
        <Alert tone="info" title="No tienes cursos asignados">
          Para revisar documentos necesitas una matrícula activa. Contacta a: {settings.data?.institutional_contact ?? "la coordinación académica"}.
        </Alert>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && <Alert tone="error" title="No se pudo completar la revisión">{error}</Alert>}
            <Field label="1. Elige el curso" htmlFor="section" required>
              <select id="section" className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                <option value="">Selecciona un curso…</option>
                {list.map((s) => <option key={s.id} value={s.id}>{s.course.name} · Sección {s.code} ({s.term.code})</option>)}
              </select>
            </Field>
            <Field label="2. Selecciona tu archivo Word (.docx)" htmlFor="file" error={fileError ?? undefined} help={`Máximo ${MAX_MB} MB. Los archivos .doc antiguos y PDF no se analizan.`} required>
              <input id="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className={inputClass} aria-invalid={!!fileError}
                onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setFileError(f ? validateFile(f) : null); }} />
            </Field>
            {phase !== "idle" && (
              <div aria-live="polite" className="space-y-2">
                <progress className="h-2 w-full" max={100} value={phase === "analyzing" ? 100 : progress ?? 0} />
                <p className="text-sm text-tenue">{phase === "uploading" ? `Subiendo… ${progress ?? 0}%` : "Analizando el documento con las reglas APA…"}</p>
              </div>
            )}
            <Button type="submit" disabled={phase !== "idle" || !sectionId || !file}>Revisar documento</Button>
            <p className="text-xs text-tenue">Tu archivo se guarda de forma privada. Solo tú, tu docente de la sección y la administración autorizada pueden verlo.</p>
          </form>
        </Card>
      )}
    </div>
  );
}
