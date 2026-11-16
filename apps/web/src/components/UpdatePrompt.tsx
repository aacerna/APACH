import { useRegisterSW } from "virtual:pwa-register/react";
import { Alert, Button } from "./ui";

/** Política de actualización: el usuario decide cuándo recargar a la nueva versión. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  if (needRefresh) {
    return (
      <Alert tone="info" title="Hay una nueva versión de APACH">
        <div className="mt-2 flex gap-2">
          <Button onClick={() => updateServiceWorker(true)}>Actualizar ahora</Button>
          <Button variant="secondary" onClick={() => setNeedRefresh(false)}>Más tarde</Button>
        </div>
      </Alert>
    );
  }
  if (offlineReady) {
    return (
      <Alert tone="success" title="Listo para usar sin conexión">
        La guía y el generador quedaron disponibles sin internet en este dispositivo.{" "}
        <button className="underline" onClick={() => setOfflineReady(false)}>Entendido</button>
      </Alert>
    );
  }
  return null;
}
