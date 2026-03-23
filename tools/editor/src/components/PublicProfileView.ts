import {
  type CommunityConversation,
  type PublicProfileData,
  LEVEL_THRESHOLDS,
  getNextLevelThreshold,
} from '../lib/api-client';
import {
  ACHIEVEMENTS,
  isAchievementRare,
  calculateQualityScore,
} from '../lib/gamification';
import { FACTION_DISPLAY_NAMES, type FactionId } from '../lib/types';
import { FACTION_COLORS } from '../lib/faction-colors';
import { createIcon } from './icons';

type PublicProfileViewOptions = {
  data: PublicProfileData;
  leaderboardRank?: number | null;
};

type ProfilePrestigeStat = {
  icon: Parameters<typeof createIcon>[0];
  label: string;
  value: string;
};

function getLevelTierColor(level: number): string {
  if (level >= 91) return '#c4a040';
  if (level >= 71) return '#8a5eaa';
  if (level >= 51) return '#3aaa8a';
  return '#5eaa3a';
}

function getUserInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase() || '?';
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

function buildHeader(data: PublicProfileData): HTMLElement {
  const { profile, publish_count } = data;
  const next = getNextLevelThreshold(profile.xp);
  const currentThreshold = LEVEL_THRESHOLDS.find((threshold) => threshold.level === profile.level);
  const minXp = currentThreshold?.xp ?? 0;
  const maxXp = next?.xp ?? profile.xp;
  const progress = Math.min((profile.xp - minXp) / Math.max(maxXp - minXp, 1), 1);

  const header = document.createElement('section');
  header.className = 'public-profile-hero';

  const identity = document.createElement('div');
  identity.className = 'public-profile-identity';

  const avatar = document.createElement('div');
  avatar.className = 'public-profile-avatar';
  avatar.style.setProperty('--tier-color', getLevelTierColor(profile.level));
  avatar.textContent = getUserInitial(profile.username);

  const avatarLevel = document.createElement('span');
  avatarLevel.className = 'public-profile-avatar-level';
  avatarLevel.textContent = `Lv.${profile.level}`;
  avatar.appendChild(avatarLevel);

  const copy = document.createElement('div');
  copy.className = 'public-profile-identity-copy';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'public-profile-eyebrow';
  eyebrow.textContent = 'Public stalker profile';

  const title = document.createElement('h3');
  title.className = 'public-profile-name';
  title.textContent = profile.username;

  const subtitle = document.createElement('div');
  subtitle.className = 'public-profile-title';
  subtitle.textContent = `${profile.title} · ${profile.xp.toLocaleString()} XP · ${publish_count} publishes`;

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

  const progressWrap = document.createElement('div');
  progressWrap.className = 'public-profile-progress';

  const progressMeta = document.createElement('div');
  progressMeta.className = 'public-profile-progress-meta';
  progressMeta.textContent = next
    ? `${profile.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP to ${next.title}`
    : `${profile.xp.toLocaleString()} XP · max level reached`;

  const progressTrack = document.createElement('div');
  progressTrack.className = 'public-profile-progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'public-profile-progress-fill';
  progressFill.style.width = `${Math.round(progress * 100)}%`;
  progressTrack.appendChild(progressFill);
  progressWrap.append(progressMeta, progressTrack);

  copy.append(eyebrow, title, subtitle, memberSince, spotlight, progressWrap);
  identity.append(avatar, copy);

  const stats = document.createElement('div');
  stats.className = 'public-profile-hero-stats';

  const statDefs = [
    { icon: 'trophy' as const, value: `Level ${profile.level}`, label: 'Title tier' },
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
  const section = buildSection('Prestige summary', 'trophy', 'Compact bragging rights that make leaderboard clicks worth opening.');
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
    label.textContent = item.label;
    card.append(icon, value, label);
    metrics.appendChild(card);
  });

  section.appendChild(metrics);
  return section;
}

function buildAchievementsSection(data: PublicProfileData): HTMLElement {
  const section = buildSection('Featured achievements', 'medal', 'Rarest or most visible badges unlocked by this creator.');
  const featured = getFeaturedAchievements(data);
  const badges = document.createElement('div');
  badges.className = 'public-profile-badge-grid';

  const summary = document.createElement('div');
  summary.className = 'public-profile-summary-stats';

  [
    `${getUnlockedAchievements(data).length}/${ACHIEVEMENTS.length} unlocked`,
    `${featured.length} spotlight badge${featured.length === 1 ? '' : 's'}`,
    `${getRareBadgeCount(data)} rare`,
  ].forEach((item, index) => {
    const pill = document.createElement('span');
    pill.className = 'public-profile-summary-pill';
    if (index === 2) pill.classList.add('public-profile-summary-pill-rare');
    pill.textContent = item;
    summary.appendChild(pill);
  });

  section.appendChild(summary);

  if (featured.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No featured badges visible yet.';
    section.appendChild(empty);
    return section;
  }

  featured.forEach((achievement) => {
    const card = document.createElement('article');
    card.className = `public-profile-badge-card public-profile-badge-card-${achievement.tier}`;
    const top = document.createElement('div');
    top.className = 'public-profile-badge-top';
    const icon = document.createElement('span');
    icon.className = 'public-profile-badge-icon';
    icon.textContent = achievement.icon;
    const name = document.createElement('div');
    name.className = 'public-profile-badge-name';
    name.textContent = achievement.name;
    const rarity = document.createElement('span');
    rarity.className = 'public-profile-badge-tier';
    rarity.textContent = achievement.tier;
    top.append(icon, name, rarity);
    const desc = document.createElement('p');
    desc.className = 'public-profile-badge-desc';
    desc.textContent = achievement.description;
    const meta = document.createElement('div');
    meta.className = 'public-profile-badge-meta';
    meta.textContent = `+${achievement.xp} XP · ${achievement.featured ? 'Featured' : 'Rare unlock'}`;
    card.append(top, desc, meta);
    badges.appendChild(card);
  });

  section.appendChild(badges);
  return section;
}

function buildFactionBreakdown(data: PublicProfileData): HTMLElement {
  const section = buildSection('Faction specialty breakdown', 'target', 'Where this publisher spends most of their creative energy.');
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
    empty.textContent = 'No published faction history available yet.';
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
  const section = buildSection('Streak highlights', 'flame', 'Consistency signals that hint at whether this creator is actively shipping.');
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
  const section = buildSection('Recently published', 'export', 'Browse the latest work from this stalker without leaving the leaderboard context.');
  const cards = document.createElement('div');
  cards.className = 'public-profile-recent-grid';

  const recent = data.authored_conversations.slice(0, 4);
  if (recent.length === 0) {
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
    meta.textContent = parts.join(' · ');

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
  const section = buildSection('Publishing footprint', 'clock', 'High-level context before you dive into individual conversation cards.');
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

export function renderPublicProfileView(options: PublicProfileViewOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'public-profile-view';
  root.append(
    buildHeader(options.data),
    buildPrestigeSummary(options.data, options.leaderboardRank),
    buildAchievementsSection(options.data),
    buildConversationSummarySection(options.data),
    buildRecentCards(options.data),
    buildFactionBreakdown(options.data),
    buildStreakHighlights(options.data),
  );
  return root;
}
