# Agent Instructions

## Core Rule

Respond like smart caveman. Cut articles, filler, pleasantries. Keep all technical substance.

Default intensity: full. Change with `/caveman lite`, `/caveman full`, `/caveman ultra` (Codex: `$caveman lite`).

- Drop articles (`a`, `an`, `the`)
- Drop filler (`just`, `really`, `basically`, `actually`, `simply`)
- Drop pleasantries (`sure`, `certainly`, `of course`, `happy to`)
- Use short synonyms: `big`, not `extensive`; `fix`, not `implement a solution for`
- No hedging: skip `it might be worth considering`
- Fragments fine. Full sentence not required.
- Technical terms stay exact. `Polymorphism` stays `polymorphism`.
- Code blocks unchanged. Caveman speak around code, not inside code.
- Error messages quoted exact. Caveman only for explanation.

## Project

P.A.N.D.A. = Procedural Anomaly Narrative Dialogue Architecture.

Mod adds S.T.A.L.K.E.R. Anomaly PDA conversation system:

- XML string-table conversations using `st_pda_ic_<faction>_<id>_<suffix>`
- Preconditions for trigger gating
- Branch choices
- Outcomes for money, items, spawns, reputation, tasks, relation changes
- PDA private-message UI
- Per-NPC relationship scores

## Main Paths

- `P.A.N.D.A DEV/` - game mod files copied into Anomaly `gamedata/`
- `P.A.N.D.A DEV/gamedata/scripts/pda_interactive_conv.script` - core Lua conversation system
- `P.A.N.D.A DEV/gamedata/scripts/pda_interactive_conv_mcm.script` - MCM options
- `P.A.N.D.A DEV/gamedata/scripts/pda_private_tab.script` - PDA private messages UI
- `P.A.N.D.A DEV/gamedata/configs/ui/pda_private.xml` - PDA tab layout
- `P.A.N.D.A DEV/gamedata/configs/text/eng/st_PANDA_loner_interactive_conversations.xml` - conversation content and in-game guide
- `P.A.N.D.A DEV/gamedata/configs/text/eng/ui_mcm_pda_interactive_conv.xml` - MCM localization
- `Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)/` - vanilla reference files only
- `Stalker Anomaly Mods for Reference/` - reference mods only
- `tools/` - local build scripts plus online conversation editor

## Mod Coding Notes

- Lua scripts use `.script` for Anomaly LuaJIT.
- Use `printf()` for debug logging.
- Use `PANDA.get_config()` for MCM-configured values.
- Use `game.translate_string()` for XML string lookups. Missing strings return key itself.
- Use `CreateTimeEvent()` for delayed actions.
- Save/load via `save_state(m)` / `load_state(m)` callbacks with marshal data.

## Tools Overview

`tools/` has offline helper scripts and `tools/editor/`, online visual conversation editor.

### `tools/` Root

- `build_editor_item_catalog.py` - scans Anomaly config/string resources and generates editor item catalog TypeScript.
- `build_editor_anomaly_catalog.py` - builds anomaly/zone catalog for editor generated data.
- `build_editor_story_npc_catalog.py` - parses story NPC character descriptions and generates story NPC options.
- `build_treasure_possible_items.py` - inspects treasure/item config sources and prints possible item data.
- `mod_doctor.py` - validates mod XML files with `xmllint` wrapper and reports issues.
- `setup_modding_env.sh` - shell setup helper for modding tools.
- `bin/luacheck` - repo-local Lua lint wrapper.
- `bin/xmllint` - repo-local XML lint wrapper.

### Online Editor: `tools/editor/`

Vite + TypeScript app for creating, validating, importing, exporting, sharing, and publishing P.A.N.D.A conversations.

Commands from `tools/editor/`:

- `npm run dev` - start local Vite editor
- `npm run build` - validate conversation fixtures, typecheck, build production bundle
- `npm run preview` - preview production build
- `npm run build:item-catalog` - regenerate item catalog via Python script
- `npm run validate:conversations` - audit bundled conversation fixtures

Important editor files:

- `package.json` - npm scripts and dependencies
- `vite.config.ts` - Vite config
- `tsconfig.json` - TypeScript config
- `index.html` - app shell
- `src/main.ts` - browser entry point
- `src/app.css` - full editor styling
- `src/components/App.ts` - top-level editor component, layout, app state wiring
- `server/index.ts` - Express API for Supabase-backed community, profiles, collaboration, bug reports, roadmap
- `supabase-setup.sql` - Supabase schema/setup for online editor
- `.env.example`, `.env.local`, `.env` - local editor env files
- `dist/` - generated production build; do not hand-edit
- `node_modules/` - installed packages; do not hand-edit

### Editor Components

- `AchievementIcons.ts` - SVG achievement icon rendering and badge icon helpers.
- `AchievementToast.ts` - achievement unlock toast UI.
- `AvatarCustomizationModal.ts` - profile/avatar editor modal.
- `AvatarRenderer.ts` - avatar SVG renderer.
- `BeginnerTooltip.ts` - contextual beginner help popovers.
- `BottomWorkspace.ts` - lower workspace panel and tab area.
- `BugReportsPanel.ts` - bug report list/admin UI.
- `CatalogPickerPanel.ts` - generic generated catalog picker UI.
- `CollabInviteToast.ts` - collaboration invite notification.
- `CollabPresenceLayer.ts` - shared editor cursor/presence overlay.
- `CollabRoster.ts` - active collaborator list.
- `CollabSessionModal.ts` - create/join collaboration modal.
- `ConversationList.ts` - conversation/project list.
- `FlowCursor.ts` - animated flow cursor and path visuals.
- `FlowEditor.ts` - main node graph editor canvas and graph interactions.
- `HelpModal.ts` - help/reference modal.
- `icons.ts` - local icon components.
- `ItemPickerPanel.ts` - item search/picker UI.
- `LeaderboardOverlay.ts` - leaderboard UI.
- `MotivationTicker.ts` - editor status/motivation ticker.
- `NpcTemplatePanel.ts` - NPC template picker and setup UI.
- `Onboarding.ts` - first-run onboarding flow.
- `PlayPanel.ts` - conversation preview/playtest panel.
- `ProfileBadge.ts` - profile badge, XP, cosmetics display.
- `PropertiesPanel.ts` - selected node/conversation property editor.
- `PublicProfileView.ts` - public creator profile view.
- `PublishCelebration.ts` - publish success UI.
- `RoadMapModal.ts` - roadmap voting/admin modal.
- `SharePanel.ts` - community publish/import/share panel.
- `StoryWizard.ts` - guided conversation/story creation wizard.
- `SupportPanel.ts` - support/upvote panel.
- `SystemStringsPanel.ts` - system string editor.
- `Toolbar.ts` - top toolbar and primary editor actions.
- `UsernameModal.ts` - username registration modal.
- `ValidationBar.ts` - validation summary/status UI.
- `XmlPreview.ts` - XML preview UI.
- `XpToast.ts` - XP award toast UI.

### Editor Lib

- `api-client.ts` - browser API client for online server endpoints.
- `avatar-catalog.ts` - avatar parts, cosmetic options, unlock metadata.
- `beginner-tooltips.ts` - tooltip definitions and triggers.
- `collab-protocol.ts` - collaboration message shapes and protocol validation.
- `collab-realtime.ts` - realtime collaboration transport glue.
- `collab-session.ts` - collaboration session lifecycle helpers.
- `community-data.ts` - community data constants/types.
- `constants.ts` - editor constants, options, catalog defaults.
- `draft-storage.ts` - local draft persistence.
- `f2f-entry-migration.ts` - PDA/F2F entry migration helpers.
- `faction-colors.ts` - faction color mapping.
- `flow-graph-model.ts` - graph model conversion/structure helpers.
- `flow-layout.ts` - node layout helpers.
- `flow-navigation.ts` - graph navigation helpers.
- `focus-trap.ts` - modal focus trapping.
- `gamification.ts` - XP, achievements, missions, cosmetics logic.
- `item-catalog.ts` - item catalog adapters/search helpers.
- `perf.ts` - performance timing helpers.
- `perf-benchmark.ts` - editor performance benchmark helpers.
- `project-io.ts` - project import/export JSON handling.
- `sample-project.ts` - bundled sample conversation project.
- `schema.ts` - conversation schema, defaults, migration/normalization.
- `state.ts` - editor state reducer/actions/selectors.
- `story-recipes.ts` - generated story recipe/templates.
- `turn-labels.ts` - turn/edge label helpers.
- `types.ts` - shared TypeScript domain types.
- `validation.ts` - full conversation validation rules.
- `validation-client.ts` - validation worker/client bridge.
- `validation-gate.ts` - validation gating helpers.
- `validation.worker.ts` - Web Worker entry for validation.
- `xml-export.ts` - export editor project to P.A.N.D.A XML string table format.
- `xml-import.ts` - parse P.A.N.D.A XML string table into editor project.
- `generated/*.ts` - generated catalogs; regenerate from scripts, do not hand-edit unless emergency.

### Editor Scripts And Fixtures

- `scripts/audit-conversation-assets.mjs` - validates conversation fixture assets against editor schema.
- `scripts/check-collab-protocol.mjs` - checks collaboration protocol assumptions.
- `conversation-assets/*.json` - sample/migration fixture conversations.
- `conversation-assets/migration-report.md` - migration notes/report for conversation assets.

### Online Server API

`tools/editor/server/index.ts` exposes endpoints for:

- Community conversations: list, publish, replace, download count, upvote
- Support metrics and active users
- Collaboration sessions: create, join, close, promote host
- Visitor metrics
- Bug reports and admin status updates
- Profiles, XP, achievements, streaks, missions, cosmetics
- Leaderboard
- Roadmap items and votes

Server expects Supabase env vars from `tools/editor/server/.env.example` / editor env files.

## Generated File Rules

- Do not hand-edit `tools/editor/dist/`.
- Do not hand-edit `tools/editor/node_modules/`.
- Prefer regenerating `tools/editor/src/lib/generated/*.ts` with root `tools/build_editor_*.py`.
- Run editor commands from `tools/editor/`.

## Validation

For mod XML/Lua work:

1. Use `python tools/mod_doctor.py <path>` when XML changed.
2. Use repo `luacheck` where applicable for `.script` Lua.
3. Test in Anomaly by copying `P.A.N.D.A DEV/gamedata/` into Anomaly `gamedata/`.
4. Enable debug trigger in MCM and press SPACE to force conversations.
5. Check PDA Private Messages tab.

For online editor work:

1. Run `npm run validate:conversations` from `tools/editor/` after changing fixtures/schema/import/export.
2. Run `npm run build` from `tools/editor/` before finishing editor changes.
3. If collaboration protocol changes, run `node scripts/check-collab-protocol.mjs`.
