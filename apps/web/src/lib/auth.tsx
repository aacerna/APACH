/**
 * Sesión: la cookie HttpOnly es la autoridad. Se guarda una «pista» mínima (id, nombre, rol) para que,
 * sin red, la misma persona pueda usar guía, generador y SU biblioteca local. Al cerrar sesión se borra.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api, ApiError } from "./api";
import { clearLocalLibrary, syncLibrary } from "./library";
import type { User } from "./types";

const HINT_KEY = "apach-session-hint";
type Hint = Pick<User, "id" | "full_name" | "role" | "email">;

type AuthState = {
  user: User | Hint | null;
  offlineSession: boolean;
  loading: boolean;
  setUser: (u: User) => void;
  logout: (opts?: { keepLocal?: boolean }) => Promise<{ unsyncedKept: boolean }>;
};

const AuthContext = createContext<AuthState | null>(null);

export function readHint(): Hint | null {
  try {
    return JSON.parse(localStorage.getItem(HINT_KEY) ?? "null");
  } catch {
    return null;
  }
}

function writeHint(u: User | null) {
  if (u) localStorage.setItem(HINT_KEY, JSON.stringify({ id: u.id, full_name: u.full_name, role: u.role, email: u.email }));
  else localStorage.removeItem(HINT_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const r = await api<{ user: User }>("/me");
        writeHint(r.user);
        return { user: r.user as User | Hint, offline: false };
      } catch (e) {
        if (e instanceof ApiError && e.network) {
          const hint = readHint();
          return { user: hint, offline: Boolean(hint) };
        }
        if (e instanceof ApiError && e.status === 401) {
          writeHint(null);
          return { user: null, offline: false };
        }
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const setUser = useCallback((u: User) => {
    writeHint(u);
    qc.setQueryData(["me"], { user: u, offline: false });
  }, [qc]);

  const logout = useCallback(async (opts?: { keepLocal?: boolean }) => {
    const current = me.data?.user;
    let unsyncedKept = false;
    if (current) {
      const result = await syncLibrary(current.id).catch(() => ({ pending: 1 }));
      if (result.pending === 0 && !opts?.keepLocal) await clearLocalLibrary(current.id);
      else unsyncedKept = true;
    }
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    writeHint(null);
    // Primero se anula la sesión observada; luego se descartan los datos del usuario anterior.
    qc.setQueryData(["me"], { user: null, offline: false });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    return { unsyncedKept };
  }, [me.data, qc]);

  const value = useMemo<AuthState>(() => ({
    user: me.data?.user ?? null,
    offlineSession: me.data?.offline ?? false,
    loading: me.isLoading,
    setUser,
    logout,
  }), [me.data, me.isLoading, setUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

export function homeFor(role: string | undefined): string {
  return role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/docente" : role === "STUDENT" ? "/inicio" : "/login";
}
