import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GuideContent } from "../../components/GuideContent";
import { Card, EmptyState, PageHeader, inputClass } from "../../components/ui";
import { ECC_NOTE, GUIDE_CATEGORIES, GUIDE_SOURCE_NOTE, GUIDES, guideBySlug } from "../../lib/guides";
import { NotFoundPage } from "./StatusPages";

export function LearnPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const list = useMemo(() => GUIDES.filter((g) => {
    const t = q.trim().toLowerCase();
    const haystack = `${g.title} ${g.summary} ${g.what} ${g.how.join(" ")}`.toLowerCase();
    return (cat === "ALL" || g.category === cat) && (!t || haystack.includes(t));
  }), [q, cat]);
  return (
    <div>
      <PageHeader title="Aprende APA" crumbs={[{ to: "/", label: "Inicio" }, { label: "Aprende APA" }]}
        subtitle="Fichas breves para aplicar APA 7: qué es, cómo se aplica, ejemplo, errores frecuentes y cómo corregirlo. Disponible sin conexión." />
      <p className="mb-4 rounded-lg bg-celeste-50 p-3 text-sm">{ECC_NOTE}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Categorías">
        <button onClick={() => setCat("ALL")} aria-pressed={cat === "ALL"} className={`min-h-11 rounded-full px-4 text-sm ${cat === "ALL" ? "bg-petroleo text-white" : "bg-white ring-1 ring-borde"}`}>Todas</button>
        {GUIDE_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={`min-h-11 rounded-full px-4 text-sm ${cat === c.id ? "bg-petroleo text-white" : "bg-white ring-1 ring-borde"}`}>{c.label}</button>
        ))}
      </div>
      <label htmlFor="guide-search" className="sr-only">Buscar en la guía</label>
      <input id="guide-search" type="search" className={`${inputClass} mb-4`} placeholder="Buscar: márgenes, et al., sangría francesa…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <EmptyState title="No hay fichas con esa búsqueda" /> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => (
            <Card as="li" key={g.slug}>
              <p className="text-xs font-semibold uppercase text-terracota-700">{GUIDE_CATEGORIES.find((c) => c.id === g.category)?.label}</p>
              <h2 className="mt-1 text-lg font-semibold text-petroleo"><Link className="hover:underline" to={`/aprende/${g.slug}`}>{g.title}</Link></h2>
              <p className="mt-1 text-sm text-tenue">{g.summary}</p>
            </Card>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-tenue">{GUIDE_SOURCE_NOTE}</p>
    </div>
  );
}

export function GuidePage() {
  const { slug } = useParams();
  const guide = guideBySlug(slug);
  if (!guide) return <NotFoundPage />;
  const idx = GUIDES.indexOf(guide);
  const next = GUIDES[idx + 1];
  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader title={guide.title} crumbs={[{ to: "/aprende", label: "Aprende APA" }, { label: guide.title }]} />
      <Card><GuideContent guide={guide} /></Card>
      <nav className="mt-4 flex justify-between text-sm" aria-label="Fichas">
        <Link className="text-celeste-700 underline" to="/aprende">← Todas las fichas</Link>
        {next && <Link className="text-celeste-700 underline" to={`/aprende/${next.slug}`}>Siguiente: {next.title} →</Link>}
      </nav>
    </article>
  );
}
