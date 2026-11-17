import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert, Button, Field, inputClass } from "../../components/ui";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import type { User } from "../../lib/types";

const schema = z.object({
  email: z.string().trim().min(1, "Escribe tu correo institucional.").email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      const r = await api<{ user: User }>("/auth/login", { method: "POST", json: values });
      setUser(r.user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : homeFor(r.user.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    }
  };

  return (
    <div className="mx-auto max-w-md pt-2 sm:pt-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src="/brand/pacho.png" alt="Pacho, la mascota de APACH" className="pacho-rebota h-32 w-32" />
        <h1 className="mt-3 text-3xl text-petroleo sm:text-4xl">¡Hola de nuevo!</h1>
        <p className="mt-1 font-bold text-tenue">Revisa tu documento, aprende a corregir y crea referencias APA.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Correo institucional" htmlFor="email" error={errors.email?.message} required>
          <input id="email" type="email" autoComplete="username" placeholder="nombre@ujmd.edu.sv" className={inputClass} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={errors.password?.message} required>
          <input id="password" type="password" autoComplete="current-password" className={inputClass} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Ingresando…" : "Ingresar"}</Button>
        <p className="text-center"><Link className="text-sm font-extrabold uppercase tracking-wide text-celeste-700 hover:underline" to="/olvide">¿Olvidaste tu contraseña?</Link></p>
      </form>
      <p className="mt-6 rounded-2xl border-2 border-borde p-4 text-center text-sm font-semibold text-tenue">
        Solo cuentas autorizadas por la Escuela de Ciencias de la Comunicación. ¿Solo quieres consultar?{" "}
        <Link className="font-extrabold text-celeste-700 underline" to="/aprende">Aprende APA</Link> ·{" "}
        <Link className="font-extrabold text-celeste-700 underline" to="/generador">Generador</Link>
      </p>
    </div>
  );
}
