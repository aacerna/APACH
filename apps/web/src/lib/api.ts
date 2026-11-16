/** Cliente HTTP de la API. Cookies HttpOnly + cabecera CSRF en métodos que modifican datos. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public network = false) {
    super(message);
  }
}

const BASE = "/api/v1";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)apach_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function messageFrom(body: unknown, status: number): { message: string; code?: string } {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return { message: detail };
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { message?: string; code?: string };
    return { message: d.message ?? "Error inesperado.", code: d.code };
  }
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: string[] };
    return { message: `Dato inválido${first?.loc ? ` (${first.loc.slice(1).join(".")})` : ""}: ${first?.msg ?? ""}`.trim() };
  }
  if (status === 404) return { message: "No encontrado." };
  return { message: `Error del servidor (${status}).` };
}

export async function api<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }
  if (UNSAFE.has(method)) headers.set("X-CSRF-Token", csrfToken());
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, method, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor de APACH.", "network", true);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const { message, code } = messageFrom(data, response.status);
    throw new ApiError(response.status, message, code);
  }
  return data as T;
}

/** Subida con progreso (XHR) para documentos. */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-CSRF-Token", csrfToken());
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(0, "No hay conexión con el servidor de APACH.", "network", true));
    xhr.onload = () => {
      const data = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        const { message, code } = messageFrom(data, xhr.status);
        reject(new ApiError(xhr.status, message, code));
      }
    };
    xhr.send(form);
  });
}
