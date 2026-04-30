# Agent Instructions

## Core Rule (Caveman)

Respond like smart caveman. Cut articles, filler, pleasantries. Keep all technical substance.

Default intensity: full. Change with `/caveman lite`, `/caveman full`, `/caveman ultra` (Codex: `$caveman lite`).

- Drop articles (`a`, `an`, `the`)
- Drop filler (`just`, `really`, `basically`, `actually`, `simply`)
- Drop pleasantries (`sure`, `certainly`, `of course`, `happy to`)
- Short synonyms: `big` not `extensive`, `fix` not `implement a solution for`
- No hedging
- Fragments ok
- Technical terms stay exact
- Code blocks unchanged (caveman only around code)
- Error messages quoted exact

## Project

P.A.N.D.A. = Procedural Anomaly Narrative Dialogue Architecture.

Mod adds S.T.A.L.K.E.R. Anomaly PDA conversation system:

- XML string-table conversations: `st_pda_ic_<faction>_<id>_<suffix>`
- Preconditions gate triggers
- Branch choices + outcomes (money, items, spawns, reputation, tasks, relations)
- PDA private-message UI
- Per-NPC relationship scores

## Repo Map (Source Of Truth)

- `P.A.N.D.A DEV/` - mod files (copy into Anomaly `gamedata/`)
- `P.A.N.D.A DEV/gamedata/scripts/` - LuaJIT `.script`
- `P.A.N.D.A DEV/gamedata/configs/ui/pda_private.xml` - PDA tab UI layout
- `P.A.N.D.A DEV/gamedata/configs/text/{eng,rus}/st_PANDA_*_interactive_conversations.xml` - conversation strings (current: `st_PANDA_freedom_interactive_conversations.xml`)
- `P.A.N.D.A DEV/gamedata/configs/text/{eng,rus}/st_PANDA_tasks.xml` - task strings
- `P.A.N.D.A DEV/gamedata/configs/text/{eng,rus}/ui_mcm_pda_interactive_conv.xml` - MCM strings
- `tools/` - build + validation scripts + conversation editor
- `tools/editor/` - Vite + TypeScript conversation editor
- `Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)/` - reference only, do not edit
- `Stalker Anomaly Mods for Reference/` - reference only, do not edit

## Mod Coding Notes (Lua)

- Lua scripts use `.script` (Anomaly LuaJIT)
- Debug: `printf()`
- MCM config: `PANDA.get_config()`
- String lookup: `game.translate_string()` (missing string returns key)
- Delays: `CreateTimeEvent()`
- Save/load: `save_state(m)` / `load_state(m)` (marshal data)

Key entry scripts:

- `P.A.N.D.A DEV/gamedata/scripts/pda_interactive_conv.script` - core system
- `P.A.N.D.A DEV/gamedata/scripts/pda_interactive_conv_mcm.script` - MCM options
- `P.A.N.D.A DEV/gamedata/scripts/pda_private_tab.script` - PDA private messages UI

## Tools (Root `tools/`)

- `tools/mod_doctor.py` - validate mod XML + report issues
- `tools/build_treasure_possible_items.py` - treasure/item inspection
- `tools/bin/luacheck` - repo-local luacheck wrapper
- `tools/bin/xmllint` - repo-local xmllint wrapper

Editor catalog generators (write into `tools/editor/src/lib/generated/`):

- `tools/build_editor_item_catalog.py`
- `tools/build_editor_anomaly_catalog.py`
- `tools/build_editor_story_npc_catalog.py`
- `tools/build_editor_squad_catalog.py`
- `tools/build_editor_task_catalog.py`
- `tools/build_editor_info_portion_catalog.py`
- `tools/build_editor_detector_tier_catalog.py`

## Conversation Editor (`tools/editor/`)

Main commands:

- `npm run dev` - local Vite editor
- `npm run validate:conversations` - validate `conversation-assets/`
- `npm run build` - validate + typecheck + build
- `npm run preview` - preview build
- `npm run build:catalogs` - regenerate all generated catalogs (calls Python scripts)

Useful entry files:

- `src/main.ts` - app bootstrap
- `src/components/App.ts` - top-level layout + state wiring
- `src/components/FlowEditor.ts` - node graph editor
- `src/lib/schema.ts` - project schema + defaults + migrations
- `src/lib/validation.ts` - validation rules
- `src/lib/xml-import.ts` / `src/lib/xml-export.ts` - XML <-> editor project
- `src/lib/generated/` - generated catalogs, do not hand-edit

Editor scripts:

- `scripts/audit-conversation-assets.mjs` - fixture validation (used by `npm run validate:conversations`)
- `scripts/check-collab-protocol.mjs` - collab protocol audit
- `scripts/build-emoji-previews.mjs` - emoji preview assets

Online server (optional, for community/collab/roadmap/bug reports):

- `server/index.ts` - Express proxy for Supabase REST/RPC
- Config: `server/.env.example` (needs `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGIN`, `PORT`, etc)

## Generated/Build Output Rules

- Do not hand-edit `tools/editor/dist/`
- Do not hand-edit `tools/editor/node_modules/`
- Do not hand-edit `tools/editor/src/lib/generated/` (regen via `npm run build:catalogs`)

## Validation Checklist

Mod (Lua/XML):

1. XML change -> run `python tools/mod_doctor.py`
2. Lua change -> run `tools/bin/luacheck "P.A.N.D.A DEV/gamedata/scripts" --codes` (or your local luacheck)
3. Smoke test in Anomaly: copy `P.A.N.D.A DEV/gamedata/` into Anomaly `gamedata/`
4. Enable debug trigger in MCM, press SPACE to force conversations
5. Check PDA -> Private Messages tab

Editor (TypeScript/assets):

1. Change schema/import/export/fixtures -> `npm run validate:conversations`
2. Before finish -> `npm run build`
3. Collab protocol change -> `node scripts/check-collab-protocol.mjs`
