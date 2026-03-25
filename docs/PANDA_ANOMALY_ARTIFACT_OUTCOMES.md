# P.A.N.D.A anomaly + artifact outcome lane (schema v2)

## Phase 1 — Reference recon source map (reference-only files)

| Script | Purpose | Callable(s) used for mapping | Risky side effects to avoid in direct calls |
|---|---|---|---|
| `tasks_anomaly_scanner.script` | Scanner task helper and anomaly id resolution. | `get_anomaly_id` | Tightly coupled to task ids and name-id linkage; direct use can desync custom task ids. |
| `bind_anomaly_zone.script` | Core anomaly zone lifecycle and artifact spawn logic. | `force_spawn_artefacts`, `anomaly_zone_binder:*` (`spawn_artefact_randomly`, `turn_on`, `turn_off`, `refresh`) | Touches zone runtime state, spawn timers, binder save/load; direct mutation can break vanilla zone refresh cadence. |
| `bind_anomaly_field.script` | Field activation/markers/dynamic anomalies runtime. | `dyn_anomalies_refresh`, `anomaly_field_binder:set_enable`, `pulse_anomaly_update` | Registers callbacks and field damage/audio; unsafe toggles can leave invisible active hazards. |
| `db.script` | Global registries (`db.*`) including anomaly lookup maps. | `add_anomaly`, `del_anomaly` (manages `db.anomaly_by_name`) | Registry lifecycle is global; stale references if objects go offline or unload. |
| `se_artefact.script` | Server-side artifact entity lifecycle/online switching. | `se_artefact:on_register`, `on_unregister` | Offline/online policy impacts object persistence and switch behavior. |
| `task_status_functor.script` | Task completion/failure functors and status checks. | `drx_sl_*_task_status`, helper checks | Functors can auto-complete/fail tasks if assumptions mismatch custom task structure. |
| `dialogs_zaton.script` | Dialog transfer patterns for artifacts/money/items. | `actor_has_artefact`, `zat_b14_transfer_artefact`, `zat_b29_*` | Transfer functions remove inventory items; easy to duplicate/remove wrong section without guards. |
| `xr_effects.script` | Generic reward/spawn/task stage effects. | `spawn_item_at_pos`, `set_task_stage`, reward helpers | Wide side effects (rank/rep/info/task state); avoid broad effect calls for narrow lane logic. |
| `xr_conditions.script` | Condition checks used by dialogs/tasks. | `dist_to_task_target_anomaly_le`, `has_task_target_anomaly`, `has_task*` | Condition parsing depends on param ordering and actor/npc context. |
| `tasks_intercept_artifact.script` (mod ref) | Robust intercept artifact task pattern with state handling. | save/load helpers, init flow | Custom storage contracts must be preserved for save safety. |
| `tasks_guide.script` (mod ref) | Example of durable timer/state + cleanup paths. | timer helpers, `complete`, `fail` | Timer leakage if not cancelled on fail/cleanup. |

## Phase 1.2 — Editor-facing normalization table (validation defaults)

| Domain | Allowed value source | Aliases / tiers | Default |
|---|---|---|---|
| Artifact section | `af_*` sections (base + junk) and containerized variants (`*_lead_box`, `*_af_iam`, `*_af_aac`). | Alias accepted: `artefact` label in UI maps to `artifact` concept only; section names stay raw. | Must be explicit for retrieval/spawn outcomes. |
| Detector tier | `detector_simple`/`radio`/`geiger` => **basic**, `detector_advanced`, `detector_elite`, `detector_scientific`. | Tier progression: `basic < advanced < elite < scientific`. | `basic`. |
| Anomaly zone identifier | Runtime `db.anomaly_by_name` entry / anomaly zone section key (`[anomal_zone]` config-driven names). | No implicit aliases. | Required when zone-targeted outcomes are used. |
| UI text/icon ids | Existing string table ids (`st_*`) and icon ids already used by P.A.N.D.A runtime UI/news. | Custom ids allowed if exported with matching text entries. | P.A.N.D.A fallback sender/icon if omitted. |

## Phase 2 — Outcome contract (schema v2)

New outcomes:
- `start_anomaly_scan_task`
- `start_artifact_retrieval_task`
- `spawn_artifact_on_npc`
- `spawn_artifact_in_zone`
- `require_detector_tier`
- `turn_in_artifact`
- `set_anomaly_target`
- `fail_if_artifact_lost`

### Unified runtime record

```lua
{
  task_id,
  giver_id,
  target_npc_id,
  zone_name,
  artifact_section,
  artifact_object_id,
  detector_requirement,
  stage,
  expire_at,
  flags,
  last_known_owner_kind,
  last_seen_ts,
}
```

### Failure semantics
- Missing/invalid zone => outcome rejected + debug log; no partial state.
- Missing artifact section => rejected.
- Expired task => stage moves to `failed_expired`.
- Artifact-lost mode enabled => record can move to `failed_artifact_lost` in follow-up checks.
- NPC missing/offline for `spawn_artifact_on_npc` => rejected.
- Duplicate task id in one conversation => editor error.

## Phase 3 — Runtime integration (P.A.N.D.A-owned)

Implemented bridge script:
- `P.A.N.D.A DEV/gamedata/scripts/panda_anomaly_artifact_adapter.script`

Dispatcher bridge:
- `pda_interactive_conv.script` now routes all eight new outcomes through the adapter.
- Save/load now delegates adapter state serialization (`panda_anomaly_artifact_state`).

## Phase 4 — Editor support

- Added the 8 outcome schemas to the command picker.
- Added detector tier dropdown options.
- Project default schema version bumped to `2.0.0` for new/import fallback projects.
- Validation rails:
  - duplicate runtime anomaly task id in a single conversation => error,
  - more than 3 task-start outcomes in one conversation => warning.

## Phase 5 — Test checklist (author + runtime)

Script checks:
1. each new outcome with valid params,
2. invalid parameter rejection,
3. duplicate trigger idempotency,
4. save/load round-trip.

Manual in-game scenarios:
- detector gate pass/fail,
- NPC route and zone route retrieval,
- drop/stash/recover flow,
- target NPC death,
- map transition + reload continuity,
- turn-in completion/cleanup path.

## Phase 6 — Author quick examples

### Bring me an artifact

```text
start_artifact_retrieval_task:af_fetch_01:af_compass:red_smart_terrain_3_2_anomal_zone:elite:3600
spawn_artifact_in_zone:af_fetch_01:af_compass:red_smart_terrain_3_2_anomal_zone
turn_in_artifact:af_fetch_01:af_compass
```

### Scan anomaly then report

```text
require_detector_tier:advanced
start_anomaly_scan_task:scan_yan_01:labx18_2c_04_bioh_anomaly_spot:advanced:1800
set_anomaly_target:scan_yan_01:labx18_2c_04_bioh_anomaly_spot
```

### Intercept stalker carrying lead-box artifact

```text
start_artifact_retrieval_task:intercept_af_01:af_compass_lead_box:red_smart_terrain_6_3_anomal_zone:elite:2400
spawn_artifact_on_npc:intercept_af_01:<npc_id>:af_compass_lead_box
fail_if_artifact_lost:intercept_af_01:true
turn_in_artifact:intercept_af_01:af_compass_lead_box
```

## Troubleshooting

- Invalid section names: ensure exact section exists in item configs (`af_*` / container variant).
- Detector mismatch: `require_detector_tier` blocks branch execution; provide fallback reply path.
- Auto-fail causes: expiration hit, artifact-lost guard, missing target zone/npc at spawn step.
