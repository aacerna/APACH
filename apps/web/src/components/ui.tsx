import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Severity, Verification } from "../lib/types";
import { severityLabel, verificationLabel } from "../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-terracota-700 text-white hover:bg-terracota disabled:bg-terracota-700/50",
  secondary: "bg-white text-petroleo border border-petroleo/30 hover:bg-petroleo-50",
  ghost: "text-petroleo hover:bg-petroleo-50",
  danger: "bg-white text-terracota-700 border border-terracota-700/40 hover:bg-terracota-50",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function LinkButton({ to, variant = "primary", children, className = "" }: { to: string; variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold no-underline transition ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={`rounded-xl border border-borde bg-white p-5 shadow-sm ${className}`}>{children}</Tag>;
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: ReactNode; actions?: ReactNode; crumbs?: Array<{ to?: string; label: string }> }) {
  return (
    <header className="mb-6">
      {crumbs && (
        <nav aria-label="Ruta de navegación" className="mb-2 text-sm text-tenue">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">›</span>}
                {c.to ? <Link className="underline-offset-2 hover:underline" to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-petroleo sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-tenue">{subtitle}</p>}
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
    error: "border-terracota-700 bg-terracota-50",
    success: "border-petroleo bg-petroleo-50",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border-l-4 p-4 text-sm ${tones[tone]}`}>
      {title && <p className="mb-1 font-semibold text-tinta">{title}</p>}
      <div className="text-tinta">{children}</div>
    </div>
  );
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-6 text-tenue">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-petroleo/20 border-t-petroleo" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-borde bg-white/60 p-8 text-center">
      <p className="font-semibold text-petroleo">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-xl text-sm text-tenue">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
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
    POSSIBLE_PROBLEM: "bg-naranja-50 text-tinta ring-1 ring-naranja",
    NEEDS_TEACHER: "bg-celeste-50 text-tinta ring-1 ring-celeste",
  };
  const icons: Record<Severity, string> = { ERROR: "✕", POSSIBLE_PROBLEM: "!", NEEDS_TEACHER: "?" };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[severity]}`}>
        <span aria-hidden="true">{icons[severity]}</span> {severityLabel[severity]}
      </span>
      {verification !== "CHECKED" && (
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-tenue ring-1 ring-gray-300">{verificationLabel[verification]}</span>
      )}
    </span>
  );
}

export function Field({ label, htmlFor, error, help, children, required }: { label: string; htmlFor: string; error?: string; help?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-tinta">
        {label} {required && <span className="text-terracota-700" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(obligatorio)</span>}
      </label>
      {children}
      {help && !error && <p id={`${htmlFor}-help`} className="text-xs text-tenue">{help}</p>}
      {error && <p id={`${htmlFor}-error`} className="text-xs font-semibold text-terracota-700">{error}</p>}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-tinta placeholder:text-gray-400 focus:border-celeste-700 aria-[invalid=true]:border-terracota-700";

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
      <dialog ref={ref} onClose={() => setOpen(false)} className="m-auto max-w-md rounded-xl p-6 backdrop:bg-black/40">
        <p className="mb-4 text-tinta">{message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" variant="danger" onClick={() => { setOpen(false); onConfirm(); }}>Confirmar</Button>
        </div>
      </dialog>
    </>
  );
}

/** Espacio reservado para el activo oficial de Pacho (pendiente). No es un logotipo. */
export function PachoPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-amarillo-50 p-4">
      <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-petroleo/30 text-[10px] font-semibold uppercase text-tenue">
        Pacho
      </div>
      <p className="text-sm text-tinta">{message}</p>
    </div>
  );
}
