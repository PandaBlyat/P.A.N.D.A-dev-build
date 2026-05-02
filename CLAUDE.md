# P.A.N.D.A. — Procedural Anomaly Narrative Dialogue Architecture

A modular interactive conversation system for S.T.A.L.K.E.R. Anomaly. NPCs send PDA text messages to the player with precondition-driven triggering, branching choices, and outcome-based rewards/consequences.

The project has three main layers: the **Lua/XML mod** (ships to players), a **web-based conversation editor** (Vite + TypeScript SPA), and a **Supabase backend** (real-time collaboration and community publishing).

---

## Repository Layout

```
P.A.N.D.A DEV/gamedata/          ← Mod files — copy to Anomaly install's gamedata/
  scripts/                        ← All Lua scripts (.script = LuaJIT)
  configs/
    ui/                           ← XML UI layouts
    gameplay/                     ← Dialogue definitions
    misc/task/                    ← Task template slots (.ltx)
    text/eng/ & text/rus/         ← Localization XML string tables

tools/                            ← Dev toolchain
  editor/                         ← Web conversation editor (Vite + TS SPA)
    src/
      components/                 ← ~30 UI components (.ts)
      lib/                        ← Core logic, types, schema, validation
      lib/generated/              ← Auto-generated game data catalogs (DO NOT HAND-EDIT)
    server/index.ts               ← Express proxy (keeps Supabase creds server-side)
    conversation-assets/          ← JSON test fixtures
    scripts/                      ← Build/audit scripts (.mjs)
  build_editor_*.py               ← Catalog generators (run via make)
  mod_doctor.py                   ← Mod integrity checker (XML parse, duplicate IDs)
  setup_modding_env.sh            ← Dev environment installer

supabase/
  migrations/                     ← PostgreSQL migration files

docs/                             ← Design specs and dev guides
Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)/  ← READ ONLY reference
Stalker Anomaly Mods for Reference/                     ← READ ONLY reference
```

---

## Mod Scripts (`P.A.N.D.A DEV/gamedata/scripts/`)

### Core

| File | Purpose |
|------|---------|
| `pda_interactive_conv.script` | **Main system** (v9.1). Conversation triggering, preconditions, outcome dispatch, save/load, NPC cooldowns, typing personality, F2F and task bridge integration, artifact zone level pools |
| `pda_interactive_conv_mcm.script` | MCM settings menu. Exports `on_mcm_load()`, helpers: `isInteractiveEnabled()`, `isFlexibleMode()`, `isStrictMode()`, `isBackgroundEnabled()`, etc. |
| `pda_private_tab.script` | PDA Private Messages UI. Class `pda_private_tab(CUIScriptWnd)`. Handles contact list, chat rendering, colored text tokens, 40+ emoji shortcodes → DDS textures, audio playback, actor portrait resolution |
| `pda_typing_personality.script` | Message formatting with per-character voice personalities |

### Bridge/Integration Scripts

| File | Purpose |
|------|---------|
| `panda_f2f_bridge.script` | Face-to-face conversation routing. Dynamic dialog slot pool (32 slots, `panda_f2f_hub_dialog_NN`). F2F scanner suppression (15s grace), handoff grace period (2 min). Key: `allocate_hub_dialog_id()` |
| `panda_task_bridge.script` | Routes outcomes to Anomaly task system. Task families: delivery, fetch, bounty, dead_drop, artifact, escort, eliminate, rescue, scan. Detector tier definitions, dynamic title/description functors |
| `panda_anomaly_artifact_adapter.script` | Artifact/anomaly flow bridge. Key functions: `ensure_state()`, `get_record(task_id)`, `upsert_record(task_id, patch)`, `has_detector_tier(required_tier)`. Detector tiers: basic → advanced → elite → scientific |
| `panda_npc_creator.script` | On-demand NPC spawning from `st_panda_npc_template_<id>` string keys. Outcome commands: `spawn_custom_npc:<template_id>[:<delay>]`. Preconditions: `req_custom_npc_alive`, `req_custom_npc_dead`, `req_custom_npc_near`. 8 rank levels (novice → legend) |
| `dynamic_news_manager.script` | Dynamic news/NPC chatter system. News categories: death_stalker, death_mutant, found_artifact, weather, zone_activity, faction_report, etc. MCM-configurable timing and chance per category |

### Engine Patches

| File | Purpose |
|------|---------|
| `se_stalker.script` | Extended server-side stalker lifecycle. Safe offline transitions, bad smart terrain reference scrubbing |
| `sim_squad_scripted.script` | Custom squad scripting for P.A.N.D.A-spawned NPCs |

---

## Mod Configs

| File | Purpose |
|------|---------|
| `configs/ui/pda_private.xml` | PDA Private Messages tab layout (dark theme, 210px contact pane + 470px chat pane) |
| `configs/misc/task/tm_panda.ltx` | Task template slots: `panda_delivery_01-16`, `panda_fetch_01+`, etc. Inherits task functors |
| `configs/gameplay/dialogs.xml` | Story dialogue definitions (Sidorovich, Petrenko, faction starts) |
| `configs/text/eng/st_PANDA_*.xml` | English localization. Key files: `st_PANDA_freedom_interactive_conversations.xml`, `st_PANDA_tasks.xml`, `ui_mcm_pda_interactive_conv.xml`, `st_dynamic_news*.xml` |
| `configs/text/rus/st_PANDA_*.xml` | Russian localization (mirrors eng structure) |
| `configs/ui/textures_descr/ui_panda_emoji.xml` | Emoji texture descriptors (40+ entries) |

---

## Key Concepts

### Conversations
- Defined in XML string tables, naming convention: `st_pda_ic_<faction>_<id>_<suffix>`
- Suffixes: `_trigger`, `_body`, `_choice_A`, `_reply_A`, `_outcome_A`, etc.
- NPC templates use: `st_panda_npc_template_<id>`

### Preconditions
- AND logic by default; OR via `any(cond1, cond2)`
- Gate conversation triggering per NPC
- Can check: faction, rank, relations, quest state, items, detector tier, custom NPC state, etc.

### Outcomes
- Execute on player choice: money, item spawns, reputation, task creation, NPC spawns, artifact flows
- New outcome commands (from artifact adapter): `start_anomaly_scan_task`, `start_artifact_retrieval_task`, `spawn_artifact_on_npc`, `spawn_artifact_in_zone`, `require_detector_tier`, `turn_in_artifact`

### Contacts & Relations
- Contacts identified by NPC server object ID (`npc_se.id`), displayed by character name
- Relationship scores: per-NPC bond -1000 to 1000, usable as preconditions, affects reply tone

### F2F (Face-to-Face) Handoff
- PDA conversations can hand off to in-world dialogue trees via `panda_f2f_bridge`
- 32-slot dynamic dialog pool; scanner suppressed during grace window

---

## Coding Conventions (Lua)

- `.script` extension, LuaJIT environment (Anomaly XRay engine)
- `printf()` for debug logging (not `print()`)
- `PANDA.get_config(key)` for MCM-configurable values
- `game.translate_string(key)` for XML string lookups (returns key if not found)
- `CreateTimeEvent(id, key, delay, fn, ...)` for delayed actions
- `save_state(m)` / `load_state(m)` callbacks for persistence (marshal data)
- Global module pattern: `local M = {}` ... `return M` — callers use `panda_task_bridge.fn()`
- Engine callbacks registered via `RegisterScriptCallback("on_event", handler)`

---

## Web Editor (`tools/editor/`)

A Vite + TypeScript SPA for authoring conversations visually.

### Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | Core types: `Conversation`, `Turn`, `Choice`, `Precondition`, `Outcome`, etc. |
| `src/lib/schema.ts` | Command schema registry. `CommandSchema` interface, `ParamDef` with editor types: `searchable_select`, `item_picker_panel`, `custom_npc_builder`, `smart_terrain_picker`, etc. |
| `src/lib/validation.ts` | Validation rules (duplicate task IDs, syntax checks, branch counts) |
| `src/lib/xml-import.ts` / `xml-export.ts` | Two-way XML ↔ editor project serialization |
| `src/lib/flow-graph-model.ts` | Conversation graph data model |
| `src/lib/state.ts` | Global Svelte store (selected conversation, layout, auth, drafts) |
| `src/lib/collab-realtime.ts` | Supabase Realtime integration for live co-editing |
| `src/lib/generated/*.ts` | **Auto-generated** game data catalogs — regenerate via `npm run build:catalogs`, never hand-edit |

### Key Components

| Component | Purpose |
|-----------|---------|
| `App.ts` | Root 3-pane layout |
| `FlowEditor.ts` | Node-graph conversation editor |
| `ConversationList.ts` | Sidebar conversation browser |
| `PropertiesPanel.ts` | Inspector for selected node/choice |
| `CommandEditorFields.ts` | Precondition/outcome parameter inputs |
| `ItemPickerPanel.ts` | Item/NPC/squad/task picker UI |
| `PlayPanel.ts` | Test/preview mode |
| `StoryWizard.ts` | Guided conversation creation |
| `CollabSessionModal.ts` | Real-time collaboration join/host |
| `XmlPreview.ts` | XML export preview |

### Generated Catalogs (`src/lib/generated/`)
Regenerated by `make build-catalogs` (runs `build_editor_*.py` scripts against a local Anomaly install):
`anomaly-zone-catalog.ts`, `item-catalog.ts`, `story-npc-catalog.ts`, `squad-catalog.ts`, `task-catalog.ts`, `smart-terrain-catalog.ts`, `stash-catalog.ts`, `detector-tier-catalog.ts`, `info-portion-catalog.ts`

---

## Backend (`server/index.ts` + `supabase/`)

Express.js proxy keeping Supabase credentials server-side. Auth via JWT → `publisher_id`.

### Supabase Tables
- `community_conversations` — published conversations (faction, label, description, downloads, co_authors)
- `collab_sessions` — active co-edit sessions (host, participants, snapshot, max_users=2)
- `user_profiles`, `user_streaks`, `user_mission_progress` — gamification
- `editor_bug_reports`, `creator_support_metrics` — support

### Key DB Functions
- `create_collab_session(...)` / `join_collab_session(...)` / `close_collab_session(...)`
- `promote_collab_session_host(p_id, p_new_host)`

---

## Toolchain

### Make Targets
```
make doctor              # XML parse + Lua sanity checks (mod_doctor.py)
make lua-lint            # Luacheck linting (.luacheckrc pre-configures XRay globals)
make xml-lint            # xmllint validation on all config XML
make editor-dev          # Start Vite dev server (tools/editor/)
make editor-build        # Production build → tools/editor/dist/
make build-catalogs      # Run all build_editor_*.py → src/lib/generated/
```

### Tools
- `tools/mod_doctor.py` — XML parse validation, duplicate string ID detection, empty string checks
- `tools/setup_modding_env.sh` — installs lua5.1, luacheck, xmllint, shellcheck
- `tools/bin/luacheck`, `tools/bin/xmllint` — local tool wrappers (fallback if system tools missing)
- `tools/build_editor_*.py` — catalog generators (one per data type)
- `tools/editor/scripts/audit-conversation-assets.mjs` — validate JSON fixture files

---

## Testing the Mod

1. Copy `P.A.N.D.A DEV/gamedata/` to your Anomaly install's `gamedata/`
2. Enable debug trigger in MCM → P.A.N.D.A settings
3. Press SPACE in-game to force-trigger a conversation
4. Check PDA → Private Messages tab for threads
5. Use `make doctor` and `make lua-lint` before committing changes

## Testing the Editor

```bash
cd tools/editor
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev                  # starts Vite dev server
```
