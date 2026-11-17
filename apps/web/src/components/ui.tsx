import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Severity, Verification } from "../lib/types";
import { severityLabel, verificationLabel } from "../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "sun" | "sky";
/** Botones 3D: el borde inferior es un tono más oscuro del relleno y se hunde al presionar. */
const variants: Record<Variant, string> = {
  primary: "btn-3d bg-naranja border-naranja-600 text-tinta",
  dark: "btn-3d bg-petroleo border-petroleo-700 text-white",
  sun: "btn-3d bg-amarillo border-amarillo-600 text-tinta",
  sky: "btn-3d bg-celeste border-celeste-600 text-tinta",
  secondary: "btn-3d border-2 border-borde border-b-4 bg-white text-petroleo hover:bg-fondo",
  ghost: "text-celeste-700 hover:bg-celeste-50",
  danger: "btn-3d border-2 border-b-4 border-terracota/40 bg-white text-terracota-700 hover:bg-terracota-50",
};
const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-extrabold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`${base} ${variants[variant]} ${className}`} />;
}

export function LinkButton({ to, variant = "primary", children, className = "" }: { to: string; variant?: Variant; children: ReactNode; className?: string }) {
  return <Link to={to} className={`${base} no-underline ${variants[variant]} ${className}`}>{children}</Link>;
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={`tile p-5 sm:p-6 ${className}`}>{children}</Tag>;
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: ReactNode; actions?: ReactNode; crumbs?: Array<{ to?: string; label: string }> }) {
  return (
    <header className="mb-6">
      {crumbs && (
        <nav aria-label="Ruta de navegación" className="mb-2 text-sm font-bold text-tenue">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">›</span>}
                {c.to ? <Link className="text-celeste-700 hover:underline" to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl text-petroleo sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-base font-semibold text-tenue sm:text-lg">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-celeste bg-celeste-50",
    warning: "border-naranja bg-naranja-50",
    error: "border-terracota bg-terracota-50",
    success: "border-amarillo-600 bg-amarillo-50",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border-2 p-4 text-sm font-semibold ${tones[tone]}`}>
      {title && <p className="mb-1 font-extrabold text-tinta">{title}</p>}
      <div className="text-tinta">{children}</div>
    </div>
  );
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-6 font-bold text-tenue">
      <img src="/brand/pacho.png" alt="" className="pacho-rebota h-10 w-10" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="tile border-dashed p-8 text-center">
      <img src="/brand/pacho.png" alt="" className="mx-auto mb-3 h-20 w-20" />
      <p className="text-xl font-black text-petroleo">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-xl text-sm font-semibold text-tenue">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return <Alert tone="error" title="No se pudo completar la acción">{message}</Alert>;
}

export function SeverityBadge({ severity, verification }: { severity: Severity; verification: Verification }) {
  const styles: Record<Severity, string> = {
    ERROR: "bg-terracota-700 text-white",
    POSSIBLE_PROBLEM: "bg-naranja-100 text-tinta",
    NEEDS_TEACHER: "bg-celeste-100 text-tinta",
  };
  const icons: Record<Severity, string> = { ERROR: "✕", POSSIBLE_PROBLEM: "!", NEEDS_TEACHER: "?" };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${styles[severity]}`}>
        <span aria-hidden="true">{icons[severity]}</span> {severityLabel[severity]}
      </span>
      {verification !== "CHECKED" && (
        <span className="rounded-full bg-fondo px-3 py-1 text-xs font-extrabold text-tenue ring-2 ring-borde">{verificationLabel[verification]}</span>
      )}
    </span>
  );
}

export function Field({ label, htmlFor, error, help, children, required }: { label: string; htmlFor: string; error?: string; help?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-extrabold text-tinta">
        {label} {required && <span className="text-terracota-700" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(obligatorio)</span>}
      </label>
      {children}
      {help && !error && <p id={`${htmlFor}-help`} className="text-xs font-semibold text-tenue">{help}</p>}
      {error && <p id={`${htmlFor}-error`} className="text-xs font-extrabold text-terracota-700">{error}</p>}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-2xl border-2 border-borde bg-fondo px-4 py-2 text-base font-semibold text-tinta placeholder:font-normal placeholder:text-gray-400 focus:border-celeste focus:bg-white focus:outline-none aria-[invalid=true]:border-terracota";

/** Botón que pide confirmación explícita antes de una acción destructiva. */
export function ConfirmButton({ onConfirm, children, message, variant = "danger", disabled }: { onConfirm: () => void; children: ReactNode; message: string; variant?: Variant; disabled?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.showModal?.();
    else ref.current?.close?.();
  }, [open]);
  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)} disabled={disabled}>{children}</Button>
      <dialog ref={ref} onClose={() => setOpen(false)} className="m-auto max-w-md rounded-3xl border-2 border-borde p-6 backdrop:bg-black/40">
        <p className="mb-5 text-lg font-bold text-tinta">{message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" variant="danger" onClick={() => { setOpen(false); onConfirm(); }}>Confirmar</Button>
        </div>
      </dialog>
    </>
  );
}

/** Pacho, la mascota oficial, con burbuja de diálogo. */
export function Pacho({ message, size = "md" }: { message?: ReactNode; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-16 w-16", md: "h-24 w-24", lg: "h-32 w-32 sm:h-40 sm:w-40" }[size];
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/pacho.png" alt="Pacho, la mascota de APACH" className={`pacho-saluda shrink-0 ${dims}`} />
      {message && (
        <div className="relative rounded-2xl border-2 border-borde bg-white px-4 py-3 text-sm font-bold text-tinta">
          <span aria-hidden="true" className="absolute -left-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-borde bg-white" />
          {message}
        </div>
      )}
    </div>
  );
}

/** Compatibilidad con pantallas existentes. */
export function PachoPlaceholder({ message }: { message: string }) {
  return <Pacho message={message} />;
}
