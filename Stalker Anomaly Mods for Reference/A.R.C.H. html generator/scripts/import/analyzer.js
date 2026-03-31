// ═══════════════════════════════════════════
// PACK ANALYZER — Probability Engine + UI
// ═══════════════════════════════════════════
// Simulates the ARCH selection pipeline across all community × location × rank
// combinations. Reports per-archetype probability and flags issues.

// ── Tier cap defaults (mirrors archetype_core.script TIER_CAP_DEFAULTS) ──
const ANALYZER_TIER_CAP_DEFAULTS = [
    null, // index 0 unused (tiers are 1-5)
    { max_level: 0,  max_faction: 0 },
    { max_level: 0,  max_faction: 0 },
    { max_level: 0,  max_faction: 0 },
    { max_level: 0,  max_faction: 0 },
    { max_level: 0,  max_faction: 0 },
];

const TIER_NAMES = [null, 'Highest', 'High', 'Normal', 'Low', 'Lowest'];

// ── Pool building ────────────────────────────────────────────────────────────

/**
 * Collect archetypes from the editor (groups + soloChars).
 * Returns array of {id, settings} objects in analyzer format.
 */
function analyzerCollectEditorArchetypes() {
    const result = [];
    // Group characters
    (groups || []).forEach(g => {
        if (!g || !g.chars) return;
        const gd = (g.defaults && g.defaults.settings) || {};
        g.chars.forEach(ch => {
            if (!ch || !ch.archId) return;
            const merged = Object.assign({}, dc(DEFAULT_SETTINGS), dc(gd), dc((ch.ov && ch.ov.settings) || {}));
            result.push({ id: ch.archId, settings: merged, source: 'editor', pack: g.name || 'unnamed' });
        });
    });
    // Solo characters
    (soloChars || []).forEach(ch => {
        if (!ch || !ch.archId) return;
        const merged = Object.assign({}, dc(DEFAULT_SETTINGS), dc((ch.ov && ch.ov.settings) || {}));
        result.push({ id: ch.archId, settings: merged, source: 'editor', pack: 'solo' });
    });
    return result;
}

/**
 * Parse an LTX text blob into analyzer archetype entries.
 * Reuses parseRuntimeArchetypesLtxToChars from mo2_scanner.js.
 */
function analyzerParseLtx(ltxText, packName) {
    const chars = parseRuntimeArchetypesLtxToChars(ltxText);
    return (chars || []).map(ch => ({
        id: ch.archId,
        settings: Object.assign({}, dc(DEFAULT_SETTINGS), dc(ch.ov && ch.ov.settings || {})),
        source: 'file',
        pack: packName || 'unknown'
    }));
}

// ── Filter matching ──────────────────────────────────────────────────────────

function analyzerMatchesFilter(mode, vals, value) {
    if (!vals || !vals.length) return true; // no filter = matches all
    const has = vals.map(v => String(v).toLowerCase()).includes(String(value).toLowerCase());
    return mode === 'inc' ? has : !has;
}

function analyzerArchetypeMatchesCombo(s, community, location, rank) {
    if (s.enabled === false) return false;
    if (!analyzerMatchesFilter(s.commMode, s.commVals, community)) return false;
    if (!analyzerMatchesFilter(s.locMode, s.locVals, location)) return false;
    if (!analyzerMatchesFilter(s.rankMode, s.rankVals, rank)) return false;
    return true;
}

// ── Probability engine ───────────────────────────────────────────────────────

/**
 * Run the full analysis.
 * @param {Array} pool - [{id, settings, source, pack}, ...]
 * @param {Object} options - {tierCaps, gameDays, includeDisabled}
 * @returns {Object} analysis results
 */
function analyzerRun(pool, options) {
    const opts = options || {};
    const gameDays = typeof opts.gameDays === 'number' ? opts.gameDays : 0;
    const tierCaps = opts.tierCaps || ANALYZER_TIER_CAP_DEFAULTS;

    const communities = COMM.map(c => c[0]);
    const locations = LOCS.map(l => l[0]);
    const ranks = RANKS_D.map(r => r[0]);

    // Pre-process pool: normalize settings
    const entries = pool.filter(e => e.settings.enabled !== false).map(e => {
        const s = e.settings;
        return {
            id: e.id,
            pack: e.pack,
            source: e.source,
            tier: Math.max(1, Math.min(5, parseInt(s.tier, 10) || 3)),
            chance: Math.max(1, parseInt(s.chance, 10) || 100),
            amount: parseInt(s.amount, 10) || 0,
            availableAfterDays: parseInt(s.availableAfterDays, 10) || 0,
            commMode: s.commMode || 'inc',
            commVals: Array.isArray(s.commVals) ? s.commVals : [],
            locMode: s.locMode || 'inc',
            locVals: Array.isArray(s.locVals) ? s.locVals : [],
            rankMode: s.rankMode || 'inc',
            rankVals: Array.isArray(s.rankVals) ? s.rankVals : [],
            enabled: s.enabled !== false,
            settings: s
        };
    });

    // Per-archetype results
    const archResults = {};
    entries.forEach(e => {
        archResults[e.id] = {
            id: e.id,
            pack: e.pack,
            source: e.source,
            tier: e.tier,
            chance: e.chance,
            amount: e.amount,
            availableAfterDays: e.availableAfterDays,
            matchedCombos: 0,
            eligibleCombos: 0,
            totalCombos: 0,
            winProbSum: 0,
            blockedByCalendar: false,
            tierCompetitors: {},  // tier → count of competitors in that tier for eligible combos
            issues: [],
            comboDetails: []     // [{community, location, rank, probability, competitors, tier}]
        };
    });

    const totalCombos = communities.length * locations.length * ranks.length;

    // For each combo, simulate the pipeline
    communities.forEach(community => {
        locations.forEach(location => {
            ranks.forEach(rank => {
                // 1. Filter pass: find all archetypes matching this combo
                const candidates = [];
                entries.forEach(e => {
                    const r = archResults[e.id];
                    r.totalCombos = totalCombos;

                    // Calendar gate
                    if (e.availableAfterDays > 0 && gameDays < e.availableAfterDays) {
                        r.blockedByCalendar = true;
                        return;
                    }

                    // Filter match
                    if (!analyzerMatchesFilter(e.commMode, e.commVals, community)) return;
                    if (!analyzerMatchesFilter(e.locMode, e.locVals, location)) return;
                    if (!analyzerMatchesFilter(e.rankMode, e.rankVals, rank)) return;

                    archResults[e.id].matchedCombos++;
                    candidates.push(e);
                });

                // 2. Group by tier
                const tierBuckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
                candidates.forEach(e => {
                    tierBuckets[e.tier].push(e);
                });

                // 3. Select highest (lowest number) non-empty tier
                let selectedTier = 0;
                for (let t = 1; t <= 5; t++) {
                    if (tierBuckets[t].length > 0) {
                        selectedTier = t;
                        break;
                    }
                }

                if (selectedTier === 0) return; // no candidates

                const bucket = tierBuckets[selectedTier];
                const totalChance = bucket.reduce((sum, e) => sum + e.chance, 0);

                // 4. Calculate win probability for each in the winning tier
                bucket.forEach(e => {
                    const r = archResults[e.id];
                    r.eligibleCombos++;
                    const prob = totalChance > 0 ? e.chance / totalChance : 0;
                    r.winProbSum += prob;
                    r.comboDetails.push({
                        community, location, rank,
                        probability: prob,
                        competitors: bucket.length - 1,
                        selectedTier
                    });
                });

                // Track competitors who were eligible but in a lower tier (overshadowed)
                candidates.forEach(e => {
                    if (e.tier > selectedTier) {
                        const r = archResults[e.id];
                        if (!r.tierCompetitors[selectedTier]) r.tierCompetitors[selectedTier] = 0;
                        r.tierCompetitors[selectedTier]++;
                        // This archetype is overshadowed in this combo
                        r.comboDetails.push({
                            community, location, rank,
                            probability: 0,
                            competitors: bucket.length,
                            selectedTier: selectedTier,
                            overshadowed: true,
                            ownTier: e.tier
                        });
                    }
                });
            });
        });
    });

    // ── Monte Carlo pass ─────────────────────────────────────────────────────

    const mcTrials = 50;
    const mcResults = analyzerRunMonteCarlo(entries, communities, locations, ranks, gameDays, mcTrials);
    entries.forEach(e => {
        const r = archResults[e.id];
        const mc = mcResults[e.id];
        r.mcAvgAssigned = mc.avgAssigned;
        r.mcMinAssigned = mc.minAssigned;
        r.mcMaxAssigned = mc.maxAssigned;
        r.mcAssignmentRate = mc.assignmentRate;
        r.mcDepletionRate = mc.depletionRate;
    });

    // ── Issue detection ──────────────────────────────────────────────────────

    Object.values(archResults).forEach(r => {
        const avgProb = r.eligibleCombos > 0 ? r.winProbSum / r.eligibleCombos : 0;
        r.avgProbability = avgProb;
        r.overallProbability = r.totalCombos > 0 ? r.winProbSum / r.totalCombos : 0;

        // Count overshadowed combos
        const overshadowedCombos = r.comboDetails.filter(d => d.overshadowed).length;
        r.overshadowedCombos = overshadowedCombos;

        if (r.matchedCombos === 0 && !r.blockedByCalendar) {
            r.issues.push({ severity: 'error', type: 'no_eligible', msg: 'No eligible NPC combinations — filters match nothing' });
        } else if (r.matchedCombos === 0 && r.blockedByCalendar) {
            r.issues.push({ severity: 'info', type: 'calendar_blocked', msg: `Blocked by calendar gate (needs day ${r.availableAfterDays}, current: ${gameDays})` });
        }

        if (r.matchedCombos > 0 && r.eligibleCombos === 0) {
            if (r.mcAvgAssigned > 0) {
                r.issues.push({ severity: 'info', type: 'depletion_beneficiary', msg: `Overshadowed in static analysis but gains ~${r.mcAvgAssigned.toFixed(1)} assignments/run after higher-tier depletion` });
            } else {
                r.issues.push({ severity: 'error', type: 'zero_probability', msg: `Always overshadowed by higher-tier archetypes — matches ${r.matchedCombos} combos but never selected (even with depletion)` });
            }
        } else if (r.eligibleCombos > 0 && avgProb < 0.05 && avgProb > 0) {
            r.issues.push({ severity: 'warning', type: 'very_low', msg: `Very low average probability (${(avgProb * 100).toFixed(1)}%) across selectable combos` });
        }

        if (overshadowedCombos > 0 && r.eligibleCombos > 0) {
            const pct = ((overshadowedCombos / r.matchedCombos) * 100).toFixed(0);
            r.issues.push({ severity: 'info', type: 'partial_shadow', msg: `Overshadowed in ${pct}% of matching combos by higher-tier archetypes` });
        }

        if (r.eligibleCombos > 0 && avgProb >= 0.99) {
            r.issues.push({ severity: 'ok', type: 'sole_candidate', msg: 'Sole candidate — always assigned when eligible' });
        } else if (r.eligibleCombos > 0 && avgProb >= 0.2 && avgProb <= 0.8) {
            r.issues.push({ severity: 'ok', type: 'balanced', msg: `Balanced probability (${(avgProb * 100).toFixed(1)}%)` });
        }

        // Tier cap warning (static estimate)
        const cap = tierCaps[r.tier];
        if (cap && r.matchedCombos > 0) {
            const sameTierCount = entries.filter(e => e.tier === r.tier).length;
            if (cap.max_level > 0 && sameTierCount > cap.max_level) {
                r.issues.push({ severity: 'warning', type: 'tier_cap_risk',
                    msg: `${sameTierCount} archetypes at tier ${r.tier} — MCM cap is ${cap.max_level}/level, some may be blocked` });
            }
        }

        // Monte Carlo: amount saturation
        if (r.amount > 0 && r.mcDepletionRate > 0.8) {
            r.issues.push({ severity: 'info', type: 'amount_saturated',
                msg: `Amount cap (${r.amount}) reached in ${(r.mcDepletionRate * 100).toFixed(0)}% of simulations — excess demand goes to other archetypes` });
        }
    });

    // Sort results: errors first, then warnings, then info, then ok
    const severityOrder = { error: 0, warning: 1, info: 2, ok: 3 };
    const sorted = Object.values(archResults).sort((a, b) => {
        const aMax = Math.min(...a.issues.map(i => severityOrder[i.severity] ?? 4), 4);
        const bMax = Math.min(...b.issues.map(i => severityOrder[i.severity] ?? 4), 4);
        if (aMax !== bMax) return aMax - bMax;
        return a.id.localeCompare(b.id);
    });

    return {
        pool: entries,
        results: sorted,
        totalCombos,
        communityCount: communities.length,
        locationCount: locations.length,
        rankCount: ranks.length,
        gameDays,
        tierCaps,
        mcTrials
    };
}

// ── Monte Carlo simulation (amount depletion) ───────────────────────────────

/**
 * Run Monte Carlo simulation to account for amount depletion.
 * Simulates N trials of random NPC assignment order, tracking how
 * archetypes fill their amount cap and get removed from the pool.
 *
 * @param {Array} entries - normalized archetype entries from analyzerRun
 * @param {Array} communities - community IDs
 * @param {Array} locations - location IDs
 * @param {Array} ranks - rank IDs
 * @param {number} gameDays - current game day for calendar gate
 * @param {number} nTrials - number of simulation runs (default 50)
 * @returns {Object} per-archetype MC results keyed by ID
 */
function analyzerRunMonteCarlo(entries, communities, locations, ranks, gameDays, nTrials) {
    nTrials = nTrials || 50;
    const nEntries = entries.length;

    // Build NPC combo list
    const npcs = [];
    communities.forEach(c => locations.forEach(l => ranks.forEach(r => {
        npcs.push({ community: c, location: l, rank: r });
    })));
    const nNpcs = npcs.length;

    // Pre-compute: for each NPC, which entry indices match (filter + calendar + amount>0)
    const npcCandidates = [];
    for (let n = 0; n < nNpcs; n++) {
        const npc = npcs[n];
        const matching = [];
        for (let i = 0; i < nEntries; i++) {
            const e = entries[i];
            if (e.amount <= 0) continue;
            if (e.availableAfterDays > 0 && gameDays < e.availableAfterDays) continue;
            if (!analyzerArchetypeMatchesCombo(e, npc.community, npc.location, npc.rank)) continue;
            matching.push(i);
        }
        npcCandidates.push(matching);
    }

    // Accumulators (typed arrays for speed)
    const totalAssigned = new Float64Array(nEntries);
    const trialsActive = new Int32Array(nEntries);
    const maxArr = new Int32Array(nEntries);
    const minArr = new Int32Array(nEntries);
    const depletedArr = new Int32Array(nEntries);
    for (let i = 0; i < nEntries; i++) minArr[i] = nNpcs + 1;

    const order = new Int32Array(nNpcs);
    for (let i = 0; i < nNpcs; i++) order[i] = i;

    const remaining = new Int32Array(nEntries);
    const trialCount = new Int32Array(nEntries);
    const bucketBuf = [];

    for (let trial = 0; trial < nTrials; trial++) {
        // Fisher-Yates shuffle
        for (let i = nNpcs - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
        }

        // Reset
        for (let i = 0; i < nEntries; i++) {
            remaining[i] = entries[i].amount;
            trialCount[i] = 0;
        }

        // Process NPCs in shuffled order
        for (let ni = 0; ni < nNpcs; ni++) {
            const candidates = npcCandidates[order[ni]];
            const cn = candidates.length;
            if (!cn) continue;

            // Find highest (lowest number) non-empty tier among available candidates
            let bestTier = 6;
            for (let ci = 0; ci < cn; ci++) {
                const eIdx = candidates[ci];
                if (remaining[eIdx] > 0 && entries[eIdx].tier < bestTier) {
                    bestTier = entries[eIdx].tier;
                }
            }
            if (bestTier > 5) continue;

            // Build bucket for winning tier + compute total chance
            let bLen = 0;
            let totalChance = 0;
            for (let ci = 0; ci < cn; ci++) {
                const eIdx = candidates[ci];
                if (remaining[eIdx] > 0 && entries[eIdx].tier === bestTier) {
                    bucketBuf[bLen++] = eIdx;
                    totalChance += entries[eIdx].chance;
                }
            }
            if (!bLen) continue;

            // Weighted random pick
            let roll = Math.random() * totalChance;
            let picked = bucketBuf[bLen - 1];
            for (let bi = 0; bi < bLen; bi++) {
                roll -= entries[bucketBuf[bi]].chance;
                if (roll <= 0) { picked = bucketBuf[bi]; break; }
            }

            remaining[picked]--;
            trialCount[picked]++;
        }

        // Accumulate
        for (let i = 0; i < nEntries; i++) {
            const c = trialCount[i];
            totalAssigned[i] += c;
            if (c > 0) trialsActive[i]++;
            if (c > maxArr[i]) maxArr[i] = c;
            if (c < minArr[i]) minArr[i] = c;
            if (entries[i].amount > 0 && c >= entries[i].amount) depletedArr[i]++;
        }
    }

    // Build results
    const mc = {};
    for (let i = 0; i < nEntries; i++) {
        mc[entries[i].id] = {
            avgAssigned: totalAssigned[i] / nTrials,
            minAssigned: minArr[i] > nNpcs ? 0 : minArr[i],
            maxAssigned: maxArr[i],
            assignmentRate: trialsActive[i] / nTrials,
            depletionRate: entries[i].amount > 0 ? depletedArr[i] / nTrials : 0,
        };
    }
    return mc;
}

// ── Report rendering ─────────────────────────────────────────────────────────

const SEVERITY_ICONS = { error: '🔴', warning: '🟡', info: '🔵', ok: '🟢' };
const SEVERITY_COLORS = { error: '#ff4444', warning: '#ffaa00', info: '#4488ff', ok: '#44cc44' };

function analyzerRenderReport(analysis, containerEl) {
    const el = containerEl;
    el.innerHTML = '';

    if (!analysis || !analysis.results || !analysis.results.length) {
        el.innerHTML = '<div style="color:#888;padding:20px;text-align:center">No archetypes in pool. Add sources and run analysis.</div>';
        return;
    }

    // Summary bar
    const errorCount = analysis.results.filter(r => r.issues.some(i => i.severity === 'error')).length;
    const warnCount = analysis.results.filter(r => r.issues.some(i => i.severity === 'warning')).length;
    const okCount = analysis.results.filter(r => !r.issues.some(i => i.severity === 'error' || i.severity === 'warning')).length;

    const summary = document.createElement('div');
    summary.style.cssText = 'display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #333;margin-bottom:12px;font-size:13px;flex-wrap:wrap';
    summary.innerHTML =
        `<span style="color:#ccc"><b>${analysis.results.length}</b> archetypes analyzed</span>` +
        `<span style="color:#ccc">${analysis.communityCount}×${analysis.locationCount}×${analysis.rankCount} = <b>${analysis.totalCombos}</b> combos</span>` +
        `<span style="color:#ccc">Game day: <b>${analysis.gameDays}</b></span>` +
        `<span style="color:#ccc">MC: <b>${analysis.mcTrials || 0}</b> trials</span>` +
        (errorCount > 0 ? `<span style="color:${SEVERITY_COLORS.error}">${SEVERITY_ICONS.error} ${errorCount} error${errorCount > 1 ? 's' : ''}</span>` : '') +
        (warnCount > 0 ? `<span style="color:${SEVERITY_COLORS.warning}">${SEVERITY_ICONS.warning} ${warnCount} warning${warnCount > 1 ? 's' : ''}</span>` : '') +
        `<span style="color:${SEVERITY_COLORS.ok}">${SEVERITY_ICONS.ok} ${okCount} ok</span>`;
    el.appendChild(summary);

    // Per-archetype cards
    analysis.results.forEach(r => {
        const card = document.createElement('details');
        card.className = 'az-card';
        const worstSev = r.issues.length > 0 ? r.issues[0].severity : 'ok';
        const borderColor = SEVERITY_COLORS[worstSev] || '#333';

        const matchPct = r.totalCombos > 0 ? ((r.matchedCombos / r.totalCombos) * 100).toFixed(1) : '0.0';
        const selectPct = r.totalCombos > 0 ? ((r.eligibleCombos / r.totalCombos) * 100).toFixed(1) : '0.0';
        const avgProbPct = (r.avgProbability * 100).toFixed(1);

        card.innerHTML =
            `<summary class="az-card-header" style="border-left:3px solid ${borderColor}">` +
                `<span class="az-card-id">${esc(r.id)}</span>` +
                `<span class="az-card-meta">` +
                    `<span class="az-tag">T${r.tier}</span>` +
                    `<span class="az-tag">C${r.chance}</span>` +
                    `<span class="az-tag">A${r.amount}</span>` +
                    `<span class="az-tag">${matchPct}% eligible</span>` +
                    `<span class="az-tag">~${r.mcAvgAssigned.toFixed(1)}/${r.amount} assigned</span>` +
                    `<span class="az-tag az-tag-src">${esc(r.pack)}</span>` +
                `</span>` +
            `</summary>` +
            `<div class="az-card-body">` +
                `<div class="az-issues">${r.issues.map(i =>
                    `<div class="az-issue" style="color:${SEVERITY_COLORS[i.severity]}">${SEVERITY_ICONS[i.severity]} ${esc(i.msg)}</div>`
                ).join('')}</div>` +
                analyzerRenderComboSummary(r) +
            `</div>`;
        el.appendChild(card);
    });
}

function analyzerRenderComboSummary(r) {
    if (!r.comboDetails || !r.comboDetails.length) return '<div style="color:#666;font-size:11px;padding:8px 0">No eligible combinations.</div>';

    // Aggregate by community
    const byCommunity = {};
    r.comboDetails.forEach(d => {
        if (!byCommunity[d.community]) byCommunity[d.community] = { wins: 0, shadows: 0, total: 0, probSum: 0 };
        byCommunity[d.community].total++;
        if (d.overshadowed) {
            byCommunity[d.community].shadows++;
        } else {
            byCommunity[d.community].wins++;
            byCommunity[d.community].probSum += d.probability;
        }
    });

    // Aggregate by location
    const byLocation = {};
    r.comboDetails.forEach(d => {
        if (!byLocation[d.location]) byLocation[d.location] = { wins: 0, shadows: 0, total: 0, probSum: 0 };
        byLocation[d.location].total++;
        if (d.overshadowed) {
            byLocation[d.location].shadows++;
        } else {
            byLocation[d.location].wins++;
            byLocation[d.location].probSum += d.probability;
        }
    });

    const commLabel = c => { const found = COMM.find(x => x[0] === c); return found ? found[1] : c; };
    const locLabel = l => { const found = LOCS.find(x => x[0] === l); return found ? found[1] : l; };

    let html = '<div class="az-combo-tables">';

    // Community table
    html += '<div class="az-combo-col"><div class="az-combo-title">By Faction</div><table class="az-tbl"><tr><th>Faction</th><th>Eligible</th><th>Avg Win%</th></tr>';
    Object.keys(byCommunity).sort().forEach(c => {
        const d = byCommunity[c];
        const avg = d.wins > 0 ? ((d.probSum / d.wins) * 100).toFixed(1) : '0.0';
        html += `<tr><td>${esc(commLabel(c))}</td><td>${d.wins}</td><td>${avg}%</td></tr>`;
    });
    html += '</table></div>';

    // Location table
    html += '<div class="az-combo-col"><div class="az-combo-title">By Location</div><table class="az-tbl"><tr><th>Location</th><th>Eligible</th><th>Avg Win%</th></tr>';
    Object.keys(byLocation).sort().forEach(l => {
        const d = byLocation[l];
        const avg = d.wins > 0 ? ((d.probSum / d.wins) * 100).toFixed(1) : '0.0';
        html += `<tr><td>${esc(locLabel(l))}</td><td>${d.wins}</td><td>${avg}%</td></tr>`;
    });
    html += '</table></div>';

    html += '</div>';
    return html;
}

// ── Overlay UI ───────────────────────────────────────────────────────────────

let _analyzerPool = [];
let _analyzerExternalPacks = []; // [{name, archetypes}]

function openAnalyzerOverlay() {
    _analyzerPool = [];
    _analyzerExternalPacks = [];
    const overlay = document.getElementById('analyzerOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('azIncludeEditor').checked = true;
    document.getElementById('azGameDays').value = '0';
    _analyzerResetTierCaps();
    _analyzerUpdatePoolSummary();
    document.getElementById('azReport').innerHTML = '';
    document.getElementById('azExternalList').innerHTML = '';
}

function closeAnalyzerOverlay() {
    const overlay = document.getElementById('analyzerOverlay');
    if (overlay) overlay.style.display = 'none';
}

function _analyzerResetTierCaps() {
    for (let t = 1; t <= 5; t++) {
        const def = ANALYZER_TIER_CAP_DEFAULTS[t];
        const mlEl = document.getElementById('azCapT' + t + 'L');
        const mfEl = document.getElementById('azCapT' + t + 'F');
        if (mlEl) mlEl.value = def.max_level;
        if (mfEl) mfEl.value = def.max_faction;
    }
}

function _analyzerReadTierCaps() {
    const caps = [null];
    for (let t = 1; t <= 5; t++) {
        const mlEl = document.getElementById('azCapT' + t + 'L');
        const mfEl = document.getElementById('azCapT' + t + 'F');
        caps.push({
            max_level: parseInt(mlEl ? mlEl.value : 0, 10) || 0,
            max_faction: parseInt(mfEl ? mfEl.value : 0, 10) || 0
        });
    }
    return caps;
}

function _analyzerBuildPool() {
    const pool = [];
    if (document.getElementById('azIncludeEditor').checked) {
        pool.push(...analyzerCollectEditorArchetypes());
    }
    _analyzerExternalPacks.forEach(ep => {
        pool.push(...ep.archetypes);
    });
    return pool;
}

function _analyzerUpdatePoolSummary() {
    const pool = _analyzerBuildPool();
    const editorCount = pool.filter(e => e.source === 'editor').length;
    const externalCount = pool.filter(e => e.source === 'file').length;
    const packCount = _analyzerExternalPacks.length;
    const el = document.getElementById('azPoolSummary');
    if (el) {
        const parts = [];
        if (editorCount > 0) parts.push(`${editorCount} from editor`);
        if (externalCount > 0) parts.push(`${externalCount} from ${packCount} file${packCount > 1 ? 's' : ''}`);
        el.textContent = parts.length > 0 ? `Pool: ${pool.length} archetype${pool.length !== 1 ? 's' : ''} (${parts.join(', ')})` : 'Pool is empty — add sources above.';
    }
}

function analyzerRunAndRender() {
    const pool = _analyzerBuildPool();
    if (!pool.length) {
        document.getElementById('azReport').innerHTML = '<div style="color:#888;padding:20px;text-align:center">Pool is empty. Enable editor archetypes or add external pack files.</div>';
        return;
    }
    const gameDays = parseInt(document.getElementById('azGameDays').value, 10) || 0;
    const tierCaps = _analyzerReadTierCaps();
    const analysis = analyzerRun(pool, { gameDays, tierCaps });
    analyzerRenderReport(analysis, document.getElementById('azReport'));
}

// ── External pack handling ───────────────────────────────────────────────────

function analyzerHandleLtxDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dz = document.getElementById('azDropZone');
    if (dz) dz.classList.remove('az-dz-over');
    const files = e.dataTransfer ? e.dataTransfer.files : (e.target && e.target.files);
    if (!files || !files.length) return;
    Array.from(files).forEach(file => {
        if (!file.name.endsWith('.ltx')) return;
        file.text().then(text => {
            const archetypes = analyzerParseLtx(text, file.name);
            if (archetypes.length > 0) {
                _analyzerExternalPacks.push({ name: file.name, archetypes });
                _analyzerRenderExternalList();
                _analyzerUpdatePoolSummary();
            }
        });
    });
}

function analyzerHandleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dz = document.getElementById('azDropZone');
    if (dz) dz.classList.add('az-dz-over');
}

function analyzerHandleDragLeave(e) {
    e.preventDefault();
    const dz = document.getElementById('azDropZone');
    if (dz) dz.classList.remove('az-dz-over');
}

function analyzerRemoveExternalPack(idx) {
    _analyzerExternalPacks.splice(idx, 1);
    _analyzerRenderExternalList();
    _analyzerUpdatePoolSummary();
}

function _analyzerRenderExternalList() {
    const el = document.getElementById('azExternalList');
    if (!el) return;
    if (!_analyzerExternalPacks.length) { el.innerHTML = ''; return; }
    el.innerHTML = _analyzerExternalPacks.map((ep, i) =>
        `<div class="az-ext-item"><span>${esc(ep.name)} (${ep.archetypes.length})</span><button class="az-ext-rm" onclick="analyzerRemoveExternalPack(${i})">✕</button></div>`
    ).join('');
}

// ── MO2 scan (analyze-only mode) ─────────────────────────────────────────────

function analyzerScanMO2() {
    if (window.showDirectoryPicker) {
        window.showDirectoryPicker({ mode: 'read' })
            .then(dir => _analyzerProcessMO2Dir(dir))
            .catch(e => { if (e.name !== 'AbortError') console.warn(e); });
    } else {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.webkitdirectory = true;
        inp.multiple = true;
        inp.onchange = e => _analyzerProcessMO2FileList(e.target.files);
        inp.click();
    }
}

async function _analyzerProcessMO2Dir(rootDir) {
    const statusEl = document.getElementById('azScanStatus');
    if (statusEl) statusEl.textContent = 'Scanning…';
    let found = 0;

    for await (const [modName, modEntry] of rootDir.entries()) {
        if (modEntry.kind !== 'directory') continue;
        try {
            const gamedata = await modEntry.getDirectoryHandle('gamedata');
            const configs = await gamedata.getDirectoryHandle('configs');
            const misc = await configs.getDirectoryHandle('misc');

            for await (const file of misc.values()) {
                if (file.name.startsWith('arch_pack_') && file.name.endsWith('.ltx')) {
                    const content = await (await file.getFile()).text();
                    const archetypes = analyzerParseLtx(content, `${modName}/${file.name}`);
                    if (archetypes.length > 0) {
                        // Set pack name to mod folder name
                        archetypes.forEach(a => { a.pack = modName; });
                        _analyzerExternalPacks.push({ name: `${modName}/${file.name}`, archetypes });
                        found += archetypes.length;
                    }
                }
            }
        } catch (_e) {
            continue;
        }
    }

    if (statusEl) statusEl.textContent = found > 0 ? `Found ${found} archetype(s).` : 'No ARCH packs found.';
    _analyzerRenderExternalList();
    _analyzerUpdatePoolSummary();
}

async function _analyzerProcessMO2FileList(fileList) {
    const statusEl = document.getElementById('azScanStatus');
    if (!fileList || !fileList.length) {
        if (statusEl) statusEl.textContent = 'No files selected.';
        return;
    }
    if (statusEl) statusEl.textContent = 'Scanning…';
    let found = 0;

    for (const file of fileList) {
        const parts = file.webkitRelativePath.split('/');
        const fileName = parts[parts.length - 1];
        if (!fileName.startsWith('arch_pack_') || !fileName.endsWith('.ltx')) continue;
        // Check it's under gamedata/configs/misc/
        const pathLower = file.webkitRelativePath.toLowerCase();
        if (!pathLower.includes('gamedata/configs/misc/')) continue;

        const modName = parts.length >= 2 ? parts[parts.length >= 5 ? 1 : 0] : 'unknown';
        const content = await file.text();
        const archetypes = analyzerParseLtx(content, `${modName}/${fileName}`);
        if (archetypes.length > 0) {
            archetypes.forEach(a => { a.pack = modName; });
            _analyzerExternalPacks.push({ name: `${modName}/${fileName}`, archetypes });
            found += archetypes.length;
        }
    }

    if (statusEl) statusEl.textContent = found > 0 ? `Found ${found} archetype(s).` : 'No ARCH packs found.';
    _analyzerRenderExternalList();
    _analyzerUpdatePoolSummary();
}
