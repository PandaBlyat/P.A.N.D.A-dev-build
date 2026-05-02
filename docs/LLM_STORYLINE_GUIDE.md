# P.A.N.D.A. LLM Storyline Authoring Guide

This guide is written for AI language models generating `.panda` conversation files.
Read it completely before writing any content.

---

## What You Write vs. What the Human Author Fills In

**You write:**
- All dialogue text (NPC messages, player choices, NPC replies)
- Narrative logic — which turns branch where, which choices are terminal
- Preconditions and outcomes using the commands in this guide
- Faction IDs, rank names, numeric values (money, percentages, seconds)
- Custom NPC template IDs that you invent for the storyline (e.g. `"informant"`, `"hired_guns"`)
- Weather types, hour windows, achievement names

**Leave as a placeholder — human author fills in:**
- `item_section` values — specific game item IDs like `medkit_army`, `af_compass`, `device_pda_3`
- `smart_terrain` values — location keys like `esc_smart_terrain_5_7`, `bar_visitors`
- `stash_name` values — stash box keys like `dark_valley_treasure_1`
- `squad_section` values — vanilla squad IDs like `bandit_sim_squad_advanced`
- `story_npc` values — story NPC IDs like `bar_visitors_barman_stalker_trader`
- `zone_name` values — anomaly zone IDs like `labx18_2c_04_bioh_anomaly_spot`
- `info_id` values — info portion IDs like `bar_deactivate_radar_done`
- `task_id` values — vanilla task IDs

### Placeholder convention

Use `"PLACEHOLDER_ITEM"`, `"PLACEHOLDER_SMART_TERRAIN"`, `"PLACEHOLDER_SQUAD"`,
`"PLACEHOLDER_STORY_NPC"`, `"PLACEHOLDER_STASH"`, `"PLACEHOLDER_ZONE"`,
`"PLACEHOLDER_INFO_ID"`, `"PLACEHOLDER_TASK_ID"` as the param string value.

Add a comment in the JSON as a sibling key `"_note"` describing what the human should put there:

```json
{
  "command": "panda_task_fetch",
  "params": ["PLACEHOLDER_ITEM", "1", "600", "2", "3"],
  "_note": "Replace PLACEHOLDER_ITEM with the item section the player must find, e.g. medkit_army"
}
```

> JSON does not support comments natively. Use `"_note"` keys that the editor ignores.

---

## File Structure

A `.panda` file is a JSON object:

```json
{
  "version": "2.0.0",
  "faction": "<faction_id>",
  "conversations": [ ...Conversation objects... ],
  "systemStrings": {}
}
```

| Field | Notes |
|---|---|
| `version` | Always `"2.0.0"` |
| `faction` | Default player faction for this file. See faction list below. |
| `conversations` | Array of one or more Conversation objects. |
| `systemStrings` | Leave as `{}`. |

---

## Faction IDs

| ID | Display Name |
|---|---|
| `stalker` | Loner |
| `dolg` | Duty |
| `freedom` | Freedom |
| `csky` | Clear Sky |
| `ecolog` | Ecologists |
| `killer` | Mercenaries |
| `army` | Military |
| `bandit` | Bandits |
| `monolith` | Monolith |
| `zombied` | Zombified |
| `isg` | ISG |
| `renegade` | Renegades |
| `greh` | Sin |

---

## Rank Names

Valid rank strings in ascending order:

`novice` → `experienced` → `veteran` → `master` → `legend`

---

## Conversation Object

```json
{
  "id": 1,
  "label": "Short human-readable name",
  "faction": "stalker",
  "initialChannel": "pda",
  "startMode": "pda",
  "language": "en",
  "repeatable": true,
  "preconditions": [ ...PreconditionEntry... ],
  "turns": [ ...Turn objects... ]
}
```

| Field | Notes |
|---|---|
| `id` | Integer, unique within the file. Start at 1. |
| `label` | Short descriptive title. |
| `faction` | Faction ID. Determines which NPCs can trigger it. |
| `initialChannel` | `"pda"` or `"f2f"`. Use `"pda"` unless it must open as face-to-face. |
| `startMode` | Same as `initialChannel` for new conversations. |
| `language` | `"en"` for English. |
| `repeatable` | `true` to allow multiple playthroughs. `false` for one-time story beats. |
| `preconditions` | Gate conditions before this conversation can trigger at all. |
| `turns` | Ordered array of Turn objects. Turn 1 is always the opening. |

### Conversation-level preconditions

These guard whether the conversation can be triggered at all (on top of per-turn guards).
Use them for the broadest conditions: faction membership, min rank, min goodwill.

---

## Turn Object

```json
{
  "turnNumber": 1,
  "customLabel": "Human label for the node",
  "openingMessage": "NPC text that opens this turn.",
  "preconditions": [],
  "channel": "pda",
  "firstSpeaker": "npc",
  "pda_entry": true,
  "f2f_entry": false,
  "choices": [ ...Choice objects... ],
  "position": { "x": 0, "y": 0 }
}
```

| Field | Notes |
|---|---|
| `turnNumber` | Integer. Turn 1 is the conversation opener. Later turns are branches. |
| `customLabel` | Short label for visual editor. Use it. |
| `openingMessage` | NPC text shown at the start of this turn. Required for all turns. |
| `preconditions` | Conditions that must pass before this turn can be entered. Usually empty on non-entry turns. |
| `channel` | `"pda"` or `"f2f"`. |
| `firstSpeaker` | `"npc"` for most turns. `"player"` is rare. |
| `pda_entry` | `true` only on Turn 1 (or the first turn of a PDA-started conversation). |
| `f2f_entry` | `true` only if this turn is a face-to-face entry point. |
| `choices` | 1–6 choices. Always include at least one terminal choice. |
| `position` | `{ "x": ..., "y": ... }`. Lay turns out left-to-right. Turn 1 near x=200. Each branching level adds ~500 x. Success/fail endpoints go at large x. Use y to separate parallel branches. |

### Turn layout heuristic

```
Turn 1:  x=200,  y=400
Turn 2:  x=750,  y=200   (task start)
Turn 3:  x=750,  y=600   (detail branch)
Turn 4:  x=1300, y=200   (success)
Turn 5:  x=1300, y=600   (failure)
```

---

## Choice Object

```json
{
  "index": 1,
  "text": "Player dialogue line.",
  "channel": "pda",
  "preconditions": [],
  "reply": "NPC reply text after this choice.",
  "outcomes": [ ...Outcome objects... ],
  "terminal": true,
  "allow_generic_stalker": false
}
```

| Field | Notes |
|---|---|
| `index` | Integer, 1-based, unique within a turn. |
| `text` | Player-spoken choice text. |
| `channel` | `"pda"` or `"f2f"`, matching the turn. |
| `preconditions` | Show this choice only when conditions pass. Use for gated options. |
| `reply` | NPC's response after this choice. Required. |
| `outcomes` | Array of Outcome commands. Can be empty. |
| `terminal` | `true` if this ends the conversation flow. `false` if it continues to another turn. |
| `allow_generic_stalker` | Leave `false` unless you specifically need any stalker to deliver this. |
| `continueTo` | Turn number to jump to. Only when `terminal: false`. |
| `continueChannel` | `"pda"` or `"f2f"`. Only when `terminal: false`. |
| `continue_channel` | Same as `continueChannel`. Include both for compatibility. |

**Rules:**
- Every turn must have at least one terminal choice.
- Non-terminal choices that branch to another turn must set `continueTo`.
- Do not mix `terminal: true` with `continueTo`.
- Keep choices 2–4 for meaningful branch depth. Rarely exceed 5.

---

## Outcome Object

```json
{
  "command": "reward_money",
  "params": ["500"]
}
```

Optional field `"chancePercent": 50` makes the outcome fire only 50% of the time.

All param values are **strings**, even numbers.

---

## Precondition Entry

Three forms:

```json
{ "type": "simple", "command": "req_npc_friendly", "params": [] }

{ "type": "not", "inner": { "type": "simple", "command": "req_hunger", "params": [] } }

{
  "type": "any",
  "options": [
    { "type": "simple", "command": "req_rank", "params": ["veteran"] },
    { "type": "simple", "command": "req_goodwill", "params": ["500", "stalker"] }
  ]
}
```

- Multiple top-level preconditions are **AND logic** by default.
- Use `"type": "any"` to express OR logic.
- Use `"type": "not"` to negate a single condition.

---

## Precondition Command Reference

### NPC Relation
| Command | Params | Notes |
|---|---|---|
| `req_npc_friendly` | `[faction?]` | NPC goodwill >= 0 toward player |
| `req_npc_hostile` | `[faction?]` | NPC goodwill < 0 |

### Faction
| Command | Params | Notes |
|---|---|---|
| `req_faction` | `[faction]` | Player must be this faction (usually not needed — conversation already scoped by project faction) |
| `req_not_faction` | `[faction]` | Player must NOT be this faction |
| `req_npc_faction` | `[faction]` | NPC must be this faction |
| `req_npc_not_faction` | `[faction]` | NPC must NOT be this faction |
| `req_factions_enemies` | `[faction1, faction2]` | Two factions are at war |
| `req_factions_friends` | `[faction1, faction2]` | Two factions are allied |

### Rank
| Command | Params | Notes |
|---|---|---|
| `req_rank` | `[rank]` | Player rank >= value |
| `req_rank_max` | `[rank]` | Player rank <= value |
| `req_npc_rank` | `[rank]` | NPC rank >= value |
| `req_npc_rank_max` | `[rank]` | NPC rank <= value |
| `req_npc_rank_name` | `[rank]` | NPC rank exactly matches |

### Money
| Command | Params | Notes |
|---|---|---|
| `req_money` | `[amount]` | Player has >= RU |
| `req_money_max` | `[amount]` | Player has < RU |

### Reputation
| Command | Params | Notes |
|---|---|---|
| `req_rep` | `[amount]` | Player rep >= amount |
| `req_rep_max` | `[amount]` | Player rep <= amount |

### Goodwill
| Command | Params | Notes |
|---|---|---|
| `req_goodwill` | `[amount, faction?]` | Goodwill with faction >= amount (-1000 to 1000) |
| `req_goodwill_max` | `[amount, faction?]` | Goodwill with faction <= amount |

### Kills / Statistics
| Command | Params | Notes |
|---|---|---|
| `req_kills` | `[count]` | Player killed >= N stalkers |
| `req_mutant_kills` | `[count]` | Player killed >= N mutants |
| `req_enemy_kills` | `[count]` | Player killed >= N hostile stalkers |
| `req_faction_kills` | `[count, faction]` | Player killed >= N members of faction |
| `req_artefacts_found` | `[count]` | Player found >= N artefacts |
| `req_total_weight_min` | `[weight_kg]` | Player carrying >= kg |
| `req_total_weight_max` | `[weight_kg]` | Player carrying <= kg |

### Location
| Command | Params | Notes |
|---|---|---|
| `req_level` | `[level]` | Player on level. **Level values are game IDs — use placeholder.** |
| `req_not_level` | `[level]` | Player NOT on level |
| `req_actor_near_smart` | `[smart_terrain, distance?]` | Player near smart terrain. **smart_terrain = placeholder.** |
| `req_npc_near_smart` | `[smart_terrain, distance?]` | NPC near smart terrain. **smart_terrain = placeholder.** |
| `req_actor_in_zone` | `[zone]` | Player inside named zone. **zone = placeholder.** |
| `req_distance_min` | `[distance_m]` | Player >= N meters from conversation NPC |
| `req_distance_max` | `[distance_m]` | Player <= N meters from conversation NPC |

### Items
| Command | Params | Notes |
|---|---|---|
| `req_has_item` | `[item, count?]` | Player has item in inventory. **item = placeholder.** |
| `req_not_has_item` | `[item]` | Player does NOT have item. **item = placeholder.** |
| `req_has_item_count` | `[item, count]` | Player has >= N of item. **item = placeholder.** |
| `req_has_item_type` | `[type]` | Player has any item of type. Type: `weapon`, `outfit`, `artefact`, `headgear`, `pistol`, `rifle`, `shotgun`, `sniper`, `melee`, `explosive` |
| `req_equipped` | `[item]` | Player has item equipped. **item = placeholder.** |
| `req_equipped_slot` | `[slot_num]` | Equipment slot (0-12) is filled |
| `req_weapon_equipped` | `[]` | Player has any weapon active |
| `req_no_weapon_equipped` | `[]` | Player has no weapon active |
| `req_outfit_equipped` | `[]` | Player has armor equipped |

### Player Condition
| Command | Params | Notes |
|---|---|---|
| `req_health_min` | `[amount]` | Health >= amount (0–100) |
| `req_health_max` | `[amount]` | Health <= amount (0–100) |
| `req_radiation_min` | `[amount]` | Radiation >= amount (0–100) |
| `req_radiation_max` | `[amount]` | Radiation <= amount (0–100) |
| `req_hunger` | `[]` | Player is hungry |
| `req_not_hungry` | `[]` | Player is not hungry |
| `req_thirsty` | `[]` | Player is thirsty |
| `req_not_thirsty` | `[]` | Player is not thirsty |
| `req_bleeding` | `[]` | Player is bleeding |
| `req_overweight` | `[]` | Player is overburdened |
| `req_satiety_min` | `[amount]` | Satiety >= amount (0–100) |
| `req_satiety_max` | `[amount]` | Satiety <= amount (0–100) |

### Companions
| Command | Params | Notes |
|---|---|---|
| `req_companions` | `[count]` | Player has >= N active companions |
| `req_companions_max` | `[count]` | Player has <= N active companions |

### Time & Weather
| Command | Params | Notes |
|---|---|---|
| `req_time_day` | `[]` | Daytime (06:00–19:59) |
| `req_time_night` | `[]` | Nighttime (20:00–05:59) |
| `req_time_hour_min` | `[hour]` | Game hour >= value (0–23) |
| `req_time_hour_max` | `[hour]` | Game hour <= value (0–23) |
| `req_game_hour_between` | `[hour_min, hour_max]` | Hour in window (wraps at midnight) |
| `req_game_month` | `[month_num]` | In-game month matches (1–12) |
| `req_surge_soon` | `[threshold_s]` | Emission within threshold seconds |
| `req_not_surge_soon` | `[threshold_s]` | Emission NOT within threshold |
| `req_surge_active` | `[]` | Emission currently in progress |
| `req_not_surge_active` | `[]` | No emission in progress |
| `req_psi_storm_soon` | `[threshold_s]` | Psi storm within threshold |
| `req_weather_fx_active` | `[]` | Special weather FX active |
| `req_weather_fx_not_active` | `[]` | No special weather FX |
| `req_weather` | `[weather_type]` | Current weather matches. Weather types: `w_clear`, `w_cloudy`, `w_partly`, `w_foggy`, `w_rain1`, `w_rain2`, `w_storm1`, `w_storm2` |

### Game Progress
| Command | Params | Notes |
|---|---|---|
| `req_game_days_min` | `[days]` | Player survived >= N in-game days |
| `req_game_days_max` | `[days]` | Player survived < N in-game days |
| `req_visited_level` | `[level]` | Player has visited level. **Level = placeholder.** |
| `req_not_visited_level` | `[level]` | Player has NOT visited level. **Level = placeholder.** |
| `req_visited_smart` | `[smart_terrain]` | Player visited smart terrain. **smart_terrain = placeholder.** |

### Knowledge (Info Portions)
| Command | Params | Notes |
|---|---|---|
| `req_has_info` | `[info_id]` | Player has info portion. **info_id = placeholder.** |
| `req_not_has_info` | `[info_id]` | Player does NOT have info portion. **info_id = placeholder.** |

### Achievement
| Command | Params | Notes |
|---|---|---|
| `req_achievement` | `[achievement]` | Player has achievement. Values: `completionist`, `down_to_earth`, `duga_free`, `geologist`, `heavy_pockets`, `infopreneur`, `mechanized_warfare`, `patriarch`, `radiotherapy`, `rag_and_bone`, `silver_or_lead`, `tourist`, `well_dressed`, `wishful_thinking`, `infantile_pleasure`, `recycler`, `artificer_eagerness`, `unforeseen_guest`, `absolver`, `collaborator`, `iron_curtain`, `murky_spirit`, `invictus` |

### Relationship (P.A.N.D.A. per-NPC score)
| Command | Params | Notes |
|---|---|---|
| `req_relationship_min` | `[score]` | NPC relationship score >= value (-1000 to 1000) |
| `req_relationship_max` | `[score]` | NPC relationship score <= value |

### NPC State
| Command | Params | Notes |
|---|---|---|
| `req_npc_alive` | `[]` | Conversation NPC is alive |
| `req_npc_on_level` | `[level]` | NPC is on level. **Level = placeholder.** |
| `req_story_npc` | `[story_id]` | Must be triggered by specific story NPC. **story_id = placeholder.** |
| `req_custom_story_npc` | `[template_id, smart_terrain]` | Must be triggered by a custom NPC you define. **smart_terrain = placeholder.** |
| `req_detector_tier` | `[tier]` | Player has detector tier. Tiers: `basic`, `advanced`, `elite`, `scientific` |

### Custom NPCs
| Command | Params | Notes |
|---|---|---|
| `req_custom_npc_alive` | `[template_id]` | Custom NPC from template is alive |
| `req_custom_npc_dead` | `[template_id]` | Custom NPC from template is dead |
| `req_custom_npc_near` | `[template_id, distance_m]` | Custom NPC is within distance of player |

---

## Outcome Command Reference

### Money
| Command | Params | Notes |
|---|---|---|
| `reward_money` | `[amount]` | Give player RU |
| `punish_money` | `[amount]` | Remove RU from player |

### Reputation
| Command | Params | Notes |
|---|---|---|
| `reward_rep` | `[amount]` | Increase player reputation |
| `punish_rep` | `[amount]` | Decrease player reputation |

### Goodwill
| Command | Params | Notes |
|---|---|---|
| `reward_gw` | `[amount, faction?]` | Increase goodwill with faction |
| `punish_gw` | `[amount, faction?]` | Decrease goodwill with faction |
| `change_faction_relations` | `[faction1, faction2, amount]` | Change global faction diplomacy |

### Items
| Command | Params | Notes |
|---|---|---|
| `give_item` | `[item]` | Spawn item in player inventory. **item = placeholder.** |
| `take_item` | `[item]` | Remove item from player inventory. **item = placeholder.** |
| `give_item_count` | `[item, count]` | Give multiple copies. **item = placeholder.** |

### Stash Rewards
| Command | Params | Notes |
|---|---|---|
| `reward_stash` | `[]` | Give a random stash location |
| `reward_stash_at` | `[stash_name]` | Give specific stash. **stash_name = placeholder.** |
| `reward_stash_items` | `[items_plus_separated]` | Random stash with specific items. **items = placeholders.** |
| `reward_stash_items_at` | `[stash_name, items_plus_separated]` | Specific stash with specific items. **Both = placeholders.** |

### Knowledge
| Command | Params | Notes |
|---|---|---|
| `give_info` | `[info_id]` | Give player info portion. **info_id = placeholder.** |
| `disable_info` | `[info_id]` | Remove info portion. **info_id = placeholder.** |
| `give_task` | `[task_id]` | Assign vanilla task. **task_id = placeholder.** |
| `complete_task` | `[task_id]` | Complete vanilla task. **task_id = placeholder.** |
| `fail_task` | `[task_id]` | Fail vanilla task. **task_id = placeholder.** |

### Player Effects
| Command | Params | Notes |
|---|---|---|
| `heal_player` | `[amount]` | Restore health % (1–100) |
| `damage_player` | `[amount]` | Reduce health % (1–99, does not kill) |
| `give_radiation` | `[amount]` | Apply radiation % (1–100) |
| `cure_radiation` | `[]` | Remove all radiation |
| `give_hunger` | `[amount]` | Make player hungry |
| `cure_hunger` | `[amount]` | Feed player |
| `boost_speed` | `[multiplier, duration_s]` | Temporary speed boost (1.1–3.0) |
| `slow_speed` | `[multiplier, duration_s]` | Temporary speed reduction (0.1–0.9) |
| `change_rank` | `[amount]` | Modify rank points (positive or negative) |
| `change_player_faction` | `[faction]` | Switch player faction. Use sparingly — major state change. |
| `teleport_player_to_smart` | `[smart_terrain, delay?]` | Teleport player. **smart_terrain = placeholder.** |

### World Effects
| Command | Params | Notes |
|---|---|---|
| `set_weather` | `[weather_type]` | Change weather. Values: `w_clear`, `w_cloudy`, `w_partly`, `w_foggy`, `w_rain1`, `w_rain2`, `w_storm1`, `w_storm2` |
| `give_game_news` | `[title, message, duration?]` | Show news popup. Duration 1–30 seconds. |

### NPC Manipulation
| Command | Params | Notes |
|---|---|---|
| `set_npc_hostile` | `[]` | Make conversation NPC hostile |
| `set_npc_friendly` | `[]` | Make conversation NPC friendly |
| `set_npc_neutral` | `[]` | Make conversation NPC neutral |
| `set_npc_state` | `[state]` | State: `hostile`, `neutral`, `friendly` |
| `change_npc_faction` | `[faction]` | Change NPC faction |
| `change_npc_rank` | `[amount]` | Modify NPC rank points |
| `equip_npc_item` | `[item]` | Give item to NPC. **item = placeholder.** |
| `kill_npc` | `[]` | Kill conversation NPC |
| `recruit_companion` | `[no_dismiss?]` | Convert NPC to companion. Pass `"no_dismiss"` to prevent dismissal. |
| `dismiss_companion` | `[]` | Dismiss NPC from companion squad |
| `set_companion_state` | `[state]` | Set companion behavior. States: `free`, `follow`, `wait`, `surge_cover` |
| `make_npc_invulnerable` | `[duration_s]` | Temporary invulnerability |
| `set_npc_animation` | `[preset_id, duration?]` | Play animation preset. Presets: `smoke_stand`, `smoke_sit`, `use_pda`, `guard_attention`, `sit_ground`, `sit_chair`, `sit_knee`, `sleep_ground`, `sleep_sit`, `wounded_heavy_1`, `wounded_heavy_2`, `wounded_heavy_3`, `drink_vodka_stand`, `drunk_stand`, `laugh` |
| `clear_npc_animation` | `[]` | Stop animation |
| `ceasefire` | `[radius?]` | Make nearby NPCs temporarily non-hostile |
| `teleport_npc_to_smart` | `[smart_terrain, delay?]` | Move NPC to location. **smart_terrain = placeholder.** |
| `teleport_npc_to_player` | `[delay?]` | Move NPC near player |

### Spawning
| Command | Params | Notes |
|---|---|---|
| `spawn_custom_npc` | `[template_id, delay?]` | Spawn your custom NPC near player. Template is defined in your file. |
| `spawn_custom_npc_at` | `[template_id, smart_terrain, delay?]` | Spawn custom NPC at location. **smart_terrain = placeholder.** |
| `spawn_mutant` | `[squad_section, distance_m, delay?, count?]` | Spawn mutant squad near player. **squad_section = placeholder.** |
| `spawn_mutant_at_smart` | `[squad_section, smart_terrain, delay?, count?]` | Spawn mutant at location. **Both = placeholders.** |
| `spawn_npc_squad` | `[squad_section, distance_m, delay?, count?, state?]` | Spawn faction squad near player. **squad_section = placeholder.** State: `hostile`, `neutral`, `friendly`, `default` |
| `spawn_npc_squad_at_smart` | `[squad_section, smart_terrain, delay?, count?, state?]` | Spawn faction squad at location. **Both = placeholders.** |

### Location Watching
| Command | Params | Notes |
|---|---|---|
| `watch_location` | `[smart_terrain, radius?]` | Mark location on map. **smart_terrain = placeholder.** |
| `watch_location_trigger` | `[smart_terrain, trigger_command, radius?]` | Mark location and fire command on arrival. **smart_terrain = placeholder.** Chain multiple trigger commands with `+`. |

### Task Commands (PANDA task system)

These create PDA-tracked tasks with branching success/fail turns.
`success_turn` and `fail_turn` are turn numbers in the same conversation.

| Command | Params | Notes |
|---|---|---|
| `panda_task_delivery` | `[destination?, timeout_s, success_turn, fail_turn]` | Deliver auto package. **destination (optional) = smart_terrain placeholder.** |
| `panda_task_fetch` | `[item, count, timeout_s, success_turn, fail_turn]` | Find and return item. **item = placeholder.** |
| `panda_task_bounty` | `[faction, rank?, smart_terrain, timeout_s, success_turn, fail_turn]` | Kill target NPC. **smart_terrain = placeholder.** |
| `panda_task_dead_drop` | `[item, smart_terrain, timeout_s, success_turn, fail_turn]` | Deliver item to location. **Both = placeholders.** |
| `panda_task_dead_drop_stash` | `[stash_name, item, timeout_s, success_turn, fail_turn]` | Deposit item at stash box. **Both = placeholders.** |
| `panda_task_fetch_from_stash` | `[stash_name, item, timeout_s, success_turn, fail_turn]` | Retrieve item from stash. **Both = placeholders.** |
| `panda_task_artifact` | `[artifact_section, detector_tier?, timeout_s, success_turn, fail_turn]` | Find artifact. **artifact_section = placeholder.** Detector tiers: `basic`, `advanced`, `elite`, `scientific` |
| `panda_task_escort` | `[smart_terrain, timeout_s, success_turn, fail_turn, target_kind?, target_id?, spawn_distance?]` | Escort NPC to destination. **smart_terrain = placeholder.** target_kind: `sender`, `story_npc`, `custom_npc`, `spawn_faction` |
| `panda_task_eliminate` | `[target_type, smart_terrain, radius?, timeout_s, success_turn, fail_turn, squad_count?, state?]` | Eliminate enemies at location. **Both = placeholders.** |
| `panda_task_rescue` | `[enemy_squad, smart_terrain, squad_count?, survivor_template?, timeout_s, success_turn, fail_turn, state?]` | Rescue survivor from enemies. **enemy_squad, smart_terrain = placeholders.** |

### Job Timer
| Command | Params | Notes |
|---|---|---|
| `pause_job` | `[timeout_s, success_turn, fail_turn]` | Wait for spawned entities to die, then branch |

---

## Task Conversation Structure Pattern

Any task conversation needs these turns at minimum:

```
Turn 1: Job offer (pda_entry: true)
  Choice A → accept → outcomes: [task command] → terminal: true
  Choice B → ask details → continueTo: Turn 2
  Choice C → refuse → terminal: true

Turn 2 (optional detail): More NPC context
  Choice A → accept → outcomes: [task command] → terminal: true
  Choice B → refuse → terminal: true

Turn N (success turn): Task completed message
  Choice 1 → "Understood." → terminal: true

Turn N+1 (fail turn): Task failed message
  Choice 1 → "Understood." → terminal: true
```

The `success_turn` and `fail_turn` params in task commands reference the `turnNumber` values.

---

## Custom NPC Templates

If your storyline spawns a custom NPC, add an `npcTemplates` array to the project root:

```json
{
  "version": "2.0.0",
  "faction": "stalker",
  "npcTemplates": [
    {
      "id": "informant",
      "name": "Whisper",
      "faction": "stalker",
      "rank": "experienced",
      "relation": "friendly",
      "spawnMode": "player",
      "spawnDist": 20,
      "allowRoam": true
    }
  ],
  "conversations": [ ... ]
}
```

| Field | Notes |
|---|---|
| `id` | Unique template ID. Used in `spawn_custom_npc`, `req_custom_npc_alive`, etc. |
| `name` | Display name in-game. |
| `faction` | Faction ID. |
| `rank` | Rank name. |
| `relation` | `"friendly"`, `"neutral"`, or `"hostile"` |
| `primary` | Primary weapon item section. **Leave as placeholder.** |
| `secondary` | Secondary weapon item section. **Leave as placeholder.** |
| `outfit` | Armor item section. **Leave as placeholder.** |
| `items` | Comma-separated items to carry. **Leave as placeholder.** |
| `spawnMode` | `"player"` (near player) or `"smart"` (at smart terrain) |
| `spawnDist` | Meters from player. Only for `spawnMode: "player"`. |
| `smartTerrain` | Smart terrain key. Only for `spawnMode: "smart"`. **Leave as placeholder.** |
| `allowRoam` | `true` to let NPC wander after spawn |
| `trader` | `true` if NPC should act as trader |

---

## Narrative Guidelines for S.T.A.L.K.E.R. Anomaly

### Tone
- Terse, pragmatic. NPCs in the Zone do not waste words.
- Characters assume mutual familiarity with Zone survival conditions.
- Fatalism is acceptable; melodrama is not.
- Dry humor through understatement, not jokes.

### NPC Voice by Faction
| Faction | Voice pattern |
|---|---|
| Loner (stalker) | Street-smart, survival-focused, slightly cynical |
| Duty (dolg) | Military discipline, mission-first, clipped orders |
| Freedom | Loose, anti-authority, philosophical, occasionally cavalier about danger |
| Ecologists | Technical vocabulary, risk-averse, transactional |
| Mercenaries | Professional, mercenary logic, everything is a contract |
| Military (army) | Formal address, bureaucratic framing, suspicious of civilians |
| Bandits | Crude, threatening, opportunistic |
| Monolith | Fanatical, fragmented, quasi-religious — use sparingly |

### Message Length
- Opening messages: 1–3 sentences. State the situation directly.
- Choice text: 1 sentence per choice. Player voice, present tense.
- Reply text: 1–2 sentences. NPC confirms or reacts.
- Avoid ellipses as a dramatic pause device. Use them only for genuine trailing-off.

### Dialogue Patterns to Avoid
- "I need you to..." (too soft — Zone NPCs make demands or offers, not requests)
- "Would you be so kind as to..." (never)
- Rhetorical questions as opening lines
- Exposition dumps longer than 3 sentences

---

## Complete Example — Fetch Task with Detail Branch

```json
{
  "version": "2.0.0",
  "faction": "stalker",
  "conversations": [
    {
      "id": 1,
      "label": "Supply run — antiseptics",
      "faction": "stalker",
      "initialChannel": "pda",
      "startMode": "pda",
      "language": "en",
      "repeatable": true,
      "preconditions": [
        {
          "type": "simple",
          "command": "req_npc_friendly",
          "params": []
        },
        {
          "type": "simple",
          "command": "req_rank",
          "params": ["novice"]
        }
      ],
      "turns": [
        {
          "turnNumber": 1,
          "customLabel": "Offer",
          "openingMessage": "Short on antiseptics. Half the camp is walking around with infected cuts. Three units, fifteen minutes. Standard rate.",
          "preconditions": [],
          "channel": "pda",
          "firstSpeaker": "npc",
          "pda_entry": true,
          "f2f_entry": false,
          "choices": [
            {
              "index": 1,
              "text": "Done. Fifteen minutes.",
              "channel": "pda",
              "preconditions": [],
              "reply": "Move.",
              "outcomes": [
                {
                  "command": "panda_task_fetch",
                  "params": ["PLACEHOLDER_ITEM", "3", "900", "2", "3"],
                  "_note": "Replace PLACEHOLDER_ITEM with antiseptic item section, e.g. antibiotic"
                },
                {
                  "command": "reward_gw",
                  "params": ["15", "stalker"]
                }
              ],
              "terminal": true,
              "allow_generic_stalker": false
            },
            {
              "index": 2,
              "text": "What happened to your camp stock?",
              "channel": "pda",
              "preconditions": [],
              "reply": "Ran a patrol two days back. Heavy contact. Used what we had.",
              "outcomes": [],
              "terminal": false,
              "allow_generic_stalker": false,
              "continueTo": 4,
              "continueChannel": "pda",
              "continue_channel": "pda"
            },
            {
              "index": 3,
              "text": "Not my problem.",
              "channel": "pda",
              "preconditions": [],
              "reply": "Fine. Someone else will take it.",
              "outcomes": [],
              "terminal": true,
              "allow_generic_stalker": false
            }
          ],
          "position": { "x": 200, "y": 400 }
        },
        {
          "turnNumber": 2,
          "customLabel": "Success",
          "openingMessage": "That will do. Here.",
          "preconditions": [],
          "channel": "pda",
          "firstSpeaker": "npc",
          "pda_entry": false,
          "f2f_entry": false,
          "choices": [
            {
              "index": 1,
              "text": "Anytime.",
              "channel": "pda",
              "preconditions": [],
              "reply": "Do not make promises.",
              "outcomes": [
                {
                  "command": "reward_money",
                  "params": ["300"]
                }
              ],
              "terminal": true,
              "allow_generic_stalker": false
            }
          ],
          "position": { "x": 1200, "y": 200 }
        },
        {
          "turnNumber": 3,
          "customLabel": "Failure",
          "openingMessage": "Too slow. Got them from somewhere else.",
          "preconditions": [],
          "channel": "pda",
          "firstSpeaker": "npc",
          "pda_entry": false,
          "f2f_entry": false,
          "choices": [
            {
              "index": 1,
              "text": "Happens.",
              "channel": "pda",
              "preconditions": [],
              "reply": "Next time be faster.",
              "outcomes": [],
              "terminal": true,
              "allow_generic_stalker": false
            }
          ],
          "position": { "x": 1200, "y": 600 }
        },
        {
          "turnNumber": 4,
          "customLabel": "Context",
          "openingMessage": "Lost two stalkers. Three more with infected wounds. We used everything. This is not a complaint, just the situation.",
          "preconditions": [],
          "channel": "pda",
          "firstSpeaker": "npc",
          "pda_entry": false,
          "f2f_entry": false,
          "choices": [
            {
              "index": 1,
              "text": "I will get them.",
              "channel": "pda",
              "preconditions": [],
              "reply": "Good. Clock is running.",
              "outcomes": [
                {
                  "command": "panda_task_fetch",
                  "params": ["PLACEHOLDER_ITEM", "3", "900", "2", "3"],
                  "_note": "Replace PLACEHOLDER_ITEM with antiseptic item section"
                },
                {
                  "command": "reward_gw",
                  "params": ["15", "stalker"]
                }
              ],
              "terminal": true,
              "allow_generic_stalker": false
            },
            {
              "index": 2,
              "text": "Still not my problem.",
              "channel": "pda",
              "preconditions": [],
              "reply": "Understood.",
              "outcomes": [],
              "terminal": true,
              "allow_generic_stalker": false
            }
          ],
          "position": { "x": 750, "y": 500 }
        }
      ]
    }
  ],
  "systemStrings": {}
}
```

---

## Checklist Before Submitting a Storyline

- [ ] Every `panda_task_*` command has a valid `success_turn` and `fail_turn` pointing to existing turn numbers.
- [ ] Every non-terminal choice has `continueTo` set to a valid turn number.
- [ ] Every terminal choice has `terminal: true` and no `continueTo`.
- [ ] Turn 1 has `pda_entry: true` (for PDA conversations).
- [ ] Success and failure turns each have at least one terminal choice.
- [ ] All `PLACEHOLDER_*` values are annotated with `"_note"` keys explaining what goes there.
- [ ] No smart terrain, item section, squad section, stash name, story NPC ID, zone name, or info portion ID was invented — all are placeholders.
- [ ] Faction IDs are from the faction list above.
- [ ] Rank names are from the rank list above.
- [ ] Dialogue is terse and fits the S.T.A.L.K.E.R. tone.
- [ ] The file is valid JSON.
