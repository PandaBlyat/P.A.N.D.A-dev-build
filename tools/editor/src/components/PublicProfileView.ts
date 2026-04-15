import {
  type PublicProfileData,
  deriveLevelMetadata,
  getLevelTitle,
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

type PublicProfileViewOptions = {
  data: PublicProfileData;
  leaderboardRank?: number | null;
  onAvatarClick?: (event: MouseEvent, avatar: HTMLElement) => void;
};

type ProfilePrestigeStat = {
  icon: Parameters<typeof createIcon>[0];
  label: string;
  value: string;
};

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
  return ACHIEVEMENTS
    .filter(achievement => unlocked.has(achievement.id) && (achievement.featured || isAchievementRare(achievement)))
    .sort((a, b) => {
      const tierDelta = (b.tier === 'gold' ? 3 : b.tier === 'silver' ? 2 : 1) - (a.tier === 'gold' ? 3 : a.tier === 'silver' ? 2 : 1);
      return tierDelta || b.xp - a.xp;
    })
    .slice(0, 4);
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
  }

  const identity = document.createElement('div');
  identity.className = 'public-profile-identity';

  const tierColor = getLevelTierColor(currentThreshold.level);
  let avatar: HTMLElement | null = null;
  avatar = renderAvatar(
    {
      username: profile.username,
      level: currentThreshold.level,
      fallbackColor: tierColor,
      avatar_icon: profile.avatar_icon,
      avatar_color: profile.avatar_color,
      avatar_frame: profile.avatar_frame,
      avatar_banner: profile.avatar_banner,
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

function buildAchievementsSection(data: PublicProfileData): HTMLElement {
  const section = buildSection('Badge wall', 'medal', 'Unlocked badges are highlighted. Silhouettes are visible badges not yet earned; question marks are still a mystery.');
  section.classList.add('public-profile-section-badges');
  const unlocked = new Set(getUnlockedAchievements(data));

  const catalog = getWallAchievementCatalog();
  const unlockedCount = catalog.filter(a => unlocked.has(a.id)).length;

  const summary = document.createElement('div');
  summary.className = 'public-profile-summary-stats';
  [
    `${unlockedCount}/${catalog.length} unlocked`,
    `${getRareBadgeCount(data)} rare`,
  ].forEach((item, index) => {
    const pill = document.createElement('span');
    pill.className = 'public-profile-summary-pill';
    if (index === 1) pill.classList.add('public-profile-summary-pill-rare');
    pill.textContent = item;
    summary.appendChild(pill);
  });
  section.appendChild(summary);

  const wall = document.createElement('div');
  wall.className = 'public-profile-badge-wall';

  // Unlocked first, then visible locked, then hidden mystery.
  const unlockedAchievements = catalog.filter(a => unlocked.has(a.id));
  const visibleLocked = catalog.filter(a => !unlocked.has(a.id) && !a.hidden);
  const hiddenLocked = catalog.filter(a => !unlocked.has(a.id) && a.hidden);

  for (const achievement of unlockedAchievements) {
    wall.appendChild(buildBadgeTile(achievement.id as AchievementId, achievement.name, achievement.description, 'unlocked', `${achievement.tier} · +${achievement.xp} XP`));
  }
  for (const achievement of visibleLocked) {
    wall.appendChild(buildBadgeTile(achievement.id as AchievementId, achievement.name, achievement.description, 'locked-visible', `${achievement.tier} · Locked`));
  }
  for (const _achievement of hiddenLocked) {
    wall.appendChild(buildBadgeTile(null, 'Mystery badge', 'Discover hidden challenges to unlock.', 'locked-hidden', 'Hidden'));
  }

  if (catalog.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No badges available yet.';
    section.appendChild(empty);
    return section;
  }

  section.appendChild(wall);
  return section;
}

function buildBadgeTile(
  id: AchievementId | null,
  name: string,
  description: string,
  state: 'unlocked' | 'locked-visible' | 'locked-hidden',
  meta: string,
): HTMLElement {
  const tile = document.createElement('article');
  tile.className = `public-profile-badge-tile public-profile-badge-tile-${state}`;
  if (state === 'unlocked') {
    tile.style.setProperty('--badge-accent', getAchievementAccent(id));
    tile.style.setProperty('--badge-pulse-delay', getAchievementAnimationDelay(id));
  }
  tile.setAttribute('aria-label', state === 'locked-hidden' ? 'Hidden badge, not yet unlocked' : `${name}, ${state === 'unlocked' ? 'unlocked' : 'locked'}`);
  tile.tabIndex = 0;
  tile.title = state === 'locked-hidden' ? 'Hidden badge — keep exploring.' : `${name}\n${description}`;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'public-profile-badge-icon-wrap';
  iconWrap.appendChild(createAchievementBadge(id, state, 48));

  const nameEl = document.createElement('div');
  nameEl.className = 'public-profile-badge-name';
  nameEl.textContent = state === 'locked-hidden' ? '???' : name;

  const metaEl = document.createElement('div');
  metaEl.className = 'public-profile-badge-meta';
  metaEl.textContent = meta;

  const hover = document.createElement('div');
  hover.className = 'public-profile-badge-hover';
  hover.textContent = state === 'locked-hidden'
    ? 'Unlock condition hidden.'
    : description;

  tile.append(iconWrap, nameEl, metaEl, hover);
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

    card.append(top, title, summary, meta, footer);
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

function buildPublicProfileBody(data: PublicProfileData, leaderboardRank?: number | null): HTMLElement {
  const body = document.createElement('div');
  body.className = 'public-profile-body public-profile-body-single';
  body.append(
    buildPrestigeSummary(data, leaderboardRank ?? undefined),
    buildStreakHighlights(data),
    buildConversationSummarySection(data),
    buildFactionBreakdown(data),
    buildAchievementsSection(data),
    buildRecentCards(data),
  );
  return body;
}

export function renderPublicProfileView(options: PublicProfileViewOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'public-profile-view public-profile-view-single';

  root.appendChild(buildHeader(options.data, options.onAvatarClick));
  root.appendChild(buildPublicProfileBody(options.data, options.leaderboardRank));
  return root;
}
