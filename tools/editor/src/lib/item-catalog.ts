// P.A.N.D.A. Conversation Editor — Vanilla item catalog helpers.
// Refresh the generated dataset with `python tools/build_editor_item_catalog.py`.

import {
  GAME_ITEM_CATALOG,
  type GameItemCatalogEntry,
} from './generated/item-catalog';

export { GAME_ITEM_CATALOG, type GameItemCatalogEntry };

const GAME_ITEM_LOOKUP = new Map(GAME_ITEM_CATALOG.map((item) => [item.section, item] as const));

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
