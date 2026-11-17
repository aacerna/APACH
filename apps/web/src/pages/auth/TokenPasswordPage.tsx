import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Alert, Button, Card, Field, inputClass, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import type { User } from "../../lib/types";

export const passwordSchema = z.string()
  .min(10, "Debe tener al menos 10 caracteres.")
  .max(128, "Máximo 128 caracteres.")
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, "Debe incluir letras.")
  .regex(/\d/, "Debe incluir al menos un número.");

const schema = z.object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });
type Values = z.infer<typeof schema>;

export function TokenPasswordPage({ purpose }: { purpose: "ACTIVATION" | "RESET" }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ["token-status", purpose, token],
    queryFn: () => api<{ valid: boolean }>(`/auth/token-status?purpose=${purpose}&token=${encodeURIComponent(token)}`),
    enabled: token.length > 10,
    retry: false,
  });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const isActivation = purpose === "ACTIVATION";

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      const r = await api<{ user: User }>(isActivation ? "/auth/activate" : "/auth/reset", { method: "POST", json: { token, password: v.password } });
      setUser(r.user);
      navigate(homeFor(r.user.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la contraseña.");
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-2 text-xl font-black text-petroleo">{isActivation ? "Activa tu cuenta" : "Crea una nueva contraseña"}</h1>
        {!token || token.length <= 10 ? (
          <Alert tone="error">El enlace está incompleto. Solicita uno nuevo a la coordinación académica.</Alert>
        ) : status.isLoading ? <Spinner label="Verificando enlace…" /> : !status.data?.valid ? (
          <Alert tone="error" title="Enlace no válido">Este enlace ya se usó o expiró. Solicita uno nuevo a la coordinación académica.</Alert>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <p className="text-sm text-tenue">Usa al menos 10 caracteres, con letras y números.</p>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Nueva contraseña" htmlFor="password" error={errors.password?.message} required>
              <input id="password" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.password} {...register("password")} />
            </Field>
            <Field label="Repite la contraseña" htmlFor="confirm" error={errors.confirm?.message} required>
              <input id="confirm" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.confirm} {...register("confirm")} />
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isActivation ? "Activar cuenta" : "Guardar contraseña"}</Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm"><Link className="text-celeste-700 underline" to="/login">Volver a iniciar sesión</Link></p>
      </Card>
    </div>
  );
}
