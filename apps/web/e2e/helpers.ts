import { expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "Apach-Demo-2026";
export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../services/api/tests/fixtures/docx");

export async function login(page: Page, local: string) {
  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(`${local}@demo.example.edu`);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
}
