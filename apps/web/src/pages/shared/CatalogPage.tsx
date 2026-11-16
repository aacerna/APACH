import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@shared/references";
import { Card, EmptyState, LinkButton, PageHeader, inputClass } from "../../components/ui";

export function CatalogPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const list = useMemo(() => CATALOG.filter((e) => {
    const t = q.trim().toLowerCase();
    return (cat === "ALL" || e.category === cat) && (!t || e.label.toLowerCase().includes(t) || e.keywords.some((k) => k.includes(t)));
  }), [q, cat]);
  return (
    <div>
      <PageHeader title="Explora las referencias APA" crumbs={[{ to: "/", label: "Inicio" }, { label: "Explorar referencias" }]}
        subtitle="Estructura, ejemplo y citas de cada tipo de fuente. Los ejemplos son ficticios y originales." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-60 flex-1">
          <label htmlFor="cat-search" className="text-sm font-semibold">Buscar</label>
          <input id="cat-search" type="search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: YouTube, tesis, ley…" />
        </div>
        <div>
          <label htmlFor="cat-filter" className="text-sm font-semibold">Categoría</label>
          <select id="cat-filter" className={inputClass} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="ALL">Todas</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      {list.length === 0 ? <EmptyState title="Sin resultados">Prueba con otra palabra o categoría.</EmptyState> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((e) => (
            <Card as="li" key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-petroleo">{e.label}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.implemented ? "bg-petroleo-50 text-petroleo" : "bg-gray-100 text-tenue"}`}>
                  {e.implemented ? "Generador disponible" : "Solo ficha (generador pendiente)"}
                </span>
              </div>
              <p className="text-xs text-tenue">{CATEGORIES.find((c) => c.id === e.category)?.label}</p>
              <p className="mt-2 text-sm"><strong>Cuándo usarla:</strong> {e.when}</p>
              <p className="mt-2 text-sm"><strong>Estructura:</strong> {e.structure}</p>
              <p className="hanging mt-2 rounded-lg bg-amarillo-50 p-3 font-serif text-sm">{e.example}</p>
              <p className="mt-2 text-sm"><strong>Cita narrativa:</strong> {e.narrative} · <strong>Parentética:</strong> {e.parenthetical}</p>
              {e.implemented && <LinkButton to={`/generador?tipo=${e.id}`} className="mt-3">Crear esta referencia</LinkButton>}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
