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
      <header className="sticky top-0 z-30 border-b border-borde/70 bg-white/90 backdrop-blur">
        <div aria-hidden="true" className="flex h-1.5">
          <span className="flex-1 bg-terracota" /><span className="flex-1 bg-naranja" /><span className="flex-1 bg-amarillo" /><span className="flex-1 bg-celeste" /><span className="flex-1 bg-petroleo" />
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-3 no-underline" aria-label="APACH, ir al inicio">
            <img src="/brand/apach-logo.png" alt="APACH" className="h-9 w-auto sm:h-12" />
            <span className="hidden border-l-2 border-borde pl-3 text-xs font-bold leading-tight text-tenue lg:block">Apapacho:<br />tu asistente virtual de APA</span>
          </NavLink>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden items-center gap-2 rounded-full bg-fondo py-1 pl-1 pr-3 text-right text-xs sm:flex">
                  <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-naranja font-display text-sm font-bold text-tinta">{user.full_name.charAt(0)}</span>
                  <span><span className="block font-bold text-tinta">{user.full_name}</span><span className="text-tenue">{roleLabel[user.role]}</span></span>
                </span>
                <button onClick={handleLogout} className="hidden min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-bold text-petroleo ring-2 ring-petroleo/15 hover:bg-celeste-50 md:inline-flex md:items-center">Cerrar sesión</button>
              </>
            ) : (
              <NavLink to="/login" className="inline-flex min-h-11 items-center rounded-full bg-naranja px-5 text-sm font-extrabold text-tinta shadow-pop">Iniciar sesión</NavLink>
            )}
            <button className="min-h-11 rounded-full px-4 text-sm font-bold text-petroleo ring-2 ring-petroleo/15 md:hidden" aria-expanded={menuOpen} aria-controls="menu-principal" onClick={() => setMenuOpen((v) => !v)}>
              Menú
            </button>
          </div>
        </div>
        <nav id="menu-principal" aria-label="Principal" className={`${menuOpen ? "block" : "hidden"} md:block`}>
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-3 md:flex-row md:flex-wrap md:gap-1.5">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `block rounded-full px-4 py-2 text-sm font-bold transition ${isActive ? "bg-petroleo text-white shadow-suave" : "text-petroleo hover:bg-naranja-50"}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            {user && (
              <li className="mt-2 border-t border-borde pt-2 md:hidden">
                <p className="px-4 pb-2 text-xs text-tenue">{user.full_name} · {roleLabel[user.role]}</p>
                <button onClick={handleLogout} className="block w-full rounded-full px-4 py-2 text-left text-sm font-bold text-terracota-700 hover:bg-terracota-50">Cerrar sesión</button>
              </li>
            )}
          </ul>
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">
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
      <footer className="mt-10 bg-petroleo text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:text-left">
          <img src="/brand/pacho.png" alt="" className="h-12 w-12" />
          <p className="text-sm text-white/85">
            <strong className="font-display text-white">APACH</strong> · Escuela de Ciencias de la Comunicación · Universidad Dr. José Matías Delgado.
            <span className="block text-xs text-white/70">Herramienta de apoyo: no califica trabajos ni garantiza el cumplimiento total de APA 7.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
