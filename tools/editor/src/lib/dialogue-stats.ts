// P.A.N.D.A. Dialogue Stat Registry
// Player-level stats used by `dialogue_skill_check` outcomes. Core stats start
// at 0 and are persisted in the mod's save state. `rank` is derived live from
// the player's character_rank at runtime; the editor still lists it so authors
// can target it in checks.

export const CORE_DIALOGUE_STATS = [
  'charisma',
  'luck',
  'intimidation',
  'perception',
  'rank',
] as const;

export type CoreDialogueStatKey = typeof CORE_DIALOGUE_STATS[number];
export type DialogueStatKey = CoreDialogueStatKey | string;

export const DIALOGUE_STAT_LABELS: Record<CoreDialogueStatKey, string> = {
  charisma: 'Charisma',
  luck: 'Luck',
  intimidation: 'Intimidation',
  perception: 'Perception',
  rank: 'Rank',
};

export const DIALOGUE_STAT_DESCRIPTIONS: Record<CoreDialogueStatKey, string> = {
  charisma: 'Smooth talk, persuasion, deception.',
  luck: 'Passive bonus to all checks (+floor(luck/2)).',
  intimidation: 'Threats, demands, hostile postures.',
  perception: 'Notice details, read intent, spot lies.',
  rank: 'Derived from current character rank (0 = novice tier).',
};

export const RANDOM_STAT_KEY = '__random__';

export function isCoreStat(key: string): key is CoreDialogueStatKey {
  return (CORE_DIALOGUE_STATS as readonly string[]).includes(key);
}

export function formatStatLabel(key: string): string {
  if (key === RANDOM_STAT_KEY) return 'Random';
  if (isCoreStat(key)) return DIALOGUE_STAT_LABELS[key];
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Render the in-line hint suffix authors append to choice text, e.g. "[Charisma 5]". */
export function formatCheckHint(statKey: string, difficulty: number): string {
  const label = formatStatLabel(statKey);
  if (!label) return '';
  return `[${label} ${difficulty}]`;
}

/** Render the random-chance suffix, e.g. "[60% Chance]". */
export function formatRandomHint(percent: number): string {
  const clamped = Math.max(1, Math.min(99, Math.round(percent)));
  return `[${clamped}% Chance]`;
}

export interface DialogueStatRegistryEntry {
  key: string;
  label?: string;
  description?: string;
}

export function ensureDialogueStatRegistry(
  registry: DialogueStatRegistryEntry[] | undefined,
): DialogueStatRegistryEntry[] {
  if (!registry) registry = [];
  const seen = new Set(registry.map((entry) => entry.key));
  for (const key of CORE_DIALOGUE_STATS) {
    if (!seen.has(key)) {
      registry.push({
        key,
        label: DIALOGUE_STAT_LABELS[key],
        description: DIALOGUE_STAT_DESCRIPTIONS[key],
      });
    }
  }
  return registry;
}

/** All keys (core + custom) for picker dropdowns. */
export function listStatKeys(registry: DialogueStatRegistryEntry[] | undefined): string[] {
  const merged = ensureDialogueStatRegistry(registry ? [...registry] : []);
  return merged.map((entry) => entry.key);
}
