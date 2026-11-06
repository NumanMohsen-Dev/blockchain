import hashlib
import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO, Optional, Set, Tuple
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

# Whitelist of common forensic and digital evidence MIME types
ALLOWED_MIME_TYPES: Set[str] = {
    # Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
    "image/bmp",
    "image/gif",
    # Documents
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/xml",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # Audio / Video
    "video/mp4",
    "video/x-msvideo",
    "video/quicktime",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    # Binary / Disk Images / Archives
    "application/octet-stream",
    "application/zip",
    "application/x-tar",
    "application/gzip",
}

# Maximum chunk size for streaming reads (64 KB)
CHUNK_SIZE = 64 * 1024


class StorageService:
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or settings.EVIDENCE_STORAGE_PATH).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _sanitize_extension(self, filename: str) -> str:
        """Extracts and sanitizes file extension."""
        ext = Path(filename).suffix.lower()
        # Keep alphanumeric extension only, max 10 chars
        clean_ext = "".join(c for c in ext if c.isalnum() or c == ".")
        return clean_ext[:10] if clean_ext else ".bin"

    def _resolve_safe_path(self, storage_filename: str) -> Path:
        """Resolves full path and guards strictly against path traversal."""
        # storage_filename must be a plain filename without directory separators
        if "/" in storage_filename or "\\" in storage_filename or ".." in storage_filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage filename detected",
            )
        target_path = (self.base_path / storage_filename).resolve()
        # Ensure target_path is within base_path
        try:
            target_path.relative_to(self.base_path)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Path traversal detected",
            )
        return target_path

    async def save_evidence_file(
        self, upload_file: UploadFile
    ) -> Tuple[str, str, int, str]:
        """
        Saves uploaded file securely to disk while computing SHA-256 in a single pass.
        Returns:
            (storage_filename, sha256_hex, file_size, mime_type)
        """
        original_filename = upload_file.filename or "unknown_evidence"
        mime_type = upload_file.content_type or "application/octet-stream"

        # Validate MIME type if practical
        if mime_type not in ALLOWED_MIME_TYPES and not mime_type.startswith("image/") and not mime_type.startswith("video/"):
            # If not in whitelist, allow if octet-stream fallback or reject
            if not mime_type == "application/octet-stream":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file type '{mime_type}'. Please upload supported evidence formats.",
                )

        # Generate unique non-user-controlled filename
        ext = self._sanitize_extension(original_filename)
        storage_filename = f"{uuid.uuid4().hex}{ext}"
        destination_path = self._resolve_safe_path(storage_filename)

        sha256_hasher = hashlib.sha256()
        total_size = 0

        try:
            with open(destination_path, "wb") as f_out:
                while True:
                    chunk = await upload_file.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > settings.MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File exceeds maximum allowed upload size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB",
                        )
                    sha256_hasher.update(chunk)
                    f_out.write(chunk)
        except Exception as e:
            # Clean up destination file if interrupted
            if destination_path.exists():
                destination_path.unlink(missing_ok=True)
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save evidence file: {str(e)}",
            )

        if total_size == 0:
            if destination_path.exists():
                destination_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes). Cannot register empty evidence.",
            )

        sha256_hex = "0x" + sha256_hasher.hexdigest()
        return storage_filename, sha256_hex, total_size, mime_type

    def calculate_file_sha256(self, storage_filename: str) -> str:
        """Calculates SHA-256 for an existing file on disk."""
        target_path = self._resolve_safe_path(storage_filename)
        if not target_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored evidence file not found on disk",
            )

        sha256_hasher = hashlib.sha256()
        with open(target_path, "rb") as f_in:
            while True:
                chunk = f_in.read(CHUNK_SIZE)
                if not chunk:
                    break
                sha256_hasher.update(chunk)

        return "0x" + sha256_hasher.hexdigest()

    def get_file_path(self, storage_filename: str) -> Path:
        """Returns safe verified Path object for file download."""
        target_path = self._resolve_safe_path(storage_filename)
        if not target_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored evidence file does not exist",
            )
        return target_path

    def delete_file(self, storage_filename: str) -> bool:
        """Safely deletes an evidence file from disk."""
        try:
            target_path = self._resolve_safe_path(storage_filename)
            if target_path.exists():
                target_path.unlink()
                return True
        except Exception:
            pass
        return False


storage_service = StorageService()

