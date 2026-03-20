import type { Project } from './types';

export type ProjectBundle = {
  project: Project;
  systemStrings: Map<string, string>;
};

export function createSampleProjectBundle(): ProjectBundle {
  const project: Project = {
    version: '1.0.0',
    faction: 'stalker',
    conversations: [
      {
        id: 1,
        label: 'Sample: Cordon Courier Hook',
        preconditions: [
          {
            type: 'simple',
            command: 'req_npc_friendly',
            params: ['stalker'],
          },
          {
            type: 'any',
            options: [
              {
                type: 'simple',
                command: 'req_rank',
                params: ['novice'],
              },
              {
                type: 'all',
                entries: [
                  {
                    type: 'simple',
                    command: 'req_faction',
                    params: ['stalker'],
                  },
                  {
                    type: 'simple',
                    command: 'req_money',
                    params: ['500'],
                  },
                ],
              },
            ],
          },
        ],
        timeout: 40,
        timeoutMessage: 'The stalker shrugs and heads back to the campfire.',
        turns: [
          {
            turnNumber: 1,
            openingMessage: 'DO NOT PANIC, stalker. I only need a calm pair of boots for a quick courier errand.',
            position: { x: 20, y: 20 },
            customLabel: 'Briefing',
            color: '#5eaa3a',
            choices: [
              {
                index: 1,
                text: 'What kind of errand are we talking about?',
                reply: 'A courier stash run. Hear the details and decide if the Zone owes you a favor.',
                continueTo: 2,
                outcomes: [],
              },
              {
                index: 2,
                text: 'Not today. I am staying un-panicked right here.',
                reply: 'Fair enough. The Guide says the first step is surviving the day.',
                continueTo: 3,
                outcomes: [],
              },
            ],
          },
          {
            turnNumber: 2,
            position: { x: 340, y: 20 },
            customLabel: 'Details',
            color: '#4a90d9',
            choices: [
              {
                index: 1,
                text: 'I can scout the stash point.',
                reply: 'Excellent. I marked the approach. Keep your PDA open and your pulse low.',
                continueTo: 3,
                outcomes: [
                  {
                    command: 'watch_location',
                    params: ['%cordon_panda_st_key%', '85'],
                  },
                ],
              },
              {
                index: 2,
                text: 'Pay me up front and maybe I will care.',
                reply: 'Bold strategy. Here is a little incentive, but do not vanish into the truck cemetery.',
                continueTo: 3,
                outcomes: [
                  {
                    command: 'reward_money',
                    params: ['1200'],
                  },
                ],
              },
            ],
          },
          {
            turnNumber: 3,
            position: { x: 660, y: 60 },
            customLabel: 'Wrap-Up',
            color: '#d4783a',
            choices: [
              {
                index: 1,
                text: 'Understood. I will report back when it is done.',
                reply: 'Good hunting. Validate the logic, export the XML, and the Zone will do the rest.',
                outcomes: [
                  {
                    command: 'give_item',
                    params: ['medkit_army'],
                  },
                ],
              },
              {
                index: 2,
                text: 'Actually, I just wanted to see how branching works.',
                reply: 'Then you came to the right campfire. Follow the links, tweak the replies, and make the story your own.',
                outcomes: [
                  {
                    command: 'none',
                    params: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const systemStrings = new Map<string, string>([
    ['%cordon_panda_st_key%', 'esc_smart_terrain_2_12'],
  ]);

  return { project, systemStrings };
}
