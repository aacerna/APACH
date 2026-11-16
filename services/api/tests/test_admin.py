from app.scripts.seed_demo import DOMAIN

CSV_HEADER = "first_name,last_name,email,program,academic_term,course_code,section_code\n"


def test_admin_creates_academic_structure(make_client, seeded):
    admin = make_client("admin")
    p = admin.post("/api/v1/admin/programs", json={"code": "PUB", "name": "Publicidad Ficticia"})
    assert p.status_code == 201
    assert admin.post("/api/v1/admin/programs", json={"code": "PUB", "name": "Duplicado"}).status_code == 409
    t = admin.post("/api/v1/admin/terms", json={"code": "2027-01", "name": "Ciclo 01-2027", "start_date": "2027-01-15", "end_date": "2027-06-30"})
    assert t.status_code == 201
    bad_term = admin.post("/api/v1/admin/terms", json={"code": "X", "name": "Malo", "start_date": "2027-06-01", "end_date": "2027-01-01"})
    assert bad_term.status_code == 422
    c = admin.post("/api/v1/admin/courses", json={"code": "PUB-101", "name": "Redacción Publicitaria", "program_id": p.json()["id"]})
    assert c.status_code == 201
    s = admin.post("/api/v1/admin/sections", json={"course_id": c.json()["id"], "term_id": t.json()["id"], "code": "01"})
    assert s.status_code == 201
    teacher = admin.post("/api/v1/admin/users", json={"email": f"profe.pub@{DOMAIN}", "first_name": "Pablo", "last_name": "Profesor",
                                                      "role": "TEACHER"}).json()["user"]
    student = admin.post("/api/v1/admin/users", json={"email": f"alumna.pub@{DOMAIN}", "first_name": "Paula", "last_name": "Alumna",
                                                      "role": "STUDENT", "program_id": p.json()["id"]}).json()["user"]
    assert admin.post("/api/v1/admin/assignments", json={"teacher_id": teacher["id"], "section_id": s.json()["id"]}).status_code == 201
    assert admin.post("/api/v1/admin/enrollments", json={"student_id": student["id"], "section_id": s.json()["id"]}).status_code == 201
    assert admin.post("/api/v1/admin/enrollments", json={"student_id": student["id"], "section_id": s.json()["id"]}).status_code == 409
    # roles cruzados rechazados
    assert admin.post("/api/v1/admin/enrollments", json={"student_id": teacher["id"], "section_id": s.json()["id"]}).status_code == 422
    sections = admin.get("/api/v1/admin/sections").json()
    new = next(x for x in sections if x["id"] == s.json()["id"])
    assert new["teachers"] == ["Pablo Profesor"] and new["student_count"] == 1


def test_duplicate_user_email_conflict(make_client, seeded):
    admin = make_client("admin")
    r = admin.post("/api/v1/admin/users", json={"email": f"Estudiante1@{DOMAIN}", "first_name": "X", "last_name": "Y", "role": "STUDENT"})
    assert r.status_code == 409


def test_admin_cannot_deactivate_self(make_client, seeded):
    admin = make_client("admin")
    me = admin.get("/api/v1/me").json()["user"]
    assert admin.patch(f"/api/v1/admin/users/{me['id']}", json={"is_active": False}).status_code == 400


def _csv(admin, body: str):
    return admin.post("/api/v1/admin/imports/preview", files={"file": ("lote.csv", (CSV_HEADER + body).encode("utf-8"), "text/csv")})


def test_csv_import_preview_confirm_idempotent(make_client, seeded):
    admin = make_client("admin")
    body = (
        f"Nora,Nueva,nora@{DOMAIN},COM,2026-02,COM-RED,01\n"
        f"Elena,Estudiante Uno,estudiante1@{DOMAIN},COM,2026-02,COM-INV,01\n"  # ya matriculada
        f"Elena,Estudiante Uno,estudiante1@{DOMAIN},COM,2026-02,COM-RED,01\n"  # ya matriculada
        f"Bruno,Bueno,bruno@{DOMAIN},Comunicaciones,2026-02,COM-INV,01\n"
        f"Malo,Correo,no-es-correo,COM,2026-02,COM-RED,01\n"
        f"Ines,Inexistente,ines@{DOMAIN},COM,2026-02,ITD-MET,01\n"  # asignatura de otro programa
        f"Nora,Nueva,nora@{DOMAIN},COM,2026-02,COM-RED,01\n"  # duplicada en lote
        f"Daniel,Docente,docente.com@{DOMAIN},COM,2026-02,COM-RED,01\n"  # no es estudiante
    )
    preview = _csv(admin, body)
    assert preview.status_code == 200
    data = preview.json()
    actions = [r["action"] for r in data["rows"]]
    assert actions == ["CREATE_AND_ENROLL", "ALREADY_ENROLLED", "ALREADY_ENROLLED", "CREATE_AND_ENROLL", "ERROR", "ERROR", "ERROR", "ERROR"]
    assert data["summary"]["errors"] == 4
    # sin confirmación no se crean cuentas
    assert not [u for u in admin.get("/api/v1/admin/users", params={"q": "nora"}).json()]
    confirm = admin.post(f"/api/v1/admin/imports/{data['batch_id']}/confirm")
    assert confirm.status_code == 200
    assert confirm.json()["result"] == {"enrollments_created": 2, "users_created": 2, "skipped_existing": 2, "rows_with_errors": 4}
    assert len(confirm.json()["activation_links"]) == 2
    assert admin.post(f"/api/v1/admin/imports/{data['batch_id']}/confirm").status_code == 409
    # reimportación del mismo CSV: no duplica cuentas ni matrículas
    again = _csv(admin, body).json()
    result = admin.post(f"/api/v1/admin/imports/{again['batch_id']}/confirm").json()["result"]
    assert result["users_created"] == 0 and result["enrollments_created"] == 0
    assert len(admin.get("/api/v1/admin/users", params={"q": "nora"}).json()) == 1


def test_csv_malformed(make_client, seeded):
    admin = make_client("admin")
    r = admin.post("/api/v1/admin/imports/preview", files={"file": ("x.csv", b"nombre,correo\nA,b\n", "text/csv")})
    assert r.status_code == 422 and "encabezados" in r.json()["detail"]
    r = admin.post("/api/v1/admin/imports/preview", files={"file": ("x.csv", "nombre".encode("utf-16"), "text/csv")})
    assert r.status_code == 422


def test_csv_inactive_program_not_authorized(make_client, seeded):
    admin = make_client("admin")
    com = next(p for p in admin.get("/api/v1/admin/programs").json() if p["code"] == "COM")
    admin.put(f"/api/v1/admin/programs/{com['id']}", json={"code": "COM", "name": com["name"], "active": False})
    row = _csv(admin, f"Ana,X,ana.x@{DOMAIN},COM,2026-02,COM-RED,01\n").json()["rows"][0]
    assert row["action"] == "ERROR" and any("no está autorizado" in e for e in row["errors"])


def test_templates_https_and_visibility(make_client, seeded):
    admin = make_client("admin")
    student = make_client("estudiante1")
    assert student.get("/api/v1/templates").json() == []  # estado vacío: no hay enlaces ficticios
    bad = admin.post("/api/v1/admin/templates", json={"name": "Plantilla", "template_type": "Trabajo escrito", "url": "http://inseguro.example.com/x"})
    assert bad.status_code == 422
    programs = {p["code"]: p["id"] for p in admin.get("/api/v1/admin/programs").json()}
    admin.post("/api/v1/admin/templates", json={"name": "Plantilla ITD", "template_type": "Trabajo escrito",
                                                "url": "https://docs.google.com/document/d/ejemplo-configurado-por-admin", "program_id": programs["ITD"]})
    admin.post("/api/v1/admin/templates", json={"name": "Plantilla general", "template_type": "Trabajo escrito",
                                                "url": "https://docs.google.com/document/d/otro-ejemplo"})
    names = [t["name"] for t in student.get("/api/v1/templates").json()]
    assert names == ["Plantilla general"]  # estudiante de COM no ve plantilla de ITD


def test_ecc_rules_cannot_be_enabled_without_implementation(make_client, seeded):
    admin = make_client("admin")
    r = admin.post("/api/v1/admin/rules", json={"code": "ECC-PORTADA", "name": "Portada ECC", "version": "borrador",
                                                "source": "Guía ECC (pendiente de recibir)"})
    assert r.status_code == 201 and r.json()["enabled"] is False and r.json()["scope"] == "ECC"
    assert admin.patch(f"/api/v1/admin/rules/{r.json()['id']}", json={"enabled": True}).status_code == 409


def test_disabling_general_rule_affects_new_runs(make_client, seeded, docx_fixtures):
    from tests.conftest import section_id, upload
    admin = make_client("admin")
    apa01 = next(r for r in admin.get("/api/v1/admin/rules").json() if r["code"] == "APA-01")
    assert admin.patch(f"/api/v1/admin/rules/{apa01['id']}", json={"enabled": False}).json()["enabled"] is False
    student = make_client("estudiante1")
    doc = upload(student, docx_fixtures["violations.docx"], section_id(student, "COM-RED")).json()
    analysis = student.post(f"/api/v1/documents/{doc['id']}/analyze").json()
    assert "APA-01" not in {f["rule_code"] for f in analysis["findings"]}
    assert "APA-01" not in analysis["summary"]["enabled_rules"]


def test_reports_and_settings(make_client, seeded):
    admin = make_client("admin")
    report = admin.get("/api/v1/admin/reports/summary").json()
    assert report["users"]["STUDENT"] == 6 and "generated_at" in report
    assert admin.put("/api/v1/admin/settings", json={"welcome_video_url": "http://no-https"}).status_code == 422
    admin.put("/api/v1/admin/settings", json={"institutional_contact": "Coordinación ECC (ficticio)"})
    assert make_client().get("/api/v1/settings/public").json()["institutional_contact"] == "Coordinación ECC (ficticio)"
