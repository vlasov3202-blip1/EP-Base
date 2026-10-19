#!/usr/bin/env python3
"""Validate the project-local skill inventory without network or database access."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re


def safe_path(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError(f"unsafe path: {relative!r}")
    parts = PurePosixPath(relative)
    if parts.is_absolute() or ".." in parts.parts:
        raise ValueError(f"unsafe path: {relative}")
    current = root
    for part in parts.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"symlink is not allowed: {relative}")
    return current


def validate_registry(root):
    root = Path(root).resolve()
    errors = []

    def error(message):
        errors.append(str(message))

    def verify_file(relative, digest=None):
        try:
            path = safe_path(root, relative)
            if not path.is_file():
                raise ValueError(f"missing file: {relative}")
            if digest is not None and hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise ValueError(f"hash mismatch: {relative}")
            return path
        except (ValueError, OSError) as exc:
            error(exc)
            return None

    try:
        registry = json.loads(safe_path(root, "docs/skills-lock.json").read_text())
        if registry.get("schema_version") != 1 or not isinstance(registry.get("skills"), list):
            raise ValueError("invalid registry schema")
    except (ValueError, OSError) as exc:
        return [str(exc)]

    names = set()
    paths = set()
    for skill in registry["skills"]:
        name = skill.get("name", "")
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", name):
            error(f"invalid skill name: {name!r}")
            continue
        if name in names:
            error(f"duplicate skill: {name}")
        names.add(name)
        relative = skill.get("path")
        if relative != f".agents/skills/{name}":
            error(f"unsafe path or name/path mismatch: {relative!r}")
            continue
        try:
            directory = safe_path(root, relative)
        except ValueError as exc:
            error(exc)
            continue
        paths.add(relative + "/SKILL.md")
        files = skill.get("files", {})
        if not files or "SKILL.md" not in files:
            error(f"missing file inventory: {name}")
        for filename, digest in files.items():
            verify_file(f"{relative}/{filename}", digest)
        actual = {str(p.relative_to(directory)) for p in directory.rglob("*") if p.is_file() or p.is_symlink()}
        for filename in sorted(actual - set(files)):
            error(f"unrecorded file: {relative}/{filename}")
        skill_file = verify_file(relative + "/SKILL.md")
        if skill_file:
            content = skill_file.read_text()
            blocks = content.split("---", 2)
            if len(blocks) != 3 or blocks[0].strip():
                error(f"invalid frontmatter: {name}")
            else:
                match = re.search(r"(?m)^name:\s*(?:\"([^\"]+)\"|'([^']+)'|([a-z0-9-]+))\s*$", blocks[1])
                parsed_name = next((value for value in match.groups() if value), None) if match else None
                if parsed_name != name or not re.search(r"(?m)^description:\s*\S", blocks[1]):
                    error(f"frontmatter name/description mismatch: {name}")
        notice = skill.get("license_file") or skill.get("notice_file")
        if notice:
            verify_file(notice)
        else:
            error(f"missing license/notice location: {name}")
        if not skill.get("version"):
            error(f"missing version: {name}")
        source = skill.get("source", {})
        if source.get("kind") in {"git", "generated"} and not re.fullmatch(r"[0-9a-f]{40}", source.get("commit", "")):
            error(f"unpinned source: {name}")

    discovered = {str(p.relative_to(root)) for p in (root / ".agents/skills").rglob("SKILL.md")}
    for path in sorted(discovered - paths):
        error(f"unregistered skill: {path}")
    for relative, digest in registry.get("shared_files", {}).items():
        verify_file(relative, digest)
    for repository, expected in registry.get("selection_constraints", {}).items():
        actual = {s["name"] for s in registry["skills"] if s.get("source", {}).get("repository") == repository}
        if actual != set(expected):
            error(f"selection mismatch for {repository}: expected {sorted(expected)}, got {sorted(actual)}")
    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    failures = validate_registry(args.root)
    if args.json:
        print(json.dumps({"status": "FAIL" if failures else "PASS", "errors": failures}, ensure_ascii=False, indent=2))
    elif failures:
        print("\n".join(failures))
    else:
        print("PASS: skill inventory, pinned hashes, names, notices and selection constraints")
    raise SystemExit(bool(failures))
