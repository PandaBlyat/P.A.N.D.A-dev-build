// P.A.N.D.A. Community Library — Curated fallback conversation data.
// These entries are bundled with the editor so the library stays useful offline
// and can be merged with remote Supabase results at runtime.

import type { CommunityConversation } from './api-client';

export const COMMUNITY_CONVERSATIONS: CommunityConversation[] = [
  {
    id: 'bundled-cordon-courier-hook',
    faction: 'stalker',
    label: 'Cordon Courier Hook',
    description: 'A friendly loner job offer with a clear briefing, two player responses, and a clean wrap-up.',
    summary: 'A rookie-friendly courier pitch that demonstrates a simple mission offer with light branching.',
    author: 'P.A.N.D.A. Team',
    tags: ['starter', 'jobs', 'tutorial'],
    branch_count: 3,
    complexity: 'short',
    downloads: 0,
    upvotes: 12,
    created_at: '2026-02-01T12:00:00Z',
    updated_at: '2026-03-12T09:30:00Z',
    data: {
      version: '1.0.0',
      faction: 'stalker',
      conversations: [
        {
          id: 1,
          label: 'Cordon Courier Hook',
          preconditions: [
            { type: 'simple', command: 'req_npc_friendly', params: ['stalker'] },
          ],
          turns: [
            {
              turnNumber: 1,
              openingMessage: 'You look steady, stalker. I need a courier run to a nearby stash before dark.',
              position: { x: 20, y: 20 },
              choices: [
                { index: 1, text: 'Tell me the route.', reply: 'Straight through the treeline and back before the dogs wake up.', continueTo: 2, outcomes: [] },
                { index: 2, text: 'Not my problem.', reply: 'Fair. Someone else will chase easy rubles.', continueTo: 3, outcomes: [] },
              ],
            },
            {
              turnNumber: 2,
              position: { x: 300, y: 0 },
              choices: [
                { index: 1, text: 'I can handle it.', reply: 'Good. Keep your head low and bring the package back sealed.', continueTo: 3, outcomes: [{ command: 'reward_money', params: ['900'] }] },
              ],
            },
            {
              turnNumber: 3,
              position: { x: 560, y: 40 },
              choices: [
                { index: 1, text: 'Understood.', reply: 'Then we are done here. Move before the weather turns.', outcomes: [{ command: 'none', params: [] }] },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'bundled-duty-checkpoint-shakedown',
    faction: 'dolg',
    label: 'Duty Checkpoint Shakedown',
    description: 'A stricter checkpoint interrogation with multiple paths for loyal, neutral, and suspicious players.',
    summary: 'A faction-flavored checkpoint exchange with extra branches for access, bribes, and denial.',
    author: 'P.A.N.D.A. Team',
    tags: ['faction', 'checkpoint', 'reputation'],
    branch_count: 5,
    complexity: 'medium',
    downloads: 0,
    upvotes: 21,
    created_at: '2026-02-08T12:00:00Z',
    updated_at: '2026-03-15T18:45:00Z',
    data: {
      version: '1.0.0',
      faction: 'dolg',
      conversations: [
        {
          id: 1,
          label: 'Duty Checkpoint Shakedown',
          preconditions: [
            { type: 'simple', command: 'req_faction', params: ['dolg'] },
          ],
          turns: [
            {
              turnNumber: 1,
              openingMessage: 'Checkpoint protocol. State your business before you step another meter closer.',
              position: { x: 20, y: 20 },
              choices: [
                { index: 1, text: 'Duty business. Open the gate.', reply: 'Then prove it. Orders, pass, anything official.', continueTo: 2, outcomes: [] },
                { index: 2, text: 'I am just passing through.', reply: 'No one just passes through a live cordon.', continueTo: 3, outcomes: [] },
              ],
            },
            {
              turnNumber: 2,
              position: { x: 310, y: 0 },
              choices: [
                { index: 1, text: 'Here is the pass.', reply: 'Looks clean. You get one trip and one warning.', continueTo: 4, outcomes: [{ command: 'none', params: [] }] },
                { index: 2, text: 'I do not answer to gate guards.', reply: 'Then you answer to the sandbags.', continueTo: 5, outcomes: [] },
              ],
            },
            { turnNumber: 3, position: { x: 310, y: 120 }, choices: [{ index: 1, text: 'Maybe a donation helps?', reply: 'Maybe it does. Leave the cash and keep walking.', continueTo: 4, outcomes: [{ command: 'reward_money', params: ['-1500'] }] }] },
            { turnNumber: 4, position: { x: 590, y: 30 }, choices: [{ index: 1, text: 'Understood.', reply: 'Move along and do not make us regret it.', outcomes: [{ command: 'none', params: [] }] }] },
            { turnNumber: 5, position: { x: 590, y: 150 }, choices: [{ index: 1, text: 'Fine, I am leaving.', reply: 'Smart choice. Keep your hands visible.', outcomes: [{ command: 'none', params: [] }] }] },
          ],
        },
      ],
    },
  },
  {
    id: 'bundled-freedom-night-broadcast',
    faction: 'freedom',
    label: 'Freedom Night Broadcast',
    description: 'A longer radio-style conversation with optional flavor turns and multiple payoff outcomes.',
    summary: 'A campfire broadcast concept with extra flavor beats for longer conversation imports.',
    author: 'P.A.N.D.A. Team',
    tags: ['radio', 'ambient', 'longform'],
    branch_count: 6,
    complexity: 'long',
    downloads: 0,
    upvotes: 17,
    created_at: '2026-02-20T20:15:00Z',
    updated_at: '2026-03-18T14:10:00Z',
    data: {
      version: '1.0.0',
      faction: 'freedom',
      conversations: [
        {
          id: 1,
          label: 'Freedom Night Broadcast',
          preconditions: [],
          turns: [
            {
              turnNumber: 1,
              openingMessage: 'Tonight on the frequency: rumors, requests, and one idiot volunteer for a moonlit supply run.',
              position: { x: 0, y: 0 },
              choices: [
                { index: 1, text: 'I volunteer.', reply: 'Bold start. Let us see if you stay bold after the details.', continueTo: 2, outcomes: [] },
                { index: 2, text: 'I am only here for the music.', reply: 'Stay tuned anyway. The music never survives first contact with the Zone.', continueTo: 3, outcomes: [] },
              ],
            },
            { turnNumber: 2, position: { x: 270, y: -20 }, choices: [{ index: 1, text: 'Give me the route.', reply: 'North ridge, old bus, then down into the reeds.', continueTo: 4, outcomes: [] }] },
            { turnNumber: 3, position: { x: 270, y: 110 }, choices: [{ index: 1, text: 'Fine, what is the catch?', reply: 'Only the usual: dogs, anomalies, and bad timing.', continueTo: 4, outcomes: [] }] },
            { turnNumber: 4, position: { x: 520, y: 20 }, choices: [{ index: 1, text: 'What is in the package?', reply: 'Spare parts and a tape deck worth more than your rifle.', continueTo: 5, outcomes: [] }, { index: 2, text: 'Skip the speech.', reply: 'Direct. I respect that.', continueTo: 6, outcomes: [] }] },
            { turnNumber: 5, position: { x: 790, y: -10 }, choices: [{ index: 1, text: 'I am in.', reply: 'Then the frequency is yours. Make it a good story.', continueTo: 6, outcomes: [{ command: 'give_item', params: ['bandage'] }] }] },
            { turnNumber: 6, position: { x: 1010, y: 40 }, choices: [{ index: 1, text: 'See you at dawn.', reply: 'Bring back the crate and maybe the music too.', outcomes: [{ command: 'none', params: [] }] }] },
          ],
        },
      ],
    },
  },
];
