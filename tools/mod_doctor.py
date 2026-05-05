#!/usr/bin/env python3
"""Lightweight integrity checks for this Anomaly mod workspace."""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
GAME_DATA = ROOT / "P.A.N.D.A DEV" / "gamedata"
FRAGMENT_XML_FILES = {
    Path("configs/gameplay/character_dialogs.xml"),
}
STRING_ID_RE = re.compile(r'<string\s+id="([^"]+)"')
PLACEHOLDER_TEXT_RE = re.compile(r"^(test|todo|fixme|tbd|placeholder|lorem ipsum\b|\[MISSING_[A-Z0-9_]+\])$", re.IGNORECASE)


@dataclass
class Issue:
    kind: str
    path: Path
    message: str


def iter_files(base: Path, pattern: str):
    yield from base.rglob(pattern)


def rel_to_gamedata(path: Path) -> Path:
    return path.relative_to(GAME_DATA)


def read_xml_text(path: Path) -> str:
    data = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def parse_xml(path: Path) -> tuple[ET.Element | None, str | None]:
    text = read_xml_text(path)
    try:
        return ET.fromstring(text), None
    except ET.ParseError as exc:
        if rel_to_gamedata(path) not in FRAGMENT_XML_FILES:
            return None, f"xml parse failure: {exc}"
        try:
            return ET.fromstring(f"<panda_fragment_root>\n{text}\n</panda_fragment_root>"), None
        except ET.ParseError as wrapped_exc:
            return None, f"xml fragment parse failure: {wrapped_exc}"


def check_duplicate_string_ids(path: Path, raw_text: str) -> list[Issue]:
    issues: list[Issue] = []
    seen: set[str] = set()
    duplicates: set[str] = set()
    for match in STRING_ID_RE.finditer(raw_text):
        string_id = match.group(1)
        if string_id in seen:
            duplicates.add(string_id)
        seen.add(string_id)
    for string_id in sorted(duplicates):
        issues.append(Issue("warning", path, f'duplicate string id "{string_id}"'))
    return issues


def check_string_text(root: ET.Element, path: Path) -> list[Issue]:
    issues: list[Issue] = []
    for string_el in root.iter("string"):
        string_id = string_el.attrib.get("id", "<missing id>")
        text_el = string_el.find("text")
        if text_el is None:
            issues.append(Issue("error", path, f'string "{string_id}" missing <text> element'))
            continue

        value = "".join(text_el.itertext()).strip()
        if not value:
            issues.append(Issue("error", path, f'string "{string_id}" has empty text'))
            continue

        if PLACEHOLDER_TEXT_RE.match(value):
            issues.append(Issue("error", path, f'string "{string_id}" contains placeholder text "{value}"'))
    return issues


def check_xml(files: list[Path]) -> list[Issue]:
    issues: list[Issue] = []
    for path in files:
        raw_text = read_xml_text(path)
        root, error = parse_xml(path)
        if error:
            issues.append(Issue("error", path, error))
            continue
        if root is None:
            continue
        issues.extend(check_duplicate_string_ids(path, raw_text))
        issues.extend(check_string_text(root, path))
    return issues


def print_issues(issues: list[Issue], limit: int) -> tuple[int, int]:
    errors = sum(1 for i in issues if i.kind == "error")
    warnings = sum(1 for i in issues if i.kind == "warning")

    if not issues:
        print("mod_doctor: no issues found")
        return errors, warnings

    shown = issues[:limit] if limit > 0 else issues
    for issue in shown:
        rel = issue.path.relative_to(ROOT)
        print(f"[{issue.kind.upper()}] {rel}: {issue.message}")

    if limit > 0 and len(issues) > len(shown):
        print(f"... {len(issues) - len(shown)} additional issue(s) hidden (increase --limit to see more)")

    print(f"mod_doctor: {errors} error(s), {warnings} warning(s)")
    return errors, warnings


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--strict", action="store_true", help="exit non-zero when errors are found")
    p.add_argument("--limit", type=int, default=50, help="max issues to print (0 = all)")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    if not GAME_DATA.exists():
        print(f"expected gamedata at: {GAME_DATA}")
        return 2

    xml_files = sorted(iter_files(GAME_DATA / "configs", "*.xml"))
    issues = check_xml(xml_files)
    errors, _warnings = print_issues(issues, args.limit)

    if args.strict and errors:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
