import { store } from './state';
import { generateXml } from './xml-export';
import { importXml } from './xml-import';
import { createSampleProjectBundle } from './sample-project';
import { fetchConversationById } from './api-client';

export function createBlankProject(): void {
  store.addConversation();
}

export function loadSampleProject(): void {
  const sample = createSampleProjectBundle();
  store.loadProject(sample.project, sample.systemStrings);
}

/** Export project as .panda JSON file */
export function exportProjectJson(): void {
  const state = store.get();
  const data = JSON.stringify({
    ...state.project,
    systemStrings: Object.fromEntries(state.systemStrings),
  }, null, 2);
  downloadFile(data, `panda_${state.project.faction}_conversations.panda`, 'application/json');
}

/** Export as game-ready XML */
export function exportXml(): void {
  const state = store.get();
  const xml = generateXml(state.project, state.systemStrings);
  const faction = state.project.faction === 'stalker' ? 'loner' : state.project.faction;
  downloadFile(xml, `st_PANDA_${faction}_interactive_conversations.xml`, 'application/xml');
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
        store.loadProject(result.project, result.systemStrings);
        return true;
      }
      continue;
    }

    if (format === 'json' || format === 'panda') {
      try {
        const data = JSON.parse(raw);
        const systemStrings = new Map<string, string>(Object.entries(data.systemStrings || {}));
        delete data.systemStrings;
        store.loadProject(data, systemStrings);
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
  a.click();
  URL.revokeObjectURL(url);
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

  const project = {
    version: remoteConversation.data.version || '1.0.0',
    faction: remoteConversation.data.faction || remoteConversation.faction,
    conversations: remoteConversation.data.conversations,
  };

  store.loadProject(project, new Map());
}
