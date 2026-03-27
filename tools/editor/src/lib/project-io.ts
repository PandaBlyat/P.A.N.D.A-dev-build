import { store } from './state';
import { generateXml } from './xml-export';
import { importXml } from './xml-import';
import { createSampleProjectBundle } from './sample-project';
import { fetchConversationById } from './api-client';
import type { Choice, Conversation, ConversationChannel, FactionId, Project, Turn } from './types';
import { FACTION_XML_KEYS, getConversationFaction } from './types';

export function createBlankProject(): void {
  store.addConversation();
}

export function loadSampleProject(): void {
  const sample = createSampleProjectBundle();
  store.loadProject(normalizeProjectData(sample.project), sample.systemStrings);
}

/** Export project as .panda JSON file */
export function exportProjectJson(): void {
  const state = store.get();
  const data = JSON.stringify({
    ...normalizeProjectData(state.project),
    systemStrings: Object.fromEntries(state.systemStrings),
  }, null, 2);
  const factions = getProjectConversationFactions(state.project);
  const filename = factions.length === 1
    ? `panda_${factions[0]}_conversations.panda`
    : 'panda_multi_faction_conversations.panda';
  downloadFile(data, filename, 'application/json');
}

/** Export as game-ready XML */
export function exportXml(): void {
  const state = store.get();
  const factions = getProjectConversationFactions(state.project);

  factions.forEach((faction, index) => {
    const xml = generateXml(state.project, state.systemStrings, faction);
    const factionKey = FACTION_XML_KEYS[faction];
    window.setTimeout(() => {
      downloadFile(xml, `st_PANDA_${factionKey}_interactive_conversations.xml`, 'application/xml');
    }, index * 150);
  });
}

/** Import from XML file */
export function importFromXml(): void {
  openProjectFile('.xml', ['xml']);
}

/** Import from .panda JSON file */
export function importFromJson(): void {
  openProjectFile('.panda,.json,.xml', ['panda', 'json', 'xml']);
}

function openProjectFile(accept: string, preferredExtensions: string[]): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      const extension = getFileExtension(file.name);
      const parseOrder = extension && preferredExtensions.includes(extension)
        ? [extension, ...preferredExtensions.filter(ext => ext !== extension)]
        : preferredExtensions;

      const result = tryLoadProjectFile(raw, parseOrder);
      if (!result) {
        const expectedFormats = preferredExtensions.map(ext => `.${ext}`).join(', ');
        alert(`Failed to parse project file. Supported formats: ${expectedFormats}.`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function tryLoadProjectFile(raw: string, parseOrder: string[]): boolean {
  for (const format of parseOrder) {
    if (format === 'xml') {
      const result = importXml(raw);
      if (result) {
        store.loadProject(normalizeProjectData(result.project), result.systemStrings);
        return true;
      }
      continue;
    }

    if (format === 'json' || format === 'panda') {
      try {
        const data = JSON.parse(raw);
        const systemStrings = new Map<string, string>(Object.entries(data.systemStrings || {}));
        delete data.systemStrings;
        store.loadProject(normalizeProjectData(data), systemStrings);
        return true;
      } catch {
        continue;
      }
    }
  }

  return false;
}

function getFileExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return null;
  return filename.slice(lastDot + 1).toLowerCase();
}

/** Download a string as a file (shared helper used by SharePanel). */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revocation so slower browsers can finish initiating the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getProjectConversationFactions(project: Project): Project['faction'][] {
  const factions = new Set<Project['faction']>();

  if (project.conversations.length === 0) {
    factions.add(project.faction);
  }

  for (const conversation of project.conversations) {
    factions.add(getConversationFaction(conversation, project.faction));
  }

  return [...factions];
}

const ONBOARDING_SAMPLE_PACK_ID = '21f5bc31-cf62-454a-baba-62163e5b0202';

export async function loadOnboardingSamplePack(): Promise<void> {
  const remoteConversation = await fetchConversationById(ONBOARDING_SAMPLE_PACK_ID);
  if (!remoteConversation) {
    throw new Error(`Could not find template conversation ${ONBOARDING_SAMPLE_PACK_ID}.`);
  }

  if (!remoteConversation.data?.conversations?.length) {
    throw new Error('The selected template conversation does not include editable conversation data.');
  }

  const project = normalizeSequentialConversationIds({
    version: remoteConversation.data.version || '2.0.0',
    faction: remoteConversation.data.faction || remoteConversation.faction,
    conversations: remoteConversation.data.conversations,
  });

  store.loadProject(normalizeProjectData(project), new Map());
}

function normalizeSequentialConversationIds(project: Project): Project {
  const normalizedConversations = [...project.conversations]
    .sort((a, b) => a.id - b.id)
    .map((conversation, index) => ({
      ...structuredClone(conversation),
      id: index + 1,
    }));

  return {
    ...project,
    conversations: normalizedConversations,
  };
}

const CHANNEL_VALUES: ConversationChannel[] = ['pda', 'f2f', 'both'];

function normalizeChannel(value: unknown, fallback: ConversationChannel): ConversationChannel {
  return typeof value === 'string' && CHANNEL_VALUES.includes(value as ConversationChannel)
    ? value as ConversationChannel
    : fallback;
}

function normalizeFaction(value: unknown, fallback: FactionId): FactionId {
  return typeof value === 'string' && value in FACTION_XML_KEYS
    ? value as FactionId
    : fallback;
}

function normalizeStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const normalized = values.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTurn(turn: Turn, fallbackPosition: { x: number; y: number }): Turn {
  const normalizedChannel = normalizeChannel(turn.channel, 'both');
  const normalizedF2fEntry = typeof turn.f2f_entry === 'boolean' ? turn.f2f_entry : false;
  const normalizedFirstSpeaker = turn.firstSpeaker === 'npc' || turn.firstSpeaker === 'player'
    ? turn.firstSpeaker
    : (normalizedChannel === 'f2f' && normalizedF2fEntry ? 'player' : 'npc');

  return {
    ...turn,
    channel: normalizedChannel,
    firstSpeaker: normalizedFirstSpeaker,
    pda_entry: typeof turn.pda_entry === 'boolean' ? turn.pda_entry : turn.turnNumber === 1,
    f2f_entry: normalizedF2fEntry,
    position: turn.position ?? fallbackPosition,
    choices: turn.choices.map((choice, index) => normalizeChoice(choice, index + 1)),
  };
}

function normalizeChoice(choice: Choice, fallbackIndex: number): Choice {
  return {
    ...choice,
    index: typeof choice.index === 'number' ? choice.index : fallbackIndex,
    channel: normalizeChannel(choice.channel, 'pda'),
    continue_channel: normalizeChannel(choice.continue_channel, 'pda'),
    story_npc_id: typeof choice.story_npc_id === 'string' && choice.story_npc_id.trim().length > 0
      ? choice.story_npc_id.trim()
      : undefined,
    npc_faction_filters: normalizeStringArray(choice.npc_faction_filters)?.filter((faction): faction is FactionId => faction in FACTION_XML_KEYS),
    npc_profile_filters: normalizeStringArray(choice.npc_profile_filters),
    allow_generic_stalker: typeof choice.allow_generic_stalker === 'boolean' ? choice.allow_generic_stalker : false,
  };
}

function normalizeConversation(conversation: Conversation, fallbackFaction: FactionId): Conversation {
  return {
    ...conversation,
    faction: normalizeFaction(conversation.faction, fallbackFaction),
    turns: conversation.turns.map((turn, index) => normalizeTurn(turn, { x: index * 340, y: 220 })),
  };
}

function normalizeProjectData(project: Project): Project {
  const fallbackFaction = normalizeFaction(project.faction, 'stalker');
  return {
    ...project,
    version: typeof project.version === 'string' && project.version.trim().length > 0 ? project.version : '2.0.0',
    faction: fallbackFaction,
    conversations: project.conversations.map((conversation) => normalizeConversation(conversation, fallbackFaction)),
  };
}
