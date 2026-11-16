"""Validación defensiva de archivos DOCX antes de almacenarlos o analizarlos."""
from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass

from lxml import etree

from app.core.config import get_settings

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MAIN_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
ACCEPTED_DECLARED_MIMES = {DOCX_MIME, "application/octet-stream", "application/zip", ""}
MAX_RATIO = 120


class UploadError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class ValidatedUpload:
    filename: str
    data: bytes
    sha256: str
    mime_type: str


def sanitize_filename(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "")[-1]
    base = re.sub(r"[\x00-\x1f<>:\"|?*]", "", base).strip(" .")
    return base[:200] or "documento.docx"


def validate_docx(filename: str | None, declared_mime: str | None, data: bytes) -> ValidatedUpload:
    settings = get_settings()
    clean_name = sanitize_filename(filename)
    if not clean_name.lower().endswith(".docx"):
        raise UploadError("invalid_extension", "Solo se aceptan archivos Word con extensión .docx.")
    if (declared_mime or "") not in ACCEPTED_DECLARED_MIMES:
        raise UploadError("invalid_mime", "El tipo de archivo declarado no corresponde a un documento Word (.docx).")
    if not data:
        raise UploadError("empty_file", "El archivo está vacío.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise UploadError("file_too_large", f"El archivo supera el máximo de {settings.max_upload_mb} MB.")
    if not data.startswith(b"PK\x03\x04"):
        raise UploadError("not_docx", "El contenido no es un documento DOCX válido (no es un paquete OOXML).")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise UploadError("not_docx", "El archivo DOCX está dañado o no es un paquete válido.") from exc
    with zf:
        infos = zf.infolist()
        if len(infos) > settings.max_docx_entries:
            raise UploadError("too_many_entries", "El paquete DOCX contiene demasiadas partes internas.")
        total = sum(i.file_size for i in infos)
        if total > settings.max_docx_uncompressed_mb * 1024 * 1024:
            raise UploadError("zip_bomb", "El contenido descomprimido del documento es demasiado grande.")
        for info in infos:
            if info.compress_size and info.file_size / info.compress_size > MAX_RATIO and info.file_size > 1024 * 1024:
                raise UploadError("zip_bomb", "El documento tiene una compresión anómala y no se procesará.")
            if info.filename.startswith("/") or ".." in info.filename.split("/"):
                raise UploadError("unsafe_entry", "El paquete contiene rutas internas no permitidas.")
        names = {i.filename for i in infos}
        if "[Content_Types].xml" not in names or "word/document.xml" not in names:
            raise UploadError("not_docx", "El archivo no contiene la estructura de un documento Word.")
        if any(n.lower().endswith("vbaproject.bin") for n in names):
            raise UploadError("macros", "El documento contiene macros. Guárdalo como .docx sin macros.")
        try:
            ct = etree.fromstring(zf.read("[Content_Types].xml"), parser=etree.XMLParser(resolve_entities=False, no_network=True))
        except etree.XMLSyntaxError as exc:
            raise UploadError("not_docx", "El documento tiene metadatos internos dañados.") from exc
        overrides = {o.get("PartName"): o.get("ContentType") for o in ct if o.tag.endswith("Override")}
        if overrides.get("/word/document.xml") != MAIN_CT:
            raise UploadError("not_docx", "El archivo no es un documento Word estándar (.docx); podría ser una plantilla o un archivo con macros.")
    return ValidatedUpload(clean_name, data, hashlib.sha256(data).hexdigest(), DOCX_MIME)
