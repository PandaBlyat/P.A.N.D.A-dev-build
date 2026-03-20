// P.A.N.D.A. Community Library — Static bundled conversation data.
// Add entries here to make them available in the Community panel.
// No external network access is used; this file is bundled at build time.

import type { CommunityConversation } from './api-client';

export const COMMUNITY_CONVERSATIONS: CommunityConversation[] = [
  // Add community conversation entries here.
  // Example shape:
  // {
  //   id: 'example-1',
  //   faction: 'stalker',
  //   label: 'My Conversation',
  //   description: 'A short description of what this conversation does.',
  //   author: 'AuthorName',
  //   downloads: 0,
  //   created_at: '2026-01-01T00:00:00Z',
  //   data: {
  //     version: '1',
  //     faction: 'stalker',
  //     conversations: [ /* ... */ ],
  //   },
  // },
];
