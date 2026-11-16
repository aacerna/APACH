import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "../lib/auth";
import type { Role } from "../lib/types";
import { Alert, Spinner } from "./ui";

export function RequireRole({ roles, children, needsServer = true }: { roles: Role[]; children: ReactNode; needsServer?: boolean }) {
  const { user, loading, offlineSession } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;
  if (needsServer && offlineSession) {
    return <Alert tone="warning" title="Esta sección requiere el servidor">Vuelve a conectarte a la red donde funciona APACH para continuar.</Alert>;
  }
  return <>{children}</>;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}
