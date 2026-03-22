// ═══════════════════════════════════════════
// TASKS SYSTEM (v5 — defined/custom pool split)
// ═══════════════════════════════════════════

// ── Collapse state (transient, survives re-render, not persisted) ──
const _taskDetailsOpen={};
const _taskIbOpen={};
// Saved categories are in global `savedCategories` array (persisted in project data)
let _catBrowserTaskIdx=-1; // which task has the category browser open
const TASK_RANKS=[['','— none —'],['novice','Novice'],['trainee','Trainee'],['experienced','Experienced'],['professional','Professional'],['veteran','Veteran'],['expert','Expert'],['master','Master'],['legend','Legend']];
const POOL_TAGS=['pool_tag_1','pool_tag_2','pool_tag_3','pool_tag_4','pool_tag_5','pool_tag_6','pool_tag_7','pool_tag_8','pool_tag_9','pool_tag_10'];
let _taskSubTab='defined';    // 'defined' | 'custom'
let _curTaskPoolIdx=0;
let _curCustomPoolIdx=0;
let _pendingFocusTaskIdx=-1; // index to scroll+focus after render
let _pendingDeleteIdx=-1;    // index awaiting confirm-delete
let _openKebabIdx=-1;        // index with kebab bar open

// ── Task linking (chain groups) ──
function _getLinkedGroup(taskIdx){
    const tasks=getTaskList();
    if(!tasks.length||taskIdx<0||taskIdx>=tasks.length)return[taskIdx];
    let start=taskIdx;
    while(start>0&&tasks[start-1]&&tasks[start-1].linkNext)start--;
    let end=taskIdx;
    while(end<tasks.length-1&&tasks[end]&&tasks[end].linkNext)end++;
    const group=[];
    for(let i=start;i<=end;i++)group.push(i);
    return group;
}
function toggleTaskLink(i){
    const tasks=getTaskList();
    if(i<0||i>=tasks.length-1)return;
    tasks[i].linkNext=!tasks[i].linkNext;
    if(tasks[i].linkNext){
        // Sync enabled/hidden state across the new group
        const group=_getLinkedGroup(i);
        const en=tasks[group[0]].enabled!==false;
        const hid=!!tasks[group[0]].hidden;
        group.forEach(gi=>{tasks[gi].enabled=en;tasks[gi].hidden=hid;});
    }
    // Auto-set requires_task_done chain
    _syncChainRequirements();
    autoSave();renderTaskList();
}
// Auto-set requires_task_done based on linked card chain position
function _syncChainRequirements(){
    var tasks=getTaskList();
    if(!tasks.length)return;
    var visited=new Set();
    for(var i=0;i<tasks.length;i++){
        if(visited.has(i))continue;
        var group=_getLinkedGroup(i);
        group.forEach(function(gi){visited.add(gi);});
        if(group.length<2)continue;
        // First in chain: clear requires_task_done (unless manually set to something outside chain)
        var chainIds=group.map(function(gi){return tasks[gi].id;});
        // For each card after the first, set requires_task_done to the previous card's ID
        for(var j=0;j<group.length;j++){
            var t=tasks[group[j]];
            if(j===0){
                // First card: only clear if it was pointing to a chain sibling
                if(t.requiresTaskDone&&chainIds.indexOf(t.requiresTaskDone)>=0)t.requiresTaskDone='';
            } else {
                t.requiresTaskDone=tasks[group[j-1]].id;
            }
        }
    }
}
function toggleTaskEnabled(i){
    const tasks=getTaskList();
    const t=tasks[i];if(!t)return;
    const newVal=!(t.enabled!==false);
    const group=_getLinkedGroup(i);
    group.forEach(gi=>{tasks[gi].enabled=newVal;});
    autoSave();renderTaskList();
}

// ── SVG chain link builder ──
// Two SVG layers: back (z-index:1, behind cards) + front (z-index:3, above cards).
// Back: full chain visible through CSS mask holes.
// Front: RIGHT half of chain at card overlap areas — appears in front of card surface.
// Connector has NO z-index (no stacking context), so SVG z-indices work vs cards (z-index:2).
let _chainSvgUid=0;
function _buildChainSvg(){
    const u='ch'+(++_chainSvgUid);
    // SVG height=64. Connector margin:-16px. Card edges at y=16 and y=48.
    // Holes 12px inside card edge → y=4 (top), y=60 (bottom).
    // Link A: cy=22 ry=20 (y=2..42). Link B: cy=42 ry=20 (y=22..62).
    var vb=' width="40" height="64" viewBox="0 0 40 64"';
    // ── BACK SVG (z-index:1, behind cards) ──
    var back='<svg'+vb+' class="task-chain-back">'
        +'<defs>'
        +'<clipPath id="'+u+'L"><rect x="0" y="0" width="20" height="64"/></clipPath>'
        +'<clipPath id="'+u+'R"><rect x="20" y="0" width="20" height="64"/></clipPath>'
        +'</defs>';
    // Hole depth fills
    back+='<circle cx="20" cy="4" r="9" fill="#050505"/>'
        +'<circle cx="20" cy="4" r="8" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>'
        +'<circle cx="20" cy="60" r="9" fill="#050505"/>'
        +'<circle cx="20" cy="60" r="8" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>';
    // Full chain (interlocking)
    back+=_chainEllipse(u+'L',20,42,7,20);
    back+=_chainEllipse(null,20,22,7,20);
    back+=_chainEllipse(u+'R',20,42,7,20);
    // ── 3D depth: darken far sides, brighten near sides ──
    // Link A: left=near(bright), right=far(dark)
    back+='<ellipse cx="20" cy="22" rx="7" ry="20" fill="rgba(0,0,0,0.55)" clip-path="url(#'+u+'R)"/>';
    back+='<ellipse cx="19" cy="22" rx="5" ry="18" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" clip-path="url(#'+u+'L)"/>';
    back+='<ellipse cx="18.5" cy="22" rx="3.5" ry="16" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" clip-path="url(#'+u+'L)"/>';
    // Link B: right=near(bright), left=far(dark)
    back+='<ellipse cx="20" cy="42" rx="7" ry="20" fill="rgba(0,0,0,0.55)" clip-path="url(#'+u+'L)"/>';
    back+='<ellipse cx="21" cy="42" rx="5" ry="18" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" clip-path="url(#'+u+'R)"/>';
    back+='<ellipse cx="21.5" cy="42" rx="3.5" ry="16" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" clip-path="url(#'+u+'R)"/>';
    back+='</svg>';
    // ── FRONT SVG (z-index:3, above cards) ──
    // Link A (top, cy=22): LEFT half overlays top card
    // Link B (bottom, cy=42): RIGHT half overlays bottom card
    var front='<svg'+vb+' class="task-chain-front">'
        +'<defs>'
        +'<clipPath id="'+u+'FA"><rect x="0" y="0" width="20" height="16"/></clipPath>'
        +'<clipPath id="'+u+'FB"><rect x="20" y="48" width="20" height="16"/></clipPath>'
        +'</defs>';
    front+=_chainEllipse(u+'FA',20,22,7,20);  // Link A left half at top card
    front+='<ellipse cx="19" cy="22" rx="5" ry="18" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" clip-path="url(#'+u+'FA)"/>';
    front+=_chainEllipse(u+'FB',20,42,7,20);  // Link B right half at bottom card
    front+='<ellipse cx="21" cy="42" rx="5" ry="18" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" clip-path="url(#'+u+'FB)"/>';
    front+='</svg>';
    return '<div class="task-chain-wrap">'+back+front+'</div>';
}
function _chainEllipse(clipId,cx,cy,rx,ry){
    var cp=clipId?(' clip-path="url(#'+clipId+')"'):'';
    // Outer shadow — deep black glow
    return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(rx+1)+'" ry="'+(ry+1)+'" fill="none" stroke="rgba(0,0,0,0.7)" stroke-width="2"'+cp+'/>'
    // Dark outer ring — almost black
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#0a0a0a" stroke-width="8"'+cp+'/>'
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#111" stroke-width="7"'+cp+'/>'
    // Dark body — very dark, long
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#1a1a1a" stroke-width="6"'+cp+'/>'
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#252525" stroke-width="5"'+cp+'/>'
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#333" stroke-width="4.2"'+cp+'/>'
    // Narrow mid transition
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#505050" stroke-width="3"'+cp+'/>'
    // Sharp specular core
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#8a8a8a" stroke-width="2"'+cp+'/>'
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#bbb" stroke-width="1.2"'+cp+'/>'
          +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="#d8d8d8" stroke-width="0.7"'+cp+'/>'
    // Hot specular highlight
          +'<ellipse cx="'+(cx-0.4)+'" cy="'+cy+'" rx="'+(rx-0.5)+'" ry="'+(ry-0.4)+'" fill="none" stroke="rgba(240,242,245,0.85)" stroke-width="0.5"'+cp+'/>';
}

function _tDetailsKey(t,i){return(t.id||'idx_'+i)+':det';}
function _tDetailsOpen(t,i){return!!_taskDetailsOpen[_tDetailsKey(t,i)];}
function toggleTaskDetails(i){
    const t=getTaskList()[i];if(!t)return;
    const k=_tDetailsKey(t,i);
    _taskDetailsOpen[k]=!_taskDetailsOpen[k];
    const cards=document.querySelectorAll('#taskList .task-card');
    const card=cards[i];if(!card)return;
    const det=card.querySelector('.task-details');
    if(det)det.classList.toggle('collapsed');
    const arrow=det?.querySelector('.task-details-arrow');
    if(arrow)arrow.style.transform=_taskDetailsOpen[k]?'rotate(90deg)':'';
}

// ── Inline item browser collapse state ──
function _tIbKey(t,i,f){return(t.id||'idx_'+i)+':ib_'+f;}
function _isTaskIbOpen(t,i,f){return!!_taskIbOpen[_tIbKey(t,i,f)];}
function toggleTaskIb(i,f){
    const t=getTaskList()[i];if(!t)return;
    const k=_tIbKey(t,i,f);
    _taskIbOpen[k]=!_taskIbOpen[k];
    const host=document.getElementById('taskIbHost_'+i+'_'+f);
    const btn=host?.previousElementSibling;
    if(_taskIbOpen[k]){
        if(btn)btn.textContent='Hide Browser';
        if(host){host.style.display='';host._ibCfg=null;_initTaskIb(i,f,host);}
    } else {
        if(btn)btn.textContent='Browse Items';
        if(host){host.style.display='none';host._ibCfg=null;host.innerHTML='';}
    }
}
function _initTaskIb(i,f,host){
    if(f==='target')renderItemBrowser(host,makeTaskItemConfig(i,f));
    else if(f==='shoppingItems')renderItemBrowser(host,makeTaskShoppingConfig(i));
    else if(f==='reward')renderItemBrowser(host,makeTaskRewardConfig(i));
}

// ── Targeted chip update (no full re-render) ──
function _updateTaskChips(i,field){
    const t=getTaskList()[i];if(!t)return;
    const el=document.getElementById('taskChips_'+i+'_'+field);
    if(!el)return;
    const lines=String(t[field]||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const withCount=(field==='shoppingItems'||field==='reward'||field==='target');
    el.innerHTML=_chips(lines,i,field,withCount);
}

// ── Pool data access — DEFINED pools ──
function getTaskPools(){
    const d=getDlg();if(!d)return[];
    if(!Array.isArray(d.taskPools)){
        const legacy=Array.isArray(d.tasks)?d.tasks:[];
        d.taskPools=[{tag:'default',enabled:true,cooldownHours:0,dialogOpenText:'',dialogNpcPrompt:'',tasks:legacy}];
        delete d.tasks;
    }
    return d.taskPools;
}

// ── Pool data access — CUSTOM pools ──
function getCustomPools(){
    const d=getDlg();if(!d)return[];
    if(!Array.isArray(d.customPools))d.customPools=[];
    return d.customPools;
}

function getCurTaskPool(){
    if(_taskSubTab==='custom'){
        const pools=getCustomPools();
        if(!pools.length)return null;
        if(_curCustomPoolIdx>=pools.length)_curCustomPoolIdx=0;
        return pools[_curCustomPoolIdx];
    }
    const pools=getTaskPools();
    if(!pools.length)return null;
    if(_curTaskPoolIdx>=pools.length)_curTaskPoolIdx=0;
    return pools[_curTaskPoolIdx];
}
function getTaskList(){const p=getCurTaskPool();return p?p.tasks:[];}

// ── Sub-tab switch ──
function switchTaskSubTab(sub){
    _taskSubTab=sub;
    _pendingDeleteIdx=-1;_openKebabIdx=-1;
    renderTaskList();
    if(typeof renderDialogTreeTabs==='function')renderDialogTreeTabs();
}

// ── Pool management ──
function switchTaskPool(idx){
    if(_taskSubTab==='custom')_curCustomPoolIdx=idx;
    else _curTaskPoolIdx=idx;
    _pendingDeleteIdx=-1;_openKebabIdx=-1;
    renderTaskList();
}

function addDefinedPool(){
    const pools=getTaskPools();
    const used=pools.map(p=>p.tag);
    const tag=POOL_TAGS.find(t=>!used.includes(t));
    if(!tag)return;
    pools.push({tag,enabled:true,cooldownHours:0,dialogOpenText:'',dialogNpcPrompt:'',tasks:[]});
    _curTaskPoolIdx=pools.length-1;
    autoSave();renderTaskList();
    if(typeof renderDialogTreeTabs==='function')renderDialogTreeTabs();
}

function addCustomPool(){
    const pools=getCustomPools();
    let n=1;const used=pools.map(p=>p.tag);
    while(used.includes('custom'+n))n++;
    pools.push({tag:'custom'+n,enabled:true,cooldownHours:0,tasks:[]});
    _curCustomPoolIdx=pools.length-1;
    autoSave();renderTaskList();
    if(typeof renderDialogTreeTabs==='function')renderDialogTreeTabs();
}

function removeTaskPool(idx){
    if(_taskSubTab==='custom'){
        const pools=getCustomPools();
        if(!pools.length)return;
        const removedTag=pools[idx].tag;
        pools.splice(idx,1);
        if(_curCustomPoolIdx>=pools.length)_curCustomPoolIdx=Math.max(0,pools.length-1);
        if(typeof curTaskPoolTag!=='undefined'&&curTaskPoolTag===removedTag){
            curTaskPoolTag=null;
            if(typeof renderBranches==='function')renderBranches();
        }
        autoSave();renderTaskList();
        if(typeof renderDialogTreeTabs==='function')renderDialogTreeTabs();
        return;
    }
    const pools=getTaskPools();
    if(pools.length<=1)return;
    const removedTag=pools[idx].tag;
    pools.splice(idx,1);
    if(_curTaskPoolIdx>=pools.length)_curTaskPoolIdx=pools.length-1;
    if(typeof curTaskPoolTag!=='undefined'&&curTaskPoolTag===removedTag){
        curTaskPoolTag=null;
        if(typeof renderBranches==='function')renderBranches();
    }
    autoSave();renderTaskList();
    if(typeof renderDialogTreeTabs==='function')renderDialogTreeTabs();
}

function savePoolField(field,val){const p=getCurTaskPool();if(!p)return;p[field]=val;autoSave();}

function saveCustomPoolTag(val){
    const pools=getCustomPools();
    const p=pools[_curCustomPoolIdx];if(!p)return;
    const clean=val.toLowerCase().replace(/[^a-z0-9_]/g,'').replace(/^_+|_+$/g,'');
    if(!clean||POOL_TAGS.includes(clean))return;
    const others=pools.filter((_,i)=>i!==_curCustomPoolIdx).map(q=>q.tag);
    if(others.includes(clean))return;
    const oldTag=p.tag;
    p.tag=clean;
    if(typeof curTaskPoolTag!=='undefined'&&curTaskPoolTag===oldTag){
        curTaskPoolTag=clean;
        if(typeof renderDialogTreeTabs==='function')renderDialogTreeTabs();
    }
    autoSave();renderTaskList();
}

function addTask(kind){
    const tasks=getTaskList();
    const ts=Date.now().toString(36);
    const id='task_'+kind+'_'+ts;
    var t={
        type:kind,id,enabled:true,weight:1,
        moneyReward:0,reward:'',rewardGoodwill:0,rewardBuyMod:0,rewardSellMod:0,
        repeatable:true,cooldownHours:0,minRank:'',maxRank:'',requiresTrust:0,
        openingDialogue:'',desc:'',completionNode:''
    };
    if(kind==='fetch'){
        t.fetchMode='single';t.target='';t.count=1;
        t.itemCategory='';t.categoryMode='npc_choice';t.shoppingItems='';
    } else if(kind==='delivery'){
        t.deliverItem='';t.deliverAmount=1;t.deliverToArchetype='';
    } else if(kind==='talk'){
        t.talkToArchetype='';t.talkToGiver=false;
    } else if(kind==='collect'){
        t.collectFromArchetype='';t.collectItem='';t.collectAmount=1;
    }
    tasks.push(t);
    _pendingFocusTaskIdx=tasks.length-1;
    _pendingDeleteIdx=-1;_openKebabIdx=-1;
    autoSave();renderTaskList();
}
// Auto-generate turnin dialog stub on target archetype
function createTurninOnTarget(taskIdx){
    var tasks=getTaskList();
    var t=tasks[taskIdx];if(!t)return;
    var kind=t.type||'fetch';
    var targetArchId='';
    if(kind==='delivery')targetArchId=t.deliverToArchetype||'';
    else if(kind==='talk'&&!t.talkToGiver)targetArchId=t.talkToArchetype||'';
    else if(kind==='collect')targetArchId=t.collectFromArchetype||'';
    if(!targetArchId){alert('No target archetype set on this task.');return;}
    // Find the target archetype in soloChars or groups
    var targetCh=null,targetSi=-1;
    for(var s=0;s<soloChars.length;s++){if(soloChars[s].archId===targetArchId){targetCh=soloChars[s];targetSi=s;break;}}
    if(!targetCh){
        for(var g=0;g<groups.length;g++){
            for(var c=0;c<groups[g].chars.length;c++){
                if(groups[g].chars[c].archId===targetArchId){targetCh=groups[g].chars[c];break;}
            }
            if(targetCh)break;
        }
    }
    if(!targetCh){alert('Archetype "'+targetArchId+'" not found. Create it first.');return;}
    // Ensure dlg data exists on target
    targetCh.ov=targetCh.ov||{};
    if(!targetCh.ov.dlg)targetCh.ov.dlg=dc(DEFAULT_DLG);
    var dlg=targetCh.ov.dlg;
    if(!dlg.dialogs||!dlg.dialogs.length)dlg.dialogs=[{id:'dlg_1',label:'Dialog 1',opener:'',hub:'',hubChoices:[],nodes:{},layout:{}}];
    var tree=dlg.dialogs[0];
    // Create turnin node
    var nid=flatNewId(tree);
    var completeBinding=kind==='delivery'?'dialogs.arch_delivery_complete_'+t.id:kind==='talk'?'dialogs.arch_talk_complete_'+t.id:'dialogs.arch_collect_pickup_'+t.id;
    tree.nodes[nid]={
        npc:kind==='delivery'?'You brought it. Good.':kind==='talk'?'I see. Thanks for letting me know.':'Here, take what you need.',
        label:'Turnin: '+(t.openingDialogue||t.id),
        action:completeBinding+';dialogs.arch_delivery_deliver_rewards',
        choices:[{text:'What\'s next?',next:'__hub__'}]
    };
    // Add hub choice linking to turnin node
    tree.hubChoices=tree.hubChoices||[];
    tree.hubChoices.push({text:'About '+(t.openingDialogue||t.id)+'...',next:nid});
    autoSave();
    setStatus('Created turnin node on "'+targetArchId+'" → ['+nid+']','ok');
    renderTaskList();
}
function setTaskKind(i,kind){
    var t=getTaskList()[i];if(!t)return;
    t.type=kind;
    // Ensure kind-specific fields exist
    if(kind==='fetch'&&!t.fetchMode){t.fetchMode='single';t.target='';t.count=1;t.itemCategory='';t.categoryMode='npc_choice';t.shoppingItems='';}
    if(kind==='delivery'){if(!t.deliverItem)t.deliverItem='';if(!t.deliverAmount)t.deliverAmount=1;if(!t.deliverToArchetype)t.deliverToArchetype='';}
    if(kind==='talk'){if(!t.talkToArchetype)t.talkToArchetype='';if(t.talkToGiver===undefined)t.talkToGiver=false;}
    if(kind==='collect'){if(!t.collectFromArchetype)t.collectFromArchetype='';if(!t.collectItem)t.collectItem='';if(!t.collectAmount)t.collectAmount=1;}
    // Update ID prefix
    t.id=t.id.replace(/^task_(fetch|delivery|talk|collect)_/,'task_'+kind+'_');
    autoSave();renderTaskList();
}
// Get connected archetype list for target dropdowns
function _getConnectedArchIds(){
    var ids=[];
    if(typeof connGroups==='undefined')return ids;
    connGroups.forEach(function(cg){
        cg.members.forEach(function(m){if(m.archId&&ids.indexOf(m.archId)<0)ids.push(m.archId);});
    });
    return ids;
}
function _targetArchSelect(i,field,current){
    var ids=_getConnectedArchIds();
    var h='<select class="task-input" onchange="saveTaskField('+i+',\''+field+'\',this.value)">';
    h+='<option value="">— select archetype —</option>';
    ids.forEach(function(aid){h+='<option value="'+esc(aid)+'"'+(aid===current?' selected':'')+'>'+esc(aid)+'</option>';});
    h+='<option value="__custom__"'+(current&&ids.indexOf(current)<0&&current?' selected':'')+'>Custom...</option>';
    h+='</select>';
    if(current&&ids.indexOf(current)<0&&current){
        h+='<input class="task-input" style="max-width:120px" value="'+esc(current)+'" oninput="saveTaskField('+i+',\''+field+'\',this.value)" placeholder="archetype_id">';
    }
    return h;
}

function removeTask(i){
    _pendingDeleteIdx=-1;_openKebabIdx=-1;
    const tasks=getTaskList();
    // If deleting breaks a chain, clear linkNext on the task above
    if(i>0&&tasks[i-1]&&tasks[i-1].linkNext)tasks[i-1].linkNext=false;
    tasks.splice(i,1);autoSave();renderTaskList();
}

// Move whole chain (or single card if not chained) up/down in pool
function moveTask(i,dir){
    const tasks=getTaskList();
    const group=_getLinkedGroup(i);
    const top=group[0],bot=group[group.length-1];
    if(dir<0){
        if(top<=0)return;
        const el=tasks.splice(top-1,1)[0];
        tasks.splice(bot,0,el);
    } else {
        if(bot>=tasks.length-1)return;
        const el=tasks.splice(bot+1,1)[0];
        tasks.splice(top,0,el);
    }
    _syncChainRequirements();
    _openKebabIdx=-1;_pendingDeleteIdx=-1;
    autoSave();renderTaskList();
}
// Move a single card within its chain (swap with neighbor in chain)
function moveTaskInChain(i,dir){
    const tasks=getTaskList();
    const group=_getLinkedGroup(i);
    if(group.length<2)return; // not in a chain
    var posInChain=group.indexOf(i);
    if(posInChain<0)return;
    var targetPos=posInChain+dir;
    if(targetPos<0||targetPos>=group.length)return;
    // Swap the two tasks in the array
    var a=group[posInChain],b=group[targetPos];
    var tmp=tasks[a];tasks[a]=tasks[b];tasks[b]=tmp;
    // Fix linkNext flags
    for(var j=0;j<group.length-1;j++)tasks[group[j]].linkNext=true;
    tasks[group[group.length-1]].linkNext=false;
    _syncChainRequirements();
    _openKebabIdx=-1;_pendingDeleteIdx=-1;
    autoSave();renderTaskList();
}

// ── Minimap pointer-based drag-to-reorder ──
var _mm={dragging:false,srcIdx:-1,srcEl:null,ghostEl:null,items:[],gapIdx:-1,startY:0,offsetY:0};

function _mmPointerDown(e,idx){
    if(e.button!==0)return;
    e.preventDefault();
    var pill=e.currentTarget;
    var rect=pill.getBoundingClientRect();
    _mm.dragging=true;
    _mm.srcIdx=idx;
    _mm.srcEl=pill;
    _mm.startY=e.clientY;
    _mm.offsetY=e.clientY-rect.top;
    _mm.gapIdx=-1;
    // Collect all pill elements and their positions
    var container=pill.closest('.task-minimap');
    _mm.items=[];
    container.querySelectorAll('.task-mm-pill').forEach(function(el){
        var r=el.getBoundingClientRect();
        _mm.items.push({el:el,idx:+el.dataset.mmIdx,top:r.top,h:r.height,origTransform:''});
    });
    // Create ghost
    var ghost=pill.cloneNode(true);
    ghost.className='task-mm-pill mm-ghost';
    ghost.style.cssText='position:fixed;left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;z-index:9999;pointer-events:none;opacity:0.85;border-color:#ff8c00;box-shadow:0 4px 12px rgba(0,0,0,0.5)';
    document.body.appendChild(ghost);
    _mm.ghostEl=ghost;
    pill.classList.add('mm-dragging');
    document.addEventListener('pointermove',_mmPointerMove);
    document.addEventListener('pointerup',_mmPointerUp);
}
function _mmPointerMove(e){
    if(!_mm.dragging)return;
    var ghost=_mm.ghostEl;
    if(ghost)ghost.style.top=(e.clientY-_mm.offsetY)+'px';
    // Find which slot the cursor is over
    var newGap=-1;
    for(var i=0;i<_mm.items.length;i++){
        var it=_mm.items[i];
        var mid=it.top+it.h/2;
        if(e.clientY<mid){newGap=it.idx;break;}
    }
    if(newGap<0&&_mm.items.length)newGap=_mm.items[_mm.items.length-1].idx+1;
    if(newGap===_mm.gapIdx)return;
    _mm.gapIdx=newGap;
    // Animate pills — shift ones below the gap down to create space
    var srcIdx=_mm.srcIdx;
    _mm.items.forEach(function(it){
        if(it.idx===srcIdx){it.el.style.transform='';return;}
        var shift=0;
        var effectivePos=it.idx;
        if(srcIdx<newGap){
            // Dragging down — items between src+1 and gap-1 shift up
            if(effectivePos>srcIdx&&effectivePos<newGap)shift=-it.h-3;
        } else {
            // Dragging up — items between gap and src-1 shift down
            if(effectivePos>=newGap&&effectivePos<srcIdx)shift=it.h+3;
        }
        it.el.style.transition='transform 0.15s ease';
        it.el.style.transform=shift?'translateY('+shift+'px)':'';
    });
}
function _mmPointerUp(e){
    document.removeEventListener('pointermove',_mmPointerMove);
    document.removeEventListener('pointerup',_mmPointerUp);
    if(!_mm.dragging)return;
    _mm.dragging=false;
    if(_mm.ghostEl){_mm.ghostEl.remove();_mm.ghostEl=null;}
    if(_mm.srcEl)_mm.srcEl.classList.remove('mm-dragging');
    // Reset transforms
    _mm.items.forEach(function(it){it.el.style.transform='';it.el.style.transition='';});
    var srcIdx=_mm.srcIdx;
    var gapIdx=_mm.gapIdx;
    _mm.srcIdx=-1;_mm.gapIdx=-1;
    if(gapIdx<0||gapIdx===srcIdx||gapIdx===srcIdx+1)return;
    // Execute the move
    var tasks=getTaskList();
    var srcGroup=_getLinkedGroup(srcIdx);
    var srcInChain=srcGroup.length>1;
    // Determine what we're dropping onto
    var targetGroup=gapIdx<tasks.length?_getLinkedGroup(gapIdx):[];
    var targetInChain=targetGroup.length>1;
    if(srcInChain&&!targetInChain){
        // Dragging within chain or chain card to outside — swap within chain if same chain
        var posInChain=srcGroup.indexOf(srcIdx);
        var targetPosInChain=srcGroup.indexOf(gapIdx);
        if(targetPosInChain>=0){
            // Same chain — swap
            var a=srcIdx,b=gapIdx<srcIdx?gapIdx:gapIdx-1;
            if(a!==b&&b>=srcGroup[0]&&b<=srcGroup[srcGroup.length-1]){
                var tmp=tasks[a];tasks[a]=tasks[b];tasks[b]=tmp;
            }
        }
        // Otherwise do nothing — don't break chain
    } else if(!srcInChain&&targetInChain){
        // Single card dragged near a chain — swap with whole chain
        var chainTop=targetGroup[0],chainBot=targetGroup[targetGroup.length-1];
        if(srcIdx<chainTop){
            // Swap: move single to after chain, move chain up
            var el=tasks.splice(srcIdx,1)[0];
            tasks.splice(chainBot,0,el);
        } else {
            var el=tasks.splice(srcIdx,1)[0];
            tasks.splice(chainTop,0,el);
        }
    } else {
        // Both single or both different chains — simple move
        var el=tasks.splice(srcIdx,1)[0];
        var insertAt=gapIdx>srcIdx?gapIdx-1:gapIdx;
        tasks.splice(insertAt,0,el);
    }
    // Fix broken linkNext
    tasks.forEach(function(t,ti){if(t.linkNext&&ti>=tasks.length-1)t.linkNext=false;});
    _syncChainRequirements();
    autoSave();renderTaskList();
}
function _mmClick(idx){
    var card=document.querySelector('.task-card[data-task-idx="'+idx+'"]');
    if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
}

function toggleKebab(i){
    _openKebabIdx=(_openKebabIdx===i)?-1:i;
    _pendingDeleteIdx=-1;
    renderTaskList();
}

function confirmDelete(i){
    if(_pendingDeleteIdx===i){
        removeTask(i);
    } else {
        _pendingDeleteIdx=i;
        _openKebabIdx=-1;
        renderTaskList();
    }
}

function toggleTaskHidden(i){
    const tasks=getTaskList();
    const t=tasks[i];if(!t)return;
    const newVal=!t.hidden;
    const group=_getLinkedGroup(i);
    group.forEach(gi=>{tasks[gi].hidden=newVal;});
    autoSave();renderTaskList();
}

function saveTaskField(i,field,val){
    const t=getTaskList()[i];if(t){t[field]=val;autoSave();}
}

function setTaskFetchMode(i,mode){saveTaskField(i,'fetchMode',mode);renderTaskList();}

// ── Saved categories (global, project-level) ──
function getSavedCategories(){return typeof savedCategories!=='undefined'?savedCategories:[];}
function saveCategoryFromBrowser(taskIdx){
    // Collect items currently picked for this task's category browser
    const t=getTaskList()[taskIdx];if(!t)return;
    const items=String(t._catBrowserItems||'').split('\n').map(l=>l.trim()).filter(Boolean);
    if(!items.length){alert('Add items to the category first.');return;}
    const name=prompt('Category name (e.g. "Medical Supplies"):');
    if(!name||!name.trim())return;
    // Check for duplicate
    const existing=getSavedCategories().find(c=>c.name.toLowerCase()===name.trim().toLowerCase());
    if(existing){
        if(!confirm('Category "'+existing.name+'" already exists. Overwrite?'))return;
        existing.items=items;existing.name=name.trim();
    } else {
        savedCategories.push({name:name.trim(),items:items});
    }
    // Assign this category to the task
    t.itemCategory=name.trim();
    delete t._catBrowserItems;
    _catBrowserTaskIdx=-1;
    autoSave();renderTaskList();
}
function assignSavedCategory(taskIdx,catName){
    const t=getTaskList()[taskIdx];if(!t)return;
    t.itemCategory=catName;
    _catBrowserTaskIdx=-1;
    autoSave();renderTaskList();
}
function deleteSavedCategory(idx){
    if(!confirm('Delete category "'+savedCategories[idx].name+'"?'))return;
    savedCategories.splice(idx,1);
    autoSave();renderTaskList();
}
function openCatBrowser(taskIdx){
    _catBrowserTaskIdx=taskIdx;
    const t=getTaskList()[taskIdx];
    if(t)t._catBrowserItems=t._catBrowserItems||'';
    renderTaskList();
    // Init browser after render
    setTimeout(()=>{
        const host=document.getElementById('catBrowserHost_'+taskIdx);
        if(host)renderItemBrowser(host,makeCatBrowserConfig(taskIdx));
    },30);
}
function closeCatBrowser(taskIdx){
    const t=getTaskList()[taskIdx];
    if(t)delete t._catBrowserItems;
    _catBrowserTaskIdx=-1;
    renderTaskList();
}
function makeCatBrowserConfig(taskIdx){
    return{
        getList:()=>{const t=getTaskList()[taskIdx];if(!t)return[];return String(t._catBrowserItems||'').split('\n').map(l=>l.trim()).filter(Boolean);},
        setList:(lines)=>{const t=getTaskList()[taskIdx];if(t)t._catBrowserItems=lines.join('\n');_renderCatBrowserChips(taskIdx);},
        parseItem:(raw)=>({id:raw.split(':')[0].trim(),extra:1}),
        serializeItem:(o)=>o.id,
        updateExtra:null,extraField:null,maxItems:null,dblClickAdd:true
    };
}
function _renderCatBrowserChips(taskIdx){
    const el=document.getElementById('catBrowserChips_'+taskIdx);
    if(!el)return;
    const t=getTaskList()[taskIdx];if(!t)return;
    const items=String(t._catBrowserItems||'').split('\n').map(l=>l.trim()).filter(Boolean);
    if(!items.length){el.innerHTML='<span style="color:#777;font-size:11px">No items added yet</span>';return;}
    el.innerHTML=items.map((s,si)=>'<span class="task-item-chip">'+esc(s)+'<button onclick="event.stopPropagation();_removeCatBrowserItem('+taskIdx+','+si+')" class="chip-del">\u2715</button></span>').join('');
}
function _removeCatBrowserItem(taskIdx,idx){
    const t=getTaskList()[taskIdx];if(!t)return;
    const lines=String(t._catBrowserItems||'').split('\n').filter(l=>l.trim());
    lines.splice(idx,1);
    t._catBrowserItems=lines.join('\n');
    _renderCatBrowserChips(taskIdx);
    // Re-init browser to reflect removal
    const host=document.getElementById('catBrowserHost_'+taskIdx);
    if(host){host._ibCfg=null;renderItemBrowser(host,makeCatBrowserConfig(taskIdx));}
}

// ── Item chip management ──
function removeTaskItemByIdx(i,field,idx){
    const t=getTaskList()[i];if(!t)return;
    const lines=String(t[field]||'').split('\n').filter(l=>l.trim());
    lines.splice(idx,1);saveTaskField(i,field,lines.join('\n'));_updateTaskChips(i,field);
}
function updateTaskItemCount(i,field,idx,delta){
    const t=getTaskList()[i];if(!t)return;
    const lines=String(t[field]||'').split('\n').filter(l=>l.trim());
    if(!lines[idx])return;
    const sec=lines[idx].split(':')[0].trim();
    const cur=parseInt(lines[idx].split(':')[1])||1;
    lines[idx]=sec+':'+Math.max(1,cur+delta);
    saveTaskField(i,field,lines.join('\n'));_updateTaskChips(i,field);
}
function setTaskItemCount(i,field,idx,val){
    const t=getTaskList()[i];if(!t)return;
    const lines=String(t[field]||'').split('\n').filter(l=>l.trim());
    if(!lines[idx])return;
    const sec=lines[idx].split(':')[0].trim();
    lines[idx]=sec+':'+Math.max(1,parseInt(val)||1);
    saveTaskField(i,field,lines.join('\n'));
}

// ── Mode toggle button ──
function _mBtn(label,isActive,onclick){
    return'<button class="task-mode-btn'+(isActive?' active':'')+'" onclick="'+onclick+'">'+label+'</button>';
}

// ── Chip renderer (tags with stepper counts) ──
function _chips(lines,taskIdx,field,withCount){
    if(!lines.length)return'<span style="color:#777;font-size:11px;padding:2px 0">None added</span>';
    return lines.map((l,li)=>{
        const p=l.split(':'),sec=p[0].trim(),cnt=parseInt(p[1])||1;
        let h='<span class="task-item-chip">'+esc(sec);
        if(withCount){
            h+='<span class="chip-stepper">'
              +'<button onclick="event.stopPropagation();updateTaskItemCount('+taskIdx+',\''+field+'\','+li+',-1)" class="chip-step">\u2212</button>'
              +'<input class="chip-count" type="number" min="1" value="'+cnt+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onchange="setTaskItemCount('+taskIdx+',\''+field+'\','+li+',this.value)" oninput="setTaskItemCount('+taskIdx+',\''+field+'\','+li+',this.value)">'
              +'<button onclick="event.stopPropagation();updateTaskItemCount('+taskIdx+',\''+field+'\','+li+',1)" class="chip-step">+</button>'
              +'</span>';
        }
        h+='<button onclick="event.stopPropagation();removeTaskItemByIdx('+taskIdx+',\''+field+'\','+li+')" class="chip-del">\u2715</button></span>';
        return h;
    }).join('');
}

// ── Inline browser block ──
function _ibBlock(i,field,isOpen){
    return'<button class="task-browse-btn" onclick="toggleTaskIb('+i+',\''+field+'\')">'+(isOpen?'Hide Browser':'Browse Items')+'</button>'
        +'<div id="taskIbHost_'+i+'_'+field+'" class="task-ib-host"'+(isOpen?'':' style="display:none"')+'></div>';
}

// ── Details panel summary (shown when collapsed) ──
function _detailsSum(t){
    const p=[];
    if(t.repeatable===false)p.push('one-time');
    else if(t.cooldownHours)p.push(t.cooldownHours+'h cooldown');
    if(t.minRank)p.push('min: '+t.minRank);
    if(t.requiresTrust)p.push('trust '+t.requiresTrust+'+');
    if(t.rewardBuyMod||t.rewardSellMod)p.push('trade mods');
    return p.length?p.join(' · '):'No restrictions';
}

// ── Sub-tab switcher ──
function _renderTaskSubTabs(){
    return'<div class="task-subtabs">'
        +'<button class="task-subtab'+(_taskSubTab==='custom'?' active':'')+' task-subtab-custom" onclick="switchTaskSubTab(\'custom\')">Narrative Pools</button>'
        +'<button class="task-subtab'+(_taskSubTab==='defined'?' active':'')+'" onclick="switchTaskSubTab(\'defined\')">Defined Pools</button>'
        +'</div>';
}

// ── Defined pool tabs ──
function _renderPoolTabs(pools){
    const canAdd=pools.length<POOL_TAGS.length;
    let h='<div class="task-pool-tabs">';
    pools.forEach((p,i)=>{
        const lbl=p.tag.charAt(0).toUpperCase()+p.tag.slice(1);
        h+=`<button class="task-pool-tab${i===_curTaskPoolIdx?' active':''}" onclick="switchTaskPool(${i})">${esc(lbl)}</button>`;
    });
    if(canAdd)h+=`<button class="task-pool-tab add-pool" onclick="addDefinedPool()" title="Add a task tier (e.g. Advanced, Rare)">+ Pool</button>`;
    h+='</div>';
    return h;
}

// ── Custom pool tabs ──
function _renderCustomPoolTabs(pools){
    let h='<div class="task-pool-tabs">';
    pools.forEach((p,i)=>{
        h+=`<button class="task-pool-tab task-pool-tab-custom${i===_curCustomPoolIdx?' active':''}" onclick="switchTaskPool(${i})">${esc(p.tag)}</button>`;
    });
    h+=`<button class="task-pool-tab add-pool task-pool-add-custom" onclick="addCustomPool()" title="Add a custom narrative pool">+ Custom Pool</button>`;
    h+='</div>';
    return h;
}

// ── Defined pool panel ──
function _renderPoolPanel(p,idx,pools){
    if(!p)return'';
    const usedTags=pools.map((q,i)=>i!==idx?q.tag:null).filter(Boolean);
    const avail=POOL_TAGS.filter(t=>!usedTags.includes(t));
    let h='<div class="task-pool-panel">';

    // Row: tag + enabled + cooldown + remove
    h+='<div class="task-pool-row">';
    h+='<span class="task-pool-lbl">Type</span>';
    h+='<select class="task-pool-sel" onchange="savePoolField(\'tag\',this.value);renderTaskList()">';
    avail.forEach(t=>{const l=t.charAt(0).toUpperCase()+t.slice(1);h+=`<option value="${esc(t)}"${p.tag===t?' selected':''}>${esc(l)}</option>`;});
    h+='</select>';
    h+=`<label class="task-pool-check"><input type="checkbox" ${p.enabled!==false?'checked':''} onchange="savePoolField('enabled',this.checked)" style="accent-color:#ff8c00"> Enabled</label>`;
    h+='<span class="task-pool-lbl" style="margin-left:6px">Cooldown</span>';
    h+=`<input type="number" min="0" class="task-pool-num" value="${p.cooldownHours||0}" oninput="savePoolField('cooldownHours',+this.value||0)">`;
    h+='<span style="font-size:11px;color:#888">h</span>';
    if(pools.length>1)h+=`<button class="task-pool-remove" onclick="removeTaskPool(${idx})">Remove pool</button>`;
    h+='</div>';

    // Dialog text inputs
    h+='<div class="task-pool-dialogs">';
    h+=`<div class="task-pool-dialog-field"><span class="task-pool-lbl">Player asks</span><input class="task-pool-text" placeholder='e.g. "Got any ${esc(p.tag)} work?"' value="${esc(p.dialogOpenText||'')}" oninput="savePoolField('dialogOpenText',this.value)"></div>`;
    h+=`<div class="task-pool-dialog-field"><span class="task-pool-lbl">NPC responds</span><input class="task-pool-text" placeholder="(auto-generated if empty)" value="${esc(p.dialogNpcPrompt||'')}" oninput="savePoolField('dialogNpcPrompt',this.value)"></div>`;
    h+='</div>';

    if(pools.length===1){
        h+='<div class="task-pool-hint">Add more pools to offer different job tiers — each pool is a separate dialog entry point (e.g. &ldquo;Got any work?&rdquo; vs &ldquo;Got anything harder?&rdquo;).</div>';
    }
    h+='</div>';
    return h;
}

// ── Custom pool panel ──
function _renderCustomPoolPanel(p,idx,pools){
    if(!p)return'';
    const tag=esc(p.tag);
    const sfx='_'+tag;
    let h='<div class="task-pool-panel task-pool-panel-custom">';
    h+='<div class="task-pool-row">';
    h+='<span class="task-pool-lbl">Tag</span>';
    h+=`<input class="task-pool-tag-input" value="${tag}" placeholder="e.g. narrative" onchange="saveCustomPoolTag(this.value)" onblur="saveCustomPoolTag(this.value)">`;
    h+=`<label class="task-pool-check" style="margin-left:auto"><input type="checkbox" ${p.enabled!==false?'checked':''} onchange="savePoolField('enabled',this.checked)" style="accent-color:#6a9fd8"> Enabled</label>`;
    h+='<span class="task-pool-lbl" style="margin-left:6px">Cooldown</span>';
    h+=`<input type="number" min="0" class="task-pool-num" value="${p.cooldownHours||0}" oninput="savePoolField('cooldownHours',+this.value||0)">`;
    h+='<span style="font-size:11px;color:#888">h</span>';
    h+=`<button class="task-pool-remove" onclick="removeTaskPool(${idx})">Remove</button>`;
    h+='</div>';
    h+='<div class="task-pool-custom-note">'
      +'<span style="color:#6a9fd8;margin-right:5px">&#9432;</span>'
      +'No auto-generated dialog. Wire bindings into your dialog tree in the Graph tab &mdash; '
      +`<code>arch_has_task_pool${sfx}</code>, <code>arch_task_accept${sfx}</code>, <code>arch_task_deliver_rewards${sfx}</code>, etc.`
      +'</div>';
    h+='</div>';
    return h;
}

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════
function renderTaskList(){
    const box=document.getElementById('taskList');if(!box)return;
    _chainSvgUid=0;

    const subTabsHtml=_renderTaskSubTabs();

    // ── Custom sub-tab: no pools yet ──
    if(_taskSubTab==='custom'){
        const customPools=getCustomPools();
        if(!customPools.length){
            box.innerHTML=subTabsHtml
                +'<div class="task-empty">'
                +'<div style="font-size:13px;color:#999;margin-bottom:8px">No custom pools yet.</div>'
                +'<div style="font-size:11px;color:#777;margin-bottom:12px;max-width:420px">Custom pools let you write a unique dialog flow for each task. You decide exactly where the offer, accept, decline, and turnin bindings appear in your conversation tree.</div>'
                +'<button class="btn b2" style="border-color:#6a9fd8;color:#6a9fd8" onclick="addCustomPool()">+ Add Custom Pool</button>'
                +'</div>';
            if(typeof TexEditor!=='undefined'&&TexEditor.refreshLayers)TexEditor.refreshLayers('tex-screen-dialogue');
            return;
        }
        if(_curCustomPoolIdx>=customPools.length)_curCustomPoolIdx=0;
    }

    // ── Pool UI ──
    let poolUi='';
    if(_taskSubTab==='custom'){
        const customPools=getCustomPools();
        const curPool=customPools[_curCustomPoolIdx]||null;
        poolUi=_renderCustomPoolTabs(customPools)+_renderCustomPoolPanel(curPool,_curCustomPoolIdx,customPools);
    } else {
        const pools=getTaskPools();
        const curPool=getCurTaskPool();
        poolUi=pools.length?_renderPoolTabs(pools)+_renderPoolPanel(curPool,_curTaskPoolIdx,pools):'';
    }

    const tasks=getTaskList();
    // Build sorted display order: visible tasks first, hidden at bottom
    const _sortedTaskIdxs=tasks.map((_,i)=>i);
    _sortedTaskIdxs.sort((a,b)=>{
        const ha=tasks[a].hidden?1:0, hb=tasks[b].hidden?1:0;
        return ha-hb||(a-b);
    });

    if(!tasks.length){
        box.innerHTML=subTabsHtml+poolUi
            +'<div class="task-empty">'
            +'<div style="font-size:13px;color:#999;margin-bottom:8px">No tasks in this pool yet.</div>'
            +'<div style="font-size:11px;color:#777;margin-bottom:10px">Tasks are fetch jobs this NPC gives to the player. What kind?</div>'
            +'<div class="task-add-bar">'
            +'<button class="btn b2 bs" onclick="addTask(\'fetch\')"><i class="bi">🎒</i> Fetch</button>'
            +'<button class="btn b2 bs" onclick="addTask(\'delivery\')"><i class="bi">📦</i> Delivery</button>'
            +'<button class="btn b2 bs" onclick="addTask(\'talk\')"><i class="bi">💬</i> Talk</button>'
            +'<button class="btn b2 bs" onclick="addTask(\'collect\')"><i class="bi">📋</i> Collect</button>'
            +'</div></div>';
        if(typeof TexEditor!=='undefined'&&TexEditor.refreshLayers)TexEditor.refreshLayers('tex-screen-dialogue');
        return;
    }

    // Migrate legacy title → openingDialogue
    tasks.forEach(t=>{if(t.title&&!t.openingDialogue){t.openingDialogue=t.title;delete t.title;}});

    const tree=getCurTree();
    const nodeOpts=tree?Object.entries(tree.nodes||{}).map(([nid,n])=>'<option value="'+esc(nid)+'">['+esc(nid)+'] '+esc(String(n.npc||'').slice(0,35))+'</option>').join(''):'';
    const rankOpts=TASK_RANKS.map(([v,l])=>'<option value="'+esc(v)+'">'+esc(l)+'</option>').join('');
    let html='';
    const _cardHtmls=_sortedTaskIdxs.map(i=>{
        const t=tasks[i];
        const kind=t.type||'fetch';
        const fm=t.fetchMode||'single';
        const en=t.enabled!==false;
        const isHidden=!!t.hidden;
        const cm=t.categoryMode||'npc_choice';
        const detOpen=_tDetailsOpen(t,i);

        const targetL=String(t.target||'').split('\n').map(l=>l.trim()).filter(Boolean);
        const shopL=String(t.shoppingItems||'').split('\n').map(l=>l.trim()).filter(Boolean);
        const rewL=String(t.reward||'').split('\n').map(l=>l.trim()).filter(Boolean);
        const ibTargO=_isTaskIbOpen(t,i,'target');
        const ibShopO=_isTaskIbOpen(t,i,'shoppingItems');
        const ibRewO=_isTaskIbOpen(t,i,'reward');

        const isKebabOpen=_openKebabIdx===i;
        const isPendingDel=_pendingDeleteIdx===i;

        // Linked group CSS classes
        const _lTop=(i>0&&tasks[i-1]&&tasks[i-1].linkNext);
        const _lBot=(t.linkNext&&i<tasks.length-1);
        const _linkCls=(_lTop&&_lBot?' task-linked-mid':_lTop?' task-linked-bot':_lBot?' task-linked-top':'');
        let c='<div class="task-card'+(isHidden?' task-hidden':'')+_linkCls+'" data-task-idx="'+i+'">';

        // ── Chain/position context for arrows ──
        const _grp=_getLinkedGroup(i);
        const _inChain=_grp.length>1;
        const _posInChain=_grp.indexOf(i);
        const _isChainTop=_inChain&&_posInChain===0;
        const _isChainBot=_inChain&&_posInChain===_grp.length-1;
        const _chainTop=_grp[0],_chainBot=_grp[_grp.length-1];
        const _kindIcon={fetch:'🎒',delivery:'📦',talk:'💬',collect:'📋'}[kind]||'📋';

        // ── Header: arrows + enable + number + label + weight + hidden + delete ──
        var arrowsHtml='<span class="task-arrows">';
        if(_inChain){
            // Within-chain arrows
            arrowsHtml+='<button class="task-arrow" onclick="moveTaskInChain('+i+',-1)" title="Move up in chain"'+(_posInChain<=0?' disabled':'')+'>&#9650;</button>';
            arrowsHtml+='<button class="task-arrow" onclick="moveTaskInChain('+i+',1)" title="Move down in chain"'+(_posInChain>=_grp.length-1?' disabled':'')+'>&#9660;</button>';
            if(_isChainTop){
                // Whole-chain arrows (only on first card)
                arrowsHtml+='<button class="task-arrow chain-arrow" onclick="moveTask('+i+',-1)" title="Move whole chain up"'+(_chainTop<=0?' disabled':'')+'>⇧</button>';
                arrowsHtml+='<button class="task-arrow chain-arrow" onclick="moveTask('+i+',1)" title="Move whole chain down"'+(_chainBot>=tasks.length-1?' disabled':'')+'>⇩</button>';
            }
        } else {
            arrowsHtml+='<button class="task-arrow" onclick="moveTask('+i+',-1)" title="Move up"'+(i<=0?' disabled':'')+'>&#9650;</button>';
            arrowsHtml+='<button class="task-arrow" onclick="moveTask('+i+',1)" title="Move down"'+(i>=tasks.length-1?' disabled':'')+'>&#9660;</button>';
        }
        arrowsHtml+='</span>';

        c+='<div class="task-card-header'+(isPendingDel?' confirming':'')+'">'
          +arrowsHtml
          +'<input type="checkbox" class="task-enable-chk" '+(en?'checked':'')+' onchange="toggleTaskEnabled('+i+')" title="Enable/disable this task (linked cards toggle together)">'
          +'<span class="task-num" title="Task #'+(i+1)+'">#'+(i+1)+'</span>'
          +'<input class="task-name-input" placeholder="Task label — what the player sees in the dialog menu..." value="'+esc(t.openingDialogue||'')+'" oninput="saveTaskField('+i+',\'openingDialogue\',this.value)">'
          +'<span class="task-weight-lbl" title="Selection weight — higher = picked more often when tasks are randomly assigned">Wt</span>'
          +'<input class="task-weight-input" type="number" min="1" value="'+(t.weight||1)+'" onchange="saveTaskField('+i+',\'weight\',Math.max(1,+this.value||1))">'
          +'<button class="task-hide-btn'+(isHidden?' active':'')+'" onclick="toggleTaskHidden('+i+')" title="'+(isHidden?'Unhide — restore script actions':'Hide — dim card and remove script actions from nodes')+'">'+(isHidden?'&#128065;&#8288;&#822;':'&#128065;')+'</button>'
          +'<button class="task-del'+(isPendingDel?' confirming':'')+'" onclick="confirmDelete('+i+')" title="'+(isPendingDel?'Click again to confirm':'Delete task')+'">'+(isPendingDel?'Delete?':'\u2715')+'</button>'
          +'</div>';

        // ── Core body (always visible) ──
        c+='<div class="task-core">';

        // Kind selector bar
        c+='<div class="task-kind-bar">'
          +_mBtn('<i class="bi">🎒</i> Fetch',kind==='fetch','setTaskKind('+i+',\'fetch\')')
          +_mBtn('<i class="bi">📦</i> Delivery',kind==='delivery','setTaskKind('+i+',\'delivery\')')
          +_mBtn('<i class="bi">💬</i> Talk',kind==='talk','setTaskKind('+i+',\'talk\')')
          +_mBtn('<i class="bi">📋</i> Collect',kind==='collect','setTaskKind('+i+',\'collect\')')
          +'</div>';

        // Kind-specific fields
        c+='<div class="task-fetch-area">';

        if(kind==='delivery'){
            c+='<div class="task-area-label">Delivery</div>';
            c+='<div class="task-row"><span class="task-label">Item</span>'
              +'<div id="taskChips_'+i+'_target" class="task-chips-area" style="flex:1">'+_chips(targetL,i,'target',true)+'</div></div>';
            c+=_ibBlock(i,'target',ibTargO);
            c+='<div class="task-row"><span class="task-label">Count</span>'
              +'<input class="task-input" style="max-width:55px" type="number" min="1" value="'+(t.deliverAmount||1)+'" oninput="saveTaskField('+i+',\'deliverAmount\',+this.value||1)"></div>';
            c+='<div class="task-row"><span class="task-label"><i class="bi">📦</i> Target</span>'
              +_targetArchSelect(i,'deliverToArchetype',t.deliverToArchetype||'')+'</div>';
            if(t.deliverToArchetype)c+='<div class="task-row"><button class="btn b2 bs" style="font-size:10px" onclick="createTurninOnTarget('+i+')"><i class="bi">☑️</i> Create turnin on '+esc(t.deliverToArchetype)+'</button></div>';

        } else if(kind==='talk'){
            c+='<div class="task-area-label">Talk</div>';
            c+='<div class="task-row"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">'
              +'<input type="checkbox" '+(t.talkToGiver?'checked':'')+' onchange="saveTaskField('+i+',\'talkToGiver\',this.checked);renderTaskList()" style="accent-color:#ff8c00">'
              +'<span style="font-size:11px;color:#bbb">Return to giver (report back)</span></label></div>';
            if(!t.talkToGiver){
                c+='<div class="task-row"><span class="task-label"><i class="bi">💬</i> Target</span>'
                  +_targetArchSelect(i,'talkToArchetype',t.talkToArchetype||'')+'</div>';
                if(t.talkToArchetype)c+='<div class="task-row"><button class="btn b2 bs" style="font-size:10px" onclick="createTurninOnTarget('+i+')"><i class="bi">☑️</i> Create turnin on '+esc(t.talkToArchetype)+'</button></div>';
            }

        } else if(kind==='collect'){
            c+='<div class="task-area-label">Collect</div>';
            c+='<div class="task-row"><span class="task-label"><i class="bi">📋</i> Source</span>'
              +_targetArchSelect(i,'collectFromArchetype',t.collectFromArchetype||'')+'</div>';
            if(t.collectFromArchetype)c+='<div class="task-row"><button class="btn b2 bs" style="font-size:10px" onclick="createTurninOnTarget('+i+')"><i class="bi">☑️</i> Create pickup on '+esc(t.collectFromArchetype)+'</button></div>';
            c+='<div class="task-row"><span class="task-label">Item</span>'
              +'<div id="taskChips_'+i+'_target" class="task-chips-area" style="flex:1">'+_chips(targetL,i,'target',true)+'</div></div>';
            c+=_ibBlock(i,'target',ibTargO);
            c+='<div class="task-row"><span class="task-label">Count</span>'
              +'<input class="task-input" style="max-width:55px" type="number" min="1" value="'+(t.collectAmount||1)+'" oninput="saveTaskField('+i+',\'collectAmount\',+this.value||1)"></div>';

        } else {
            // Fetch (default)
            c+='<div class="task-area-label">What to bring</div>';
            c+='<div class="task-mode-bar" style="margin-bottom:8px">'
              +_mBtn('Single Item',fm==='single','setTaskFetchMode('+i+',\'single\')')
              +_mBtn('Any from Category',fm==='category','setTaskFetchMode('+i+',\'category\')')
              +_mBtn('Shopping List',fm==='shopping','setTaskFetchMode('+i+',\'shopping\')')
              +'</div>';

        if(fm==='single'){
            c+='<div class="task-row">'
              +'<span class="task-label">Item</span>'
              +'<div id="taskChips_'+i+'_target" class="task-chips-area" style="flex:1">'+_chips(targetL,i,'target',true)+'</div>'
              +'</div>';
            c+=_ibBlock(i,'target',ibTargO);
        } else if(fm==='category'){
            const _cats=getSavedCategories();
            const _curCat=t.itemCategory||'';
            const _catMatch=_cats.find(c=>c.name===_curCat);
            const _isCatBrowserOpen=_catBrowserTaskIdx===i;

            // Category selector: dropdown of saved + create new
            c+='<div class="task-row">'
              +'<span class="task-label">Category</span>'
              +'<select class="task-input task-cat-sel" data-ti="'+i+'" onchange="assignSavedCategory('+i+',this.value)">'
              +'<option value="">— select category —</option>';
            _cats.forEach(function(cat,ci){
                c+='<option value="'+esc(cat.name)+'"'+(cat.name===_curCat?' selected':'')+'>'+esc(cat.name)+' ('+cat.items.length+' items)</option>';
            });
            c+='</select>'
              +'<button class="btn b2 bs" style="flex-shrink:0" onclick="openCatBrowser('+i+')" title="Create a new category from items">+ New</button>'
              +'</div>';

            // Show assigned category items as chips
            if(_catMatch){
                c+='<div class="task-row" style="flex-wrap:wrap">'
                  +'<span class="task-label">Items</span>'
                  +'<div class="task-chips-area" style="flex:1">'+_catMatch.items.map(function(s){return'<span class="task-item-chip">'+esc(s)+'</span>';}).join('')+'</div>'
                  +'</div>';
            } else if(_curCat){
                // Legacy raw string — show as-is
                c+='<div class="task-row"><span class="task-label">Raw</span>'
                  +'<input class="task-input" value="'+esc(_curCat)+'" oninput="saveTaskField('+i+',\'itemCategory\',this.value)" placeholder="Legacy category string">'
                  +'</div>';
            }

            // Category browser (for creating new)
            if(_isCatBrowserOpen){
                c+='<div class="task-cat-browser-panel">'
                  +'<div style="font-size:11px;color:#aaa;margin-bottom:6px">Pick items for the new category, then save it:</div>'
                  +'<div id="catBrowserChips_'+i+'" class="task-chips-area" style="margin-bottom:6px"><span style="color:#777;font-size:11px">No items added yet</span></div>'
                  +'<div id="catBrowserHost_'+i+'" class="task-ib-host"></div>'
                  +'<div style="display:flex;gap:6px;margin-top:6px">'
                  +'<button class="btn b2 bs" onclick="saveCategoryFromBrowser('+i+')">Save as Category</button>'
                  +'<button class="btn b2 bs" onclick="closeCatBrowser('+i+')">Cancel</button>'
                  +'</div></div>';
            }

            // Count + who picks
            c+='<div class="task-row">'
              +'<span class="task-label">Count</span>'
              +'<input class="task-input" style="max-width:55px" type="number" min="1" value="'+(t.count||1)+'" oninput="saveTaskField('+i+',\'count\',+this.value||1)">'
              +'</div>'
              +'<div class="task-row">'
              +'<span class="task-label">Who picks</span>'
              +'<div class="task-mode-bar">'
              +_mBtn('NPC chooses',cm==='npc_choice','saveTaskField('+i+',\'categoryMode\',\'npc_choice\');renderTaskList()')
              +_mBtn('Player chooses',cm==='player_choice','saveTaskField('+i+',\'categoryMode\',\'player_choice\');renderTaskList()')
              +_mBtn('Strict',cm==='player_choice_strict','saveTaskField('+i+',\'categoryMode\',\'player_choice_strict\');renderTaskList()')
              +'</div>'
              +'</div>';
        } else {
            c+='<div class="task-row">'
              +'<span class="task-label">Items</span>'
              +'<div id="taskChips_'+i+'_shoppingItems" class="task-chips-area" style="flex:1">'+_chips(shopL,i,'shoppingItems',true)+'</div>'
              +'</div>';
            c+=_ibBlock(i,'shoppingItems',ibShopO);
        }
        } // end kind else (fetch)
        c+='</div>'; // end fetch-area

        // Reward area
        c+='<div class="task-reward-area">';
        c+='<div class="task-area-label">Reward</div>';
        c+='<div class="task-reward-row">'
          +'<div class="task-reward-field"><span class="task-label">Money</span>'
          +'<input class="task-input" type="number" min="0" step="100" value="'+(t.moneyReward||0)+'" oninput="saveTaskField('+i+',\'moneyReward\',+this.value||0)">'
          +'<span style="font-size:10px;color:#888;flex-shrink:0">RU</span></div>'
          +'<div class="task-reward-field"><span class="task-label">Goodwill</span>'
          +'<input class="task-input" type="number" min="0" value="'+(t.rewardGoodwill||0)+'" oninput="saveTaskField('+i+',\'rewardGoodwill\',+this.value||0)">'
          +'<span style="font-size:10px;color:#888;flex-shrink:0">pts</span></div>'
          +'</div>';
        c+='<div class="task-row">'
          +'<span class="task-label">Items</span>'
          +'<div id="taskChips_'+i+'_reward" class="task-chips-area" style="flex:1">'+_chips(rewL,i,'reward',true)+'</div>'
          +'</div>';
        c+=_ibBlock(i,'reward',ibRewO);
        c+='</div>'; // end reward-area

        c+='</div>'; // end task-core

        // ── Details panel (collapsible) ──
        c+='<div class="task-details'+(detOpen?'':' collapsed')+'">';
        c+='<div class="task-details-head" onclick="toggleTaskDetails('+i+')">'
          +'<span class="task-details-arrow" style="font-size:9px;color:#777;width:10px;transition:transform 0.15s'+(detOpen?';transform:rotate(90deg)':'')+'">&#9656;</span>'
          +'<span style="font-size:10px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Details</span>'
          +'<span class="task-details-summary">'+esc(_detailsSum(t))+'</span>'
          +'</div>';
        c+='<div class="task-details-body">';

        // Availability
        c+='<div class="task-det-section-lbl">Availability</div>';
        c+='<div class="task-2col">'
          +'<div class="task-row"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">'
          +'<input type="checkbox" '+(t.repeatable!==false?'checked':'')+' onchange="saveTaskField('+i+',\'repeatable\',this.checked)" style="accent-color:#ff8c00">'
          +'<span style="font-size:11px;color:#bbb">Repeatable</span></label></div>'
          +'<div class="task-row"><span class="task-label">Cooldown</span>'
          +'<input class="task-input" type="number" min="0" style="max-width:60px" value="'+(t.cooldownHours||0)+'" oninput="saveTaskField('+i+',\'cooldownHours\',+this.value||0)">'
          +'<span style="font-size:10px;color:#888">h</span></div>'
          +'</div>'
          +'<div class="task-2col">'
          +'<div class="task-row"><span class="task-label">Min Rank</span>'
          +'<select class="task-input task-rank-sel" data-ti="'+i+'" data-rf="minRank" onchange="saveTaskField('+i+',\'minRank\',this.value)">'+rankOpts+'</select></div>'
          +'<div class="task-row"><span class="task-label">Max Rank</span>'
          +'<select class="task-input task-rank-sel" data-ti="'+i+'" data-rf="maxRank" onchange="saveTaskField('+i+',\'maxRank\',this.value)">'+rankOpts+'</select></div>'
          +'</div>'
          +'<div class="task-row"><span class="task-label">Trust req.</span>'
          +'<input class="task-input" type="number" min="0" style="max-width:55px" value="'+(t.requiresTrust||0)+'" oninput="saveTaskField('+i+',\'requiresTrust\',+this.value||0)">'
          +'<span style="font-size:10px;color:#888;flex:1">completed tasks with this archetype</span></div>';

        // Task chaining
        c+='<div class="task-det-section-lbl" style="margin-top:10px">Chaining</div>';
        // Build task ID options from all pools
        const _allTaskIds=[];
        const _allPools=[...getTaskPools(),...getCustomPools()];
        _allPools.forEach(p=>(p.tasks||[]).forEach(tt=>{if(tt.id&&tt.id!==t.id)_allTaskIds.push(tt.id);}));
        let _tdOpts='<option value="">— none —</option>';
        _allTaskIds.forEach(tid=>{_tdOpts+=`<option value="${esc(tid)}"${t.requiresTaskDone===tid?' selected':''}>${esc(tid)}</option>`;});
        c+='<div class="task-row"><span class="task-label">Requires task done</span>'
          +'<select class="task-input" onchange="saveTaskField('+i+',\'requiresTaskDone\',this.value)">'+_tdOpts+'</select></div>';
        c+='<div class="task-row"><span class="task-label">Requires info</span>'
          +'<input class="task-input" placeholder="info_portion_id (set via give_info in dialog)" value="'+esc(t.requiresInfo||'')+'" oninput="saveTaskField('+i+',\'requiresInfo\',this.value)"></div>';

        // Trade reward modifiers
        c+='<div class="task-det-section-lbl" style="margin-top:10px">Trade Reward Modifiers</div>';
        c+='<div class="task-2col">'
          +'<div class="task-row"><span class="task-label">Buy discount</span>'
          +'<input class="task-input" type="number" step="1" min="-100" max="0" placeholder="0" value="'+Math.round((t.rewardBuyMod||0)*100)+'" oninput="saveTaskField('+i+',\'rewardBuyMod\',(+this.value||0)/100)">'
          +'<span style="font-size:10px;color:#888">%</span></div>'
          +'<div class="task-row"><span class="task-label">Sell bonus</span>'
          +'<input class="task-input" type="number" step="1" min="0" max="100" placeholder="0" value="'+Math.round((t.rewardSellMod||0)*100)+'" oninput="saveTaskField('+i+',\'rewardSellMod\',(+this.value||0)/100)">'
          +'<span style="font-size:10px;color:#888">%</span></div>'
          +'</div>';

        // Dialog & flow
        c+='<div class="task-det-section-lbl" style="margin-top:10px">Dialog & Flow</div>';
        c+='<div class="task-row"><span class="task-label">Description</span>'
          +'<input class="task-input" placeholder="Brief task description (optional — appears in task log)..." value="'+esc(t.desc||'')+'" oninput="saveTaskField('+i+',\'desc\',this.value)"></div>';
        c+='<div class="task-row"><span class="task-label">On Complete</span>'
          +'<select class="task-input task-compl-sel" data-ti="'+i+'" onchange="saveTaskField('+i+',\'completionNode\',this.value)">'
          +'<option value="">\u2014 end conversation \u2014</option>'+nodeOpts+'</select></div>';
        c+='<div style="font-size:10px;color:#777;margin-top:6px">Task ID: <code style="color:#aaa;font-size:10px">'+esc(t.id||'')+'</code> — reference in Node Graph hub to wire up dialog.</div>';

        c+='</div></div>'; // end details-body + task-details
        c+='</div>'; // end task-card
        return c;
    });
    // Build HTML with chain connectors between cards + chain labels
    _cardHtmls.forEach((ch,si)=>{
        // Chain label before first card of a linked group
        var curIdx=_sortedTaskIdxs[si];
        var isChainStart=tasks[curIdx].linkNext&&(curIdx===0||!tasks[curIdx-1]||!tasks[curIdx-1].linkNext);
        if(isChainStart){
            var grp=_getLinkedGroup(curIdx);
            html+='<div class="task-chain-label"><i class="bi">🔗</i> Story Chain: '+grp.length+' task'+(grp.length>1?'s':'')+'</div>';
        }
        html+=ch;
        if(si<_cardHtmls.length-1){
            const curIdx=_sortedTaskIdxs[si];
            const nextIdx=_sortedTaskIdxs[si+1];
            const adjacent=(nextIdx===curIdx+1);
            const isLinked=adjacent&&!!tasks[curIdx].linkNext;
            if(adjacent){
                if(isLinked){
                    html+='<div class="task-link-connector linked" onclick="toggleTaskLink('+curIdx+')" title="Click to unlink these tasks">'
                        +_buildChainSvg()
                        +'</div>';
                } else {
                    html+='<div class="task-link-connector" onclick="toggleTaskLink('+curIdx+')" title="Link these tasks — they will toggle and move together">'
                        +'<div class="task-link-line"></div>'
                        +'<span class="task-link-icon">\u{1F517}</span>'
                        +'<div class="task-link-line"></div>'
                        +'</div>';
                }
            }
        }
    });

    // Saved categories manager
    let catMgr='';
    const _allCats=getSavedCategories();
    if(_allCats.length){
        catMgr='<details class="task-cat-manager"><summary style="font-size:11px;color:#888;cursor:pointer;padding:4px 0;margin-top:4px">Saved Categories ('+_allCats.length+')</summary>';
        _allCats.forEach((cat,ci)=>{
            catMgr+='<div class="task-cat-entry">'
                +'<span style="color:#ccc;font-size:12px;flex:1">'+esc(cat.name)+'</span>'
                +'<span style="color:#888;font-size:10px">'+cat.items.length+' items</span>'
                +'<button class="btn bd bs" style="padding:2px 8px;font-size:10px" onclick="deleteSavedCategory('+ci+')">×</button>'
                +'</div>';
        });
        catMgr+='</details>';
    }

    // Bottom add bar
    const bottomBar='<div class="task-add-bar task-add-bar-bottom">'
        +'<button class="btn b2 bs" onclick="addTask(\'fetch\')"><i class="bi">🎒</i> Fetch</button>'
        +'<button class="btn b2 bs" onclick="addTask(\'delivery\')"><i class="bi">📦</i> Delivery</button>'
        +'<button class="btn b2 bs" onclick="addTask(\'talk\')"><i class="bi">💬</i> Talk</button>'
        +'<button class="btn b2 bs" onclick="addTask(\'collect\')"><i class="bi">📋</i> Collect</button>'
        +'</div>';

    // Build minimap
    var minimap='';
    if(tasks.length>1){
        minimap='<div class="task-minimap">';
        minimap+='<div class="task-minimap-title">Tasks ('+tasks.length+')</div>';
        var visited=new Set();
        _sortedTaskIdxs.forEach(function(idx){
            if(visited.has(idx))return;
            var grp=_getLinkedGroup(idx);
            var isChain=grp.length>1;
            if(isChain){
                minimap+='<div class="task-mm-chain">';
                grp.forEach(function(gi){
                    visited.add(gi);
                    var tt=tasks[gi];var ki=tt.type||'fetch';
                    var kic={fetch:'🎒',delivery:'📦',talk:'💬',collect:'📋'}[ki]||'📋';
                    var lbl=String(tt.openingDialogue||'').trim()||tt.id||('Task '+(gi+1));
                    minimap+='<div class="task-mm-pill" data-mm-idx="'+gi+'"'
                        +' onpointerdown="_mmPointerDown(event,'+gi+')"'
                        +' onclick="_mmClick('+gi+')"'
                        +' title="'+esc(lbl)+'">'
                        +'<i class="bi task-mm-kind">'+kic+'</i>'
                        +'<span class="task-mm-lbl">#'+(gi+1)+' '+esc(lbl)+'</span></div>';
                });
                minimap+='</div>';
            } else {
                visited.add(idx);
                var tt=tasks[idx];var ki=tt.type||'fetch';
                var kic={fetch:'🎒',delivery:'📦',talk:'💬',collect:'📋'}[ki]||'📋';
                var lbl=String(tt.openingDialogue||'').trim()||tt.id||('Task '+(idx+1));
                minimap+='<div class="task-mm-pill" data-mm-idx="'+idx+'"'
                    +' onpointerdown="_mmPointerDown(event,'+idx+')"'
                    +' onclick="_mmClick('+idx+')"'
                    +' title="'+esc(lbl)+'">'
                    +'<i class="bi task-mm-kind">'+kic+'</i>'
                    +'<span class="task-mm-lbl">#'+(idx+1)+' '+esc(lbl)+'</span></div>';
            }
        });
        minimap+='</div>';
    }

    box.innerHTML=subTabsHtml+poolUi+'<div class="task-layout">'+'<div class="task-cards-col">'+html+catMgr+bottomBar+'</div>'+minimap+'</div>';

    // Restore select values after innerHTML
    tasks.forEach((t,i)=>{
        const card=box.querySelector('.task-card[data-task-idx="'+i+'"]');if(!card)return;
        if(t.completionNode){const s=card.querySelector('.task-compl-sel');if(s)s.value=t.completionNode;}
        if(t.minRank){const s=card.querySelector('[data-rf="minRank"]');if(s)s.value=t.minRank;}
        if(t.maxRank){const s=card.querySelector('[data-rf="maxRank"]');if(s)s.value=t.maxRank;}
        if(t.itemCategory){const s=card.querySelector('.task-cat-sel');if(s)s.value=t.itemCategory;}
    });

    // Init visible inline item browsers
    tasks.forEach((t,i)=>{
        ['target','shoppingItems','reward'].forEach(f=>{
            if(_isTaskIbOpen(t,i,f)){
                const host=document.getElementById('taskIbHost_'+i+'_'+f);
                if(host)_initTaskIb(i,f,host);
            }
        });
        // Init category browser if open for this task
        if(_catBrowserTaskIdx===i){
            const catHost=document.getElementById('catBrowserHost_'+i);
            if(catHost){catHost._ibCfg=null;renderItemBrowser(catHost,makeCatBrowserConfig(i));}
        }
    });

    // Auto-scroll + focus newly added task
    if(_pendingFocusTaskIdx>=0){
        const fi=_pendingFocusTaskIdx;
        _pendingFocusTaskIdx=-1;
        setTimeout(()=>{
            const card=box.querySelector('.task-card[data-task-idx="'+fi+'"]');
            if(card){
                card.scrollIntoView({behavior:'smooth',block:'center'});
                const inp=card.querySelector('.task-name-input');
                if(inp)inp.focus();
            }
        },60);
    }

    if(typeof TexEditor!=='undefined'&&TexEditor.refreshLayers)TexEditor.refreshLayers('tex-screen-dialogue');
}
