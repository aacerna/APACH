import { useCallback, useEffect, useState } from "react";
import { referenceSortKey, segmentsToText } from "@shared/references";
import { Alert, Button, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, Spinner } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { deleteLocal, listLocal, pendingCount, syncLibrary, type LibraryItem } from "../../lib/library";
import { useOnline } from "../../lib/useOnline";
import { copySegments, SegmentsView } from "./GeneratorPage";

export function LibraryPage() {
  const { user } = useAuth();
  const online = useOnline();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    const list = await listLocal(user.id);
    list.sort((a, b) => referenceSortKey(a.input).localeCompare(referenceSortKey(b.input)));
    setItems(list);
    setPending(await pendingCount(user.id));
  }, [user]);

  const sync = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      const r = await syncLibrary(user.id);
      if (!silent) setMessage({ tone: "success", text: `Biblioteca sincronizada. ${r.pulled} cambio(s) recibidos del servidor.` });
    } catch {
      if (!silent) setMessage({ tone: "info", text: "Sin conexión con el servidor: trabajas con la copia local. Se sincronizará al reconectar." });
    }
    await load();
  }, [user, load]);

  useEffect(() => { load().then(() => sync(true)); }, [load, sync]);
  useEffect(() => { if (online) sync(true); }, [online, sync]);

  if (!user) return null;
  if (items === null) return <Spinner />;
  const chosen = items.filter((i) => selected.size === 0 || selected.has(i.client_id));

  return (
    <div>
      <PageHeader title="Mi biblioteca de referencias" crumbs={[{ to: "/", label: "Inicio" }, { label: "Biblioteca" }]}
        subtitle="Ordenada alfabéticamente según APA 7. Se guarda en este dispositivo y se sincroniza con tu cuenta cuando hay conexión."
        actions={<>
          <LinkButton to="/generador">Nueva referencia</LinkButton>
          <Button variant="secondary" onClick={() => sync()} disabled={!online}>Sincronizar</Button>
          <Button variant="secondary" disabled={items.length === 0} onClick={() => import("../../lib/docxExport").then((m) => m.downloadReferencesDocx(chosen.map((i) => i.output.segments)))}>
            Exportar a Word {selected.size ? `(${selected.size})` : ""}
          </Button>
        </>} />
      <div className="mb-4 space-y-2">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {pending > 0 && <Alert tone="warning">{pending} cambio(s) pendientes de sincronizar con el servidor.</Alert>}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Tu biblioteca está vacía" action={<LinkButton to="/generador">Crear una referencia</LinkButton>}>Las referencias que guardes desde el generador aparecerán aquí.</EmptyState>
      ) : (
        <Card>
          <h2 className="mb-2 text-center font-bold">Referencias</h2>
          <p className="mb-4 text-center text-xs text-tenue">Marca referencias para exportar solo esas; sin selección se exportan todas.</p>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.client_id} className="border-t border-borde pt-4 first:border-0 first:pt-0">
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-2 h-5 w-5" aria-label={`Seleccionar ${segmentsToText(item.output.segments).slice(0, 60)}`}
                    checked={selected.has(item.client_id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(item.client_id); else n.delete(item.client_id); return n; })} />
                  <div className="flex-1">
                    <p className="hanging font-serif leading-loose"><SegmentsView segments={item.output.segments} /></p>
                    <p className="mt-1 text-xs text-tenue">{item.output.parenthetical_citation} · {item.output.narrative_citation}{item.dirty ? " · pendiente de sincronizar" : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => copySegments(item.output.segments).then(() => setMessage({ tone: "success", text: "Referencia copiada." }))}>Copiar</Button>
                      <LinkButton variant="ghost" to={`/generador?tipo=${item.source_type}&editar=${item.client_id}`}>Editar</LinkButton>
                      <ConfirmButton message="¿Eliminar esta referencia de tu biblioteca?" onConfirm={async () => { await deleteLocal(user.id, item.client_id); await sync(true); }}>Eliminar</ConfirmButton>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
