import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert, Button, Card, Field, inputClass } from "../../components/ui";
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
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="flex flex-col justify-center">
        <h1 className="text-3xl font-bold text-petroleo">Bienvenida, bienvenido a APACH</h1>
        <p className="mt-3 text-tenue">Tu asistente para aplicar normas APA 7: revisa tu documento, aprende a corregir y crea referencias.</p>
        <p className="mt-3 text-sm text-tenue">El acceso es solo para cuentas autorizadas por la Escuela de Ciencias de la Comunicación. No existe registro público.</p>
        <p className="mt-4 text-sm">
          ¿Solo quieres consultar? <Link className="font-semibold text-celeste-700 underline" to="/aprende">Abre la guía Aprende APA</Link> o el{" "}
          <Link className="font-semibold text-celeste-700 underline" to="/generador">generador de referencias</Link>.
        </p>
      </div>
      <Card>
        <h2 className="mb-4 text-xl font-semibold text-petroleo">Iniciar sesión</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Correo institucional" htmlFor="email" error={errors.email?.message} required>
            <input id="email" type="email" autoComplete="username" className={inputClass} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
          </Field>
          <Field label="Contraseña" htmlFor="password" error={errors.password?.message} required>
            <input id="password" type="password" autoComplete="current-password" className={inputClass} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Ingresando…" : "Ingresar"}</Button>
          <p className="text-center text-sm"><Link className="text-celeste-700 underline" to="/olvide">¿Olvidaste tu contraseña?</Link></p>
        </form>
      </Card>
    </div>
  );
}
