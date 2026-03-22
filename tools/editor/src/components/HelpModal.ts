// P.A.N.D.A. Conversation Editor — Help Modal

import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon } from './icons';

let modalElement: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;

export function openHelpModal(): void {
  if (modalElement) return;

  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) closeHelpModal();
  };

  const modal = document.createElement('div');
  modal.className = 'help-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'help-modal-title');

  // Header
  const header = document.createElement('div');
  header.className = 'help-modal-header';

  const title = document.createElement('div');
  title.className = 'help-modal-title';
  title.id = 'help-modal-title';
  title.append(createIcon('help'), document.createTextNode('P.A.N.D.A. — How To Write Conversations'));
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close help';
  closeBtn.onclick = closeHelpModal;
  header.appendChild(closeBtn);

  modal.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'help-modal-body';
  body.innerHTML = HELP_CONTENT;
  modal.appendChild(body);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modalElement = overlay;
  focusTrap = trapFocus(modal, {
    restoreFocus: restoreFocusEl,
    initialFocus: closeBtn,
    onEscape: closeHelpModal,
  });
}


function closeHelpModal(): void {
  if (modalElement) {
    modalElement.remove();
    modalElement = null;
  }
  focusTrap?.release();
  focusTrap = null;
  restoreFocusEl = null;
}

const HELP_CONTENT = `
<h2>1. Overview</h2>
<p>P.A.N.D.A. (Procedural Anomaly Narrative Dialogue Architecture) is a modular interactive conversation system for S.T.A.L.K.E.R. Anomaly. Conversations are delivered as PDA text messages — think of them as long-distance radio/text exchanges between the player and NPCs who are physically present somewhere in the game world.</p>
<p><strong>ALL conversations happen over PDA text.</strong> The NPC is not standing in front of the player. They are messaging from wherever they are in the Zone. Write accordingly — no physical actions ("hands you a package"), no visual descriptions ("looks nervous"). Text messages only.</p>
<p>Each faction has its own XML file containing conversations for players of that faction.</p>

<h2>2. How the System Works</h2>
<ol>
  <li>Finds all eligible NPCs in the game world (alive, not in combat, not on cooldown, minimum distance from player, not a trader/zombified/monolith).</li>
  <li>Scans through ALL conversations in the player's faction XML file.</li>
  <li>For each NPC candidate, checks every conversation's preconditions against that NPC. ALL preconditions must pass (AND logic).</li>
  <li>From all eligible conversation+NPC pairs, picks one at random (weighted by cooldown).</li>
  <li>Sends the opening message to the player's PDA and presents response choices.</li>
</ol>

<h2>3. XML Key Format</h2>
<p>Base format: <code>st_pda_ic_&lt;faction&gt;_&lt;id&gt;_&lt;suffix&gt;</code></p>
<h3>Required Components</h3>
<ul>
  <li><code>_precond</code> — Comma-separated precondition list</li>
  <li><code>_open</code> — Opening message from the NPC</li>
  <li><code>_choice_1</code> — Player's first response option (min 1, max 4)</li>
  <li><code>_reply_1</code> — NPC's reply to choice 1</li>
  <li><code>_outcome_1</code> — Outcome commands for choice 1 (use "none" for no outcome)</li>
</ul>
<h3>Optional Components</h3>
<ul>
  <li><code>_choice_2</code> through <code>_choice_4</code> — Additional player choices</li>
  <li><code>_reply_2</code> through <code>_reply_4</code> — NPC replies</li>
  <li><code>_outcome_2</code> through <code>_outcome_4</code> — Outcomes</li>
  <li><code>_cont_1</code> through <code>_cont_4</code> — Next turn ID for branching</li>
  <li><code>_timeout</code> — Custom timeout in seconds</li>
  <li><code>_timeout_msg</code> — Custom annoyed message when player ignores NPC</li>
</ul>

<h2>4. Preconditions Reference</h2>
<p>All preconditions are defined in the <code>_precond</code> string entry, comma-separated. ALL must pass (AND logic).</p>
<h3>NPC Relation (Goodwill-Based)</h3>
<ul>
  <li><code>req_npc_friendly</code> / <code>req_npc_friendly:&lt;faction&gt;</code> — NPC must be friendly/neutral</li>
  <li><code>req_npc_hostile</code> / <code>req_npc_hostile:&lt;faction&gt;</code> — NPC must be hostile</li>
</ul>
<h3>NPC Faction</h3>
<ul>
  <li><code>req_npc_faction:&lt;faction&gt;</code> — NPC must belong to this faction</li>
  <li><code>req_npc_not_faction:&lt;faction&gt;</code> — NPC must NOT belong to this faction</li>
</ul>
<h3>Rank</h3>
<ul>
  <li><code>req_npc_rank:&lt;rank&gt;</code> / <code>req_npc_rank_max:&lt;rank&gt;</code> — NPC rank min/max</li>
  <li><code>req_rank:&lt;rank&gt;</code> / <code>req_rank_max:&lt;rank&gt;</code> — Player rank min/max</li>
  <li>Ranks: novice, trainee, experienced, professional, veteran, expert, master, legend</li>
</ul>
<h3>Money &amp; Reputation</h3>
<ul>
  <li><code>req_money:&lt;amount&gt;</code> / <code>req_money_max:&lt;amount&gt;</code></li>
  <li><code>req_rep:&lt;value&gt;</code> / <code>req_rep_max:&lt;value&gt;</code></li>
</ul>
<h3>Kills</h3>
<ul>
  <li><code>req_kills:&lt;count&gt;</code> — Stalker kills</li>
  <li><code>req_mutant_kills:&lt;count&gt;</code> — Mutant kills</li>
</ul>
<h3>Faction Goodwill</h3>
<ul>
  <li><code>req_goodwill:&lt;amount&gt;:&lt;faction&gt;</code> / <code>req_goodwill_max:&lt;amount&gt;:&lt;faction&gt;</code></li>
</ul>
<h3>Location</h3>
<ul>
  <li><code>req_level:&lt;level_name&gt;</code> / <code>req_not_level:&lt;level_name&gt;</code></li>
  <li><code>req_actor_near_smart:&lt;smart_key&gt;:&lt;meters&gt;</code></li>
  <li><code>req_npc_near_smart:&lt;smart_key&gt;:&lt;meters&gt;</code></li>
  <li><code>req_actor_in_zone:&lt;zone_name&gt;</code></li>
</ul>
<h3>Companions &amp; Inventory</h3>
<ul>
  <li><code>req_companions:&lt;count&gt;</code> / <code>req_companions_max:&lt;count&gt;</code></li>
  <li><code>req_has_item:&lt;section_name&gt;</code></li>
  <li><code>req_equipped:&lt;section_name&gt;</code> / <code>req_equipped_slot:&lt;slot&gt;</code></li>
</ul>
<h3>Time &amp; Weather</h3>
<ul>
  <li><code>req_time_day</code> / <code>req_time_night</code></li>
  <li><code>req_surge_soon:&lt;seconds&gt;</code> / <code>req_not_surge_soon:&lt;seconds&gt;</code></li>
  <li><code>req_psi_storm_soon:&lt;seconds&gt;</code></li>
  <li><code>req_weather_fx_active</code> / <code>req_weather_fx_not_active</code></li>
</ul>
<h3>Health &amp; Achievements</h3>
<ul>
  <li><code>req_health_min:&lt;value&gt;</code> / <code>req_health_max:&lt;value&gt;</code> — 0.0 to 1.0</li>
  <li><code>req_achievement:&lt;name&gt;</code></li>
</ul>
<h3>Faction Name List</h3>
<p><code>stalker/loner</code>, <code>dolg/duty</code>, <code>freedom</code>, <code>bandit</code>, <code>army/military</code>, <code>killer/mercenary</code>, <code>ecolog/scientist</code>, <code>csky/clear_sky</code>, <code>monolith</code>, <code>renegade</code>, <code>greh</code>, <code>isg</code>, <code>zombied/zombie</code></p>

<h2>5. Outcomes Reference</h2>
<p>Actions that happen when the player picks a response. Use <code>none</code> for no outcome. Comma-separate multiple outcomes.</p>
<h3>Money &amp; Reputation</h3>
<ul>
  <li><code>reward_money:&lt;amount&gt;</code> / <code>punish_money:&lt;amount&gt;</code></li>
  <li><code>reward_rep:&lt;amount&gt;</code> / <code>punish_rep:&lt;amount&gt;</code></li>
</ul>
<h3>Faction Goodwill</h3>
<ul>
  <li><code>reward_gw:&lt;amount&gt;:&lt;faction&gt;</code> / <code>punish_gw:&lt;amount&gt;:&lt;faction&gt;</code></li>
</ul>
<h3>Items</h3>
<ul>
  <li><code>give_item:&lt;section_name&gt;</code> — Spawn into inventory</li>
  <li><code>courier_item:&lt;section_name&gt;</code> — Spawn courier NPC</li>
</ul>
<h3>Spawning</h3>
<ul>
  <li><code>spawn_hostile:&lt;faction&gt;:&lt;distance&gt;</code></li>
  <li><code>spawn_friendly:&lt;faction&gt;:&lt;distance&gt;[:delay]</code></li>
  <li><code>spawn_npc:&lt;squad_section_or_faction&gt;:&lt;distance&gt;[:delay]</code></li>
  <li><code>spawn_mutant:&lt;mutant_squad_section_or_type&gt;:&lt;distance&gt;</code></li>
  <li><code>spawn_mutant_at_smart:&lt;mutant_squad_section_or_type&gt;:&lt;smart_key&gt;[:delay]</code></li>
  <li><code>spawn_hostile_at_smart:&lt;faction&gt;:&lt;smart_key&gt;[:delay]</code></li>
  <li><code>spawn_companion:&lt;faction&gt;:&lt;distance&gt;</code></li>
</ul>
<h3>Stash &amp; Location Markers</h3>
<ul>
  <li><code>reward_stash</code> — Reveal a random stash location</li>
  <li><code>watch_location:&lt;smart_key&gt;[:radius]</code></li>
  <li><code>watch_location_trigger:&lt;smart_key&gt;:&lt;command&gt;:&lt;params&gt;:&lt;radius&gt;</code></li>
</ul>
<h3>NPC Teleportation &amp; Companion</h3>
<ul>
  <li><code>teleport_npc_to_smart:&lt;smart_key&gt;[:delay]</code></li>
  <li><code>teleport_npc_to_player[:delay]</code></li>
  <li><code>recruit_companion[:no_dismiss]</code></li>
</ul>
<h3>Job Tracking</h3>
<ul>
  <li><code>pause_job:&lt;timeout_seconds&gt;:&lt;success_turn&gt;:&lt;fail_turn&gt;</code> — Must be in the same outcome as spawn commands</li>
</ul>
<h3>Chance Modifier</h3>
<ul>
  <li><code>chance:&lt;percent&gt;:&lt;command&gt;</code> — Roll a percentage chance before executing</li>
</ul>

<h2>6. Dynamic Placeholders</h2>
<p>Use in dialogue text. Replaced at runtime with real game data:</p>
<ul>
  <li><code>$player_name</code>, <code>$npc_name</code>, <code>$player_faction</code>, <code>$npc_faction</code></li>
  <li><code>$current_level</code>, <code>$player_money</code>, <code>$player_rank</code>, <code>$player_reputation</code></li>
  <li><code>$companion_count</code>, <code>$time_of_day</code>, <code>$game_hour</code></li>
  <li><code>%&lt;level&gt;_panda_st%</code> — Random real smart terrain name (for dialogue text)</li>
  <li><code>%&lt;level&gt;_panda_st_key%</code> — Same location's key (for command parameters)</li>
</ul>

<h2>7. Smart Terrain Location System</h2>
<p>Use <code>%&lt;level&gt;_panda_st%</code> in dialogue text to reference a random real vanilla game location. The system caches the chosen location for the entire conversation. Use <code>%&lt;level&gt;_panda_st_key%</code> in command parameters.</p>
<p>Available level keys: cordon, darkscape, swamp, garbage, agroprom, darkvalley, yantar, wildterritory, rostok, deadcity, truck_cemetery, meadow, radar, red_forest, limansk, pripyat, generators, outskirts, jupiter, south_cnpp, north_cnpp, zaton</p>

<h2>8. Multi-Turn Conversations</h2>
<p>Use <code>_cont_N</code> suffix to specify the next turn. Turn 2 keys use <code>_t2_</code> prefix, Turn 3 uses <code>_t3_</code>, etc.</p>
<p>If <code>_cont_1</code> is "2", after the player picks choice 1, the conversation continues with turn 2 choices. If absent, the conversation ends.</p>

<h2>9. Conversation Timeouts</h2>
<ul>
  <li><code>_timeout</code> — Seconds before NPC gets annoyed (default: random 90-300)</li>
  <li><code>_timeout_msg</code> — Custom annoyed message</li>
</ul>

<h2>10. Job System (Kill Tracking)</h2>
<p><code>pause_job:&lt;timeout&gt;:&lt;success_turn&gt;:&lt;fail_turn&gt;</code> — Pause conversation and wait for all spawned squads to be killed. Must appear in the same outcome string as spawn commands.</p>
<p>Use <code>+</code> to chain commands inside <code>watch_location_trigger</code>. Use <code>,</code> to separate top-level outcomes.</p>

<h2>11. Writing Rules</h2>
<h3>Immersion &amp; Tone</h3>
<ul>
  <li>These are TEXT MESSAGES — short sentences, abbreviations, slang</li>
  <li>Not everyone is friendly — vary personalities (gruff veterans, nervous rookies, sarcastic traders, hostile contacts)</li>
  <li>Stay lore-friendly. Reference the Zone, artifacts, anomalies, mutants, factions</li>
  <li>Use real data via placeholders (<code>$player_name</code>, <code>$npc_faction</code>, etc.)</li>
</ul>
<h3>Locations</h3>
<ul>
  <li>NEVER reference fictional locations</li>
  <li>Use <code>%&lt;level&gt;_panda_st%</code> placeholders for locations</li>
  <li>Never describe stash locations — system picks them randomly</li>
</ul>
<h3>Outcomes</h3>
<ul>
  <li>Match outcomes to dialogue context</li>
  <li>Some outcomes are outside your control (stash locations, spawn positions, courier appearance)</li>
</ul>
<h3>Preconditions</h3>
<ul>
  <li>Every conversation MUST have a <code>_precond</code> entry</li>
  <li>Write dialogue that MATCHES the preconditions</li>
</ul>
<h3>General Craft</h3>
<ul>
  <li>Keep conversations concise (1-3 sentences per message)</li>
  <li>Give meaningful choices with different outcomes</li>
  <li>Use multi-turn sparingly (1-2 turns usually)</li>
</ul>

<h2>12. Common Mistakes</h2>
<ul>
  <li>Using <code>pause_job</code> without spawn commands in the same outcome</li>
  <li>Writing fictional locations — use smart terrain placeholders instead</li>
  <li>Describing stash locations in dialogue — write vaguely</li>
  <li>Physical actions in text messages — this is PDA text, not in-person</li>
  <li>Every NPC sounding the same — give them personality</li>
  <li>Missing preconditions — always set at least friendly/hostile</li>
  <li>Hardcoding NPC names — use <code>$npc_name</code> placeholder</li>
</ul>
`;
