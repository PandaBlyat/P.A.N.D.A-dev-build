#!/usr/bin/env python3
"""Generate detector-tier options derived from vanilla detector configs."""
from __future__ import annotations

from pathlib import Path
import re

from build_treasure_possible_items import collect_sections_from_root, resolve_key

REPO_ROOT = Path(__file__).resolve().parents[1]
VANILLA_ROOT = REPO_ROOT / "Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)" / "vanilla configs (for reference only)"
ITEMS_ROOT = VANILLA_ROOT / "items"
TEXT_ROOT = VANILLA_ROOT / "text" / "eng"
OUTPUT_PATH = REPO_ROOT / "tools" / "editor" / "src" / "lib" / "generated" / "detector-tier-catalog.ts"

STRING_RE = re.compile(r"<string\s+id=\"([^\"]+)\"[^>]*>\s*<text>(.*?)</text>\s*</string>", re.DOTALL)

DETECTOR_SECTIONS = [
    ("basic", "detector_simple"),
    ("advanced", "detector_advanced"),
    ("elite", "detector_elite"),
    ("scientific", "detector_scientific"),
]


def normalize_text(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def load_string_table() -> dict[str, str]:
    strings: dict[str, str] = {}
    for path in sorted(TEXT_ROOT.glob("*.xml")):
        text = path.read_text(encoding="windows-1251", errors="ignore")
        for match in STRING_RE.finditer(text):
            key = match.group(1).strip()
            value = normalize_text(match.group(2).strip())
            if key and value and key not in strings:
                strings[key] = value
    return strings


def build_entries() -> list[tuple[str, str, list[str]]]:
    sections = collect_sections_from_root(ITEMS_ROOT)
    strings = load_string_table()
    entries: list[tuple[str, str, list[str]]] = []
    for tier_key, section_id in DETECTOR_SECTIONS:
        inv_name_key = (resolve_key(sections, section_id, "inv_name") or "").strip().strip('"')
        display_name = strings.get(inv_name_key, section_id.replace("_", " ").title())
        tier_value = (resolve_key(sections, section_id, "tier") or "").strip()
        label = f"{display_name} ({tier_key})"
        keywords = [tier_key, section_id, display_name, inv_name_key]
        if tier_value:
            keywords.extend([tier_value, f"tier {tier_value}"])
        entries.append((tier_key, label, [keyword for keyword in keywords if keyword]))
    return entries


def render_ts(entries: list[tuple[str, str, list[str]]]) -> str:
    body = "\n".join(
        f"  {{ value: {value!r}, label: {label!r}, keywords: {keywords!r} }},"
        for value, label, keywords in entries
    )
    return f"""// Auto-generated detector-tier options.
// Source: items/items/items_devices.ltx + text/eng string tables.
// Refresh with `python tools/build_editor_detector_tier_catalog.py`.
// Do not edit by hand.

import type {{ ParamOption }} from '../schema';

export const DETECTOR_TIER_OPTIONS: ParamOption[] = [
{body}
];
"""


def main() -> None:
    entries = build_entries()
    OUTPUT_PATH.write_text(render_ts(entries), encoding="utf-8")
    print(f"Wrote {len(entries)} detector tiers to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
