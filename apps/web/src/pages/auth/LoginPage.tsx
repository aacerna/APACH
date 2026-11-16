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
    <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[1.1fr_1fr]">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-naranja-100 via-amarillo-50 to-celeste-100 p-6 shadow-suave sm:p-10">
        <div aria-hidden="true" className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-amarillo/50" />
        <div aria-hidden="true" className="absolute -bottom-10 -right-6 h-40 w-40 rounded-full bg-celeste/30" />
        <div className="relative">
          <p className="text-sm font-extrabold uppercase tracking-wider text-terracota-700">Apapacho · tu asistente virtual de APA</p>
          <h1 className="mt-2 text-3xl font-bold text-petroleo sm:text-4xl">Tu <span className="marca">apapacho</span> para escribir con normas APA</h1>
          <p className="mt-3 text-lg text-tinta">Revisa tu documento, aprende a corregir y crea referencias en segundos.</p>
          <div className="mt-6 flex items-end gap-3">
            <img src="/brand/pacho.png" alt="Pacho, la mascota de APACH" className="pacho-saluda h-28 w-28 drop-shadow-lg sm:h-32 sm:w-32" />
            <p className="mb-3 rounded-3xl rounded-bl-md bg-white/85 px-4 py-3 text-sm font-semibold text-tinta shadow-suave">
              ¿Solo quieres consultar? Abre <Link className="font-extrabold text-celeste-700 underline" to="/aprende">Aprende APA</Link> o el{" "}
              <Link className="font-extrabold text-celeste-700 underline" to="/generador">generador</Link>.
            </p>
          </div>
        </div>
      </section>
      <Card>
        <h2 className="text-2xl font-bold text-petroleo">Iniciar sesión</h2>
        <p className="mb-5 mt-1 text-sm text-tenue">Solo cuentas autorizadas por la Escuela de Ciencias de la Comunicación. No existe registro público.</p>
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
