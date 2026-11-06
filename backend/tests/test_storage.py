import hashlib
import io
import pytest
from fastapi import HTTPException, UploadFile
from app.services.storage_service import StorageService


@pytest.fixture
def temp_storage(tmp_path):
    return StorageService(base_path=str(tmp_path))


@pytest.mark.asyncio
async def test_save_evidence_file_computes_correct_sha256(temp_storage):
    content = b"Forensic evidence content sample data 12345"
    expected_hash = "0x" + hashlib.sha256(content).hexdigest()

    upload_file = UploadFile(
        file=io.BytesIO(content),
        filename="crime_scene.jpg",
        headers={"content-type": "image/jpeg"},
    )

    storage_filename, sha256_hex, file_size, mime_type = (
        await temp_storage.save_evidence_file(upload_file)
    )

    assert sha256_hex == expected_hash
    assert file_size == len(content)
    assert mime_type == "image/jpeg"
    assert storage_filename.endswith(".jpg")

    # Verify content read from disk matches
    path = temp_storage.get_file_path(storage_filename)
    assert path.exists()
    assert path.read_bytes() == content


@pytest.mark.asyncio
async def test_empty_file_rejected(temp_storage):
    upload_file = UploadFile(
        file=io.BytesIO(b""),
        filename="empty.txt",
        headers={"content-type": "text/plain"},
    )

    with pytest.raises(HTTPException) as exc_info:
        await temp_storage.save_evidence_file(upload_file)

    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail.lower()


def test_path_traversal_prevention(temp_storage):
    with pytest.raises(HTTPException) as exc_info:
        temp_storage._resolve_safe_path("../secret_file.txt")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        temp_storage._resolve_safe_path("/etc/passwd")
    assert exc_info.value.status_code == 400


def test_calculate_file_sha256_and_delete(temp_storage):
    content = b"Integrity check sample binary data"
    expected_hash = "0x" + hashlib.sha256(content).hexdigest()

    test_file = temp_storage.base_path / "sample.bin"
    test_file.write_bytes(content)

    calc_hash = temp_storage.calculate_file_sha256("sample.bin")
    assert calc_hash == expected_hash

    # Delete
    assert temp_storage.delete_file("sample.bin") is True
    assert not test_file.exists()

