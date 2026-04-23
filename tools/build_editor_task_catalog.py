#!/usr/bin/env python3
"""Generate searchable vanilla task-id options for editor pickers."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from build_treasure_possible_items import parse_ltx_sections, resolve_key

REPO_ROOT = Path(__file__).resolve().parents[1]
VANILLA_ROOT = REPO_ROOT / "Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)" / "vanilla configs (for reference only)"
TASK_ROOT = VANILLA_ROOT / "misc" / "task"
ENG_ROOT = VANILLA_ROOT / "text" / "eng"
OUTPUT_PATH = REPO_ROOT / "tools" / "editor" / "src" / "lib" / "generated" / "task-catalog.ts"

STRING_RE = re.compile(r"<string\s+id=\"([^\"]+)\"[^>]*>\s*<text>(.*?)</text>\s*</string>", re.DOTALL)


@dataclass(frozen=True)
class TaskEntry:
    value: str
    label: str
    keywords: tuple[str, ...]
    source: str
    title: str


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8", "windows-1251", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def load_string_table() -> dict[str, str]:
    strings: dict[str, str] = {}
    for path in sorted(ENG_ROOT.glob("*.xml")):
        text = read_text(path)
        for match in STRING_RE.finditer(text):
            key = match.group(1).strip()
            value = re.sub(r"\s+", " ", match.group(2)).strip()
            if key and value and key not in strings:
                strings[key] = value
    return strings


def source_label(path: Path) -> str:
    stem = path.stem.removeprefix("tm_")
    if stem == "task_manager":
        return "Global"
    return stem.replace("_", " ").title()


def build_entries() -> list[TaskEntry]:
    string_table = load_string_table()
    entries: list[TaskEntry] = []

    for path in sorted(TASK_ROOT.glob("*.ltx")):
        sections = parse_ltx_sections(path)
        source = source_label(path)
        for section in sorted(sections):
            title_key = resolve_key(sections, section, "title") or ""
            title = string_table.get(title_key.strip(), "")
            storyline = (resolve_key(sections, section, "storyline") or "").strip().lower() == "true"
            label = section
            meta: list[str] = [source]
            if title:
                label = f"{section} - {title}"
            if storyline:
                meta.append("storyline")
            if meta:
                label = f"{label} | {' | '.join(meta)}"
            keywords = [section, section.replace("_", " "), source, title]
            if storyline:
                keywords.append("storyline")
            entries.append(
                TaskEntry(
                    value=section,
                    label=label,
                    keywords=tuple(dict.fromkeys(keyword for keyword in keywords if keyword)),
                    source=source,
                    title=title,
                )
            )

    entries.sort(key=lambda entry: entry.value)
    return entries


def render_ts(entries: list[TaskEntry]) -> str:
    body = "\n".join(
        "  {"
        f" value: {entry.value!r},"
        f" label: {entry.label!r},"
        f" keywords: {list(entry.keywords)!r},"
        f" source: {entry.source!r},"
        f" title: {entry.title!r},"
        " },"
        for entry in entries
    )
    return f"""// Auto-generated vanilla task-id options.
// Source: misc/task/tm_*.ltx + text/eng string tables.
// Refresh with `python tools/build_editor_task_catalog.py`.
// Do not edit by hand.

export interface TaskCatalogOption {{
  value: string;
  label: string;
  keywords: string[];
  source: string;
  title: string;
}}

export const VANILLA_TASK_ID_OPTIONS: TaskCatalogOption[] = [
{body}
];
"""


def main() -> None:
    entries = build_entries()
    OUTPUT_PATH.write_text(render_ts(entries), encoding="utf-8")
    print(f"Wrote {len(entries)} task ids to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
