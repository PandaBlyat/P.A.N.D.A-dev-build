import {
  type PublicProfileData,
  deriveLevelMetadata,
  fetchAchievementUnlockStats,
  updateFeaturedAchievements,
  getLevelTitle,
  getLocalPublisherId,
} from '../lib/api-client';
import {
  ACHIEVEMENTS,
  isAchievementRare,
  calculateQualityScore,
  getWallAchievementCatalog,
  type AchievementId,
  type AchievementTier,
} from '../lib/gamification';
import { createAchievementBadge } from './AchievementIcons';
import { FACTION_DISPLAY_NAMES, type FactionId } from '../lib/types';
import { FACTION_COLORS } from '../lib/faction-colors';
import { createIcon } from './icons';
import { renderAvatar, getBannerBackground } from './AvatarRenderer';
import { getAvatarBannerPreset, getAvatarEffectPreset } from '../lib/avatar-catalog';

type PublicProfileViewOptions = {
  data: PublicProfileData;
  leaderboardRank?: number | null;
  onAvatarClick?: (event: MouseEvent, avatar: HTMLElement) => void;
  onProfileUpdated?: (profile: import('../lib/api-client').UserProfile) => void;
};

type ProfilePrestigeStat = {
  icon: Parameters<typeof createIcon>[0];
  label: string;
  value: string;
};

type RarityTier = { id: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'; label: string; color: string };

function getRarityTier(percent: number): RarityTier {
  if (percent < 1) return { id: 'legendary', label: 'Legendary', color: '#f59e0b' };
  if (percent < 5) return { id: 'epic', label: 'Epic', color: '#a855f7' };
  if (percent < 15) return { id: 'rare', label: 'Rare', color: '#3b82f6' };
  if (percent < 40) return { id: 'uncommon', label: 'Uncommon', color: '#22c55e' };
  return { id: 'common', label: 'Common', color: 'var(--text-dim, #8892a6)' };
}

function getLevelTierColor(level: number): string {
  if (level >= 91) return 'var(--warning, #c4a040)';
  if (level >= 71) return 'color-mix(in srgb, var(--accent, #5eaa3a) 72%, #d9e6d0 28%)';
  if (level >= 51) return 'color-mix(in srgb, var(--accent, #5eaa3a) 84%, #86c7d4 16%)';
  return 'var(--accent, #5eaa3a)';
}

const BADGE_ACCENTS = [
  '#8fd46a',
  '#d7ba59',
  '#7fb2e8',
  '#d87861',
  '#6fc5b7',
  '#b38ad9',
  '#e09b5b',
  '#9ccf74',
  '#d1d7df',
  '#e6c66a',
];

function getAchievementAccent(id: AchievementId | null, tier?: AchievementTier): string {
  if (!id) return 'var(--profile-accent)';
  let hash = tier === 'gold' ? 11 : tier === 'silver' ? 7 : 3;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 997;
  }
  return BADGE_ACCENTS[hash % BADGE_ACCENTS.length];
}

function getAchievementAnimationDelay(id: AchievementId | null): string {
  if (!id) return '0ms';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 1600;
  }
  return `${hash}ms`;
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function formatRelativeDate(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown';
  const deltaMs = Date.now() - timestamp;
  const deltaDays = Math.max(0, Math.round(deltaMs / 86_400_000));
  if (deltaDays === 0) return 'Today';
  if (deltaDays === 1) return 'Yesterday';
  if (deltaDays < 7) return `${deltaDays} days ago`;
  if (deltaDays < 30) return `${Math.round(deltaDays / 7)} weeks ago`;
  if (deltaDays < 365) return `${Math.round(deltaDays / 30)} months ago`;
  return `${Math.round(deltaDays / 365)} years ago`;
}

function cleanPublicProfileText(value: string): string {
  return value
    .replace(/\u00e2\u02dc\u2026/g, '-star')
    .replace(/\u00e2\u2020\u2018/g, 'Up ')
    .replace(/\u00e2\u2020\u201c/g, 'Down ')
    .replace(/\s*\u00b7\s*/g, ' - ');
}

function getUnlockedAchievements(profileData: PublicProfileData): string[] {
  return profileData.profile.achievements ?? [];
}

function getFeaturedAchievements(profileData: PublicProfileData) {
  const unlocked = new Set(getUnlockedAchievements(profileData));

  // If the user has manually pinned achievements, honour that list (up to 5).
  const pinned = profileData.profile.featured_achievements;
  if (pinned && pinned.length > 0) {
    const pinnedAchievements = pinned
      .map(id => ACHIEVEMENTS.find(a => a.id === id))
      .filter((a): a is NonNullable<typeof a> => a != null && unlocked.has(a.id));
    if (pinnedAchievements.length > 0) return pinnedAchievements.slice(0, 5);
  }

  // Auto-select: featured/rare, sorted by tier then XP, up to 5.
  return ACHIEVEMENTS
    .filter(achievement => unlocked.has(achievement.id) && (achievement.featured || isAchievementRare(achievement)))
    .sort((a, b) => {
      const tierDelta = (b.tier === 'gold' ? 3 : b.tier === 'silver' ? 2 : 1) - (a.tier === 'gold' ? 3 : a.tier === 'silver' ? 2 : 1);
      return tierDelta || b.xp - a.xp;
    })
    .slice(0, 5);
}

function getRareBadgeCount(profileData: PublicProfileData): number {
  const unlocked = new Set(getUnlockedAchievements(profileData));
  return ACHIEVEMENTS.filter(achievement => unlocked.has(achievement.id) && isAchievementRare(achievement)).length;
}

function buildHeader(data: PublicProfileData, onAvatarClick?: (event: MouseEvent, avatar: HTMLElement) => void): HTMLElement {
  const { profile, publish_count } = data;
  const levelMeta = deriveLevelMetadata(profile.xp);
  const currentThreshold = levelMeta.currentLevelThreshold;
  const nextThreshold = levelMeta.nextLevelThreshold;
  const resolvedCurrentTitle = getLevelTitle(currentThreshold.level) || profile.title;

  const header = document.createElement('section');
  header.className = 'public-profile-hero';
  const bannerBg = getBannerBackground(profile.avatar_banner);
  if (bannerBg) {
    header.style.background = bannerBg;
    header.dataset.customBanner = String(profile.avatar_banner);
    if (profile.avatar_banner) header.setAttribute('data-banner', profile.avatar_banner);
    if (getAvatarBannerPreset(profile.avatar_banner)?.isAnimated) {
      header.classList.add('pa-anim-bg');
      // background shorthand resets background-size, so re-assert it after
      header.style.backgroundSize = '200% 200%';
      header.style.setProperty('--pa-banner-speed', String(profile.avatar_banner_speed ?? 1.0));
    }
  }

  // VFX overlay — sits above the banner tint but behind grid content.
  if (profile.avatar_effect && profile.avatar_effect !== 'none') {
    const effectLayer = document.createElement('div');
    effectLayer.className = 'public-profile-hero-effect pa-avatar-chip-effect-sample';
    effectLayer.setAttribute('aria-hidden', 'true');
    effectLayer.dataset.effect = String(profile.avatar_effect);
    const heroEffectPreset = getAvatarEffectPreset(profile.avatar_effect);
    if (heroEffectPreset) {
      effectLayer.style.setProperty('--pa-effect-color', profile.avatar_effect_color || heroEffectPreset.defaultColor || 'var(--accent)');
      effectLayer.style.setProperty('--pa-effect-intensity', String((profile.avatar_effect_intensity ?? heroEffectPreset.defaultIntensity ?? 75) / 100));
      effectLayer.style.setProperty('--pa-effect-speed', String(profile.avatar_effect_speed ?? heroEffectPreset.defaultSpeed ?? 1.0));
      effectLayer.style.setProperty('--pa-effect-saturation', String((profile.avatar_effect_saturation ?? 100) / 100));
      effectLayer.style.setProperty('--pa-effect-size', String((profile.avatar_effect_size ?? 100) / 100));
      effectLayer.style.setProperty('--pa-effect-alpha', String((profile.avatar_effect_alpha ?? 100) / 100));
    }
    header.appendChild(effectLayer);
  }

  const identity = document.createElement('div');
  identity.className = 'public-profile-identity';

  // Use the API-authoritative level so it always matches the leaderboard.
  const tierColor = getLevelTierColor(profile.level);
  let avatar: HTMLElement | null = null;
  avatar = renderAvatar(
    {
      username: profile.username,
      level: profile.level,
      fallbackColor: tierColor,
      avatar_icon: profile.avatar_icon,
      avatar_color: profile.avatar_color,
      avatar_frame: profile.avatar_frame,
      avatar_frame_color: profile.avatar_frame_color,
      avatar_frame_intensity: profile.avatar_frame_intensity,
      avatar_banner: profile.avatar_banner,
      avatar_banner_opacity: profile.avatar_banner_opacity,
      avatar_banner_speed: profile.avatar_banner_speed,
      avatar_effect: profile.avatar_effect,
      avatar_effect_color: profile.avatar_effect_color,
      avatar_effect_intensity: profile.avatar_effect_intensity,
      avatar_effect_speed: profile.avatar_effect_speed,
      avatar_effect_saturation: profile.avatar_effect_saturation,
      avatar_effect_size: profile.avatar_effect_size,
      avatar_effect_alpha: profile.avatar_effect_alpha,
    },
    {
      extraClass: 'public-profile-avatar',
      showLevel: true,
      size: 'lg',
      title: onAvatarClick ? 'Customize your avatar' : undefined,
      onClick: onAvatarClick ? (event) => {
        if (avatar) onAvatarClick(event, avatar);
      } : undefined,
    },
  );
  avatar.style.setProperty('--tier-color', tierColor);

  const copy = document.createElement('div');
  copy.className = 'public-profile-identity-copy';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'public-profile-eyebrow';
  eyebrow.textContent = 'Stalker dossier';

  const title = document.createElement('h3');
  title.className = 'public-profile-name';
  title.textContent = profile.username;

  const subtitle = document.createElement('div');
  subtitle.className = 'public-profile-title';
  subtitle.textContent = `${resolvedCurrentTitle} - ${profile.xp.toLocaleString()} XP - ${publish_count} publishes`;

  const memberSince = document.createElement('div');
  memberSince.className = 'public-profile-member-since';
  memberSince.textContent = `In the Zone since ${formatDate(profile.created_at)}`;

  const spotlight = document.createElement('div');
  spotlight.className = 'public-profile-summary-stats';

  const spotlightItems = [
    { text: `${getUnlockedAchievements(data).length} badges` },
    { text: `${getRareBadgeCount(data)} rare unlock${getRareBadgeCount(data) === 1 ? '' : 's'}`, rare: true },
    { text: `${data.profile.streaks?.publish_streak ?? 0} week streak` },
  ];

  if (publish_count > 0) {
    spotlightItems.unshift({ text: `${publish_count} publish${publish_count === 1 ? '' : 'es'}` });
  }

  spotlightItems.slice(0, 4).forEach((item) => {
    const pill = document.createElement('span');
    pill.className = 'public-profile-summary-pill';
    if (item.rare) pill.classList.add('public-profile-summary-pill-rare');
    pill.textContent = item.text;
    spotlight.appendChild(pill);
  });

  const featured = getFeaturedAchievements(data);
  const featuredStrip = document.createElement('div');
  featuredStrip.className = 'public-profile-featured-badges';
  if (featured.length > 0) {
    const label = document.createElement('span');
    label.className = 'public-profile-featured-label';
    label.textContent = 'Signature badges';
    featuredStrip.appendChild(label);
    featured.forEach((achievement) => {
      const badge = document.createElement('span');
      badge.className = 'public-profile-featured-badge';
      badge.style.setProperty('--badge-accent', getAchievementAccent(achievement.id, achievement.tier));
      badge.title = `${achievement.name}: ${achievement.description}`;
      badge.append(createAchievementBadge(achievement.id, 'unlocked', 30));
      const badgeName = document.createElement('span');
      badgeName.textContent = achievement.name;
      badge.appendChild(badgeName);
      featuredStrip.appendChild(badge);
    });
  }

  const progressWrap = document.createElement('div');
  progressWrap.className = 'public-profile-progress';

  const progressMeta = document.createElement('div');
  progressMeta.className = 'public-profile-progress-meta';
  progressMeta.textContent = nextThreshold
    ? `${profile.xp.toLocaleString()} / ${nextThreshold.xp.toLocaleString()} XP to ${getLevelTitle(nextThreshold.level) || nextThreshold.title}`
    : `${profile.xp.toLocaleString()} XP - max level reached`;

  const progressTrack = document.createElement('div');
  progressTrack.className = 'public-profile-progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'public-profile-progress-fill';
  progressFill.style.width = `${Math.round(levelMeta.progressFraction * 100)}%`;
  progressTrack.appendChild(progressFill);
  progressWrap.append(progressMeta, progressTrack);

  copy.append(eyebrow, title, subtitle, memberSince, spotlight);
  if (featured.length > 0) copy.appendChild(featuredStrip);
  copy.appendChild(progressWrap);
  identity.append(avatar, copy);

  const stats = document.createElement('div');
  stats.className = 'public-profile-hero-stats';

  const statDefs = [
    { icon: 'trophy' as const, value: `Level ${currentThreshold.level}`, label: 'Title tier' },
    { icon: 'star' as const, value: `${profile.xp.toLocaleString()} XP`, label: 'Career XP' },
    { icon: 'export' as const, value: String(publish_count), label: 'Published' },
    { icon: 'medal' as const, value: String(getUnlockedAchievements(data).length), label: 'Badges' },
  ];

  statDefs.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'public-profile-stat-card';
    const icon = createIcon(stat.icon);
    icon.classList.add('public-profile-stat-icon');
    const value = document.createElement('div');
    value.className = 'public-profile-stat-value';
    value.textContent = stat.value;
    const label = document.createElement('div');
    label.className = 'public-profile-stat-label';
    label.textContent = stat.label;
    card.append(icon, value, label);
    stats.appendChild(card);
  });

  header.append(identity, stats);
  return header;
}

function buildSection(titleText: string, iconName: Parameters<typeof createIcon>[0], subtitleText?: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'public-profile-section';

  const header = document.createElement('div');
  header.className = 'public-profile-section-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'public-profile-section-title-wrap';
  const titleRow = document.createElement('div');
  titleRow.className = 'public-profile-section-title-row';
  titleRow.append(createIcon(iconName));
  const title = document.createElement('h4');
  title.className = 'public-profile-section-title';
  title.textContent = titleText;
  titleRow.appendChild(title);
  titleWrap.appendChild(titleRow);
  if (subtitleText) {
    const subtitle = document.createElement('p');
    subtitle.className = 'public-profile-section-subtitle';
    subtitle.textContent = subtitleText;
    titleWrap.appendChild(subtitle);
  }
  header.appendChild(titleWrap);
  section.appendChild(header);
  return section;
}

function buildPrestigeSummary(data: PublicProfileData, leaderboardRank?: number | null): HTMLElement {
  const section = buildSection('Prestige summary', 'trophy', 'Rank, quality, streaks, and rare unlocks.');
  section.classList.add('public-profile-section-prestige');
  const metrics = document.createElement('div');
  metrics.className = 'public-profile-prestige-grid';

  const fiveStarPublishes = data.authored_conversations.reduce((count, conversation) => {
    const source = conversation.data?.conversations?.[0];
    return source && calculateQualityScore(source).totalStars >= 5 ? count + 1 : count;
  }, 0);

  const prestige: ProfilePrestigeStat[] = [];
  if (leaderboardRank && leaderboardRank > 0) {
    prestige.push({ icon: 'trophy', label: 'Leaderboard', value: `Top ${leaderboardRank}` });
  }
  prestige.push(
    { icon: 'flame', label: 'Longest streak', value: `${data.profile.streaks?.longest_streak ?? 0} weeks` },
    { icon: 'medal', label: 'Rare badges', value: `${getRareBadgeCount(data)}` },
    { icon: 'star', label: '5★ publishes', value: `${fiveStarPublishes}` },
  );

  prestige.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'public-profile-prestige-card';
    const icon = createIcon(item.icon);
    icon.classList.add('public-profile-prestige-icon');
    const value = document.createElement('div');
    value.className = 'public-profile-prestige-value';
    value.textContent = item.value;
    const label = document.createElement('div');
    label.className = 'public-profile-prestige-label';
    label.textContent = cleanPublicProfileText(item.label);
    card.append(icon, value, label);
    metrics.appendChild(card);
  });

  section.appendChild(metrics);
  return section;
}

function buildAchievementsSection(data: PublicProfileData, ctx?: BadgeTooltipContext): HTMLElement {
  const section = buildSection('Badge wall', 'medal', 'Unlocked badges are highlighted. Silhouettes are visible badges not yet earned; question marks are still a mystery.');
  section.classList.add('public-profile-section-badges');
  const unlocked = new Set(getUnlockedAchievements(data));

  const catalog = getWallAchievementCatalog();
  const unlockedCount = catalog.filter(a => unlocked.has(a.id)).length;

  const summary = document.createElement('div');
  summary.className = 'public-profile-summary-stats';
  const summaryItems: string[] = [
    `${unlockedCount}/${catalog.length} unlocked`,
    `${getRareBadgeCount(data)} rare`,
  ];
  if (ctx?.isOwnProfile) {
    const pinnedCount = (data.profile.featured_achievements ?? []).length;
    summaryItems.push(`${pinnedCount}/5 pinned to header`);
  }
  summaryItems.forEach((item, index) => {
    const pill = document.createElement('span');
    pill.className = 'public-profile-summary-pill';
    if (index === 1) pill.classList.add('public-profile-summary-pill-rare');
    pill.textContent = item;
    summary.appendChild(pill);
  });
  section.appendChild(summary);

  if (catalog.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No badges available yet.';
    section.appendChild(empty);
    return section;
  }

  // Partition achievements into unlocked vs locked.
  const unlockedAchievements = catalog.filter(a => unlocked.has(a.id));
  const visibleLocked = catalog.filter(a => !unlocked.has(a.id) && !a.hidden);
  const hiddenLocked = catalog.filter(a => !unlocked.has(a.id) && a.hidden);
  const lockedCount = visibleLocked.length + hiddenLocked.length;

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'public-profile-badge-wall-tabs';

  const unlockedTab = document.createElement('button');
  unlockedTab.type = 'button';
  unlockedTab.className = 'public-profile-badge-wall-tab is-active';
  unlockedTab.textContent = `Unlocked (${unlockedAchievements.length})`;

  const lockedTab = document.createElement('button');
  lockedTab.type = 'button';
  lockedTab.className = 'public-profile-badge-wall-tab';
  lockedTab.textContent = `Locked (${lockedCount})`;

  tabBar.append(unlockedTab, lockedTab);
  section.appendChild(tabBar);

  // Unlocked wall
  const unlockedWall = document.createElement('div');
  unlockedWall.className = 'public-profile-badge-wall';
  for (const achievement of unlockedAchievements) {
    unlockedWall.appendChild(buildBadgeTile(achievement.id as AchievementId, achievement.name, achievement.description, 'unlocked', `${achievement.tier} · +${achievement.xp} XP`, ctx));
  }
  if (unlockedAchievements.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No badges unlocked yet — start publishing!';
    empty.style.gridColumn = '1 / -1';
    unlockedWall.appendChild(empty);
  }

  // Locked wall (initially hidden)
  const lockedWall = document.createElement('div');
  lockedWall.className = 'public-profile-badge-wall';
  lockedWall.style.display = 'none';
  for (const achievement of visibleLocked) {
    lockedWall.appendChild(buildBadgeTile(achievement.id as AchievementId, achievement.name, achievement.description, 'locked-visible', `${achievement.tier} · Locked`));
  }
  for (const _achievement of hiddenLocked) {
    lockedWall.appendChild(buildBadgeTile(null, 'Mystery badge', 'Discover hidden challenges to unlock.', 'locked-hidden', 'Hidden'));
  }

  // Tab switching
  unlockedTab.addEventListener('click', () => {
    unlockedTab.classList.add('is-active');
    lockedTab.classList.remove('is-active');
    unlockedWall.style.display = '';
    lockedWall.style.display = 'none';
  });
  lockedTab.addEventListener('click', () => {
    lockedTab.classList.add('is-active');
    unlockedTab.classList.remove('is-active');
    unlockedWall.style.display = 'none';
    lockedWall.style.display = '';
  });

  section.append(unlockedWall, lockedWall);
  return section;
}

// ---------------------------------------------------------------------------
// Badge detail tooltip — floats near the clicked tile (body-appended, fixed).
// ---------------------------------------------------------------------------
let badgeTooltip: HTMLElement | null = null;
let badgeTooltipTile: HTMLElement | null = null;

function collapseBadge(): void {
  badgeTooltip?.remove();
  badgeTooltip = null;
  badgeTooltipTile?.classList.remove('is-badge-active');
  badgeTooltipTile = null;
}

type BadgeTooltipContext = {
  profileData: PublicProfileData;
  isOwnProfile: boolean;
  onProfileUpdated?: (profile: import('../lib/api-client').UserProfile) => void;
};

function showBadgeTooltip(
  tile: HTMLElement,
  id: AchievementId | null,
  name: string,
  description: string,
  state: 'unlocked' | 'locked-visible' | 'locked-hidden',
  meta: string,
  ctx?: BadgeTooltipContext,
): void {
  collapseBadge();
  tile.classList.add('is-badge-active');
  badgeTooltipTile = tile;

  const tooltip = document.createElement('div');
  tooltip.className = `public-profile-badge-tooltip public-profile-badge-tooltip-${state}`;
  tooltip.setAttribute('role', 'dialog');
  tooltip.setAttribute('aria-label', name);

  const iconEl = document.createElement('div');
  iconEl.className = 'public-profile-badge-tooltip-icon';
  iconEl.appendChild(createAchievementBadge(id, state, 88));

  const nameEl = document.createElement('div');
  nameEl.className = 'public-profile-badge-tooltip-name';
  nameEl.textContent = state === 'locked-hidden' ? '???' : name;

  const metaEl = document.createElement('div');
  metaEl.className = 'public-profile-badge-tooltip-meta';
  metaEl.textContent = meta;

  const descEl = document.createElement('p');
  descEl.className = 'public-profile-badge-tooltip-desc';
  descEl.textContent = state === 'locked-hidden'
    ? 'Unlock condition hidden — keep exploring the Zone.'
    : description;

  const rarityEl = document.createElement('div');
  rarityEl.className = 'public-profile-badge-tooltip-rarity';
  rarityEl.textContent = 'Loading rarity…';

  tooltip.append(iconEl, nameEl, metaEl, descEl, rarityEl);

  // Pin-to-profile button (own profile + unlocked badge only).
  if (id && state === 'unlocked' && ctx?.isOwnProfile) {
    const profile = ctx.profileData.profile;
    const currentPinned: string[] = Array.isArray(profile.featured_achievements) ? [...profile.featured_achievements] : [];
    const isPinned = currentPinned.includes(id);

    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = `btn-sm public-profile-badge-pin-btn${isPinned ? ' is-pinned' : ''}`;
    pinBtn.textContent = isPinned ? 'Remove from header display' : 'Display on profile header';
    pinBtn.title = isPinned
      ? 'Remove this badge from your profile header and leaderboard display'
      : `Pin this badge to your profile header (max 5, currently ${currentPinned.length}/5)`;

    pinBtn.onclick = async (e) => {
      e.stopPropagation();
      pinBtn.disabled = true;
      pinBtn.textContent = 'Saving…';
      try {
        let nextPinned: string[];
        if (isPinned) {
          nextPinned = currentPinned.filter(p => p !== id);
        } else {
          if (currentPinned.length >= 5) {
            pinBtn.textContent = 'Already 5 pinned — remove one first';
            pinBtn.disabled = false;
            return;
          }
          nextPinned = [...currentPinned, id];
        }
        const publisherId = profile.publisher_id;
        const updated = await updateFeaturedAchievements(publisherId, nextPinned);
        if (updated) {
          profile.featured_achievements = nextPinned;
          pinBtn.textContent = isPinned ? 'Removed from header' : 'Added to header!';
          if (ctx.onProfileUpdated) ctx.onProfileUpdated(updated);
        } else {
          pinBtn.textContent = 'Save failed — try again';
          pinBtn.disabled = false;
        }
      } catch {
        pinBtn.textContent = 'Save failed — try again';
        pinBtn.disabled = false;
      }
    };

    tooltip.appendChild(pinBtn);
  }

  if (id && state !== 'locked-hidden') {
    void fetchAchievementUnlockStats().then((stats) => {
      if (!document.body.contains(rarityEl)) return;
      const stat = stats.get(id);
      if (!stat || stat.percent <= 0) {
        rarityEl.textContent = 'Rarity: unknown';
        return;
      }
      const pct = stat.percent;
      const tier = getRarityTier(pct);
      rarityEl.textContent = `Unlocked by ${pct.toFixed(pct < 1 ? 2 : 1)}% of stalkers · ${tier.label}`;
      rarityEl.style.setProperty('--badge-rarity-color', tier.color);
      rarityEl.dataset.rarity = tier.id;
    }).catch(() => {
      if (!document.body.contains(rarityEl)) return;
      rarityEl.textContent = 'Rarity: unknown';
    });
  } else {
    rarityEl.textContent = state === 'locked-hidden' ? 'Rarity: hidden' : 'Rarity: unknown';
  }

  // Position the tooltip near the tile.
  document.body.appendChild(tooltip);
  badgeTooltip = tooltip;

  const tileRect = tile.getBoundingClientRect();
  const ttRect = tooltip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 10;

  // Prefer above the tile; fall back to below if not enough space.
  let top = tileRect.top - ttRect.height - margin;
  if (top < margin) top = tileRect.bottom + margin;
  // Clamp vertically.
  top = Math.max(margin, Math.min(top, vh - ttRect.height - margin));

  // Centre horizontally on the tile; clamp to viewport.
  let left = tileRect.left + tileRect.width / 2 - ttRect.width / 2;
  left = Math.max(margin, Math.min(left, vw - ttRect.width - margin));

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;

  // Close on click outside.
  const onOutsideClick = (e: MouseEvent) => {
    if (!tooltip.contains(e.target as Node) && e.target !== tile) {
      collapseBadge();
      document.removeEventListener('click', onOutsideClick, true);
    }
  };
  setTimeout(() => document.addEventListener('click', onOutsideClick, true), 0);

  // Close on Escape.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { collapseBadge(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

function buildBadgeTile(
  id: AchievementId | null,
  name: string,
  description: string,
  state: 'unlocked' | 'locked-visible' | 'locked-hidden',
  meta: string,
  ctx?: BadgeTooltipContext,
): HTMLElement {
  const tile = document.createElement('article');
  tile.className = `public-profile-badge-tile public-profile-badge-tile-${state}`;
  if (state === 'unlocked') {
    tile.style.setProperty('--badge-accent', getAchievementAccent(id));
    tile.style.setProperty('--badge-pulse-delay', getAchievementAnimationDelay(id));
  }
  tile.setAttribute('aria-label', state === 'locked-hidden' ? 'Hidden badge, not yet unlocked' : `${name}, ${state === 'unlocked' ? 'unlocked' : 'locked'}`);
  tile.setAttribute('role', 'button');
  tile.tabIndex = 0;
  tile.title = state === 'locked-hidden' ? 'Click to inspect' : `Click to inspect · ${name}`;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'public-profile-badge-icon-wrap';
  iconWrap.appendChild(createAchievementBadge(id, state, 38));

  if (id && state !== 'locked-hidden') {
    void fetchAchievementUnlockStats().then((stats) => {
      if (!document.body.contains(tile)) return;
      const stat = stats.get(id);
      if (!stat || stat.percent <= 0) return;
      const tier = getRarityTier(stat.percent);
      tile.dataset.rarity = tier.id;
      tile.style.setProperty('--badge-rarity-color', tier.color);
      tile.style.setProperty('--badge-rarity-percent', String(stat.percent));
    }).catch(() => undefined);
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'public-profile-badge-name';
  nameEl.textContent = state === 'locked-hidden' ? '???' : name;

  // Show a small "pinned" indicator if this achievement is featured.
  if (id && state === 'unlocked' && ctx?.isOwnProfile) {
    const pinned = ctx.profileData.profile.featured_achievements ?? [];
    if (pinned.includes(id)) {
      const pinnedDot = document.createElement('span');
      pinnedDot.className = 'public-profile-badge-pinned-dot';
      pinnedDot.title = 'Displayed on your profile header';
      iconWrap.appendChild(pinnedDot);
    }
  }

  tile.append(iconWrap, nameEl);

  const handleOpen = (e: Event) => {
    e.stopPropagation();
    if (badgeTooltipTile === tile) {
      collapseBadge();
      return;
    }
    showBadgeTooltip(tile, id, name, description, state, meta, ctx);
  };

  tile.addEventListener('click', handleOpen);
  tile.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(e); }
    else if (e.key === 'Escape') collapseBadge();
  });

  return tile;
}

function buildFactionBreakdown(data: PublicProfileData): HTMLElement {
  const section = buildSection('Faction breakdown', 'target', 'Published work by faction.');
  section.classList.add('public-profile-section-faction');
  const rows = document.createElement('div');
  rows.className = 'public-profile-faction-list';

  const counts = new Map<FactionId, number>();
  data.authored_conversations.forEach((conversation) => {
    counts.set(conversation.faction, (counts.get(conversation.faction) ?? 0) + 1);
  });

  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No faction history yet.';
    section.appendChild(empty);
    return section;
  }

  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([faction, count]) => {
      const row = document.createElement('div');
      row.className = 'public-profile-faction-row';

      const labelWrap = document.createElement('div');
      labelWrap.className = 'public-profile-faction-label-wrap';
      const dot = document.createElement('span');
      dot.className = 'public-profile-faction-dot';
      dot.style.backgroundColor = FACTION_COLORS[faction] ?? 'var(--accent)';
      const label = document.createElement('span');
      label.className = 'public-profile-faction-label';
      label.textContent = FACTION_DISPLAY_NAMES[faction] ?? faction;
      labelWrap.append(dot, label);

      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      const meta = document.createElement('span');
      meta.className = 'public-profile-faction-meta';
      meta.textContent = `${count} publish${count === 1 ? '' : 'es'} · ${percent}%`;

      const bar = document.createElement('div');
      bar.className = 'public-profile-faction-bar';
      const fill = document.createElement('div');
      fill.className = 'public-profile-faction-fill';
      fill.style.width = `${percent}%`;
      fill.style.backgroundColor = FACTION_COLORS[faction] ?? 'var(--accent)';
      bar.appendChild(fill);

      row.append(labelWrap, meta, bar);
      rows.appendChild(row);
    });

  section.appendChild(rows);
  return section;
}

function buildStreakHighlights(data: PublicProfileData): HTMLElement {
  const section = buildSection('Streak highlights', 'flame', 'Publish and login rhythm.');
  section.classList.add('public-profile-section-streaks');
  const grid = document.createElement('div');
  grid.className = 'public-profile-streak-grid';

  const streakCards = [
    { label: 'Current publish streak', value: `${data.profile.streaks?.publish_streak ?? 0} weeks` },
    { label: 'Longest publish streak', value: `${data.profile.streaks?.longest_streak ?? 0} weeks` },
    { label: 'Daily login streak', value: `${data.profile.streaks?.login_streak ?? 0} days` },
    { label: 'Last active publish week', value: data.profile.streaks?.last_publish_week || 'Unknown' },
  ];

  streakCards.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'public-profile-streak-card';
    const value = document.createElement('div');
    value.className = 'public-profile-streak-value';
    value.textContent = item.value;
    const label = document.createElement('div');
    label.className = 'public-profile-streak-label';
    label.textContent = item.label;
    card.append(value, label);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

function buildRecentCards(data: PublicProfileData): HTMLElement {
  const section = buildSection('Recently published', 'export', 'Latest public conversations.');
  section.classList.add('public-profile-section-recent');
  const cards = document.createElement('div');
  cards.className = 'public-profile-recent-grid';

  const recent = data.authored_conversations.slice(0, 4);
  if (recent.length === 0) {
    section.classList.add('public-profile-section-recent-empty');
    const empty = document.createElement('div');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No public conversations available from this publisher yet.';
    section.appendChild(empty);
    return section;
  }

  recent.forEach((conversation) => {
    const sourceConversation = conversation.data?.conversations?.[0];
    const qualityStars = sourceConversation ? calculateQualityScore(sourceConversation).totalStars : null;

    const card = document.createElement('article');
    card.className = 'public-profile-recent-card';

    const top = document.createElement('div');
    top.className = 'public-profile-recent-top';

    const faction = document.createElement('span');
    faction.className = 'public-profile-recent-faction';
    faction.style.setProperty('--faction-color', FACTION_COLORS[conversation.faction] ?? 'var(--accent)');
    faction.textContent = FACTION_DISPLAY_NAMES[conversation.faction] ?? conversation.faction;

    const published = document.createElement('span');
    published.className = 'public-profile-recent-published';
    published.textContent = formatRelativeDate(conversation.created_at);

    top.append(faction, published);

    const title = document.createElement('h5');
    title.className = 'public-profile-recent-title';
    title.textContent = conversation.label || 'Untitled conversation';

    const authors = document.createElement('div');
    authors.className = 'public-profile-recent-coauthors';
    const coAuthorNames = conversation.co_author_usernames ?? [];
    authors.textContent = coAuthorNames.length > 0
      ? `Authors: ${[conversation.author || 'Anonymous', ...coAuthorNames].join(', ')}`
      : '';

    const summary = document.createElement('p');
    summary.className = 'public-profile-recent-summary';
    summary.textContent = conversation.summary || conversation.description || 'No summary provided.';

    const meta = document.createElement('div');
    meta.className = 'public-profile-recent-meta';
    const parts = [
      `${conversation.branch_count ?? 0} branches`,
      `↑${conversation.upvotes ?? 0}`,
      `↓${conversation.downloads}`,
    ];
    if (qualityStars) parts.push(`${qualityStars}★ quality`);
    meta.textContent = cleanPublicProfileText(parts.join(' · '));

    const footer = document.createElement('div');
    footer.className = 'public-profile-recent-footer';
    const exactDate = document.createElement('span');
    exactDate.className = 'public-profile-recent-date';
    exactDate.textContent = formatDate(conversation.created_at);
    footer.appendChild(exactDate);

    if (conversation.tags && conversation.tags.length > 0) {
      const tagRow = document.createElement('div');
      tagRow.className = 'public-profile-recent-tags';
      conversation.tags.slice(0, 3).forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'public-profile-recent-tag';
        chip.textContent = `#${tag}`;
        tagRow.appendChild(chip);
      });
      footer.appendChild(tagRow);
    }

    if (authors.textContent) {
      card.append(top, title, authors, summary, meta, footer);
    } else {
      card.append(top, title, summary, meta, footer);
    }
    cards.appendChild(card);
  });

  section.appendChild(cards);
  return section;
}

function buildConversationSummarySection(data: PublicProfileData): HTMLElement {
  const section = buildSection('Publishing footprint', 'clock', 'Catalog range and branch density.');
  section.classList.add('public-profile-section-footprint');
  const strip = document.createElement('div');
  strip.className = 'public-profile-footprint-strip';

  const conversations = data.authored_conversations;
  const newest = conversations[0]?.created_at;
  const oldest = conversations[conversations.length - 1]?.created_at;
  const avgBranches = conversations.length > 0
    ? (conversations.reduce((sum, conversation) => sum + (conversation.branch_count ?? 0), 0) / conversations.length).toFixed(1)
    : '0.0';

  [
    { label: 'Recent publish', value: newest ? formatRelativeDate(newest) : 'No publishes' },
    { label: 'Catalog start', value: oldest ? formatDate(oldest) : 'Unknown' },
    { label: 'Avg. branches', value: avgBranches },
  ].forEach((item) => {
    const card = document.createElement('div');
    card.className = 'public-profile-footprint-card';
    const value = document.createElement('div');
    value.className = 'public-profile-footprint-value';
    value.textContent = item.value;
    const label = document.createElement('div');
    label.className = 'public-profile-footprint-label';
    label.textContent = item.label;
    card.append(value, label);
    strip.appendChild(card);
  });

  section.appendChild(strip);
  return section;
}

function buildPublicProfileBody(data: PublicProfileData, leaderboardRank?: number | null, ctx?: BadgeTooltipContext): HTMLElement {
  const body = document.createElement('div');
  body.className = 'public-profile-body public-profile-body-single';
  body.append(
    buildPrestigeSummary(data, leaderboardRank ?? undefined),
    buildStreakHighlights(data),
    buildConversationSummarySection(data),
    buildFactionBreakdown(data),
    buildAchievementsSection(data, ctx),
    buildRecentCards(data),
  );
  return body;
}

export function renderPublicProfileView(options: PublicProfileViewOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'public-profile-view public-profile-view-single';

  const localId = getLocalPublisherId();
  const isOwnProfile = localId === options.data.profile.publisher_id;
  const ctx: BadgeTooltipContext = {
    profileData: options.data,
    isOwnProfile,
    onProfileUpdated: options.onProfileUpdated,
  };

  root.appendChild(buildHeader(options.data, options.onAvatarClick));
  root.appendChild(buildPublicProfileBody(options.data, options.leaderboardRank, ctx));
  return root;
}
