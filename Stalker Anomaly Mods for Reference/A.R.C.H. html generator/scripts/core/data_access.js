// ═══════════════════════════════════════════
// DATA ACCESS (group/char inheritance)
// ═══════════════════════════════════════════
function getD(tab){
    if(editMode==='solo'&&curSolo!==null){
        const ch=soloChars[curSolo];
        if(ch.ov&&ch.ov[tab])return ch.ov[tab];
        return (ch.defaults&&ch.defaults[tab])||dc(tab==='settings'?DEFAULT_SETTINGS:tab==='trade'?DEFAULT_TRADE:DEFAULT_DLG);
    }
    if(curGrp===null)return null;
    const g=groups[curGrp];
    if(editMode==='group')return g.defaults[tab];
    const ch=g.chars[curChar];
    if(ch.ov[tab])return ch.ov[tab];
    return g.defaults[tab];
}

function ensureCharOv(tab){
    if(editMode==='solo'&&curSolo!==null){
        const ch=soloChars[curSolo];
        ch.ov=ch.ov||{};
        if(!ch.ov[tab])ch.ov[tab]=dc(getD(tab)||{});
        return ch.ov[tab];
    }
    const ch=groups[curGrp].chars[curChar];
    if(!ch.ov[tab])ch.ov[tab]=dc(groups[curGrp].defaults[tab]);
    return ch.ov[tab];
}

function saveField(key,val){
    if(editMode==='solo'&&curSolo!==null){ensureCharOv('settings')[key]=val;if(typeof autoSave==='function')autoSave();return;}
    if(curGrp===null)return;
    if(editMode==='group'){groups[curGrp].defaults.settings[key]=val;}
    else{ensureCharOv('settings')[key]=val;}
    if(typeof autoSave==='function')autoSave();
}

function saveFilter(boxId){
    const map={filterComm:'commVals',filterLoc:'locVals',filterRank:'rankVals'};
    const field=map[boxId];if(!field)return;
    const vals=Array.from(document.querySelectorAll(`#${boxId} input:checked`)).map(c=>c.value);
    saveField(field,vals);
}

function saveTradeField(key,val){
    if(editMode==='solo'&&curSolo!==null){ensureCharOv('trade')[key]=val;if(typeof autoSave==='function')autoSave();return;}
    if(curGrp===null)return;
    if(editMode==='group'){groups[curGrp].defaults.trade[key]=val;}
    else{ensureCharOv('trade')[key]=val;}
    if(typeof autoSave==='function')autoSave();
}

function ensureVanillaDlg(v){
    const base={hello1:'',hello2:'',hello3:'',job:'',anomalies:'',information:'',tips:'',wounded:''};
    if(!v)return base;
    Object.keys(base).forEach(k=>{if(v[k]===undefined||v[k]===null)v[k]='';});
    return v;
}
function ensureDialogGraphState(d){
    if(!d||typeof d!=='object')return {view:'tree'};
    if(!d.graph||typeof d.graph!=='object')d.graph={view:'tree'};
    d.graph.view=(d.graph.view==='free')?'free':'tree';
    return d.graph;
}
function getCurTree(){
    if(_introTabActive){
        const d=getDlg();
        if(!d)return null;
        if(!d.introDialog)d.introDialog={opener:'',openerNpc:'',hub:'',hubChoices:[],nodes:{},layout:{}};
        return d.introDialog;
    }
    if(curVanillaServiceIdx!==null){
        const d=getDlg();
        if(d&&Array.isArray(d.vanillaServices)&&d.vanillaServices[curVanillaServiceIdx]){
            return d.vanillaServices[curVanillaServiceIdx];
        }
        return null;
    }
    if(curVanillaCat){
        return getVanillaTree(curVanillaCat);
    }
    if(curTaskPoolTag!==null){
        return getTaskPoolTree(curTaskPoolTag);
    }
    if(curCompanionDlgIdx!==null){
        return getCompanionTree();
    }
    const d=getDlg();
    if(!d)return null;
    if(!d.dialogs||!d.dialogs.length){
        // Story NPCs start with no dialogs — don't auto-create a default
        var _isSNpc=typeof getCurrentStoryNpc==='function'&&getCurrentStoryNpc()!==null;
        if(_isSNpc){
            d.dialogs=[];
            return null;
        }
        d.dialogs=[{id:'dlg_1',label:'Dialog 1',opener:d.opener||'I want to ask you something.',hub:d.hub||'',hubChoices:d.hubChoices||[],nodes:d.nodes||{},layout:d.layout||{}}];
        delete d.opener;delete d.hub;delete d.hubChoices;delete d.nodes;delete d.layout;
    }
    if(curDlgTreeIdx>=d.dialogs.length)curDlgTreeIdx=0;
    return d.dialogs[curDlgTreeIdx]||null;
}
function _migratePoolTrees(pool){
    if(pool.dialogTree&&!pool.dialogTrees){pool.dialogTrees=[pool.dialogTree];delete pool.dialogTree;}
    if(!pool.dialogTrees)pool.dialogTrees=[];
}
function getTaskPoolTree(tag){
    const d=getDlg();if(!d)return null;
    const pools=[...(Array.isArray(d.customPools)?d.customPools:[]),...(Array.isArray(d.taskPools)?d.taskPools:[])];
    const pool=pools.find(p=>p.tag===tag);
    if(!pool)return null;
    _migratePoolTrees(pool);
    const idx=Math.min(curTaskPoolDlgIdx,pool.dialogTrees.length);
    if(pool.dialogTrees[idx])return pool.dialogTrees[idx];
    pool.dialogTrees[0]={id:'taskpool_'+tag,label:'Pool Dialog 1',opener:'I have a job for you.',hub:'',hubChoices:[],nodes:{},layout:{}};
    autoSave();
    return pool.dialogTrees[0];
}
function addTaskPoolDialogTree(tag){
    const d=getDlg();if(!d)return;
    const pool=(Array.isArray(d.customPools)?d.customPools:[]).find(p=>p.tag===tag);
    if(!pool)return;
    _migratePoolTrees(pool);
    const n=pool.dialogTrees.length+1;
    pool.dialogTrees.push({id:'taskpool_'+tag+'_'+Date.now(),label:'Pool Dialog '+n,opener:'',hub:'',hubChoices:[],nodes:{},layout:{}});
    curTaskPoolDlgIdx=pool.dialogTrees.length-1;
    autoSave();renderDialogTreeTabs();_deRenderCenter();_deRenderLeftPanel();
}
function deleteTaskPoolDialogTree(tag,idx){
    const d=getDlg();if(!d)return;
    const pool=(Array.isArray(d.customPools)?d.customPools:[]).find(p=>p.tag===tag);
    if(!pool||!pool.dialogTrees||pool.dialogTrees.length<=1)return;
    if(!confirm('Delete this pool dialog? All its content will be lost.'))return;
    pool.dialogTrees.splice(idx,1);
    curTaskPoolDlgIdx=Math.min(curTaskPoolDlgIdx,pool.dialogTrees.length-1);
    autoSave();renderDialogTreeTabs();_deRenderCenter();_deRenderLeftPanel();
}
function getDlg(){
    if(editMode==='solo'&&curSolo!==null){
        const ch=soloChars[curSolo];
        ch.ov=ch.ov||{};
        if(!ch.ov.dlg)ch.ov.dlg=dc((ch.defaults&&ch.defaults.dlg)||DEFAULT_DLG);
        const d=ch.ov.dlg;
        d.vanilla=ensureVanillaDlg(d.vanilla);
        ensureDialogGraphState(d);
        migrateDlgToFlat(d);
        return d;
    }
    if(curGrp===null)return{dialogs:[{id:'dlg_1',label:'Dialog 1',opener:'I want to ask you something.',hub:'',hubChoices:[],nodes:{},layout:{}}],vanilla:ensureVanillaDlg(null),graph:{view:'tree'}};
    let d=null;
    if(editMode==='group'){d=groups[curGrp].defaults.dlg;}
    else{const ch=groups[curGrp].chars[curChar];if(!ch.ov.dlg)ch.ov.dlg=dc(groups[curGrp].defaults.dlg);d=ch.ov.dlg;}
    d.vanilla=ensureVanillaDlg(d.vanilla);
    ensureDialogGraphState(d);
    migrateDlgToFlat(d); // converts old nested branches format if needed
    return d;
}
function addDialogTree(){
    const d=getDlg();if(!d)return;
    d.dialogs=d.dialogs||[];
    const n=d.dialogs.length+1;
    d.dialogs.push({id:'dlg_'+Date.now(),label:'Dialog '+n,opener:'',hub:'',hubChoices:[],nodes:{},layout:{}});
    curDlgTreeIdx=d.dialogs.length-1;
    autoSave();renderDialogTreeTabs();renderBranches();
}
function deleteDialogTree(idx){
    const d=getDlg();if(!d||!d.dialogs||d.dialogs.length<=1)return;
    if(!confirm('Delete this dialog tree? All its content will be lost.'))return;
    d.dialogs.splice(idx,1);
    if(curDlgTreeIdx>=d.dialogs.length)curDlgTreeIdx=d.dialogs.length-1;
    if(_mainTabActive)delete d.mainLayout; // force re-layout
    autoSave();renderDialogTreeTabs();hideNodeEditPanel();renderBranches();
}
function switchDialogTree(idx){
    curVanillaCat=null;
    curTaskPoolTag=null;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curDlgTreeIdx=idx;
    hideNodeEditPanel();
    selectedBranchPath='';
    renderDialogTreeTabs();
    renderBranches();
}
function renameDialogTree(idx,val){
    const d=getDlg();if(!d||!d.dialogs||!d.dialogs[idx])return;
    d.dialogs[idx].label=String(val||'').trim()||('Dialog '+(idx+1));
    autoSave();
}
function _startTabRename(spanEl,idx){
    spanEl.contentEditable='true';
    spanEl.focus();
    const range=document.createRange();range.selectNodeContents(spanEl);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    const finish=()=>{
        spanEl.contentEditable='false';
        renameDialogTree(idx,spanEl.textContent);
        renderDialogTreeTabs();
    };
    spanEl.onblur=finish;
    spanEl.onkeydown=(e)=>{if(e.key==='Enter'){e.preventDefault();spanEl.blur();}if(e.key==='Escape'){const d=getDlg();spanEl.textContent=(d&&d.dialogs&&d.dialogs[idx])?d.dialogs[idx].label:'';spanEl.blur();}};
}
function _startCompTabRename(spanEl,idx){
    spanEl.contentEditable='true';
    spanEl.focus();
    const range=document.createRange();range.selectNodeContents(spanEl);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    const finish=()=>{
        spanEl.contentEditable='false';
        renameCompanionDialog(idx,spanEl.textContent);
        renderDialogTreeTabs();
    };
    spanEl.onblur=finish;
    spanEl.onkeydown=(e)=>{if(e.key==='Enter'){e.preventDefault();spanEl.blur();}if(e.key==='Escape'){const d=getDlg();spanEl.textContent=(d&&d.companionDialogs&&d.companionDialogs[idx])?d.companionDialogs[idx].label:'';spanEl.blur();}};
}
function renameCompanionDialog(idx,val){
    const d=getDlg();if(!d||!d.companionDialogs||!d.companionDialogs[idx])return;
    d.companionDialogs[idx].label=String(val||'').trim()||('Companion Dialog '+(idx+1));
    autoSave();
}
let showVanillaDlgTabs=false;
let curVanillaCat=null; // null = custom dialog selected, string = vanilla category id
let curTaskPoolTag=null; // null = not on a task pool tab, string = pool tag
let curTaskPoolDlgIdx=0; // which dialog tree within the current task pool

// ── ARCH binding helpers ──
function getCurArchId(){
    if(editMode==='solo'&&curSolo!==null)return soloChars[curSolo]?.archId||'';
    if(curGrp===null)return'';
    const g=groups[curGrp];if(!g)return'';
    if(editMode==='char')return g.chars?.[curChar]?.archId||'';
    return g.chars?.[0]?.archId||'';
}
function buildArchBindings(){
    const archId=getCurArchId();
    const d=getDlg();
    if(!d)return{actions:[],preconditions:[],scriptTexts:[]};
    const taskPools=Array.isArray(d.taskPools)?d.taskPools:[];
    const customPools=Array.isArray(d.customPools)?d.customPools:[];
    const customPoolTags=new Set(customPools.map(p=>p.tag));
    // When editing a pool tab, show only that pool's bindings
    // When editing a custom dialog, show narrative pool per-task bindings only
    let allPools;
    if(curTaskPoolTag){
        allPools=[...taskPools,...customPools].filter(p=>p.tag===curTaskPoolTag);
    } else {
        allPools=[...customPools];
    }
    const actions=[],preconditions=[],scriptTexts=[];
    allPools.forEach(pool=>{
        const tag=pool.tag||'default';
        const suf=tag==='default'?'':'_'+tag;
        const isCustomPool=customPoolTags.has(tag);
        const grp='Task Flow'+(tag!=='default'?' ('+tag+')':'');
        // Pool-level bindings — only for DEFINED pools (framework handles the flow)
        // Custom/narrative pools use per-task bindings instead (author controls the flow)
        if(!isCustomPool){
            // Core pool flow
            preconditions.push({id:'dialogs.arch_has_task_pool'+suf,label:'NPC has work available',group:grp,keywords:'offer job available task pool'});
            preconditions.push({id:'dialogs.arch_has_active_task'+suf,label:'Player is working on a task',group:grp,keywords:'active busy ongoing accepted'});
            preconditions.push({id:'dialogs.arch_task_ready'+suf,label:'Player has the required items',group:grp,keywords:'ready complete items inventory turnin'});
            actions.push({id:'dialogs.arch_task_accept'+suf,label:'Player agrees to do the job',group:grp,keywords:'accept agree yes take job'});
            actions.push({id:'dialogs.arch_task_decline'+suf,label:'Player says no thanks',group:grp,keywords:'decline refuse reject no'});
            actions.push({id:'dialogs.arch_task_try_complete'+suf,label:'Turn in the task (check items)',group:grp,keywords:'complete finish turnin turn in deliver hand over'});
            actions.push({id:'dialogs.arch_task_deliver_rewards'+suf,label:'Give player their reward',group:grp,keywords:'reward pay money items give'});
            scriptTexts.push({id:'dialogs.arch_text_task_offer_summary'+suf,label:'Show what the task needs',group:grp,keywords:'offer summary description what items'});
            scriptTexts.push({id:'dialogs.arch_text_task_offer_details'+suf,label:'Show full task details',group:grp,keywords:'details description verbose items reward location'});
            scriptTexts.push({id:'dialogs.arch_text_task_active_summary'+suf,label:'Remind player what to do',group:grp,keywords:'active reminder progress status what do'});
            scriptTexts.push({id:'dialogs.arch_text_task_result'+suf,label:'Show success or failure',group:grp,keywords:'result outcome complete fail success reward'});
            // Delivery/collect pool bindings — only when pool has those task kinds
            var _poolKinds={};
            (Array.isArray(pool.tasks)?pool.tasks:[]).forEach(function(t){_poolKinds[t.type||'fetch']=true;});
            if(_poolKinds.delivery||_poolKinds.collect){
                actions.push({id:'dialogs.arch_delivery_try_complete'+suf,label:'Complete delivery/collect at this NPC',group:grp,keywords:'delivery deliver collect package receive target'});
                scriptTexts.push({id:'dialogs.arch_delivery_result_text'+suf,label:'Delivery/collect result at target',group:grp,keywords:'delivery collect result target receive'});
            }
        }
        // Per-task bindings — shown for ALL pool types
        const tasks=Array.isArray(pool.tasks)?pool.tasks:[];
        tasks.forEach(t=>{
            const tid=String(t.id||'').trim();
            if(!tid||t.hidden)return;
            const kind=t.type||'fetch';
            const tgrp='Task: '+tid;
            actions.push({id:'dialogs.arch_accept_'+tid,label:'Player accepts "'+tid+'"',group:tgrp,keywords:'accept agree take specific task'});
            actions.push({id:'dialogs.arch_cancel_'+tid,label:'Player abandons "'+tid+'"',group:tgrp,keywords:'cancel abandon quit specific task'});
            if(kind==='fetch')actions.push({id:'dialogs.arch_fetch_complete_'+tid,label:'Turn in "'+tid+'"',group:tgrp,keywords:'complete finish fetch turnin'});
            if(kind==='delivery')actions.push({id:'dialogs.arch_delivery_complete_'+tid,label:'Deliver for "'+tid+'"',group:tgrp,keywords:'complete finish delivery deliver'});
            if(kind==='talk')actions.push({id:'dialogs.arch_talk_complete_'+tid,label:'Mark "'+tid+'" as done',group:tgrp,keywords:'complete finish talk met spoke'});
            if(kind==='collect')actions.push({id:'dialogs.arch_collect_pickup_'+tid,label:'Pick up items for "'+tid+'"',group:tgrp,keywords:'collect pickup gather items'});
            preconditions.push({id:'dialogs.arch_is_task_done('+tid+')',label:'Player finished "'+tid+'"',group:tgrp,keywords:'done completed finished before prerequisite'});
            preconditions.push({id:'dialogs.arch_is_task_not_done('+tid+')',label:'Player has NOT finished "'+tid+'"',group:tgrp,keywords:'not done incomplete unfinished'});
            preconditions.push({id:'dialogs.arch_is_task_active('+tid+')',label:'Player is working on "'+tid+'"',group:tgrp,keywords:'active current busy working on'});
            preconditions.push({id:'dialogs.arch_is_task_ready_for('+tid+')',label:'Player can turn in "'+tid+'"',group:tgrp,keywords:'ready items turnin complete can'});
            preconditions.push({id:'dialogs.arch_can_offer_task('+tid+')',label:'Can offer "'+tid+'" to player',group:tgrp,keywords:'available offer can give unlocked'});
            scriptTexts.push({id:'dialogs.arch_text_task_offer_details_by_id('+tid+')',label:'Show details for "'+tid+'"',group:tgrp,keywords:'details description offer task info'});
        });
    });
    // NPC identity
    preconditions.push({id:'dialogs.arch_is_delivery_target',label:'Player has a delivery for this NPC',group:'Who Is This NPC',keywords:'delivery target package receive collect talk'});
    // Utility bindings
    preconditions.push({id:'dialogs.arch_has_money',label:'Player has enough money',group:'Utility',keywords:'money rubles cash afford pay check price'});
    actions.push({id:'dialogs.arch_pay_money',label:'Take money from player',group:'Utility',keywords:'pay money cost fee bribe charge rubles'});
    actions.push({id:'dialogs.arch_make_enemy',label:'Make NPC hostile to player',group:'Utility',keywords:'enemy hostile attack aggro angry fight betray'});
    // Visit tracking
    preconditions.push({id:'dialogs.arch_is_first_visit',label:'First time meeting this NPC',group:'Player History',keywords:'first visit new never met before introduction'});
    preconditions.push({id:'dialogs.arch_is_returning',label:'Player has been here before',group:'Player History',keywords:'returning visited before again repeat'});
    preconditions.push({id:'dialogs.arch_is_regular',label:'Player is a regular visitor',group:'Player History',keywords:'regular frequent loyal many visits trusted'});
    // Category picker — only show slot bindings if any pool has a player_choice category task
    var _hasPlayerChoice=false;
    allPools.forEach(function(pool){
        (Array.isArray(pool.tasks)?pool.tasks:[]).forEach(function(t){
            if((t.categoryMode==='player_choice'||t.categoryMode==='player_choice_strict')&&t.itemCategory)_hasPlayerChoice=true;
        });
    });
    if(_hasPlayerChoice){
        preconditions.push({id:'dialogs.arch_task_is_cat_picker',label:'Player needs to pick an item type',group:'Item Picker',keywords:'category picker choose item type player choice'});
        preconditions.push({id:'dialogs.arch_task_not_cat_picker',label:'No item choice needed',group:'Item Picker',keywords:'single no picker skip'});
        for(var _cs=1;_cs<=8;_cs++){
            preconditions.push({id:'dialogs.arch_task_cat_has_'+_cs,label:'Item slot '+_cs+' available',group:'Item Picker',keywords:'category slot exists available picker item'});
            scriptTexts.push({id:'dialogs.arch_text_task_cat_'+_cs,label:'Show item slot '+_cs+' name',group:'Item Picker',keywords:'category name label text picker item'});
            actions.push({id:'dialogs.arch_task_cat_select_'+_cs,label:'Player picks item slot '+_cs,group:'Item Picker',keywords:'select choose pick category slot item'});
        }
    }
    // Informant specialization (only when spec active)
    const _specs=typeof getActiveSpecializations==='function'?getActiveSpecializations():[];
    if(_specs.indexOf('informant')>=0||_specs.indexOf('intel')>=0){
        preconditions.push({id:'dialogs.arch_informant_find_stalker',label:'NPC spots a stalker nearby',group:'Intel',keywords:'informant find locate stalker person nearby scan'});
        preconditions.push({id:'dialogs.arch_informant_find_mutant',label:'NPC spots a mutant nearby',group:'Intel',keywords:'informant find locate mutant creature nearby scan'});
        scriptTexts.push({id:'dialogs.arch_text_informant_result',label:'Show what NPC found',group:'Intel',keywords:'informant result location distance direction'});
    }
    // Companion recruitment (arch_is_companion not listed — auto-injected on companion dialog export)
    preconditions.push({id:'dialogs.arch_can_recruit',label:'NPC can be recruited',group:'Companion',keywords:'recruit companion follow join squad hire'});
    actions.push({id:'dialogs.arch_recruit_companion',label:'Recruit NPC as companion',group:'Companion',keywords:'recruit companion follow join squad hire come with me'});
    actions.push({id:'dialogs.arch_dismiss_companion',label:'Dismiss companion',group:'Companion',keywords:'dismiss leave squad remove companion goodbye'});

    // Utility actions
    actions.push({id:'dialogs.arch_delivery_deliver_rewards',label:'Give rewards (delivery/talk/collect)',group:'Utility',keywords:'reward pay delivery talk collect target'});
    actions.push({id:'dialogs.arch_restore_start_dialog',label:'Restore normal NPC greeting',group:'Utility',keywords:'restore reset greeting normal intro start dialog'});

    // ═══════════════════════════════════════════
    // VANILLA BINDINGS — from dialogs.script
    // ═══════════════════════════════════════════

    // Player/NPC faction bindings removed — ARCH archetypes already filter by community in Settings

    // ── Player Health ──
    preconditions.push({id:'dialogs.is_actor_healthy',label:'Player is healthy',group:'Vanilla: Player State',keywords:'health healthy full ok fine'});
    preconditions.push({id:'dialogs.is_actor_not_healthy',label:'Player is hurt or irradiated',group:'Vanilla: Player State',keywords:'hurt injured wounded sick not healthy'});
    preconditions.push({id:'dialogs.is_actor_injured',label:'Player is injured (low health)',group:'Vanilla: Player State',keywords:'injured wounded hurt bleeding health low'});
    preconditions.push({id:'dialogs.is_actor_irradiated',label:'Player is irradiated',group:'Vanilla: Player State',keywords:'radiation irradiated glowing sick rad'});
    preconditions.push({id:'dialogs.is_actor_injured_irradiated',label:'Player is injured AND irradiated',group:'Vanilla: Player State',keywords:'injured irradiated both hurt radiation'});
    actions.push({id:'dialogs.heal_actor_injury_radiation',label:'Heal injuries AND radiation [3,350 RU]',group:'Vanilla: Player State',keywords:'heal all health radiation both full treatment'});

    // ── Player Reputation ──
    preconditions.push({id:'dialogs.is_actor_noob',label:'Player is a rookie (low rank)',group:'Vanilla: Player Reputation',keywords:'noob rookie newbie low rank beginner'});
    preconditions.push({id:'dialogs.is_actor_trustworthy',label:'Player is trustworthy (decent rank)',group:'Vanilla: Player Reputation',keywords:'trustworthy rank respect decent'});
    preconditions.push({id:'dialogs.is_actor_experienced',label:'Player is experienced (high rank)',group:'Vanilla: Player Reputation',keywords:'experienced veteran high rank skilled'});
    preconditions.push({id:'dialogs.is_actor_reliable',label:'Player is reliable (very high rank)',group:'Vanilla: Player Reputation',keywords:'reliable master high rank top'});

    // NPC State removed — wounded handled by dedicated wounded tree, friendly/enemy gated by engine relation system

    // ── World State ──
    preconditions.push({id:'dialogs.is_surge_running',label:'An emission is happening',group:'Vanilla: World',keywords:'surge emission blowout happening active'});
    preconditions.push({id:'dialogs.is_surge_not_running',label:'No emission right now',group:'Vanilla: World',keywords:'surge emission not running calm safe'});

    // ── Dialog Control ──
    actions.push({id:'dialogs.break_dialog',label:'End the conversation',group:'Vanilla: Dialog',keywords:'break end close exit dialog conversation stop'});

    return{actions,preconditions,scriptTexts};
}

function renderDialogTreeTabs(){
    const tabsEl=document.getElementById('dlgTreeTabs');
    if(!tabsEl)return;
    const d=getDlg();
    if(!d){tabsEl.innerHTML='';return;}
    if(!d.dialogs)d.dialogs=[];
    const s=getD('settings')||{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];

    let html='';

    // ── All (standalone, indented to align above Dialog 1) ──
    html+=`<div class="dlg-tab-row">`;
    html+=`<span class="dlg-tab-row-label"></span>`;
    html+=`<div class="dlg-tree-tab${_mainTabActive&&!_companionAllActive&&!curVanillaCat&&!curTaskPoolTag&&!_introTabActive?' active':''}" onclick="selectMainTab()"><span>All</span></div>`;
    html+=`<div class="dlg-tree-tab${_introTabActive?' active':''}" onclick="selectIntroTab()" title="First-meeting intro dialog"><span>Intro</span></div>`;
    html+=`<button class="btn b2 bs de-editor-btn" style="padding:4px 10px;font-size:12px" onclick="openDialogEditor()" title="Open immersive dialog editor">✎ Editor</button>`;
    html+=`</div>`;

    // ── Custom dialog tabs ──
    html+=`<div class="dlg-tab-row">`;
    html+=`<span class="dlg-tab-row-label">Custom</span>`;
    html+=d.dialogs.map((t,i)=>{
        const active=!_mainTabActive&&!_introTabActive&&!_companionAllActive&&curCompanionDlgIdx===null&&curVanillaCat===null&&curTaskPoolTag===null&&curVanillaServiceIdx===null&&i===curDlgTreeIdx;
        return `<div class="dlg-tree-tab${active?' active':''}" onclick="${active?'':'selectCustomDialog('+i+')'}"><span spellcheck="false" onclick="${active?'event.stopPropagation();_startTabRename(this,'+i+')':''}" style="cursor:${active?'text':'pointer'}">${esc(t.label||('Dialog '+(i+1)))}</span>${d.dialogs.length>1?`<button class="dlg-tab-del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();deleteDialogTree(${i})" title="Delete dialog">✕</button>`:''}</div>`;
    }).join('');
    html+=`<button class="btn b2 bs" style="padding:4px 10px;font-size:12px" onclick="addDialogTree()">+ Add Dialog</button>`;
    html+=`<button class="btn b2 bs" style="padding:4px 10px;font-size:12px" onclick="duplicateCurrentDialog()" title="Duplicate entire current dialog tree">⧉ Duplicate</button>`;
    html+=`</div>`;

    // ── Companion dialog tabs (hidden for story NPCs) ──
    const _isStoryNpcDlg=typeof getCurrentStoryNpc==='function'&&getCurrentStoryNpc()!==null;
    if(!_isStoryNpcDlg){
        const compDialogs=d.companionDialogs||[];
        html+=`<div class="dlg-tab-row">`;
        html+=`<span class="dlg-tab-row-label" style="color:#82b1ff">Companion</span>`;
        html+=`<div class="dlg-tree-tab${_companionAllActive?' active':''}" onclick="selectCompanionAllTab()" style="border-color:${_companionAllActive?'#82b1ff':'#555'}"><span style="color:${_companionAllActive?'#82b1ff':'#999'}">All</span></div>`;
        compDialogs.forEach((t,i)=>{
            const active=curCompanionDlgIdx===i&&!_companionAllActive;
            const _compRO=(i===0&&t.id==='comp_dlg_1');
            if(_compRO){
                html+=`<div class="dlg-tree-tab${active?' active':''}" style="border-color:${active?'#82b1ff':'#555'};opacity:0.6;cursor:default" title="Default recruit dialog — not editable"><span style="color:${active?'#82b1ff':'#999'};font-size:11px">${esc(t.label||'Companion Dialog 1')}</span></div>`;
            } else {
            html+=`<div class="dlg-tree-tab${active?' active':''}" onclick="switchCompanionDialog(${i})" style="border-color:${active?'#82b1ff':'#555'}"><span spellcheck="false" onclick="${active?'event.stopPropagation();_startCompTabRename(this,'+i+')':''}" style="cursor:${active?'text':'pointer'};color:${active?'#82b1ff':'#999'};font-size:11px">${esc(t.label||('Companion Dialog '+(i+1)))}</span>${compDialogs.length>1?`<button class="dlg-tab-del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();deleteCompanionDialog(${i})" title="Delete companion dialog">✕</button>`:''}</div>`;
            }
        });
        html+=`<button class="btn b2 bs" style="padding:4px 10px;font-size:12px" onclick="addCompanionDialog()">+ Add Dialog</button>`;
        html+=`</div>`;
    }

    // ── Vanilla category tabs (hidden for story NPCs — they don't strip vanilla dialogs) ──
    if(!_isStoryNpcDlg){
        const kept=STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id));
        if(kept.length||stripped.length){
            html+=`<div class="dlg-tab-row">`;
            html+=`<span class="dlg-tab-row-label">Vanilla</span>`;
            kept.forEach(cat=>{
                const active=!_mainTabActive&&curVanillaCat===cat.id;
                const editable=isVanillaCatEditable(cat.id);
                html+=`<div class="dlg-tree-tab vanilla-cat${active?' active':''}" ${editable?`onclick="selectVanillaCat('${cat.id}')"`:'title="Vanilla — not editable"'} style="${active?'':'border-color:#555;'}${editable?'':'opacity:0.6;cursor:default;'}"><span style="color:${active?'#ffe082':'#999'};font-size:11px">${esc(cat.label)}</span><button class="dlg-tab-del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();stripVanillaCat('${cat.id}')" title="Strip ${cat.label}">✕</button></div>`;
            });
            if(stripped.length){
                html+=`<select onchange="restoreVanillaCat(this.value);this.value=''" style="padding:2px 6px;font-size:11px;background:#1a1a1a;color:#888;border:1px solid #444;border-radius:3px;cursor:pointer"><option value="">+ Restore...</option>`;
                stripped.forEach(catId=>{
                    const cat=STRIP_CATEGORIES.find(c=>c.id===catId);
                    if(cat)html+=`<option value="${cat.id}">${cat.label}</option>`;
                });
                html+=`</select>`;
            }
            html+=`</div>`;
        }
    }

    // ── Vanilla service tabs (story NPCs only) ──
    if(_isStoryNpcDlg&&Array.isArray(d.vanillaServices)&&d.vanillaServices.length){
        html+=`<div class="dlg-tab-row">`;
        html+=`<span class="dlg-tab-row-label">Vanilla</span>`;
        d.vanillaServices.forEach((svc,i)=>{
            const active=curVanillaServiceIdx===i;
            html+=`<div class="dlg-tree-tab vanilla-cat${active?' active':''}" onclick="selectVanillaService(${i})" style="${active?'':'border-color:#555;'}"><span style="color:${active?'#ffe082':'#999'};font-size:11px">${esc(svc.label||svc.id)}</span></div>`;
        });
        html+=`</div>`;
    }

    // ── Defined pool tabs ──
    var defPools=Array.isArray(d.taskPools)?d.taskPools:[];
    if(defPools.length){
        html+=`<div class="dlg-tab-row">`;
        html+=`<span class="dlg-tab-row-label">Pools</span>`;
        defPools.forEach(function(p){
            var active=curTaskPoolTag===p.tag;
            var lbl=p.tag.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
            html+=`<div class="dlg-tree-tab${active?' active':''}" onclick="selectPoolTab('${esc(p.tag)}')" style="border-color:${active?'#ff8c00':'#555'}"><span style="color:${active?'#ffb74d':'#999'};font-size:11px">${esc(lbl)}</span></div>`;
        });
        html+=`</div>`;
    }

    tabsEl.innerHTML=html;
    if(typeof syncGraphFsTreeTabs==='function')syncGraphFsTreeTabs();
}

function selectCustomDialog(idx){
    _mainTabActive=false;
    _introTabActive=false;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=null;
    curTaskPoolTag=null;
    curVanillaServiceIdx=null;
    switchDialogTree(idx);
}
function selectPoolTab(tag){
    _mainTabActive=false;
    _introTabActive=false;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=null;
    curVanillaServiceIdx=null;
    curTaskPoolTag=tag;
    curTaskPoolDlgIdx=0;
    selectedBranchPath='';
    // Auto-insert pool flow template if tree is empty
    var tree=getTaskPoolTree(tag);
    if(tree&&(!tree.nodes||!Object.keys(tree.nodes).length)&&(!tree.hubChoices||!tree.hubChoices.length)){
        _autoInsertPoolTemplate(tree,tag);
    }
    if(typeof switchDlgSubtab==='function')switchDlgSubtab('graph',document.querySelector('.dlg-stab[data-stab="graph"]'));
    else{renderDialogTreeTabs();renderBranches();}
}
function _autoInsertPoolTemplate(tree,tag){
    var suf='_'+tag;
    tree.nodes=tree.nodes||{};
    tree.hubChoices=tree.hubChoices||[];
    tree.hub=tree.hub||'What can I do for you?';
    // Gate node — NPC has a task available
    var gateId='n1';
    tree.nodes[gateId]={
        npc:'I have a job for you.',
        poolTag:tag, poolRole:'gate',
        precondition:'dialogs.arch_has_task_pool'+suf,
        choices:[{text:'Tell me more.', next:'n2'}]
    };
    // Summary node — shows task details
    tree.nodes['n2']={
        npc:'',
        poolTag:tag, poolRole:'summary',
        scriptText:'dialogs.arch_text_task_offer_summary'+suf,
        choices:[
            {text:"I'll do it.", next:'__end__', action:'dialogs.arch_task_accept'+suf},
            {text:'Not right now.', next:'__end__', action:'dialogs.arch_task_decline'+suf}
        ]
    };
    // Active task — player has an ongoing task
    var activeId='n3';
    tree.nodes[activeId]={
        npc:'',
        poolTag:tag, poolRole:'active',
        precondition:'dialogs.arch_has_active_task'+suf,
        scriptText:'dialogs.arch_text_task_active_summary'+suf,
        choices:[{text:'Here, I have what you need.', next:'n4', precondition:'dialogs.arch_task_ready'+suf}]
    };
    // Turnin node — complete + deliver rewards
    tree.nodes['n4']={
        npc:'',
        poolTag:tag, poolRole:'turnin',
        scriptText:'dialogs.arch_text_task_result'+suf,
        action:'dialogs.arch_task_try_complete'+suf+';dialogs.arch_task_deliver_rewards'+suf,
        choices:[]
    };
    // Hub choices — offer and active task
    tree.hubChoices.push({text:'Got any work?', next:gateId});
    tree.hubChoices.push({text:'About that job...', next:activeId});
    autoSave();
}
function selectMainTab(){
    _mainTabActive=true;
    _introTabActive=false;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=null;
    curTaskPoolTag=null;
    curVanillaServiceIdx=null;
    selectedBranchPath='';
    // Ensure graph subtab is visible
    var graphPanel=document.getElementById('dlgStab_graph');
    if(graphPanel&&graphPanel.style.display==='none'){
        if(typeof switchDlgSubtab==='function')switchDlgSubtab('graph',document.querySelector('.dlg-stab[data-stab="graph"]'));
    } else {
        renderDialogTreeTabs();
        renderBranches();
    }
}
function selectIntroTab(){
    _mainTabActive=false;
    _introTabActive=true;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=null;
    curTaskPoolTag=null;
    curVanillaServiceIdx=null;
    selectedBranchPath='';
    // Ensure intro dialog tree exists
    var d=getDlg();
    if(d&&!d.introDialog){
        d.introDialog={introGreeting:'',opener:'',openerNpc:'',hub:'',hubChoices:[],nodes:{},layout:{}};
    }
    renderDialogTreeTabs();
    renderBranches();
}
function selectVanillaService(idx){
    _mainTabActive=false;
    _introTabActive=false;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=null;
    curTaskPoolTag=null;
    curVanillaServiceIdx=idx;
    renderDialogTreeTabs();
    renderBranches();
}
function selectVanillaCat(catId){
    if(!isVanillaCatEditable(catId))return;
    _mainTabActive=false;
    _introTabActive=false;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=catId;
    curTaskPoolTag=null;
    curVanillaServiceIdx=null;
    renderDialogTreeTabs();
    const tree=getVanillaTree(catId);
    if(tree){
        renderDialogInsights(tree);
    }
}
function selectTaskPool(tag){
    _mainTabActive=false;
    _introTabActive=false;
    _companionAllActive=false;
    curCompanionDlgIdx=null;
    curVanillaCat=null;
    curTaskPoolTag=tag;
    curVanillaServiceIdx=null;
    curTaskPoolDlgIdx=0;
    renderDialogTreeTabs();
    const tree=getTaskPoolTree(tag);
    if(tree){
        renderDialogInsights(tree);
    }
}
function _getVanillaDefaults(catId){
    // For story NPCs, use role-specific dialog defaults
    var s=getD('settings');
    if(s&&s.assignTo&&typeof STORY_NPC_LOOKUP!=='undefined'&&typeof STORY_NPC_ROLE_DIALOGS!=='undefined'){
        var npc=STORY_NPC_LOOKUP[s.assignTo];
        if(npc&&npc.block&&STORY_NPC_ROLE_DIALOGS[npc.block]&&STORY_NPC_ROLE_DIALOGS[npc.block][catId]){
            return STORY_NPC_ROLE_DIALOGS[npc.block][catId];
        }
    }
    return VANILLA_DIALOG_DEFAULTS[catId]||null;
}
function getVanillaTree(catId){
    const d=getDlg();if(!d)return null;
    if(!d.vanillaDialogs)d.vanillaDialogs={};
    if(!d.vanillaDialogs[catId]){
        const def=_getVanillaDefaults(catId);
        if(!def)return null;
        d.vanillaDialogs[catId]={
            id:'vanilla_'+catId,
            label:STRIP_CATEGORIES.find(c=>c.id===catId)?.label||catId,
            opener:def.opener||'',
            hub:def.hub||'',
            hubChoices:dc(def.hubChoices||[]),
            nodes:dc(def.nodes||{}),
            layout:{}
        };
        autoSave();
    }
    // Migrate wounded bindings — backfill vanilla preconditions/actions if missing
    if(catId==='wounded'){
        var wt=d.vanillaDialogs[catId];
        if(wt&&Array.isArray(wt.hubChoices)&&wt.hubChoices.length>=2){
            var def2=VANILLA_DIALOG_DEFAULTS.wounded;
            if(def2&&def2.hubChoices){
                wt.hubChoices.forEach(function(ch,ci){
                    var dch=def2.hubChoices[ci];
                    if(dch&&!ch.precondition&&dch.precondition)ch.precondition=dch.precondition;
                    if(dch&&!ch.action&&dch.action)ch.action=dch.action;
                });
            }
        }
    }
    return d.vanillaDialogs[catId];
}
function toggleVanillaDlgTabs(show){
    showVanillaDlgTabs=show;
    if(!show&&curVanillaCat!==null){
        curVanillaCat=null;
        renderBranches();
    }
    renderDialogTreeTabs();
}
function stripVanillaCat(catId){
    const s=getD('settings');if(!s)return;
    if(!Array.isArray(s.stripCategories))s.stripCategories=[];
    if(!s.stripCategories.includes(catId))s.stripCategories.push(catId);
    saveField('stripCategories',s.stripCategories);
    if(curVanillaCat===catId){
        curVanillaCat=null;
        renderBranches();
    }
    renderDialogTreeTabs();
}
function restoreVanillaCat(catId){
    if(!catId)return;
    const s=getD('settings');if(!s)return;
    if(!Array.isArray(s.stripCategories))return;
    s.stripCategories=s.stripCategories.filter(c=>c!==catId);
    saveField('stripCategories',s.stripCategories);
    if(_mainTabActive){delete getDlg().mainLayout;renderBranches();}
    else renderDialogTreeTabs();
}
// ═══════════════════════════════════════════
// COMPANION DIALOG SYSTEM
// ═══════════════════════════════════════════
function ensureCompanionDialogs(){
    const d=getDlg();if(!d)return[];
    if(!d.companionDialogs||!d.companionDialogs.length){
        const def=VANILLA_DIALOG_DEFAULTS.companion;
        d.companionDialogs=[{
            id:'comp_dlg_1',label:'Companion Dialog 1',
            opener:def?def.opener:'I could use some backup out here.',
            hub:def?def.hub:'What do you need?',
            hubChoices:dc(def?def.hubChoices:[]),
            nodes:dc(def?def.nodes:{}),
            layout:{}
        }];
        autoSave();
    }
    return d.companionDialogs;
}
function getCompanionTree(){
    const d=getDlg();if(!d)return null;
    const dialogs=ensureCompanionDialogs();
    if(curCompanionDlgIdx===null||curCompanionDlgIdx>=dialogs.length)curCompanionDlgIdx=0;
    return dialogs[curCompanionDlgIdx]||null;
}
function addCompanionDialog(){
    const d=getDlg();if(!d)return;
    const dialogs=ensureCompanionDialogs();
    const n=dialogs.length+1;
    dialogs.push({id:'comp_dlg_'+Date.now(),label:'Companion Dialog '+n,opener:'',hub:'',hubChoices:[],nodes:{},layout:{}});
    curCompanionDlgIdx=dialogs.length-1;
    _companionAllActive=false;
    autoSave();renderDialogTreeTabs();renderBranches();
}
function deleteCompanionDialog(idx){
    const d=getDlg();if(!d)return;
    const dialogs=d.companionDialogs;
    if(!dialogs||dialogs.length<=1)return;
    if(!confirm('Delete this companion dialog? All its content will be lost.'))return;
    dialogs.splice(idx,1);
    if(curCompanionDlgIdx>=dialogs.length)curCompanionDlgIdx=dialogs.length-1;
    if(_companionAllActive)delete d.companionMainLayout;
    autoSave();renderDialogTreeTabs();renderBranches();
}
function switchCompanionDialog(idx){
    _companionAllActive=false;
    _mainTabActive=false;
    _introTabActive=false;
    curVanillaCat=null;
    curTaskPoolTag=null;
    curVanillaServiceIdx=null;
    curCompanionDlgIdx=idx;
    selectedBranchPath='';
    renderDialogTreeTabs();
    renderBranches();
}
function selectCompanionAllTab(){
    _companionAllActive=true;
    _mainTabActive=false;
    _introTabActive=false;
    curVanillaCat=null;
    curTaskPoolTag=null;
    curVanillaServiceIdx=null;
    curCompanionDlgIdx=0;
    selectedBranchPath='';
    var graphPanel=document.getElementById('dlgStab_graph');
    if(graphPanel&&graphPanel.style.display==='none'){
        if(typeof switchDlgSubtab==='function')switchDlgSubtab('graph',document.querySelector('.dlg-stab[data-stab="graph"]'));
    } else {
        renderDialogTreeTabs();
        renderBranches();
    }
}

function getTrade(){
    if(editMode==='solo'&&curSolo!==null){return ensureCharOv('trade');}
    if(curGrp===null)return dc(DEFAULT_TRADE);
    if(editMode==='group')return groups[curGrp].defaults.trade;
    const ch=groups[curGrp].chars[curChar];if(!ch.ov.trade)ch.ov.trade=dc(groups[curGrp].defaults.trade);return ch.ov.trade;
}

function sanitizeLuaId(v,fallback='arch_entry'){
    let t=String(v||'').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+/,'').replace(/_+$/,'');
    if(!t)t=fallback;
    if(/^[0-9]/.test(t))t='id_'+t;
    return t;
}
function parseCsvIds(text){
    return String(text||'').split(',').map(s=>sanitizeLuaId(s.trim(),'')).filter(Boolean);
}
function parseSpecializations(value){
    const aliases={
        technician:'technician',
        tech:'technician',
        mechanic:'technician',
        medic:'medic',
        field_medic:'medic',
        doctor:'medic',
        healer:'medic',
        chef:'cook',
        cook:'cook',
        informant:'informant',
        intel:'informant',
        scout:'informant'
    };
    const src=Array.isArray(value)?value:String(value||'').split(/[,\s;|]+/);
    const out=[];
    const seen={};
    src.forEach(v=>{
        const key=String(v||'').trim().toLowerCase();
        const canonical=aliases[key];
        if(!canonical||seen[canonical])return;
        seen[canonical]=true;
        out.push(canonical);
    });
    return out;
}
function getSpecializationDialogIds(value){
    const specs=parseSpecializations(value);
    const out=[];
    const seen={};
    specs.forEach(spec=>{
        const ids=SPECIALIZATION_DIALOG_MAP[spec]||[];
        ids.forEach(id=>{
            const t=String(id||'').trim();
            if(!t||seen[t])return;
            seen[t]=true;
            out.push(t);
        });
    });
    return out;
}
function parseSpawnLines(text,slot){
    const out=[];
    const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    lines.forEach(line=>{
        const parts=line.split(':').map(p=>p.trim());
        if(slot==='extra'){
            const section=resolveItemSection(parts[0]||'');
            const chance=(parts[1]!==undefined&&parts[1]!==''?Number(parts[1]):100);
            if(section)out.push(`${section}:${Number.isFinite(chance)?chance:100}`);
            return;
        }
        const section=resolveItemSection(parts[0]||'');
        const attach=(parts[1]!==undefined&&parts[1]!==''?parts[1]:'0');
        const ammo=(parts[2]!==undefined&&parts[2]!==''?parts[2]:'0');
        const chance=(parts[3]!==undefined&&parts[3]!==''?Number(parts[3]):100);
        if(section)out.push(`${section}:${attach}:${ammo}:${Number.isFinite(chance)?chance:100}`);
    });
    return out;
}
function parseTradeLines(text,kind){
    const out=[];
    const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    lines.forEach(line=>{
        const p=line.split(':').map(v=>v.trim());
        if(kind==='supply'){
            const tier=p[0]||'stock_0';
            const gw=Number(p[1]||0);
            const sec=resolveItemSection(p[2]||'');
            const qty=Number(p[3]||1);
            const prob=Number(p[4]||1);
            if(sec){
                out.push({tier,gw:Number.isFinite(gw)?gw:0,sec,qty:Number.isFinite(qty)?qty:1,prob:Number.isFinite(prob)?prob:1});
            }
            return;
        }
        const sec=resolveItemSection(p[0]||'');
        const base=Number(p[1]||1);
        const mult=Number(p[2]||1);
        if(sec){
            out.push({sec,base:Number.isFinite(base)?base:1,mult:Number.isFinite(mult)?mult:1});
        }
    });
    return out;
}
function hasCatalogItem(section){
    return !!ITEM_LOOKUP_BY_ID[String(section||'').toLowerCase()];
}
function numFmt(v){
    const n=Number(v);
    if(!Number.isFinite(n))return '0';
    if(Math.abs(n-Math.round(n))<1e-6)return String(Math.round(n));
    return String(Number(n.toFixed(3)));
}

