// P.A.N.D.A. Community Library — Curated fallback conversation data.
// These entries are bundled with the editor so the library stays useful offline
// and can be merged with remote Supabase results at runtime.

import type { CommunityConversation } from './api-client';

export const COMMUNITY_CONVERSATIONS: CommunityConversation[] = [
  // ─── SHORT (3 turns) ── Loner medkit trade with preconditions & outcomes ───
  {
    id: 'bundled-cordon-medkit-trade',
    faction: 'stalker',
    label: 'Cordon Medkit Trade',
    description: 'A friendly loner offers to trade a medkit for cash. Demonstrates preconditions (level, friendly NPC, minimum money), branching choices, relationship-aware replies, and money/item outcomes.',
    summary: 'Short starter template: an NPC medkit trade gated by level, faction relation, and player funds, with relationship-variant replies.',
    author: 'P.A.N.D.A. Team',
    tags: ['starter', 'trade', 'tutorial', 'preconditions'],
    branch_count: 3,
    complexity: 'short',
    downloads: 0,
    upvotes: 24,
    created_at: '2026-02-01T12:00:00Z',
    updated_at: '2026-03-18T09:30:00Z',
    data: {
      version: '1.0.0',
      faction: 'stalker',
      conversations: [
        {
          id: 1,
          label: 'Cordon Medkit Trade',
          preconditions: [
            { type: 'simple', command: 'req_level', params: ['cordon'] },
            { type: 'simple', command: 'req_npc_friendly', params: ['stalker'] },
            { type: 'simple', command: 'req_money', params: ['500'] },
          ],
          turns: [
            {
              turnNumber: 1,
              openingMessage: 'Hey $player_name, I scraped together an army medkit from a stash near the bridge. Interested? 500 RU, no haggling.',
              position: { x: 20, y: 20 },
              choices: [
                {
                  index: 1,
                  text: 'Deal. Hand it over.',
                  reply: 'Good doing business. Stay alive out there, stalker.',
                  replyRelHigh: 'Always a pleasure, friend. Bandage that arm before it gets worse.',
                  replyRelLow: 'Money talks. Take it and do not come back expecting favors.',
                  continueTo: 2,
                  outcomes: [
                    { command: 'punish_money', params: ['500'] },
                    { command: 'give_item', params: ['medkit_army'] },
                  ],
                },
                {
                  index: 2,
                  text: 'Too expensive. Pass.',
                  reply: 'Suit yourself. Next bloodsucker bite might change your mind.',
                  continueTo: 3,
                  outcomes: [],
                },
              ],
            },
            {
              turnNumber: 2,
              openingMessage: 'The trade is done.',
              position: { x: 320, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'Thanks. Stay safe.',
                  reply: 'You too. The Cordon is quiet now, but it never stays that way.',
                  outcomes: [{ command: 'reward_gw', params: ['50', 'stalker'] }],
                },
              ],
            },
            {
              turnNumber: 3,
              openingMessage: 'No deal then.',
              position: { x: 320, y: 180 },
              choices: [
                {
                  index: 1,
                  text: 'Maybe next time.',
                  reply: 'If there is a next time. The Zone does not wait, $player_name.',
                  outcomes: [{ command: 'none', params: [] }],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // ─── MEDIUM (5 turns) ── Duty intel mission with job timer & spawns ────────
  {
    id: 'bundled-duty-intel-sweep',
    faction: 'dolg',
    label: 'Duty Intel Sweep',
    description: 'A Duty officer sends the player to investigate a bandit hideout. Features rank preconditions, a bribe branch, a job timer with success/fail outcomes, hostile spawns, and reputation rewards.',
    summary: 'Medium template: a Duty field assignment with rank gating, branching negotiation, hostile spawns, job timer, and faction reputation outcomes.',
    author: 'P.A.N.D.A. Team',
    tags: ['faction', 'mission', 'job-timer', 'spawns', 'reputation'],
    branch_count: 5,
    complexity: 'medium',
    downloads: 0,
    upvotes: 31,
    created_at: '2026-02-08T12:00:00Z',
    updated_at: '2026-03-19T18:45:00Z',
    data: {
      version: '1.0.0',
      faction: 'dolg',
      conversations: [
        {
          id: 1,
          label: 'Duty Intel Sweep',
          preconditions: [
            { type: 'simple', command: 'req_rank', params: ['experienced'] },
            { type: 'simple', command: 'req_npc_faction', params: ['dolg'] },
            { type: 'simple', command: 'req_time_day', params: [] },
          ],
          timeout: 120,
          timeoutMessage: 'The officer lost patience. Transmission ended.',
          turns: [
            {
              turnNumber: 1,
              openingMessage: 'Listen up, $player_name. We have reports of a bandit camp stirring near Dark Valley. I need someone with field experience to sweep the area and confirm numbers. Interested?',
              position: { x: 20, y: 20 },
              choices: [
                {
                  index: 1,
                  text: 'I will handle it. Brief me.',
                  reply: 'Good. Head south past the checkpoint. Count heads, mark positions, and get out before they notice. Do NOT engage unless forced.',
                  continueTo: 2,
                  outcomes: [],
                },
                {
                  index: 2,
                  text: 'What is in it for me?',
                  reply: 'Duty remembers those who serve. 3000 RU and a boost to your standing with us. Fair enough?',
                  continueTo: 3,
                  outcomes: [],
                },
                {
                  index: 3,
                  text: 'Not my problem, officer.',
                  reply: 'Dismissed then. But remember: what threatens the Zone threatens you too.',
                  outcomes: [{ command: 'punish_gw', params: ['25', 'dolg'] }],
                },
              ],
            },
            {
              turnNumber: 2,
              customLabel: 'Accept Mission',
              position: { x: 320, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'Understood. Moving out.',
                  reply: 'Radio silence until you are clear. Duty out.',
                  outcomes: [
                    { command: 'spawn_hostile', params: ['bandit', '120', '90'] },
                    { command: 'pause_job', params: ['600', '4', '5'] },
                  ],
                },
              ],
            },
            {
              turnNumber: 3,
              customLabel: 'Negotiate',
              position: { x: 320, y: 180 },
              choices: [
                {
                  index: 1,
                  text: 'Deal. I am on my way.',
                  reply: 'Then move. The intel window is closing.',
                  continueTo: 2,
                  outcomes: [],
                },
                {
                  index: 2,
                  text: 'I need more than that.',
                  reply: 'You push your luck, stalker. Fine: 3000 and a stash coordinate. Last offer.',
                  continueTo: 2,
                  outcomes: [{ command: 'reward_stash', params: [] }],
                },
              ],
            },
            {
              turnNumber: 4,
              customLabel: 'Job Success',
              openingMessage: 'Intel confirmed: the sweep is complete.',
              position: { x: 620, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'Area is clear. Targets neutralized.',
                  reply: 'Excellent work, $player_name. Duty does not forget this. Your payment has been wired.',
                  replyRelHigh: 'Outstanding, soldier. You have proven yourself a true ally of Duty today.',
                  outcomes: [
                    { command: 'reward_money', params: ['3000'] },
                    { command: 'reward_rep', params: ['50'] },
                    { command: 'reward_gw', params: ['100', 'dolg'] },
                  ],
                },
              ],
            },
            {
              turnNumber: 5,
              customLabel: 'Job Failed',
              openingMessage: 'Time ran out on the sweep operation.',
              position: { x: 620, y: 180 },
              choices: [
                {
                  index: 1,
                  text: 'I ran into complications.',
                  reply: 'The window is closed. We will find someone more reliable next time.',
                  replyRelHigh: 'I expected better from you. Do not let this become a pattern.',
                  replyRelLow: 'Waste of Duty resources. Do not contact us again.',
                  outcomes: [
                    { command: 'punish_gw', params: ['50', 'dolg'] },
                    { command: 'punish_rep', params: ['25'] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // ─── LONG (8 turns) ── Freedom smuggling chain with watch_location & branching ─
  {
    id: 'bundled-freedom-smuggler-chain',
    faction: 'freedom',
    label: 'Freedom Smuggler Chain',
    description: 'A multi-stage Freedom smuggling run through the Army Warehouses. Features location watching, mutant spawns, courier delivery, multiple negotiation branches, chance-based outcomes, relationship variants throughout, and a full success/fail arc.',
    summary: 'Long template: a Freedom smuggling chain with location triggers, mutant ambush, courier items, chance outcomes, and deep branching across 8 turns.',
    author: 'P.A.N.D.A. Team',
    tags: ['mission', 'smuggling', 'watch-location', 'branching', 'longform', 'chance'],
    branch_count: 8,
    complexity: 'long',
    downloads: 0,
    upvotes: 28,
    created_at: '2026-02-20T20:15:00Z',
    updated_at: '2026-03-20T14:10:00Z',
    data: {
      version: '1.0.0',
      faction: 'freedom',
      conversations: [
        {
          id: 1,
          label: 'Freedom Smuggler Chain',
          preconditions: [
            { type: 'simple', command: 'req_level', params: ['army_warehouses'] },
            { type: 'simple', command: 'req_npc_friendly', params: ['freedom'] },
            { type: 'simple', command: 'req_rank', params: ['experienced'] },
            { type: 'simple', command: 'req_time_night', params: [] },
          ],
          timeout: 180,
          timeoutMessage: 'The smuggler stopped responding. The deal is off.',
          turns: [
            {
              turnNumber: 1,
              openingMessage: 'Psst, $player_name. I have a shipment stuck at the old depot near the warehouses. Military patrols have it locked down and I cannot get there alone. I need someone the patrols do not know. Pays well. Interested?',
              position: { x: 20, y: 20 },
              choices: [
                {
                  index: 1,
                  text: 'Tell me the details.',
                  reply: 'Two crates, west side of the depot. Grab them, bring them to the tree line north of the base. Simple in, simple out. 4000 RU on delivery.',
                  replyRelHigh: 'Knew I could count on you, brother. Two crates at the depot, west wall. Bring them to the tree line. 5000 RU for a friend.',
                  continueTo: 2,
                  outcomes: [],
                },
                {
                  index: 2,
                  text: 'How much are we talking?',
                  reply: '4000 for the run. More if things go sideways and you handle it clean.',
                  continueTo: 3,
                  outcomes: [],
                },
                {
                  index: 3,
                  text: 'Smuggling is not my style.',
                  reply: 'Your loss. The Zone does not care about style, only survival.',
                  outcomes: [{ command: 'none', params: [] }],
                },
              ],
            },
            {
              turnNumber: 2,
              customLabel: 'Accept Job',
              position: { x: 320, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'Mark the location. I am heading out.',
                  reply: 'Done. Watch the north approach — I spotted snork tracks near the fence yesterday. Move fast and stay dark.',
                  outcomes: [
                    { command: 'watch_location', params: ['mil_smart_terrain_4_3', '85'] },
                  ],
                  continueTo: 4,
                },
              ],
            },
            {
              turnNumber: 3,
              customLabel: 'Negotiate Pay',
              position: { x: 320, y: 180 },
              choices: [
                {
                  index: 1,
                  text: 'Make it 5000 and I am in.',
                  reply: 'You drive a hard bargain, but fine. 5000 if you deliver clean. Do not make me regret this.',
                  replyRelHigh: 'For you? Done. 5000. But keep it between us.',
                  continueTo: 2,
                  outcomes: [],
                },
                {
                  index: 2,
                  text: '4000 is fair. Let us do it.',
                  reply: 'Good. No games, no detours. I will mark the spot.',
                  continueTo: 2,
                  outcomes: [],
                },
              ],
            },
            {
              turnNumber: 4,
              customLabel: 'En Route',
              openingMessage: 'You are approaching the depot zone.',
              position: { x: 620, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'I see the depot. Moving in.',
                  reply: 'Careful. If you hear barking, that is not dogs — those are snorks using the drainage pipes. Stick to the walls.',
                  outcomes: [
                    { command: 'spawn_mutant', params: ['snork', '90', '45'] },
                    { command: 'pause_job', params: ['300', '5', '6'] },
                  ],
                },
                {
                  index: 2,
                  text: 'There is military activity here. Aborting.',
                  reply: 'Damn. Alright, pull back. We will try another night.',
                  continueTo: 8,
                  outcomes: [],
                },
              ],
            },
            {
              turnNumber: 5,
              customLabel: 'Snorks Cleared',
              openingMessage: 'The mutant threat near the depot has been neutralized.',
              position: { x: 920, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'Area is clear. I have the crates.',
                  reply: 'Beautiful. Now get to the tree line before a patrol swings back. I will send a courier with your payment.',
                  replyRelHigh: 'You absolute legend. Heading to the tree line — payment is on the way plus a little extra.',
                  outcomes: [
                    { command: 'reward_money', params: ['4000'] },
                    { command: 'courier_item', params: ['medkit_army'] },
                    { command: 'reward_gw', params: ['75', 'freedom'] },
                    { command: 'reward_rep', params: ['30'] },
                  ],
                  continueTo: 7,
                },
              ],
            },
            {
              turnNumber: 6,
              customLabel: 'Snork Job Failed',
              openingMessage: 'The mutant encounter timed out before the area was secured.',
              position: { x: 920, y: 180 },
              choices: [
                {
                  index: 1,
                  text: 'I could not clear them in time.',
                  reply: 'The crates are compromised now. Military will sweep the area by morning. We are done here.',
                  replyRelLow: 'Useless. I should have hired a bloodsucker instead.',
                  outcomes: [
                    { command: 'punish_gw', params: ['50', 'freedom'] },
                  ],
                  continueTo: 8,
                },
              ],
            },
            {
              turnNumber: 7,
              customLabel: 'Success',
              openingMessage: 'The smuggling run is complete.',
              position: { x: 1220, y: 0 },
              choices: [
                {
                  index: 1,
                  text: 'Pleasure doing business.',
                  reply: 'Likewise, $player_name. Freedom remembers its friends. Next time the frequency is open, I might have something bigger for you.',
                  replyRelHigh: 'You are one of us now, whether you wear the patch or not. Stay free, brother.',
                  outcomes: [
                    { command: 'chance:40:give_item', params: ['vodka'] },
                    { command: 'reward_stash', params: [] },
                  ],
                },
              ],
            },
            {
              turnNumber: 8,
              customLabel: 'Failure',
              openingMessage: 'The smuggling operation has fallen through.',
              position: { x: 1220, y: 180 },
              choices: [
                {
                  index: 1,
                  text: 'There will be other jobs.',
                  reply: 'Maybe. But not from me. Not for a while.',
                  replyRelHigh: 'Look, no hard feelings. These things happen in the Zone. We will talk again.',
                  replyRelLow: 'Do not contact this frequency again.',
                  outcomes: [{ command: 'none', params: [] }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
];
