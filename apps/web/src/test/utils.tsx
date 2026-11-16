import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../lib/auth";

/** Simula la API: `/me` responde 401 (visitante) salvo que se indique un usuario. */
export function mockApi(user: Record<string, unknown> | null = null) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/me")) {
      return user ? new Response(JSON.stringify({ user, csrf_token: "x" }), { status: 200 }) : new Response(JSON.stringify({ detail: "no" }), { status: 401 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function renderWithProviders(ui: ReactNode, route = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
