// ═══════════════════════════════════════════
// ITEM BROWSER WIDGET
// ═══════════════════════════════════════════
// Category colors — vanilla debug menu categories
const _IB_CAT_COLORS={
    w_rifle:'#c084fc',w_pistol:'#d8b4fe',w_shotgun:'#a78bfa',w_smg:'#b39ddb',w_sniper:'#9575cd',w_explosive:'#ef5350',w_melee:'#e0e0e0',w_misc:'#b0bec5',
    w_ammo:'#fb923c',
    o_helmet:'#42a5f5',o_medium:'#60a5fa',o_heavy:'#1e88e5',i_attach:'#5c6bc0',
    i_arty:'#34d399',i_arty_cont:'#2dd4bf',
    i_device:'#f87171',
    i_part:'#facc15',
    i_food:'#66bb6a',i_drink:'#26c6da',i_medical:'#ef5350',
    i_kit:'#ffa726',i_tool:'#ffa726',i_repair:'#ff7043',
    i_mutant_part:'#8d6e63',i_misc:'#94a3b8',i_letter:'#b0bec5',i_quest:'#ce93d8',i_upgrade:'#ffca28'
};
// Category dropdown options — grouped like vanilla debug menu
const _IB_CAT_OPTS=[
    ['all','All'],
    ['w_rifle','Weapons (Rifle)'],['w_pistol','Weapons (Pistol)'],['w_shotgun','Weapons (Shotgun)'],
    ['w_smg','Weapons (SMG)'],['w_sniper','Weapons (Sniper)'],['w_explosive','Weapons (Explosive)'],
    ['w_melee','Weapons (Melee)'],['w_misc','Weapons (Misc.)'],['w_ammo','Weapons (Ammo)'],
    ['o_helmet','Helmets'],['o_medium','Outfits (Medium)'],['o_heavy','Outfits (Heavy)'],['i_attach','Outfits (Attachments)'],
    ['i_arty','Artefacts'],['i_arty_cont','Artefacts (Container)'],
    ['i_food','Items (Food)'],['i_drink','Items (Drink)'],['i_medical','Items (Medical)'],
    ['i_device','Items (Device)'],['i_kit','Items (Tool)'],['i_repair','Items (Repair)'],
    ['i_part','Items (Parts)'],['i_mutant_part','Items (Mutant Parts)'],['i_misc','Items (Misc.)'],
    ['i_letter','Items (Note)'],['i_quest','Items (Quest)'],['i_upgrade','Items (Upgrades)']
];
// Auto-slot assignment for spawn loadout: cat → primary/secondary/extra
const SPAWN_SLOT_MAP={
    w_rifle:'primary',w_shotgun:'primary',w_smg:'primary',w_sniper:'primary',w_explosive:'primary',
    w_pistol:'secondary',w_melee:'secondary'
};
function getSpawnSlotForCat(cat){return SPAWN_SLOT_MAP[cat]||'extra';}
let _ibUidSeq=0;
let _ibReturnFocusEl=null; // set by spawn/trade textarea Tab-link so list knows where to return

function renderItemBrowser(containerEl,config){
    if(containerEl._ibCfg===config)return;
    containerEl._ibCfg=config;
    const uid='ib'+(++_ibUidSeq);
    containerEl.dataset.ibuid=uid;
    const catHtml=_IB_CAT_OPTS
        .filter(([v])=>!config.filterCats||(v==='all'||config.filterCats.includes(v)))
        .map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    const valHtml=config.extraField?`<input id="${uid}_v" class="ib-count" type="${config.extraField==='count'?'number':'text'}" value="${esc(String(config.extraDefault!=null?config.extraDefault:1))}" placeholder="${esc(config.extraLabel||'')}" title="${esc(config.extraLabel||'Value')}"${config.extraField==='count'?' min="0"':''}>`:'';
    containerEl.innerHTML=`<div class="item-browser">
        ${config.label?`<div style="font-size:11px;color:#bbb;margin-bottom:5px">${esc(config.label)}</div>`:''}
        <div class="item-browser-search">
            <input id="${uid}_s" type="text" placeholder="Search items…" autocomplete="off">
            <select id="${uid}_src" style="display:none"></select>
            <select id="${uid}_c">${catHtml}</select>
            ${valHtml}
        </div>
        <select class="item-browser-list" id="${uid}_l" size="8"></select>
    </div>`;
    containerEl._ibState={filter:'',cat:'all',source:'all'};
    document.getElementById(uid+'_s').addEventListener('input',e=>{
        containerEl._ibState.filter=e.target.value.toLowerCase();
        _ibRenderCatalog(containerEl);
    });
    document.getElementById(uid+'_c').addEventListener('change',e=>{
        containerEl._ibState.cat=e.target.value;
        _ibRenderCatalog(containerEl);
    });
    document.getElementById(uid+'_src').addEventListener('change',e=>{
        containerEl._ibState.source=e.target.value;
        _ibRenderCatalog(containerEl);
    });
    const listEl2=document.getElementById(uid+'_l');
    const searchEl2=document.getElementById(uid+'_s');
    listEl2.addEventListener('dblclick',()=>{
        if(!listEl2.value)return;
        const valEl=document.getElementById(uid+'_v');
        _ibAddItem(containerEl,listEl2.value,valEl?valEl.value:null);
    });
    // Visual link: list highlights when search is focused or when externally tabbed in
    searchEl2.addEventListener('focus',()=>listEl2.classList.add('ib-linked'));
    searchEl2.addEventListener('blur',e=>{if(e.relatedTarget!==listEl2)listEl2.classList.remove('ib-linked');});
    listEl2.addEventListener('focus',()=>listEl2.classList.add('ib-linked'));
    listEl2.addEventListener('blur',e=>{
        const s=document.getElementById(uid+'_s');
        if(e.relatedTarget!==s&&e.relatedTarget!==_ibReturnFocusEl)listEl2.classList.remove('ib-linked');
    });
    // Tab: search → list
    searchEl2.addEventListener('keydown',e=>{
        if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();listEl2.focus();}
    });
    // Tab/Escape/Enter on list
    listEl2.addEventListener('keydown',e=>{
        if(e.key==='Tab'||e.key==='Escape'){
            e.preventDefault();
            listEl2.classList.remove('ib-linked');
            const ret=_ibReturnFocusEl;_ibReturnFocusEl=null;
            (ret||searchEl2).focus();
        } else if(e.key==='Enter'){
            e.preventDefault();
            if(!listEl2.value)return;
            const valEl=document.getElementById(uid+'_v');
            _ibAddItem(containerEl,listEl2.value,valEl?valEl.value:null);
            if(_ibReturnFocusEl){
                listEl2.classList.remove('ib-linked');
                const ret=_ibReturnFocusEl;_ibReturnFocusEl=null;
                ret.focus();
            }
        } else if(e.key==='Backspace'||(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey)){
            // Redirect typing to search box without losing list focus
            e.preventDefault();
            if(e.key==='Backspace') searchEl2.value=searchEl2.value.slice(0,-1);
            else searchEl2.value+=e.key;
            containerEl._ibState.filter=searchEl2.value.toLowerCase();
            _ibRenderCatalog(containerEl);
            listEl2.focus();
        }
    });
    _ibRenderCatalog(containerEl);
}

function _ibGetSourceOpts(){
    const seen=new Set();
    ITEM_CATALOG.forEach(it=>{if(it&&it._source)seen.add(it._source);});
    const opts=[['all','All Sources'],['vanilla','Vanilla']];
    seen.forEach(s=>opts.push([s,s]));
    return opts;
}

function _ibRenderCatalog(containerEl){
    const st=containerEl._ibState;
    const cfg=containerEl._ibCfg;
    const uid=containerEl.dataset.ibuid;
    const listEl=document.getElementById(uid+'_l');
    if(!listEl)return;
    // Update source dropdown
    const srcEl=document.getElementById(uid+'_src');
    if(srcEl){
        const srcOpts=_ibGetSourceOpts();
        if(srcOpts.length>2){
            srcEl.style.display='';
            const cur=st.source||'all';
            srcEl.innerHTML=srcOpts.map(([v,l])=>`<option value="${v}"${v===cur?' selected':''}>${esc(l)}</option>`).join('');
        } else {
            srcEl.style.display='none';
        }
    }
    const f=st.filter,cat=st.cat,source=st.source||'all';
    const all=ITEM_CATALOG.filter(it=>{
        if(cat!=='all'&&it.cat!==cat)return false;
        if(cfg.filterCats&&!cfg.filterCats.includes(it.cat))return false;
        if(source!=='all'){const s=it._source||'vanilla';if(s!==source)return false;}
        if(f&&!it.name.toLowerCase().includes(f)&&!it.id.toLowerCase().includes(f))return false;
        return true;
    });
    const _ibOptHtml=it=>`<option value="${esc(it.id)}">${esc(it.name)} [${esc(it.id)}]</option>`;
    if(source==='all'&&_ibGetSourceOpts().length>2){
        const groups=new Map();
        all.forEach(it=>{const s=it._source||'vanilla';if(!groups.has(s))groups.set(s,[]);groups.get(s).push(it);});
        const order=['vanilla',...[...groups.keys()].filter(k=>k!=='vanilla')];
        listEl.innerHTML=order.filter(k=>groups.has(k)).map(k=>{
            const label=k==='vanilla'?'Vanilla':k;
            return`<optgroup label="${esc(label)}">${groups.get(k).map(_ibOptHtml).join('')}</optgroup>`;
        }).join('');
    } else {
        listEl.innerHTML=all.map(_ibOptHtml).join('');
    }
}

function _ibAddItem(containerEl,id,extraOverride){
    const cfg=containerEl._ibCfg;
    if(!id)return;
    const list=cfg.getList();
    if(cfg.maxItems&&list.length>=cfg.maxItems){
        setStatus('Item list is full (max '+cfg.maxItems+').','warn');
        return;
    }
    const extra=extraOverride!=null?extraOverride:(cfg.extraDefault!=null?cfg.extraDefault:1);
    cfg.setList([...list,cfg.serializeItem({id,extra})]);
}


// ── Spawn Browser (unified textarea — auto-sorts to primary/secondary/extra on save) ──

// Look up catalog cat for a section ID
function _catForSection(id){
    const it=ITEM_CATALOG.find(i=>i.id===id);
    return it?it.cat:'i_misc';
}

// Merge 3 internal slots into one display string for the unified textarea
function mergeSpawnSlots(s){
    const lines=[];
    String(s.spawnPrimary||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>lines.push(l));
    String(s.spawnSecondary||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>lines.push(l));
    String(s.spawnExtra||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>lines.push(l));
    return lines.join('\n');
}

// Split unified textarea lines into 3 slots and save
function splitAndSaveSpawnSlots(allText){
    const lines=String(allText||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const primary=[],secondary=[],extra=[];
    lines.forEach(line=>{
        const sec=line.split(':')[0].trim();
        const slot=getSpawnSlotForCat(_catForSection(sec));
        if(slot==='primary')primary.push(line);
        else if(slot==='secondary')secondary.push(line);
        else extra.push(line);
    });
    saveField('spawnPrimary',primary.join('\n'));
    saveField('spawnSecondary',secondary.join('\n'));
    saveField('spawnExtra',extra.join('\n'));
}

// Called on textarea input
function onSpawnAllChange(val){
    splitAndSaveSpawnSlots(val);
    updateSpawnSlotPreview(getD('settings'));
    _debouncedLint();
}

// Show slot preview below textarea
function updateSpawnSlotPreview(s){
    const box=document.getElementById('spawnSlotPreview');
    if(!box)return;
    const pC=String(s.spawnPrimary||'').split('\n').filter(l=>l.trim()).length;
    const sC=String(s.spawnSecondary||'').split('\n').filter(l=>l.trim()).length;
    const eC=String(s.spawnExtra||'').split('\n').filter(l=>l.trim()).length;
    box.innerHTML=`<span style="color:#c084fc">Primary: ${pC}</span> · <span style="color:#d8b4fe">Secondary: ${sC}</span> · <span style="color:#fb923c">Extra: ${eC}</span>`;
}

// Format line for the correct slot
function _spawnLineForSlot(sectionId,chance,slot){
    if(slot==='extra')return`${sectionId}:${chance!=null?chance:100}`;
    return`${sectionId}:0:0:${chance!=null?chance:100}`;
}

// Unified item picker
function _updateSpawnPickSrc(){
    const srcEl=document.getElementById('spawnPickSrc');
    if(!srcEl)return;
    const opts=_ibGetSourceOpts();
    if(opts.length>2){
        const cur=srcEl.value||'all';
        srcEl.innerHTML=opts.map(([v,l])=>`<option value="${v}"${v===cur?' selected':''}>${esc(l)}</option>`).join('');
        srcEl.style.display='';
    } else {
        srcEl.style.display='none';
    }
}
function updateSpawnItemSelect(){
    _updateSpawnPickSrc();
    const cat=(document.getElementById('spawnPickCat')||{}).value||'all';
    const src=(document.getElementById('spawnPickSrc')||{}).value||'all';
    const f=((document.getElementById('spawnPickSearch')||{}).value||'').toLowerCase();
    const sel=document.getElementById('spawnPickItem');
    if(!sel)return;
    const items=(ITEM_CATALOG||[]).filter(it=>{
        if(cat!=='all'&&it.cat!==cat)return false;
        if(src!=='all'){const s=it._source||'vanilla';if(s!==src)return false;}
        if(f&&!it.name.toLowerCase().includes(f)&&!it.id.toLowerCase().includes(f))return false;
        return true;
    });
    function _optHtml(it){
        const slot=getSpawnSlotForCat(it.cat);
        const slotTag=slot==='primary'?'[P]':slot==='secondary'?'[S]':'[E]';
        return`<option value="${esc(it.id)}">${slotTag} ${esc(it.name)} [${esc(it.id)}]</option>`;
    }
    if(src==='all'&&_ibGetSourceOpts().length>2){
        // Group by source using optgroup
        const groups=new Map();
        items.forEach(it=>{
            const s=it._source||'vanilla';
            if(!groups.has(s))groups.set(s,[]);
            groups.get(s).push(it);
        });
        // Vanilla first, then scanned catalogs
        const order=['vanilla',...[...groups.keys()].filter(k=>k!=='vanilla')];
        sel.innerHTML=order.filter(k=>groups.has(k)).map(k=>{
            const label=k==='vanilla'?'Vanilla':k;
            return`<optgroup label="${esc(label)}">${groups.get(k).map(_optHtml).join('')}</optgroup>`;
        }).join('');
    } else {
        sel.innerHTML=items.map(_optHtml).join('');
    }
}
function addSpawnPickerItem(){
    const id=(document.getElementById('spawnPickItem')||{}).value;
    if(!id)return;
    const chance=(document.getElementById('spawnPickChance')||{}).value||100;
    const slot=getSpawnSlotForCat(_catForSection(id));
    const line=_spawnLineForSlot(id,chance,slot);
    const ta=document.getElementById('f_spawnAll');
    if(ta){
        const cur=ta.value.trim();
        ta.value=cur?(cur+'\n'+line):line;
    }
    splitAndSaveSpawnSlots(ta?ta.value:'');
    updateSpawnSlotPreview(getD('settings'));
    runTradeLoadoutLint();
    // Show compat popup if weapon has known ammo/attachments
    showSpawnCompat(id,chance);
}

// ── Weapon compat popup ──
function _compatItemName(id){
    const it=ITEM_CATALOG.find(i=>i.id===id);
    return it?it.name:id;
}
function showSpawnCompat(weaponId,defaultChance){
    const compat=(window.WEAPON_COMPAT||{})[weaponId];
    if(!compat)return; // no compat data — skip silently
    const popup=document.getElementById('spawnCompatPopup');
    const title=document.getElementById('spawnCompatTitle');
    const body=document.getElementById('spawnCompatBody');
    if(!popup||!body)return;
    const wName=_compatItemName(weaponId);
    title.textContent='Add-ons for '+wName;
    let html='';
    const groups=[
        ['ammo','Ammo','#fb923c'],
        ['silencer','Silencer','#94a3b8'],
        ['gl','Grenade Launcher','#ef5350']
    ];
    for(const [key,label,color] of groups){
        const items=compat[key];
        if(!items||!items.length)continue;
        html+=`<div style="margin-bottom:6px"><div style="color:${color};font-size:11px;font-weight:bold;margin-bottom:3px">${label}</div>`;
        for(const id of items){
            const name=_compatItemName(id);
            const slot=getSpawnSlotForCat(_catForSection(id));
            const slotTag=slot==='primary'?'[P]':slot==='secondary'?'[S]':'[E]';
            html+=`<label style="display:flex;align-items:center;gap:5px;padding:1px 0;cursor:pointer">
                <input type="checkbox" value="${esc(id)}" data-compat-slot="${slot}" checked style="margin:0">
                <span style="color:#999;font-size:10px">${slotTag}</span>
                <span style="color:#ccc">${esc(name)}</span>
                <span style="color:#888;font-size:10px">[${esc(id)}]</span>
                <input type="number" min="0" max="100" value="${defaultChance}" class="ib-count" style="width:46px;margin-left:auto;font-size:10px" data-compat-chance>
            </label>`;
        }
        html+='</div>';
    }
    if(!html){popup.style.display='none';return;} // nothing to show
    body.innerHTML=html;
    // Move to body so fixed positioning works (parent transforms can break it)
    if(popup.parentElement!==document.body) document.body.appendChild(popup);
    popup.style.display='';
    popup.style.left='50%';
    popup.style.top='50%';
    popup.style.transform='translate(-50%,-50%)';
    // Click-outside listener
    setTimeout(()=>{
        const handler=e=>{
            if(!popup.contains(e.target)){
                closeSpawnCompat();
                document.removeEventListener('mousedown',handler,true);
            }
        };
        popup._outsideHandler=handler;
        document.addEventListener('mousedown',handler,true);
    },0);
}
function closeSpawnCompat(){
    const popup=document.getElementById('spawnCompatPopup');
    if(!popup)return;
    popup.style.display='none';
    if(popup._outsideHandler){
        document.removeEventListener('mousedown',popup._outsideHandler,true);
        popup._outsideHandler=null;
    }
}
function addSpawnCompatItems(){
    const body=document.getElementById('spawnCompatBody');
    if(!body)return;
    const checks=body.querySelectorAll('input[type="checkbox"]:checked');
    const ta=document.getElementById('f_spawnAll');
    const lines=[];
    checks.forEach(cb=>{
        const id=cb.value;
        const slot=cb.dataset.compatSlot||'extra';
        const chanceEl=cb.closest('label').querySelector('[data-compat-chance]');
        const chance=chanceEl?chanceEl.value:'100';
        lines.push(_spawnLineForSlot(id,chance,slot));
    });
    if(ta&&lines.length){
        const cur=ta.value.trim();
        ta.value=cur?(cur+'\n'+lines.join('\n')):lines.join('\n');
        splitAndSaveSpawnSlots(ta.value);
        updateSpawnSlotPreview(getD('settings'));
        runTradeLoadoutLint();
    }
    closeSpawnCompat();
}

// ── Item browser config objects (initialized at DOMContentLoaded) ──
let IB_TRADE_BUY,IB_TRADE_SELL,IB_TRADE_SUPPLY;

// ── Trade browser collapse state ──
const _tradeIbOpen={};
function toggleTradeIb(hostId){
    _tradeIbOpen[hostId]=!_tradeIbOpen[hostId];
    const host=document.getElementById(hostId);
    const tog=host?.previousElementSibling;
    if(_tradeIbOpen[hostId]){
        if(tog)tog.classList.remove('collapsed');
        if(host){host.style.display='';host._ibCfg=null;_initTradeIb(hostId,host);}
    } else {
        if(tog)tog.classList.add('collapsed');
        if(host){host.style.display='none';host._ibCfg=null;host.innerHTML='';}
    }
}
function _initTradeIb(hostId,host){
    if(hostId==='ib_trade_buy')renderItemBrowser(host,IB_TRADE_BUY);
    else if(hostId==='ib_trade_sell')renderItemBrowser(host,IB_TRADE_SELL);
    else if(hostId==='ib_trade_supply')renderItemBrowser(host,IB_TRADE_SUPPLY);
}

function initItemBrowsers(){
    function parseTrade(raw){const p=raw.trim().split(':');return{id:p[0]||'',extra:(p[1]||'1')+':'+(p[2]||'1')};}
    function serTrade(o){const e=String(o.extra||'1:1').split(':');return`${o.id}:${e[0]||'1'}:${e[1]||'1'}`;}
    function updTrade(raw,v){const p=raw.trim().split(':');const e=String(v).split(':');p[1]=e[0]||'1';p[2]=e[1]||'1';return p.slice(0,3).join(':');}
    IB_TRADE_BUY={
        getList:()=>{const ta=document.getElementById('f_tradeBuyList');return(ta?ta.value:'').split('\n').filter(s=>s.trim());},
        setList:(lines)=>{const ta=document.getElementById('f_tradeBuyList');if(!ta)return;ta.value=lines.join('\n');saveTradeField('buyListRaw',ta.value);runTradeLoadoutLint();},
        parseItem:parseTrade,serializeItem:serTrade,updateExtra:updTrade,
        extraField:'mult',extraLabel:'Base:Mult',extraDefault:'1:1'
    };
    IB_TRADE_SELL={
        getList:()=>{const ta=document.getElementById('f_tradeSellList');return(ta?ta.value:'').split('\n').filter(s=>s.trim());},
        setList:(lines)=>{const ta=document.getElementById('f_tradeSellList');if(!ta)return;ta.value=lines.join('\n');saveTradeField('sellListRaw',ta.value);runTradeLoadoutLint();},
        parseItem:parseTrade,serializeItem:serTrade,updateExtra:updTrade,
        extraField:'mult',extraLabel:'Base:Mult',extraDefault:'1:1'
    };
    IB_TRADE_SUPPLY={
        getList:()=>{const ta=document.getElementById('f_tradeSupplyList');return(ta?ta.value:'').split('\n').filter(s=>s.trim());},
        setList:(lines)=>{const ta=document.getElementById('f_tradeSupplyList');if(!ta)return;ta.value=lines.join('\n');saveTradeField('supplyListRaw',ta.value);runTradeLoadoutLint();},
        parseItem:(raw)=>{const p=raw.trim().split(':');return{id:p[2]||'',extra:p[0]+':'+p[1]+':'+p[3]+':'+p[4]};},
        serializeItem:(o)=>{const e=String(o.extra||'stock_0:0:1:0.6').split(':');return(e[0]||'stock_0')+':'+(e[1]||'0')+':'+o.id+':'+(e[2]||'1')+':'+(e[3]||'0.6');},
        extraField:null,maxItems:null,dblClickAdd:true
    };
}

// Task item browser configs (inline in task cards)
function makeTaskItemConfig(taskIdx,field){
    return{
        getList:()=>{const tasks=getTaskList();const t=tasks[taskIdx];if(!t)return[];return String(t[field]||'').split('\n').map(l=>l.trim()).filter(Boolean);},
        setList:(lines)=>{saveTaskField(taskIdx,field,lines.join('\n'));_updateTaskChips(taskIdx,field);},
        parseItem:(raw)=>({id:raw.split(':')[0].trim(),extra:parseInt(raw.split(':')[1])||1}),
        serializeItem:(o)=>o.id+(o.extra>1?':'+o.extra:''),
        updateExtra:null,extraField:null,maxItems:1,dblClickAdd:true
    };
}

// Shopping list config (deduplicates by section, merges counts)
function makeTaskShoppingConfig(taskIdx){
    return{
        getList:()=>{const t=getTaskList()[taskIdx];if(!t)return[];return String(t.shoppingItems||'').split('\n').map(l=>l.trim()).filter(Boolean);},
        setList:(lines)=>{
            const map={},order=[];
            lines.forEach(l=>{const p=l.split(':'),s=p[0].trim(),c=parseInt(p[1])||1;
                if(map[s])map[s]+=c;else{map[s]=c;order.push(s);}});
            saveTaskField(taskIdx,'shoppingItems',order.map(s=>s+':'+map[s]).join('\n'));
            _updateTaskChips(taskIdx,'shoppingItems');
        },
        parseItem:(raw)=>({id:raw.split(':')[0].trim(),extra:parseInt(raw.split(':')[1])||1}),
        serializeItem:(o)=>o.id+':'+(o.extra||1),
        updateExtra:null,extraDefault:1,extraField:null,maxItems:null,dblClickAdd:true
    };
}

// Reward config (deduplicates by section, merges counts)
function makeTaskRewardConfig(taskIdx){
    return{
        getList:()=>{const t=getTaskList()[taskIdx];if(!t)return[];return String(t.reward||'').split('\n').map(l=>l.trim()).filter(Boolean);},
        setList:(lines)=>{
            const map={},order=[];
            lines.forEach(l=>{const p=l.split(':'),s=p[0].trim(),c=parseInt(p[1])||1;
                if(map[s])map[s]+=c;else{map[s]=c;order.push(s);}});
            saveTaskField(taskIdx,'reward',order.map(s=>map[s]>1?s+':'+map[s]:s).join('\n'));
            _updateTaskChips(taskIdx,'reward');
        },
        parseItem:(raw)=>({id:raw.split(':')[0].trim(),extra:parseInt(raw.split(':')[1])||1}),
        serializeItem:(o)=>o.extra>1?o.id+':'+o.extra:o.id,
        updateExtra:null,extraDefault:1,extraField:null,maxItems:null,dblClickAdd:true
    };
}

