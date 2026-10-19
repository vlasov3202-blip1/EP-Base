#!/usr/bin/env bash
# Validate existing vendored skills; never install tools or change the Codex profile.
set -euo pipefail
skill_repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd -- "$skill_repo_root"
python3 scripts/check-skills.py
python3 - <<'PY'
import json
from pathlib import Path

registry = json.loads(Path("docs/skills-lock.json").read_text())
print(f"Verified {len(registry['skills'])} project skills in {Path('.agents/skills').resolve()}")
print("Integrity verified; native Codex discovery and new-session application are separate checks.")
print("Start sessions in this repository; read AGENTS.md and docs/CLOUD_SKILLS.md.")
PY
