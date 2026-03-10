#!/usr/bin/env python3
"""Lightweight integrity checks for this Anomaly mod workspace."""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
GAME_DATA = ROOT / "P.A.N.D.A DEV" / "gamedata"


@dataclass
class Issue:
    kind: str
    path: Path
    message: str


def iter_files(base: Path, pattern: str):
    yield from base.rglob(pattern)


def check_xml(files: list[Path]) -> list[Issue]:
    issues: list[Issue] = []
    for path in files:
        try:
            ET.parse(path)
        except ET.ParseError as exc:
            issues.append(Issue("error", path, f"xml parse failure: {exc}"))
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
