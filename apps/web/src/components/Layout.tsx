import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/format";
import { useOnline } from "../lib/useOnline";
import { Alert } from "./ui";
import { UpdatePrompt } from "./UpdatePrompt";

type Item = { to: string; label: string };
const NAV: Record<string, Item[]> = {
  STUDENT: [
    { to: "/inicio", label: "Inicio" }, { to: "/revisar", label: "Revisar documento" }, { to: "/trabajos", label: "Mis trabajos" },
    { to: "/generador", label: "Crear referencia" }, { to: "/biblioteca", label: "Biblioteca" }, { to: "/aprende", label: "Aprende APA" },
    { to: "/referencias", label: "Explorar referencias" }, { to: "/plantillas", label: "Plantillas" },
  ],
  TEACHER: [
    { to: "/docente", label: "Mis secciones" }, { to: "/aprende", label: "Aprende APA" }, { to: "/generador", label: "Generador" },
    { to: "/biblioteca", label: "Biblioteca" }, { to: "/plantillas", label: "Plantillas" },
  ],
  ADMIN: [
    { to: "/admin", label: "Resumen" }, { to: "/admin/usuarios", label: "Usuarios" }, { to: "/admin/academico", label: "Estructura académica" },
    { to: "/admin/matriculas", label: "Matrículas y asignaciones" }, { to: "/admin/importar", label: "Importar CSV" },
    { to: "/admin/plantillas", label: "Plantillas" }, { to: "/admin/reglas", label: "Reglas" }, { to: "/admin/ajustes", label: "Ajustes" },
    { to: "/admin/auditoria", label: "Auditoría" }, { to: "/aprende", label: "Aprende APA" },
  ],
  GUEST: [{ to: "/aprende", label: "Aprende APA" }, { to: "/referencias", label: "Explorar referencias" }, { to: "/generador", label: "Generador" }],
};

export function Layout() {
  const { user, offlineSession, logout } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const items = NAV[user?.role ?? "GUEST"];

  async function handleLogout() {
    const { unsyncedKept } = await logout();
    if (unsyncedKept) setNotice("Cerraste sesión sin conexión: tus referencias locales quedan guardadas en este dispositivo, pero ocultas hasta que vuelvas a iniciar sesión.");
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <header className="bg-petroleo text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex flex-col leading-tight no-underline">
            <span className="text-lg font-bold tracking-wide">APACH</span>
            <span className="text-xs text-white/80">Apapacho: Tu asistente virtual de APA</span>
          </NavLink>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-right text-xs sm:block">
                  <span className="block font-semibold">{user.full_name}</span>
                  <span className="text-white/75">{roleLabel[user.role]}</span>
                </span>
                <button onClick={handleLogout} className="min-h-11 rounded-lg border border-white/40 px-3 text-sm font-semibold hover:bg-white/10">Cerrar sesión</button>
              </>
            ) : (
              <NavLink to="/login" className="min-h-11 rounded-lg border border-white/40 px-3 py-2.5 text-sm font-semibold hover:bg-white/10">Iniciar sesión</NavLink>
            )}
            <button className="min-h-11 rounded-lg border border-white/40 px-3 text-sm font-semibold md:hidden" aria-expanded={menuOpen} aria-controls="menu-principal" onClick={() => setMenuOpen((v) => !v)}>
              Menú
            </button>
          </div>
        </div>
        <nav id="menu-principal" aria-label="Principal" className={`${menuOpen ? "block" : "hidden"} border-t border-white/15 md:block`}>
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 md:flex-row md:flex-wrap">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `block rounded-md px-3 py-2 text-sm ${isActive ? "bg-white font-semibold text-petroleo" : "text-white/90 hover:bg-white/10"}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 space-y-3 empty:hidden">
          {(!online || offlineSession) && (
            <Alert tone="warning" title="Sin conexión con el servidor">
              Puedes usar la guía «Aprende APA», el generador y tu biblioteca local. La revisión de documentos, los comentarios docentes y la administración requieren el servidor de APACH.
            </Alert>
          )}
          {notice && <Alert tone="info">{notice}</Alert>}
          <UpdatePrompt />
        </div>
        <Outlet />
      </main>
      <footer className="border-t border-borde py-6 text-center text-xs text-tenue">
        APACH · Escuela de Ciencias de la Comunicación · Universidad Dr. José Matías Delgado. Herramienta de apoyo: no califica trabajos ni garantiza el cumplimiento total de APA 7.
      </footer>
    </div>
  );
}
