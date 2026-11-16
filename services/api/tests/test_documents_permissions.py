"""Flujo de documentos y pruebas negativas de autorización (IDOR)."""
from tests.conftest import section_id, upload


def _student_doc(make_client, docx_fixtures, fixture="violations.docx"):
    student = make_client("estudiante1")
    sid = section_id(student, "COM-RED")
    r = upload(student, docx_fixtures[fixture], sid)
    assert r.status_code == 201, r.text
    return student, r.json()


def test_upload_analyze_and_persist(make_client, seeded, docx_fixtures):
    student, doc = _student_doc(make_client, docx_fixtures)
    assert doc["status"] == "UPLOADED"
    r = student.post(f"/api/v1/documents/{doc['id']}/analyze")
    assert r.status_code == 200
    analysis = r.json()
    assert analysis["status"] == "COMPLETED"
    assert analysis["rule_set_version"].startswith("apa7-general")
    assert {f["rule_code"] for f in analysis["findings"]} >= {"APA-01", "APA-03", "APA-04"}
    assert analysis["summary"]["counts"]["errors"] >= 5
    # persistido: lectura posterior idéntica
    again = student.get(f"/api/v1/documents/{doc['id']}/analysis").json()
    assert again["findings"] == analysis["findings"]
    # reanálisis crea una nueva corrida
    student.post(f"/api/v1/documents/{doc['id']}/analyze")
    assert len(student.get(f"/api/v1/documents/{doc['id']}/runs").json()) == 2


def test_upload_rejects_invalid_file(make_client, seeded, tmp_path):
    student = make_client("estudiante1")
    bad = tmp_path / "trabajo.docx"
    bad.write_bytes(b"texto plano disfrazado")
    r = upload(student, bad, section_id(student, "COM-RED"))
    assert r.status_code == 422 and r.json()["detail"]["code"] == "not_docx"


def test_upload_path_traversal_filename_is_sanitized(make_client, seeded, docx_fixtures):
    student = make_client("estudiante1")
    r = upload(student, docx_fixtures["compliant.docx"], section_id(student, "COM-RED"), name="../../etc/trabajo.docx")
    assert r.status_code == 201 and r.json()["original_filename"] == "trabajo.docx"


def test_student_cannot_upload_to_foreign_section(make_client, seeded, docx_fixtures):
    other = make_client("estudiante4")
    itd_sid = section_id(other, "ITD-MET")
    student = make_client("estudiante1")
    assert upload(student, docx_fixtures["compliant.docx"], itd_sid).status_code == 403


def test_teacher_and_admin_cannot_upload(make_client, seeded, docx_fixtures):
    teacher = make_client("docente.com")
    assert upload(teacher, docx_fixtures["compliant.docx"], section_id(teacher, "COM-RED")).status_code == 403


def test_student_b_cannot_read_student_a_document(make_client, seeded, docx_fixtures):
    _, doc = _student_doc(make_client, docx_fixtures)
    other = make_client("estudiante2")  # misma sección, otro estudiante
    for path in ("", "/analysis", "/download", "/comments", "/runs"):
        assert other.get(f"/api/v1/documents/{doc['id']}{path}").status_code == 404
    assert other.post(f"/api/v1/documents/{doc['id']}/analyze").status_code == 404
    assert other.get("/api/v1/documents").json() == []


def test_student_without_enrollment_sees_nothing(make_client, seeded, docx_fixtures):
    _student_doc(make_client, docx_fixtures)
    lonely = make_client("estudiante6")
    assert lonely.get("/api/v1/sections").json() == []
    assert lonely.get("/api/v1/documents").json() == []


def test_teacher_sees_and_comments_only_assigned_sections(make_client, seeded, docx_fixtures):
    student, doc = _student_doc(make_client, docx_fixtures)
    student.post(f"/api/v1/documents/{doc['id']}/analyze")
    teacher_a = make_client("docente.com")
    teacher_b = make_client("docente.itd")
    assert [d["id"] for d in teacher_a.get("/api/v1/documents").json()] == [doc["id"]]
    assert teacher_a.get(f"/api/v1/documents/{doc['id']}/analysis").status_code == 200
    assert teacher_b.get("/api/v1/documents").json() == []
    assert teacher_b.get(f"/api/v1/documents/{doc['id']}/analysis").status_code == 404
    assert teacher_b.post(f"/api/v1/documents/{doc['id']}/comments", json={"body": "intruso"}).status_code == 404
    r = teacher_a.post(f"/api/v1/documents/{doc['id']}/comments", json={"body": "Revisa el interlineado y la sangría."})
    assert r.status_code == 201
    assert teacher_a.patch(f"/api/v1/documents/{doc['id']}/review-status", json={"review_status": "REVIEWED"}).json()["review_status"] == "REVIEWED"
    # el estudiante ve el comentario de su propio documento
    comments = student.get(f"/api/v1/documents/{doc['id']}/comments").json()
    assert comments[0]["body"].startswith("Revisa") and comments[0]["teacher_name"]
    # el estudiante no puede comentar ni marcar revisado
    assert student.post(f"/api/v1/documents/{doc['id']}/comments", json={"body": "x"}).status_code == 403
    # docente no analiza (no altera hallazgos)
    assert teacher_a.post(f"/api/v1/documents/{doc['id']}/analyze").status_code == 403


def test_teacher_cannot_edit_other_teacher_comment(make_client, seeded, docx_fixtures, db):
    from sqlalchemy import select

    from app.models import TeacherAssignment, User
    _, doc = _student_doc(make_client, docx_fixtures)
    teacher_a = make_client("docente.com")
    comment = teacher_a.post(f"/api/v1/documents/{doc['id']}/comments", json={"body": "Original"}).json()
    # asignamos al segundo docente a la misma sección para probar propiedad del comentario
    t2 = db.scalars(select(User).where(User.email.like("docente.itd@%"))).one()
    db.add(TeacherAssignment(teacher_id=t2.id, section_id=doc["section_id"]))
    db.commit()
    teacher_b = make_client("docente.itd")
    assert teacher_b.patch(f"/api/v1/documents/{doc['id']}/comments/{comment['id']}", json={"body": "cambio"}).status_code == 404
    assert teacher_b.delete(f"/api/v1/documents/{doc['id']}/comments/{comment['id']}").status_code == 404


def test_teacher_section_dashboard(make_client, seeded, docx_fixtures):
    student, doc = _student_doc(make_client, docx_fixtures)
    student.post(f"/api/v1/documents/{doc['id']}/analyze")
    data = make_client("docente.com").get("/api/v1/teacher/sections").json()
    red = next(x for x in data if x["section"]["course"]["code"] == "COM-RED")
    assert red["stats"]["documents"] == 1 and red["stats"]["pending"] == 1
    rules = {r["rule_code"]: r for r in red["stats"]["findings_by_rule"]}
    assert rules["APA-01"]["verified_errors"] == 1 and rules["APA-08"]["verified_errors"] == 0
    other_sid = section_id(make_client("estudiante4"), "ITD-MET")
    assert make_client("docente.com").get(f"/api/v1/teacher/sections/{other_sid}/students").status_code == 404


def test_role_guards(make_client, seeded):
    for who in ("estudiante1", "docente.com"):
        c = make_client(who)
        assert c.get("/api/v1/admin/users").status_code == 403
        assert c.post("/api/v1/admin/programs", json={"code": "X1", "name": "Programa X"}).status_code == 403
    assert make_client("estudiante1").get("/api/v1/teacher/sections").status_code == 403


def test_admin_download_is_audited(make_client, seeded, docx_fixtures):
    _, doc = _student_doc(make_client, docx_fixtures)
    admin = make_client("admin")
    r = admin.get(f"/api/v1/documents/{doc['id']}/download")
    assert r.status_code == 200 and r.content.startswith(b"PK")
    assert any(e["action"] == "document.download_admin" for e in admin.get("/api/v1/admin/audit").json())
