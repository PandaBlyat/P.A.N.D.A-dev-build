import type { Project } from './types';

const DRAFT_STORAGE_KEY = 'panda-editor-draft-v1';

type DraftPayload = {
  project: Project;
  systemStrings: Record<string, string>;
  savedAt: string;
};

export type RestoredDraft = {
  project: Project;
  systemStrings: Map<string, string>;
  savedAt: string;
};

export function readDraft(): RestoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.project) return null;
    return {
      project: parsed.project,
      systemStrings: new Map<string, string>(Object.entries(parsed.systemStrings || {})),
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function hasDraft(): boolean {
  try {
    return window.localStorage.getItem(DRAFT_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function persistDraft(project: Project, systemStrings: Map<string, string>): void {
  try {
    const payload: DraftPayload = {
      project,
      systemStrings: Object.fromEntries(systemStrings),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / privacy-mode errors.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage access errors.
  }
}
