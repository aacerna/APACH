import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Field, inputClass } from "../../components/ui";
import { api } from "../../lib/api";

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ message: string }>("/auth/request-reset", { method: "POST", json: { email } });
      setMessage(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-2 text-xl font-bold text-petroleo">Recuperar acceso</h1>
        <p className="mb-4 text-sm text-tenue">APACH no envía correos automáticamente. Registraremos tu solicitud y la coordinación académica podrá generarte un enlace de restablecimiento.</p>
        {message ? <Alert tone="success">{message}</Alert> : (
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Correo institucional" htmlFor="email" required>
              <input id="email" type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full">Enviar solicitud</Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm"><Link className="text-celeste-700 underline" to="/login">Volver</Link></p>
      </Card>
    </div>
  );
}
