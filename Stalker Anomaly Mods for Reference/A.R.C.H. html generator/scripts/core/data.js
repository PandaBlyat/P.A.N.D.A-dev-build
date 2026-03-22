// ═══════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════
const COMM=[['stalker','Loners'],['freedom','Freedom'],['dolg','Duty'],['ecolog','Ecologists'],['bandit','Bandits'],['killer','Mercenaries'],['army','Military'],['monolith','Monolith'],['csky','Clear Sky'],['renegade','Renegades'],['greh','Sin'],['isg','ISG']];
const LOCS=[['k00_marsh','Swamps'],['l01_escape','Cordon'],['l02_garbage','Garbage'],['l03_agroprom','Agroprom'],['k01_darkscape','Darkscape'],['l04_darkvalley','Dark Valley'],['l05_bar','Bar'],['l06_rostok','Wild Territory'],['l07_military','Army Warehouses'],['l08_yantar','Yantar'],['l09_deadcity','Dead City'],['l10_limansk','Limansk'],['l10_radar','Radar'],['l10_red_forest','Red Forest'],['l11_hospital','Hospital'],['l11_pripyat','Pripyat'],['l12_stancia','CNPP'],['l13_generators','Generators'],['jupiter','Jupiter'],['zaton','Zaton'],['pripyat','Pripyat Underground'],['labx8','Lab X-8'],['k02_trucks_cemetery','Truck Cemetery']];
const RANKS_D=[['novice','Novice'],['trainee','Trainee'],['experienced','Experienced'],['professional','Professional'],['veteran','Veteran'],['expert','Expert'],['master','Master'],['legend','Legend']];

function _debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}
let _debouncedLint=()=>{};  // replaced after runTradeLoadoutLint is defined

const DEFAULT_SETTINGS={namePrefix:'',nameFullName:'',nameSuffix:'',commMode:'inc',commVals:[],commExcVals:[],locMode:'inc',locVals:[],locExcVals:[],rankMode:'inc',rankVals:[],rankExcVals:[],male:true,female:true,buyMod:'0.85',sellMod:'1.15',ltxPath:'',amount:'1',tier:'3',chance:'100',availableAfterDays:'0',respawn:true,dialogProfile:'',dialogPriority:'1',specialization:'',dialogIdsCsv:'',spawnInherit:'',spawnPrimary:'',spawnSecondary:'',spawnExtra:'',enabled:true,newsOnDeath:'',newsOnArea:'',newsIcon:'',stripCategories:['trade','tasks','info'],dialogRemove:'',dialogAdd:'',tradePreset:'',goodwillMode:'',regularVisitThreshold:'',buyModPerTrust:'',sellModPerTrust:'',assignTo:''};
const STRIP_CATEGORIES=[
    {id:'trade',label:'Trade',desc:'dm_init_stalker_trade, dm_add_trade'},
    {id:'tasks',label:'Tasks',desc:'dm_ordered_task_dialog, dm_ordered_task_dialog2, etc.'},
    {id:'info',label:'Info',desc:'dm_encyclopedia_dialog, dm_storyline_dialog, dm_custom_story_dialog'}
];
const DIALOG_ACTIONS=[
    {id:'',label:'— No Action —'},
    {id:'dialogs.npc_is_trader',label:'Open Trade Window',category:'trade',note:'npc:start_trade(db.actor)'},
    {id:'dialogs.npc_is_tech',label:'Open Repair/Upgrade UI',category:'repair',note:'npc:start_upgrade(db.actor)',spec:'technician'},
    {id:'dialogs.heal_actor_injury',label:'Heal Player Health',category:'medic',note:'Heals health, power, bleeding (costs 1850 RU)',spec:'medic'},
    {id:'dialogs.heal_actor_radiation',label:'Heal Player Radiation',category:'medic',note:'Removes radiation (costs 1480 RU)',spec:'medic'},
    {id:'dialogs.npc_give_task',label:'Give First Available Task',category:'tasks',note:'Gives top task from axr_task_manager stack'},
    {id:'dialogs.generate_available_tasks',label:'Generate Task List (call before Give)',category:'tasks',note:'Populates available_tasks for NPC'}
];
const VANILLA_DIALOG_DEFAULTS={
    trade:{
        opener:'Got anything to sell?',
        hub:'Alright.',
        hubChoices:[
            {text:'[Trade]',next:'__end__',action:'dialogs.npc_is_trader'}
        ],
        nodes:{}
    },
    tasks:{
        opener:'Got any work for me?',
        hub:'I know where someone hid a good stash. If you find a PDA in there bring it to me, I\'ll pay you for it. Anything else you find is yours.',
        hubChoices:[
            {text:'I\'ll do it.',next:'task_accept',action:'dialogs.npc_give_task'},
            {text:'Have anything else?',next:'task_none'},
            {text:'Never mind.',next:'__end__'}
        ],
        nodes:{
            task_accept:{npc:'Good! Talk to me again when it\'s done.',label:'Task Accepted',choices:[{text:'Thanks.',next:'__end__'}]},
            task_none:{npc:'Sorry, don\'t have anything.',label:'No More Tasks',choices:[{text:'Never mind.',next:'__end__'}]}
        }
    },
    info:{
        opener:'I want to ask you something.',
        hub:'About what?',
        hubChoices:[
            {text:'I\'m looking for work.',next:'info_work'},
            {text:'What can you tell me about anomalies or artefacts?',next:'info_anomalies'},
            {text:'You know what\'s going on around here?',next:'info_news'},
            {text:'How do you manage to stay alive here?',next:'info_survival'},
            {text:'Never mind.',next:'__end__'}
        ],
        nodes:{
            info_work:{npc:'Well, if the local traders don\'t have anything for you, maybe try the regular guys? Most of them need help with one thing or another.',label:'Work',choices:[{text:'I want to ask you something.',next:'__hub__'}]},
            info_anomalies:{npc:'You ever seen a Vortex, man? They\'re damned near invisible, but one foot too close, and they\'ll pull you in and splatter you all over the place.',label:'Anomalies',choices:[{text:'I want to ask you something.',next:'__hub__'}]},
            info_news:{npc:'I don\'t have any information.',label:'News',choices:[{text:'I want to ask you something.',next:'__hub__'}]},
            info_survival:{npc:'You can keep asking the same shit, but I got nothing more to say.',label:'Survival',choices:[{text:'I want to ask you something.',next:'__hub__'}]}
        }
    }
};
const DEFAULT_TRADE={tradeParent:'',tradeCond:'0.5',tradeBuyExp:'1.0',tradeSellExp:'1.0',buyListRaw:'',sellListRaw:'',supplyListRaw:''};
const DEFAULT_DLG={dialogs:[{id:'dlg_1',label:'Dialog 1',opener:'I want to ask you something.',hub:'',hubChoices:[],nodes:{},layout:{}}],vanilla:{hello1:'',hello2:'',hello3:'',job:'',anomalies:'',information:'',tips:'',wounded:''},graph:{view:'tree'}};
const ITEM_CATALOG=Array.isArray(window.VANILLA_ITEM_CATALOG)
    ? window.VANILLA_ITEM_CATALOG
    : (Array.isArray(window.VANILLA_ITEM_SECTIONS)
        ? window.VANILLA_ITEM_SECTIONS.map(v=>({id:String(v||''),name:String(v||''),cat:'misc'}))
        : []);
const VANILLA_DIALOG_PREVIEW=window.ARCH_VANILLA_DIALOG_PREVIEW||{
    actor_options:{job:[],anomalies:[],information:[],tips:[]},
    npc_responses:{hello:[],job:[],anomalies:[],information:[],tips:[],wounded:[]}
};
const ITEM_LOOKUP_BY_ID={};
const ITEM_LOOKUP_BY_NAME={};
const ITEM_LOOKUP_BY_DISPLAY={};
ITEM_CATALOG.forEach(it=>{
    const id=String((it&&it.id)||'').trim();
    if(!id)return;
    const name=String((it&&it.name)||id).trim()||id;
    const key=id.toLowerCase();
    if(!ITEM_LOOKUP_BY_ID[key]){
        ITEM_LOOKUP_BY_ID[key]={id,name,cat:String((it&&it.cat)||'misc')};
    }
    const nk=name.toLowerCase();
    if(!ITEM_LOOKUP_BY_NAME[nk])ITEM_LOOKUP_BY_NAME[nk]=[];
    ITEM_LOOKUP_BY_NAME[nk].push({id,name,cat:String((it&&it.cat)||'misc')});
    const display=`${name} [${id}]`.toLowerCase();
    ITEM_LOOKUP_BY_DISPLAY[display]=id;
});

let groups=[];
let soloChars=[]; // standalone characters not belonging to any group
let savedCategories=[]; // global item categories: [{name, items:['section1','section2',...]}]
let editMode=null; // 'group'|'char'
let curGrp=null;   // index
let curChar=null;   // index within group
let curSolo=null; // index in soloChars when editMode==='solo'
let curDlgTreeIdx=0;
let selectedBranchPath='';
let _mainTabActive=true;
let _introTabActive=false;

// ═══════════════════════════════════════════
// CORE UTILITIES
// ═══════════════════════════════════════════
// Deep clone
function dc(o){return JSON.parse(JSON.stringify(o));}

function mkDefaults(){return{settings:dc(DEFAULT_SETTINGS),trade:dc(DEFAULT_TRADE),dlg:dc(DEFAULT_DLG)};}

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function buildMS(id,items,rankMode){
    // rankMode=true: only show one name since rank names are identical in-game and config
    const c=document.getElementById(id);
    items.forEach(([v,l])=>{
        const d=document.createElement('div');d.className='mi';
        const label=rankMode?l:`${l} (${v})`; // "Loners (stalker)" order, rank shows "Novice"
        d.innerHTML=`<input type="checkbox" value="${v}" onchange="saveFilter('${id}')"><label style="cursor:pointer">${label}</label>`;
        c.appendChild(d);
    });
}
function titleCaseWords(str){
    return String(str||'')
        .split(/\s+/)
        .filter(Boolean)
        .map(w=>w.charAt(0).toUpperCase()+w.slice(1))
        .join(' ');
}
function clampNumber(v,min,max,fallback){
    const n=Number(v);
    if(!Number.isFinite(n))return fallback;
    if(n<min)return min;
    if(n>max)return max;
    return n;
}
let _zoomLevel=1;
const _globalZoomSteps=[1,1.1,1.2,1.3,1.5,1.75,2];
function adjustZoom(delta){
    let idx=_globalZoomSteps.findIndex(s=>Math.abs(s-_zoomLevel)<0.01);
    if(idx<0)idx=0;
    idx=Math.max(0,Math.min(_globalZoomSteps.length-1,idx+(delta>0?1:-1)));
    _setGlobalZoom(_globalZoomSteps[idx]);
}
function _setGlobalZoom(val){
    _zoomLevel=val;
    document.getElementById('appRoot').style.zoom=_zoomLevel;
    const lbl=document.getElementById('globalZoomLabel');
    if(lbl)lbl.textContent=Math.round(_zoomLevel*100)+'%';
    _closeGlobalZoomDropdown();
}
function toggleGlobalZoomDropdown(el){
    var existing=document.getElementById('globalZoomDrop');
    if(existing){_closeGlobalZoomDropdown();return;}
    var dd=document.createElement('div');
    dd.id='globalZoomDrop';
    dd.className='global-zoom-dropdown';
    _globalZoomSteps.forEach(function(z){
        var b=document.createElement('button');
        b.textContent=Math.round(z*100)+'%';
        if(Math.abs(z-_zoomLevel)<0.01)b.className='active';
        b.onclick=function(e){e.stopPropagation();_setGlobalZoom(z);};
        dd.appendChild(b);
    });
    el.style.position='relative';
    el.appendChild(dd);
    document.removeEventListener('click',_closeGlobalZoomDropdown);
    setTimeout(function(){document.addEventListener('click',_closeGlobalZoomDropdown);},0);
}
function _closeGlobalZoomDropdown(){
    var d=document.getElementById('globalZoomDrop');
    if(d)d.remove();
    document.removeEventListener('click',_closeGlobalZoomDropdown);
}
function setStatus(msg,type){
    const el=document.getElementById('statusStrip');
    if(!el)return;
    el.classList.remove('ok','warn','err');
    if(type==='ok')el.classList.add('ok');
    else if(type==='warn')el.classList.add('warn');
    else if(type==='err')el.classList.add('err');
    el.textContent=String(msg||'Ready.');
}
function classifyItemSection(sec){
    const s=String(sec||'').toLowerCase();
    if(!s)return 'misc';
    if(s.indexOf('ammo_')===0)return 'ammo';
    if(s.indexOf('wpn_')===0)return 'weapon';
    if(s.indexOf('af_')===0)return 'artifact';
    if(s.indexOf('prt_')===0)return 'parts';
    if(s.indexOf('detector_')===0||s.indexOf('device_')===0||s==='binoc'||s==='wpn_binoc')return 'device';
    if(s.indexOf('_outfit')>0||s.indexOf('helm_')===0||s.indexOf('exo')>=0||s.indexOf('armor')>=0)return 'armor';
    if(s.indexOf('medkit')===0||s.indexOf('bandage')===0||s.indexOf('drug_')===0||s.indexOf('cigarette')===0||s.indexOf('vodka')===0||s.indexOf('water')>=0||s.indexOf('food')>=0||s.indexOf('bread')>=0||s.indexOf('energy_drink')===0)return 'consumable';
    return 'misc';
}
function buildItemListByCategory(cat){
    const all=ITEM_CATALOG.map(it=>{
        const id=String((it&&it.id)||'').trim();
        if(!id)return null;
        const name=String((it&&it.name)||id).trim();
        const c=String((it&&it.cat)||classifyItemSection(id)).trim()||'misc';
        return {id,name,cat:c};
    }).filter(Boolean);
    if(!cat||cat==='all')return all;
    return all.filter(v=>v.cat===cat);
}
function resolveItemSection(raw){
    const txt=String(raw||'').trim();
    if(!txt)return '';
    const byId=ITEM_LOOKUP_BY_ID[txt.toLowerCase()];
    if(byId)return byId.id;
    const byDisplay=ITEM_LOOKUP_BY_DISPLAY[txt.toLowerCase()];
    if(byDisplay)return byDisplay;
    const m=txt.match(/\[([^\]]+)\]\s*$/);
    if(m){
        const cand=String(m[1]||'').trim();
        const hit=ITEM_LOOKUP_BY_ID[cand.toLowerCase()];
        if(hit)return hit.id;
    }
    const byName=ITEM_LOOKUP_BY_NAME[txt.toLowerCase()];
    if(byName&&byName.length===1)return byName[0].id;
    return txt;
}

// ═══════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════
function showTip(e,t,b){e.stopPropagation();e.preventDefault();const p=document.getElementById('tipPop');document.getElementById('tipT').textContent=t;document.getElementById('tipB').innerHTML=b.replace(/\n/g,'<br>');p.classList.add('show');const r=e.target.getBoundingClientRect();let top=r.bottom+8,left=r.left;if(left+380>window.innerWidth)left=window.innerWidth-400;if(left<10)left=10;if(top+300>window.innerHeight)top=r.top-310;p.style.top=top+'px';p.style.left=left+'px';}
function closeTip(){document.getElementById('tipPop').classList.remove('show');}
