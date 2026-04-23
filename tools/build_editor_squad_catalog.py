#!/usr/bin/env python3
"""Generate richer vanilla squad catalog data for editor pickers.

Refresh with:
    python tools/build_editor_squad_catalog.py
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from build_treasure_possible_items import parse_ltx_sections, resolve_key

REPO_ROOT = Path(__file__).resolve().parents[1]
VANILLA_ROOT = REPO_ROOT / "Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)" / "vanilla configs (for reference only)"
SQUAD_ROOT = VANILLA_ROOT / "misc" / "squad_descr"
OUTPUT_PATH = REPO_ROOT / "tools" / "editor" / "src" / "lib" / "generated" / "squad-catalog.ts"

SIZE_RE = re.compile(r"^\s*(\d+)\s*(?:,\s*(\d+))?\s*$")

SOURCE_LABELS: dict[str, str] = {
    "squad_descr": "Core",
    "default_stalkers": "Default stalkers",
    "default_mutants": "Default mutants",
    "defense": "Defense",
    "special": "Special",
    "lostzone": "Lost Zone",
    "lostzone_hb": "Lost Zone HB",
    "lostzone_ll": "Lost Zone LL",
    "lostzone_ms": "Lost Zone MS",
    "lostzone_oa": "Lost Zone OA",
}

FACTION_LABELS: dict[str, str] = {
    "army_npc": "army",
    "greh_npc": "greh",
    "monster": "monster",
    "monster_predatory_day": "predatory",
    "monster_predatory_night": "predatory",
    "monster_vegetarian": "vegetarian",
    "monster_special": "special mutant",
    "monster_zombied_day": "zombied",
    "monster_zombied_night": "zombied",
}


@dataclass(frozen=True)
class SquadEntry:
    value: str
    label: str
    keywords: tuple[str, ...]
    faction: str
    kind: str
    source: str
    size: str
    common: bool


def normalize_spaces(value: str) -> str:
    return " ".join(value.replace("\t", " ").replace("_", " ").split())


def source_key_from_path(path: Path) -> str:
    stem = path.stem
    if stem == "squad_descr":
        return stem
    if stem.startswith("squad_descr_"):
        return stem.removeprefix("squad_descr_")
    return stem


def source_label(source_key: str) -> str:
    if source_key in SOURCE_LABELS:
        return SOURCE_LABELS[source_key]
    return source_key.replace("_", " ").title()


def faction_label(raw: str) -> str:
    value = raw.strip().lower()
    return FACTION_LABELS.get(value, value or "unknown")


def infer_kind(raw_faction: str, section: str, source_key: str) -> str:
    faction = raw_faction.strip().lower()
    section_lower = section.lower()
    if source_key == "default_mutants" or faction.startswith("monster"):
        return "Mutant"
    if (
        "mutant" in source_key
        or section_lower.startswith("simulation_")
        or any(
            token in section_lower
            for token in (
                "boar",
                "dog",
                "snork",
                "chimera",
                "bloodsucker",
                "zombie",
                "tushkano",
                "rat",
                "flesh",
                "burer",
                "controller",
                "cat",
                "fracture",
                "lurker",
                "pseudodog",
                "giant",
                "poltergeist",
            )
        )
    ):
        return "Mutant"
    return "NPC"


def format_size(size_raw: str | None) -> str:
    if not size_raw:
        return ""
    match = SIZE_RE.match(size_raw)
    if not match:
        return size_raw.strip()
    low = match.group(1)
    high = match.group(2)
    if not high or high == low:
        return low
    return f"{low}-{high}"


def build_entry(section: str, source_key: str, sections: dict[str, dict[str, str | list[str]]]) -> SquadEntry:
    raw_faction = resolve_key(sections, section, "faction") or "unknown"
    faction = faction_label(raw_faction)
    size = format_size(resolve_key(sections, section, "npc_in_squad"))
    kind = infer_kind(raw_faction, section, source_key)
    source = source_label(source_key)
    common_flag = (resolve_key(sections, section, "common") or "").strip().lower() == "true"

    label_bits = [section, f"{kind.lower()} | {faction}", source]
    if size:
        label_bits.append(f"squad {size}")
    if common_flag:
        label_bits.append("common")
    label = " - ".join([label_bits[0], " | ".join(label_bits[1:])])

    keywords = [
        section,
        normalize_spaces(section),
        kind.lower(),
        faction,
        source.lower(),
    ]
    if size:
        keywords.extend([size, f"squad {size}"])
    if common_flag:
        keywords.append("common")

    return SquadEntry(
        value=section,
        label=label,
        keywords=tuple(dict.fromkeys(keyword for keyword in keywords if keyword)),
        faction=faction,
        kind=kind,
        source=source,
        size=size,
        common=common_flag,
    )


def load_entries() -> tuple[list[SquadEntry], list[SquadEntry]]:
    npc_entries: list[SquadEntry] = []
    mutant_entries: list[SquadEntry] = []

    for path in sorted(SQUAD_ROOT.glob("*.ltx")):
        source_key = source_key_from_path(path)
        sections = parse_ltx_sections(path)
        for section in sorted(sections):
            entry = build_entry(section, source_key, sections)
            if entry.kind == "Mutant":
                mutant_entries.append(entry)
            else:
                npc_entries.append(entry)

    npc_entries.sort(key=lambda entry: entry.value)
    mutant_entries.sort(key=lambda entry: entry.value)
    return npc_entries, mutant_entries


def render_entry(entry: SquadEntry) -> str:
    return (
        "  {"
        f" value: {entry.value!r},"
        f" label: {entry.label!r},"
        f" keywords: {list(entry.keywords)!r},"
        f" faction: {entry.faction!r},"
        f" kind: {entry.kind!r},"
        f" source: {entry.source!r},"
        f" size: {entry.size!r},"
        f" common: {'true' if entry.common else 'false'},"
        " },"
    )


def render_ts(npc_entries: list[SquadEntry], mutant_entries: list[SquadEntry]) -> str:
    all_entries = npc_entries + mutant_entries
    body_npc = "\n".join(render_entry(entry) for entry in npc_entries)
    body_mutant = "\n".join(render_entry(entry) for entry in mutant_entries)
    body_all = "\n".join(render_entry(entry) for entry in all_entries)
    return f"""// Auto-generated from Anomaly misc/squad_descr/*.ltx reference data.
// Provides searchable squad-section options for editor pickers.
// Refresh with `python tools/build_editor_squad_catalog.py`.
// Do not edit by hand.

export interface SquadCatalogOption {{
  value: string;
  label: string;
  keywords: string[];
  faction: string;
  kind: string;
  source: string;
  size: string;
  common: boolean;
}}

export const NPC_SQUAD_OPTIONS: SquadCatalogOption[] = [
{body_npc}
];

export const MUTANT_SQUAD_OPTIONS: SquadCatalogOption[] = [
{body_mutant}
];

export const ALL_SQUAD_OPTIONS: SquadCatalogOption[] = [
{body_all}
];
"""


def main() -> None:
    npc_entries, mutant_entries = load_entries()
    OUTPUT_PATH.write_text(render_ts(npc_entries, mutant_entries), encoding="utf-8")
    print(
        f"Wrote {len(npc_entries)} NPC squads and {len(mutant_entries)} mutant squads "
        f"to {OUTPUT_PATH.relative_to(REPO_ROOT)}"
    )


if __name__ == "__main__":
    main()
