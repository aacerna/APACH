/** Recorrido de la demo Feria NODOS (docs/11-ROADMAP.md) contra el stack real, sin mocks. */
import { expect, test } from "@playwright/test";
import path from "node:path";
import { FIXTURES, login, logout } from "./helpers";

test.describe.configure({ mode: "serial" });
let documentUrl = "";
const uniqueName = `demo-e2e-${Date.now()}.docx`;

test("1. Estudiante carga un DOCX y ve hallazgos calculados con guía enlazada", async ({ page }) => {
  await login(page, "estudiante1");
  await expect(page.getByRole("heading", { name: /Hola, Elena/ })).toBeVisible();
  await page.getByRole("link", { name: /Revisar mi documento/ }).first().click();
  await page.getByLabel("1. Elige el curso").selectOption({ label: "Redacción Académica · Sección 01 (2026-02)" });
  // Se renombra en memoria para distinguir ejecuciones; el contenido es el fixture real.
  const fs = await import("node:fs");
  await page.getByLabel(/Selecciona tu archivo Word/).setInputFiles({
    name: uniqueName,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: fs.readFileSync(path.join(FIXTURES, "demo_trabajo_nodos.docx")),
  });
  await page.getByRole("button", { name: "Revisar documento" }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+/, { timeout: 30_000 });
  documentUrl = page.url();
  await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible();
  await expect(page.getByText(/no tienen interlineado doble \(medido: 1\.5\)/)).toBeVisible();
  await expect(page.getByText(/Orden alfabético: «Castro, L» debería ir antes/)).toBeVisible();
  await expect(page.getByText(/La cita «\(Navarro, 2023\)» no coincide/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Errores verificados/ })).toContainText("4");
  // Aprender a corregir abre la ficha sin salir de los resultados.
  await page.getByRole("button", { name: "Aprender a corregir" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Aprender a corregir: Interlineado/ })).toBeVisible();
  await expect(dialog.getByText("Cómo corregirlo")).toBeVisible();
  await dialog.getByRole("button", { name: "Volver a mis resultados" }).click();
  await expect(page).toHaveURL(documentUrl);
  // Evidencia medida visible.
  await page.getByText("Ver evidencia medida").first().click();
  await expect(page.getByText(/Párrafo \d+:/).first()).toBeVisible();
});

test("2. Estudiante genera una referencia y la guarda en su biblioteca", async ({ page }) => {
  await login(page, "estudiante1");
  await page.goto("/generador?tipo=online_video");
  await page.getByLabel("Institución o grupo").check();
  await page.getByLabel("Nombre de la institución").fill("Laboratorio Ficticio de Medios");
  await page.getByLabel(/^Año/).fill("2024");
  await page.getByLabel("Mes").selectOption({ label: "febrero" });
  await page.getByLabel("Día").fill("12");
  await page.getByLabel(/^Título/).fill("Introducción al periodismo de datos");
  await page.getByLabel(/^Plataforma/).fill("YouTube");
  await page.getByLabel(/^URL/).fill("https://www.youtube.com/watch?v=ejemplo");
  await expect(page.getByTestId("reference-preview")).toHaveText(
    "Laboratorio Ficticio de Medios. (2024, 12 de febrero). Introducción al periodismo de datos [Video]. YouTube. https://www.youtube.com/watch?v=ejemplo");
  await page.getByRole("button", { name: "Guardar en mi biblioteca" }).click();
  await expect(page.getByText(/guardada en tu biblioteca y sincronizada/)).toBeVisible();
  await page.goto("/biblioteca");
  await expect(page.getByText("Introducción al periodismo de datos").first()).toBeVisible();
});

test("3. Otro estudiante no puede abrir el documento ajeno", async ({ page }) => {
  await login(page, "estudiante2");
  await page.goto(documentUrl);
  await expect(page.getByText("Documento no encontrado.")).toBeVisible();
});

test("4. Docente de la sección revisa y comenta; docente ajeno no accede", async ({ page }) => {
  await login(page, "docente.itd");
  await page.goto(documentUrl);
  await expect(page.getByText("Documento no encontrado.")).toBeVisible();
  await logout(page);

  await login(page, "docente.com");
  await expect(page.getByRole("heading", { name: "Mis secciones" })).toBeVisible();
  await page.getByRole("link", { name: /Redacción Académica · Sección 01/ }).click();
  await page.getByRole("link", { name: uniqueName }).click();
  await expect(page.getByText(/no tienen interlineado doble/)).toBeVisible();
  await page.getByLabel("Nueva observación para el estudiante").fill("Buen avance. Corrige el interlineado y aplica sangría francesa en Referencias.");
  await page.getByRole("button", { name: "Publicar comentario" }).click();
  await expect(page.getByText("Buen avance. Corrige el interlineado")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como revisado" }).click();
  await expect(page.getByRole("button", { name: "Marcar como pendiente" })).toBeVisible();
});

test("5. El estudiante ve el comentario de su docente", async ({ page }) => {
  await login(page, "estudiante1");
  await page.goto(documentUrl);
  await expect(page.getByText("Buen avance. Corrige el interlineado")).toBeVisible();
  await expect(page.getByText("Revisado por docente")).toBeVisible();
});

test("6. Administración consulta usuarios, cursos e importa CSV con vista previa", async ({ page }) => {
  await login(page, "admin");
  await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Elena Estudiante Uno" })).toBeVisible();
  await page.getByRole("link", { name: "Estructura académica" }).click();
  await expect(page.getByText(/COM-RED-01/)).toBeVisible();
  await page.getByRole("link", { name: "Importar CSV" }).click();
  const stamp = Date.now();
  const csv = `first_name,last_name,email,program,academic_term,course_code,section_code\nNadia,Nueva,nadia.${stamp}@demo.example.edu,COM,2026-02,COM-RED,01\nMal,Formato,sin-arroba,COM,2026-02,COM-RED,01\n`;
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "lote.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Validar y previsualizar" }).click();
  await expect(page.getByText("Correo electrónico no válido.")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText(/Cuentas creadas: 1 · Matrículas creadas: 1/)).toBeVisible();
  await expect(page.getByText(/activar\?token=/)).toBeVisible();
});
