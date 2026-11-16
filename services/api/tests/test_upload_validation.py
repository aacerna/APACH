import io
import zipfile

import pytest

from app.services.upload_validation import UploadError, sanitize_filename, validate_docx


def make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return buf.getvalue()


CT_DOCX = b'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
CT_DOCM = CT_DOCX.replace(b"document.main+xml", b"document.macroEnabled.main+xml").replace(b"wordprocessingml.document.macroEnabled", b"ms-word.document.macroEnabled")


def test_valid_docx(docx_fixtures):
    data = docx_fixtures["compliant.docx"].read_bytes()
    v = validate_docx("trabajo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data)
    assert len(v.sha256) == 64


@pytest.mark.parametrize("name,mime,data,code", [
    ("trabajo.pdf", "application/pdf", b"%PDF-1.4", "invalid_extension"),
    ("trabajo.docx", "text/plain", b"PK\x03\x04", "invalid_mime"),
    ("trabajo.docx", "", b"", "empty_file"),
    ("trabajo.docx", "", b"esto no es un zip", "not_docx"),
])
def test_rejections(name, mime, data, code):
    with pytest.raises(UploadError) as exc:
        validate_docx(name, mime, data)
    assert exc.value.code == code


def test_renamed_zip_without_word_document():
    with pytest.raises(UploadError) as exc:
        validate_docx("x.docx", "", make_zip({"hola.txt": b"hola"}))
    assert exc.value.code == "not_docx"


def test_macro_document_rejected():
    data = make_zip({"[Content_Types].xml": CT_DOCX, "word/document.xml": b"<w/>", "word/vbaProject.bin": b"x"})
    with pytest.raises(UploadError) as exc:
        validate_docx("x.docx", "", data)
    assert exc.value.code == "macros"


def test_docm_content_type_rejected():
    data = make_zip({"[Content_Types].xml": CT_DOCM, "word/document.xml": b"<w/>"})
    with pytest.raises(UploadError) as exc:
        validate_docx("x.docx", "", data)
    assert exc.value.code == "not_docx"


def test_zip_bomb_rejected():
    data = make_zip({"[Content_Types].xml": CT_DOCX, "word/document.xml": b"0" * (5 * 1024 * 1024)})
    with pytest.raises(UploadError) as exc:
        validate_docx("x.docx", "", data)
    assert exc.value.code == "zip_bomb"


def test_unsafe_zip_entry_rejected():
    data = make_zip({"[Content_Types].xml": CT_DOCX, "word/document.xml": b"<w/>", "../evil.txt": b"x"})
    with pytest.raises(UploadError) as exc:
        validate_docx("x.docx", "", data)
    assert exc.value.code == "unsafe_entry"


def test_too_large(monkeypatch):
    from app.core import config
    monkeypatch.setattr(config.get_settings(), "max_upload_mb", 0)
    with pytest.raises(UploadError) as exc:
        validate_docx("x.docx", "", b"PK\x03\x04" + b"0" * 10)
    assert exc.value.code == "file_too_large"


@pytest.mark.parametrize("raw,expected", [
    ("../../etc/passwd.docx", "passwd.docx"),
    ("C:\\Users\\x\\trabajo final.docx", "trabajo final.docx"),
    ("", "documento.docx"),
])
def test_sanitize_filename(raw, expected):
    assert sanitize_filename(raw) == expected
