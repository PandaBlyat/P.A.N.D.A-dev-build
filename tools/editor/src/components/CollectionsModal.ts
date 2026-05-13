import { createEmptyProject, generateXml, type XmlExporterConfig } from '../lib/xml-export';
import { createZipBlob } from '../lib/zip';
import { downloadBlob } from '../lib/project-io';
import {
  fetchConversations,
  fetchCommunityCollections,
  publishCommunityCollection,
  incrementCollectionDownload,
  type CommunityCollection,
  type CommunityConversation,
  type ConversationComplexity,
} from '../lib/api-client';
import { COMMUNITY_CONVERSATIONS } from '../lib/community-data';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES, FACTION_DISPLAY_NAMES_RU, FACTION_XML_KEYS, getConversationFaction, type Conversation, type FactionId } from '../lib/types';
import { languageFlag, type UiLanguage } from '../lib/ui-language';
import { rawUi } from '../lib/i18n';
import { store } from '../lib/state';
import { createIcon, setButtonContent } from './icons';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

type CollectionsTab = 'curated' | 'public';
type NormalizedStory = CommunityConversation & {
  branch_count: number;
  complexity: ConversationComplexity;
  summary: string;
  language: UiLanguage;
};

const MODAL_MOUNT_ID = 'app-modal-host';
const ZIP_EXPORT_CONFIG: XmlExporterConfig = {
  conversationKeyPrefix: 'panda',
  useStoryKeyPrefixes: true,
  strictDialogueValidation: true,
  validateDialogueStrings: true,
  autofillMissingOpenWhenNonStrict: true,
  missingOpenPlaceholder: '[MISSING_OPEN_LINE]',
};

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let activeTab: CollectionsTab = 'curated';
let activeFaction: FactionId | 'all' = 'all';
let stories: NormalizedStory[] = [];
let collections: CommunityCollection[] = [];
let selectedStoryIds: string[] = [];
let searchQuery = '';
let isLoading = false;
let loadError = '';

export function openCollectionsModal(): void {
  if (overlayEl) return;
  activeTab = 'curated';
  activeFaction = 'all';
  selectedStoryIds = [];
  searchQuery = '';
  isLoading = false;
  loadError = '';
  overlayEl = buildOverlay();
  getMount().appendChild(overlayEl);
  focusTrap = trapFocus(overlayEl, { initialFocus: overlayEl.querySelector<HTMLElement>('[data-collections-close]') });
  void loadCollectionsData();
}

export function closeCollectionsModal(): void {
  overlayEl?.remove();
  overlayEl = null;
  focusTrap?.release();
  focusTrap = null;
}

function getMount(): HTMLElement {
  return document.getElementById(MODAL_MOUNT_ID)
    ?? document.getElementById('app')
    ?? document.body;
}

async function loadCollectionsData(): Promise<void> {
  isLoading = true;
  loadError = '';
  renderBody();
  try {
    const [remoteStories, remoteCollections] = await Promise.all([
      fetchConversations(),
      fetchCommunityCollections(),
    ]);
    stories = normalizeStories([...COMMUNITY_CONVERSATIONS, ...remoteStories]);
    collections = remoteCollections;
  } catch (error) {
    stories = normalizeStories(COMMUNITY_CONVERSATIONS);
    collections = [];
    loadError = error instanceof Error
      ? `Remote collection sync failed. Showing bundled stories. ${error.message}`
      : 'Remote collection sync failed. Showing bundled stories.';
  } finally {
    isLoading = false;
    renderBody();
  }
}

function normalizeStories(entries: CommunityConversation[]): NormalizedStory[] {
  const byKey = new Map<string, NormalizedStory>();
  for (const entry of entries) {
    const conversation = entry.data?.conversations?.[0];
    if (!conversation) continue;
    const language = entry.data?.language === 'ru' ? 'ru' : 'en';
    const key = `${getStoryRootId(entry)}:${language}`;
    const branchCount = entry.branch_count || Math.max(1, conversation.turns.length);
    byKey.set(key, {
      ...entry,
      branch_count: branchCount,
      complexity: entry.complexity ?? deriveComplexity(branchCount),
      summary: entry.summary || entry.description || conversation.turns[0]?.openingMessage || 'Branching storyline.',
      tags: entry.tags ?? [],
      language,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at));
}

function deriveComplexity(branchCount: number): ConversationComplexity {
  if (branchCount <= 3) return 'short';
  if (branchCount <= 6) return 'medium';
  return 'long';
}

function getStoryRootId(story: CommunityConversation): string {
  const root = story.data?.translation?.source_id;
  return root && root.trim() ? root.trim() : story.id;
}

function buildOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'collections-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', rawUi('Storyline Collections'));

  const panel = document.createElement('div');
  panel.className = 'collections-panel';

  const header = document.createElement('header');
  header.className = 'collections-header';

  const title = document.createElement('div');
  title.className = 'collections-title';
  title.append(createIcon('share'), document.createTextNode('Collections'));

  const subtitle = document.createElement('p');
  subtitle.textContent = rawUi('Pick storylines, download mod-ready ZIP, merge gamedata into Anomaly.');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toolbar-button toolbar-icon-button btn-icon';
  close.dataset.collectionsClose = 'true';
  close.appendChild(createIcon('close'));
  close.title = rawUi('Close Collections');
  close.onclick = closeCollectionsModal;

  const copy = document.createElement('div');
  copy.append(title, subtitle);
  header.append(copy, close);

  const body = document.createElement('div');
  body.className = 'collections-body';
  body.dataset.collectionsBody = 'true';

  panel.append(header, body);
  overlay.appendChild(panel);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCollectionsModal();
  });
  window.addEventListener('keydown', handleEscape, { once: true });
  return overlay;
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeCollectionsModal();
  else if (overlayEl) window.addEventListener('keydown', handleEscape, { once: true });
}

function renderBody(): void {
  const body = overlayEl?.querySelector<HTMLElement>('[data-collections-body]');
  if (!body) return;
  body.innerHTML = '';

  const sidebar = buildFactionSidebar();
  const main = document.createElement('main');
  main.className = 'collections-main';
  main.append(buildTopBar());

  if (isLoading) {
    const loading = document.createElement('div');
    loading.className = 'collections-state';
    loading.textContent = rawUi('Loading storylines...');
    main.appendChild(loading);
  } else {
    if (loadError) {
      const warning = document.createElement('div');
      warning.className = 'collections-warning';
      warning.textContent = loadError;
      main.appendChild(warning);
    }
    main.append(activeTab === 'curated' ? buildStoryGrid() : buildPublicCollections());
  }

  const right = buildSelectionPanel();
  body.append(sidebar, main, right);
}

function buildTopBar(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'collections-topbar';

  const tabs = document.createElement('div');
  tabs.className = 'collections-tabs';
  const tabDefs: Array<[CollectionsTab, string]> = [['curated', 'Curated Stories'], ['public', 'Public Collections']];
  for (const [tab, label] of tabDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `collections-tab${activeTab === tab ? ' is-active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => {
      activeTab = tab;
      renderBody();
    };
    tabs.appendChild(btn);
  }

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'collections-search';
  search.placeholder = activeTab === 'curated' ? 'Search storylines...' : 'Search collections...';
  search.value = searchQuery;
  search.oninput = () => {
    searchQuery = search.value;
    renderBody();
  };

  row.append(tabs, search);
  return row;
}

function buildFactionSidebar(): HTMLElement {
  const nav = document.createElement('aside');
  nav.className = 'collections-sidebar';

  nav.appendChild(buildFactionButton('All Factions', 'all'));
  for (const faction of FACTION_IDS) {
    const label = store.get().uiLanguage === 'ru' ? FACTION_DISPLAY_NAMES_RU[faction] : FACTION_DISPLAY_NAMES[faction];
    nav.appendChild(buildFactionButton(label, faction));
  }
  return nav;
}

function buildFactionButton(label: string, faction: FactionId | 'all'): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `collections-faction${activeFaction === faction ? ' is-active' : ''}`;
  btn.textContent = label;
  btn.onclick = () => {
    activeFaction = faction;
    renderBody();
  };
  return btn;
}

function buildStoryGrid(): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'collections-grid';
  const visible = getVisibleStories();
  if (visible.length === 0) {
    grid.appendChild(emptyState('No curated stories match current filters.'));
    return grid;
  }
  for (const story of visible) {
    grid.appendChild(buildStoryCard(story));
  }
  return grid;
}

function buildStoryCard(story: NormalizedStory): HTMLElement {
  const card = document.createElement('article');
  card.className = 'collections-story-card';
  const selected = selectedStoryIds.includes(getStoryRootId(story));
  if (selected) card.classList.add('is-selected');

  const top = document.createElement('div');
  top.className = 'collections-story-top';
  const title = document.createElement('h3');
  title.textContent = story.label || 'Untitled';
  const flag = document.createElement('span');
  flag.textContent = getStoryLanguageFlags(getStoryRootId(story));
  top.append(title, flag);

  const summary = document.createElement('p');
  summary.textContent = story.summary;

  const meta = document.createElement('div');
  meta.className = 'collections-meta';
  meta.textContent = `${story.author || 'Anonymous'} | ${story.branch_count} branches | ${story.complexity}`;

  const actions = document.createElement('div');
  actions.className = 'collections-card-actions';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = selected ? 'toolbar-button' : 'toolbar-button toolbar-button-primary';
  setButtonContent(add, selected ? 'success' : 'add', selected ? 'Added' : 'Add');
  add.onclick = () => toggleStory(story);
  actions.appendChild(add);

  card.append(top, summary, meta, actions);
  return card;
}

function buildPublicCollections(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'collections-public-list';
  const visible = getVisibleCollections();
  if (visible.length === 0) {
    wrap.appendChild(emptyState('No public collections yet. Build one on right, then publish it.'));
    return wrap;
  }
  for (const collection of visible) {
    const row = document.createElement('article');
    row.className = 'collections-public-card';
    const title = document.createElement('h3');
    title.textContent = collection.title || 'Untitled Collection';
    const desc = document.createElement('p');
    desc.textContent = collection.description || 'Community storyline pack.';
    const meta = document.createElement('div');
    meta.className = 'collections-meta';
    meta.textContent = `${collection.author} | ${collection.story_ids.length} stories | ${collection.downloads} downloads | ${collection.upvotes} upvotes`;
    const actions = document.createElement('div');
    actions.className = 'collections-card-actions';
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'toolbar-button toolbar-button-primary';
    setButtonContent(download, 'download', rawUi('Download ZIP'));
    download.onclick = () => void downloadCollectionZip(collection.story_ids, collection.title, collection.id);
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'toolbar-button';
    setButtonContent(inspect, 'add', rawUi('Add to Panel'));
    inspect.onclick = () => {
      selectedStoryIds = Array.from(new Set([...selectedStoryIds, ...collection.story_ids]));
      renderBody();
    };
    actions.append(download, inspect);
    row.append(title, desc, meta, actions);
    wrap.appendChild(row);
  }
  return wrap;
}

function buildSelectionPanel(): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'collections-selection-panel';

  const title = document.createElement('h2');
  title.textContent = rawUi('My Collection');
  const note = document.createElement('p');
  note.className = 'collections-install-note';
  note.textContent = rawUi('ZIP contains gamedata/configs/text/eng and rus. Merge gamedata into Anomaly folder.');

  const selected = getSelectedStoryGroups();
  const list = document.createElement('div');
  list.className = 'collections-selected-list';
  if (selected.length === 0) {
    list.appendChild(emptyState('No storylines selected.'));
  } else {
    for (const story of selected) list.appendChild(buildSelectedRow(story));
  }

  const actions = document.createElement('div');
  actions.className = 'collections-selection-actions';
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'toolbar-button toolbar-button-primary';
  download.disabled = selectedStoryIds.length === 0;
  setButtonContent(download, 'download', `Download ZIP (${selectedStoryIds.length})`);
  download.onclick = () => void downloadCollectionZip(selectedStoryIds, 'panda_custom_collection');

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'toolbar-button';
  clear.disabled = selectedStoryIds.length === 0;
  clear.textContent = rawUi('Clear');
  clear.onclick = () => {
    selectedStoryIds = [];
    renderBody();
  };
  actions.append(download, clear);

  panel.append(title, note, list, actions, buildPublishBox());
  return panel;
}

function buildSelectedRow(story: NormalizedStory): HTMLElement {
  const row = document.createElement('div');
  row.className = 'collections-selected-row';
  const text = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = story.label;
  const meta = document.createElement('span');
  meta.textContent = `${FACTION_DISPLAY_NAMES[getConversationFaction(story.data.conversations[0], story.faction)]} | ${getStoryLanguageFlags(getStoryRootId(story))}`;
  text.append(title, meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'toolbar-button toolbar-icon-button btn-icon';
  remove.appendChild(createIcon('close'));
  remove.title = rawUi('Remove storyline');
  remove.onclick = () => {
    selectedStoryIds = selectedStoryIds.filter(id => id !== getStoryRootId(story));
    renderBody();
  };
  row.append(text, remove);
  return row;
}

function buildPublishBox(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'collections-publish-box';
  const title = document.createElement('h3');
  title.textContent = rawUi('Post Public Collection');
  const name = document.createElement('input');
  name.type = 'text';
  name.maxLength = 70;
  name.placeholder = rawUi('Collection title');
  const desc = document.createElement('textarea');
  desc.maxLength = 240;
  desc.placeholder = rawUi('Short description');
  const publish = document.createElement('button');
  publish.type = 'button';
  publish.className = 'toolbar-button';
  publish.disabled = selectedStoryIds.length === 0;
  setButtonContent(publish, 'export', rawUi('Post Collection'));
  publish.onclick = async () => {
    const collectionTitle = name.value.trim();
    if (!collectionTitle) {
      alert('Collection title required.');
      return;
    }
    publish.disabled = true;
    try {
      await publishCommunityCollection({
        title: collectionTitle,
        description: desc.value.trim(),
        author: getStoredUsername(),
        faction: getCollectionFaction(selectedStoryIds),
        story_ids: selectedStoryIds,
      });
      name.value = '';
      desc.value = '';
      activeTab = 'public';
      await loadCollectionsData();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      publish.disabled = selectedStoryIds.length === 0;
    }
  };
  box.append(title, name, desc, publish);
  return box;
}

function getStoredUsername(): string {
  if (typeof window === 'undefined') return 'Anonymous';
  return window.localStorage.getItem('panda-community-username')?.trim() || 'Anonymous';
}

function getVisibleStories(): NormalizedStory[] {
  const q = searchQuery.trim().toLowerCase();
  const primary = stories.filter(story => !story.data?.translation?.source_id);
  return primary.filter((story) => {
    if ((story.library_section ?? 'community') !== 'curated') return false;
    if (activeFaction !== 'all' && story.faction !== activeFaction) return false;
    if (!q) return true;
    return [story.label, story.description, story.summary, story.author, ...(story.tags ?? [])]
      .some(value => value.toLowerCase().includes(q));
  });
}

function getVisibleCollections(): CommunityCollection[] {
  const q = searchQuery.trim().toLowerCase();
  return collections.filter((collection) => {
    if (activeFaction !== 'all' && collection.faction && collection.faction !== 'all' && collection.faction !== activeFaction) return false;
    if (!q) return true;
    return [collection.title, collection.description, collection.author].some(value => value.toLowerCase().includes(q));
  });
}

function getStoryVariants(rootId: string): NormalizedStory[] {
  return stories.filter(story => getStoryRootId(story) === rootId);
}

function getStoryLanguageFlags(rootId: string): string {
  const languages = new Set(getStoryVariants(rootId).map(story => story.language));
  return `${languages.has('en') ? languageFlag('en') : ''}${languages.has('ru') ? ` ${languageFlag('ru')}` : ''}`.trim();
}

function getSelectedStoryGroups(): NormalizedStory[] {
  return selectedStoryIds
    .map(rootId => getStoryVariants(rootId).find(story => !story.data?.translation?.source_id) ?? getStoryVariants(rootId)[0])
    .filter((story): story is NormalizedStory => Boolean(story));
}

function toggleStory(story: NormalizedStory): void {
  const rootId = getStoryRootId(story);
  selectedStoryIds = selectedStoryIds.includes(rootId)
    ? selectedStoryIds.filter(id => id !== rootId)
    : [...selectedStoryIds, rootId];
  renderBody();
}

function getCollectionFaction(rootIds: string[]): FactionId | 'all' {
  const factions = new Set(rootIds
    .map(rootId => getStoryVariants(rootId)[0]?.faction)
    .filter((faction): faction is FactionId => Boolean(faction)));
  return factions.size === 1 ? [...factions][0]! : 'all';
}

async function downloadCollectionZip(rootIds: string[], title: string, collectionId?: string): Promise<void> {
  const selectedStories = rootIds
    .map(rootId => ({ rootId, variants: getStoryVariants(rootId) }))
    .filter(group => group.variants.length > 0);
  if (selectedStories.length === 0) {
    alert('No available stories to download.');
    return;
  }

  const byFaction = new Map<FactionId, Array<{ rootId: string; variants: NormalizedStory[] }>>();
  for (const group of selectedStories) {
    const faction = group.variants[0]!.faction;
    const list = byFaction.get(faction) ?? [];
    list.push(group);
    byFaction.set(faction, list);
  }

  const language = store.get().uiLanguage;
  const folder = language === 'ru' ? 'rus' : 'eng';
  const suffix = language === 'ru' ? 'rus' : 'eng';
  const files: Array<{ path: string; content: string }> = [
    {
      path: 'README_INSTALL.txt',
      content: [
        'P.A.N.D.A storyline collection',
        '',
        'Install:',
        '1. Extract this ZIP.',
        '2. Merge gamedata folder into your S.T.A.L.K.E.R. Anomaly folder.',
        `3. Final XML path should be gamedata\\configs\\text\\${folder}\\.`,
        '',
        `Language included: ${language === 'ru' ? 'Russian' : 'English'}.`,
        'Each storyline is kept in its own XML file. A collection manifest XML tells P.A.N.D.A which story prefixes to scan.',
        'Use one active collection pack at a time to avoid storyline ID clashes.',
      ].join('\r\n'),
    },
  ];

  for (const [faction, groups] of byFaction.entries()) {
    const factionKey = FACTION_XML_KEYS[faction];
    const prefixes: string[] = [];
    const usedSlugs = new Map<string, number>();

    groups.forEach((group, index) => {
      const story = pickBestVariant(group.variants, language) ?? group.variants[0]!;
      const sourceConversation = story.data.conversations[0] as Conversation | undefined;
      if (!sourceConversation) return;

      const baseSlug = slugify(sourceConversation.storyline_id || story.label || group.rootId || `story_${index + 1}`);
      const nextCount = (usedSlugs.get(baseSlug) ?? 0) + 1;
      usedSlugs.set(baseSlug, nextCount);
      const storySlug = nextCount === 1 ? baseSlug : `${baseSlug}_${nextCount}`;
      const storyPrefix = `panda_${storySlug}`;
      prefixes.push(storyPrefix);

      const project = createEmptyProject(faction);
      const conversation = structuredClone(sourceConversation) as Conversation;
      conversation.id = 1;
      conversation.language = language;
      conversation.label = story.label || conversation.label;
      project.conversations = [conversation];
      const xml = generateXml(project, undefined, undefined, {
        ...ZIP_EXPORT_CONFIG,
        conversationKeyPrefix: storyPrefix,
        useStoryKeyPrefixes: false,
      }, language);
      files.push({
        path: `gamedata/configs/text/${folder}/st_PANDA_${storyPrefix}_${factionKey}_${suffix}.xml`,
        content: xml,
      });
    });

    if (prefixes.length > 0) {
      files.push({
        path: `gamedata/configs/text/${folder}/st_PANDA_panda_${factionKey}_collection_manifest_${suffix}.xml`,
        content: createCollectionManifestXml(factionKey, prefixes),
      });
    }
  }

  downloadBlob(createZipBlob(files), `${slugify(title || 'panda_collection')}.zip`);
  if (collectionId) await incrementCollectionDownload(collectionId).catch(() => undefined);
}

function createCollectionManifestXml(factionKey: string, prefixes: string[]): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<string_table>',
    '',
    `    <string id="st_pda_ic_panda_${factionKey}_prefixes">`,
    `        <text>${Array.from(new Set(prefixes)).join(',')}</text>`,
    '    </string>',
    '',
    '</string_table>',
  ].join('\n');
}

function pickBestVariant(variants: NormalizedStory[], language: UiLanguage): NormalizedStory | null {
  const matching = variants.filter(story => story.language === language);
  if (matching.length === 0) return null;
  matching.sort((a, b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at));
  return matching[0] ?? null;
}

function emptyState(message: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'collections-empty';
  el.textContent = message;
  return el;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'panda_collection';
}
