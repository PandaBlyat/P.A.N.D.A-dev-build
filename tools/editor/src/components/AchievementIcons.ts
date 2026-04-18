// P.A.N.D.A. — Achievement badge icon registry.
//
// Each achievement owns a unique SVG glyph. When an achievement is locked but
// *visible* we render its silhouette (same path, desaturated + reduced
// opacity). When an achievement is locked and *hidden* we render the
// "mystery" glyph with a ? centered so the catalog exposes the existence of
// extra rewards without leaking their nature.

import type { AchievementId } from '../lib/gamification';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type BadgeSpec = {
  viewBox?: string;
  paths: Array<Record<string, string>>;
};

const VIEWBOX = '0 0 48 48';

// Upgraded shared "shield" backdrop. Uses layering to create an outer rim,
// an inner engraving, and a subtle glass-like sheen at the top, immediately
// elevating the 2D shapes to premium-looking game badges.
function shieldBackdrop(): Array<Record<string, string>> {
  return [
    // 1. Drop shadow / Outer thick edge
    { tag: 'path', d: 'M24 2.5 L5 9v14.5c0 9 7.5 17 19 21.5 11.5-4.5 19-12.5 19-21.5V9Z', fill: 'var(--badge-border)', opacity: '0.8' },
    // 2. Base Shield Shape
    { tag: 'path', d: 'M24 4 L7 10v14c0 8.5 6.8 16 17 20 10.2-4 17-11.5 17-20V10Z', fill: 'var(--badge-bg)' },
    // 3. Inner engraved outline
    { tag: 'path', d: 'M24 7.5 L10 12.5v11.5c0 6.5 5.2 12.2 14 15.5 8.8-3.3 14-9 14-15.5v-11.5Z', fill: 'none', stroke: 'var(--badge-muted, currentColor)', 'stroke-width': '1.2', opacity: '0.2' },
    // 4. Subtle top diagonal reflection/sheen
    { tag: 'path', d: 'M24 4 L7 10v14c0 1.5.2 3 .7 4.3C8.2 16 14 11 24 11s15.8 5 16.3 17.3c.5-1.3.7-2.8.7-4.3V10Z', fill: 'currentColor', opacity: '0.04' },
  ];
}

// Enriched unique-glyph specs. Core paths remain intact, but we inject
// translucent fills to enclosed geometries to give the badges "volume".
const BADGES: Record<AchievementId, BadgeSpec> = {
  first_patrol: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 32l6-14 6 14M22 27h4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }] },
  login_streak_1: { paths: [...shieldBackdrop(), { tag: 'rect', x: '16', y: '16', width: '16', height: '16', rx: '3', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M18 14v4M30 14v4M16 22h16', stroke: 'currentColor', 'stroke-width': '2' }] },
  challenge_apprentice: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '8', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }] },
  mission_apprentice: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 20l8-6 8 6v10l-8 6-8-6z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M20 26l3 3 5-6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },

  first_upvote_received: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 30l6-14 6 14', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M18 30h12', stroke: 'currentColor', 'stroke-width': '2' }] },
  rising_signal: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 32l4-6 5 3 5-9 6 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  upvote_wave: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M12 28c3-3 5-3 8 0s5 3 8 0 5-3 8 0', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M12 22c3-3 5-3 8 0s5 3 8 0 5-3 8 0', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  profile_spotlight: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'path', d: 'M12 24a12 7 0 0 1 24 0a12 7 0 0 1-24 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  popular_stalker: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v12M18 20l6 6 6-6M16 32h16', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  community_favorite: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l2.5 6 6 .5-4.5 4 1.5 6L24 27l-5.5 3 1.5-6-4.5-4 6-.5z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor', 'fill-opacity': '0.85' }] },
  crowd_pleaser: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 14l2 6 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z', transform: 'translate(6,0)', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor' }] },

  first_publish: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 16h10l6 6v10H16z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M26 16v6h6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  branching_out: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v6M24 20l-6 6M24 20l6 6M18 26v6M30 26v6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  story_weaver: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 18c4 4 10 4 14 0M14 24c4 4 10 4 14 0M14 30c4 4 10 4 14 0M32 18c2 4 2 8 0 12', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  cartographer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 16l6 2 8-2 6 2v14l-6-2-8 2-6-2z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M20 18v14M28 16v14', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }] },
  web_of_lies: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v20M14 24h20M16 16l16 16M32 16 16 32', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }, { tag: 'circle', cx: '24', cy: '24', r: '4', fill: 'currentColor' }] },
  new_faction_scout: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '8', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M24 16v16M16 24h16', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }] },
  faction_diplomat: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 26c0-4 3-6 6-6s6 2 6 6M16 34c2-4 5-6 8-6s6 2 8 6', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'circle', cx: '24', cy: '17', r: '3', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor' }] },
  zone_encyclopedist: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14h12a4 4 0 0 1 4 4v16H20a4 4 0 0 1-4-4z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M16 30h16', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  flow_restorer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 24a8 8 0 0 1 14-5M32 24a8 8 0 0 1-14 5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M30 14v5h-5M18 34v-5h5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  uncommon_operator: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '22', r: '6', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'path', d: 'M18 34h12M22 28v6M26 28v6', stroke: 'currentColor', 'stroke-width': '2' }] },

  outcome_engineer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M22 14h4l1 4 3 2 4-1 2 4-3 3 1 4-4 2-3-3-4 1-2-4 3-3-1-4 2-2z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' }] },
  branch_architect: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v4M24 18l-8 6M24 18l8 6M16 24v8M32 24v8M20 32h8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  precondition_master: { paths: [...shieldBackdrop(), { tag: 'rect', x: '18', y: '22', width: '12', height: '10', rx: '1.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M20 22v-4a4 4 0 0 1 8 0v4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  precondition_tactician: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '8', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M24 16v8l5 3', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  quality_crafter: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l4 6 6 2-4 4 1 6-7-3-7 3 1-6-4-4 6-2z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor', 'fill-opacity': '0.9' }] },
  systems_polymath: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '20', cy: '20', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'circle', cx: '28', cy: '28', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M22 22l6 6', stroke: 'currentColor', 'stroke-width': '2' }] },
  clean_publish_streak: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 24l6 6 14-14', stroke: 'currentColor', 'stroke-width': '3', fill: 'none' }] },
  four_star_streak: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 30l2-4 3 2 4-6 4 2 3-4 4 2', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  prolific_writer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 32l10-14 6 4-10 14z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M26 18l4-4 4 4-4 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  zone_veteran: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor', 'fill-opacity': '0.85' }] },
  streak_3: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14c2 4 6 6 6 12s-4 8-6 8-6-2-6-8 4-8 6-12z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }] },
  streak_10: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 12c3 5 8 7 8 15s-5 11-8 11-8-3-8-11 5-10 8-15z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.25' }] },

  bronze_complete: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '10', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'text', x: '24', y: '24', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': '12', 'font-weight': '900', 'letter-spacing': '1', fill: 'currentColor' }] },
  onboarding_complete: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 22h16v10H16zM24 22V16', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }] },
  silver_complete: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '9', stroke: 'currentColor', 'stroke-width': '2.6', fill: 'none' }] },
  faction_complete: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '16', width: '20', height: '16', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M14 22h20M22 16v16', stroke: 'currentColor', 'stroke-width': '1.4' }] },

  night_shift: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M30 14a10 10 0 1 0 4 20 10 10 0 0 1-4-20z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.3' }] },
  zone_whisperer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 20c0-4 3-6 8-6s8 2 8 6v10c-2 2-5 2-8 0-3 2-6 2-8 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'circle', cx: '20', cy: '22', r: '1.5', fill: 'currentColor' }, { tag: 'circle', cx: '28', cy: '22', r: '1.5', fill: 'currentColor' }] },

  callsign_chosen: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '18', width: '20', height: '12', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M18 22h12M18 26h8', stroke: 'currentColor', 'stroke-width': '2' }] },
  login_streak_7: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M28 14h-8v8h8l6 8-6 8h-8v-8', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }] },
  login_streak_30: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 34h20l-2-16-8-6-8 6z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M22 34v-8h4v8', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  weekend_warrior: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 24c0-6 4-10 8-10s8 4 8 10M16 24h16M20 32l4-4 4 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }] },
  dawn_patrol: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 28h20M24 14a10 10 0 0 1 10 10H14a10 10 0 0 1 10-10z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }] },
  iron_scribe: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 30l12-14 4 4-12 14zM26 16l4 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }] },

  commentator: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 18a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-8l-6 4v-4a4 4 0 0 1-2-3.5z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }] },
  library_patron: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14h8v20h-8zM24 14h8v20h-8z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }] },
  first_friend: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '20', cy: '22', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'circle', cx: '28', cy: '22', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M14 34c0-4 3-6 6-6h8c3 0 6 2 6 6', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  download_centurion: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 12v16M18 22l6 6 6-6M14 34h20', stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none' }] },
  download_legion: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M20 12v14M24 12v14M28 12v14M14 26l10 10 10-10M12 36h24', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  upvote_legend: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 32l10-20 10 20z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.25' }, { tag: 'path', d: 'M14 32l10-20 10 20z', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },

  artifact_hunter: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l8 8-8 12-8-12z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'path', d: 'M16 22h16', stroke: 'currentColor', 'stroke-width': '2' }] },
  mutant_mythographer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 22c2-6 14-6 16 0v8c0 2-2 4-4 4l-2-4-4 4-4-4c-2 0-4-2-4-4z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'circle', cx: '20', cy: '24', r: '1.5', fill: 'currentColor' }, { tag: 'circle', cx: '28', cy: '24', r: '1.5', fill: 'currentColor' }] },
  zone_lorekeeper: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 16h16v16H16z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M20 16v16M28 16v16M16 20h16M16 28h16', stroke: 'currentColor', 'stroke-width': '1.2' }] },

  gold_circuit: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '9', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.25' }, { tag: 'path', d: 'M24 16v4M24 28v4M16 24h4M28 24h4', stroke: 'currentColor', 'stroke-width': '2' }] },
  hidden_circuit: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 24a10 8 0 0 1 20 0 10 8 0 0 1-20 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'circle', cx: '24', cy: '24', r: '3', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor' }] },
  chaos_director: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l10 6-4 12h-12l-4-12z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M18 20l12 8M30 20l-12 8', stroke: 'currentColor', 'stroke-width': '1.4' }] },
  ironclad_finish: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14h16v20a4 4 0 0 1-8 0 4 4 0 0 1-8 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M20 20h8M20 26h8', stroke: 'currentColor', 'stroke-width': '2' }] },
  speedrunner: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '10', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M24 16v8l6 4', stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none' }] },

  // ─── v2 badges ─────────────────────────────────────────────────────────────
  download_titan: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 14l8 8 8-8M24 12v14', stroke: 'currentColor', 'stroke-width': '2.2', fill: 'none' }, { tag: 'path', d: 'M14 30h20', stroke: 'currentColor', 'stroke-width': '2.4' }, { tag: 'path', d: 'M14 34h20', stroke: 'currentColor', 'stroke-width': '1.4', opacity: '0.4' }] },
  zone_legend_reach: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 12l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor', 'fill-opacity': '0.9' }, { tag: 'path', d: 'M16 11l2 2M32 11l-2 2M24 9v2', stroke: 'currentColor', 'stroke-width': '1.4', opacity: '0.6' }] },
  viral_content: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }, { tag: 'circle', cx: '24', cy: '24', r: '7', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '24', cy: '24', r: '12', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none', opacity: '0.5' }] },
  first_fan: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 17c1-4 6-4 7 0 1 5-2 7-7 11-5-4-8-6-7-11 1-4 6-4 7 0z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.35' }] },

  deep_branch: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 13v4M24 17l-7 4M24 17l7 4M17 21v4M31 21v4M14 25v6M20 25v6M28 25v6M34 25v6', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'none' }] },
  max_choices: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M18 19h12M18 23h12M18 27h12M18 31h12', stroke: 'currentColor', 'stroke-width': '2' }, { tag: 'circle', cx: '15', cy: '19', r: '2', fill: 'currentColor' }, { tag: 'circle', cx: '15', cy: '23', r: '2', fill: 'currentColor' }, { tag: 'circle', cx: '15', cy: '27', r: '2', fill: 'currentColor' }, { tag: 'circle', cx: '15', cy: '31', r: '2', fill: 'currentColor' }] },
  solo_talker: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 18c0-3 3-5 8-5s8 2 8 5v5c-2 2-5 3-8 2-3 1-6 0-8-2z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M18 30l6-5 6 5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M20 22h8M20 25h5', stroke: 'currentColor', 'stroke-width': '1.4' }] },
  early_bird: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 26a10 8 0 0 1 20 0H14z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M14 26h20', stroke: 'currentColor', 'stroke-width': '2' }, { tag: 'path', d: 'M24 13v3M17 15l2 3M31 15l-2 3', stroke: 'currentColor', 'stroke-width': '2' }] },
  faction_master: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 13l4 4h4v4l4 4-4 4v4h-4l-4 4-4-4h-4v-4l-4-4 4-4v-4h4z', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'currentColor', 'fill-opacity': '0.12' }, { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }] },

  full_deck: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '17', width: '10', height: '14', rx: '2', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'rect', x: '19', y: '17', width: '10', height: '14', rx: '2', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'rect', x: '24', y: '17', width: '10', height: '14', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.8' }] },
  chain_outcomes: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '17', cy: '20', r: '3.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'circle', cx: '24', cy: '25', r: '3.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'circle', cx: '31', cy: '30', r: '3.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }, { tag: 'path', d: 'M20 22l4 3M27 27l4 3', stroke: 'currentColor', 'stroke-width': '1.8' }] },
  precondition_grandmaster: { paths: [...shieldBackdrop(), { tag: 'rect', x: '17', y: '22', width: '14', height: '12', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M19 22v-5a5 5 0 0 1 10 0v5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'circle', cx: '24', cy: '28', r: '2', fill: 'currentColor' }, { tag: 'path', d: 'M24 30v2', stroke: 'currentColor', 'stroke-width': '2' }] },
  streak_25: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 11c5 7 11 10 11 16s-5 12-11 12-11-6-11-12 6-9 11-16z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.25' }, { tag: 'path', d: 'M20 31c1-5 8-5 8 0', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }] },
  publish_marathon: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '19', r: '6', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M20 19l3 3 5-5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M18 32h12M20 26v6M28 26v6', stroke: 'currentColor', 'stroke-width': '2' }] },
  midnight_writer: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M30 13a11 11 0 1 0 5 20A11 11 0 0 1 30 13z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.35' }, { tag: 'circle', cx: '17', cy: '14', r: '1.5', fill: 'currentColor', opacity: '0.7' }, { tag: 'circle', cx: '32', cy: '12', r: '1', fill: 'currentColor', opacity: '0.5' }, { tag: 'circle', cx: '14', cy: '20', r: '1', fill: 'currentColor', opacity: '0.4' }] },
  login_streak_100: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 30h20M14 30l4-8 5 5 5-9 6 4', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M14 30l4-8 5 5 5-9 6 4V30z', stroke: 'none', fill: 'currentColor', 'fill-opacity': '0.1' }] },
  quality_run: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'currentColor', 'fill-opacity': '0.85' }, { tag: 'path', d: 'M16 32h4M20 28v4M28 28v4M28 32h4', stroke: 'currentColor', 'stroke-width': '1.8' }] },

  all_categories_complete: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '10', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M24 14v20M14 24h20M17.5 17.5l13 13M30.5 17.5l-13 13', stroke: 'currentColor', 'stroke-width': '1.4', opacity: '0.7' }, { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }] },
  full_collection: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '20', width: '20', height: '13', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.12' }, { tag: 'path', d: 'M17 16h6v4h-6zM25 16h6v4h-6z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.15' }, { tag: 'path', d: 'M19 27l3 3 7-7', stroke: 'currentColor', 'stroke-width': '2.2', fill: 'none' }] },

  // ─── v3 badges ─────────────────────────────────────────────────────────────
  long_runner: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M14 30c2-6 4-8 5-8 2 0 3 4 5 4s3-4 5-4 3 2 5 8', stroke: 'currentColor', 'stroke-width': '2.2', fill: 'none' }, { tag: 'path', d: 'M18 34h12', stroke: 'currentColor', 'stroke-width': '2' }, { tag: 'circle', cx: '24', cy: '18', r: '4', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.2' }] },
  persistence: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14v8M24 22l6 4M24 22l-6 4M24 30v4', stroke: 'currentColor', 'stroke-width': '2.2', fill: 'none' }, { tag: 'path', d: 'M18 34h12', stroke: 'currentColor', 'stroke-width': '2' }, { tag: 'circle', cx: '24', cy: '14', r: '3', fill: 'currentColor', 'fill-opacity': '0.8', stroke: 'currentColor', 'stroke-width': '1.5' }] },
  signal_relay: { paths: [...shieldBackdrop(), { tag: 'circle', cx: '24', cy: '24', r: '3', fill: 'currentColor' }, { tag: 'path', d: 'M18 18a9 9 0 0 0 0 12M30 18a9 9 0 0 1 0 12', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }, { tag: 'path', d: 'M14 14a14 14 0 0 0 0 20M34 14a14 14 0 0 1 0 20', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none', opacity: '0.5' }] },
  daily_devotee: { paths: [...shieldBackdrop(), { tag: 'rect', x: '15', y: '16', width: '18', height: '16', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M19 14v4M29 14v4M15 21h18', stroke: 'currentColor', 'stroke-width': '2' }, { tag: 'circle', cx: '24', cy: '27', r: '2.5', fill: 'currentColor' }] },
  zone_architect: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 13l10 6v8l-10 6-10-6v-8z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.12' }, { tag: 'path', d: 'M24 13v20M14 19l10 6 10-6', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' }] },
  night_owl: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M24 14c-6 0-10 4-10 10s4 10 10 10c-3-2-5-5-5-9s2-7 5-11z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.3' }, { tag: 'circle', cx: '26', cy: '14', r: '2', fill: 'currentColor', opacity: '0.7' }, { tag: 'circle', cx: '30', cy: '18', r: '1.5', fill: 'currentColor', opacity: '0.5' }, { tag: 'path', d: 'M22 28c4 4 10 2 10-4', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none' }] },
  solo_legend: { paths: [...shieldBackdrop(), { tag: 'path', d: 'M16 20a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.12' }, { tag: 'path', d: 'M20 23h8M20 26h5', stroke: 'currentColor', 'stroke-width': '1.8' }, { tag: 'path', d: 'M24 30l-4 4h8l-4-4z', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'currentColor', 'fill-opacity': '0.2' }] },
  storyteller_supreme: { paths: [...shieldBackdrop(), { tag: 'rect', x: '14', y: '17', width: '20', height: '14', rx: '2', stroke: 'currentColor', 'stroke-width': '2', fill: 'currentColor', 'fill-opacity': '0.1' }, { tag: 'path', d: 'M18 21h12M18 24h12M18 27h7', stroke: 'currentColor', 'stroke-width': '1.6' }, { tag: 'path', d: 'M24 31l3 4h-6l3-4z', stroke: 'currentColor', 'stroke-width': '1.4', fill: 'currentColor', 'fill-opacity': '0.5' }, { tag: 'path', d: 'M24 14l2 2M28 13l1 2M20 13l-1 2', stroke: 'currentColor', 'stroke-width': '1.4', opacity: '0.7' }] },
};

// Refined mystery badge to perfectly center the text using dominant-baseline
const MYSTERY_BADGE: BadgeSpec = {
  paths: [
    ...shieldBackdrop(),
    { tag: 'text', x: '24', y: '24', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': '20', 'font-family': 'system-ui, sans-serif', 'font-weight': '900', fill: 'currentColor', opacity: '0.6' },
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
    
    // --- Visual Upgrade: Auto-apply round caps to vector strokes ---
    // This simple logic addition instantly transforms rigid, boxed wireframes 
    // into soft, professional icons without needing to bloat the BADGES object.
    if (element.hasAttribute('stroke') && element.getAttribute('stroke') !== 'none') {
      if (!element.hasAttribute('stroke-linecap')) element.setAttribute('stroke-linecap', 'round');
      if (!element.hasAttribute('stroke-linejoin')) element.setAttribute('stroke-linejoin', 'round');
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
 * Build a reusable CSS string injection for the badge wall.
 * Added smooth transforms and filter drop-shadows to gamify interaction.
 */
export const ACHIEVEMENT_BADGE_CSS = `
.panda-badge-icon { 
  display: block; 
  color: var(--badge-color, currentColor); 
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease;
  overflow: visible;
}
.panda-badge-icon[data-state='unlocked'] {
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));
}
.panda-badge-icon[data-state='unlocked']:hover {
  transform: scale(1.1) translateY(-2px);
  filter: drop-shadow(0 8px 12px rgba(0,0,0,0.25)) brightness(1.1);
  z-index: 10;
}
.panda-badge-icon[data-state='locked-visible'] { 
  opacity: 0.35; 
  filter: grayscale(1) contrast(0.85); 
}
.panda-badge-icon[data-state='locked-hidden'] { 
  opacity: 0.25; 
  filter: grayscale(1) blur(1px); 
}
`;
