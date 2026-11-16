SEGMENTS = {"segments": [{"text": "Castro, L. (2019). ", "italic": False}, {"text": "Medios", "italic": True},
                         {"text": ". Editorial Ficticia.", "italic": False}],
            "parenthetical_citation": "(Castro, 2019)", "narrative_citation": "Castro (2019)", "warnings": [], "rules_version": "gen-1"}


def payload(ts: str, title="Medios"):
    return {"source_type": "book", "input": {"title": title}, "output": SEGMENTS, "updated_at": ts}


def test_reference_upsert_last_write_wins_and_isolation(make_client, seeded):
    a = make_client("estudiante1")
    b = make_client("estudiante2")
    cid = "ref-0001-abcd"
    assert a.put(f"/api/v1/references/{cid}", json=payload("2026-11-20T10:00:00Z")).status_code == 200
    # versión más antigua no sobrescribe
    old = a.put(f"/api/v1/references/{cid}", json=payload("2026-11-20T09:00:00Z", title="Viejo")).json()
    assert old["input"]["title"] == "Medios"
    newer = a.put(f"/api/v1/references/{cid}", json=payload("2026-11-20T11:00:00Z", title="Nuevo")).json()
    assert newer["input"]["title"] == "Nuevo"
    assert len(a.get("/api/v1/references").json()) == 1
    assert b.get("/api/v1/references").json() == []
    # el mismo client_id de otro usuario es un registro independiente
    b.put(f"/api/v1/references/{cid}", json=payload("2026-11-20T12:00:00Z", title="De B"))
    assert a.get("/api/v1/references").json()[0]["input"]["title"] == "Nuevo"
    assert b.delete("/api/v1/references/no-existe-123").status_code == 404
    deleted = a.delete(f"/api/v1/references/{cid}").json()
    assert deleted["deleted_at"] is not None
    assert a.get("/api/v1/references").json() == []
    assert len(a.get("/api/v1/references", params={"since": "2026-01-01T00:00:00Z"}).json()) == 1  # lápida para sync


def test_reference_validation(make_client, seeded):
    a = make_client("estudiante1")
    assert a.put("/api/v1/references/bad id!", json=payload("2026-11-20T10:00:00Z")).status_code in (404, 422)
    bad = payload("2026-11-20T10:00:00Z")
    bad["output"] = {**SEGMENTS, "segments": []}
    assert a.put("/api/v1/references/ref-0002-abcd", json=bad).status_code == 422
    assert make_client().get("/api/v1/references").status_code == 401


def test_guides_are_served_from_shared_content(make_client):
    c = make_client()
    guides = c.get("/api/v1/apa/guides").json()
    slugs = {g["slug"] for g in guides}
    from app.apa_engine.rules import RULES
    assert {r.guide_slug for r in RULES} <= slugs  # todo hallazgo enlaza a una ficha existente
    assert c.get("/api/v1/apa/guides/margins").json()["title"] == "Márgenes"
    assert c.get("/api/v1/apa/guides/no-existe").status_code == 404
