import { LinkButton } from "../../components/ui";

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="text-5xl font-bold text-petroleo">403</p>
      <h1 className="mt-2 text-xl font-semibold">No tienes permiso para ver esta página</h1>
      <p className="mt-2 text-tenue">Si crees que es un error, contacta a la coordinación académica.</p>
      <LinkButton to="/" className="mt-6">Ir a mi inicio</LinkButton>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="text-5xl font-bold text-petroleo">404</p>
      <h1 className="mt-2 text-xl font-semibold">No encontramos esta página</h1>
      <LinkButton to="/" className="mt-6">Ir a mi inicio</LinkButton>
    </div>
  );
}
