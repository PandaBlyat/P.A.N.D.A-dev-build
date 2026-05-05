// P.A.N.D.A. Conversation Editor — Community Library Panel
// Full-screen modal for browsing, publishing, and importing shared conversations.

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';
import { createEmptyProject } from '../lib/xml-export';
import {
  createSummaryFromConversation,
  deriveConversationComplexity,
  fetchConversations,
  fetchCommunityLibraryStats,
  incrementDownload,
  incrementUpvote,
  isEditorAdminPublisher,
  publishConversation,
  updateConversationLibrarySection,
  type CommunityConversation,
  type CommunityLibrarySection,
  type CommunityLibraryStats,
  type ConversationComplexity,
} from '../lib/api-client';
import { COMMUNITY_CONVERSATIONS } from '../lib/community-data';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES, FACTION_DISPLAY_NAMES_RU, FACTION_XML_KEYS, getConversationFaction, type Conversation, type FactionId } from '../lib/types';
import { createUiText, languageFlag, languageLabel, otherLanguage, type UiLanguage } from '../lib/ui-language';
import { t } from '../lib/i18n';
import { FACTION_COLORS } from '../lib/faction-colors';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';
import { importConversations } from './App';
import { downloadFile } from '../lib/project-io';
import { showXpToast, showLevelUpToast } from './XpToast';
import { showPublishCelebration } from './PublishCelebration';
import {
  awardXp,
  awardXpCapped,
  fetchUserProfile,
  fetchUserPublishCount,
  getPublishXp,
  getStoredUsername,
  syncUserMissionProgress,
  unlockAchievement,
  updateUserStreak,
  type UserProfile,
} from '../lib/api-client';
import { setProfileForBadge, invalidateLeaderboardCache } from './ProfileBadge';
import { buildValidationSummary, splitValidationMessages } from '../lib/validation-gate';
import {
  evaluatePublishGamification,
  calculateQualityScore,
  getMissionCompletionHeadline,
  getQualityMultiplier,
  setCooldown,
  unlockAchievementLocally,
} from '../lib/gamification';
import { showAchievementToasts, showGamificationToast } from './AchievementToast';
import { flushCollabSessionForPublish, isCollabHost, isInCollabSession } from '../lib/collab-session';

type SortMode = 'newest' | 'upvoted';
type LengthFilter = 'all' | 'short' | 'medium' | 'long';
type LibrarySource = 'bundled' | 'remote';
type ViewMode = 'gallery' | 'list';
type LibraryView = 'community' | 'curated' | 'demo';

type NormalizedConversation = CommunityConversation & {
  tags: string[];
  branch_count: number;
  complexity: ConversationComplexity;
  library_section: CommunityLibrarySection;
  summary: string;
  upvotes: number;
  updated_at: string;
  source: LibrarySource;
  language: UiLanguage;
};
type CommunitySourceMetadata = {
  id: string;
  publisher_id?: string;
  co_authors?: string[];
  sourceLanguage?: UiLanguage;
  targetLanguage?: UiLanguage;
  isTranslationDraft?: boolean;
};
type TranslationSourceMetadata = {
  sourceLanguage?: UiLanguage;
  targetLanguage?: UiLanguage;
  isTranslationDraft?: boolean;
};
type ConversationWithSource = Conversation & {
  community_source?: CommunitySourceMetadata;
};

const LOCAL_UPVOTE_KEY = 'panda-community-upvotes';
const LOCAL_PUBLISHER_ID_KEY = 'panda-community-publisher-id';
const SHARE_PANEL_MOUNT_ID = 'app-modal-host';

function getCurrentPublisherIds(): string[] {
  const ids = new Set<string>();
  const currentProfile = (globalThis as any).__pandaUserProfile as UserProfile | null;
  const profilePublisherId = currentProfile?.publisher_id?.trim();
  if (profilePublisherId) ids.add(profilePublisherId);
  if (typeof window !== 'undefined') {
    const localPublisherId = window.localStorage.getItem(LOCAL_PUBLISHER_ID_KEY)?.trim();
    if (localPublisherId) ids.add(localPublisherId);
  }
  return Array.from(ids);
}

function userOwnsConversation(conv: CommunityConversation): boolean {
  const publisherId = conv.publisher_id?.trim();
  const currentIds = getCurrentPublisherIds();
  if (publisherId && currentIds.includes(publisherId)) return true;
  return (conv.co_authors ?? []).some((coAuthor) => currentIds.includes(coAuthor));
}

function canManageCommunitySections(): boolean {
  return viewerCanManageSections;
}

function getAdminPublisherId(): string {
  const profile = (globalThis as any).__pandaUserProfile as UserProfile | null;
  return profile?.publisher_id?.trim() || window.localStorage.getItem(LOCAL_PUBLISHER_ID_KEY)?.trim() || '';
}

async function refreshCommunitySectionPermission(): Promise<void> {
  const profile = (globalThis as any).__pandaUserProfile as UserProfile | null;
  const username = (profile?.username ?? getStoredUsername() ?? '').trim().toLowerCase();
  if (username === 'panda') {
    viewerCanManageSections = true;
    return;
  }
  const publisherId = getAdminPublisherId();
  viewerCanManageSections = publisherId ? await isEditorAdminPublisher(publisherId) : false;
}

function attachCommunitySourceMetadata(conversation: Conversation, metadata: CommunitySourceMetadata): Conversation {
  return ({
    ...conversation,
    community_source: metadata,
  } as ConversationWithSource) as Conversation;
}

function getCommunitySourceMetadata(conversation: Conversation | null | undefined): CommunitySourceMetadata | null {
  if (!conversation || typeof conversation !== 'object') return null;
  const maybe = (conversation as ConversationWithSource).community_source;
  if (!maybe || typeof maybe.id !== 'string' || !maybe.id.trim()) return null;
  return {
    id: maybe.id.trim(),
    publisher_id: typeof maybe.publisher_id === 'string' ? maybe.publisher_id.trim() : undefined,
    co_authors: Array.isArray(maybe.co_authors) ? maybe.co_authors.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : undefined,
    sourceLanguage: maybe.sourceLanguage === 'ru' ? 'ru' : maybe.sourceLanguage === 'en' ? 'en' : undefined,
    targetLanguage: maybe.targetLanguage === 'ru' ? 'ru' : maybe.targetLanguage === 'en' ? 'en' : undefined,
    isTranslationDraft: maybe.isTranslationDraft === true ? true : undefined,
  };
}

function getReplacementPublisherId(sourcePublisherId?: string, sourceCoAuthors: string[] = []): string | undefined {
  const currentIds = getCurrentPublisherIds();
  if (sourcePublisherId && currentIds.includes(sourcePublisherId)) return sourcePublisherId;
  return currentIds.find((id) => sourceCoAuthors.includes(id));
}

function getUiLanguage(): UiLanguage {
  return store.get().uiLanguage;
}

function getUiText() {
  return createUiText(getUiLanguage());
}

function getStoryLanguage(conv: CommunityConversation): UiLanguage {
  return conv.data?.language === 'ru' ? 'ru' : 'en';
}

function getStoryRootId(conv: CommunityConversation): string {
  const root = conv.data?.translation?.source_id;
  return typeof root === 'string' && root.trim().length > 0 ? root.trim() : conv.id;
}

function isTranslationEntry(conv: CommunityConversation): boolean {
  return typeof conv.data?.translation?.source_id === 'string' && conv.data.translation.source_id.trim().length > 0;
}

function getTranslationSourceLanguage(conv: CommunityConversation): UiLanguage | null {
  const source = conv.data?.translation?.source_language;
  return source === 'ru' ? 'ru' : source === 'en' ? 'en' : null;
}

function hasTranslationForLanguage(sourceId: string, language: UiLanguage): boolean {
  return allResults.some((entry) =>
    entry.data?.translation?.source_id === sourceId
    && entry.data.translation.target_language === language,
  );
}

function isTranslationDraftMetadata(metadata: TranslationSourceMetadata | null | undefined): metadata is TranslationSourceMetadata & { isTranslationDraft: true } {
  return Boolean(metadata?.isTranslationDraft);
}


function bindMouseSpotlight(card: HTMLElement): void {
  card.classList.add('mouse-glow-card');
  card.addEventListener('pointermove', (event: PointerEvent) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
  });
}

function getSharePanelMount(): HTMLElement {
  return document.getElementById(SHARE_PANEL_MOUNT_ID)
    ?? document.getElementById('app')
    ?? document.body;
}

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;
let activeFaction: FactionId | 'all' = 'all';
let allResults: NormalizedConversation[] = [];
let selectedPreviewId: string | null = null;
let searchQuery = '';
let sortMode: SortMode = 'newest';
let lengthFilter: LengthFilter = 'all';
let viewMode: ViewMode = 'gallery';
let libraryView: LibraryView = 'community';
let isLoading = false;
let loadError = '';
let loadNotice = '';
let communityStats: CommunityLibraryStats | null = null;
let unsubscribeSharePanelStore: (() => void) | null = null;
let isReplacementCandidate = false;
let replacementCommunityId: string | null = null;
let viewerCanManageSections = false;

function isOwnedSelectedSourceMetadata(
  sourceMetadata: ReturnType<typeof store.getSelectedConversationSourceMetadata>,
): boolean {
  const sourcePublisherId = sourceMetadata?.sourcePublisherId?.trim();
  return Boolean(getReplacementPublisherId(sourcePublisherId, sourceMetadata?.sourceCoAuthors ?? []));
}

function getPrimaryPublishReplacementMode(): boolean {
  return isReplacementCandidate && !!replacementCommunityId;
}

function updateReplacementIntentState(): void {
  const selectedConversation = store.getSelectedConversation();
  if (!selectedConversation) {
    isReplacementCandidate = false;
    replacementCommunityId = null;
    return;
  }
  const sourceMetadata = store.getSelectedConversationSourceMetadata();
  const sourceCommunityId = sourceMetadata?.sourceCommunityId?.trim() || '';
  const ownedSource = !!sourceMetadata && isOwnedSelectedSourceMetadata(sourceMetadata);
  isReplacementCandidate = !!sourceCommunityId && ownedSource;
  replacementCommunityId = isReplacementCandidate ? sourceCommunityId : null;
}

function refreshPrimaryPublishCta(): void {
  const publishBtn = overlayEl?.querySelector<HTMLButtonElement>('[data-share-publish]');
  if (!publishBtn) return;
  const ui = getUiText();
  if (isInCollabSession() && !isCollabHost()) {
    setButtonContent(publishBtn, 'export', ui('Publish', 'Опубликовать'));
    publishBtn.title = ui('Only the host can publish', 'Только хост может публиковать');
    publishBtn.disabled = true;
    publishBtn.onclick = null;
    return;
  }
  publishBtn.disabled = false;

  const useUpdateMode = getPrimaryPublishReplacementMode();
  if (useUpdateMode) {
    setButtonContent(publishBtn, 'export', ui('Update', 'Обновить'));
    publishBtn.title = ui('Update your existing community story', 'Обновить вашу историю в сообществе');
    publishBtn.onclick = () => { void handlePrimaryPublishAction(publishBtn); };
    return;
  }

  setButtonContent(publishBtn, 'export', ui('Publish', 'Опубликовать'));
  publishBtn.title = ui('Publish the currently selected story to the Community Library', 'Опубликовать выбранную историю в Библиотеке сообщества');
  publishBtn.onclick = () => { void handlePrimaryPublishAction(publishBtn); };
}

async function handlePrimaryPublishAction(triggerBtn?: HTMLButtonElement): Promise<void> {
  updateReplacementIntentState();
  if (!getPrimaryPublishReplacementMode()) {
    showPublishForm();
    return;
  }

  const conv = store.getSelectedConversation();
  const sourceMetadata = store.getSelectedConversationSourceMetadata();
  const sourceCommunityId = sourceMetadata?.sourceCommunityId?.trim();
  const sourcePublisherId = sourceMetadata?.sourcePublisherId?.trim();
  const replacementPublisherId = getReplacementPublisherId(sourcePublisherId, sourceMetadata?.sourceCoAuthors ?? []);
  const faction = getConversationFaction(conv, store.get().project.faction);
  if (!conv || !sourceCommunityId || !sourcePublisherId) {
    showPublishForm({ replacementContext: true });
    return;
  }

  if (!replacementPublisherId) {
    alert('You can only update conversations published by your current publisher identity.');
    showPublishForm({ replacementContext: true });
    return;
  }
  if (isInCollabSession() && !isCollabHost()) {
    alert('Only the host can publish.');
    return;
  }

  const libraryMatch = allResults.find(entry => entry.id === sourceCommunityId);
  const label = conv.label?.trim() || libraryMatch?.label?.trim() || '';
  if (!label) {
    alert('This story is missing a title. Open Update form to set one before replacing.');
    showPublishForm({ replacementContext: true });
    return;
  }

  const originalContent = triggerBtn?.innerHTML;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    setButtonContent(triggerBtn, 'export', t('share.status.updating'));
  }

  try {
    const coAuthorFields = getCollabCoAuthorPublishFields(replacementPublisherId);
    const collabSessionId = isInCollabSession() ? await flushCollabSessionForPublish() : null;
    await publishConversation({
      faction,
      label,
      description: libraryMatch?.description || '',
      summary: createSummaryFromConversation(conv),
      author: getStoredUsername() || libraryMatch?.author || 'Anonymous',
      tags: libraryMatch?.tags ?? [],
      branch_count: getBranchCount(conv),
      complexity: deriveConversationComplexity(getBranchCount(conv)),
      data: {
        version: store.get().project.version,
        faction,
        conversations: [conv],
      },
      replace_id: sourceCommunityId,
      publisher_id: replacementPublisherId,
      ...coAuthorFields,
      collab_session_id: collabSessionId ?? undefined,
    });
    loadNotice = 'Updated existing community story. Refreshing library…';
    loadError = '';
    renderContent();
    await loadConversations();
  } catch (err) {
    alert(`Quick update failed: ${err instanceof Error ? err.message : String(err)}`);
    showPublishForm({ replacementContext: true });
  } finally {
    if (triggerBtn && originalContent) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalContent;
      refreshPrimaryPublishCta();
    }
  }
}

export function openSharePanel(): void {
  if (overlayEl) return;
  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeFaction = 'all';
  allResults = [];
  selectedPreviewId = null;
  searchQuery = '';
  sortMode = 'newest';
  lengthFilter = 'all';
  isLoading = false;
  loadError = '';
  loadNotice = '';
  communityStats = null;
  viewerCanManageSections = false;
  isReplacementCandidate = false;
  replacementCommunityId = null;

  overlayEl = buildOverlay();
  getSharePanelMount().appendChild(overlayEl);
  updateReplacementIntentState();
  refreshPrimaryPublishCta();
  unsubscribeSharePanelStore = store.subscribe(() => {
    updateReplacementIntentState();
    refreshPrimaryPublishCta();
  });
  loadConversations();
}

export function closeSharePanel(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  unsubscribeSharePanelStore?.();
  unsubscribeSharePanelStore = null;
  focusTrap?.release();
  focusTrap = null;
  restoreFocusEl = null;
}

async function loadConversations(): Promise<void> {
  isLoading = true;
  loadError = '';
  loadNotice = '';
  renderContent();

  const bundled = normalizeCollection(COMMUNITY_CONVERSATIONS, 'bundled');

  try {
    const [remoteRows, stats] = await Promise.all([
      fetchConversations(activeFaction === 'all' ? undefined : activeFaction),
      fetchCommunityLibraryStats().catch(() => null),
      refreshCommunitySectionPermission().catch(() => undefined),
    ]);
    const remote = normalizeCollection(remoteRows, 'remote');
    allResults = mergeConversationLists(bundled, remote);
    communityStats = stats;
    loadNotice = bundled.length > 0
      ? 'Showing bundled picks alongside community uploads.'
      : 'Showing live community uploads.';
  } catch (err) {
    allResults = bundled;
    if (bundled.length > 0) {
      loadNotice = `Remote community sync failed, so bundled picks are shown instead. ${err instanceof Error ? err.message : String(err)}`;
      loadError = '';
    } else {
      loadError = err instanceof Error ? err.message : 'Failed to load stories.';
    }
  } finally {
    isLoading = false;
    ensurePreviewSelection();
    renderContent();
  }
}

function normalizeCollection(entries: CommunityConversation[], source: LibrarySource): NormalizedConversation[] {
  return entries
    .map(entry => normalizeConversation(entry, source))
    .filter(entry => activeFaction === 'all' || entry.faction === activeFaction);
}

function normalizeConversation(entry: CommunityConversation, source: LibrarySource): NormalizedConversation {
  const conversation = entry.data?.conversations?.[0];
  const branchCount = entry.branch_count || getBranchCount(conversation);
  return {
    ...entry,
    label: (entry.label || conversation?.label || 'Untitled').trim(),
    description: (entry.description || '').trim(),
    summary: (entry.summary || createSummaryFromConversation(conversation ?? createFallbackConversation())).trim(),
    tags: Array.from(new Set((entry.tags ?? []).map(tag => tag.trim()).filter(Boolean))).slice(0, 6),
    co_authors: entry.co_authors ?? [],
    co_author_usernames: entry.co_author_usernames ?? [],
    library_section: entry.library_section === 'curated' || entry.library_section === 'demo' ? entry.library_section : 'community',
    branch_count: branchCount,
    complexity: entry.complexity ?? deriveConversationComplexity(branchCount),
    upvotes: entry.upvotes ?? 0,
    updated_at: entry.updated_at ?? entry.created_at,
    source,
    language: entry.data?.language === 'ru' ? 'ru' : 'en',
  };
}

function createFallbackConversation(): Conversation {
  return {
    id: 0,
    label: 'Untitled',
    preconditions: [],
    turns: [{ turnNumber: 1, preconditions: [], choices: [], position: { x: 0, y: 0 } }],
  };
}

function getCollabCoAuthorNames(publisherId?: string): string[] {
  const collab = store.get().collab;
  if (!collab.sessionId) return [];
  const ownerId = publisherId || collab.localPublisherId;
  return collab.participants
    .filter((participant) => participant.publisherId !== ownerId)
    .map((participant) => participant.username)
    .filter(Boolean);
}

function getCollabCoAuthorPublishFields(publisherId?: string): { co_authors: string[]; co_author_usernames: string[] } {
  const collab = store.get().collab;
  if (!collab.sessionId) return { co_authors: [], co_author_usernames: [] };
  const ownerId = publisherId || collab.localPublisherId;
  const participants = collab.participants.filter((participant) => participant.publisherId && participant.publisherId !== ownerId);
  return {
    co_authors: participants.map((participant) => participant.publisherId),
    co_author_usernames: participants.map((participant) => participant.username || participant.publisherId),
  };
}

function getBranchCount(conversation?: Conversation): number {
  return Math.max(1, conversation?.turns.length ?? 1);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mergeConversationLists(bundled: NormalizedConversation[], remote: NormalizedConversation[]): NormalizedConversation[] {
  const merged = new Map<string, NormalizedConversation>();
  for (const entry of bundled) {
    merged.set(getConversationMergeKey(entry), entry);
  }
  for (const entry of remote) {
    merged.set(getConversationMergeKey(entry), entry);
  }
  return Array.from(merged.values());
}

function getConversationMergeKey(entry: NormalizedConversation): string {
  const translation = entry.data?.translation;
  if (translation?.source_id && translation.target_language) {
    return `translation:${translation.source_id}:${translation.target_language}`;
  }
  const language = entry.language ?? 'en';
  return `story:${entry.faction}:${normalizeKey(entry.label)}:${language}`;
}

function getPrimaryConversationResults(): NormalizedConversation[] {
  const sourceIds = new Set(allResults.filter((entry) => !isTranslationEntry(entry)).map((entry) => entry.id));
  return allResults.filter((entry) => {
    if (!isTranslationEntry(entry)) return true;
    const sourceId = entry.data?.translation?.source_id;
    if (!sourceId) return true;
    // Hide translation rows when source exists; still keep them in allResults for detection/flags.
    return !sourceIds.has(sourceId);
  });
}

function getFilteredResults(): NormalizedConversation[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = getPrimaryConversationResults().filter(conv => {
    const section = conv.library_section ?? 'community';
    if (libraryView === 'curated' && section !== 'curated') return false;
    if (libraryView === 'demo' && section !== 'demo') return false;
    if (libraryView === 'community' && section === 'demo') return false;
    if (lengthFilter === 'short' && conv.branch_count > 3) return false;
    if (lengthFilter === 'medium' && (conv.branch_count < 4 || conv.branch_count > 6)) return false;
    if (lengthFilter === 'long' && conv.branch_count < 7) return false;
    if (!q) return true;
    return [
      conv.label,
      conv.description,
      conv.summary,
      conv.author,
      ...conv.tags,
    ].some(value => value.toLowerCase().includes(q));
  });

  filtered.sort((a, b) => {
    if (sortMode === 'upvoted') {
      return b.upvotes - a.upvotes || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    }
    return Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.upvotes - a.upvotes;
  });

  return filtered;
}

function getStoryAvailableLanguages(rootId: string): Set<UiLanguage> {
  const out = new Set<UiLanguage>();
  for (const entry of allResults) {
    if (getStoryRootId(entry) !== rootId) continue;
    out.add(getStoryLanguage(entry));
  }
  return out;
}

function getStoryLanguageFlags(rootId: string): string {
  const availableLanguages = getStoryAvailableLanguages(rootId);
  const flags: string[] = [];
  if (availableLanguages.has('en')) flags.push(languageFlag('en'));
  if (availableLanguages.has('ru')) flags.push(languageFlag('ru'));
  return flags.join(' ');
}

function getStoryRootLanguage(rootId: string): UiLanguage {
  const root = allResults.find((entry) => entry.id === rootId);
  if (root) return getStoryLanguage(root);
  const anyTranslation = allResults.find((entry) => getStoryRootId(entry) === rootId && isTranslationEntry(entry));
  return (anyTranslation ? (getTranslationSourceLanguage(anyTranslation) ?? null) : null) ?? 'en';
}

function pickBestStoryVariant(variants: NormalizedConversation[], language: UiLanguage): NormalizedConversation | null {
  const candidates = variants.filter((entry) => getStoryLanguage(entry) === language);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  return candidates[0] ?? null;
}

function getTranslationSourceEntry(rootId: string): NormalizedConversation | null {
  return allResults.find((entry) => entry.id === rootId)
    ?? allResults.find((entry) => getStoryRootId(entry) === rootId && !isTranslationEntry(entry))
    ?? allResults.find((entry) => getStoryRootId(entry) === rootId)
    ?? null;
}

function getStoryVariants(rootId: string): NormalizedConversation[] {
  return allResults.filter((entry) => getStoryRootId(entry) === rootId);
}

function ensurePreviewSelection(): void {
  const visible = getFilteredResults();
  if (visible.length === 0) {
    selectedPreviewId = null;
    return;
  }
  if (!selectedPreviewId || !visible.some(conv => conv.id === selectedPreviewId)) {
    selectedPreviewId = visible[0].id;
  }
}

function getSelectedPreview(): NormalizedConversation | null {
  return getFilteredResults().find(conv => conv.id === selectedPreviewId) ?? null;
}

function getContentEl(): HTMLElement | null {
  return overlayEl?.querySelector('.share-grid-wrap') ?? null;
}

function getDownloadAllBtn(): HTMLButtonElement | null {
  return overlayEl?.querySelector<HTMLButtonElement>('.share-download-all-btn') ?? null;
}

type PublishPreviewStats = {
  branchCount: number;
  dialogueChoiceCount: number;
  dialogueChoiceXp: number;
  complexity: ConversationComplexity;
  basePublishXp: number;
  qualityScore: ReturnType<typeof calculateQualityScore>;
  qualityMultiplier: number;
  translationMultiplier: number;
  publishXp: number;
};

function formatMultiplier(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function getPublishPreviewStats(conversation: Conversation): PublishPreviewStats {
  const branchCount = getBranchCount(conversation);
  const dialogueChoiceCount = getDialogueChoiceCount(conversation);
  const dialogueChoiceXp = dialogueChoiceCount * 25;
  const complexity = deriveConversationComplexity(branchCount);
  const basePublishXp = getPublishXp(complexity);
  const qualityScore = calculateQualityScore(conversation);
  const qualityMultiplier = getQualityMultiplier(qualityScore.totalStars);
  const sourceMetadata = store.getSelectedConversationSourceMetadata() ?? getCommunitySourceMetadata(conversation);
  const translationMultiplier = isTranslationDraftMetadata(sourceMetadata) ? 0.5 : 1;
  const publishXp = Math.round((basePublishXp * qualityMultiplier + dialogueChoiceXp) * translationMultiplier);

  return {
    branchCount,
    dialogueChoiceCount,
    dialogueChoiceXp,
    complexity,
    basePublishXp,
    qualityScore,
    qualityMultiplier,
    translationMultiplier,
    publishXp,
  };
}

function getDialogueChoiceCount(conversation: Conversation): number {
  return conversation.turns.reduce((total, turn) => total + turn.choices.length, 0);
}

function buildOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'share-overlay';

  const modal = document.createElement('div');
  modal.className = 'share-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'share-modal-title');
  modal.onclick = (e) => e.stopPropagation();

  modal.appendChild(buildHeader());

  const body = document.createElement('div');
  body.className = 'share-modal-body';
  body.appendChild(buildSidebar());

  const contentArea = document.createElement('div');
  contentArea.className = 'share-content';
  contentArea.appendChild(buildToolbarRow());

  const gridWrap = document.createElement('div');
  gridWrap.className = 'share-grid-wrap';
  contentArea.appendChild(gridWrap);

  body.appendChild(contentArea);
  modal.appendChild(body);
  modal.appendChild(buildPublishForm());

  overlay.appendChild(modal);
  const closeButton = modal.querySelector<HTMLButtonElement>('[data-share-close]');
  focusTrap = trapFocus(modal, {
    restoreFocus: restoreFocusEl,
    initialFocus: closeButton,
    onEscape: closeSharePanel,
  });
  return overlay;
}

function buildHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'share-modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'share-modal-title';
  titleWrap.id = 'share-modal-title';
  const titleIcon = createIcon('share');

  const titleCopy = document.createElement('div');
  titleCopy.className = 'share-modal-title-copy';

  const titleKicker = document.createElement('span');
  titleKicker.className = 'share-modal-title-kicker';
  const ui = getUiText();
  titleKicker.textContent = ui('Community Exchange', 'Обмен сообщества');

  const titleText = document.createElement('span');
  titleText.className = 'share-modal-title-text';
  titleText.textContent = ui('Community Library', 'Библиотека сообщества');

  const titleSubtitle = document.createElement('span');
  titleSubtitle.className = 'share-modal-title-subtitle';
  titleSubtitle.textContent = ui('Preview uploads, polish metadata, and publish stronger branching stories without leaving the editor.', 'Просматривайте загрузки, улучшайте метаданные и публикуйте истории с ветками, не выходя из редактора.');

  titleCopy.append(titleKicker, titleText, titleSubtitle);
  titleWrap.append(titleIcon, titleCopy);
  const titleSlot = document.createElement('div');
  titleSlot.className = 'share-modal-header-slot share-modal-header-slot-start';
  titleSlot.appendChild(titleWrap);
  header.appendChild(titleSlot);

  const publishSlot = document.createElement('div');
  publishSlot.className = 'share-modal-header-slot share-modal-header-slot-center';

  const publishBtn = document.createElement('button');
  publishBtn.type = 'button';
  publishBtn.className = 'toolbar-button btn-primary';
  publishBtn.dataset.sharePublish = 'true';
  setButtonContent(publishBtn, 'export', ui('Publish', 'Опубликовать'));
  publishBtn.title = ui('Publish the currently selected story to the Community Library', 'Опубликовать выбранную историю в Библиотеке сообщества');
  if (isInCollabSession() && !isCollabHost()) {
    publishBtn.disabled = true;
    publishBtn.title = ui('Only the host can publish', 'Только хост может публиковать');
  } else {
    publishBtn.onclick = () => showPublishForm();
  }
  publishBtn.classList.add('share-publish-cta');
  publishSlot.appendChild(publishBtn);
  header.appendChild(publishSlot);

  const closeSlot = document.createElement('div');
  closeSlot.className = 'share-modal-header-slot share-modal-header-slot-end';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toolbar-button toolbar-icon-button btn-icon share-modal-close';
  closeBtn.dataset.shareClose = 'true';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = ui('Close Community Library', 'Закрыть библиотеку сообщества');
  closeBtn.onclick = closeSharePanel;
  closeSlot.appendChild(closeBtn);
  header.appendChild(closeSlot);

  return header;
}

function buildSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'share-sidebar';

  const ui = getUiText();
  const allTab = buildSidebarTab(ui('All Factions', 'Все группировки'), null, activeFaction === 'all');
  sidebar.appendChild(allTab);

  for (const fid of FACTION_IDS) {
    const tab = buildSidebarTab(ui(FACTION_DISPLAY_NAMES[fid], FACTION_DISPLAY_NAMES_RU[fid]), fid, activeFaction === fid);
    sidebar.appendChild(tab);
  }

  return sidebar;
}

function buildSidebarTab(label: string, faction: FactionId | null, active: boolean): HTMLElement {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = `share-sidebar-tab${active ? ' is-active' : ''}`;

  const dot = document.createElement('span');
  dot.className = 'share-faction-dot';
  dot.style.backgroundColor = faction ? FACTION_COLORS[faction] : 'var(--text-dim)';

  tab.append(dot, document.createTextNode(label));
  tab.onclick = () => {
    activeFaction = faction ?? 'all';
    allResults = [];
    selectedPreviewId = null;
    searchQuery = '';
    rebuildSidebar();
    updateDownloadAllBtn();
    loadConversations();
  };
  return tab;
}

function rebuildSidebar(): void {
  const sidebar = overlayEl?.querySelector('.share-sidebar');
  if (!sidebar) return;
  sidebar.replaceWith(buildSidebar());
}

function buildToolbarRow(): HTMLElement {
  const ui = getUiText();
  const row = document.createElement('div');
  row.className = 'share-toolbar-row';

  const viewTabs = document.createElement('div');
  viewTabs.className = 'share-library-tabs';
  ([
    ['community', ui('Community', 'Сообщество')],
    ['curated', ui('Curated Stories', 'Подборка историй')],
    ['demo', ui('Demo', 'Демо')],
  ] as Array<[LibraryView, string]>).forEach(([view, label]) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `share-library-tab${libraryView === view ? ' is-active' : ''}`;
    tab.textContent = label;
    tab.onclick = () => {
      libraryView = view;
      ensurePreviewSelection();
      renderContent();
      updateDownloadAllBtn();
    };
    viewTabs.appendChild(tab);
  });
  row.appendChild(viewTabs);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'share-search';
  searchInput.placeholder = ui('Search by title, author, description, or tag…', 'Поиск по названию, автору, описанию или тегу…');
  searchInput.value = searchQuery;
  searchInput.oninput = () => {
    searchQuery = searchInput.value;
    ensurePreviewSelection();
    renderContent();
  };
  row.appendChild(searchInput);

  const sortSelect = document.createElement('select');
  sortSelect.className = 'share-select';
  sortSelect.innerHTML = `<option value="newest">${ui('Newest', 'Новые')}</option><option value="upvoted">${ui('Most Upvoted', 'Популярные')}</option>`;
  sortSelect.value = sortMode;
  sortSelect.onchange = () => {
    sortMode = sortSelect.value as SortMode;
    ensurePreviewSelection();
    renderContent();
  };
  row.appendChild(sortSelect);

  const lengthSelect = document.createElement('select');
  lengthSelect.className = 'share-select';
  lengthSelect.innerHTML = `<option value="all">${ui('All lengths', 'Любая длина')}</option><option value="short">${ui('Short (1–3 branches)', 'Короткие (1–3 ветки)')}</option><option value="medium">${ui('Medium (4–6 branches)', 'Средние (4–6 веток)')}</option><option value="long">${ui('Long (7+ branches)', 'Длинные (7+ веток)')}</option>`;
  lengthSelect.value = lengthFilter;
  lengthSelect.onchange = () => {
    lengthFilter = lengthSelect.value as LengthFilter;
    ensurePreviewSelection();
    renderContent();
  };
  row.appendChild(lengthSelect);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'toolbar-button toolbar-icon-button btn-icon';
  refreshBtn.appendChild(createIcon('undo'));
  refreshBtn.title = ui('Refresh the story list', 'Обновить список историй');
  refreshBtn.onclick = () => {
    allResults = [];
    loadConversations();
  };
  row.appendChild(refreshBtn);

  const downloadAllBtn = document.createElement('button');
  downloadAllBtn.type = 'button';
  downloadAllBtn.className = 'toolbar-button share-download-all-btn';
  setButtonContent(downloadAllBtn, 'download', ui('Download All XML', 'Скачать все XML'));
  downloadAllBtn.title = ui('Download curated stories for this faction as a game-ready XML file', 'Скачать подборку историй для этой группировки в виде XML-файла');
  downloadAllBtn.hidden = activeFaction === 'all';
  downloadAllBtn.onclick = handleDownloadAll;
  row.appendChild(downloadAllBtn);

  // View mode toggle (gallery / list)
  const viewToggle = document.createElement('div');
  viewToggle.className = 'share-view-toggle';

  const galleryBtn = document.createElement('button');
  galleryBtn.type = 'button';
  galleryBtn.textContent = '▦';
  galleryBtn.title = ui('Gallery view', 'Вид сеткой');
  galleryBtn.className = viewMode === 'gallery' ? 'is-active' : '';
  galleryBtn.onclick = () => { viewMode = 'gallery'; renderContent(); rebuildToolbar(); };

  const listBtn = document.createElement('button');
  listBtn.type = 'button';
  listBtn.textContent = '☰';
  listBtn.title = ui('List view', 'Вид списком');
  listBtn.className = viewMode === 'list' ? 'is-active' : '';
  listBtn.onclick = () => { viewMode = 'list'; renderContent(); rebuildToolbar(); };

  viewToggle.append(galleryBtn, listBtn);
  row.appendChild(viewToggle);

  return row;
}

function updateDownloadAllBtn(): void {
  const btn = getDownloadAllBtn();
  if (btn) btn.hidden = activeFaction === 'all';
}

function rebuildToolbar(): void {
  const toolbar = overlayEl?.querySelector('.share-toolbar-row');
  if (toolbar) toolbar.replaceWith(buildToolbarRow());
}

function renderContent(): void {
  const wrap = getContentEl();
  if (!wrap) return;
  refreshPrimaryPublishCta();

  wrap.innerHTML = '';

  if (isLoading) {
    wrap.appendChild(buildLoadingState());
    return;
  }

  if (loadError) {
    wrap.appendChild(buildErrorState(loadError));
    return;
  }

  ensurePreviewSelection();
  const results = getFilteredResults();
  if (results.length === 0) {
    if (communityStats) wrap.appendChild(buildCommunitySummary(0));
    wrap.appendChild(buildEmptyState());
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'share-library-layout';

  const cardsColumn = document.createElement('div');
  cardsColumn.className = 'share-cards-column';
  cardsColumn.appendChild(buildCommunitySummary(results.length));
  if (loadNotice) cardsColumn.appendChild(buildNoticeState(loadNotice));

  if (viewMode === 'list') {
    const list = document.createElement('div');
    list.className = 'share-list';
    for (const conv of results) list.appendChild(buildListRow(conv));
    cardsColumn.appendChild(list);
  } else {
    const grid = document.createElement('div');
    grid.className = 'share-grid';
    for (const conv of results) grid.appendChild(buildCard(conv));
    cardsColumn.appendChild(grid);
  }

  layout.append(cardsColumn, buildPreviewDrawer(getSelectedPreview()));
  wrap.appendChild(layout);
}

function buildLoadingState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message';
  el.textContent = getUiText()('Loading…', 'Загрузка…');
  return el;
}

function buildEmptyState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message';
  const ui = getUiText();
  el.textContent = activeFaction === 'all'
    ? ui('No stories matched your filters. Try clearing search terms or publishing a new entry.', 'Ни одна история не соответствует фильтрам. Попробуйте очистить поиск или опубликовать новую.')
    : ui(`No ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} stories matched your filters yet.`, `Историй ${FACTION_DISPLAY_NAMES_RU[activeFaction as FactionId]} пока нет.`);
  return el;
}

function buildNoticeState(msg: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-banner';
  el.textContent = msg;
  return el;
}

function buildCommunitySummary(visibleCount: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-banner';

  const ui = getUiText();
  const factionLabel = activeFaction === 'all'
    ? ui('all factions', 'все группировки')
    : ui(FACTION_DISPLAY_NAMES[activeFaction as FactionId], FACTION_DISPLAY_NAMES_RU[activeFaction as FactionId]);
  const visibleLabel = ui(
    `${visibleCount} visible story${visibleCount !== 1 ? 's' : ''} in ${factionLabel}`,
    `${visibleCount} ${visibleCount === 1 ? 'история' : visibleCount < 5 ? 'истории' : 'историй'} в ${factionLabel}`,
  );

  if (!communityStats) {
    el.textContent = visibleLabel;
    return el;
  }

  const n = communityStats.published_conversations;
  const p = communityStats.published_publishers;
  el.textContent = ui(
    `${visibleLabel} · ${n} total published story${n !== 1 ? 's' : ''} · ${p} total publisher${p !== 1 ? 's' : ''}`,
    `${visibleLabel} · ${n} ${n === 1 ? 'история' : n < 5 ? 'истории' : 'историй'} всего · ${p} ${p === 1 ? 'автор' : p < 5 ? 'автора' : 'авторов'}`,
  );
  return el;
}

function buildErrorState(msg: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message share-state-error';
  el.textContent = msg;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'toolbar-button';
  retry.textContent = getUiText()('Retry', 'Повторить');
  retry.style.marginTop = '10px';
  retry.onclick = loadConversations;
  el.appendChild(retry);

  return el;
}

function buildCard(conv: NormalizedConversation): HTMLElement {
  const ui = getUiText();
  const currentLanguage = getUiLanguage();
  const rootId = getStoryRootId(conv);
  const root = allResults.find(entry => entry.id === rootId) ?? conv;
  const sourceLanguage = getStoryRootLanguage(rootId);
  const translationTarget = otherLanguage(sourceLanguage);
  const translationExistsForUi = hasTranslationForLanguage(rootId, currentLanguage);
  const translationExistsForTarget = hasTranslationForLanguage(rootId, translationTarget);
  const needsTranslation = !translationExistsForTarget;
  const isOwner = userOwnsConversation(conv);
  const card = document.createElement('div');
  card.className = `share-card${selectedPreviewId === conv.id ? ' is-selected' : ''}`;
  bindMouseSpotlight(card);
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${conv.label || 'Untitled'} by ${conv.author || 'Anonymous'}`);
  card.onclick = () => {
    selectedPreviewId = conv.id;
    renderContent();
  };

  const cardHeader = document.createElement('div');
  cardHeader.className = 'share-card-header';

  const dot = document.createElement('span');
  dot.className = 'share-faction-dot';
  dot.style.backgroundColor = FACTION_COLORS[conv.faction] ?? 'var(--text-dim)';

  const badge = document.createElement('span');
  badge.className = 'share-card-faction-badge';
  badge.textContent = FACTION_DISPLAY_NAMES[conv.faction] ?? conv.faction;
  badge.style.color = FACTION_COLORS[conv.faction] ?? 'var(--text-dim)';

  const title = document.createElement('span');
  title.className = 'share-card-title';
  title.textContent = conv.label || 'Untitled';
  title.title = conv.label || 'Untitled';

  const frameFlags = document.createElement('span');
  frameFlags.className = 'share-card-language-flags';
  frameFlags.textContent = getStoryLanguageFlags(rootId);
  frameFlags.title = frameFlags.textContent ? ui('Available languages', 'Доступные языки') : '';

  cardHeader.append(dot, badge, title, frameFlags);
  card.appendChild(cardHeader);

  const meta = document.createElement('div');
  meta.className = 'share-card-meta';
  meta.textContent = `${conv.author || ui('Anonymous', 'Аноним')} · ${formatRelativeDate(conv.updated_at)} · ${conv.branch_count} ${ui('branches', 'веток')}`;
  card.appendChild(meta);

  const stats = document.createElement('div');
  stats.className = 'share-card-stats';
  const coAuthorUsernames = conv.co_author_usernames ?? [];
  stats.append(
    buildChip(`${labelForComplexity(conv.complexity)} complexity`),
    buildChip(`↑ ${conv.upvotes}`),
    buildChip(`↓ ${conv.downloads}`),
  );
  if (coAuthorUsernames.length > 0) {
    stats.appendChild(buildChip(`+${coAuthorUsernames.length} co-author${coAuthorUsernames.length === 1 ? '' : 's'}`));
  }
  if (conv.library_section === 'curated') stats.appendChild(buildChip('Curated'));
  if (conv.library_section === 'demo') stats.appendChild(buildChip('Demo'));
  if (translationExistsForUi && currentLanguage !== sourceLanguage) {
    stats.appendChild(buildChip(`${languageFlag(currentLanguage)} ${ui('Translation', 'Перевод')}`));
  } else if (sourceLanguage !== currentLanguage) {
    stats.appendChild(buildChip(`${languageFlag(sourceLanguage)} ${ui('Source', 'Источник')}`));
  }
  const storyFlags = getStoryLanguageFlags(rootId);
  if (storyFlags) {
    const flagBadge = buildChip(storyFlags);
    flagBadge.title = ui('Available languages', 'Доступные языки');
    stats.appendChild(flagBadge);
  }
  card.appendChild(stats);

  if (conv.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'share-tag-list';
    conv.tags.forEach(tag => tags.appendChild(buildChip(`#${tag}`)));
    card.appendChild(tags);
  }

  if (conv.description) {
    const desc = document.createElement('div');
    desc.className = 'share-card-desc';
    desc.textContent = conv.description;
    card.appendChild(desc);
  }

  const actions = document.createElement('div');
  actions.className = 'share-card-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'toolbar-button btn-sm';
  previewBtn.textContent = ui('Preview', 'Просмотр');
  previewBtn.onclick = (event) => {
    event.stopPropagation();
    selectedPreviewId = conv.id;
    renderContent();
  };
  actions.appendChild(previewBtn);

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = 'toolbar-button btn-sm';
  upvoteBtn.textContent = hasUpvoted(conv.id)
    ? `${ui('Upvoted', 'Уже лайкнуто')} ↑ ${conv.upvotes}`
    : `${ui('Upvote', 'Лайк')} ↑ ${conv.upvotes}`;
  upvoteBtn.disabled = hasUpvoted(conv.id);
  upvoteBtn.onclick = async (event) => {
    event.stopPropagation();
    await handleUpvote(conv, upvoteBtn);
  };
  actions.appendChild(upvoteBtn);

  const variants = getStoryVariants(rootId);
  const importLanguages = Array.from(getStoryAvailableLanguages(rootId)).sort((a, b) => a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b));
  if (importLanguages.length > 1) {
    for (const language of importLanguages) {
      actions.appendChild(createLanguageImportButton(conv, language, variants, 'card'));
    }
  } else {
    actions.appendChild(createLanguageImportButton(conv, importLanguages[0] ?? getStoryLanguage(conv), variants, 'card', ui('Import', 'Импорт')));
  }

  if (needsTranslation) {
    const translateBtn = document.createElement('button');
    translateBtn.type = 'button';
    translateBtn.className = 'toolbar-button btn-sm';
    setButtonContent(translateBtn, 'download', ui('Translate', 'Перевести'));
    translateBtn.title = ui(
      `Import story as a translation draft (${languageLabel(sourceLanguage)} → ${languageLabel(translationTarget)})`,
      `Импортировать историю как черновик перевода (${languageLabel(sourceLanguage)} → ${languageLabel(translationTarget)})`,
    );
    translateBtn.onclick = async (event) => {
      event.stopPropagation();
      await handleTranslateImport(conv, translateBtn, translationTarget);
    };
    actions.appendChild(translateBtn);
  }

  if (isOwner) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'toolbar-button btn-sm';
    editBtn.onclick = async (event) => {
      event.stopPropagation();
      await handleEditImport(conv, editBtn);
    };
    actions.appendChild(editBtn);
  }

  if (canManageCommunitySections() && conv.source === 'remote') {
    ([
      ['community', 'Community'],
      ['curated', 'Curate'],
      ['demo', 'Demo'],
    ] as Array<[CommunityLibrarySection, string]>).forEach(([section, label]) => {
      if ((conv.library_section ?? 'community') === section) return;
      const sectionBtn = document.createElement('button');
      sectionBtn.type = 'button';
      sectionBtn.className = 'toolbar-button btn-sm share-admin-section-btn';
      sectionBtn.textContent = label;
      sectionBtn.onclick = async (event) => {
        event.stopPropagation();
        await handleLibrarySectionChange(conv, section, sectionBtn);
      };
      actions.appendChild(sectionBtn);
    });
  }

  card.appendChild(actions);
  return card;
}

function buildListRow(conv: NormalizedConversation): HTMLElement {
  const row = document.createElement('div');
  row.className = `share-list-row${selectedPreviewId === conv.id ? ' is-selected' : ''}`;
  row.onclick = () => {
    selectedPreviewId = conv.id;
    renderContent();
  };

  const rootId = getStoryRootId(conv);

  const dot = document.createElement('span');
  dot.className = 'share-faction-dot';
  dot.style.backgroundColor = FACTION_COLORS[conv.faction] ?? 'var(--text-dim)';

  const title = document.createElement('span');
  title.className = 'share-list-row-title';
  title.textContent = conv.label || 'Untitled';
  title.title = conv.label || 'Untitled';

  const flags = document.createElement('span');
  flags.className = 'share-list-row-flags';
  const flagText = getStoryLanguageFlags(rootId);
  flags.textContent = flagText;
  flags.title = flagText ? `${languageLabel('en')} / ${languageLabel('ru')}` : '';

  const meta = document.createElement('span');
  meta.className = 'share-list-row-meta';
  const coAuthorUsernames = conv.co_author_usernames ?? [];
  const coAuthorMeta = coAuthorUsernames.length > 0 ? ` · +${coAuthorUsernames.length} co-author${coAuthorUsernames.length === 1 ? '' : 's'}` : '';
  meta.textContent = `${conv.author || 'Anonymous'}${coAuthorMeta} · ${conv.branch_count} branches · ↑${conv.upvotes} · ↓${conv.downloads}`;

  row.append(dot, title, flags, meta);
  return row;
}

function buildPreviewDrawer(conv: NormalizedConversation | null): HTMLElement {
  const drawer = document.createElement('aside');
  drawer.className = 'share-preview-drawer';
  const currentLanguage = getUiLanguage();

  if (!conv) {
    const empty = document.createElement('div');
    empty.className = 'share-state-message';
    empty.textContent = getUiText()('Select a story to preview its summary before importing.', 'Выбери историю, чтобы посмотреть её краткое описание перед импортом.');
    drawer.appendChild(empty);
    return drawer;
  }

  const header = document.createElement('div');
  header.className = 'share-preview-header';

  const title = document.createElement('div');
  title.className = 'share-preview-title';
  title.textContent = conv.label;

  const subtitle = document.createElement('div');
  subtitle.className = 'share-preview-subtitle';
  const rootId = getStoryRootId(conv);
  const root = allResults.find(entry => entry.id === rootId) ?? conv;
  const sourceLanguage = getStoryRootLanguage(rootId);
  const translationTarget = otherLanguage(sourceLanguage);
  const translationExistsForUi = hasTranslationForLanguage(rootId, currentLanguage);
  const needsTranslation = !hasTranslationForLanguage(rootId, translationTarget);
  subtitle.textContent = `${FACTION_DISPLAY_NAMES[conv.faction]} · ${conv.author || getUiText()('Anonymous', 'Аноним')} · ${getUiText()('Updated', 'Обновлено')} ${formatRelativeDate(conv.updated_at)}`;

  header.append(title, subtitle);
  const coAuthorUsernames = conv.co_author_usernames ?? [];
  if (coAuthorUsernames.length > 0) {
    const coAuthors = document.createElement('div');
    coAuthors.className = 'share-preview-coauthors';
    coAuthors.textContent = `${getUiText()('Co-authors', 'Соавторы')}: ${coAuthorUsernames.join(', ')}`;
    header.appendChild(coAuthors);
  }
  drawer.appendChild(header);

  const summary = document.createElement('div');
  summary.className = 'share-preview-summary';
  summary.textContent = conv.summary;
  drawer.appendChild(summary);

  const facts = document.createElement('div');
  facts.className = 'share-preview-facts';
  facts.append(
    buildFact(getUiText()('Branches', 'Ветки'), String(conv.branch_count)),
    buildFact(getUiText()('Complexity', 'Сложность'), labelForComplexity(conv.complexity)),
    buildFact(getUiText()('Upvotes', 'Лайки'), String(conv.upvotes)),
    buildFact(getUiText()('Downloads', 'Загрузки'), String(conv.downloads)),
    buildFact(getUiText()('Published', 'Опубликовано'), formatExactDate(conv.created_at)),
    buildFact(getUiText()('Source', 'Источник'), conv.source === 'bundled' ? getUiText()('Bundled fallback', 'Встроенный запасной вариант') : getUiText()('Supabase community', 'Сообщество Supabase')),
  );
  drawer.appendChild(facts);

  if (conv.tags.length > 0) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'share-tag-list';
    conv.tags.forEach(tag => tagWrap.appendChild(buildChip(`#${tag}`)));
    drawer.appendChild(tagWrap);
  }

  if (translationExistsForUi && currentLanguage !== sourceLanguage) {
    drawer.appendChild(buildChip(`${languageFlag(currentLanguage)} ${languageLabel(currentLanguage)}`));
  } else if (needsTranslation) {
    drawer.appendChild(buildChip(`${languageFlag(sourceLanguage)} ${languageLabel(sourceLanguage)} → ${languageFlag(translationTarget)} ${languageLabel(translationTarget)}`));
  }

  if (conv.description) {
    const description = document.createElement('div');
    description.className = 'share-preview-description';
    description.textContent = conv.description;
    drawer.appendChild(description);
  }

  const actionRow = document.createElement('div');
  actionRow.className = 'share-preview-actions';
  const isOwner = userOwnsConversation(conv);

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = 'toolbar-button';
  upvoteBtn.textContent = hasUpvoted(conv.id)
    ? `${getUiText()('Upvoted', 'Уже лайкнуто')} ↑ ${conv.upvotes}`
    : `${getUiText()('Upvote', 'Лайк')} ↑ ${conv.upvotes}`;
  upvoteBtn.disabled = hasUpvoted(conv.id);
  upvoteBtn.onclick = async () => handleUpvote(conv, upvoteBtn);

  const variants = getStoryVariants(rootId);
  const importLanguages = Array.from(getStoryAvailableLanguages(rootId)).sort((a, b) => a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b));
  actionRow.append(upvoteBtn);
  if (importLanguages.length > 1) {
    for (const language of importLanguages) {
      actionRow.appendChild(createLanguageImportButton(conv, language, variants, 'preview'));
    }
  } else {
    actionRow.appendChild(createLanguageImportButton(conv, importLanguages[0] ?? getStoryLanguage(conv), variants, 'preview', getUiText()('Import', 'Импорт')));
  }

  if (needsTranslation) {
    const translateBtn = document.createElement('button');
    translateBtn.type = 'button';
    translateBtn.className = 'toolbar-button btn-primary';
    setButtonContent(translateBtn, 'download', getUiText()('Translate', 'Перевести'));
    translateBtn.title = getUiText()('Import story as a translation draft', 'Импортировать историю как черновик перевода');
    translateBtn.onclick = async () => handleTranslateImport(conv, translateBtn, translationTarget);
    actionRow.appendChild(translateBtn);
  }
  if (isOwner) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'toolbar-button btn-primary';
    setButtonContent(editBtn, 'duplicate', getUiText()('Edit', 'Редактировать'));
    editBtn.title = getUiText()('Import and edit your published conversation', 'Импортировать и редактировать опубликованную историю');
    editBtn.onclick = async () => handleEditImport(conv, editBtn);
    actionRow.appendChild(editBtn);
  }
  drawer.appendChild(actionRow);

  const outline = document.createElement('div');
  outline.className = 'share-preview-outline';
  outline.appendChild(buildOutlineHeading(getUiText()('Turn Outline', 'План ходов')));
  (conv.data?.conversations?.[0]?.turns ?? []).forEach(turn => {
    const row = document.createElement('div');
    row.className = 'share-preview-outline-row';
    row.textContent = `${getUiText()('Turn', 'Ход')} ${turn.turnNumber}: ${turn.openingMessage?.trim() || turn.customLabel || `${turn.choices.length} ${getUiText()('choices', 'вариантов')}`}`;
    outline.appendChild(row);
  });
  drawer.appendChild(outline);

  return drawer;
}

function buildFact(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'share-preview-fact';
  const heading = document.createElement('span');
  heading.textContent = label;
  const body = document.createElement('strong');
  body.textContent = value;
  item.append(heading, body);
  return item;
}

function buildOutlineHeading(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-preview-outline-heading';
  el.textContent = text;
  return el;
}

function buildChip(text: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'share-chip';
  chip.textContent = text;
  return chip;
}

function createLanguageImportButton(
  conv: CommunityConversation,
  language: UiLanguage,
  variants: NormalizedConversation[],
  mode: 'card' | 'preview',
  fallbackLabel?: string,
): HTMLButtonElement {
  const ui = getUiText();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = mode === 'card' ? 'toolbar-button btn-sm' : 'toolbar-button btn-primary';
  const variant = pickBestStoryVariant(variants, language);
  const label = fallbackLabel ?? `${ui('Import', 'Импорт')} ${languageFlag(language)}`;
  setButtonContent(button, 'download', label);
  button.title = variant
    ? ui(`Import ${languageLabel(language)} version`, `Импортировать версию: ${languageLabel(language)}`)
    : ui(`No ${languageLabel(language)} version available`, `Нет версии: ${languageLabel(language)}`);
  button.disabled = !variant;
  button.onclick = async (event) => {
    event.stopPropagation();
    await handleImportCard(conv, button, { preferredLanguage: language });
  };
  return button;
}

function labelForComplexity(value: ConversationComplexity): string {
  if (value === 'short') return 'Short';
  if (value === 'medium') return 'Medium';
  return 'Long';
}

function formatRelativeDate(value: string): string {
  const delta = Date.now() - Date.parse(value);
  const days = Math.floor(delta / 86_400_000);
  if (Number.isNaN(days)) return 'Unknown date';
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatExactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function handleImportCard(
  conv: CommunityConversation,
  btn: HTMLButtonElement,
  options: { translationDraft?: boolean; targetLanguage?: UiLanguage; preferredLanguage?: UiLanguage } = {},
): Promise<void> {
  const conversations = conv.data?.conversations;
  if (!conversations || conversations.length === 0) {
    alert('This entry has no story data.');
    return;
  }

  const uiLanguage = getUiLanguage();
  const rootId = getStoryRootId(conv);
  const variants = allResults.filter((entry) => getStoryRootId(entry) === rootId);
  const rootLanguage = getStoryRootLanguage(rootId);

  const explicitTarget = options.targetLanguage;
  const translationDraft = options.translationDraft === true || explicitTarget != null;
  const preferredLanguage = options.preferredLanguage ?? uiLanguage;

  const importEntry = translationDraft
    ? (pickBestStoryVariant(variants, rootLanguage) ?? (variants.find(entry => entry.id === rootId) ?? conv as NormalizedConversation))
    : (pickBestStoryVariant(variants, preferredLanguage) ?? (variants.find(entry => entry.id === rootId) ?? conv as NormalizedConversation));

  const importConversationsPayload = importEntry.data?.conversations;
  if (!importConversationsPayload || importConversationsPayload.length === 0) {
    alert('This entry has no story data.');
    return;
  }

  const targetLanguage: UiLanguage = explicitTarget ?? getStoryLanguage(importEntry);
  const isTranslationImport = translationDraft;
  const sourceCommunityId = isTranslationImport ? rootId : importEntry.id;

  const imported = importConversationsPayload.map((entry) => {
    const cloned: Conversation = structuredClone(entry);
    cloned.language = cloned.language ?? getStoryLanguage(importEntry);
    if (isTranslationImport) {
      cloned.language = targetLanguage;
    }
    return attachCommunitySourceMetadata(cloned, {
      id: sourceCommunityId,
      publisher_id: conv.publisher_id,
      co_authors: conv.co_authors ?? [],
      sourceLanguage: rootLanguage,
      targetLanguage,
      isTranslationDraft: isTranslationImport,
    });
  });

  importConversations(imported, conv.faction, {
    sourceCommunityId,
    sourcePublisherId: conv.publisher_id?.trim() || 'anonymous',
    sourceCoAuthors: conv.co_authors ?? [],
    sourceUpdatedAt: conv.updated_at || undefined,
    sourceLanguage: rootLanguage,
    targetLanguage,
    isTranslationDraft: isTranslationImport,
  });
  incrementDownload(conv.id);

  const match = allResults.find(entry => entry.id === conv.id);
  if (match) match.downloads += 1;

  const original = btn.innerHTML;
  btn.disabled = true;
  setButtonContent(btn, 'success', t('share.status.imported'));
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
    renderContent();
  }, 1500);
}

async function handleTranslateImport(conv: CommunityConversation, btn: HTMLButtonElement, targetLanguage: UiLanguage): Promise<void> {
  await handleImportCard(conv, btn, { translationDraft: true, targetLanguage });
}

async function handleEditImport(conv: CommunityConversation, btn: HTMLButtonElement): Promise<void> {
  const conversations = conv.data?.conversations;
  if (!conversations || conversations.length === 0) {
    alert('This entry has no story data.');
    return;
  }

  const imported = conversations.map(entry => attachCommunitySourceMetadata(entry, {
    id: conv.id,
    publisher_id: conv.publisher_id,
    co_authors: conv.co_authors ?? [],
  }));
  const importedConversationId = importConversations(imported, conv.faction, {
    sourceCommunityId: conv.id,
    sourcePublisherId: conv.publisher_id?.trim() || 'anonymous',
    sourceCoAuthors: conv.co_authors ?? [],
    sourceUpdatedAt: conv.updated_at || undefined,
  });
  if (importedConversationId != null) {
    updateReplacementIntentState();
  }
  incrementDownload(conv.id);

  const match = allResults.find(entry => entry.id === conv.id);
  if (match) match.downloads += 1;

  const original = btn.innerHTML;
  btn.disabled = true;
  setButtonContent(btn, 'success', t('share.status.readyToEdit'));
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
    refreshPrimaryPublishCta();
    renderContent();
  }, 1500);
}

async function handleUpvote(conv: NormalizedConversation, btn: HTMLButtonElement): Promise<void> {
  if (hasUpvoted(conv.id)) return;
  const ui = getUiText();
  btn.disabled = true;
  btn.textContent = ui('Voting…', 'Голосуем…');
  try {
    await incrementUpvote(conv.id);
    rememberUpvote(conv.id);
    const match = allResults.find(entry => entry.id === conv.id);
    if (match) match.upvotes += 1;
    renderContent();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `${ui('Upvote', 'Лайк')} ↑ ${conv.upvotes}`;
    alert(`Upvote failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleLibrarySectionChange(
  conv: NormalizedConversation,
  section: CommunityLibrarySection,
  btn: HTMLButtonElement,
): Promise<void> {
  const publisherId = getAdminPublisherId();
  if (!publisherId) {
    alert('Log in as admin before changing story section.');
    return;
  }
  const oldLabel = btn.textContent ?? '';
  btn.disabled = true;
  btn.textContent = getUiText()('Saving...', 'Сохранение...');
  try {
    const updated = await updateConversationLibrarySection(conv.id, publisherId, section);
    const match = allResults.find(entry => entry.id === conv.id);
    if (match) {
      match.library_section = updated?.library_section ?? section;
    }
    ensurePreviewSelection();
    renderContent();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = oldLabel;
    alert(`Section update failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function getUpvoteSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(LOCAL_UPVOTE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function hasUpvoted(id: string): boolean {
  return getUpvoteSet().has(id);
}

function rememberUpvote(id: string): void {
  if (typeof window === 'undefined') return;
  const votes = getUpvoteSet();
  votes.add(id);
  window.localStorage.setItem(LOCAL_UPVOTE_KEY, JSON.stringify(Array.from(votes)));
}

async function handleDownloadAll(): Promise<void> {
  if (activeFaction === 'all') return;
  const btn = getDownloadAllBtn();
  if (btn) { btn.disabled = true; btn.textContent = getUiText()('Loading…', 'Загрузка…'); }

  try {
    // Final export uses curated stories only, independent of temporary UI
    // filters like search/length/sort.
    const results = allResults.filter(entry => entry.faction === activeFaction && (entry.library_section ?? 'community') === 'curated');
    if (results.length === 0) {
      alert(`No curated ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} conversations to download.`);
      return;
    }

    const factionKey = FACTION_XML_KEYS[activeFaction];

    // Build stable story groups by root id (source story id). Each pack (eng/rus)
    // exports same story list + same sequential ids so string keys align.
    const grouped = new Map<string, NormalizedConversation[]>();
    for (const entry of results) {
      const rootId = getStoryRootId(entry);
      const list = grouped.get(rootId) ?? [];
      list.push(entry);
      grouped.set(rootId, list);
    }

    const groups = Array.from(grouped.entries()).map(([rootId, variants]) => {
      const root = variants.find((entry) => entry.id === rootId) ?? variants[0]!;
      return { rootId, root, variants };
    });
    groups.sort((a, b) =>
      Date.parse(a.root.created_at) - Date.parse(b.root.created_at)
      || a.rootId.localeCompare(b.rootId),
    );

    const languages: UiLanguage[] = ['en', 'ru'];
    for (const language of languages) {
      const mergedProject = createEmptyProject(activeFaction);
      let nextId = 1;
      for (const group of groups) {
        const best = pickBestStoryVariant(group.variants, language) ?? group.root;
        const storyConv = best.data?.conversations?.[0];
        if (!storyConv) continue;
        const c = structuredClone(storyConv);
        c.id = nextId++;
        c.language = language;
        mergedProject.conversations.push(c);
      }

      const xml = generateXml(mergedProject, undefined, undefined, undefined, language);
      const suffix = language === 'ru' ? 'rus' : 'eng';
      downloadFile(xml, `st_PANDA_${factionKey}_interactive_conversations_${suffix}.xml`, 'application/xml');
    }

    for (const id of new Set(results.map((entry) => entry.id))) {
      incrementDownload(id);
      const match = allResults.find(entry => entry.id === id);
      if (match) match.downloads += 1;
    }
  } catch (err) {
    alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      setButtonContent(btn, 'download', getUiText()('Download All XML', 'Скачать все XML'));
    }
    renderContent();
  }
}

function buildPublishFormLegacy(): HTMLElement {
  const ui = getUiText();

  const form = document.createElement('div');
  form.className = 'share-publish-form';
  form.hidden = true;

  const formHeader = document.createElement('div');
  formHeader.className = 'share-publish-form-header';
  formHeader.textContent = ui('Publish to Community Library', 'Опубликовать в Библиотеке сообщества');
  form.appendChild(formHeader);

  const subtitle = document.createElement('div');
  subtitle.className = 'share-publish-form-subtitle';
  subtitle.textContent = ui('Anonymous publishing is public, moderated after the fact, and limited to one publish per minute from this browser.', 'Анонимные публикации общедоступны, модерируются постфактум и ограничены одной публикацией в минуту с этого браузера.');
  form.appendChild(subtitle);

  const replacementContext = document.createElement('div');
  replacementContext.className = 'share-publish-form-subtitle';
  replacementContext.hidden = true;
  form.appendChild(replacementContext);

  const titleInput = makeFormField(form, ui('Title', 'Название'), 'text', ui('Story title (unique community title required)', 'Название истории (уникальное в сообществе)')) as HTMLInputElement;
  titleInput.maxLength = 70;

  const storedName = getStoredUsername();
  const authorInput = makeFormField(form, ui('Author', 'Автор'), 'text',
    storedName ? storedName : ui('Anonymous (set a username via your profile)', 'Аноним (укажите имя в профиле)')) as HTMLInputElement;
  authorInput.maxLength = 32;
  if (storedName) {
    authorInput.value = storedName;
    authorInput.readOnly = true;
    authorInput.style.opacity = '0.7';
    authorInput.title = t('share.authorName.tooltip');
  }

  const descInput = makeFormField(form, ui('Description', 'Описание'), 'textarea', ui('Brief description of what this story does…', 'Краткое описание истории…')) as HTMLTextAreaElement;
  descInput.maxLength = 280;

  const summaryInput = makeFormField(form, ui('Summary', 'Краткое описание'), 'textarea', ui('Short preview text shown in the drawer before import.', 'Короткий текст превью перед импортом.')) as HTMLTextAreaElement;
  summaryInput.maxLength = 180;

  const tagsInput = makeFormField(form, ui('Tags', 'Теги'), 'text', ui('Comma-separated tags (e.g. jobs, tutorial, campfire)', 'Теги через запятую (напр. работа, урок, костёр)')) as HTMLInputElement;

  const factionRow = document.createElement('div');
  factionRow.className = 'share-form-field';
  const factionLabel = document.createElement('label');
  factionLabel.className = 'share-form-label';
  factionLabel.textContent = ui('Faction', 'Группировка');
  const factionValue = document.createElement('div');
  factionValue.className = 'share-form-faction-display';
  factionRow.append(factionLabel, factionValue);
  form.appendChild(factionRow);

  const moderationBox = document.createElement('div');
  moderationBox.className = 'share-moderation-box';
  moderationBox.innerHTML = ui('<strong>Before you publish:</strong> keep titles unique, avoid links or invites, and expect public visibility for anonymous uploads.', '<strong>Перед публикацией:</strong> используйте уникальные названия, не добавляйте ссылки или приглашения, учтите, что анонимные загрузки публично видимы.');
  form.appendChild(moderationBox);

  const consentRow = document.createElement('label');
  consentRow.className = 'share-consent-row';
  const consentInput = document.createElement('input');
  consentInput.type = 'checkbox';
  const consentText = document.createElement('span');
  consentText.textContent = ui('I confirm this story is my own work, safe for public browsing, and not a duplicate community title.', 'Подтверждаю, что история — моя работа, безопасна для просмотра и не дублирует уже опубликованную.');
  consentRow.append(consentInput, consentText);
  form.appendChild(consentRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'share-publish-btn-row';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'toolbar-button';
  cancelBtn.textContent = ui('Cancel', 'Отмена');
  cancelBtn.onclick = () => { form.hidden = true; showPublishTrigger(); };

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'toolbar-button btn-primary';
  setButtonContent(submitBtn, 'export', ui('Publish →', 'Опубликовать →'));

  const applySubmitMode = (isReplacementCandidate: boolean) => {
    setButtonContent(submitBtn, 'export', isReplacementCandidate ? ui('Update →', 'Обновить →') : ui('Publish →', 'Опубликовать →'));
    formHeader.textContent = isReplacementCandidate ? ui('Update existing Community Library entry', 'Обновить запись в Библиотеке сообщества') : ui('Publish to Community Library', 'Опубликовать в Библиотеке сообщества');
    subtitle.textContent = isReplacementCandidate
      ? ui('Update existing community entry metadata/content. Ownership is validated before replace payload is sent.', 'Обновить метаданные/содержимое записи. Право собственности проверяется перед заменой.')
      : ui('Anonymous publishing is public, moderated after the fact, and limited to one publish per minute from this browser.', 'Анонимные публикации общедоступны, модерируются постфактум и ограничены одной публикацией в минуту с этого браузера.');
    replacementContext.hidden = !isReplacementCandidate;
    replacementContext.textContent = isReplacementCandidate && replacementCommunityId
      ? ui(`Update existing community post: ${replacementCommunityId}`, `Обновить запись в сообществе: ${replacementCommunityId}`)
      : '';
  };

  btnRow.append(cancelBtn, submitBtn);
  form.appendChild(btnRow);

  const statusMsg = document.createElement('div');
  statusMsg.className = 'share-publish-status';
  form.appendChild(statusMsg);

  const setStatus = (message: string, tone: 'neutral' | 'danger' | 'success' = 'neutral') => {
    statusMsg.textContent = message;
    statusMsg.dataset.tone = tone;
  };

  submitBtn.onclick = async () => {
    updateReplacementIntentState();
    const validationGate = splitValidationMessages(store.get().validationMessages);
    if (validationGate.errors.length > 0) {
      setStatus(buildValidationSummary('Publish blocked: resolve validation errors first.', validationGate.errors, 3), 'danger');
      return;
    }
    if (validationGate.warnings.length > 0) {
      const proceed = window.confirm(buildValidationSummary('Validation warnings detected. Publish anyway?', validationGate.warnings));
      if (!proceed) {
        setStatus('Publish cancelled. Resolve warnings or confirm override to continue.', 'neutral');
        return;
      }
    }

    const conv = store.getSelectedConversation();
    if (!conv) {
      setStatus('No story selected. Select a story in the left panel first.', 'danger');
      return;
    }
    if (!consentInput.checked) {
      setStatus('Confirm the moderation checkbox before publishing.', 'danger');
      return;
    }
    if (isInCollabSession() && !isCollabHost()) {
      setStatus('Only the host can publish.', 'danger');
      return;
    }

    const label = titleInput.value.trim() || conv.label || 'Untitled';
    const author = authorInput.value.trim() || 'Anonymous';
    const description = descInput.value.trim();
    const summary = summaryInput.value.trim() || createSummaryFromConversation(conv);
    const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
    const faction = getConversationFaction(conv, store.get().project.faction);
    const branchCount = getBranchCount(conv);
    const uiLanguage = getUiLanguage();
    const selectedSourceMetadata = store.getSelectedConversationSourceMetadata();
    const selectedSourcePublisherId = selectedSourceMetadata?.sourcePublisherId?.trim();
    const selectedReplacementPublisherId = getReplacementPublisherId(selectedSourcePublisherId, selectedSourceMetadata?.sourceCoAuthors ?? []);
    const selectedOwnershipValid = Boolean(selectedReplacementPublisherId);
    const isTranslationDraft = isTranslationDraftMetadata(selectedSourceMetadata);
    const translationSourceLanguage = selectedSourceMetadata?.sourceLanguage ?? uiLanguage;
    const shouldUseReplacePayload = isReplacementCandidate && selectedOwnershipValid;
    const selectedReplaceId = shouldUseReplacePayload && replacementCommunityId
      ? replacementCommunityId
      : null;

    const conversationSourceMetadata = getCommunitySourceMetadata(conv);
    const conversationSourcePublisherId = conversationSourceMetadata?.publisher_id?.trim();
    const conversationReplacementPublisherId = getReplacementPublisherId(conversationSourcePublisherId, conversationSourceMetadata?.co_authors ?? []);
    const conversationOwnershipValid = Boolean(conversationReplacementPublisherId);
    const replaceId = selectedReplaceId;
    const publisherId = selectedOwnershipValid
      ? selectedReplacementPublisherId
      : (conversationOwnershipValid ? conversationReplacementPublisherId : undefined);
    const duplicateLocal = !isTranslationDraft && allResults.some(entry =>
      normalizeKey(entry.label) === normalizeKey(label)
      && (!replaceId || entry.id !== replaceId),
    );
    if (duplicateLocal) {
      setStatus('That title already exists in the current library view. Choose a more specific title before publishing.', 'danger');
      return;
    }

    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    setStatus('Validating title, abuse checks, and publish payload…', 'neutral');

    try {
      const coAuthorFields = getCollabCoAuthorPublishFields(publisherId);
      const collabSessionId = isInCollabSession() ? await flushCollabSessionForPublish() : null;
      await publishConversation({
        faction,
        label,
        description,
        summary,
        author,
        tags,
        branch_count: branchCount,
        complexity: deriveConversationComplexity(branchCount),
        data: {
          version: store.get().project.version,
          faction,
          conversations: [conv],
        },
        replace_id: replaceId ?? undefined,
        publisher_id: publisherId,
        ...coAuthorFields,
        collab_session_id: collabSessionId ?? undefined,
      });
      setStatus(replaceId
        ? 'Updated existing community story. Refreshing library…'
        : 'Published successfully. Refreshing the library with your new community entry…', 'success');

      // Award XP for publishing + sync achievements/streaks server-side
      const complexity = deriveConversationComplexity(branchCount);
      const basePublishXp = getPublishXp(complexity);
      const currentProfile = (globalThis as any).__pandaUserProfile as UserProfile | null;
      if (currentProfile) {
        const publishCount = await fetchUserPublishCount(currentProfile.publisher_id).catch(() => 1);
        const publishedFactions = [faction];
        try {
          const allConvs = await fetchConversations();
          const userConvs = allConvs.filter(c => c.author === currentProfile.username);
          for (const c of userConvs) {
            if (!publishedFactions.includes(c.faction as FactionId)) publishedFactions.push(c.faction as FactionId);
          }
        } catch { /* best-effort */ }

        const totalDownloads = 0;
        const totalUpvotes = 0;
        const gamResult = evaluatePublishGamification(conv, publishCount, totalDownloads, totalUpvotes, publishedFactions);

        const persistedAchievements: Array<(typeof gamResult.achievementsUnlocked)[number]> = [];
        for (const achievement of gamResult.achievementsUnlocked) {
          const unlocked = await unlockAchievement(currentProfile.publisher_id, achievement.id);
          if (unlocked) {
            unlockAchievementLocally(achievement.id);
            setCooldown(`ach-${achievement.id}`);
            persistedAchievements.push(achievement);
          }
        }

        if (gamResult.changedMissionRecords.length > 0) {
          await syncUserMissionProgress(currentProfile.publisher_id, gamResult.changedMissionRecords);
        }

        const currentStreakState = currentProfile.streaks ?? {
          publish_streak: 0,
          longest_streak: 0,
          last_publish_week: '',
          login_streak: 0,
          last_login_date: '',
        };
        await updateUserStreak(currentProfile.publisher_id, {
          publish_streak: gamResult.streakData.currentStreak,
          longest_streak: gamResult.streakData.longestStreak,
          last_publish_week: gamResult.streakData.lastPublishWeek,
          login_streak: currentStreakState.login_streak,
          last_login_date: currentStreakState.last_login_date,
        });

        const qualityScore = calculateQualityScore(conv);
        const qualityMult = getQualityMultiplier(qualityScore.totalStars);
        const adjustedPublishXp = Math.round(basePublishXp * qualityMult);
        const persistedBonusXp = persistedAchievements.reduce((total, achievement) => total + achievement.xp, 0) + gamResult.missionXp;
        const oldLevel = currentProfile.level;

        if (adjustedPublishXp > 0) {
          await awardXp(currentProfile.publisher_id, adjustedPublishXp);
        }
        if (persistedBonusXp > 0) {
          await awardXpCapped(currentProfile.publisher_id, persistedBonusXp);
        }

        const refreshed = await fetchUserProfile(currentProfile.publisher_id);
        const updated = refreshed ?? currentProfile;
        (globalThis as any).__pandaUserProfile = updated;
        setProfileForBadge(updated);
        invalidateLeaderboardCache();

        if (adjustedPublishXp > 0) {
          if (qualityMult > 1) {
            showXpToast(adjustedPublishXp, `Published! (${qualityScore.totalStars}\u2605 quality \u00D7${qualityMult})`);
          } else {
            showXpToast(adjustedPublishXp, 'Story published!');
          }
        }

        if (updated.level > oldLevel) {
          setTimeout(() => showLevelUpToast(updated.level, updated.title), 600);
        }

        if (persistedAchievements.length > 0) {
          setTimeout(() => showAchievementToasts(persistedAchievements), 1200);
        }

        if (gamResult.streakInfo.streakChanged && gamResult.streakInfo.newStreak > 1) {
          const delay = 1200 + persistedAchievements.length * 800;
          setTimeout(() => {
            const shieldNote = gamResult.streakInfo.shieldUsed ? ' (Shield used!)' : '';
            showGamificationToast('\u{1F525}', `${gamResult.streakInfo.newStreak}-Week Streak!`, `Keep publishing weekly to grow your streak${shieldNote}`);
          }, delay);
        }

        if (gamResult.missionXp > 0 && gamResult.completedMissions.length > 0) {
          const delay = 1200 + persistedAchievements.length * 800 + (gamResult.streakInfo.streakChanged ? 800 : 0);
          setTimeout(() => {
            const missionSummary = gamResult.completedMissions.length === 1
              ? gamResult.completedMissions[0].description
              : gamResult.completedMissions.map(mission => mission.name).join(' · ');
            showGamificationToast('\u{1F3AF}', getMissionCompletionHeadline(gamResult.completedMissions), missionSummary, gamResult.missionXp);
          }, delay);
        }
      }

      setTimeout(() => {
        form.hidden = true;
        setStatus('');
        if (activeFaction !== 'all' && activeFaction !== faction) {
          activeFaction = faction;
          rebuildSidebar();
          updateDownloadAllBtn();
        }
        allResults = [];
        selectedPreviewId = null;
        loadConversations();
      }, 1200);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Publish failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  };

  (form as HTMLElement & { prefill?: (isReplacementCandidate?: boolean) => void }).prefill = (replacementMode = false) => {
    const conv = store.getSelectedConversation();
    const faction = getConversationFaction(conv, store.get().project.faction);
    const branchCount = getBranchCount(conv ?? undefined);
    titleInput.value = conv?.label || '';
    const currentUsername = getStoredUsername();
    authorInput.value = currentUsername || '';
    authorInput.readOnly = !!currentUsername;
    authorInput.style.opacity = currentUsername ? '0.7' : '1';
    authorInput.placeholder = currentUsername ? currentUsername : 'Anonymous (set a username via your profile)';
    descInput.value = '';
    summaryInput.value = conv ? createSummaryFromConversation(conv) : '';
    tagsInput.value = branchCount <= 3 ? 'short, starter' : 'branching, story';
    factionValue.textContent = `${FACTION_DISPLAY_NAMES[faction]} · ${branchCount} branches · ${labelForComplexity(deriveConversationComplexity(branchCount))}`;
    factionValue.style.color = FACTION_COLORS[faction];
    applySubmitMode(replacementMode);
    consentInput.checked = false;
    setStatus(currentUsername
      ? `Publishing as ${currentUsername}. Duplicate titles are rejected. Story ownership is soft unless identity is backed by authenticated Supabase user auth + RLS.`
      : 'Anonymous publishes are browser-bound and ownership is soft. Duplicate titles are rejected.');
  };

  return form;
}

function buildPublishForm(): HTMLElement {
  const ui = getUiText();
  const form = document.createElement('div');
  form.className = 'share-publish-form';
  form.hidden = true;

  const markPublishField = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(input: T, ...classNames: string[]): T => {
    input.closest('.share-form-field')?.classList.add('share-publish-field', ...classNames);
    return input;
  };

  const createMetric = (labelText: string): { root: HTMLElement; value: HTMLElement } => {
    const root = document.createElement('div');
    root.className = 'share-publish-metric';

    const label = document.createElement('span');
    label.className = 'share-publish-metric-label';
    label.textContent = labelText;

    const value = document.createElement('strong');
    value.className = 'share-publish-metric-value';

    root.append(label, value);
    return { root, value };
  };

  const hidePublishForm = (): void => {
    form.hidden = true;
    showPublishTrigger();
  };

  const topbar = document.createElement('div');
  topbar.className = 'share-publish-form-topbar';

  const topbarCopy = document.createElement('div');
  topbarCopy.className = 'share-publish-form-topbar-copy';

  const kicker = document.createElement('div');
  kicker.className = 'share-publish-form-kicker';
  kicker.textContent = ui('Rewarded community publish', 'Публикация с наградой');

  const formHeader = document.createElement('div');
  formHeader.className = 'share-publish-form-header';
  formHeader.textContent = ui('Publish to Community Library', 'Опубликовать в библиотеке сообщества');

  const subtitle = document.createElement('div');
  subtitle.className = 'share-publish-form-subtitle';
  subtitle.textContent = ui(
    'Public publishing is moderated after the fact and limited to one publish per minute from this browser.',
    'Публичные публикации модерируются после отправки и ограничены одной публикацией в минуту с этого браузера.',
  );

  topbarCopy.append(kicker, formHeader, subtitle);

  const topbarActions = document.createElement('div');
  topbarActions.className = 'share-publish-form-topbar-actions';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'toolbar-button share-publish-header-back';
  setButtonContent(backBtn, 'undo', ui('Back to Library', 'Назад в библиотеку'));
  backBtn.onclick = hidePublishForm;

  const panelCloseBtn = document.createElement('button');
  panelCloseBtn.type = 'button';
  panelCloseBtn.className = 'toolbar-button toolbar-icon-button btn-icon share-publish-form-close';
  panelCloseBtn.appendChild(createIcon('close'));
  panelCloseBtn.title = ui('Close Community Library', 'Закрыть библиотеку сообщества');
  panelCloseBtn.onclick = closeSharePanel;

  topbarActions.append(backBtn, panelCloseBtn);
  topbar.append(topbarCopy, topbarActions);
  form.appendChild(topbar);

  const formScroll = document.createElement('div');
  formScroll.className = 'share-publish-scroll';
  form.appendChild(formScroll);

  const hero = document.createElement('section');
  hero.className = 'share-publish-hero';

  const heroCopy = document.createElement('div');
  heroCopy.className = 'share-publish-hero-copy';

  const heroEyebrow = document.createElement('div');
  heroEyebrow.className = 'share-publish-hero-kicker';
  heroEyebrow.textContent = ui('Ready to go live', 'Готово к публикации');

  const heroTitle = document.createElement('div');
  heroTitle.className = 'share-publish-hero-title';
  heroTitle.textContent = ui('Publish your selected story', 'Опубликовать выбранную историю');

  const heroBlurb = document.createElement('div');
  heroBlurb.className = 'share-publish-hero-blurb';
  heroBlurb.textContent = ui(
    'Stronger branching and better quality scores boost publish XP, so a more ambitious story gets a bigger send-off.',
    'Сильные ветки и высокий рейтинг качества повышают XP за публикацию.',
  );

  const replacementContext = document.createElement('div');
  replacementContext.className = 'share-publish-context-badge';
  replacementContext.hidden = true;

  heroCopy.append(heroEyebrow, heroTitle, heroBlurb, replacementContext);

  const metrics = document.createElement('div');
  metrics.className = 'share-publish-metrics';
  const factionMetric = createMetric(ui('Faction', 'Фракция'));
  const sizeMetric = createMetric(ui('Flow Size', 'Размер ветки'));
  const qualityMetric = createMetric(ui('Quality', 'Качество'));
  const rewardMetric = createMetric(ui('Reward', 'Награда'));
  metrics.append(factionMetric.root, sizeMetric.root, qualityMetric.root, rewardMetric.root);

  hero.append(heroCopy, metrics);
  formScroll.appendChild(hero);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'share-publish-grid';
  formScroll.appendChild(contentGrid);

  const mainColumn = document.createElement('div');
  mainColumn.className = 'share-publish-main';
  const sideColumn = document.createElement('aside');
  sideColumn.className = 'share-publish-side';
  contentGrid.append(mainColumn, sideColumn);

  const identityGrid = document.createElement('div');
  identityGrid.className = 'share-publish-main-grid share-publish-main-grid-identity';
  mainColumn.appendChild(identityGrid);

  const titleInput = markPublishField(
    makeFormField(identityGrid, ui('Title', 'Название'), 'text', ui('Story title (unique community title required)', 'Название истории (должно быть уникальным)')) as HTMLInputElement,
    'share-publish-field-title',
  );
  titleInput.maxLength = 70;

  const storedName = getStoredUsername();
  const authorInput = markPublishField(
    makeFormField(
      identityGrid,
      ui('Author', 'Автор'),
      'text',
      storedName ? storedName : 'Anonymous (set a username via your profile)',
    ) as HTMLInputElement,
    'share-publish-field-author',
  );
  authorInput.maxLength = 32;
  if (storedName) {
    authorInput.value = storedName;
    authorInput.readOnly = true;
    authorInput.style.opacity = '0.7';
    authorInput.title = t('share.authorName.tooltip');
  }

  const descInput = markPublishField(
    makeFormField(mainColumn, ui('Description', 'Описание'), 'textarea', ui('Brief description of what this story does...', 'Кратко опиши, что делает история...')) as HTMLTextAreaElement,
    'share-publish-field-description',
  );
  descInput.maxLength = 280;

  const supportGrid = document.createElement('div');
  supportGrid.className = 'share-publish-main-grid share-publish-main-grid-support';
  mainColumn.appendChild(supportGrid);

  const summaryInput = markPublishField(
    makeFormField(supportGrid, ui('Summary', 'Краткое описание'), 'textarea', ui('Short preview text shown in the drawer before import.', 'Короткий текст предпросмотра перед импортом.')) as HTMLTextAreaElement,
    'share-publish-field-summary',
  );
  summaryInput.maxLength = 180;

  const metaStack = document.createElement('div');
  metaStack.className = 'share-publish-meta-stack';
  supportGrid.appendChild(metaStack);

  const tagsInput = markPublishField(
    makeFormField(metaStack, ui('Tags', 'Теги'), 'text', ui('Comma-separated tags (e.g. jobs, tutorial, campfire)', 'Теги через запятую (например: jobs, tutorial, campfire)')) as HTMLInputElement,
    'share-publish-field-tags',
  );

  const taggedUsersInput = markPublishField(
    makeFormField(metaStack, ui('Tag Users', 'Отметить пользователей'), 'text', ui('Co-credit usernames (comma-separated)', 'Соавторы через запятую')) as HTMLInputElement,
    'share-publish-field-tags',
  );

  const languageInput = markPublishField(
    makeSelectFormField(metaStack, ui('Story Language', 'Story Language'), [
      { value: 'en', label: `${languageFlag('en')} ${languageLabel('en')}` },
      { value: 'ru', label: `${languageFlag('ru')} ${languageLabel('ru')}` },
    ]),
    'share-publish-field-language',
  );
  languageInput.onchange = () => updatePreview(store.getSelectedConversation(), getPrimaryPublishReplacementMode());

  const demoRow = document.createElement('label');
  demoRow.className = 'share-consent-row share-publish-demo-toggle';
  const demoInput = document.createElement('input');
  demoInput.type = 'checkbox';
  const demoText = document.createElement('span');
  demoText.textContent = ui('Publish as Demo storyline', 'Опубликовать как демо-историю');
  demoRow.append(demoInput, demoText);
  metaStack.appendChild(demoRow);

  const factionRow = document.createElement('div');
  factionRow.className = 'share-form-field share-publish-field share-publish-field-faction';
  const factionLabel = document.createElement('label');
  factionLabel.className = 'share-form-label';
  factionLabel.textContent = ui('Broadcast Lane', 'Канал публикации');
  const factionValue = document.createElement('div');
  factionValue.className = 'share-form-faction-display';
  factionRow.append(factionLabel, factionValue);
  metaStack.appendChild(factionRow);

  const consentRow = document.createElement('label');
  consentRow.className = 'share-consent-row share-publish-consent';
  const consentInput = document.createElement('input');
  consentInput.type = 'checkbox';
  const consentText = document.createElement('span');
  consentText.textContent = ui(
    'I confirm this story is my own work, safe for public browsing, and not a duplicate community title.',
    'Подтверждаю: история моя, безопасна для публичного просмотра и не дублирует название в сообществе.',
  );
  consentRow.append(consentInput, consentText);
  mainColumn.appendChild(consentRow);

  const rewardCard = document.createElement('section');
  rewardCard.className = 'share-publish-side-card share-publish-reward-card';

  const rewardKicker = document.createElement('span');
  rewardKicker.className = 'share-publish-side-kicker';
  rewardKicker.textContent = ui('Reward Preview', 'Предпросмотр награды');

  const rewardValue = document.createElement('strong');
  rewardValue.className = 'share-publish-reward-value';

  const rewardSummary = document.createElement('p');
  rewardSummary.className = 'share-publish-reward-summary';

  const rewardFormula = document.createElement('p');
  rewardFormula.className = 'share-publish-reward-formula';

  rewardCard.append(rewardKicker, rewardValue, rewardSummary, rewardFormula);
  sideColumn.appendChild(rewardCard);

  const moderationBox = document.createElement('div');
  moderationBox.className = 'share-moderation-box share-publish-moderation';
  moderationBox.textContent = ui(
    'Before you publish: keep titles unique, avoid links or invites, and expect public visibility for anonymous uploads.',
    'Перед публикацией: названия должны быть уникальными, без ссылок и инвайтов; анонимные загрузки публичны.',
  );
  sideColumn.appendChild(moderationBox);

  const checklistCard = document.createElement('section');
  checklistCard.className = 'share-publish-side-card share-publish-checklist-card';

  const checklistTitle = document.createElement('div');
  checklistTitle.className = 'share-publish-side-title';
  checklistTitle.textContent = ui('Make it land well', 'Сделай публикацию сильнее');

  const checklist = document.createElement('ul');
  checklist.className = 'share-publish-checklist';
  [
    ui('Use a specific title so your story is easy to find later.', 'Используй точное название, чтобы историю было легко найти.'),
    ui('A strong summary improves previews before import.', 'Хорошее краткое описание улучшает предпросмотр перед импортом.'),
    ui('More branching, outcomes, and conditions push quality and XP higher.', 'Больше веток, результатов и условий повышают качество и XP.'),
  ].forEach((itemText) => {
    const item = document.createElement('li');
    item.textContent = itemText;
    checklist.appendChild(item);
  });

  checklistCard.append(checklistTitle, checklist);
  sideColumn.appendChild(checklistCard);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'toolbar-button btn-primary share-publish-primary';
  setButtonContent(submitBtn, 'export', ui('Publish Story', 'Опубликовать историю'));

  const footer = document.createElement('div');
  footer.className = 'share-publish-footer';

  const footerMeta = document.createElement('div');
  footerMeta.className = 'share-publish-footer-meta';

  const footerLabel = document.createElement('div');
  footerLabel.className = 'share-publish-footer-label';
  footerLabel.textContent = ui('Community publish checks', 'Проверки публикации');

  const statusMsg = document.createElement('div');
  statusMsg.className = 'share-publish-status';
  footerMeta.append(footerLabel, statusMsg);

  const footerActions = document.createElement('div');
  footerActions.className = 'share-publish-footer-actions';
  footerActions.appendChild(submitBtn);

  footer.append(footerMeta, footerActions);
  form.appendChild(footer);

  const setStatus = (message: string, tone: 'neutral' | 'danger' | 'success' = 'neutral') => {
    statusMsg.textContent = message;
    statusMsg.dataset.tone = tone;
  };

  const updatePreview = (conversation: Conversation | null | undefined, replacementMode = false): void => {
    if (!conversation) return;

    const preview = getPublishPreviewStats(conversation);
    const faction = getConversationFaction(conversation, store.get().project.faction);
    const translationDraft = isTranslationDraftMetadata(store.getSelectedConversationSourceMetadata() ?? getCommunitySourceMetadata(conversation));

    factionMetric.value.textContent = FACTION_DISPLAY_NAMES[faction];
    sizeMetric.value.textContent = `${preview.branchCount} ${preview.branchCount === 1 ? 'branch' : 'branches'}`;
    qualityMetric.value.textContent = `${preview.qualityScore.totalStars}-star x${formatMultiplier(preview.qualityMultiplier)}`;
    rewardMetric.value.textContent = `+${preview.publishXp} XP`;

    const selectedLanguage = languageInput.value === 'ru' ? 'ru' : 'en';
    factionValue.textContent = `${FACTION_DISPLAY_NAMES[faction]} | ${languageFlag(selectedLanguage)} ${languageLabel(selectedLanguage)} | ${preview.branchCount} branches | ${labelForComplexity(preview.complexity)} signal`;
    factionValue.style.color = FACTION_COLORS[faction];

    rewardValue.textContent = `+${preview.publishXp} XP`;
    rewardSummary.textContent = replacementMode
      ? `This update keeps the same community slot, with reward intensity driven by ${preview.qualityScore.totalStars}-star quality.`
      : translationDraft
        ? `This is a translation publish, so reward drops to 50% of scratch XP before quality math.`
        : `This story is lined up as a ${labelForComplexity(preview.complexity).toLowerCase()} publish with a ${preview.qualityScore.totalStars}-star quality rating.`;
    rewardFormula.textContent = translationDraft
      ? `Base ${preview.basePublishXp} XP x quality ${formatMultiplier(preview.qualityMultiplier)} + ${preview.dialogueChoiceCount} choices x 25 XP, then x ${formatMultiplier(preview.translationMultiplier)} translation multiplier = ${preview.publishXp} publish XP`
      : `Base ${preview.basePublishXp} XP x quality ${formatMultiplier(preview.qualityMultiplier)} + ${preview.dialogueChoiceCount} choices x 25 XP = ${preview.publishXp} publish XP`;
  };

  const applySubmitMode = (isReplacementMode: boolean) => {
    setButtonContent(submitBtn, 'export', isReplacementMode ? ui('Update Story', 'Обновить историю') : ui('Publish Story', 'Опубликовать историю'));
    formHeader.textContent = isReplacementMode ? ui('Update existing community entry', 'Обновить запись сообщества') : ui('Publish to Community Library', 'Опубликовать в библиотеке сообщества');
    subtitle.textContent = isReplacementMode
      ? ui('Replace your live community version with updated content and metadata while ownership checks stay intact.', 'Замени опубликованную версию новым содержимым и метаданными с проверкой владельца.')
      : ui('Public publishing is moderated after the fact and rate limited per browser to keep the library tidy.', 'Публичные публикации модерируются после отправки и ограничены по частоте.');
    kicker.textContent = isReplacementMode ? ui('Live signal refresh', 'Обновление публикации') : ui('Rewarded community publish', 'Публикация с наградой');
    heroEyebrow.textContent = isReplacementMode ? ui('Updating a live story', 'Обновление опубликованной истории') : ui('Ready to go live', 'Готово к публикации');
    heroTitle.textContent = isReplacementMode ? ui('Refresh your published story', 'Обновить опубликованную историю') : ui('Launch a new community story', 'Запустить новую историю сообщества');
    heroBlurb.textContent = isReplacementMode
      ? ui('Ship a cleaner revision without leaving the editor, then let the library refresh around it.', 'Отправь новую версию прямо из редактора, затем библиотека обновится.')
      : ui('Higher quality branching raises the multiplier, which now feeds a bigger publish celebration the moment your story goes live.', 'Лучшее качество ветвления повышает множитель и награду при публикации.');
    replacementContext.hidden = !isReplacementMode;
    replacementContext.textContent = isReplacementMode && replacementCommunityId
      ? `Updating community post ${replacementCommunityId}`
      : '';
  };

  submitBtn.onclick = async () => {
    updateReplacementIntentState();
    const validationGate = splitValidationMessages(store.get().validationMessages);
    if (validationGate.errors.length > 0) {
      setStatus(buildValidationSummary('Publish blocked: resolve validation errors first.', validationGate.errors, 3), 'danger');
      return;
    }
    if (validationGate.warnings.length > 0) {
      const proceed = window.confirm(buildValidationSummary('Validation warnings detected. Publish anyway?', validationGate.warnings));
      if (!proceed) {
        setStatus('Publish cancelled. Resolve warnings or confirm override to continue.', 'neutral');
        return;
      }
    }

    const conv = store.getSelectedConversation();
    if (!conv) {
      setStatus('No story selected. Select a story in the left panel first.', 'danger');
      return;
    }
    if (!consentInput.checked) {
      setStatus('Confirm the moderation checkbox before publishing.', 'danger');
      return;
    }
    if (isInCollabSession() && !isCollabHost()) {
      setStatus('Only the host can publish.', 'danger');
      return;
    }

    const label = titleInput.value.trim() || conv.label || 'Untitled';
    const author = authorInput.value.trim() || 'Anonymous';
    const description = descInput.value.trim();
    const summary = summaryInput.value.trim() || createSummaryFromConversation(conv);
    const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
    const taggedUsernames = taggedUsersInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
    const faction = getConversationFaction(conv, store.get().project.faction);
    const branchCount = getBranchCount(conv);
    const uiLanguage = getUiLanguage();
    const selectedStoryLanguage: UiLanguage = languageInput.value === 'ru' ? 'ru' : 'en';
    const publishConversationCopy: Conversation = {
      ...structuredClone(conv),
      language: selectedStoryLanguage,
    };
    const selectedSourceMetadata = store.getSelectedConversationSourceMetadata();
    const fallbackCommunityMetadata = getCommunitySourceMetadata(conv);
    const selectedSourcePublisherId = (selectedSourceMetadata?.sourcePublisherId ?? fallbackCommunityMetadata?.publisher_id ?? '').trim();
    const selectedSourceCoAuthors = selectedSourceMetadata?.sourceCoAuthors ?? fallbackCommunityMetadata?.co_authors ?? [];
    const selectedReplacementPublisherId = getReplacementPublisherId(selectedSourcePublisherId, selectedSourceCoAuthors);
    const selectedOwnershipValid = Boolean(selectedReplacementPublisherId);
    const isTranslationDraft = isTranslationDraftMetadata(selectedSourceMetadata ?? fallbackCommunityMetadata);
    const storyLanguage: UiLanguage = selectedStoryLanguage;
    const translationTargetLanguage: UiLanguage = selectedSourceMetadata?.targetLanguage ?? fallbackCommunityMetadata?.targetLanguage ?? storyLanguage;
    const translationSourceLanguage = selectedSourceMetadata?.sourceLanguage ?? fallbackCommunityMetadata?.sourceLanguage ?? otherLanguage(translationTargetLanguage);
    const translationSourceId = selectedSourceMetadata?.sourceCommunityId ?? fallbackCommunityMetadata?.id ?? replacementCommunityId ?? '';
    const translationSourceEntry = isTranslationDraft ? getTranslationSourceEntry(translationSourceId) : null;
    const shouldUseReplacePayload = isReplacementCandidate && selectedOwnershipValid;
    const selectedReplaceId = shouldUseReplacePayload && replacementCommunityId
      ? replacementCommunityId
      : null;

    const conversationSourceMetadata = getCommunitySourceMetadata(conv);
    const conversationSourcePublisherId = conversationSourceMetadata?.publisher_id?.trim();
    const conversationReplacementPublisherId = getReplacementPublisherId(conversationSourcePublisherId, conversationSourceMetadata?.co_authors ?? []);
    const conversationOwnershipValid = Boolean(conversationReplacementPublisherId);
    const replaceId = selectedReplaceId;
    const publisherId = selectedOwnershipValid
      ? selectedReplacementPublisherId
      : (conversationOwnershipValid ? conversationReplacementPublisherId : undefined);
    const duplicateLocal = allResults.some(entry =>
      normalizeKey(entry.label) === normalizeKey(label)
      && (!replaceId || entry.id !== replaceId),
    );
    if (duplicateLocal) {
      setStatus('That title already exists in the current library view. Choose a more specific title before publishing.', 'danger');
      return;
    }

    submitBtn.disabled = true;
    backBtn.disabled = true;
    panelCloseBtn.disabled = true;
    setStatus('Validating title, abuse checks, and publish payload...', 'neutral');

    try {
      const coAuthorNames = getCollabCoAuthorNames(publisherId);
      const coAuthorFields = getCollabCoAuthorPublishFields(publisherId);
      const collabSessionId = isInCollabSession() ? await flushCollabSessionForPublish() : null;
      await publishConversation({
        faction,
        label,
        description,
        summary,
        author,
        tags,
        branch_count: branchCount,
        complexity: deriveConversationComplexity(branchCount),
        library_section: demoInput.checked ? 'demo' : 'community',
        tagged_usernames: taggedUsernames,
        data: {
          version: store.get().project.version,
          faction,
          conversations: [conv],
          language: storyLanguage,
          translation: isTranslationDraft ? {
            source_id: translationSourceId,
            source_language: translationSourceLanguage,
            target_language: translationTargetLanguage,
            source_label: translationSourceEntry?.label || conv.label || undefined,
            source_author: translationSourceEntry?.author || undefined,
          } : undefined,
        },
        replace_id: replaceId ?? undefined,
        publisher_id: publisherId,
        ...coAuthorFields,
        collab_session_id: collabSessionId ?? undefined,
      });
      setStatus(
        replaceId
          ? 'Updated existing community story. Refreshing library...'
          : 'Published successfully. Refreshing the library with your new community entry...',
        'success',
      );

      const publishPreview = getPublishPreviewStats(conv);
      const currentProfile = (globalThis as any).__pandaUserProfile as UserProfile | null;
      let persistedBonusXp = 0;
      let previousLevel = currentProfile?.level ?? 0;
      let updatedProfile: UserProfile | null = currentProfile;
      let publishToastMessage = '';

      if (currentProfile) {
        const publishCount = await fetchUserPublishCount(currentProfile.publisher_id).catch(() => 1);
        const publishedFactions = [faction];
        try {
          const allConvs = await fetchConversations();
          const userConvs = allConvs.filter(c => c.author === currentProfile.username);
          for (const entry of userConvs) {
            if (!publishedFactions.includes(entry.faction as FactionId)) {
              publishedFactions.push(entry.faction as FactionId);
            }
          }
        } catch {
          // best-effort only
        }

        const totalDownloads = 0;
        const totalUpvotes = 0;
        const gamResult = evaluatePublishGamification(conv, publishCount, totalDownloads, totalUpvotes, publishedFactions);

        const persistedAchievements: Array<(typeof gamResult.achievementsUnlocked)[number]> = [];
        for (const achievement of gamResult.achievementsUnlocked) {
          const unlocked = await unlockAchievement(currentProfile.publisher_id, achievement.id);
          if (unlocked) {
            unlockAchievementLocally(achievement.id);
            setCooldown(`ach-${achievement.id}`);
            persistedAchievements.push(achievement);
          }
        }

        if (gamResult.changedMissionRecords.length > 0) {
          await syncUserMissionProgress(currentProfile.publisher_id, gamResult.changedMissionRecords);
        }

        const currentStreakState = currentProfile.streaks ?? {
          publish_streak: 0,
          longest_streak: 0,
          last_publish_week: '',
          login_streak: 0,
          last_login_date: '',
        };
        await updateUserStreak(currentProfile.publisher_id, {
          publish_streak: gamResult.streakData.currentStreak,
          longest_streak: gamResult.streakData.longestStreak,
          last_publish_week: gamResult.streakData.lastPublishWeek,
          login_streak: currentStreakState.login_streak,
          last_login_date: currentStreakState.last_login_date,
        });

        persistedBonusXp = persistedAchievements.reduce((total, achievement) => total + achievement.xp, 0) + gamResult.missionXp;
        previousLevel = currentProfile.level;

        if (publishPreview.publishXp > 0) {
          await awardXp(currentProfile.publisher_id, publishPreview.publishXp);
        }
        if (persistedBonusXp > 0) {
          await awardXpCapped(currentProfile.publisher_id, persistedBonusXp);
        }

        const refreshed = await fetchUserProfile(currentProfile.publisher_id);
        updatedProfile = refreshed ?? currentProfile;
        (globalThis as any).__pandaUserProfile = updatedProfile;
        setProfileForBadge(updatedProfile);
        invalidateLeaderboardCache();

        if (publishPreview.publishXp > 0) {
          publishToastMessage = publishPreview.qualityMultiplier > 1
            ? `Published! (${publishPreview.qualityScore.totalStars}-star quality x${formatMultiplier(publishPreview.qualityMultiplier)})`
            : (replaceId ? 'Story updated!' : 'Story published!');
        }

        if (persistedAchievements.length > 0) {
          setTimeout(() => showAchievementToasts(persistedAchievements), 1200);
        }

        if (gamResult.streakInfo.streakChanged && gamResult.streakInfo.newStreak > 1) {
          const delay = 1200 + persistedAchievements.length * 800;
          setTimeout(() => {
            const shieldNote = gamResult.streakInfo.shieldUsed ? ' (Shield used!)' : '';
            showGamificationToast('\u{1F525}', `${gamResult.streakInfo.newStreak}-Week Streak!`, `Keep publishing weekly to grow your streak${shieldNote}`);
          }, delay);
        }

        if (gamResult.missionXp > 0 && gamResult.completedMissions.length > 0) {
          const delay = 1200 + persistedAchievements.length * 800 + (gamResult.streakInfo.streakChanged ? 800 : 0);
          setTimeout(() => {
            const missionSummary = gamResult.completedMissions.length === 1
              ? gamResult.completedMissions[0].description
              : gamResult.completedMissions.map(mission => mission.name).join(' | ');
            showGamificationToast('\u{1F3AF}', getMissionCompletionHeadline(gamResult.completedMissions), missionSummary, gamResult.missionXp);
          }, delay);
        }
      }

      showPublishCelebration({
        title: label,
        publishXp: publishPreview.publishXp,
        bonusXp: persistedBonusXp,
        totalXp: publishPreview.publishXp + persistedBonusXp,
        qualityStars: publishPreview.qualityScore.totalStars,
        qualityMultiplier: publishPreview.qualityMultiplier,
        branchCount: publishPreview.branchCount,
        complexityLabel: labelForComplexity(publishPreview.complexity),
        isUpdate: Boolean(replaceId),
        coAuthorNames,
      });

      if (publishToastMessage && publishPreview.publishXp > 0) {
        showXpToast(publishPreview.publishXp, publishToastMessage);
      }

      if (updatedProfile && updatedProfile.level > previousLevel) {
        setTimeout(() => showLevelUpToast(updatedProfile.level, updatedProfile.title), 600);
      }

      setTimeout(() => {
        form.hidden = true;
        setStatus('');
        if (activeFaction !== 'all' && activeFaction !== faction) {
          activeFaction = faction;
          rebuildSidebar();
          updateDownloadAllBtn();
        }
        allResults = [];
        selectedPreviewId = null;
        loadConversations();
      }, 1200);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Publish failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      backBtn.disabled = false;
      panelCloseBtn.disabled = false;
    }
  };

  (form as HTMLElement & { prefill?: (isReplacementCandidate?: boolean) => void }).prefill = (replacementMode = false) => {
    const conv = store.getSelectedConversation();
    const faction = getConversationFaction(conv, store.get().project.faction);
    const branchCount = getBranchCount(conv ?? undefined);
    const sourceMetadata = store.getSelectedConversationSourceMetadata() ?? (conv ? getCommunitySourceMetadata(conv) : null);
    const translationDraft = isTranslationDraftMetadata(sourceMetadata);
    const sourceCommunityId = sourceMetadata
      ? ('sourceCommunityId' in sourceMetadata ? sourceMetadata.sourceCommunityId : sourceMetadata.id)
      : '';
    const sourceEntry = sourceCommunityId
      ? getTranslationSourceEntry(sourceCommunityId)
      : null;
    titleInput.value = conv?.label || sourceEntry?.label || '';
    const currentUsername = getStoredUsername();
    authorInput.value = currentUsername || '';
    authorInput.readOnly = !!currentUsername;
    authorInput.style.opacity = currentUsername ? '0.7' : '1';
    authorInput.placeholder = currentUsername ? currentUsername : 'Anonymous (set a username via your profile)';
    descInput.value = sourceEntry?.description ?? '';
    summaryInput.value = conv ? createSummaryFromConversation(conv) : (sourceEntry?.summary ?? '');
    tagsInput.value = sourceEntry?.tags?.length
      ? sourceEntry.tags.join(', ')
      : branchCount <= 3 ? 'short, starter' : 'branching, story';
    taggedUsersInput.value = getCollabCoAuthorNames().join(', ');
    demoInput.checked = sourceEntry?.library_section === 'demo';
    languageInput.value = conv?.language === 'ru' || (!conv?.language && getUiLanguage() === 'ru') ? 'ru' : 'en';
    factionValue.textContent = `${FACTION_DISPLAY_NAMES[faction]} | ${languageFlag(languageInput.value as UiLanguage)} ${languageLabel(languageInput.value as UiLanguage)} | ${branchCount} branches | ${labelForComplexity(deriveConversationComplexity(branchCount))}`;
    factionValue.style.color = FACTION_COLORS[faction];
    applySubmitMode(replacementMode);
    updatePreview(conv, replacementMode);
    consentInput.checked = false;
    setStatus(
      translationDraft
        ? `Translation publish detected from ${sourceEntry?.label ?? sourceCommunityId ?? 'community story'}. Metadata copied; reward is 50% of normal publish XP.`
        : currentUsername
        ? `Publishing as ${currentUsername}. Duplicate titles are rejected. Story ownership is soft unless identity is backed by authenticated Supabase user auth + RLS.`
        : 'Anonymous publishes are browser-bound and ownership is soft. Duplicate titles are rejected.',
    );
  };

  return form;
}

function makeFormField(
  container: HTMLElement,
  labelText: string,
  type: 'text' | 'textarea',
  placeholder: string,
): HTMLInputElement | HTMLTextAreaElement {
  const row = document.createElement('div');
  row.className = 'share-form-field';

  const label = document.createElement('label');
  label.className = 'share-form-label';
  label.textContent = labelText;

  let input: HTMLInputElement | HTMLTextAreaElement;
  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 3;
  } else {
    input = document.createElement('input');
    (input as HTMLInputElement).type = 'text';
  }
  input.className = 'share-form-input';
  input.placeholder = placeholder;

  row.append(label, input);
  container.appendChild(row);
  return input;
}

function makeSelectFormField(
  container: HTMLElement,
  labelText: string,
  options: Array<{ value: string; label: string }>,
): HTMLSelectElement {
  const row = document.createElement('div');
  row.className = 'share-form-field';

  const label = document.createElement('label');
  label.className = 'share-form-label';
  label.textContent = labelText;

  const select = document.createElement('select');
  select.className = 'share-form-input';
  for (const entry of options) {
    const option = document.createElement('option');
    option.value = entry.value;
    option.textContent = entry.label;
    select.appendChild(option);
  }

  row.append(label, select);
  container.appendChild(row);
  return select;
}

function showPublishTrigger(): void {
  overlayEl?.querySelector<HTMLButtonElement>('[data-share-publish]')?.focus();
}

function showPublishForm(options: { replacementContext?: boolean } = {}): void {
  const conv = store.getSelectedConversation();
  if (!conv) {
    alert('Select a story in the left panel first, then click Publish.');
    return;
  }
  const form = overlayEl?.querySelector<HTMLElement & { prefill?: (isReplacementCandidate?: boolean) => void }>('.share-publish-form');
  if (!form) return;
  updateReplacementIntentState();
  const replacementContext = options.replacementContext ?? getPrimaryPublishReplacementMode();
  form.prefill?.(replacementContext);
  form.hidden = false;
  const firstField = form.querySelector<HTMLElement>('.share-form-input');
  firstField?.focus();
}
