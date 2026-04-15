// P.A.N.D.A. — Achievement badge icon registry.
//
// Each achievement owns a unique SVG glyph. When an achievement is locked but
// *visible* we render its silhouette (same path, desaturated + reduced
// opacity). When an achievement is locked and *hidden* we render the
// "mystery" glyph with a ? centered so the catalog exposes the existence of
// extra rewards without leaking their nature.

import type { AchievementId } from '../lib/gamification';

const SVG_NS = 'http://www.w3.org/2000/svg';

type BadgeSpec = {
  viewBox?: string;
  paths: Array<Record<string, string>>;
};

const VIEWBOX = '0 0 48 48';

// Shared "shield" backdrop used by every achievement badge so silhouettes
// read as a consistent family.
function shieldBackdrop(): Array<Record<string, string>> {
  return [
    { tag: 'path', d: 'M24 4 8 10v14c0 8.5 6.8 16 16 20 9.2-4 16-11.5 16-20V10Z', fill: 'var(--badge-bg)', stroke: 'var(--badge-border)', 'stroke-width': '1.6' },
  ];
}

// Minimal unique-glyph specs per achievement. We keep each small enough to
// register inline; design iteration is a future task. The key insight is that
// every id resolves to *some* spec so the wall renders without gaps.
const BADGES: Record<AchievementId, BadgeSpec> = {
  first_patrol: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 32l6-14 6 14M22 27h4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  login_streak_1: { paths: [...shieldBackdrop(), { tag: 'rect', x: '16', y: '16', width: '16', height: '16', rx: '3', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M18 14v4M30 14v4M16 22h16', stroke: 'currentColor', 'stroke-width': '2' }] },
  challenge_apprentice: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }] },
  mission_apprentice: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 20l8-6 8 6v10l-8 6-8-6z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M20 26l3 3 5-6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },

  first_upvote_received: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 30l6-14 6 14', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M18 30h12', stroke: 'currentColor', 'stroke-width': '2' }] },
  rising_signal: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 32l4-6 5 3 5-9 6 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  upvote_wave: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M12 28c3-3 5-3 8 0s5 3 8 0 5-3 8 0', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M12 22c3-3 5-3 8 0s5 3 8 0 5-3 8 0', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  profile_spotlight: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M12 24a12 7 0 0 1 24 0a12 7 0 0 1-24 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  popular_stalker: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v12M18 20l6 6 6-6M16 32h16', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  community_favorite: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l2.5 6 6 .5-4.5 4 1.5 6L24 27l-5.5 3 1.5-6-4.5-4 6-.5z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor' }] },
  crowd_pleaser: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 14l2 6 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z', transform: 'translate(6,0)', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor' }] },

  first_publish: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 16h10l6 6v10H16z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M26 16v6h6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  branching_out: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v6M24 20l-6 6M24 20l6 6M18 26v6M30 26v6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  story_weaver: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 18c4 4 10 4 14 0M14 24c4 4 10 4 14 0M14 30c4 4 10 4 14 0M32 18c2 4 2 8 0 12', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  cartographer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 16l6 2 8-2 6 2v14l-6-2-8 2-6-2z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M20 18v14M28 16v14', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }] },
  web_of_lies: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v20M14 24h20M16 16l16 16M32 16 16 32', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }, { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }] },
  new_faction_scout: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M24 16v16M16 24h16', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }] },
  faction_diplomat: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 26c0-4 3-6 6-6s6 2 6 6M16 34c2-4 5-6 8-6s6 2 8 6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '24', cy: '17', r: '3', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  zone_encyclopedist: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14h12a4 4 0 0 1 4 4v16H20a4 4 0 0 1-4-4z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M16 30h16', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  flow_restorer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 24a8 8 0 0 1 14-5M32 24a8 8 0 0 1-14 5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M30 14v5h-5M18 34v-5h5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  uncommon_operator: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '22', r: '6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M18 34h12M22 28v6M26 28v6', stroke: 'currentColor', 'stroke-width': '2' }] },

  outcome_engineer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M22 14h4l1 4 3 2 4-1 2 4-3 3 1 4-4 2-3-3-4 1-2-4 3-3-1-4 2-2z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' }] },
  branch_architect: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v4M24 18l-8 6M24 18l8 6M16 24v8M32 24v8M20 32h8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  precondition_master: { paths: [...shieldBackdrop(), { tag: 'rect', x: '18', y: '22', width: '12', height: '10', rx: '1.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M20 22v-4a4 4 0 0 1 8 0v4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  precondition_tactician: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M24 16v8l5 3', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  quality_crafter: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l4 6 6 2-4 4 1 6-7-3-7 3 1-6-4-4 6-2z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor' }] },
  systems_polymath: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '20', cy: '20', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '28', cy: '28', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M22 22l6 6', stroke: 'currentColor', 'stroke-width': '2' }] },
  clean_publish_streak: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 24l6 6 14-14', stroke: 'currentColor', 'stroke-width': '3', fill: 'none' }] },
  four_star_streak: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 30l2-4 3 2 4-6 4 2 3-4 4 2', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  prolific_writer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 32l10-14 6 4-10 14z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M26 18l4-4 4 4-4 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  zone_veteran: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor' }] },
  streak_3: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14c2 4 6 6 6 12s-4 8-6 8-6-2-6-8 4-8 6-12z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  streak_10: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 12c3 5 8 7 8 15s-5 11-8 11-8-3-8-11 5-10 8-15z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }] },

  bronze_complete: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '9', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'text', x: '24', y: '29', 'text-anchor': 'middle', 'font-size': '11', 'font-weight': 'bold', fill: 'currentColor' }] },
  onboarding_complete: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 22h16v10H16zM24 22V16', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  silver_complete: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '9', stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none' }] },
  faction_complete: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '16', width: '20', height: '16', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M14 22h20M22 16v16', stroke: 'currentColor', 'stroke-width': '1.4' }] },

  night_shift: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M30 14a10 10 0 1 0 4 20 10 10 0 0 1-4-20z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.25' }] },
  zone_whisperer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 20c0-4 3-6 8-6s8 2 8 6v10c-2 2-5 2-8 0-3 2-6 2-8 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '20', cy: '22', r: '1.5', fill: 'currentColor' }, { tag: 'circle', cx: '28', cy: '22', r: '1.5', fill: 'currentColor' }] },

  callsign_chosen: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '18', width: '20', height: '12', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M18 22h12M18 26h8', stroke: 'currentColor', 'stroke-width': '2' }] },
  login_streak_7: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M28 14h-8v8h8l6 8-6 8h-8v-8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  login_streak_30: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 34h20l-2-16-8-6-8 6z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M22 34v-8h4v8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  weekend_warrior: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 24c0-6 4-10 8-10s8 4 8 10M16 24h16M20 32l4-4 4 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  dawn_patrol: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 28h20M24 14a10 10 0 0 1 10 10H14a10 10 0 0 1 10-10z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  iron_scribe: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 30l12-14 4 4-12 14zM26 16l4 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },

  commentator: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 18a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-8l-6 4v-4a4 4 0 0 1-2-3.5z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  library_patron: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14h8v20h-8zM24 14h8v20h-8z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  first_friend: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '20', cy: '22', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '28', cy: '22', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M14 34c0-4 3-6 6-6h8c3 0 6 2 6 6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  download_centurion: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 12v16M18 22l6 6 6-6M14 34h20', stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none' }] },
  download_legion: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M20 12v14M24 12v14M28 12v14M14 26l10 10 10-10M12 36h24', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  upvote_legend: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 32l10-20 10 20z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.25' }, { tag: 'path', d: 'M14 32l10-20 10 20z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },

  artifact_hunter: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l8 8-8 12-8-12z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'path', d: 'M16 22h16', stroke: 'currentColor', 'stroke-width': '2' }] },
  mutant_mythographer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 22c2-6 14-6 16 0v8c0 2-2 4-4 4l-2-4-4 4-4-4c-2 0-4-2-4-4z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '20', cy: '24', r: '1.5', fill: 'currentColor' }, { tag: 'circle', cx: '28', cy: '24', r: '1.5', fill: 'currentColor' }] },
  zone_lorekeeper: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 16h16v16H16z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M20 16v16M28 16v16M16 20h16M16 28h16', stroke: 'currentColor', 'stroke-width': '1.2' }] },

  gold_circuit: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '9', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.3' }, { tag: 'path', d: 'M24 16v4M24 28v4M16 24h4M28 24h4', stroke: 'currentColor', 'stroke-width': '2' }] },
  hidden_circuit: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 24a10 8 0 0 1 20 0 10 8 0 0 1-20 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '24', cy: '24', r: '3', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor' }] },
  chaos_director: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l10 6-4 12h-12l-4-12z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M18 20l12 8M30 20l-12 8', stroke: 'currentColor', 'stroke-width': '1.4' }] },
  ironclad_finish: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14h16v20a4 4 0 0 1-8 0 4 4 0 0 1-8 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M20 20h8M20 26h8', stroke: 'currentColor', 'stroke-width': '2' }] },
  speedrunner: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '10', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M24 16v8l6 4', stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none' }] },
};

const MYSTERY_BADGE: BadgeSpec = {
  paths: [
    ...shieldBackdrop(),
    { tag: 'text', x: '24', y: '30', 'text-anchor': 'middle', 'font-size': '18', 'font-weight': 'bold', fill: 'currentColor' },
  ],
};

/** Display state for a badge rendering. */
export type BadgeState = 'unlocked' | 'locked-visible' | 'locked-hidden';

/**
 * Look up the SVG badge spec for an achievement id. Returns undefined for
 * unknown ids — callers should fall back to the mystery glyph.
 */
export function getBadgeSpec(id: AchievementId): BadgeSpec | undefined {
  return BADGES[id];
}

/**
 * Build an SVG badge element for an achievement. Honors the requested state
 * — unlocked badges render with full color, visible-locked badges render
 * as silhouettes, and hidden-locked badges render as the mystery glyph.
 */
export function createAchievementBadge(id: AchievementId | null, state: BadgeState, size = 48): SVGSVGElement {
  const spec = state === 'locked-hidden' || !id
    ? MYSTERY_BADGE
    : (BADGES[id] ?? MYSTERY_BADGE);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', spec.viewBox ?? VIEWBOX);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('panda-badge-icon');
  svg.dataset.state = state;
  if (id) svg.dataset.achievement = id;

  for (const p of spec.paths) {
    const { tag, ...attrs } = p;
    const element = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
    if (tag === 'text' && state === 'locked-hidden') {
      element.textContent = '?';
    } else if (tag === 'text' && id === 'bronze_complete') {
      element.textContent = 'III';
    }
    svg.appendChild(element);
  }

  return svg;
}

/**
 * Build a reusable CSS string injection for the badge wall. Hosts that
 * already include a stylesheet can skip this and style via CSS variables:
 *   --badge-bg, --badge-border, --badge-muted
 * Locked-visible silhouettes rely on opacity + saturate filters.
 */
export const ACHIEVEMENT_BADGE_CSS = `
.panda-badge-icon { display: block; color: var(--badge-color, currentColor); }
.panda-badge-icon[data-state='locked-visible'] { opacity: 0.35; filter: grayscale(1); }
.panda-badge-icon[data-state='locked-hidden'] { opacity: 0.45; filter: grayscale(1) blur(0.2px); }
`;
