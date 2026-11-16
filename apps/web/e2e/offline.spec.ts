/** PWA: tras la primera visita, guía y generador funcionan sin red; la API protegida no se cachea. */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("guía y generador funcionan sin conexión y la caché no contiene la API", async ({ page, context }) => {
  await login(page, "estudiante3");
  await page.goto("/aprende");
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === "activated");
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  await page.goto("/aprende/hanging-indent");
  await expect(page.getByRole("heading", { name: "Sangría francesa" })).toBeVisible();
  await expect(page.getByText("Sin conexión con el servidor")).toBeVisible();

  await page.goto("/generador?tipo=book");
  await page.getByLabel(/Apellido\(s\)/).fill("Castro");
  await page.getByLabel(/Nombre\(s\)/).fill("Luisa");
  await page.getByLabel(/^Año/).fill("2019");
  await page.getByLabel(/^Título/).fill("Medios digitales y ciudadanía");
  await page.getByLabel("Editorial").fill("Editorial Ficticia");
  await expect(page.getByTestId("reference-preview")).toHaveText("Castro, L. (2019). Medios digitales y ciudadanía. Editorial Ficticia.");
  await page.getByRole("button", { name: "Guardar en mi biblioteca" }).click();
  await expect(page.getByText(/guardada en este dispositivo/)).toBeVisible();

  // La revisión de documentos indica honestamente que necesita el servidor.
  await page.goto("/revisar");
  await expect(page.getByText("Esta sección requiere el servidor")).toBeVisible();

  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    return urls;
  });
  expect(cachedUrls.length).toBeGreaterThan(3);
  expect(cachedUrls.some((u) => u.includes("/api/"))).toBe(false);

  // Al reconectar, la referencia local se sincroniza con el servidor.
  await context.setOffline(false);
  await page.goto("/biblioteca");
  await expect(page.getByText("Medios digitales y ciudadanía").first()).toBeVisible();
  await page.getByRole("button", { name: "Sincronizar" }).click();
  await expect(page.getByText(/Biblioteca sincronizada/)).toBeVisible();
  await expect(page.getByText(/pendiente de sincronizar/)).toHaveCount(0);
});
