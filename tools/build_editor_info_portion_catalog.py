#!/usr/bin/env python3
"""Generate searchable info-portion options for editor pickers."""
from __future__ import annotations

from pathlib import Path
import re

REPO_ROOT = Path(__file__).resolve().parents[1]
VANILLA_ROOT = REPO_ROOT / "Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)" / "vanilla configs (for reference only)"
INFO_PORTIONS_XML = VANILLA_ROOT / "gameplay" / "info_portions.xml"
OUTPUT_PATH = REPO_ROOT / "tools" / "editor" / "src" / "lib" / "generated" / "info-portion-catalog.ts"

INFO_RE = re.compile(r"<info_portion\s+id=\"([^\"]+)\"", re.IGNORECASE)


def classify_info_portion(info_id: str) -> tuple[str, list[str]]:
    if info_id.startswith("drx_sl_"):
        return "Main Story Info", ["main story", "storyline", "living legend", "mortal sin", "operation afterglow"]
    if any(token in info_id for token in ("wish_granter", "monolith", "radar", "x16", "x18", "sarcofag")):
        return "Story Info", ["main story", "storyline"]
    return "Info Portion", ["story flag"]


def build_entries() -> list[tuple[str, str, list[str]]]:
    text = INFO_PORTIONS_XML.read_text(encoding="windows-1251", errors="ignore")
    entries: list[tuple[str, str, list[str]]] = []
    for match in INFO_RE.finditer(text):
        info_id = match.group(1).strip()
        if not info_id:
            continue
        kind, extra_keywords = classify_info_portion(info_id)
        label = f"{info_id} - {kind}"
        keywords = [info_id, info_id.replace("_", " "), "info portion", *extra_keywords]
        entries.append((info_id, label, keywords))
    entries.sort(key=lambda entry: entry[0])
    return entries


def render_ts(entries: list[tuple[str, str, list[str]]]) -> str:
    body = "\n".join(
        f"  {{ value: {value!r}, label: {label!r}, keywords: {keywords!r} }},"
        for value, label, keywords in entries
    )
    return f"""// Auto-generated vanilla info-portion options.
// Source: gameplay/info_portions.xml.
// Refresh with `python tools/build_editor_info_portion_catalog.py`.
// Do not edit by hand.

import type {{ ParamOption }} from '../schema';

export const VANILLA_INFO_PORTION_OPTIONS: ParamOption[] = [
{body}
];
"""


def main() -> None:
    entries = build_entries()
    OUTPUT_PATH.write_text(render_ts(entries), encoding="utf-8")
    print(f"Wrote {len(entries)} info portions to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
