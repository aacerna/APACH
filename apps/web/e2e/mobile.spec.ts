import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("navegación móvil sin desbordamiento horizontal", async ({ page }) => {
  await login(page, "estudiante1");
  for (const route of ["/inicio", "/trabajos", "/generador", "/aprende", "/referencias"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Menú" }).click();
  await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mis trabajos" })).toBeVisible();
});
