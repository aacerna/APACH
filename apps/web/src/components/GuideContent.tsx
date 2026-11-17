import type { Guide } from "../lib/guides";
import { ECC_NOTE } from "../lib/guides";

export function GuideContent({ guide, headingLevel = 2 }: { guide: Guide; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const sectionClass = "mt-5";
  const hClass = "mb-2 text-base font-black text-petroleo";
  return (
    <div className="text-sm leading-relaxed text-tinta">
      <p className="text-base">{guide.summary}</p>
      <section className={sectionClass}><H className={hClass}>Qué es</H><p>{guide.what}</p></section>
      <section className={sectionClass}><H className={hClass}>Cómo se aplica</H><ul className="list-disc space-y-1 pl-5">{guide.how.map((x) => <li key={x}>{x}</li>)}</ul></section>
      <section className={sectionClass}>
        <H className={hClass}>Ejemplo original</H>
        <figure className="rounded-lg bg-amarillo-50 p-3"><figcaption className="mb-1 text-xs font-semibold text-tenue">{guide.example.label}</figcaption><p className="whitespace-pre-line">{guide.example.text}</p></figure>
      </section>
      <section className={sectionClass}><H className={hClass}>Errores frecuentes</H><ul className="list-disc space-y-1 pl-5">{guide.common_errors.map((x) => <li key={x}>{x}</li>)}</ul></section>
      <section className={sectionClass}><H className={hClass}>Cómo corregirlo</H><ol className="list-decimal space-y-1 pl-5">{guide.fix.map((x) => <li key={x}>{x}</li>)}</ol></section>
      {guide.ecc_pending && <p className="mt-5 rounded-lg bg-celeste-50 p-3 text-xs">{ECC_NOTE}</p>}
    </div>
  );
}
