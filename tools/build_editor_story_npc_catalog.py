#!/usr/bin/env python3
"""Generate the editor's bundled vanilla story NPC catalog.

Parses every ``character_desc_<level>.xml`` in the bundled Anomaly reference
resources (the ``_general_*`` files are sim templates, not story NPCs, and are
skipped). For every ``<specific_character>`` that represents a unique story
profile, the script resolves its display name from ``text/eng/*.xml``, infers
the level and role, and emits a searchable option for the editor.

The generated file feeds the "Browse story NPCs" panel. Contributors refresh
it with ``python tools/build_editor_story_npc_catalog.py`` after updating
the vanilla reference resources.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
VANILLA_ROOT = (
    REPO_ROOT
    / "Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)"
    / "vanilla configs (for reference only)"
)
GAMEPLAY_ROOT = VANILLA_ROOT / "gameplay"
ENG_ROOT = VANILLA_ROOT / "text" / "eng"
OUTPUT_PATH = (
    REPO_ROOT
    / "tools"
    / "editor"
    / "src"
    / "lib"
    / "generated"
    / "story-npc-catalog.ts"
)

# Filename stem → human-friendly level label. Level files missing here fall
# back to a title-cased version of the stem.
LEVEL_LABELS: dict[str, str] = {
    "agroprom": "Agroprom",
    "agroprom_underground": "Agroprom Underground",
    "bar": "Rostok",
    "darkscape": "Darkscape",
    "darkvalley": "Dark Valley",
    "deadcity": "Dead City",
    "escape": "Cordon",
    "garbage": "Garbage",
    "jupiter": "Jupiter",
    "katacomb": "Katacomb",
    "lostzone_hb": "Lost Zone · Hanging Bridge",
    "lostzone_ll": "Lost Zone · Limansk",
    "lostzone_ms": "Lost Zone · Marshes",
    "lostzone_oa": "Lost Zone · Outpost",
    "marsh": "Great Swamp",
    "military": "Army Warehouses",
    "pripyat": "Pripyat",
    "red_forest": "Red Forest",
    "sarcofag": "Sarcophagus",
    "truck": "Truck Cemetery",
    "underpass": "Underpass",
    "warlab": "Warlab",
    "yantar": "Yantar",
    "zaton": "Zaton",
}

# Heuristics used to derive a searchable role label from a character id/class
# when the community alone is too coarse. Ordered by specificity — first match
# wins.
ROLE_RULES: list[tuple[str, str]] = [
    ("arena_manager", "Arena Manager"),
    ("arena_guard", "Guard"),
    ("barman", "Barkeeper"),
    ("barmen", "Barkeeper"),
    ("sakharov", "Scientist"),
    ("sci_head", "Scientist"),
    ("scientist", "Scientist"),
    ("ecolog", "Scientist"),
    ("general", "Leader"),
    ("leader", "Leader"),
    ("commander", "Commander"),
    ("captain", "Commander"),
    ("colonel", "Leader"),
    ("chief", "Leader"),
    ("lieutenant", "Officer"),
    ("medik", "Medic"),
    ("medic", "Medic"),
    ("doctor", "Medic"),
    ("doc", "Medic"),
    ("mechanic", "Mechanic"),
    ("mech", "Mechanic"),
    ("tech", "Mechanic"),
    ("trader", "Trader"),
    ("informator", "Informant"),
    ("informant", "Informant"),
    ("guide", "Guide"),
    ("navigator", "Guide"),
    ("locman", "Guide"),
    ("cashier", "Trader"),
    ("dealer", "Trader"),
    ("broker", "Trader"),
    ("guard", "Guard"),
    ("sniper", "Guard"),
    ("cook", "Cook"),
    ("povar", "Cook"),
    ("prisoner", "Named Stalker"),
    ("priest", "Priest"),
    ("veteran", "Named Stalker"),
    ("assault", "Named Stalker"),
]

# Community → pretty faction label shown in the UI (matches the existing
# chip styling conventions).
FACTION_LABELS: dict[str, str] = {
    "stalker": "stalker",
    "bandit": "bandit",
    "army": "army",
    "army_npc": "army",
    "military": "military",
    "dolg": "dolg",
    "freedom": "freedom",
    "csky": "csky",
    "ecolog": "ecolog",
    "greh": "greh",
    "isg": "isg",
    "killer": "killer",
    "monolith": "monolith",
    "renegade": "renegade",
    "trader": "trader",
    "zombied": "zombied",
    "pseudodog": "pseudodog",
    "unknown": "Unknown",
}

# Prefixes that indicate a non-unique template profile (simulation squad
# members, phantom spawns, etc.) — these should not appear in the story
# picker.
SIM_PROFILE_PREFIXES: tuple[str, ...] = (
    "sim_default_",
    "sim_stalker_",
    "sim_stalker_regular",
)

SPECIFIC_CHAR_RE = re.compile(
    r"<specific_character\s+id=\"([^\"]+)\"[^>]*>(.*?)</specific_character>",
    re.DOTALL,
)
TAG_RE = re.compile(
    r"<(name|community|class|icon|bio|terrain_sect)>\s*([^<]*?)\s*</\1>",
    re.IGNORECASE,
)
STRING_RE = re.compile(
    r"<string\s+id=\"([^\"]+)\"[^>]*>\s*<text>(.*?)</text>\s*</string>",
    re.DOTALL,
)


@dataclass
class StoryNpc:
    profile_id: str
    level_key: str
    community: str
    klass: str
    name_key: str
    character_name: str = ""
    role: str = ""
    keywords: list[str] = field(default_factory=list)


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8", "windows-1251", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def load_string_table() -> dict[str, str]:
    table: dict[str, str] = {}
    if not ENG_ROOT.exists():
        return table
    for path in sorted(ENG_ROOT.glob("*.xml")):
        text = read_text(path)
        for match in STRING_RE.finditer(text):
            key = match.group(1).strip()
            value = re.sub(r"\s+", " ", match.group(2)).strip()
            if key and value and key not in table:
                table[key] = value
    return table


def iter_character_desc_files() -> Iterable[Path]:
    if not GAMEPLAY_ROOT.exists():
        return []
    out: list[Path] = []
    for path in sorted(GAMEPLAY_ROOT.glob("character_desc_*.xml")):
        if path.stem.startswith("character_desc_general"):
            # character_desc_general_* contain sim templates, not story NPCs.
            continue
        out.append(path)
    return out


def parse_character_desc_file(path: Path, string_table: dict[str, str]) -> list[StoryNpc]:
    level_key = path.stem[len("character_desc_"):]
    text = read_text(path)
    results: list[StoryNpc] = []
    for match in SPECIFIC_CHAR_RE.finditer(text):
        profile_id = match.group(1).strip()
        body = match.group(2)
        if not profile_id or profile_id.startswith(SIM_PROFILE_PREFIXES):
            continue
        fields = {tag.lower(): value for tag, value in TAG_RE.findall(body)}
        name_key = fields.get("name", "").strip()
        community = fields.get("community", "").strip().lower()
        klass = fields.get("class", "").strip()
        character_name = resolve_character_name(name_key, string_table)
        results.append(
            StoryNpc(
                profile_id=profile_id,
                level_key=level_key,
                community=community,
                klass=klass,
                name_key=name_key,
                character_name=character_name,
            )
        )
    return results


def resolve_character_name(name_key: str, string_table: dict[str, str]) -> str:
    if not name_key:
        return ""
    if name_key.startswith("GENERATE_NAME"):
        return ""
    return string_table.get(name_key, "").strip()


def infer_role(npc: StoryNpc) -> str:
    candidate = f"{npc.profile_id} {npc.klass}".lower()
    for keyword, label in ROLE_RULES:
        if keyword in candidate:
            return label
    community = npc.community.lower()
    if community in {"trader"}:
        return "Trader"
    if community in {"ecolog"}:
        return "Scientist"
    if community in {"stalker", "dolg", "freedom", "csky", "bandit", "army",
                     "military", "killer", "monolith", "renegade", "greh",
                     "isg", "zombied"}:
        if npc.character_name:
            return "Named Stalker"
        return "Stalker"
    if community == "pseudodog":
        return "Mutant"
    return "Named Stalker" if npc.character_name else "Stalker"


def friendly_level_label(level_key: str) -> str:
    if level_key in LEVEL_LABELS:
        return LEVEL_LABELS[level_key]
    return level_key.replace("_", " ").title()


def friendly_faction_label(community: str) -> str:
    if not community:
        return "Unknown"
    return FACTION_LABELS.get(community, community)


def compose_label(npc: StoryNpc) -> str:
    level_label = friendly_level_label(npc.level_key)
    faction_label = friendly_faction_label(npc.community)
    parts = [faction_label, level_label, npc.role]
    meta = " · ".join(p for p in parts if p)
    display = npc.character_name if npc.character_name else "Unnamed"
    return f"{display} — {meta}" if meta else display


def compose_keywords(npc: StoryNpc) -> list[str]:
    level_label = friendly_level_label(npc.level_key)
    faction_label = friendly_faction_label(npc.community)
    tokens: list[str] = [npc.profile_id]
    if npc.character_name:
        tokens.append(npc.character_name)
    tokens.append(faction_label)
    tokens.append(level_label)
    tokens.append(npc.role)
    tokens.append(npc.profile_id.replace("_", " "))
    if npc.klass and npc.klass != npc.profile_id:
        tokens.append(npc.klass.replace("_", " "))
    seen: set[str] = set()
    deduped: list[str] = []
    for token in tokens:
        norm = token.strip().lower()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        deduped.append(token.strip().lower())
    return deduped


def build_options(string_table: dict[str, str]) -> list[dict[str, object]]:
    seen: dict[str, StoryNpc] = {}
    for path in iter_character_desc_files():
        for npc in parse_character_desc_file(path, string_table):
            # First definition wins; level files do not overlap often, but
            # guard anyway so the catalog is deterministic.
            if npc.profile_id in seen:
                continue
            seen[npc.profile_id] = npc

    options: list[dict[str, object]] = []
    for npc in sorted(seen.values(), key=lambda n: n.profile_id):
        npc.role = infer_role(npc)
        npc.keywords = compose_keywords(npc)
        options.append(
            {
                "value": npc.profile_id,
                "label": compose_label(npc),
                "character_name": npc.character_name,
                "faction": friendly_faction_label(npc.community),
                "level": friendly_level_label(npc.level_key),
                "role": npc.role,
                "keywords": npc.keywords,
            }
        )
    return options


def render_ts(options: list[dict[str, object]]) -> str:
    header = (
        "// Auto-generated story NPC reference data.\n"
        "// Source: bundled Anomaly character_desc_*.xml + text/eng/*.xml string tables.\n"
        "// Refresh with `python tools/build_editor_story_npc_catalog.py`.\n"
        "// Do not edit by hand.\n\n"
        "export interface StoryNpcOption {\n"
        "  value: string;\n"
        "  label: string;\n"
        "  characterName: string;\n"
        "  faction: string;\n"
        "  level: string;\n"
        "  role: string;\n"
        "  keywords: string[];\n"
        "}\n\n"
        "export const STORY_NPC_OPTIONS: StoryNpcOption[] = [\n"
    )
    lines: list[str] = []
    for option in options:
        lines.append(
            "  {"
            f"\"value\": {json_str(option['value'])}, "
            f"\"label\": {json_str(option['label'])}, "
            f"\"characterName\": {json_str(option['character_name'])}, "
            f"\"faction\": {json_str(option['faction'])}, "
            f"\"level\": {json_str(option['level'])}, "
            f"\"role\": {json_str(option['role'])}, "
            f"\"keywords\": {json_list(option['keywords'])}"
            "},"
        )
    return header + "\n".join(lines) + "\n];\n"


def json_str(value: str) -> str:
    escaped = (
        value.replace("\\", "\\\\")
        .replace("\"", "\\\"")
    )
    return f"\"{escaped}\""


def json_list(values: list[str]) -> str:
    return "[" + ", ".join(json_str(v) for v in values) + "]"


def main() -> None:
    string_table = load_string_table()
    options = build_options(string_table)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_ts(options), encoding="utf-8")
    named = sum(1 for o in options if o["character_name"])
    print(
        f"Wrote {len(options)} story NPCs ({named} with resolved names) "
        f"to {OUTPUT_PATH.relative_to(REPO_ROOT)}"
    )


if __name__ == "__main__":
    main()
