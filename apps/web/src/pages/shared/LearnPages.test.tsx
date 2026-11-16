import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RULES_GUIDE_SLUGS } from "../../test/ruleSlugs";
import { GUIDES, guideBySlug } from "../../lib/guides";
import { mockApi, renderWithProviders } from "../../test/utils";
import { LearnPage } from "./LearnPages";

describe("Aprende APA", () => {
  it("busca fichas y muestra la nota ECC pendiente", async () => {
    mockApi(null);
    const user = userEvent.setup();
    renderWithProviders(<LearnPage />, "/aprende");
    expect(screen.getByText(/Criterios institucionales ECC pendientes/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar en la guía"), "francesa");
    expect(screen.getByRole("link", { name: "Sangría francesa" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Márgenes" })).not.toBeInTheDocument();
  });

  it("cada regla del motor enlaza a una ficha existente con estructura completa", () => {
    for (const slug of RULES_GUIDE_SLUGS) expect(guideBySlug(slug), slug).toBeDefined();
    for (const g of GUIDES) {
      expect(g.what && g.how.length && g.example.text && g.common_errors.length && g.fix.length, g.slug).toBeTruthy();
    }
  });
});
