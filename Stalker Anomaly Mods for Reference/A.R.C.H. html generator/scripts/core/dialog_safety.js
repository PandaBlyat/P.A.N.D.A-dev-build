// ═══════════════════════════════════════════
// DIALOG SAFETY VALIDATOR
// Checks dialog trees and task definitions for crash patterns and composition hints.
// JS port of tools/validate_dialog_safety.py — keep in sync.
// ═══════════════════════════════════════════

const DialogSafety = (function(){
'use strict';

// ── Issue levels ──────────────────────────
const CRASH = 'CRASH';
const WARN  = 'WARN';
const HINT  = 'HINT';

function issue(level, code, msg, dialogId, phraseId){
    return { level, code, message: msg, dialogId: dialogId||null, phraseId: phraseId||null };
}

// ── Dialog checks ─────────────────────────

/** CRASH: <next> pointing to nonexistent phrase */
function checkDanglingNexts(dialog, issues){
    const ids = new Set(Object.keys(dialog.phrases||{}));
    for(const [pid, ph] of Object.entries(dialog.phrases||{})){
        for(const nxt of (ph.nexts||[])){
            if(!ids.has(String(nxt))){
                issues.push(issue(CRASH, 'DANGLING_NEXT',
                    `<next>${nxt}</next> points to nonexistent phrase`,
                    dialog.id, pid));
            }
        }
    }
}

/** WARN: All <next> targets have preconditions — no fallback */
function checkNoFallback(dialog, issues){
    for(const [pid, ph] of Object.entries(dialog.phrases||{})){
        const nexts = ph.nexts||[];
        if(nexts.length < 2) continue;
        let allGated = true;
        for(const nxt of nexts){
            const target = (dialog.phrases||{})[String(nxt)];
            if(!target) continue;
            const hasGate = (target.preconditions&&target.preconditions.length) ||
                            (target.hasInfo&&target.hasInfo.length) ||
                            (target.dontHasInfo&&target.dontHasInfo.length);
            if(!hasGate){ allGated = false; break; }
        }
        if(allGated){
            issues.push(issue(WARN, 'NO_FALLBACK_NEXT',
                `All ${nexts.length} <next> targets have preconditions — if all fail, CTD. Add a fallback.`,
                dialog.id, pid));
        }
    }
}

/** CRASH: <action> with parameter syntax func(param) */
function checkActionParams(dialog, issues){
    for(const [pid, ph] of Object.entries(dialog.phrases||{})){
        for(const action of (ph.actions||[])){
            if(action.includes('(')){
                issues.push(issue(CRASH, 'ACTION_WITH_PARAMS',
                    `<action>${action}</action> uses parameter syntax — engine Action() has no param parsing.`,
                    dialog.id, pid));
            }
        }
    }
}

/** WARN: Custom delivery turnin missing archetype precondition */
function checkDeliveryTurninArchetype(dialog, issues){
    const pres = dialog.preconditions||[];
    if(!pres.some(p => p.includes('arch_is_delivery_target'))) return;
    if(dialog.id === 'arch_delivery_turnin_global') return;
    const hasArchCheck = pres.some(p => p.includes('arch_is_') && !p.includes('delivery_target'));
    if(!hasArchCheck){
        issues.push(issue(WARN, 'DELIVERY_TURNIN_NO_ARCHETYPE',
            'Custom delivery turnin has arch_is_delivery_target but no arch_is_<archetype> — shows on ALL target NPCs.',
            dialog.id));
    }
}

/** WARN: Phrase has no text and no script_text but has nexts */
function checkNoText(dialog, issues){
    for(const [pid, ph] of Object.entries(dialog.phrases||{})){
        if(!ph.text && !ph.scriptText && (ph.nexts||[]).length){
            issues.push(issue(WARN, 'NO_TEXT_ROUTING',
                'Phrase has no text — routing node. Risky at NPC depth.',
                dialog.id, pid));
        }
    }
}

// ── Task checks ───────────────────────────

/** Check task definitions for missing fields */
function checkTasks(tasks, pools, issues){
    // Check pool references
    for(const [poolId, pool] of Object.entries(pools||{})){
        for(const tid of (pool.taskIds||[])){
            if(!tasks[tid]){
                issues.push(issue(CRASH, 'MISSING_TASK_SECTION',
                    `Pool '${poolId}' references task '${tid}' but task not found`));
            }
        }
    }
    for(const [tid, task] of Object.entries(tasks||{})){
        const kind = task.kind || 'fetch';
        // Missing text
        if(!task.textPrefix && !(task.summaryText && task.detailsText)){
            issues.push(issue(WARN, 'TASK_NO_TEXT',
                `Task '${tid}' has no text_prefix or summary_text+details_text — silently disabled`));
        }
        // Delivery checks
        if(kind === 'delivery'){
            if(!task.deliverItem) issues.push(issue(WARN, 'DELIVERY_NO_ITEM', `Delivery task '${tid}' has no deliver_item`));
            if(!task.deliverAmount) issues.push(issue(WARN, 'DELIVERY_NO_AMOUNT', `Delivery task '${tid}' has no deliver_amount`));
            const hasTarget = task.deliverToArchetype || task.deliverToCommunity || task.deliverToRank || task.deliverToLocation;
            if(!hasTarget) issues.push(issue(CRASH, 'DELIVERY_NO_TARGET', `Delivery task '${tid}' has no deliver_to_* filter`));
        }
        // Fetch checks
        if(kind === 'fetch'){
            if(!task.itemSection && !task.itemCategory && !task.items){
                issues.push(issue(WARN, 'FETCH_NO_ITEM', `Fetch task '${tid}' has no item_section, item_category, or items`));
            }
        }
    }
}

// ── Binding cross-references ──────────────

function checkBindingRefs(dialogs, tasks, pools, issues){
    const taskIds = new Set(Object.keys(tasks||{}));
    const poolTags = new Set();
    for(const pool of Object.values(pools||{})){
        if(pool.poolTag) poolTags.add(pool.poolTag);
    }
    const builtinTags = new Set(['default','advanced','rare','elite','special']);

    for(const dialog of Object.values(dialogs||{})){
        for(const [pid, ph] of Object.entries(dialog.phrases||{})){
            for(const action of (ph.actions||[])){
                let m = action.match(/^dialogs\.arch_accept_(.+)$/);
                if(m && !taskIds.has(m[1])){
                    issues.push(issue(CRASH, 'ACCEPT_UNKNOWN_TASK',
                        `Per-task accept references unknown task '${m[1]}'`, dialog.id, pid));
                }
                m = action.match(/^dialogs\.arch_delivery_complete_(.+)$/);
                if(m && !taskIds.has(m[1])){
                    issues.push(issue(CRASH, 'COMPLETE_UNKNOWN_TASK',
                        `Per-task complete references unknown task '${m[1]}'`, dialog.id, pid));
                }
            }
            for(const pre of (ph.preconditions||[])){
                const m = pre.match(/^dialogs\.arch_has_task_pool_(.+)$/);
                if(m && !poolTags.has(m[1]) && !builtinTags.has(m[1])){
                    issues.push(issue(WARN, 'POOL_TAG_UNKNOWN',
                        `Precondition references unknown pool tag '${m[1]}'`, dialog.id, pid));
                }
            }
        }
    }
}

// ── Pattern detection ─────────────────────

function detectPatterns(dialogs, tasks, pools, archetypes, issues){
    // Chain detection
    const deps = {};
    const childrenOf = {};
    for(const [tid, task] of Object.entries(tasks||{})){
        if(task.requiresTaskDone){
            deps[tid] = task.requiresTaskDone;
            if(!childrenOf[task.requiresTaskDone]) childrenOf[task.requiresTaskDone] = [];
            childrenOf[task.requiresTaskDone].push(tid);
        }
    }
    const roots = new Set();
    for(const req of Object.values(deps)){
        if(!deps[req]) roots.add(req);
    }
    for(const root of [...roots].sort()){
        const chain = [root];
        let current = root;
        let reported = false;
        while(childrenOf[current]){
            const nexts = childrenOf[current];
            if(nexts.length === 1){
                chain.push(nexts[0]);
                current = nexts[0];
            } else {
                issues.push(issue(HINT, 'CHAIN_DETECTED',
                    `Task chain: ${chain.join(' → ')} → [${nexts.sort().join(', ')}]`));
                reported = true;
                break;
            }
        }
        if(!reported && chain.length > 1){
            issues.push(issue(HINT, 'CHAIN_DETECTED', `Task chain: ${chain.join(' → ')}`));
        }
    }

    // Negotiation splits
    const byPrereq = {};
    for(const [tid, task] of Object.entries(tasks||{})){
        if(task.requiresTaskDone && task.requiresInfo){
            const key = task.requiresTaskDone;
            if(!byPrereq[key]) byPrereq[key] = [];
            byPrereq[key].push({ tid, info: task.requiresInfo });
        }
    }
    for(const [prereq, variants] of Object.entries(byPrereq)){
        if(variants.length > 1){
            const names = variants.map(v => `${v.tid} (info=${v.info})`).join(', ');
            issues.push(issue(HINT, 'NEGOTIATION_SPLIT', `Negotiation split after '${prereq}': ${names}`));
        }
    }

    // Delivery tasks
    const deliveries = Object.entries(tasks||{}).filter(([,t]) => t.kind === 'delivery').map(([tid]) => tid);
    if(deliveries.length){
        issues.push(issue(HINT, 'DELIVERY_TASKS', `Delivery tasks: ${deliveries.join(', ')}`));
    }

    // Intro dialogs
    for(const [archId, arch] of Object.entries(archetypes||{})){
        if(arch.introDialog){
            issues.push(issue(HINT, 'INTRO_DIALOG',
                `Intro dialog for '${archId}': ${arch.introDialog} (done_info=${arch.introDoneInfo||'?'})`));
        }
    }

    // Cross-NPC gating
    const infoGivers = new Set();
    const infoRequirers = new Set();
    for(const dialog of Object.values(dialogs||{})){
        for(const ph of Object.values(dialog.phrases||{})){
            for(const gi of (ph.giveInfo||[])) infoGivers.add(gi);
        }
    }
    for(const task of Object.values(tasks||{})){
        if(task.requiresInfo) infoRequirers.add(task.requiresInfo);
    }
    const crossGate = [...infoGivers].filter(x => infoRequirers.has(x)).sort();
    if(crossGate.length){
        issues.push(issue(HINT, 'CROSS_NPC_GATE', `Cross-NPC gating via info portions: ${crossGate.join(', ')}`));
    }

    // Per-task bindings
    const accepts = new Set();
    const completes = new Set();
    for(const dialog of Object.values(dialogs||{})){
        for(const ph of Object.values(dialog.phrases||{})){
            for(const action of (ph.actions||[])){
                let m = action.match(/^dialogs\.arch_accept_(.+)$/);
                if(m) accepts.add(m[1]);
                m = action.match(/^dialogs\.arch_delivery_complete_(.+)$/);
                if(m) completes.add(m[1]);
            }
        }
    }
    if(accepts.size) issues.push(issue(HINT, 'PER_TASK_ACCEPT', `Per-task accept: ${[...accepts].sort().join(', ')}`));
    if(completes.size) issues.push(issue(HINT, 'PER_TASK_COMPLETE', `Per-task delivery complete: ${[...completes].sort().join(', ')}`));
}

// ── Public API ────────────────────────────

/**
 * Validate a pack's dialogs and tasks.
 * @param {Object} data - { dialogs: {id: {phrases, preconditions, ...}}, tasks: {id: {...}}, pools: {id: {...}}, archetypes: {id: {...}} }
 * @returns {Array} Array of issue objects: { level, code, message, dialogId, phraseId }
 */
function validate(data){
    const issues = [];
    const dialogs = data.dialogs || {};
    const tasks = data.tasks || {};
    const pools = data.pools || {};
    const archetypes = data.archetypes || {};

    // Dialog checks
    for(const dialog of Object.values(dialogs)){
        checkDanglingNexts(dialog, issues);
        checkNoFallback(dialog, issues);
        checkActionParams(dialog, issues);
        checkDeliveryTurninArchetype(dialog, issues);
        checkNoText(dialog, issues);
    }

    // Task checks
    checkTasks(tasks, pools, issues);

    // Cross-reference checks
    checkBindingRefs(dialogs, tasks, pools, issues);

    // Pattern detection
    detectPatterns(dialogs, tasks, pools, archetypes, issues);

    return issues;
}

/** Filter issues by level */
function crashes(issues){ return issues.filter(i => i.level === CRASH); }
function warnings(issues){ return issues.filter(i => i.level === WARN); }
function hints(issues){ return issues.filter(i => i.level === HINT); }

return { validate, crashes, warnings, hints, CRASH, WARN, HINT };
})();
