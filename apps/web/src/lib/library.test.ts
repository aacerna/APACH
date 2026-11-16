import { describe, expect, it } from "vitest";
import { formatReference, type ReferenceInput } from "@shared/references";
import { clearLocalLibrary, deleteLocal, listLocal, pendingCount, saveLocal } from "./library";

const input: ReferenceInput = { source_type: "book", authors: [{ kind: "person", family: "Castro", given: "Luisa" }], date: { year: "2019" }, title: "Medios", publisher: "Editorial Ficticia" };
const output = (() => { const r = formatReference(input); if (!r.ok) throw new Error(); return r.output; })();

describe("biblioteca local (IndexedDB)", () => {
  it("separa las referencias por usuario", async () => {
    await saveLocal(101, { client_id: "a-1", source_type: "book", input, output });
    await saveLocal(202, { client_id: "b-1", source_type: "book", input, output });
    expect((await listLocal(101)).map((r) => r.client_id)).toEqual(["a-1"]);
    expect((await listLocal(202)).map((r) => r.client_id)).toEqual(["b-1"]);
  });

  it("marca cambios pendientes, borra con lápida y limpia al cerrar sesión", async () => {
    await saveLocal(303, { client_id: "c-1", source_type: "book", input, output });
    expect(await pendingCount(303)).toBe(1);
    await deleteLocal(303, "c-1");
    expect(await listLocal(303)).toEqual([]);
    expect(await pendingCount(303)).toBe(1); // la lápida espera sincronización
    await clearLocalLibrary(303);
    expect(await pendingCount(303)).toBe(0);
  });
});
