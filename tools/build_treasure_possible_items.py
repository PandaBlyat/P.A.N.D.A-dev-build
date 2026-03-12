#!/usr/bin/env python3
"""Build a treasure_manager [possible_items] list compatible with vanilla treasure_manager.init_settings.

Vanilla logic (treasure_manager.script:init_settings) only accepts entries whose backing item section has:
- cost > 1
- kind present
- tier present

This tool pre-validates entries so modded tables don't spam:
"!WARNING treasure_manager.init_settings | item [...] is missing info ..."
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re

SECTION_RE = re.compile(r"^\s*\[([^\]]+)\](?::(.*))?\s*$")
KV_RE = re.compile(r"^\s*([^;=\s][^=]*)=(.*)$")


@dataclass
class ItemInfo:
    cost: float | None = None
    kind: str | None = None
    tier: float | None = None


def parse_ltx_sections(path: Path) -> dict[str, dict[str, str | list[str]]]:
    sections: dict[str, dict[str, str]] = {}
    current: str | None = None
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.split(";", 1)[0].strip()
        if not line:
            continue
        sm = SECTION_RE.match(line)
        if sm:
            current = sm.group(1).strip()
            parents = [p.strip() for p in (sm.group(2) or "").split(",") if p.strip()]
            sections.setdefault(current, {})
            sections[current]["__parents"] = parents
            continue
        if current is None:
            continue
        km = KV_RE.match(line)
        if km:
            key = km.group(1).strip()
            val = km.group(2).strip()
            sections[current][key] = val
    return sections


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.split(",", 1)[0].strip()
    try:
        return float(value)
    except ValueError:
        return None


def resolve_key(sections: dict[str, dict[str, str | list[str]]], sec: str, key: str, seen: set[str] | None = None) -> str | None:
    node = sections.get(sec)
    if not node:
        return None
    if key in node:
        v = node[key]
        return v if isinstance(v, str) else None

    seen = seen or set()
    if sec in seen:
        return None
    seen.add(sec)
    for parent in node.get("__parents", []):
        if isinstance(parent, str):
            val = resolve_key(sections, parent, key, seen)
            if val is not None:
                return val
    return None


def collect_item_info(sections: dict[str, dict[str, str | list[str]]]) -> dict[str, ItemInfo]:
    out: dict[str, ItemInfo] = {}
    for sec, kv in sections.items():
        out[sec] = ItemInfo(
            cost=to_float(resolve_key(sections, sec, "cost")),
            kind=(resolve_key(sections, sec, "kind") or "").strip() or None,
            tier=to_float(resolve_key(sections, sec, "tier")),
        )
    return out


def parse_possible_items(path: Path) -> list[tuple[str, str]]:
    in_possible = False
    rows: list[tuple[str, str]] = []
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.split(";", 1)[0].strip()
        if not line:
            continue
        sm = SECTION_RE.match(line)
        if sm:
            in_possible = sm.group(1).strip().lower() == "possible_items"
            continue
        if not in_possible:
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            rows.append((key.strip(), val.strip()))
        else:
            rows.append((line.strip(), ""))
    return rows


def collect_sections_from_root(root: Path) -> dict[str, dict[str, str | list[str]]]:
    sections: dict[str, dict[str, str | list[str]]] = {}
    for path in sorted(root.rglob("*.ltx")):
        for sec, kv in parse_ltx_sections(path).items():
            node = sections.setdefault(sec, {})
            parents = kv.get("__parents", [])
            if parents:
                node["__parents"] = parents
            for key, val in kv.items():
                if key != "__parents":
                    node[key] = val
    return sections


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--system-ltx", type=Path, help="Single LTX file containing item sections")
    ap.add_argument("--items-root", type=Path, help="Configs root; scans all *.ltx and merges sections")
    ap.add_argument("--treasure-ltx", required=True, type=Path, help="treasure_manager.ltx to read [possible_items] from")
    ap.add_argument("--output", type=Path, help="Optional output path (defaults to stdout)")
    args = ap.parse_args()

    if bool(args.system_ltx) == bool(args.items_root):
        ap.error("Provide exactly one of --system-ltx or --items-root")

    sections = collect_sections_from_root(args.items_root) if args.items_root else parse_ltx_sections(args.system_ltx)
    info = collect_item_info(sections)
    possible = parse_possible_items(args.treasure_ltx)

    kept: list[tuple[str, str]] = []
    dropped: list[str] = []

    for sec, eco in possible:
        it = info.get(sec)
        if it and (it.cost or 0) > 1 and it.kind and it.tier is not None:
            kept.append((sec, eco))
        else:
            dropped.append(sec)

    lines = ["[possible_items]"]
    for sec, eco in kept:
        lines.append(f"{sec} = {eco}" if eco else f"{sec} =")
    text = "\n".join(lines) + "\n"

    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text, end="")

    print(f"# kept {len(kept)} entries, dropped {len(dropped)} invalid entries", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
