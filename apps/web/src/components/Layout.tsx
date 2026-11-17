import { useEffect, useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/format";
import { useOnline } from "../lib/useOnline";
import {
  IconBook, IconBuilding, IconChart, IconClose, IconCompass, IconDocCheck, IconFolder, IconHome, IconLibrary, IconLink,
  IconList, IconLogout, IconMenu, IconQuote, IconSettings, IconShield, IconTemplate, IconUpload, IconUsers, type IconProps,
} from "./icons";
import { Alert } from "./ui";
import { UpdatePrompt } from "./UpdatePrompt";

type Item = { to: string; label: string; Icon: ComponentType<IconProps> };
const NAV: Record<string, Item[]> = {
  STUDENT: [
    { to: "/inicio", label: "Inicio", Icon: IconHome },
    { to: "/revisar", label: "Revisar", Icon: IconDocCheck },
    { to: "/generador", label: "Crear referencia", Icon: IconQuote },
    { to: "/aprende", label: "Aprende APA", Icon: IconBook },
    { to: "/trabajos", label: "Mis trabajos", Icon: IconFolder },
    { to: "/biblioteca", label: "Biblioteca", Icon: IconLibrary },
    { to: "/referencias", label: "Explorar referencias", Icon: IconCompass },
    { to: "/plantillas", label: "Plantillas", Icon: IconTemplate },
  ],
  TEACHER: [
    { to: "/docente", label: "Mis secciones", Icon: IconHome },
    { to: "/aprende", label: "Aprende APA", Icon: IconBook },
    { to: "/generador", label: "Generador", Icon: IconQuote },
    { to: "/biblioteca", label: "Biblioteca", Icon: IconLibrary },
    { to: "/plantillas", label: "Plantillas", Icon: IconTemplate },
  ],
  ADMIN: [
    { to: "/admin", label: "Resumen", Icon: IconChart },
    { to: "/admin/usuarios", label: "Usuarios", Icon: IconUsers },
    { to: "/admin/academico", label: "Estructura académica", Icon: IconBuilding },
    { to: "/admin/matriculas", label: "Matrículas y asignaciones", Icon: IconLink },
    { to: "/admin/importar", label: "Importar CSV", Icon: IconUpload },
    { to: "/admin/plantillas", label: "Plantillas", Icon: IconTemplate },
    { to: "/admin/reglas", label: "Reglas", Icon: IconShield },
    { to: "/admin/ajustes", label: "Ajustes", Icon: IconSettings },
    { to: "/admin/auditoria", label: "Auditoría", Icon: IconList },
    { to: "/aprende", label: "Aprende APA", Icon: IconBook },
  ],
  GUEST: [
    { to: "/aprende", label: "Aprende APA", Icon: IconBook },
    { to: "/referencias", label: "Explorar referencias", Icon: IconCompass },
    { to: "/generador", label: "Generador", Icon: IconQuote },
  ],
};

const itemClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide transition ${
    isActive ? "border-celeste bg-celeste-50 text-celeste-700" : "border-transparent text-tenue hover:bg-fondo"
  }`;

export function Layout() {
  const { user, offlineSession, logout } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const items = NAV[user?.role ?? "GUEST"];
  useEffect(() => setMenuOpen(false), [location.pathname]);

  async function handleLogout() {
    const { unsyncedKept } = await logout();
    if (unsyncedKept) setNotice("Cerraste sesión sin conexión: tus referencias locales quedan guardadas en este dispositivo, pero ocultas hasta que vuelvas a iniciar sesión.");
    navigate("/login");
  }

  const userBlock = user ? (
    <div className="mt-auto border-t-2 border-borde pt-4">
      <div className="mb-2 flex items-center gap-3 px-2">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-naranja text-lg font-black text-tinta">{user.full_name.charAt(0)}</span>
        <span className="min-w-0 text-sm leading-tight">
          <span className="block truncate font-extrabold">{user.full_name}</span>
          <span className="font-semibold text-tenue">{roleLabel[user.role]}</span>
        </span>
      </div>
      <button onClick={handleLogout} className={`${itemClass(false)} w-full`}><IconLogout className="h-6 w-6" /> Cerrar sesión</button>
    </div>
  ) : (
    <div className="mt-auto border-t-2 border-borde pt-4">
      <NavLink to="/login" className="btn-3d flex min-h-12 items-center justify-center rounded-2xl border-naranja-600 bg-naranja px-4 text-sm font-extrabold uppercase tracking-wide text-tinta">Iniciar sesión</NavLink>
    </div>
  );

  const navList = (
    <ul className="flex flex-col gap-1">
      {items.map(({ to, label, Icon }) => (
        <li key={to}>
          <NavLink to={to} end={to === "/admin"} className={({ isActive }) => itemClass(isActive)}>
            <Icon className="h-6 w-6" /> {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-white">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>

      {/* Escritorio: barra lateral fija */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 border-borde bg-white px-4 py-6 md:flex">
        <NavLink to="/" aria-label="APACH, ir al inicio" className="mb-8 px-2"><img src="/brand/apach-logo.png" alt="APACH" className="h-11 w-auto" /></NavLink>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto">{navList}</nav>
        {userBlock}
      </aside>

      {/* Móvil: barra superior */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-borde bg-white px-4 py-2 md:hidden">
        <NavLink to="/" aria-label="APACH, ir al inicio"><img src="/brand/apach-logo.png" alt="APACH" className="h-9 w-auto" /></NavLink>
        <button aria-expanded={menuOpen} aria-controls="menu-movil" onClick={() => setMenuOpen(true)} className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-b-4 border-borde px-3 text-sm font-extrabold uppercase text-petroleo">
          <IconMenu className="h-5 w-5" /> Menú
        </button>
      </header>

      {/* Móvil: panel con el menú completo */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button aria-label="Cerrar menú" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div id="menu-movil" className="absolute inset-y-0 right-0 flex w-[85%] max-w-xs flex-col bg-white px-4 py-5">
            <div className="mb-4 flex items-center justify-between">
              <img src="/brand/pacho.png" alt="" className="h-12 w-12" />
              <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="rounded-xl p-2 text-tenue hover:bg-fondo"><IconClose className="h-6 w-6" /></button>
            </div>
            <nav aria-label="Principal" className="flex-1 overflow-y-auto">{navList}</nav>
            {userBlock}
          </div>
        </div>
      )}

      <main id="contenido" className="px-4 pb-28 pt-6 md:ml-64 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 space-y-3 empty:hidden">
            {(!online || offlineSession) && (
              <Alert tone="warning" title="Sin conexión con el servidor">
                Puedes usar la guía «Aprende APA», el generador y tu biblioteca local. La revisión de documentos, los comentarios docentes y la administración requieren el servidor de APACH.
              </Alert>
            )}
            {notice && <Alert tone="info">{notice}</Alert>}
            <UpdatePrompt />
          </div>
          <Outlet />
          <footer className="mt-14 flex flex-col items-center gap-2 border-t-2 border-borde pt-6 text-center text-xs font-semibold text-tenue sm:flex-row sm:text-left">
            <img src="/brand/pacho.png" alt="" className="h-9 w-9" />
            <p>APACH · Escuela de Ciencias de la Comunicación · Universidad Dr. José Matías Delgado. Herramienta de apoyo: no califica trabajos ni garantiza el cumplimiento total de APA 7.</p>
          </footer>
        </div>
      </main>

      {/* Móvil: barra inferior de pestañas */}
      <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-borde bg-white md:hidden">
        <ul className="mx-auto flex max-w-md justify-around px-2 py-1.5">
          {items.slice(0, 4).map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === "/admin"} aria-label={label}
                className={({ isActive }) => `flex min-h-12 min-w-14 flex-col items-center justify-center rounded-2xl border-2 px-2 ${isActive ? "border-celeste bg-celeste-50 text-celeste-700" : "border-transparent text-tenue"}`}>
                <Icon className="h-7 w-7" />
                <span className="text-[10px] font-extrabold uppercase">{label.split(" ")[0]}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
