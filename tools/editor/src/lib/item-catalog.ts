// P.A.N.D.A. Conversation Editor — Vanilla item catalog helpers.
// Refresh the generated dataset with `python tools/build_editor_item_catalog.py`.

import {
  GAME_ITEM_CATALOG,
  type GameItemCatalogEntry,
} from './generated/item-catalog';

export { GAME_ITEM_CATALOG, type GameItemCatalogEntry };

export type GameItemCategoryGroup =
  | 'Weapons & Attachments'
  | 'Medical & Drugs'
  | 'Artefacts'
  | 'Food & Drink'
  | 'Outfits & Gear'
  | 'Tools & Repair'
  | 'Containers'
  | 'Quest & Letters'
  | 'Explosives'
  | 'Other';

export type GameItemPickerSubgroupId =
  | 'attachments'
  | 'rifles'
  | 'smgs'
  | 'pistols'
  | 'shotguns'
  | 'snipers'
  | 'ammo'
  | 'explosives'
  | 'melee'
  | 'misc'
  | 'general'
  | 'loners'
  | 'bandits'
  | 'clear-sky'
  | 'duty'
  | 'ecologists'
  | 'freedom'
  | 'military'
  | 'mercenaries'
  | 'monolith'
  | 'renegades'
  | 'sin'
  | 'unisg';

export type CachedGameItemPickerMeta = {
  normalizedSearchText: string;
  categoryGroup: GameItemCategoryGroup;
  subgroupId: GameItemPickerSubgroupId | null;
};

export type CachedGameItemCatalogEntry = {
  item: GameItemCatalogEntry;
  normalizedSearchText: string;
  categoryGroup: GameItemCategoryGroup;
  subgroupId: GameItemPickerSubgroupId | null;
};

const CATEGORY_GROUPS: Record<string, GameItemCategoryGroup> = {
  weapons: 'Weapons & Attachments',
  attachments: 'Weapons & Attachments',

  medical: 'Medical & Drugs',
  drugs: 'Medical & Drugs',

  artefacts: 'Artefacts',
  'artefacts junk': 'Artefacts',
  'artefacts soc': 'Artefacts',

  food: 'Food & Drink',
  drink: 'Food & Drink',
  cooking: 'Food & Drink',

  outfits: 'Outfits & Gear',
  patches: 'Outfits & Gear',

  tools: 'Tools & Repair',
  repair: 'Tools & Repair',
  parts: 'Tools & Repair',
  upgrades: 'Tools & Repair',

  'container aac': 'Containers',
  'container aam': 'Containers',
  'container iam': 'Containers',
  'container llmc': 'Containers',

  quest: 'Quest & Letters',
  letters: 'Quest & Letters',

  explosives: 'Explosives',
  'explosives new mines': 'Explosives',

  devices: 'Other',
  money: 'Other',
  monster: 'Other',
  trash: 'Other',
  anim: 'Other',
};

const GAME_ITEM_LOOKUP = new Map(GAME_ITEM_CATALOG.map((item) => [item.section, item] as const));

function computeGameItemSearchText(item: GameItemCatalogEntry): string {
  return [
    item.section,
    item.displayName ?? '',
    item.invName ?? '',
    item.description ?? '',
    item.kind ?? '',
    item.category,
    item.sourcePath,
  ]
    .join(' ')
    .toLowerCase();
}

function computeCategoryGroup(category: string): GameItemCategoryGroup {
  return CATEGORY_GROUPS[category] ?? 'Other';
}

function computeWeaponSubgroup(item: GameItemCatalogEntry): GameItemPickerSubgroupId | null {
  if (computeCategoryGroup(item.category) !== 'Weapons & Attachments') return null;
  if (item.category === 'attachments') return 'attachments';

  switch (item.kind) {
    case 'w_rifle':
      return 'rifles';
    case 'w_smg':
      return 'smgs';
    case 'w_pistol':
      return 'pistols';
    case 'w_shotgun':
      return 'shotguns';
    case 'w_sniper':
      return 'snipers';
    case 'w_ammo':
      return 'ammo';
    case 'w_explosive':
      return 'explosives';
    case 'w_melee':
      return 'melee';
    case 'w_misc':
      return 'misc';
    default:
      return 'misc';
  }
}

function computeOutfitFactionSubgroup(item: GameItemCatalogEntry): GameItemPickerSubgroupId | null {
  if (computeCategoryGroup(item.category) !== 'Outfits & Gear') return null;

  const searchText = [
    item.section,
    item.displayName ?? '',
    item.invName ?? '',
    item.description ?? '',
  ].join(' ').toLowerCase();

  if (
    searchText.includes('unisg')
    || item.section.startsWith('isg_')
    || item.section === 'isg_patch'
  ) {
    return 'unisg';
  }
  if (
    searchText.includes('clear sky')
    || item.section.startsWith('cs_')
    || item.section === 'csky_patch'
  ) {
    return 'clear-sky';
  }
  if (
    searchText.includes('mercenary')
    || item.section.startsWith('merc_')
    || item.section.includes('_merc_')
    || item.section.startsWith('killer_')
    || item.section.startsWith('banditmerc_')
    || item.section.startsWith('renegademerc_')
    || item.section.startsWith('exo_merc_')
    || item.section === 'killer_patch'
  ) {
    return 'mercenaries';
  }
  if (
    searchText.includes('ecologist')
    || item.section.startsWith('ecolog_')
    || item.section === 'ecolog_patch'
  ) {
    return 'ecologists';
  }
  if (
    searchText.includes('freedom')
    || item.section.startsWith('svoboda_')
    || item.section.startsWith('freedom_')
    || item.section.includes('_freedom_')
    || item.section === 'freedom_patch'
  ) {
    return 'freedom';
  }
  if (
    searchText.includes('military')
    || item.section.startsWith('military_')
    || item.section.startsWith('army_')
    || item.section.includes('_voen_')
    || item.section === 'army_patch'
  ) {
    return 'military';
  }
  if (
    searchText.includes('monolith')
    || item.section.startsWith('monolith_')
    || item.section.includes('_monolit_')
    || item.section.startsWith('light_monolit_')
    || item.section === 'monolith_patch'
  ) {
    return 'monolith';
  }
  if (
    searchText.includes('renegade')
    || item.section.startsWith('renegade_')
    || item.section.startsWith('renegademerc_')
    || item.section === 'renegade_patch'
  ) {
    return 'renegades';
  }
  if (
    searchText.includes('sin ')
    || searchText.includes('sin faction')
    || item.section.startsWith('greh_')
    || item.section === 'greh_patch'
  ) {
    return 'sin';
  }
  if (
    searchText.includes('bandit')
    || item.section.startsWith('bandit_')
    || item.section.startsWith('banditmerc_')
    || item.section === 'bandit_patch'
  ) {
    return 'bandits';
  }
  if (
    searchText.includes('duty')
    || item.section.startsWith('dolg_')
    || item.section.startsWith('exo_dolg_')
    || item.section.startsWith('light_dolg_')
    || item.section.startsWith('nbc_dolg_')
    || item.section.startsWith('specops_dolg_')
    || item.section.startsWith('trenchcoat_dolg_')
    || item.section.startsWith('redline_')
    || item.section === 'dolg_patch'
  ) {
    return 'duty';
  }
  if (
    searchText.includes('loner')
    || searchText.includes('stalker')
    || item.section.startsWith('stalker_')
    || item.section.startsWith('novice_')
    || item.section === 'stalker_patch'
  ) {
    return 'loners';
  }

  return 'general';
}

function computeItemPickerMeta(item: GameItemCatalogEntry): CachedGameItemPickerMeta {
  const categoryGroup = computeCategoryGroup(item.category);
  const subgroupId = categoryGroup === 'Weapons & Attachments'
    ? computeWeaponSubgroup(item)
    : categoryGroup === 'Outfits & Gear'
      ? computeOutfitFactionSubgroup(item)
      : null;

  return {
    normalizedSearchText: computeGameItemSearchText(item),
    categoryGroup,
    subgroupId,
  };
}

// The picker meta computation (faction matching, normalized search text) is
// ~50-100ms across all items. Defer it until the first picker actually opens
// so it doesn't block initial app load.
let cachedCatalog: CachedGameItemCatalogEntry[] | null = null;
let cachedMetaLookup: Map<string, CachedGameItemPickerMeta> | null = null;

function ensureCachedCatalog(): CachedGameItemCatalogEntry[] {
  if (cachedCatalog) return cachedCatalog;
  const entries: CachedGameItemCatalogEntry[] = new Array(GAME_ITEM_CATALOG.length);
  const lookup = new Map<string, CachedGameItemPickerMeta>();
  for (let i = 0; i < GAME_ITEM_CATALOG.length; i++) {
    const item = GAME_ITEM_CATALOG[i];
    const meta = computeItemPickerMeta(item);
    entries[i] = { item, ...meta };
    lookup.set(item.section, meta);
  }
  cachedCatalog = entries;
  cachedMetaLookup = lookup;
  return entries;
}

function ensureMetaLookup(): Map<string, CachedGameItemPickerMeta> {
  if (cachedMetaLookup) return cachedMetaLookup;
  ensureCachedCatalog();
  return cachedMetaLookup!;
}

export function getCachedGameItemCatalog(): CachedGameItemCatalogEntry[] {
  return ensureCachedCatalog();
}

export function findGameItem(section: string): GameItemCatalogEntry | undefined {
  return GAME_ITEM_LOOKUP.get(section);
}

export function formatGameItemLabel(section: string): string {
  if (!section) return '';
  const item = findGameItem(section);
  if (!item?.displayName) return section;
  return `${item.displayName} (${item.section})`;
}

export function formatGameItemMeta(item: GameItemCatalogEntry): string {
  const parts = [item.section];
  if (item.kind) parts.push(item.kind);
  if (item.category) parts.push(item.category);
  return parts.join(' • ');
}

export function getGameItemSearchText(item: GameItemCatalogEntry): string {
  return ensureMetaLookup().get(item.section)?.normalizedSearchText ?? computeGameItemSearchText(item);
}

export function getCachedGameItemSearchText(item: GameItemCatalogEntry): string {
  return getGameItemSearchText(item);
}

export function getCategoryGroup(category: string): GameItemCategoryGroup {
  return computeCategoryGroup(category);
}

export function getCachedItemPickerMeta(item: GameItemCatalogEntry): CachedGameItemPickerMeta {
  return ensureMetaLookup().get(item.section) ?? computeItemPickerMeta(item);
}
