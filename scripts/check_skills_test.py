"""Behavioral checks for the skill registry guard, using disposable directories."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

module_spec = importlib.util.spec_from_file_location("check_skills", Path(__file__).with_name("check-skills.py"))
checker = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(checker)


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="eineiro-skill-registry-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = self.root / ".agents/skills/example"
        self.folder.mkdir(parents=True)
        self.skill = self.folder / "SKILL.md"
        self.skill.write_text("---\nname: example\ndescription: A fixture skill for registry validation.\n---\n# Example\n")
        self.license = self.folder / "LICENSE"
        self.license.write_text("Test-only fixture notice.\n")
        self.entry = {
            "name": "example", "path": ".agents/skills/example", "version": "1.0.0",
            "source": {"repository": "https://example.invalid/fixture"},
            "license_file": ".agents/skills/example/LICENSE",
            "files": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [self.skill, self.license]},
        }
        self.registry = {"schema_version": 1, "skills": [self.entry], "shared_files": {}, "selection_constraints": {}}
        (self.root / "docs").mkdir()
        self.save()

    def save(self):
        (self.root / "docs/skills-lock.json").write_text(json.dumps(self.registry))

    def test_clean_inventory_passes(self):
        self.assertEqual(checker.validate_registry(self.root), [])

    def test_changed_vendored_file_is_rejected(self):
        self.skill.write_text(self.skill.read_text() + "Unexpected modification.\n")
        self.assertTrue(any("hash" in e for e in checker.validate_registry(self.root)))

    def test_unregistered_skill_is_rejected(self):
        extra = self.root / ".agents/skills/unrequested"
        extra.mkdir()
        (extra / "SKILL.md").write_text("---\nname: unrequested\ndescription: Fixture\n---\n")
        self.assertTrue(any("unregistered" in e for e in checker.validate_registry(self.root)))

    def test_duplicate_names_are_rejected(self):
        self.registry["skills"].append(dict(self.entry))
        self.save()
        self.assertTrue(any("duplicate" in e for e in checker.validate_registry(self.root)))

    def test_missing_selection_member_is_rejected(self):
        self.registry["selection_constraints"] = {"https://example.invalid/fixture": ["example", "required"]}
        self.save()
        self.assertTrue(any("selection" in e for e in checker.validate_registry(self.root)))

    def test_extra_selection_member_is_rejected(self):
        self.registry["selection_constraints"] = {"https://example.invalid/fixture": []}
        self.save()
        self.assertTrue(any("selection" in e for e in checker.validate_registry(self.root)))

    def test_path_escape_is_rejected_without_reading_target(self):
        self.entry["files"]["../../../outside"] = "0" * 64
        self.save()
        self.assertTrue(any("unsafe path" in e for e in checker.validate_registry(self.root)))

    def test_symlink_is_rejected(self):
        self.skill.unlink()
        self.skill.symlink_to(self.root / "absent-external-file")
        self.assertTrue(any("symlink" in e for e in checker.validate_registry(self.root)))

    def test_frontmatter_name_must_match_registered_name(self):
        self.skill.write_text(self.skill.read_text().replace("name: example", "name: different"))
        self.entry["files"]["SKILL.md"] = hashlib.sha256(self.skill.read_bytes()).hexdigest()
        self.save()
        self.assertTrue(any("frontmatter" in e for e in checker.validate_registry(self.root)))

    def test_unrecorded_companion_file_is_rejected(self):
        (self.folder / "unreviewed.sh").write_text("exit 0\n")
        self.assertTrue(any("unrecorded" in e for e in checker.validate_registry(self.root)))


if __name__ == "__main__":
    unittest.main()
