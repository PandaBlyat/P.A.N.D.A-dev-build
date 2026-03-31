// ═══════════════════════════════════════════
// DIALOG FLAT NODE SYSTEM
// ═══════════════════════════════════════════

// ── Migration: convert old nested branches format to flat nodes (runs once on load) ──
function migrateDlgToFlat(d){
    if(!d||d.nodes||d.dialogs)return; // already flat or new multi-dialog format
    d.nodes={};d.hubChoices=[];
    let counter=1;
    function makeId(){return 'n'+(counter++);}
    function walkBranch(b){
        const id=makeId();
        const npc=String((b.steps&&b.steps[0]&&b.steps[0].n)||'').trim();
        const choices=[];
        if(b.end==='branch'&&Array.isArray(b.children)&&b.children.length){
            b.children.forEach(ch=>{ // each child becomes a choice
                const childId=walkBranch(ch);
                choices.push({text:String((ch.steps&&ch.steps[0]&&ch.steps[0].p)||'').trim(), next:childId});
            });
        }else if(b.end==='exit'){
            choices.push({text:'I understand.', next:'__end__'});
        }else{
            choices.push({text:'I have another question.', next:'__hub__'});
        }
        d.nodes[id]={npc, choices};
        return id;
    }
    (d.branches||[]).forEach(b=>{
        const id=walkBranch(b);
        d.hubChoices.push({text:String((b.steps&&b.steps[0]&&b.steps[0].p)||'').trim(), next:id});
    });
    delete d.branches; // remove old format
    delete d.layout;   // reset layout so auto-arrange runs fresh
}

// ── Node CRUD ──
let nodeCounter=1;
function flatNewId(d){
    // generate a unique short id like n1, n2...
    const ids=new Set(Object.keys(d.nodes||{}));
    let id;
    do{id='n'+(nodeCounter++);}while(ids.has(id));
    return id;
}
function flatGetNode(d,id){return d.nodes&&d.nodes[id];}
function flatCreateNode(d){
    // creates a new empty node, returns its id
    const id=flatNewId(d);
    d.nodes[id]={npc:'', choices:[{text:'', next:'__hub__'}]};
    return id;
}
function flatDeleteNode(d,id){
    delete d.nodes[id];
    if(d.layout)delete d.layout[id];
    // clean up any choices pointing to deleted node → redirect to __hub__
    (d.hubChoices||[]).forEach(c=>{if(c.next===id)c.next='__hub__';});
    Object.values(d.nodes||{}).forEach(n=>{
        (n.choices||[]).forEach(c=>{if(c.next===id)c.next='__hub__';});
    });
    if(selectedBranchPath===id)selectedBranchPath='';
}
function flatAddChoiceToNode(d,fromId){
    const targetId=flatCreateNode(d);
    const node=(fromId==='__hub__')?null:flatGetNode(d,fromId);
    const src=(fromId==='__hub__')?(d.hubChoices=d.hubChoices||[]):node&&node.choices;
    if(!src)return targetId;
    src.push({text:'',next:targetId});
    return targetId;
}
function flatRemoveChoice(d,fromId,ci){
    const node=(fromId==='__hub__')?null:flatGetNode(d,fromId);
    const arr=(fromId==='__hub__')?d.hubChoices:node&&node.choices;
    if(!arr)return;
    arr.splice(ci,1);
}
function flatSetChoiceNext(d,fromId,ci,nextId){
    const node=(fromId==='__hub__')?null:flatGetNode(d,fromId);
    const arr=(fromId==='__hub__')?d.hubChoices:node&&node.choices;
    if(arr&&arr[ci])arr[ci].next=nextId;
}
function flatSetChoiceText(d,fromId,ci,txt){
    const node=(fromId==='__hub__')?null:flatGetNode(d,fromId);
    const arr=(fromId==='__hub__')?d.hubChoices:node&&node.choices;
    if(arr&&arr[ci])arr[ci].text=txt;
}
function flatSetNodeNpc(d,id,txt){
    const n=flatGetNode(d,id);
    if(!n)return;
    const vi=_getNodeVar(id);
    if(vi<=0){n.npc=txt;}
    else{
        if(!Array.isArray(n.npcVariations))n.npcVariations=[];
        n.npcVariations[vi-1]=txt;
    }
}

// ── NPC text variations (works for nodes, hub, opener) ──
// nodeId: regular node id, '__hub__', or '__opener__'
const _nodeActiveVar={}; // varKey → 0-based variation index (0=original)
function _varKey(nodeId){
    var ti=typeof curDlgTreeIdx!=='undefined'?curDlgTreeIdx:0;
    return (_introTabActive?'intro':ti)+'_'+nodeId;
}
function _getNodeVar(nodeId){return _nodeActiveVar[_varKey(nodeId)]||0;}

// Get text for a variation — works for node objects, or tree-level fields
// Variations can be strings (text-only) or objects {text, hasInfo, dontHasInfo, giveInfo, action}
function _varText(v){return typeof v==='object'&&v?String(v.text||''):String(v||'');}
function _varObj(v){return typeof v==='object'&&v?v:{text:String(v||'')};}
function getNodeNpcText(node,nodeId){
    var vi=_getNodeVar(nodeId);
    if(vi<=0)return String(node.npc||'');
    if(!Array.isArray(node.npcVariations)||!node.npcVariations[vi-1])return String(node.npc||'');
    return _varText(node.npcVariations[vi-1]);
}
function getTreeFieldVarText(tree,field,nodeId){
    var vi=_getNodeVar(nodeId);
    if(vi<=0)return String(tree[field]||'');
    var varArr=tree[field+'Variations'];
    if(!Array.isArray(varArr)||!varArr[vi-1])return String(tree[field]||'');
    return _varText(varArr[vi-1]);
}

// Count variations
function getNodeVarCount(node){
    return 1+(Array.isArray(node.npcVariations)?node.npcVariations.length:0);
}
function getTreeFieldVarCount(tree,field){
    var varArr=tree[field+'Variations'];
    return 1+(Array.isArray(varArr)?varArr.length:0);
}

// Switch active variation
function switchNodeVar(nodeId,vi){
    _nodeActiveVar[_varKey(nodeId)]=vi;
    renderBranches();
}

// Add variation — for node objects
function addNodeVariation(nodeId){
    var d=getCurTree();if(!d)return;
    var n=flatGetNode(d,nodeId);
    if(!n)return;
    if(!Array.isArray(n.npcVariations))n.npcVariations=[];
    n.npcVariations.push(String(n.npc||''));
    _nodeActiveVar[_varKey(nodeId)]=n.npcVariations.length;
    autoSave();renderBranches();
}
// Add variation — for tree-level fields (hub, openerNpc)
function addTreeFieldVariation(field,nodeId){
    var d=getCurTree();if(!d)return;
    var varKey=field+'Variations';
    if(!Array.isArray(d[varKey]))d[varKey]=[];
    d[varKey].push(String(d[field]||''));
    _nodeActiveVar[_varKey(nodeId)]=d[varKey].length;
    autoSave();renderBranches();
}

// Remove variation — for node objects
function removeNodeVariation(nodeId,vi){
    var d=getCurTree();if(!d)return;
    var n=flatGetNode(d,nodeId);
    if(!n||!Array.isArray(n.npcVariations)||vi<1||vi>n.npcVariations.length)return;
    n.npcVariations.splice(vi-1,1);
    if(!n.npcVariations.length)delete n.npcVariations;
    if(_getNodeVar(nodeId)>=getNodeVarCount(n))_nodeActiveVar[_varKey(nodeId)]=0;
    autoSave();renderBranches();
}
// Remove variation — for tree-level fields
function removeTreeFieldVariation(field,nodeId,vi){
    var d=getCurTree();if(!d)return;
    var varKey=field+'Variations';
    if(!Array.isArray(d[varKey])||vi<1||vi>d[varKey].length)return;
    d[varKey].splice(vi-1,1);
    if(!d[varKey].length)delete d[varKey];
    if(_getNodeVar(nodeId)>=getTreeFieldVarCount(d,field))_nodeActiveVar[_varKey(nodeId)]=0;
    autoSave();renderBranches();
}

// Set text for active variation — tree-level fields
function setTreeFieldVarText(field,nodeId,txt){
    var d=getCurTree();if(!d)return;
    var vi=_getNodeVar(nodeId);
    if(vi<=0){d[field]=txt;}
    else{
        var varKey=field+'Variations';
        if(!Array.isArray(d[varKey]))d[varKey]=[];
        d[varKey][vi-1]=txt;
    }
    autoSave();
}

// ── UI helpers ──
function selectBranch(id,skipRerender){
    const path=String(id||'');
    if(path===selectedBranchPath)return; // already selected — don't re-render and steal focus
    selectedBranchPath=path;
    updateSelectedBranchUi();
    if(skipRerender){
        // Toggle .selected class directly — avoids destroying DOM and losing focus/cursor
        const canvas=document.getElementById('dialogGraphCanvas');
        if(canvas){
            canvas.querySelectorAll('.dlg-node.selected').forEach(n=>n.classList.remove('selected'));
            const sel=canvas.querySelector('.dlg-node[data-nid="'+CSS.escape(path)+'"]');
            if(sel)sel.classList.add('selected');
        }
    }else{
        renderBranches();
    }
    highlightParentLink(id);
}
function highlightParentLink(nodeId){
    document.querySelectorAll('.dlg-link.link-active').forEach(p=>p.classList.remove('link-active'));
    document.querySelectorAll('.dlg-node.node-active').forEach(n=>n.classList.remove('node-active'));
    if(!nodeId||nodeId==='__hub__')return;
    const svg=document.querySelector('#dialogGraphCanvas .dlg-links');
    if(!svg)return;
    const inLinks=svg.querySelectorAll(`path[data-to="${nodeId}"]`);
    inLinks.forEach(path=>{
        path.classList.add('link-active');
        const parentId=path.getAttribute('data-from');
        if(parentId){
            const parentEl=document.querySelector(`.dlg-node[data-nid="${parentId}"]`);
            if(parentEl)parentEl.classList.add('node-active');
        }
    });
}
function startNodeRename(titleEl,nodeId){
    if(nodeId==='__hub__')return;
    const n=getCurTree()?.nodes?.[nodeId];
    if(!n)return;
    titleEl.contentEditable='true';
    titleEl.textContent=n.label||'';
    titleEl.focus();
    const range=document.createRange();range.selectNodeContents(titleEl);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    const finish=()=>{
        titleEl.contentEditable='false';
        n.label=titleEl.textContent.trim();
        autoSave();renderBranches();
    };
    titleEl.onblur=finish;
    titleEl.onkeydown=(e)=>{if(e.key==='Enter'){e.preventDefault();titleEl.blur();}if(e.key==='Escape'){titleEl.textContent=n.label||'';titleEl.blur();}};
}
function updateSelectedBranchUi(){
    const el=document.getElementById('f_selectedBranch');
    const graphEl=document.getElementById('f_graphSelectedPath');
    const value=selectedBranchPath?`Node ${selectedBranchPath}`:'None selected';
    if(el)el.value=value;
    if(graphEl)graphEl.value=value;
}
function graphCreateRootBranch(){
    graphPushUndo();
    const d=getCurTree();
    const id=flatCreateNode(d);
    d.hubChoices=d.hubChoices||[];
    d.hubChoices.push({text:'',next:id});
    selectedBranchPath=id;
    renderBranches();
}
function deleteSelectedBranch(){
    if(!selectedBranchPath||selectedBranchPath==='__hub__'||selectedBranchPath==='__opener__')return;
    if(!confirm(`Delete node ${selectedBranchPath}? Choices pointing to it will redirect to Hub.`))return;
    graphPushUndo();
    flatDeleteNode(getCurTree(),selectedBranchPath);
    renderBranches();
}
// ── Insert pool task flow (gate → summary → accept/decline + no-task exit) ──
function deInsertPoolFlow(fromId,ci,poolTag){
    const d=getCurTree();if(!d)return;
    graphPushUndo();
    d.nodes=d.nodes||{};
    const suf=poolTag==='default'?'':'_'+poolTag;
    const tagLabel=poolTag.charAt(0).toUpperCase()+poolTag.slice(1);

    // Create gate node — NPC offers task (gated by arch_has_task_pool)
    const gateId=flatNewId(d);
    d.nodes[gateId]={
        npc:'Wait, I have a job for you.',
        poolTag:poolTag, poolRole:'gate',
        precondition:'dialogs.arch_has_task_pool'+suf,
        choices:[]
    };

    // Create summary node — NPC shows task details (script_text)
    const sumId=flatNewId(d);
    d.nodes[sumId]={
        npc:'',
        poolTag:poolTag, poolRole:'summary',
        scriptText:'dialogs.arch_text_task_offer_summary'+suf,
        choices:[
            {text:"I'll do it.", next:'__end__', action:'dialogs.arch_task_accept'+suf},
            {text:'Not right now.', next:'__end__', action:'dialogs.arch_task_decline'+suf}
        ]
    };
    // Gate choice → summary
    d.nodes[gateId].choices.push({text:'Okay, give me the details.', next:sumId});

    // Create no-task exit node — invisible gate when pool is empty
    const exitId=flatNewId(d);
    d.nodes[exitId]={
        npc:'',
        poolTag:poolTag, poolRole:'exit',
        precondition:'dialogs.arch_no_task_pool'+suf,
        choices:[]
    };

    // Wire the source choice to the gate node
    const node=(fromId==='__hub__')?null:flatGetNode(d,fromId);
    const arr=(fromId==='__hub__')?d.hubChoices:node&&node.choices;
    if(arr&&arr[ci]){
        arr[ci].next=gateId;
    }

    // Add the no-task exit as a sibling choice on the SAME parent
    // (Anomaly picks first matching precondition, so exit only shows when gate doesn't)
    if(arr){
        arr.splice(ci+1,0,{text:'', next:exitId, _poolExit:true});
    }

    autoSave();renderBranches();
}

// ── Insert turnin template (simple complete+reward) ──
function deInsertTurninFlow(fromId,ci,poolTag){
    const d=getCurTree();if(!d)return;
    graphPushUndo();
    d.nodes=d.nodes||{};
    const suf=poolTag==='default'?'':'_'+poolTag;

    // Create result node — NPC delivers result
    const resId=flatNewId(d);
    d.nodes[resId]={
        npc:'',
        poolTag:poolTag, poolRole:'turnin',
        scriptText:'dialogs.arch_text_task_result'+suf,
        action:'dialogs.arch_task_try_complete'+suf+';dialogs.arch_task_deliver_rewards'+suf,
        choices:[]
    };

    // Wire source choice to result node
    const node=(fromId==='__hub__')?null:flatGetNode(d,fromId);
    const arr=(fromId==='__hub__')?d.hubChoices:node&&node.choices;
    if(arr&&arr[ci]){
        arr[ci].next=resId;
    }

    autoSave();renderBranches();
}

function addChild(fromId){
    graphPushUndo();flatAddChoiceToNode(getCurTree(),fromId);renderBranches();
    setTimeout(()=>{const node=document.querySelector(`.dlg-node[data-nid="${fromId}"]`);if(node){const rows=node.querySelectorAll('.dlg-node-row-text');const last=rows[rows.length-1];if(last)last.focus();}},60);
}
function confirmRowDelete(nodeId,ci){
    const d=getCurTree();
    const choices=(nodeId==='__hub__')?(d.hubChoices||[]):(d.nodes[nodeId]?.choices||[]);
    const ch=choices[ci];
    if(!ch){graphPushUndo();flatRemoveChoice(d,nodeId,ci);autoSave();renderBranches();return;}
    const targetId=ch.next;
    // If target is a real node (not hub/end/empty), offer cascade delete
    if(targetId&&targetId!=='__hub__'&&targetId!=='__end__'&&d.nodes[targetId]){
        // Collect all downstream nodes reachable exclusively from this choice
        const downstream=collectDownstream(d,targetId,nodeId);
        if(downstream.size>0){
            const count=downstream.size;
            const msg=`Delete this response and ${count} connected node${count>1?'s':''}?\n\n• "Delete all" removes the response + connected nodes\n• "Response only" removes just this response`;
            // Use a small inline confirm approach
            showCascadeDeleteMenu(nodeId,ci,targetId,downstream);
            return;
        }
    }
    graphPushUndo();flatRemoveChoice(d,nodeId,ci);autoSave();renderBranches();
}
function collectDownstream(d,startId,excludeParent){
    // BFS to find nodes reachable from startId that aren't reachable from other paths
    const visited=new Set();
    const q=[startId];
    while(q.length){
        const cur=q.shift();
        if(visited.has(cur))continue;
        if(!d.nodes[cur])continue;
        visited.add(cur);
        (d.nodes[cur].choices||[]).forEach(ch=>{
            if(ch.next&&ch.next!=='__hub__'&&ch.next!=='__end__'&&d.nodes[ch.next]&&!visited.has(ch.next))q.push(ch.next);
        });
    }
    return visited;
}
function showCascadeDeleteMenu(nodeId,ci,targetId,downstream){
    closeCascadeDeleteMenu();
    const row=document.querySelector(`.dlg-node[data-nid="${nodeId}"] .dlg-node-row[data-ci="${ci}"]`);
    if(!row)return;
    const popup=document.createElement('div');
    popup.className='cascade-del-menu';popup.id='cascadeDelPopup';
    const count=downstream.size;
    popup.innerHTML=`<div class="cascade-del-title">Delete ${count} connected node${count>1?'s':''}?</div>
        <button class="cascade-del-opt danger" onclick="doCascadeDelete('${nodeId.replace(/'/g,"\\'")}',${ci},true)">🗑 Delete all (${count+1})</button>
        <button class="cascade-del-opt" onclick="doCascadeDelete('${nodeId.replace(/'/g,"\\'")}',${ci},false)">✕ Response only</button>`;
    getPopupParent().appendChild(popup);
    const rect=row.getBoundingClientRect();
    popup.style.position='fixed';
    popup.style.left=Math.min(rect.right+4,window.innerWidth-180)+'px';
    popup.style.top=rect.top+'px';
    popup.style.zIndex='9999';
    setTimeout(()=>document.addEventListener('click',_closeCascadeOnOutside,{once:true,capture:true}),10);
}
function closeCascadeDeleteMenu(){const p=document.getElementById('cascadeDelPopup');if(p)p.remove();}
function _closeCascadeOnOutside(e){const p=document.getElementById('cascadeDelPopup');if(p&&!p.contains(e.target))closeCascadeDeleteMenu();}
function doCascadeDelete(nodeId,ci,cascade){
    closeCascadeDeleteMenu();
    graphPushUndo();
    const d=getCurTree();
    if(cascade){
        const choices=(nodeId==='__hub__')?(d.hubChoices||[]):(d.nodes[nodeId]?.choices||[]);
        const ch=choices[ci];
        if(ch&&ch.next&&ch.next!=='__hub__'&&ch.next!=='__end__'&&d.nodes[ch.next]){
            const downstream=collectDownstream(d,ch.next,nodeId);
            downstream.forEach(id=>flatDeleteNode(d,id));
        }
    }
    flatRemoveChoice(d,nodeId,ci);
    autoSave();renderBranches();
}
function highlightLinkedRow(nodeId,ci){
    clearLinkedRowHighlight();
    const svg=document.querySelector('#dialogGraphCanvas .dlg-links');
    if(svg){
        const path=svg.querySelector(`path[data-from="${nodeId}"][data-ci="${ci}"]`);
        if(path)path.classList.add('link-active');
    }
    const d=getCurTree();
    const choices=(nodeId==='__hub__')?(d.hubChoices||[]):(d.nodes[nodeId]?.choices||[]);
    const ch=choices[ci];
    if(ch&&ch.next&&ch.next!=='__end__'){
        const tgtNid=(ch.next==='__hub__')?'__hub__':ch.next;
        const tgtEl=document.querySelector(`.dlg-node[data-nid="${tgtNid}"]`);
        if(tgtEl)tgtEl.classList.add('node-active');
    }
}
function clearLinkedRowHighlight(){
    document.querySelectorAll('.dlg-link.link-active').forEach(p=>p.classList.remove('link-active'));
    document.querySelectorAll('.dlg-node.node-active').forEach(n=>n.classList.remove('node-active'));
}
function handleRowKeydown(nodeId,ci,e){
    if(e.key==='Enter'&&!e.shiftKey){
        e.preventDefault();
        addChild(nodeId);
        return;
    }
    if(e.key==='Tab'&&!e.shiftKey){
        e.preventDefault();
        const d=getCurTree();
        const choices=(nodeId==='__hub__')?(d.hubChoices||[]):(d.nodes[nodeId]?.choices||[]);
        const ch=choices[ci];
        if(!ch)return;
        const targetId=ch.next;
        if(!targetId||targetId==='__end__')return;
        const tgtNid=(targetId==='__hub__')?'__hub__':targetId;
        const tgtNode=document.querySelector(`.dlg-node[data-nid="${tgtNid}"] .dlg-node-npc`);
        if(tgtNode)tgtNode.focus();
    }
}
function updateGraphFullscreenButton(){
    const btn=document.getElementById('btnGraphFullscreen');
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!btn||!canvas)return;
    const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
    btn.textContent=(fsEl===canvas)?'Exit Fullscreen':'⛶';
}
function toggleGraphFullscreen(){
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
    if(fsEl===canvas){
        if(document.exitFullscreen)document.exitFullscreen();
        else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    }else{
        if(canvas.requestFullscreen)canvas.requestFullscreen();
        else if(canvas.webkitRequestFullscreen)canvas.webkitRequestFullscreen();
    }
}
document.addEventListener('fullscreenchange',_onGraphFsChange);
document.addEventListener('webkitfullscreenchange',_onGraphFsChange);
function _onGraphFsChange(){
    const canvas=document.getElementById('dialogGraphCanvas');
    const toolbar=document.getElementById('graphFsToolbar');
    const toggleBtn=document.getElementById('graphFsToggle');
    const errBar=document.getElementById('graphFsErrors');
    const minimap=document.getElementById('dialogMinimap');
    if(!canvas||!toolbar)return;
    const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
    const isFs=(fsEl===canvas);
    if(isFs){
        // Move overlays inside canvas so they're visible in fullscreen
        canvas.appendChild(toolbar);
        if(toggleBtn)canvas.appendChild(toggleBtn);
        if(errBar)canvas.appendChild(errBar);
        if(minimap)canvas.appendChild(minimap);
        toolbar.classList.add('fs-active');
        toolbar.classList.remove('visible');
        if(toggleBtn)toggleBtn.classList.add('fs-active');
        syncGraphFsErrors();
        syncGraphFsTreeTabs();
        setTimeout(()=>{if(typeof updateMinimap==='function')updateMinimap();},50);
    }else{
        // Move overlays back to the container
        const container=document.getElementById('graphFsContainer');
        if(container){
            container.insertBefore(toolbar,canvas);
            if(toggleBtn)container.insertBefore(toggleBtn,canvas);
            if(errBar)container.appendChild(errBar);
            if(minimap)container.appendChild(minimap);
        }
        toolbar.classList.remove('fs-active','visible');
        if(toggleBtn)toggleBtn.classList.remove('fs-active');
        if(errBar)errBar.classList.remove('has-errors');
    }
    updateGraphFullscreenButton();
}
function toggleGraphFsToolbar(){
    const toolbar=document.getElementById('graphFsToolbar');
    if(!toolbar)return;
    toolbar.classList.toggle('visible');
}
function syncGraphFsTreeTabs(){
    const dst=document.getElementById('graphFsTreeTabs');
    if(!dst)return;
    const d=typeof getDlg==='function'?getDlg():null;
    if(!d||!d.dialogs){dst.innerHTML='';return;}
    let html='';
    // All tab
    const allActive=typeof _mainTabActive!=='undefined'&&_mainTabActive&&!curVanillaCat&&!curTaskPoolTag;
    html+=`<button class="${allActive?'active':''}" onclick="selectMainTab()">All</button>`;
    // Custom dialogs
    d.dialogs.forEach((t,i)=>{
        const active=!_mainTabActive&&curVanillaCat===null&&curTaskPoolTag===null&&i===(typeof curDlgTreeIdx!=='undefined'?curDlgTreeIdx:0);
        html+=`<button class="${active?'active':''}" onclick="selectCustomDialog(${i})">${typeof esc==='function'?esc(t.label||('Dialog '+(i+1))):(t.label||('Dialog '+(i+1)))}</button>`;
    });
    // Vanilla categories
    const s=typeof getD==='function'?(getD('settings')||{}):{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
    if(typeof STRIP_CATEGORIES!=='undefined'){
        STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id)).forEach(cat=>{
            const active=!_mainTabActive&&curVanillaCat===cat.id;
            const editable=typeof isVanillaCatEditable==='function'&&isVanillaCatEditable(cat.id);
            html+=`<button class="${active?'active':''}" ${editable?`onclick="selectVanillaCat('${cat.id}')"`:'title="Vanilla — not editable"'} style="color:${active?'#ffe082':'#999'};${editable?'':'opacity:0.6;cursor:default;'}">${typeof esc==='function'?esc(cat.label):cat.label}</button>`;
        });
    }
    // Defined pools
    (d.taskPools||[]).forEach(pool=>{
        const active=curTaskPoolTag===pool.tag;
        html+=`<button class="${active?'active':''}" onclick="selectTaskPool('${pool.tag}')" style="color:${active?'#ffb74d':'#999'}">${pool.tag.charAt(0).toUpperCase()+pool.tag.slice(1)}</button>`;
    });
    // Custom pools
    (d.customPools||[]).forEach(pool=>{
        const active=curTaskPoolTag===pool.tag;
        html+=`<button class="${active?'active':''}" onclick="selectTaskPool('${pool.tag}')" style="color:${active?'#82b1ff':'#999'}">📋 ${pool.tag}</button>`;
    });
    dst.innerHTML=html;
}
function syncGraphFsErrors(){
    const dst=document.getElementById('graphFsErrors');
    if(!dst)return;
    const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
    if(!fsEl){dst.innerHTML='';dst.classList.remove('has-errors');return;}
    const src=document.getElementById('dialogValidation');
    const bsrc=document.getElementById('bindingValidation');
    let html='';
    if(src&&src.innerHTML.trim())html+=src.innerHTML;
    if(bsrc&&bsrc.innerHTML.trim())html+=bsrc.innerHTML;
    if(html){
        dst.innerHTML=html;
        dst.classList.add('has-errors');
    }else{
        dst.innerHTML='';
        dst.classList.remove('has-errors');
    }
}


function autoArrangeDialogGraph(){
    const d=getCurTree();
    d.layout={}; // clear all positions
    applyFlatLayout(d,true); // force full re-layout
    autoSave();
    renderBranches();
}
function makeSearchRegex(query){
    const escaped=String(query||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(escaped,'gi');
}
function replaceWithCount(src,re,repl){
    let count=0;
    const out=String(src||'').replace(re,()=>{count++;return repl;});
    return {out,count};
}
function eachDialogStep(d,fn){
    // flat: iterate all node npc texts and all choice texts
    (d.hubChoices||[]).forEach((ch,ci)=>fn('hub_choice_'+ci, ch.text, '__hub__'));
    Object.entries(d.nodes||{}).forEach(([id,n])=>{
        fn('npc_'+id, n.npc, id);
        (n.choices||[]).forEach((ch,ci)=>fn(`choice_${id}_${ci}`, ch.text, id));
    });
}
function runDialogSearch(){
    const box=document.getElementById('dialogSearchResults');
    const q=(document.getElementById('f_dlgSearch')||{}).value||'';
    if(!q.trim()){if(box)box.textContent='Type a search term.';return;}
    const includeVanilla=!!(document.getElementById('f_dlgSearchVanilla')||{}).checked;
    const includeIds=!!(document.getElementById('f_dlgSearchIds')||{}).checked;
    const dlgData=getDlg();const re=makeSearchRegex(q);const hits=[];
    const pushHit=(label,value)=>{if(re.test(String(value||'')))hits.push(`${label}: ${String(value||'').trim().slice(0,100)}`);re.lastIndex=0;};
    (dlgData.dialogs||[]).forEach((tree,ti)=>{
        const tl=tree.label||('Dialog '+(ti+1));
        pushHit(`[${tl}] Opener`,tree.opener);pushHit(`[${tl}] Hub NPC`,tree.hub);
        eachDialogStep(tree,(label,txt)=>pushHit(`[${tl}] ${label}`,txt));
    });
    if(includeVanilla){const v=ensureVanillaDlg(dlgData.vanilla);Object.keys(v).forEach(k=>pushHit(`Vanilla ${k}`,v[k]));}
    if(includeIds&&curGrp!==null){
        if(editMode==='char'){const ch=groups[curGrp].chars[curChar];pushHit('Archetype ID',ch.archId);pushHit('Dialog IDs CSV',getD('settings').dialogIdsCsv||'');}
        else{groups[curGrp].chars.forEach((ch,idx)=>pushHit(`Char ${idx+1} ID`,ch.archId));pushHit('Group dialog IDs CSV',groups[curGrp].defaults.settings.dialogIdsCsv||'');}
    }
    if(box)box.innerHTML=hits.length?hits.map(h=>`• ${esc(h)}`).join('<br>'):'No matches.';
}
function runDialogReplaceAll(){
    const q=(document.getElementById('f_dlgSearch')||{}).value||'';
    const repl=(document.getElementById('f_dlgReplace')||{}).value||'';
    if(!q.trim())return;
    const includeVanilla=!!(document.getElementById('f_dlgSearchVanilla')||{}).checked;
    const includeIds=!!(document.getElementById('f_dlgSearchIds')||{}).checked;
    const dlgData=getDlg();const re=makeSearchRegex(q);let changed=0;
    (dlgData.dialogs||[]).forEach(tree=>{
        let r=replaceWithCount(tree.opener,re,repl);tree.opener=r.out;changed+=r.count;
        r=replaceWithCount(tree.hub,re,repl);tree.hub=r.out;changed+=r.count;
        (tree.hubChoices||[]).forEach(ch=>{const rv=replaceWithCount(ch.text,re,repl);ch.text=rv.out;changed+=rv.count;});
        Object.values(tree.nodes||{}).forEach(n=>{
            const rv=replaceWithCount(n.npc,re,repl);n.npc=rv.out;changed+=rv.count;
            (n.choices||[]).forEach(ch=>{const rc=replaceWithCount(ch.text,re,repl);ch.text=rc.out;changed+=rc.count;});
        });
    });
    if(includeVanilla){dlgData.vanilla=ensureVanillaDlg(dlgData.vanilla);Object.keys(dlgData.vanilla).forEach(k=>{const rv=replaceWithCount(dlgData.vanilla[k],re,repl);dlgData.vanilla[k]=rv.out;changed+=rv.count;});}
    if(includeIds&&curGrp!==null){
        if(editMode==='char'){const ch=groups[curGrp].chars[curChar];let ri=replaceWithCount(ch.archId,re,repl);ch.archId=ri.out;changed+=ri.count;const s=getD('settings');ri=replaceWithCount(s.dialogIdsCsv||'',re,repl);s.dialogIdsCsv=ri.out;changed+=ri.count;}
        else{groups[curGrp].chars.forEach(ch=>{const ri=replaceWithCount(ch.archId,re,repl);ch.archId=ri.out;changed+=ri.count;});const gs=groups[curGrp].defaults.settings;const rg=replaceWithCount(gs.dialogIdsCsv||'',re,repl);gs.dialogIdsCsv=rg.out;changed+=rg.count;}
    }
    const box=document.getElementById('dialogSearchResults');
    if(box)box.textContent=`Replaced ${changed} occurrence(s).`;
    const v=ensureVanillaDlg(dlgData.vanilla);const setVal=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
    setVal('f_van_hello1',v.hello1);setVal('f_van_hello2',v.hello2);setVal('f_van_hello3',v.hello3);setVal('f_van_job',v.job);setVal('f_van_anomalies',v.anomalies);setVal('f_van_information',v.information);setVal('f_van_tips',v.tips);setVal('f_van_wounded',v.wounded);
    if(editMode==='char')syncDialogId();
    renderBranches();
}

function collectDialogValidation(d){
    const issues=[];
    if(!d)return{issues};
    if(!String(d.opener||'').trim())issues.push('Root opener is empty.');
    if(!String(d.hub||'').trim())issues.push('Hub NPC text is empty.');
    if(!(d.hubChoices||[]).length)issues.push('No hub choices defined.');
    const nodes=d.nodes||{};
    const allIds=new Set(Object.keys(nodes));
    const reachable=new Set();
    const visit=(id)=>{if(!id||reachable.has(id)||id==='__hub__'||id==='__end__')return;reachable.add(id);(nodes[id]?.choices||[]).forEach(c=>visit(c.next));};
    (d.hubChoices||[]).forEach(c=>visit(c.next));
    allIds.forEach(id=>{if(!reachable.has(id))issues.push(`Node "${id}" is unreachable.`);});
    Object.entries(nodes).forEach(([id,n])=>{
        if(!String(n.npc||'').trim())issues.push(`Node "${id}" has no NPC text.`);
        if(!(n.choices||[]).length)issues.push(`Node "${id}" has no choices (dead end).`);
        (n.choices||[]).forEach((c,ci)=>{
            if(!String(c.text||'').trim())issues.push(`Node "${id}" choice ${ci+1} player text empty.`);
            if(c.next&&c.next!=='__hub__'&&c.next!=='__end__'&&!allIds.has(c.next))issues.push(`Node "${id}" choice ${ci+1} links unknown node "${c.next}".`);
        });
    });
    return{issues};
}

// ── Binding validation — crash patterns, missing refs, flow hints ──
function collectBindingValidation(d){
    var issues=[];
    if(!d)return{issues:issues};
    var nodes=d.nodes||{};
    var allIds=new Set(Object.keys(nodes));
    var taskIds=new Set();var poolTags=new Set();
    var dlg=(typeof getDlg==='function')?getDlg():null;
    if(dlg){
        (dlg.taskPools||[]).forEach(function(p){poolTags.add(p.tag);(p.tasks||[]).forEach(function(t){taskIds.add(t.id);});});
        (dlg.customPools||[]).forEach(function(p){poolTags.add(p.tag);(p.tasks||[]).forEach(function(t){taskIds.add(t.id);});});
    }
    var acceptsSeen=[],completesSeen=[];
    function checkAction(act,nid){
        if(!act)return;
        act.split(';').forEach(function(a){
            var s=a.trim().replace('dialogs.','');if(!s)return;
            if(s.indexOf('arch_accept_')===0){
                var tid=s.replace('arch_accept_','');acceptsSeen.push(tid);
                if(taskIds.size&&!taskIds.has(tid))issues.push({level:'warn',msg:'<i class="bi">📝</i> Accept "'+tid+'" in ['+nid+'] — no matching task'});
            }
            if(s.indexOf('arch_delivery_complete_')===0||s.indexOf('arch_talk_complete_')===0||s.indexOf('arch_collect_pickup_')===0){
                completesSeen.push(s.replace(/^arch_(delivery_complete|talk_complete|collect_pickup)_/,''));
            }
            if(s.indexOf('arch_has_task_pool_')===0){
                var tag=s.replace('arch_has_task_pool_','');
                if(poolTags.size&&!poolTags.has(tag))issues.push({level:'warn',msg:'<i class="bi">🎲</i> Pool "'+tag+'" in ['+nid+'] — no matching pool'});
            }
        });
    }
    (d.hubChoices||[]).forEach(function(c,ci){checkAction(c.action,'hub');checkAction(c.precondition,'hub');});
    Object.entries(nodes).forEach(function(e){
        var nid=e[0],n=e[1];
        checkAction(n.action,nid);checkAction(n.precondition,nid);checkAction(n.scriptText,nid);
        (n.choices||[]).forEach(function(c,ci){
            checkAction(c.action,nid);checkAction(c.precondition,nid);
            if(c.next&&c.next!=='__hub__'&&c.next!=='__end__'&&!allIds.has(c.next))
                issues.push({level:'crash',msg:'<i class="bi">💀</i> Dangling next: ['+nid+'] → "'+c.next+'" (missing)'});
        });
        var ch=n.choices||[];
        if(ch.length>=2){
            var allGated=true;
            ch.forEach(function(c){if(!c.precondition&&!c.hasInfo&&!c.dontHasInfo)allGated=false;});
            if(allGated)issues.push({level:'crash',msg:'<i class="bi">💀</i> ['+nid+'] All choices gated — no fallback (CTD risk)'});
        }
    });
    // Hints
    if(dlg){
        var allTasks=[];
        (dlg.taskPools||[]).forEach(function(p){allTasks.push.apply(allTasks,p.tasks||[]);});
        (dlg.customPools||[]).forEach(function(p){allTasks.push.apply(allTasks,p.tasks||[]);});
        allTasks.forEach(function(t){
            if(t.type==='delivery'&&t.deliverToArchetype)issues.push({level:'hint',msg:'<i class="bi">📦</i> Delivery: '+t.id+' → '+t.deliverToArchetype});
            if(t.type==='talk'&&(t.talkToArchetype||t.talkToGiver))issues.push({level:'hint',msg:'<i class="bi">💬</i> Talk: '+t.id+' → '+(t.talkToGiver?'(giver)':t.talkToArchetype)});
            if(t.type==='collect'&&t.collectFromArchetype)issues.push({level:'hint',msg:'<i class="bi">📋</i> Collect: '+t.id+' → '+t.collectFromArchetype});
        });
        if(acceptsSeen.length>1)issues.push({level:'hint',msg:'<i class="bi">🔗</i> Chain: '+acceptsSeen.length+' tasks with accept bindings'});
    }
    return{issues:issues};
}

// ── renderBranches: top-level refresh called throughout the codebase ──
// ═══════════════════════════════════════════
// NODE EDIT (stubs for removed modal — kept for callers)
// ═══════════════════════════════════════════
function showNodeEditPanel(){}
function hideNodeEditPanel(){}
function showActionMenu(fromId,ci,btnEl){
    closeActionMenu();
    const d=getCurTree();
    const arr=(fromId==='__hub__')?(d.hubChoices||[]):(d.nodes[fromId]?.choices||[]);
    const ch=arr[ci];if(!ch)return;
    _deBpHandlers._graphAction=function(val){graphPushUndo();saveChoiceAction(fromId,ci,val);};
    _deOpenBp('action',ch.action||'','_graphAction',btnEl);
}
function closeActionMenu(){const p=document.getElementById('actionPickerPopup');if(p)p.remove();}
function _closeActionOnOutside(e){const p=document.getElementById('actionPickerPopup');if(p&&!p.contains(e.target))closeActionMenu();}
function setChoiceActionFromMenu(fromId,ci,action){
    closeActionMenu();
    graphPushUndo();
    saveChoiceAction(fromId,ci,action);
}

function saveChoiceAction(fromId,ci,action){
    const d=getCurTree();
    const arr=(fromId==='__hub__')?(d.hubChoices||[]):(d.nodes[fromId]?.choices||[]);
    if(!arr[ci])return;
    const val=String(action||'').trim();
    if(val)arr[ci].action=val;
    else delete arr[ci].action;
    autoSave();
    renderBranches();
}

// ── Node-level binding menu (precondition, scriptText, action on NPC node) ──
function showNodeBindingMenu(nodeId,btnEl){
    closeActionMenu();
    const d=getCurTree();if(!d)return;
    const isSpecial=(nodeId==='__hub__'||nodeId==='__opener__');
    const node=isSpecial?null:d.nodes[nodeId];
    if(!isSpecial&&!node)return;
    const _pfx=nodeId==='__hub__'?'hub':nodeId==='__opener__'?'opener':null;
    const _src=isSpecial?{
        precondition:d[_pfx+'Precondition']||'',
        scriptText:d[_pfx+'ScriptText']||'',
        action:d[_pfx+'Action']||''
    }:node;
    // Build multi-slot handlers
    var slots={};
    ['precondition','scriptText','action'].forEach(function(field){
        var handlerName='_graphNodeBinding_'+field;
        _deBpHandlers[handlerName]=function(val){graphPushUndo();_setNodeBinding(nodeId,field,val);};
        slots[field]={val:_src[field]||'',handler:handlerName};
    });
    _deOpenBpMulti(slots,btnEl);
}
function _setNodeBinding(nodeId,field,val){
    closeActionMenu();
    graphPushUndo();
    const d=getCurTree();if(!d)return;
    const isSpecial=(nodeId==='__hub__'||nodeId==='__opener__');
    if(isSpecial){
        const pfx=nodeId==='__hub__'?'hub':'opener';
        // Capitalize field: precondition → Precondition
        const key=pfx+field.charAt(0).toUpperCase()+field.slice(1);
        d[key]=val;
    } else {
        if(!d.nodes[nodeId])return;
        d.nodes[nodeId][field]=val;
    }
    autoSave();renderBranches();
}
function _clearNodeBindings(nodeId){
    closeActionMenu();
    graphPushUndo();
    const d=getCurTree();if(!d)return;
    const isSpecial=(nodeId==='__hub__'||nodeId==='__opener__');
    if(isSpecial){
        const pfx=nodeId==='__hub__'?'hub':'opener';
        delete d[pfx+'Precondition'];
        delete d[pfx+'ScriptText'];
        delete d[pfx+'Action'];
    } else {
        if(!d.nodes[nodeId])return;
        delete d.nodes[nodeId].precondition;
        delete d.nodes[nodeId].scriptText;
        delete d.nodes[nodeId].action;
    }
    autoSave();renderBranches();
}

