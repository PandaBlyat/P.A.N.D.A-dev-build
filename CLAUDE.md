# P.A.N.D.A. — Procedural Anomaly Narrative Dialogue Architecture

A modular interactive conversation system for S.T.A.L.K.E.R. Anomaly. NPCs send PDA text messages to the player with precondition-driven triggering, branching choices, and outcome-based rewards/consequences.

## Project Structure

```
P.A.N.D.A DEV/                          ← Mod files (install to Anomaly gamedata/)
  gamedata/scripts/
    pda_interactive_conv.script          ← Core system: triggering, preconditions, outcomes, choices, save/load
    pda_interactive_conv_mcm.script      ← MCM settings menu integration
    pda_private_tab.script               ← PDA Private Messages UI (contact list, chat, stats)
  gamedata/configs/
    ui/pda_private.xml                   ← UI layout for the private messages tab
    text/eng/st_PANDA_loner_interactive_conversations.xml  ← Conversation content + How To guide
    text/eng/ui_mcm_pda_interactive_conv.xml               ← MCM localization strings

Stalker Anomaly Vanilla Resources(FOR REFERENCE ONLY)/  ← Vanilla scripts/configs for reference
```

## Key Concepts

- **Conversations** are defined in XML string tables with a naming convention: `st_pda_ic_<faction>_<id>_<suffix>`
- **Preconditions** gate which NPCs trigger which conversations (AND logic, supports OR via `any()`)
- **Outcomes** execute actions on player choice (money, spawns, items, reputation, etc.)
- **Contacts** are identified by NPC server object ID (`npc_se.id`), displayed by character name
- **Relationship scores** track per-NPC bond (-1000 to 1000), usable as preconditions and affecting replies

## Coding Conventions

- Lua scripts use `.script` extension (Anomaly's LuaJIT environment)
- `printf()` for debug logging
- `PANDA.get_config()` for MCM-configurable values
- `game.translate_string()` for XML string lookups (returns the key itself if not found)
- `CreateTimeEvent()` for delayed actions
- Save/load via `save_state(m)` / `load_state(m)` callbacks using marshal data

## Testing

1. Copy `P.A.N.D.A DEV/gamedata/` contents to your Anomaly install's `gamedata/` folder
2. Enable debug trigger in MCM settings, press SPACE to force-trigger conversations
3. Check PDA → Private Messages tab for conversation threads
