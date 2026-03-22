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
    if(curVanillaCat){
        return getVanillaTree(curVanillaCat);
    }
    if(curTaskPoolTag!==null){
        return getTaskPoolTree(curTaskPoolTag);
    }
    const d=getDlg();
    if(!d)return null;
    if(!d.dialogs||!d.dialogs.length){
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
    let allPools=[...taskPools,...customPools];
    if(curTaskPoolTag)allPools=allPools.filter(p=>p.tag===curTaskPoolTag);
    const actions=[],preconditions=[],scriptTexts=[];
    if(archId&&!curTaskPoolTag){
        preconditions.push({id:'dialogs.arch_is_'+archId,label:'NPC is '+archId,group:'Archetype'});
    }
    allPools.forEach(pool=>{
        const tag=pool.tag||'default';
        const suf=tag==='default'?'':'_'+tag;
        const grp='Pool: '+tag;
        preconditions.push({id:'dialogs.arch_has_task_pool'+suf,label:'Has tasks to offer',group:grp});
        preconditions.push({id:'dialogs.arch_no_task_pool'+suf,label:'No tasks to offer',group:grp});
        preconditions.push({id:'dialogs.arch_has_active_task'+suf,label:'Player has active task',group:grp});
        preconditions.push({id:'dialogs.arch_task_ready'+suf,label:'Task ready (items in hand)',group:grp});
        actions.push({id:'dialogs.arch_task_accept'+suf,label:'Accept task',group:grp});
        actions.push({id:'dialogs.arch_task_decline'+suf,label:'Decline task',group:grp});
        actions.push({id:'dialogs.arch_task_try_complete'+suf,label:'Try complete',group:grp});
        actions.push({id:'dialogs.arch_task_deliver_rewards'+suf,label:'Deliver rewards',group:grp});
        scriptTexts.push({id:'dialogs.arch_text_task_offer_summary'+suf,label:'Task offer summary',group:grp});
        scriptTexts.push({id:'dialogs.arch_text_task_result'+suf,label:'Task result text',group:grp});
        // Per-task accept bindings (for chain/negotiation dialogs) — skip hidden tasks
        const tasks=Array.isArray(pool.tasks)?pool.tasks:[];
        tasks.forEach(t=>{
            const tid=String(t.id||'').trim();
            if(!tid||t.hidden)return;
            const kind=t.type||'fetch';
            const kicon=kind==='delivery'?'📦':kind==='talk'?'💬':kind==='collect'?'📋':'🎒';
            actions.push({id:'dialogs.arch_accept_'+tid,label:kicon+' Accept: '+tid,group:grp+' (per-task)'});
            if(kind==='delivery')actions.push({id:'dialogs.arch_delivery_complete_'+tid,label:'📦 Complete: '+tid,group:grp+' (per-task)'});
            if(kind==='talk')actions.push({id:'dialogs.arch_talk_complete_'+tid,label:'💬 Complete: '+tid,group:grp+' (per-task)'});
            if(kind==='collect')actions.push({id:'dialogs.arch_collect_pickup_'+tid,label:'📋 Pickup: '+tid,group:grp+' (per-task)'});
        });
    });
    // Common utility actions
    actions.push({id:'dialogs.arch_delivery_deliver_rewards',label:'💵 Give rewards (delivery/talk/collect)',group:'Utility'});
    actions.push({id:'dialogs.arch_restore_start_dialog',label:'🔄 Restore start dialog',group:'Utility'});
    return{actions,preconditions,scriptTexts};
}

function renderDialogTreeTabs(){
    const tabsEl=document.getElementById('dlgTreeTabs');
    if(!tabsEl)return;
    const d=getDlg();
    if(!d||!d.dialogs){tabsEl.innerHTML='';return;}
    const s=getD('settings')||{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];

    let html='';

    // ── All (standalone, indented to align above Dialog 1) ──
    html+=`<div class="dlg-tab-row">`;
    html+=`<span class="dlg-tab-row-label"></span>`;
    html+=`<div class="dlg-tree-tab${_mainTabActive&&!curVanillaCat&&!curTaskPoolTag&&!_introTabActive?' active':''}" onclick="selectMainTab()"><span>All</span></div>`;
    html+=`<div class="dlg-tree-tab${_introTabActive?' active':''}" onclick="selectIntroTab()" title="First-meeting intro dialog"><span>Intro</span></div>`;
    html+=`<button class="btn b2 bs" style="padding:4px 10px;font-size:12px" onclick="openDialogEditor()" title="Open immersive dialog editor">✎ Editor</button>`;
    html+=`</div>`;

    // ── Custom dialog tabs ──
    html+=`<div class="dlg-tab-row">`;
    html+=`<span class="dlg-tab-row-label">Custom</span>`;
    html+=d.dialogs.map((t,i)=>{
        const active=!_mainTabActive&&!_introTabActive&&curVanillaCat===null&&curTaskPoolTag===null&&i===curDlgTreeIdx;
        return `<div class="dlg-tree-tab${active?' active':''}" onclick="${active?'':'selectCustomDialog('+i+')'}"><span spellcheck="false" onclick="${active?'event.stopPropagation();_startTabRename(this,'+i+')':''}" style="cursor:${active?'text':'pointer'}">${esc(t.label||('Dialog '+(i+1)))}</span>${d.dialogs.length>1?`<button class="dlg-tab-del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();deleteDialogTree(${i})" title="Delete dialog">✕</button>`:''}</div>`;
    }).join('');
    html+=`<button class="btn b2 bs" style="padding:4px 10px;font-size:12px" onclick="addDialogTree()">+ Add Dialog</button>`;
    html+=`<button class="btn b2 bs" style="padding:4px 10px;font-size:12px" onclick="duplicateCurrentDialog()" title="Duplicate entire current dialog tree">⧉ Duplicate</button>`;
    html+=`</div>`;

    // ── Vanilla category tabs ──
    const kept=STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id));
    if(kept.length||stripped.length){
        html+=`<div class="dlg-tab-row">`;
        html+=`<span class="dlg-tab-row-label">Vanilla</span>`;
        kept.forEach(cat=>{
            const active=!_mainTabActive&&curVanillaCat===cat.id;
            html+=`<div class="dlg-tree-tab vanilla-cat${active?' active':''}" onclick="selectVanillaCat('${cat.id}')" style="${active?'':'border-color:#555;'}"><span style="color:${active?'#ffe082':'#999'};font-size:11px">${esc(cat.label)}</span><button class="dlg-tab-del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();stripVanillaCat('${cat.id}')" title="Strip ${cat.label}">✕</button></div>`;
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

    // ── Defined pool tabs ──
    const tPools=Array.isArray(d.taskPools)?d.taskPools:[];
    if(tPools.length){
        html+=`<div class="dlg-tab-row">`;
        html+=`<span class="dlg-tab-row-label">Defined Pools</span>`;
        tPools.forEach(pool=>{
            const active=curTaskPoolTag===pool.tag;
            const lbl=pool.tag.charAt(0).toUpperCase()+pool.tag.slice(1);
            html+=`<div class="dlg-tree-tab task-pool task-pool-defined${active?' active':''}" onclick="selectTaskPool('${esc(pool.tag)}')" style="${active?'':'border-color:#555;'}"><span style="color:${active?'#ffb74d':'#999'};font-size:11px">${esc(lbl)}</span></div>`;
        });
        html+=`</div>`;
    }

    // ── Custom pool tabs ──
    const cPools=Array.isArray(d.customPools)?d.customPools:[];
    if(cPools.length){
        html+=`<div class="dlg-tab-row">`;
        html+=`<span class="dlg-tab-row-label">Narrative Pools</span>`;
        cPools.forEach(pool=>{
            const active=curTaskPoolTag===pool.tag;
            html+=`<div class="dlg-tree-tab task-pool${active?' active':''}" onclick="selectTaskPool('${esc(pool.tag)}')" style="${active?'':'border-color:#555;'}"><span style="color:${active?'#82b1ff':'#999'};font-size:11px">📋 ${esc(pool.tag)}</span></div>`;
        });
        html+=`</div>`;
    }

    tabsEl.innerHTML=html;
    if(typeof syncGraphFsTreeTabs==='function')syncGraphFsTreeTabs();
}

function selectCustomDialog(idx){
    _mainTabActive=false;
    _introTabActive=false;
    curVanillaCat=null;
    curTaskPoolTag=null;
    switchDialogTree(idx);
}
function selectMainTab(){
    _mainTabActive=true;
    _introTabActive=false;
    curVanillaCat=null;
    curTaskPoolTag=null;
    selectedBranchPath='';
    renderDialogTreeTabs();
    renderBranches();
}
function selectIntroTab(){
    _mainTabActive=false;
    _introTabActive=true;
    curVanillaCat=null;
    curTaskPoolTag=null;
    selectedBranchPath='';
    // Ensure intro dialog tree exists
    var d=getDlg();
    if(d&&!d.introDialog){
        d.introDialog={introGreeting:'',opener:'',openerNpc:'',hub:'',hubChoices:[],nodes:{},layout:{}};
    }
    renderDialogTreeTabs();
    renderBranches();
}
function selectVanillaCat(catId){
    _mainTabActive=false;
    _introTabActive=false;
    curVanillaCat=catId;
    curTaskPoolTag=null;
    renderDialogTreeTabs();
    const tree=getVanillaTree(catId);
    if(tree){
        renderDialogInsights(tree);
    }
}
function selectTaskPool(tag){
    _mainTabActive=false;
    _introTabActive=false;
    curVanillaCat=null;
    curTaskPoolTag=tag;
    curTaskPoolDlgIdx=0;
    renderDialogTreeTabs();
    const tree=getTaskPoolTree(tag);
    if(tree){
        renderDialogInsights(tree);
    }
}
function getVanillaTree(catId){
    const d=getDlg();if(!d)return null;
    if(!d.vanillaDialogs)d.vanillaDialogs={};
    if(!d.vanillaDialogs[catId]){
        const def=VANILLA_DIALOG_DEFAULTS[catId];
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

