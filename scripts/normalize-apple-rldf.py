#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyarrow>=19,<24"]
# ///
"""Create bounded private local-evaluator records from verified Apple ML-RLDF Arrow files.

Run via ``uv run scripts/normalize-apple-rldf.py --help``.  This is an
operator-side transformation: source Arrow files are checked against the
acquisition receipt and never modified; copied image payloads and JSON records
remain under ignored ``evaluation/`` with 0700/0600 permissions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

import pyarrow as pa

MAX_LIMIT = 20
MAX_IMAGE_BYTES = 20 * 1024 * 1024
REVISION = "be0d7f816ded6fa5111035f34f69b077072ba9a3"
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ARROWS = {
    "ranking": "arrow/ranking_training_dataset_hf.arrow",
    "revision": "arrow/revision_training_dataset_hf.arrow",
}


class NormalizationError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise NormalizationError(message)


def private_directory(path: Path, *, create: bool) -> Path:
    path = path.resolve()
    if path == Path(path.anchor):
        fail("private directory must not be a filesystem root")
    if create:
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        fail("private directory must be a real directory")
    os.chmod(path, 0o700)
    if stat.S_IMODE(path.stat().st_mode) != 0o700:
        fail("private directory must have mode 0700")
    return path.resolve()


def ignored_repository_output(path: Path) -> Path:
    output = path.resolve()
    try:
        output.relative_to(REPOSITORY_ROOT)
    except ValueError:
        return output
    evaluation = (REPOSITORY_ROOT / "evaluation").resolve()
    try:
        output.relative_to(evaluation)
    except ValueError:
        fail("repository-internal normalization output must be below ignored evaluation/")
    return output


def private_file(path: Path, *, maximum_bytes: int) -> Path:
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode) or info.st_size < 1 or info.st_size > maximum_bytes:
        fail(f"{path.name} must be a private regular file within its size limit")
    if stat.S_IMODE(info.st_mode) & 0o077:
        fail(f"{path.name} must not be group/world accessible")
    return path.resolve()


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()


def read_receipt(path: Path, cache: Path) -> dict[str, dict[str, Any]]:
    receipt_path = private_file(path, maximum_bytes=1024 * 1024)
    try:
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise NormalizationError("Apple RLDF acquisition receipt was not valid JSON") from error
    if receipt.get("key") != "apple-rldf" or receipt.get("status") != "available":
        fail("acquisition receipt must describe an available apple-rldf cache")
    if receipt.get("provenance", {}).get("revision") != REVISION:
        fail("acquisition receipt did not retain the pinned Apple ML-RLDF revision")
    artifacts = {entry.get("path"): entry for entry in receipt.get("artifacts", []) if isinstance(entry, dict)}
    for relative in ARROWS.values():
        artifact = artifacts.get(relative)
        if not isinstance(artifact, dict) or not isinstance(artifact.get("sha256"), str):
            fail(f"acquisition receipt lacks verified {relative}")
        target = (cache / relative).resolve()
        if cache not in target.parents or target.parent != (cache / "arrow").resolve():
            fail("verified Arrow artifact escaped cache")
        private_file(target, maximum_bytes=256 * 1024 * 1024)
        if digest(target) != artifact["sha256"]:
            fail(f"verified Arrow artifact hash mismatch: {relative}")
    return artifacts


def image_bytes(value: Any, subject: str) -> tuple[bytes, str]:
    # Hugging Face Image extension values arrive as {bytes, path}; accept only
    # embedded bytes so this normalizer cannot follow a dataset-provided path.
    if not isinstance(value, dict) or not isinstance(value.get("bytes"), (bytes, bytearray)):
        fail(f"{subject} must have embedded image bytes")
    raw = bytes(value["bytes"])
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        fail(f"{subject} exceeds the image safety limit")
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return raw, ".png"
    if raw.startswith(b"\xff\xd8\xff"):
        return raw, ".jpg"
    if raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        return raw, ".webp"
    fail(f"{subject} was not a PNG, JPEG, or WebP image")


def copy_new(destination: Path, raw: bytes) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(destination.parent, 0o700)
    expected = hashlib.sha256(raw).hexdigest()
    try:
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        private_file(destination, maximum_bytes=MAX_IMAGE_BYTES)
        if digest(destination) != expected:
            fail(f"refusing to overwrite conflicting local image: {destination.name}")
    else:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(raw)
    return {"path": str(destination), "bytes": len(raw), "sha256": expected}


def table_rows(kind: str, arrow: Path) -> tuple[list[dict[str, Any]], str]:
    try:
        with pa.memory_map(str(arrow), "r") as source:
            try:
                table = pa.ipc.open_file(source).read_all()
            except pa.ArrowInvalid:
                source.seek(0)
                table = pa.ipc.open_stream(source).read_all()
    except Exception as error:  # Arrow's exception taxonomy changes by version.
        raise NormalizationError(f"could not read verified {kind} Arrow IPC file") from error
    expected = (
        {"userid", "screenid", "description", "chosen_image", "rejected_image", "chosen_html", "rejected_html"}
        if kind == "ranking"
        else {"userid", "description", "chosen_image", "rejected_image"}
    )
    if set(table.column_names) != expected:
        fail(f"{kind} Arrow schema did not match the documented ML-RLDF columns")
    return table.to_pylist(), str(table.schema)


def stable_key(kind: str, row: dict[str, Any]) -> str:
    text = "\0".join([kind, str(row.get("userid", "")), str(row.get("screenid", "")), str(row.get("description", ""))])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def make_records(cache: Path, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    candidates: list[tuple[str, str, dict[str, Any]]] = []
    schemas: dict[str, str] = {}
    counts: dict[str, int] = {}
    for kind, relative in ARROWS.items():
        rows, schema = table_rows(kind, cache / relative)
        schemas[kind] = schema
        counts[kind] = len(rows)
        candidates.extend((stable_key(kind, row), kind, row) for row in rows)
    records: list[dict[str, Any]] = []
    image_artifacts: list[dict[str, Any]] = []
    for key, kind, row in sorted(candidates, key=lambda value: value[0]):
        if len(records) == limit:
            break
        if not all(isinstance(row.get(field), str) and row[field].strip() for field in ("userid", "description")):
            continue
        if kind == "ranking" and not all(isinstance(row.get(field), str) and row[field].strip() for field in ("screenid", "chosen_html", "rejected_html")):
            continue
        chosen, chosen_extension = image_bytes(row.get("chosen_image"), f"{kind}.chosen_image")
        rejected, rejected_extension = image_bytes(row.get("rejected_image"), f"{kind}.rejected_image")
        images = cache / "images" / key
        chosen_artifact = copy_new(images / f"chosen{chosen_extension}", chosen)
        rejected_artifact = copy_new(images / f"rejected{rejected_extension}", rejected)
        record: dict[str, Any] = {
            "kind": kind, "userid": row["userid"], "description": row["description"],
            "chosen_image": {"path": chosen_artifact["path"]}, "rejected_image": {"path": rejected_artifact["path"]},
        }
        if kind == "ranking":
            record.update({"screenid": row["screenid"], "chosen_html": row["chosen_html"], "rejected_html": row["rejected_html"]})
        records.append(record)
        image_artifacts.extend([chosen_artifact, rejected_artifact])
    if not records:
        fail("no valid Apple ML-RLDF rows could be normalized")
    return records, {
        "sourceRows": counts, "schemas": schemas, "selected": len(records),
        "selectedKinds": dict(Counter(record["kind"] for record in records)),
        "labelDistribution": {"chosen": len(records), "rejected": len(records)}, "images": image_artifacts,
    }


def write_new_json(path: Path, value: Any) -> None:
    payload = (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as error:
        raise NormalizationError(f"refusing to overwrite existing output: {path.name}") from error
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquisition", required=True, type=Path)
    parser.add_argument("--cache-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    if args.limit < 1 or args.limit > MAX_LIMIT:
        fail(f"--limit must be a whole number from 1 to {MAX_LIMIT}")
    cache = private_directory(args.cache_dir, create=False)
    output_parent = private_directory(ignored_repository_output(args.output_dir), create=True)
    artifacts = read_receipt(args.acquisition, cache)
    records, report = make_records(cache, args.limit)
    output = output_parent / f"apple-rldf-normalized-{uuid.uuid4()}"
    output.mkdir(mode=0o700)
    records_path = output / "apple-rldf-records-v1.json"
    write_new_json(records_path, records)
    image_artifacts = report.pop("images")
    write_new_json(output / "apple-rldf-normalization-v1.json", {
        "version": 1, "key": "apple-rldf", "revision": REVISION, "normalizer": "normalize-apple-rldf.py",
        "acquisition": {"path": str(args.acquisition.resolve()), "sha256": digest(args.acquisition.resolve())},
        "arrowArtifacts": [{"path": relative, "sha256": artifacts[relative]["sha256"]} for relative in sorted(ARROWS.values())],
        "records": {"path": records_path.name, "sha256": digest(records_path)},
        "images": image_artifacts, **report,
    })
    print(json.dumps({"version": 1, "mode": "normalized", "outputDirectory": str(output), "selected": len(records), "sourceRows": report["sourceRows"], "selectedKinds": report["selectedKinds"]}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except NormalizationError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
