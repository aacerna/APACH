/**
 * Biblioteca local de referencias en IndexedDB, separada por usuario (base «apach-library-<id>»).
 * Sincronización con PostgreSQL: ids estables (client_id), marcas de tiempo y «gana el más reciente»;
 * los borrados se propagan como lápidas.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { ReferenceInput, ReferenceOutput } from "@shared/references";
import { api } from "./api";

export type LibraryItem = {
  client_id: string;
  source_type: string;
  input: ReferenceInput;
  output: ReferenceOutput;
  updated_at: string;
  deleted_at: string | null;
  dirty: boolean;
};

const dbName = (userId: number) => `apach-library-${userId}`;

const connections = new Map<number, Promise<IDBPDatabase>>();

/** Una conexión por usuario, reutilizada (evita bloquear el borrado de la base al cerrar sesión). */
function open(userId: number): Promise<IDBPDatabase> {
  let conn = connections.get(userId);
  if (!conn) {
    conn = openDB(dbName(userId), 1, {
      upgrade(db) {
        db.createObjectStore("references", { keyPath: "client_id" });
        db.createObjectStore("meta");
      },
    });
    connections.set(userId, conn);
  }
  return conn;
}

export function newClientId(): string {
  return crypto.randomUUID();
}

export async function listLocal(userId: number): Promise<LibraryItem[]> {
  const db = await open(userId);
  const all = (await db.getAll("references")) as LibraryItem[];
  return all.filter((r) => !r.deleted_at);
}

export async function saveLocal(userId: number, item: Omit<LibraryItem, "dirty" | "deleted_at" | "updated_at"> & { updated_at?: string }) {
  const db = await open(userId);
  const record: LibraryItem = { ...item, updated_at: item.updated_at ?? new Date().toISOString(), deleted_at: null, dirty: true };
  await db.put("references", record);
  return record;
}

export async function deleteLocal(userId: number, clientId: string) {
  const db = await open(userId);
  const existing = (await db.get("references", clientId)) as LibraryItem | undefined;
  if (!existing) return;
  const now = new Date().toISOString();
  await db.put("references", { ...existing, deleted_at: now, updated_at: now, dirty: true });
}

export async function pendingCount(userId: number): Promise<number> {
  const db = await open(userId);
  return ((await db.getAll("references")) as LibraryItem[]).filter((r) => r.dirty).length;
}

export async function clearLocalLibrary(userId: number) {
  const conn = connections.get(userId);
  connections.delete(userId);
  if (conn) (await conn).close();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(dbName(userId));
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

type ServerRef = { client_id: string; source_type: string; input: ReferenceInput; output: ReferenceOutput; updated_at: string; deleted_at: string | null };

/** Sube cambios locales y descarga cambios del servidor. Lanza si no hay conexión. */
export async function syncLibrary(userId: number): Promise<{ pending: number; pulled: number }> {
  const db = await open(userId);
  const local = (await db.getAll("references")) as LibraryItem[];
  for (const item of local.filter((r) => r.dirty)) {
    const server = item.deleted_at
      ? await api<ServerRef>(`/references/${item.client_id}`, { method: "DELETE" }).catch((e) => {
          if (e.status === 404) return null;
          throw e;
        })
      : await api<ServerRef>(`/references/${item.client_id}`, {
          method: "PUT",
          json: { source_type: item.source_type, input: item.input, output: item.output, updated_at: item.updated_at },
        });
    if (server === null) await db.delete("references", item.client_id);
    else await db.put("references", { ...server, dirty: false });
  }
  const since = (await db.get("meta", "last_pull")) as string | undefined;
  const remote = await api<ServerRef[]>(`/references${since ? `?since=${encodeURIComponent(since)}` : ""}`);
  let pulled = 0;
  for (const r of remote) {
    const mine = (await db.get("references", r.client_id)) as LibraryItem | undefined;
    // Tras el envío no quedan cambios locales pendientes: gana la versión con fecha más reciente.
    if (!mine || new Date(r.updated_at) >= new Date(mine.updated_at)) {
      await db.put("references", { ...r, dirty: false });
      pulled++;
    }
  }
  await db.put("meta", new Date().toISOString(), "last_pull");
  return { pending: await pendingCount(userId), pulled };
}
