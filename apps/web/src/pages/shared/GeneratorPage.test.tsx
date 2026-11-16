import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderWithProviders } from "../../test/utils";
import { GeneratorPage } from "./GeneratorPage";

afterEach(() => vi.unstubAllGlobals());

describe("Generador de referencias", () => {
  it("genera la vista previa de un artículo con DOI y citas en vivo", async () => {
    mockApi(null);
    const user = userEvent.setup();
    renderWithProviders(<GeneratorPage />, "/generador?tipo=journal_article");
    await user.type(screen.getByLabelText(/Apellido\(s\)/), "Martínez");
    await user.type(screen.getByLabelText(/Nombre\(s\)/), "Rosa");
    await user.type(screen.getByLabelText(/^Año/), "2021");
    await user.type(screen.getByLabelText(/^Título/), "Lectura crítica en redes sociales");
    await user.type(screen.getByLabelText(/Nombre de la revista/), "Revista Ficticia de Comunicación");
    await user.type(screen.getByLabelText(/^Volumen/), "12");
    await user.type(screen.getByLabelText(/^Número$/), "3");
    await user.type(screen.getByLabelText(/^Páginas/), "45-60");
    await user.type(screen.getByLabelText(/^DOI/), "10.0000/rfc.2021.003");
    const preview = await screen.findByTestId("reference-preview");
    expect(preview).toHaveTextContent("Martínez, R. (2021). Lectura crítica en redes sociales. Revista Ficticia de Comunicación, 12(3), 45–60. https://doi.org/10.0000/rfc.2021.003");
    expect(preview.querySelector("i")).toHaveTextContent("Revista Ficticia de Comunicación, 12");
    expect(screen.getByTestId("parenthetical")).toHaveTextContent("(Martínez, 2021)");
    await waitFor(() => expect(screen.getByText(/Inicia sesión para guardar/)).toBeInTheDocument());
  });

  it("no inventa datos: sin título no hay vista previa y se marcan errores al copiar", async () => {
    mockApi(null);
    const user = userEvent.setup();
    renderWithProviders(<GeneratorPage />, "/generador?tipo=book");
    await user.type(screen.getByLabelText(/Apellido\(s\)/), "Castro");
    await user.click(screen.getByRole("button", { name: "Copiar referencia" }));
    expect(screen.queryByTestId("reference-preview")).not.toBeInTheDocument();
    expect(await screen.findByText("El título es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("Indica el año o marca «Sin fecha».")).toBeInTheDocument();
  });

  it("filtra los tipos de fuente con el buscador", async () => {
    mockApi(null);
    const user = userEvent.setup();
    renderWithProviders(<GeneratorPage />, "/generador");
    await user.type(screen.getByLabelText("Tipo de fuente"), "youtube");
    const list = screen.getByRole("list", { name: "Tipos de fuente disponibles" });
    expect(list).toHaveTextContent("Video en línea");
    expect(list).not.toHaveTextContent("Libro");
  });
});
