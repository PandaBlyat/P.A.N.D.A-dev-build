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

  const header = document.createElement('div');
  header.className = 'help-modal-header';

  const title = document.createElement('div');
  title.className = 'help-modal-title';
  title.id = 'help-modal-title';
  title.append(createIcon('help'), document.createTextNode('P.A.N.D.A. — Quick Start & Framework Guide'));
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close help';
  closeBtn.onclick = closeHelpModal;
  header.appendChild(closeBtn);

  modal.appendChild(header);

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
<section class="help-hero">
  <span class="help-kicker">New here?</span>
  <h2>Think of P.A.N.D.A. as: <em>who can message you</em> + <em>what they say</em> + <em>what your reply does next</em>.</h2>
  <p>P.A.N.D.A. (Procedural Anomaly Narrative Dialogue Architecture) is a modular conversation framework for S.T.A.L.K.E.R. Anomaly. It can handle tiny one-off flavor exchanges, reactive faction chatter, branching multi-turn scenes, and even mini task-like interactions that spawn events, track progress, and continue later.</p>
  <p>Everything still follows one easy mental model: a conversation becomes available when its <strong>preconditions</strong> match, the text can pull in live game data through <strong>dynamic references</strong>, and each player reply can fire <strong>outcomes</strong> that change the world or move the conversation forward.</p>
</section>

<section class="help-callout">
  <strong>Quick mental model</strong>
  <ol class="help-flow-list">
    <li><strong>Preconditions</strong> decide whether a conversation is allowed to trigger.</li>
    <li><strong>Opening message</strong> is the NPC's PDA text to the player.</li>
    <li><strong>Choices</strong> let the player answer in different tones or directions.</li>
    <li><strong>Replies + continue targets</strong> create follow-up turns and branching paths.</li>
    <li><strong>Outcomes</strong> reward, punish, spawn, mark, teleport, recruit, or otherwise react to the player's choice.</li>
  </ol>
</section>

<h2>1. What are preconditions?</h2>
<div class="help-grid">
  <article class="help-card">
    <h3>Simple explanation</h3>
    <p>Preconditions are the conversation's filter rules. They answer: <em>"Should this NPC be allowed to send this conversation right now?"</em></p>
    <p>If the rules do not match, the conversation is invisible. If they do match, it becomes eligible.</p>
  </article>
  <article class="help-card">
    <h3>How they behave</h3>
    <p>All top-level preconditions are checked before a conversation can trigger. In normal use, think of them as your context lock: faction, rank, goodwill, money, location, time of day, inventory, companions, and more.</p>
    <p>Use them to make the conversation feel believable before the first line is even shown.</p>
  </article>
  <article class="help-card">
    <h3>Good first-time example</h3>
    <p><code>req_npc_friendly:stalker</code> + <code>req_rank:veteran</code> says: only friendly stalkers should send this, and only after the player has earned enough status for that exchange to make sense.</p>
  </article>
</div>
<p class="help-note"><strong>Rule of thumb:</strong> if a conversation should only happen in a specific situation, express that in preconditions instead of trying to explain it awkwardly in the dialogue text.</p>

<h2>2. What are dynamic references?</h2>
<div class="help-grid">
  <article class="help-card">
    <h3>Simple explanation</h3>
    <p>Dynamic references are live placeholders. You write a token such as <code>$player_name</code> or <code>%&lt;level&gt;_panda_st%</code>, and the framework replaces it with real runtime data.</p>
  </article>
  <article class="help-card">
    <h3>Why they matter</h3>
    <p>They let one conversation feel personal and reactive without hardcoding every line. The same XML can mention the current level, the player's faction, the NPC's name, current money, or a real smart terrain chosen by the system.</p>
  </article>
  <article class="help-card">
    <h3>How to think about them</h3>
    <p>Use them as reusable building blocks for flavor, context, and location hints. They make authored text feel dynamic while keeping the structure clean.</p>
  </article>
</div>
<ul>
  <li><code>$player_name</code> / <code>$npc_name</code> for personal names.</li>
  <li><code>$player_faction</code>, <code>$player_rank</code>, <code>$player_money</code> for state-aware dialogue.</li>
  <li><code>%&lt;level&gt;_panda_st%</code> for a real location name in dialogue text.</li>
  <li><code>%&lt;level&gt;_panda_st_key%</code> for the matching smart-terrain key inside outcome parameters.</li>
</ul>

<h2>3. What are outcomes?</h2>
<div class="help-grid">
  <article class="help-card">
    <h3>Simple explanation</h3>
    <p>Outcomes are the effects that happen after the player picks a choice. If preconditions decide <em>whether</em> a conversation can happen, outcomes decide <em>what the choice actually causes</em>.</p>
  </article>
  <article class="help-card">
    <h3>Common uses</h3>
    <p>Rewards and penalties, spawning friendlies or hostiles, giving items, revealing stashes, marking locations, changing goodwill, teleporting NPCs, recruiting companions, and pausing into a task-like state.</p>
  </article>
  <article class="help-card">
    <h3>Design guidance</h3>
    <p>Match the effect to the fiction. If the NPC promises money, reward money. If they send the player to investigate a place, watch or trigger that location. If they call in trouble, spawn trouble.</p>
  </article>
</div>
<p class="help-note"><strong>Simple framing:</strong> outcomes are where your dialogue stops being words and starts becoming gameplay.</p>

<h2>4. How the framework scales from simple to advanced</h2>
<div class="help-grid help-grid-wide">
  <article class="help-card">
    <h3>Level 1 — one-turn flavor chat</h3>
    <p>A single opening message with one or two replies and no major consequences. Great for atmosphere, character voice, or lightweight worldbuilding.</p>
  </article>
  <article class="help-card">
    <h3>Level 2 — reactive conversation</h3>
    <p>Add sharper preconditions and better dynamic references so the same structure feels situational: a veteran, a bandit, a broke player, a night-time warning, a location-specific rumor.</p>
  </article>
  <article class="help-card">
    <h3>Level 3 — branching scene</h3>
    <p>Use multiple turns and <code>_cont_N</code> links so choices branch into follow-up messages, different tones, and different consequences.</p>
  </article>
  <article class="help-card">
    <h3>Level 4 — mini task / gameplay sequence</h3>
    <p>Use outcomes such as spawning squads, location watches, triggers, teleports, courier items, or <code>pause_job</code> to create custom mini tasks that begin as dialogue and continue as gameplay.</p>
  </article>
</div>
<p>You do not need a different system for each of these. P.A.N.D.A. supports them all with the same core pieces: filters, text, choices, follow-up turns, and outcomes.</p>

<h2>5. A beginner-friendly recipe</h2>
<ol>
  <li><strong>Start with the situation.</strong> Example: "A friendly stalker wants to warn the player about activity near a smart terrain."</li>
  <li><strong>Add only the preconditions needed to make that situation true.</strong></li>
  <li><strong>Pick the story's initial channel (PDA or F2F), then write one clear opening message.</strong></li>
  <li><strong>Create 1-3 reply choices.</strong> Helpful, dismissive, suspicious, curious, etc.</li>
  <li><strong>Use “Continue as PDA/F2F” for each branch and add outcomes or follow-up turns.</strong> The editor auto-fills most handoff flags.</li>
  <li><strong>Only add complexity when the simple version already works.</strong></li>
</ol>

<h2>6. Core system flow</h2>
<ol>
  <li>Finds all eligible NPCs in the game world.</li>
  <li>Scans the player's faction conversation file.</li>
  <li>Checks each conversation's preconditions against candidate NPCs.</li>
  <li>Selects one eligible conversation + NPC pairing.</li>
  <li>Sends the opening message and waits for the player's choice.</li>
  <li>Applies replies, outcomes, and continuation turns.</li>
</ol>

<h2>7. PDA + F2F writing rules to remember</h2>
<p><strong>PDA turns:</strong> write like text/radio communication from an NPC somewhere else in the world.</p>
<p><strong>F2F turns:</strong> use <em>Continue as F2F</em> when you want a new in-person segment. The editor marks that target as an F2F entry and only that entry needs <code>npcOpenKey</code> + opener text. Continuation F2F turns do not require extra opener metadata.</p>

<h2>8. XML key format</h2>
<p>Base format: <code>st_pda_ic_&lt;faction&gt;_&lt;id&gt;_&lt;suffix&gt;</code></p>
<h3>Required components</h3>
<ul>
  <li><code>_precond</code> — comma-separated precondition list</li>
  <li><code>_open</code> — opening message from the NPC</li>
  <li><code>_choice_1</code> — player's first response option</li>
  <li><code>_reply_1</code> — NPC reply to choice 1</li>
  <li><code>_outcome_1</code> — outcome commands for choice 1, or <code>none</code></li>
</ul>
<h3>Optional components</h3>
<ul>
  <li><code>_choice_2</code> through <code>_choice_4</code></li>
  <li><code>_reply_2</code> through <code>_reply_4</code></li>
  <li><code>_outcome_2</code> through <code>_outcome_4</code></li>
  <li><code>_cont_1</code> through <code>_cont_4</code> for follow-up turns</li>
  <li><code>_timeout</code> and <code>_timeout_msg</code></li>
</ul>

<h2>9. Preconditions reference</h2>
<p>Preconditions live in the <code>_precond</code> string entry. Use them to gate who can trigger the conversation and under what circumstances.</p>
<h3>NPC relation (goodwill-based)</h3>
<ul>
  <li><code>req_npc_friendly</code> / <code>req_npc_friendly:&lt;faction&gt;</code></li>
  <li><code>req_npc_hostile</code> / <code>req_npc_hostile:&lt;faction&gt;</code></li>
</ul>
<h3>NPC faction</h3>
<ul>
  <li><code>req_npc_faction:&lt;faction&gt;</code></li>
  <li><code>req_npc_not_faction:&lt;faction&gt;</code></li>
</ul>
<h3>Rank</h3>
<ul>
  <li><code>req_npc_rank:&lt;rank&gt;</code> / <code>req_npc_rank_max:&lt;rank&gt;</code></li>
  <li><code>req_rank:&lt;rank&gt;</code> / <code>req_rank_max:&lt;rank&gt;</code></li>
  <li>Ranks: novice, trainee, experienced, professional, veteran, expert, master, legend</li>
</ul>
<h3>Money &amp; reputation</h3>
<ul>
  <li><code>req_money:&lt;amount&gt;</code> / <code>req_money_max:&lt;amount&gt;</code></li>
  <li><code>req_rep:&lt;value&gt;</code> / <code>req_rep_max:&lt;value&gt;</code></li>
</ul>
<h3>Kills</h3>
<ul>
  <li><code>req_kills:&lt;count&gt;</code></li>
  <li><code>req_mutant_kills:&lt;count&gt;</code></li>
</ul>
<h3>Faction goodwill</h3>
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
<h3>Companions &amp; inventory</h3>
<ul>
  <li><code>req_companions:&lt;count&gt;</code> / <code>req_companions_max:&lt;count&gt;</code></li>
  <li><code>req_has_item:&lt;section_name&gt;</code></li>
  <li><code>req_equipped:&lt;section_name&gt;</code> / <code>req_equipped_slot:&lt;slot&gt;</code></li>
</ul>
<h3>Time &amp; weather</h3>
<ul>
  <li><code>req_time_day</code> / <code>req_time_night</code></li>
  <li><code>req_surge_soon:&lt;seconds&gt;</code> / <code>req_not_surge_soon:&lt;seconds&gt;</code></li>
  <li><code>req_psi_storm_soon:&lt;seconds&gt;</code></li>
  <li><code>req_weather_fx_active</code> / <code>req_weather_fx_not_active</code></li>
</ul>
<h3>Health &amp; achievements</h3>
<ul>
  <li><code>req_health_min:&lt;value&gt;</code> / <code>req_health_max:&lt;value&gt;</code></li>
  <li><code>req_achievement:&lt;name&gt;</code></li>
</ul>
<h3>Faction aliases</h3>
<p><code>stalker/loner</code>, <code>dolg/duty</code>, <code>freedom</code>, <code>bandit</code>, <code>army/military</code>, <code>killer/mercenary</code>, <code>ecolog/scientist</code>, <code>csky/clear_sky</code>, <code>monolith</code>, <code>renegade</code>, <code>greh</code>, <code>isg</code>, <code>zombied/zombie</code></p>

<h2>10. Outcomes reference</h2>
<p>Outcomes are comma-separated actions that run after a player choice.</p>
<h3>Money &amp; reputation</h3>
<ul>
  <li><code>reward_money:&lt;amount&gt;</code> / <code>punish_money:&lt;amount&gt;</code></li>
  <li><code>reward_rep:&lt;amount&gt;</code> / <code>punish_rep:&lt;amount&gt;</code></li>
</ul>
<h3>Faction goodwill</h3>
<ul>
  <li><code>reward_gw:&lt;amount&gt;:&lt;faction&gt;</code> / <code>punish_gw:&lt;amount&gt;:&lt;faction&gt;</code></li>
</ul>
<h3>Items</h3>
<ul>
  <li><code>give_item:&lt;section_name&gt;</code></li>
  <li><code>courier_item:&lt;section_name&gt;</code></li>
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
<h3>Stash &amp; location markers</h3>
<ul>
  <li><code>reward_stash</code></li>
  <li><code>watch_location:&lt;smart_key&gt;[:radius]</code></li>
  <li><code>watch_location_trigger:&lt;smart_key&gt;:&lt;command&gt;:&lt;params&gt;:&lt;radius&gt;</code></li>
</ul>
<h3>NPC teleportation &amp; companion</h3>
<ul>
  <li><code>teleport_npc_to_smart:&lt;smart_key&gt;[:delay]</code></li>
  <li><code>teleport_npc_to_player[:delay]</code></li>
  <li><code>recruit_companion[:no_dismiss]</code></li>
</ul>
<h3>Job tracking</h3>
<ul>
  <li><code>pause_job:&lt;timeout_seconds&gt;:&lt;success_turn&gt;:&lt;fail_turn&gt;</code></li>
</ul>
<h3>Chance modifier</h3>
<ul>
  <li><code>chance:&lt;percent&gt;:&lt;command&gt;</code></li>
</ul>

<h2>11. Dynamic references reference</h2>
<p>Use live placeholders in dialogue text so one authored conversation can adapt to the current game state.</p>
<ul>
  <li><code>$player_name</code>, <code>$npc_name</code>, <code>$player_faction</code>, <code>$npc_faction</code></li>
  <li><code>$current_level</code>, <code>$player_money</code>, <code>$player_rank</code>, <code>$player_reputation</code></li>
  <li><code>$companion_count</code>, <code>$time_of_day</code>, <code>$game_hour</code></li>
  <li><code>%&lt;level&gt;_panda_st%</code> — random real smart terrain name for dialogue text</li>
  <li><code>%&lt;level&gt;_panda_st_key%</code> — matching smart terrain key for outcome parameters</li>
</ul>

<h2>12. Smart terrain location system</h2>
<p>Use <code>%&lt;level&gt;_panda_st%</code> in dialogue text to reference a random real vanilla location. The system caches the chosen location for the entire conversation. Use <code>%&lt;level&gt;_panda_st_key%</code> when outcomes need the matching smart-terrain key.</p>
<p>Available level keys: cordon, darkscape, swamp, garbage, agroprom, darkvalley, yantar, wildterritory, rostok, deadcity, truck_cemetery, meadow, radar, red_forest, limansk, pripyat, generators, outskirts, jupiter, south_cnpp, north_cnpp, zaton</p>

<h2>13. Multi-turn conversations</h2>
<p>Use <code>_cont_N</code> to continue into another turn. Turn 2 keys use <code>_t2_</code>, turn 3 uses <code>_t3_</code>, and so on. This is how short exchanges grow into longer branches.</p>

<h2>14. Conversation timeouts</h2>
<ul>
  <li><code>_timeout</code> — seconds before the NPC gives up waiting</li>
  <li><code>_timeout_msg</code> — custom annoyed follow-up line</li>
</ul>

<h2>15. Writing rules</h2>
<h3>Immersion &amp; tone</h3>
<ul>
  <li>These are text messages, so keep the language concise and PDA-friendly.</li>
  <li>Let personalities vary: nervous rookies, bitter veterans, hostile bandits, dry scientists.</li>
  <li>Stay lore-friendly and tie lines to the Zone, factions, anomalies, mutants, and survival.</li>
  <li>Use placeholders so repeated content still feels specific.</li>
</ul>
<h3>Locations</h3>
<ul>
  <li>Do not invent fake locations when the framework can provide real ones.</li>
  <li>Use <code>%&lt;level&gt;_panda_st%</code> for location mentions in text.</li>
  <li>Do not describe stash locations in prose; let the system choose and reveal them.</li>
</ul>
<h3>Outcomes</h3>
<ul>
  <li>Match outcomes to the dialogue context.</li>
  <li>Let choices differ in tone, consequence, or follow-up.</li>
  <li>Use preconditions to create believable setup, then outcomes to pay it off.</li>
</ul>
`;
