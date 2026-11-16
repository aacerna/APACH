export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const fmtSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
export const roleLabel = { ADMIN: "Administración", TEACHER: "Docente", STUDENT: "Estudiante" } as const;
export const severityLabel = { ERROR: "Error verificado", POSSIBLE_PROBLEM: "Posible problema", NEEDS_TEACHER: "Requiere revisión docente" } as const;
export const verificationLabel = { CHECKED: "Comprobado", NOT_VERIFIABLE: "No verificable", NOT_APPLICABLE: "No aplica" } as const;
export const outcomeLabel = { PASSED: "Sin hallazgos", FINDINGS: "Con hallazgos", NOT_APPLICABLE: "No aplica", NOT_VERIFIABLE: "No verificable" } as const;
export const statusLabel = { UPLOADED: "Cargado", ANALYZING: "Analizando", ANALYZED: "Analizado", FAILED: "Falló el análisis" } as const;
export const reviewLabel = { PENDING: "Pendiente de revisión", REVIEWED: "Revisado por docente" } as const;
