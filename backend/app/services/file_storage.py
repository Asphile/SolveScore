import os
import uuid

from fastapi import UploadFile

from app.config import settings
from app.models.enums import ResourceType

DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}

DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
}
VIDEO_MIME_TYPES = {"video/mp4", "video/quicktime", "video/webm"}

RESOURCE_TYPE_BY_EXTENSION = {
    ".pdf": ResourceType.DOCUMENT,
    ".doc": ResourceType.DOCUMENT,
    ".docx": ResourceType.DOCUMENT,
    ".ppt": ResourceType.PRESENTATION,
    ".pptx": ResourceType.PRESENTATION,
    ".jpg": ResourceType.IMAGE,
    ".jpeg": ResourceType.IMAGE,
    ".png": ResourceType.IMAGE,
    ".mp4": ResourceType.VIDEO,
    ".mov": ResourceType.VIDEO,
    ".webm": ResourceType.VIDEO,
}


class FileValidationError(Exception):
    pass


# Magic-byte signatures used to cross-check the declared extension/MIME type
# against the file's actual content, since extensions and Content-Type headers
# are both client-supplied and cannot be trusted alone.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    # .docx/.pptx are zip containers; legacy .doc/.ppt use the OLE compound format.
    ".docx": (b"PK\x03\x04",),
    ".pptx": (b"PK\x03\x04",),
    ".doc": (b"\xd0\xcf\x11\xe0",),
    ".ppt": (b"\xd0\xcf\x11\xe0",),
    ".mp4": (b"\x00\x00\x00", b"ftyp"),
    ".mov": (b"\x00\x00\x00", b"ftyp", b"moov"),
    ".webm": (b"\x1a\x45\xdf\xa3",),
}


def _signature_matches(ext: str, header: bytes) -> bool:
    signatures = _SIGNATURES.get(ext)
    if not signatures:
        return True  # no known signature to check against
    return any(sig in header for sig in signatures)


def validate_and_classify(file: UploadFile, size_bytes: int, header: bytes = b"") -> tuple[ResourceType, str]:
    """Validates extension, MIME type, size, and (best-effort) file signature.

    Never trusts the extension or the client-supplied Content-Type alone.
    """
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()

    if ext in VIDEO_EXTENSIONS:
        if file.content_type not in VIDEO_MIME_TYPES:
            raise FileValidationError("The uploaded video's content type does not match its extension")
        max_bytes = settings.max_video_size_mb * 1024 * 1024
        if size_bytes > max_bytes:
            raise FileValidationError(f"Video exceeds the maximum allowed size of {settings.max_video_size_mb} MB")
    elif ext in DOCUMENT_EXTENSIONS:
        if file.content_type not in DOCUMENT_MIME_TYPES:
            raise FileValidationError("The uploaded file's content type does not match its extension")
        max_bytes = settings.max_document_size_mb * 1024 * 1024
        if size_bytes > max_bytes:
            raise FileValidationError(f"File exceeds the maximum allowed size of {settings.max_document_size_mb} MB")
    else:
        raise FileValidationError(f"Unsupported file type: '{ext or 'unknown'}'")

    if size_bytes == 0:
        raise FileValidationError("The uploaded file is empty")

    if header and not _signature_matches(ext, header):
        raise FileValidationError("The file's content does not match its declared type")

    return RESOURCE_TYPE_BY_EXTENSION[ext], ext


def save_upload(application_id: str, secure_filename: str, content: bytes) -> str:
    directory = os.path.join(settings.file_storage_path, application_id)
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, secure_filename)
    with open(path, "wb") as f:
        f.write(content)
    return path


def generate_secure_filename(extension: str) -> str:
    return f"{uuid.uuid4().hex}{extension}"
