// ═══════════════════════════════════════════
// DIALOG EDITOR — 3-column immersive overlay
// ═══════════════════════════════════════════
// Center: dialog texture with NPC text (upper) + player choices (lower)
// Left panel: node-level config (label, preconditions, specs)
// Right panel: choice-level config (actions, link targets)
// Side panels are collapsible.

let _deSelectedNodeId=null;   // which node is shown in the editor center
let _deSelectedChoiceIdx=-1;  // which choice is selected for right panel config
let _deOpen=false;
let _dePreviewMode=false;     // when true, show all dialogs in choices area
let _dePreviewDrilled=false;  // when true, we've drilled into a specific dialog from preview
let _deEditMode=false;        // when true, show editable fields + side panel configs
let _deEditingNpcLogIdx=-1;   // which NPC log line is being edited (-1 = none)
let _deNavHistory=[];         // navigation history stack for back button / breadcrumbs

// ── Variation bar for dialog editor ──
function _deVarBar(nodeId,vc,av,mode,treeField){
    var btns='';
    for(var i=0;i<vc;i++){
        btns+='<button class="de-var-btn'+(i===av?' active':'')+'" onclick="switchNodeVar(\''+nodeId.replace(/'/g,"\\'")+'\','+i+');_deRenderCenter()">'+(i+1)+'</button>';
    }
    var addFn=mode==='tree'?'addTreeFieldVariation(\''+treeField+'\',\''+nodeId.replace(/'/g,"\\'")+'\')':'addNodeVariation(\''+nodeId.replace(/'/g,"\\'")+'\')';
    btns+='<button class="de-var-btn de-var-add" onclick="'+addFn+';_deRenderCenter()">+</button>';
    if(av>0){
        var rmFn=mode==='tree'?'removeTreeFieldVariation(\''+treeField+'\',\''+nodeId.replace(/'/g,"\\'")+'\','+av+')':'removeNodeVariation(\''+nodeId.replace(/'/g,"\\'")+'\','+av+')';
        btns+='<button class="de-var-btn de-var-rm" onclick="'+rmFn+';_deRenderCenter()" title="Remove variation #'+(av+1)+'">\u2715</button>';
    }
    return '<div class="de-var-bar">Var: '+btns+'</div>';
}

// ── Open / Close ──
function openDialogEditor(){
    const overlay=document.getElementById('dialogEditorOverlay');
    if(!overlay)return;
    _deOpen=true;
    _dePreviewMode=true;
    _dePreviewDrilled=false;
    _deNavHistory=[];
    overlay.style.display='flex';
    _deCloneBgImg();
    _deResizeSync();
    window.addEventListener('resize',_deResizeSync);
    document.addEventListener('keydown',_deKeyHandler);
    _deDragInit();
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderToolbar();
}
function closeDialogEditor(){
    _deOpen=false;
    _deDragDestroy();
    const overlay=document.getElementById('dialogEditorOverlay');
    if(overlay)overlay.style.display='none';
    window.removeEventListener('resize',_deResizeSync);
    document.removeEventListener('keydown',_deKeyHandler);
}

// ── Keyboard handler: Escape to close + number keys for choice nav ──
function _deKeyHandler(e){
    if(e.key==='Escape'){closeDialogEditor();return;}
    // Number keys 1-9: select corresponding choice
    if(!_deOpen)return;
    // Don't intercept if user is typing in an input or textarea
    const tag=e.target.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    const num=parseInt(e.key);
    if(num>=1&&num<=9){
        e.preventDefault();
        _dePickChoiceByNumber(num);
    }
    // Ctrl+Z for undo
    if((e.ctrlKey||e.metaKey)&&e.key==='z'){
        e.preventDefault();
        deEditorUndo();
    }
}

// ── Number key navigation: pick choice by number ──
function _dePickChoiceByNumber(num){
    const choArea=document.getElementById('deChoicesArea');
    if(!choArea)return;
    // Find the sim-opt buttons or de-choice divs
    const opts=choArea.querySelectorAll('.sim-opt, .de-choice');
    const idx=num-1;
    if(idx<opts.length){
        opts[idx].click();
    }
}

// ── Set bg image on dialog editor center ──
function _deCloneBgImg(){
    const dest=document.querySelector('#deCenter .de-bg-img');
    if(!dest)return;
    if(dest.src&&dest.src.length>100)return; // already set
    // Try existing DOM img sources first
    const src=document.querySelector('.sim-bg-img')||document.querySelector('.ep-bg-img');
    if(src){dest.src=src.src;return;}
    // Extract data URL from .sim-wrap CSS background (texture embedded in stylesheet)
    for(const sheet of document.styleSheets){
        try{for(const rule of sheet.cssRules||[]){
            if(rule.selectorText==='.sim-wrap'&&rule.style.backgroundImage){
                const m=rule.style.backgroundImage.match(/url\(['"]?(data:[^'"]+)['"]?\)/);
                if(m){dest.src=m[1];return;}
            }
        }}catch(e){}
    }
}

// ── Resize sync — texture stays centered (same as preview), panels attach to edges ──
function _deResizeSync(){
    const center=document.getElementById('deCenter');
    if(!center)return;
    const vh=window.innerHeight,vw=window.innerWidth;
    // Frame content bounds in 1024×1024 texture (same as preview)
    var fL=6,fT=0,fR=627,fB=747,fW=621,fH=747;
    // Scale so frame fills viewport height — identical to preview
    var scale=vh/fH;
    // Use vh as width (same as dlg-modal-card) so frame borders stay off-screen
    var centerW=Math.min(vh,vw);
    center.style.width=centerW+'px';
    center.style.height=vh+'px';
    // Center the frame within the wider center element
    var frameW=Math.round(fW*scale);
    var frameOfs=Math.round((centerW-frameW)/2);
    // Scale bg image
    var imgPx=Math.round(1024*scale);
    var bgImg=center.querySelector('.de-bg-img');
    if(bgImg){
        bgImg.style.width=imgPx+'px';
        bgImg.style.height=imgPx+'px';
        bgImg.style.left=(frameOfs-Math.round(fL*scale))+'px';
        bgImg.style.top=(-Math.round(fT*scale))+'px';
    }
    // Position NPC area and choices area relative to frame position within center
    var npcArea=document.getElementById('deNpcArea');
    var choArea=document.getElementById('deChoicesArea');
    var contentL=frameOfs+Math.round((40-fL)*scale);
    var contentR=frameOfs+Math.round((580-fL)*scale);
    var contentWPx=contentR-contentL;
    if(npcArea){
        npcArea.style.left=contentL+'px';
        npcArea.style.top=((50-fT)/fH*100).toFixed(1)+'%';
        npcArea.style.width=contentWPx+'px';
        npcArea.style.height=((490-50)/fH*100).toFixed(1)+'%';
    }
    if(choArea){
        choArea.style.left=contentL+'px';
        choArea.style.top=((530-fT)/fH*100).toFixed(1)+'%';
        choArea.style.width=contentWPx+'px';
        choArea.style.height=((720-530)/fH*100).toFixed(1)+'%';
    }
    // Black underlayer: slightly smaller than the visible frame, centered behind it
    var underlayer=document.getElementById('deUnderlayer');
    if(underlayer){
        var inset=Math.round(30*scale);
        var ulW=frameW-inset*2;
        var ulH=Math.round(fH*scale)-inset*2;
        underlayer.style.left=Math.round((vw-ulW)/2)+'px';
        underlayer.style.top=(inset+Math.round(25*scale))+'px';
        underlayer.style.width=ulW+'px';
        underlayer.style.height=ulH+'px';
    }
    // Side panels attach at visible frame wall edges (not the outer transparent border)
    // Visible wall positions in texture coords (measured via drag calibration)
    var visL=28,visR=607;
    var centerLeft=Math.round((vw-centerW)/2);
    var panelLPx=centerLeft+frameOfs+Math.round((visL-fL)*scale);
    var panelRPx=centerLeft+frameOfs+Math.round((visR-fL)*scale);
    var leftPanel=document.getElementById('deLeftPanel');
    var rightPanel=document.getElementById('deRightPanel');
    // Panels: fixed 400px wide, positioned flush against frame edges
    var leftW=400;
    var rightW=400;
    if(leftPanel&&!leftPanel.classList.contains('collapsed')){
        leftPanel.style.width=leftW+'px';
        leftPanel.style.left=(panelLPx-leftW)+'px';
        leftPanel.style.right='';
    }
    if(rightPanel&&!rightPanel.classList.contains('collapsed')){
        rightPanel.style.width=rightW+'px';
        rightPanel.style.left=panelRPx+'px';
        rightPanel.style.right='';
    }

    // Toolbar: below the dialog texture
    var toolbar=document.getElementById('deToolbar');
    if(toolbar){
        toolbar.style.left=(panelLPx+20)+'px';
        toolbar.style.bottom='8px';
        toolbar.style.top='auto';
        toolbar.style.width=(panelRPx-panelLPx-40)+'px';
    }

    // Edge toggles: at top of texture, next to panel edges
    var edgeLeft=document.getElementById('deEdgeLeft');
    var edgeRight=document.getElementById('deEdgeRight');
    if(edgeLeft){
        edgeLeft.style.left=panelLPx+'px';
        edgeLeft.style.top='6px';
    }
    if(edgeRight){
        edgeRight.style.left=(panelRPx-32)+'px';
        edgeRight.style.top='6px';
    }
}

// ── Toolbar rendering: node tabs + breadcrumb + mode indicator + undo/back ──
function _deRenderToolbar(){
    _deRenderNodeTabs();
    _deRenderBreadcrumb();
    _deRenderModeIndicator();
    // Update back button state
    const backBtn=document.getElementById('deBackBtn');
    if(backBtn)backBtn.disabled=_deNavHistory.length===0;
    // Update undo button state
    const undoBtn=document.getElementById('deUndoBtn');
    if(undoBtn)undoBtn.disabled=(typeof graphUndoStack==='undefined'||!graphUndoStack.length);
}

// ── Node selector tabs (removed — no longer rendered) ──
function _deRenderNodeTabs(){}

// ── Breadcrumb trail ──
function _deRenderBreadcrumb(){
    const el=document.getElementById('deBreadcrumb');
    if(!el)return;
    if(_deNavHistory.length===0&&!_deSelectedNodeId){el.innerHTML='';return;}
    let html='';
    // Main entry
    html+=`<span class="de-breadcrumb-seg" onclick="deNavToMain()">Main</span>`;
    // History entries
    _deNavHistory.forEach((entry,i)=>{
        html+=`<span class="de-breadcrumb-sep">&rsaquo;</span>`;
        const label=entry.label||entry.nodeId||'?';
        html+=`<span class="de-breadcrumb-seg" onclick="deNavToHistoryIdx(${i})">${esc(label)}</span>`;
    });
    // Current node
    if(_deSelectedNodeId){
        html+=`<span class="de-breadcrumb-sep">&rsaquo;</span>`;
        const d=getCurTree();
        let curLabel=_deSelectedNodeId;
        if(_deSelectedNodeId==='__hub__')curLabel='Hub';
        else if(d&&d.nodes&&d.nodes[_deSelectedNodeId]&&d.nodes[_deSelectedNodeId].label)curLabel=d.nodes[_deSelectedNodeId].label;
        html+=`<span class="de-breadcrumb-cur">${esc(curLabel)}</span>`;
    }
    el.innerHTML=html;
}

// ── Mode indicator ──
function _deRenderModeIndicator(){
    const el=document.getElementById('deModeIndicator');
    if(!el)return;
    if(_deEditMode){
        el.textContent='EDIT';
        el.className='de-mode-indicator edit';
    } else {
        el.textContent='PREVIEW';
        el.className='de-mode-indicator preview';
    }
}

// ── Navigation: push current state to history before navigating ──
function _deNavPush(){
    const d=getCurTree();
    let label='Main';
    if(_deSelectedNodeId==='__hub__')label='Hub';
    else if(_deSelectedNodeId&&d&&d.nodes&&d.nodes[_deSelectedNodeId]){
        label=d.nodes[_deSelectedNodeId].label||_deSelectedNodeId;
    }
    _deNavHistory.push({
        nodeId:_deSelectedNodeId,
        label:label,
        previewMode:_dePreviewMode,
        previewDrilled:_dePreviewDrilled,
        editMode:_deEditMode,
        choiceIdx:_deSelectedChoiceIdx
    });
}

function deNavBack(){
    if(_deNavHistory.length===0)return;
    const prev=_deNavHistory.pop();
    _deSelectedNodeId=prev.nodeId;
    _dePreviewMode=prev.previewMode;
    _dePreviewDrilled=prev.previewDrilled;
    _deEditMode=prev.editMode;
    _deSelectedChoiceIdx=prev.choiceIdx;
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

function deNavToMain(){
    _deNavHistory=[];
    _deSelectedNodeId=null;
    _dePreviewMode=true;
    _dePreviewDrilled=false;
    _deEditMode=false;
    _deSelectedChoiceIdx=-1;
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

function deNavToHistoryIdx(idx){
    // Navigate to a specific breadcrumb position
    if(idx<0||idx>=_deNavHistory.length)return;
    const target=_deNavHistory[idx];
    _deNavHistory=_deNavHistory.slice(0,idx);
    _deSelectedNodeId=target.nodeId;
    _dePreviewMode=target.previewMode;
    _dePreviewDrilled=target.previewDrilled;
    _deEditMode=target.editMode;
    _deSelectedChoiceIdx=target.choiceIdx;
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Undo support ──
function deEditorUndo(){
    if(typeof graphUndo==='function'){
        graphUndo();
        _deRenderCenter();
        _deRenderLeftPanel();
        _deRenderRightPanel();
        _deRenderToolbar();
    }
}

// ── Select a node to display in center ──
function deSelectNode(nodeId){
    // Push current to nav history if changing nodes
    if(_deSelectedNodeId!==null&&_deSelectedNodeId!==nodeId){
        _deNavPush();
    }
    _deSelectedNodeId=nodeId;
    _deSelectedChoiceIdx=-1;
    _deRenderNodeTabs();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Edit a specific choice inline ──
function deEditChoice(nodeId,ci){
    _deSelectedNodeId=nodeId;
    _deSelectedChoiceIdx=ci;
    _deEditMode=true;
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}
function deStopEdit(){
    _deEditMode=false;
    _deSelectedChoiceIdx=-1;
    _deEditingNpcLogIdx=-1;
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Auto-size textarea to fit content ──
function _deAutoSizeTextarea(el){
    el.style.height='auto';
    el.style.height=el.scrollHeight+'px';
}

// ── Click-to-edit NPC text (feature #4) ──
function deClickNpcLine(logIdx){
    // Directly start editing on click — no hover→pencil dance needed
    _deEditingNpcLogIdx=logIdx;
    _deRenderCenter();
    // Focus the textarea and auto-size after render
    setTimeout(()=>{
        const inp=document.querySelector('.de-npc-inline-edit');
        if(inp){_deAutoSizeTextarea(inp);inp.focus();}
    },20);
}
function deEditNpcLine(logIdx){
    _deEditingNpcLogIdx=logIdx;
    _deRenderCenter();
}
function deUpdateNpcLogLine(logIdx,val){
    if(!dialogSimState||!dialogSimState.log[logIdx])return;
    dialogSimState.log[logIdx].text=val;
    // Also update the data model — use variation-aware setters
    const d=getCurTree();if(!d)return;
    if(dialogSimState.mode==='hub'||dialogSimState.mode==='main_menu'){
        setTreeFieldVarText('hub','__hub__',val);
    } else if(dialogSimState.mode==='node'&&dialogSimState.nodeId){
        flatSetNodeNpc(d,dialogSimState.nodeId,val);
        autoSave();
    }
}
function deStopNpcEdit(){
    _deEditingNpcLogIdx=-1;
    _deRenderCenter();
}
function _deNpcEditKeyHandler(e,logIdx){
    if(e.key==='Enter'){
        e.preventDefault();
        deStopNpcEdit();
    }
}

// ── Helper: render a sim-opt with an edit button ──
function _simOptWithEdit(lineNo,text,onclick,nodeId,ci){
    // If this choice is being edited, show input instead
    if(_deEditMode&&_deSelectedNodeId===nodeId&&_deSelectedChoiceIdx===ci){
        return `<div class="sim-opt de-editing">
            <span class="de-choice-num">${lineNo}.</span>
            <input type="text" class="de-inline-edit" value="${esc(text)}" oninput="deUpdateChoiceText(${ci},this.value)" autofocus>
            <button class="de-edit-btn active" onclick="event.stopPropagation();deStopEdit()" title="Done">&#10003;</button>
        </div>`;
    }
    return `<button class="sim-opt" onclick="${onclick}">${lineNo}. ${esc(text||'...')}<span class="de-edit-btn" onclick="event.stopPropagation();deEditChoice('${esc(nodeId)}',${ci})" title="Edit">&#9998;</span></button>`;
}

// ── Center: simulator with inline edit ──
function _deRenderCenter(){
    const npcArea=document.getElementById('deNpcArea');
    const choArea=document.getElementById('deChoicesArea');
    if(!npcArea||!choArea)return;
    if(!dialogSimState){npcArea.innerHTML='';choArea.innerHTML='';return;}

    // Variation bar — show current variation for active node
    var _varBarHtml='';
    if(dialogSimState.mode==='hub'||dialogSimState.mode==='main_menu'){
        var _vc=getTreeFieldVarCount(getCurTree(),'hub');
        var _av=_getNodeVar('__hub__');
        _varBarHtml=_deVarBar('__hub__',_vc,_av,'tree','hub');
    } else if(dialogSimState.mode==='node'&&dialogSimState.nodeId){
        var _nn=flatGetNode(getCurTree(),dialogSimState.nodeId);
        if(_nn){var _vc=getNodeVarCount(_nn);var _av=_getNodeVar(dialogSimState.nodeId);
        _varBarHtml=_deVarBar(dialogSimState.nodeId,_vc,_av,'node',null);}
    }

    // Log area — NPC lines are click-to-edit (feature #4)
    npcArea.innerHTML=_varBarHtml+dialogSimState.log.map((line,li)=>{
        if(line.speaker==='system')return `<div class="sim-ln system"><span class="txt">${esc(line.text)}</span></div>`;
        const sp=line.speaker==='actor'?getSimActorName():getSimNpcName();
        if(line.speaker==='npc'){
            // Editing this NPC line?
            if(_deEditingNpcLogIdx===li){
                return `<div class="sim-ln npc de-editing"><span class="spk">${esc(sp)}</span><textarea class="de-npc-inline-edit" oninput="deUpdateNpcLogLine(${li},this.value);_deAutoSizeTextarea(this)" onkeydown="_deNpcEditKeyHandler(event,${li})" autofocus>${esc(line.text)}</textarea><button class="de-edit-btn active" onclick="deStopNpcEdit()" title="Done">&#10003;</button></div>`;
            }
            // Click-to-edit: clicking the text directly starts editing
            return `<div class="sim-ln npc"><span class="spk">${esc(sp)}</span><span class="txt" onclick="deClickNpcLine(${li})">${esc(line.text)}</span></div>`;
        }
        return `<div class="sim-ln ${line.speaker==='actor'?'actor':'npc'}"><span class="spk">${esc(sp)}</span><span class="txt">${esc(line.text)}</span></div>`;
    }).join('');
    npcArea.scrollTop=npcArea.scrollHeight;

    // Preview mode — show openers list if not drilled into a dialog
    if(_dePreviewMode&&!_dePreviewDrilled){
        npcArea.innerHTML=`<div class="sim-ln npc"><span class="spk">${esc(getSimNpcName())}</span><span class="txt">What do you need?</span></div>`;
        _deRenderPreviewChoices();return;
    }

    // End of branch — warn and offer to go back + add choice
    if(dialogSimState.mode==='exit'){
        const backAction='_dePreviewDrilled=false;_dePreviewMode=true;resetDialogSimulator();_deRenderCenter();_deRenderLeftPanel();_deRenderToolbar()';
        let endHtml='<div style="color:#f87171;font-size:11px;padding:4px 8px;margin-bottom:6px">End of dialog &mdash; no further connection.</div>';
        endHtml+=`<button class="sim-opt" onclick="${backAction}">1. &larr; Back to start</button>`;
        // "Add Choice" on the node that led here
        const exitFrom=dialogSimState.exitFromNodeId;
        if(exitFrom){
            endHtml+=`<button class="de-add-choice" onclick="_deSelectedNodeId='${esc(exitFrom)}';deAddChoice()">+ Add Choice</button>`;
        }
        choArea.innerHTML=endHtml;return;
    }
    const d=getCurTree();
    let html='';let lineNo=1;
    // Determine current node context for "Add Choice" button
    let currentNodeId=null;
    if(dialogSimState.mode==='main_menu'||dialogSimState.mode==='hub'){
        currentNodeId='__hub__';
        const choices=d.hubChoices||[];
        choices.forEach((ch,ci)=>{
            html+=_simOptWithEdit(lineNo++,ch.text||'...',"simPickChoice('__hub__',"+ci+");_deRenderCenter();_deRenderToolbar()",'__hub__',ci);
        });
    } else if(dialogSimState.mode==='node'){
        const fromId=dialogSimState.nodeId;
        currentNodeId=fromId;
        const choices=(d.nodes[fromId]?.choices||[]);
        choices.forEach((ch,ci)=>{
            html+=_simOptWithEdit(lineNo++,ch.text||'...',"simPickChoice('"+esc(fromId)+"',"+ci+");_deRenderCenter();_deRenderToolbar()",fromId,ci);
        });
    }
    // "+ Add Choice" button at bottom of choices area (feature #2)
    if(currentNodeId){
        html+=`<button class="de-add-choice" onclick="_deSelectedNodeId='${esc(currentNodeId)}';deAddChoice()">+ Add Choice</button>`;
    }
    choArea.innerHTML=html;
}

// ── Binding Picker Popup ──
// Three-column modal: collapsible categories | binding list | guide/description panel.
let _deBpHideVanilla=false;
let _deBp={open:false,type:null,val:'',handler:null,items:[],cats:[],activeCat:null,anchor:null,search:'',focusedId:null,collapsedGroups:{},
    // Multi-slot mode (node bindings): all 3 slots in one picker
    multi:false,multiSlots:null,multiActiveSlot:null,
    // Show All toggle: include bindings that require missing prerequisites
    showAll:false};
const _deBpHandlers={};

// Build combined items for a picker type
function _deBpBuildItems(type){
    const archB=buildArchBindings();
    const items=[];
    if(type==='action'){
        const specs=typeof getActiveSpecializations==='function'?getActiveSpecializations():[];
        DIALOG_ACTIONS.forEach(a=>{
            if(!a.id)return;
            if(a.spec&&!specs.includes(a.spec)){
                if(_deBp.showAll)items.push({id:a.id,label:a.label,group:'Vanilla: '+((a.category||'other').charAt(0).toUpperCase()+(a.category||'other').slice(1)),note:a.note||'',_unavailableReason:'Requires '+a.spec+' specialization. Add it in the Settings tab.'});
                return;
            }
            const grp=a.category?'Vanilla: '+a.category.charAt(0).toUpperCase()+a.category.slice(1):'Vanilla';
            items.push({id:a.id,label:a.label,group:grp,note:a.note||''});
        });
        items.push(...archB.actions);
    }else if(type==='precondition'){
        items.push(...archB.preconditions);
    }else if(type==='scriptText'){
        items.push(...archB.scriptTexts);
    }
    // When showAll is on, add ghost entries for missing prerequisites
    if(_deBp.showAll){
        _deBpAddGhostBindings(type,items);
    }
    // Filter out vanilla bindings when checkbox is checked
    if(_deBpHideVanilla){
        return items.filter(function(i){return !(i.group||'').startsWith('Vanilla');});
    }
    return items;
}

// Add "ghost" bindings for features that aren't configured yet
function _deBpAddGhostBindings(type,items){
    var existing={};items.forEach(function(i){existing[i.id]=true;});
    var archId=getCurArchId();
    var specs=typeof getActiveSpecializations==='function'?getActiveSpecializations():[];
    var hasInformant=specs.indexOf('informant')>=0||specs.indexOf('intel')>=0;
    var d=getDlg();
    var hasPools=d&&((Array.isArray(d.taskPools)&&d.taskPools.length)||(Array.isArray(d.customPools)&&d.customPools.length));

    function ghost(id,label,group,reason){
        if(!existing[id])items.push({id:id,label:label,group:group,_unavailableReason:reason});
    }

    // Archetype identity
    if(!archId&&type==='precondition'){
        ghost('dialogs.arch_is_<archId>','NPC is <archetype>','Archetype','No archetype ID set. Enter one in the Archetypes tab.');
    }

    // Pool bindings (show generic examples when no pools exist)
    if(!hasPools){
        var grp='Task Flow (no pools yet)';
        var reason='No task pools defined. Add a pool in the Tasks tab first.';
        if(type==='precondition'){
            ghost('dialogs.arch_has_task_pool','NPC has work available',grp,reason);
            ghost('dialogs.arch_no_task_pool','NPC has no work right now',grp,reason);
            ghost('dialogs.arch_has_active_task','Player is working on a task',grp,reason);
            ghost('dialogs.arch_task_ready','Player has the required items',grp,reason);
        }
        if(type==='action'){
            ghost('dialogs.arch_task_accept','Player agrees to do the job',grp,reason);
            ghost('dialogs.arch_task_decline','Player says no thanks',grp,reason);
            ghost('dialogs.arch_task_try_complete','Turn in the task (check items)',grp,reason);
            ghost('dialogs.arch_task_deliver_rewards','Give player their reward',grp,reason);
            ghost('dialogs.arch_delivery_try_complete','Complete delivery at this NPC',grp,reason);
        }
        if(type==='scriptText'){
            ghost('dialogs.arch_text_task_offer_summary','Show what the task needs',grp,reason);
            ghost('dialogs.arch_text_task_offer_details','Show full task details',grp,reason);
            ghost('dialogs.arch_text_task_active_summary','Remind player what to do',grp,reason);
            ghost('dialogs.arch_text_task_result','Show success or failure',grp,reason);
            ghost('dialogs.arch_text_pool_open','NPC opens task conversation',grp,reason);
        }
    }

    // Informant
    if(!hasInformant){
        var iReason='Requires informant specialization. Add it in the Settings tab.';
        if(type==='precondition'){
            ghost('dialogs.arch_informant_find_stalker','NPC spots a stalker nearby','Intel',iReason);
            ghost('dialogs.arch_informant_find_mutant','NPC spots a mutant nearby','Intel',iReason);
        }
        if(type==='scriptText'){
            ghost('dialogs.arch_text_informant_result','Show what NPC found','Intel',iReason);
        }
    }
}

// Toggle Show All
function _deBpToggleVanilla(){
    _deBpHideVanilla=!!(document.getElementById('deBpHideVanilla')||{}).checked;
    _deBp.items=_deBpBuildItems(_deBp.type);
    _deBp.cats=_deBpGetCats(_deBp.items);
    if(_deBp.activeCat&&_deBp.activeCat.indexOf('Vanilla')===0)_deBp.activeCat=_deBp.cats.length?_deBp.cats[0].id:null;
    _deBpRender();
}
function _deBpToggleShowAll(){
    _deBp.showAll=!_deBp.showAll;
    // Rebuild items for current type
    _deBp.items=_deBpBuildItems(_deBp.type);
    _deBp.cats=_deBpGetCats(_deBp.items);
    if(!_deBp.activeCat&&_deBp.cats.length)_deBp.activeCat=_deBp.cats[0].id;
    // Update toggle button
    var btn=document.getElementById('deBpShowAllBtn');
    if(btn){btn.classList.toggle('active',_deBp.showAll);btn.textContent=_deBp.showAll?'Show All: ON':'Show All';}
    _deBpRender();
}

// Extract unique categories with counts, grouped by super-category
function _deBpGetCats(items){
    const seen=[];const cats=[];
    items.forEach(i=>{
        if(seen.indexOf(i.group)<0){
            seen.push(i.group);
            cats.push({id:i.group,label:i.group,count:items.filter(x=>x.group===i.group).length});
        }
    });
    return cats;
}

// Group categories into super-groups for collapsible display
const _BP_GROUP_TIPS={
    'Tasks & Jobs':'Bindings for the quest/task system — offering work, accepting, declining, turning in, and rewards.',
    'ARCH Conditions':'Check who this NPC is, whether the player has visited before, or if this is a first meeting.',
    'ARCH Utility':'General tools — take money, make NPC hostile, show custom text, end conversation.',
    'Vanilla: Player':'Check the player\'s faction, health, radiation, rank, or reputation. These are base-game conditions.',
    'Vanilla: NPC':'Check the NPC\'s faction or state (wounded, friendly, etc.).',
    'Vanilla: World & Items':'Check world state (emissions), player inventory (medkits, money), or transfer items.',
    'General':'Miscellaneous bindings that don\'t fit other categories.'
};
const _BP_CAT_TIPS={
    'Task Flow':'The core quest loop: offer a task, player accepts or declines, then turns it in for a reward.',
    'Archetype':'Check if this NPC has a specific archetype assigned.',
    'Who Is This NPC':'Check if the player has a delivery for this NPC, or other identity-based conditions.',
    'Player History':'Track how many times the player has visited this NPC — first time, returning, or regular.',
    'Utility':'Take money from the player, make the NPC hostile, show custom text, restore default greeting.',
    'Item Picker':'For category fetch tasks where the player chooses which item type to bring.',
    'Intel':'Informant NPC bindings — scan for nearby stalkers or mutants and report findings.',
    'Companion':'Recruit or dismiss this NPC as a companion. Check if they\'re already following.',
    'Vanilla: Player Faction':'Check which faction the player belongs to (Loner, Bandit, Duty, etc.).',
    'Vanilla: NPC Faction':'Check which faction this NPC belongs to.',
    'Vanilla: Player State':'Check the player\'s health, radiation, or injury status.',
    'Vanilla: Player Reputation':'Check the player\'s rank/reputation level (rookie, experienced, veteran, etc.).',
    'Vanilla: NPC State':'Check if NPC is wounded, friendly, or hostile.',
    'Vanilla: Items':'Check if the player has specific items like medkits, bandages, or money.',
    'Vanilla: World':'Check world conditions like active emissions.',
    'Vanilla: Dialog':'End the conversation or prevent future dialog.'
};
function _deBpSuperGroups(cats){
    const groups=[];const seen={};
    cats.forEach(cat=>{
        let superKey='General';
        if(cat.id.indexOf('Task Flow')===0||cat.id.indexOf('Task:')===0)superKey='Tasks & Jobs';
        else if(cat.id.indexOf('Personality')===0)superKey='Tasks & Jobs';
        else if(cat.id==='Job Menu'||cat.id==='Item Picker')superKey='Tasks & Jobs';
        else if(cat.id==='Who Is This NPC'||cat.id==='Player History'||cat.id==='Archetype')superKey='ARCH Conditions';
        else if(cat.id==='Intel')superKey='ARCH Conditions';
        else if(cat.id==='Companion')superKey='ARCH Conditions';
        else if(cat.id==='Utility')superKey='ARCH Utility';
        else if(cat.id.indexOf('Vanilla: Player')===0)superKey='Vanilla: Player';
        else if(cat.id.indexOf('Vanilla: NPC')===0)superKey='Vanilla: NPC';
        else if(cat.id.indexOf('Vanilla:')===0)superKey='Vanilla: World & Items';
        if(!seen[superKey]){seen[superKey]=true;groups.push({key:superKey,cats:[]});}
        groups.find(g=>g.key===superKey).cats.push(cat);
    });
    return groups;
}

// Find display label for a value
function _deBpLabel(type,val){
    if(!val)return '';
    const items=_deBpBuildItems(type);
    const found=items.find(i=>i.id===val);
    if(found)return found.label;
    return val.replace('dialogs.','');
}

// Check if a binding ID is valid for a given context type
function _deBpIsValidIn(id,contextType){
    const guide=getBindingGuide(id);
    if(!guide)return true; // unknown bindings are allowed anywhere
    if(guide.validIn.indexOf(contextType)>=0)return true;
    // scriptText items are valid when shown inside the precondition tab
    if(contextType==='precondition'&&guide.validIn.indexOf('scriptText')>=0)return true;
    return false;
}

// Render a picker button (unchanged API)
function _deBindingBtn(type,currentVal,handlerName){
    const label=currentVal?_deBpLabel(type,currentVal):'';
    const valJson=JSON.stringify(currentVal||'').replace(/'/g,'&#39;');
    return '<button class="de-bp-btn" onclick="_deOpenBp(\''+type+'\','+valJson+',\''+handlerName+'\',this)">'+
        '<span class="de-bp-label">'+(label?esc(label):'<span class="de-bp-none">None</span>')+'</span>'+
        '<span class="de-bp-arrow">&#9660;</span></button>';
}

// Ensure popup DOM exists
function _deBpEnsureEl(){
    let el=document.getElementById('deBindingPopup');
    if(el)return el;
    const ov=document.createElement('div');
    ov.id='deBindingOverlay';ov.className='de-bp-overlay';ov.onclick=_deCloseBp;
    document.body.appendChild(ov);
    el=document.createElement('div');
    el.id='deBindingPopup';el.className='de-bp-popup';
    el.innerHTML=
        '<div class="de-bp-header">'+
            '<span class="de-bp-header-title">Binding Picker</span>'+
            '<span class="de-bp-header-context" id="deBpContext"></span>'+
            '<div class="de-bp-slot-tabs" id="deBpSlotTabs"></div>'+
            '<label class="de-bp-toggle-vanilla" title="Hide base-game bindings to reduce clutter"><input type="checkbox" id="deBpHideVanilla" onchange="_deBpToggleVanilla()" style="accent-color:#ff8c00;margin-right:4px">Hide Vanilla</label>'+
            '<button class="de-bp-show-all" id="deBpShowAllBtn" onclick="_deBpToggleShowAll()" title="Show bindings that require features not yet configured">Show All</button>'+
            '<input class="de-bp-search" placeholder="Search... (e.g. accept, first visit, reward, delivery)" oninput="_deBpFilter(this.value)">'+
        '</div>'+
        '<div class="de-bp-patterns" id="deBpPatterns" style="display:none"></div>'+
        '<div class="de-bp-content">'+
            '<div class="de-bp-cats" id="deBpCats"></div>'+
            '<div class="de-bp-items" id="deBpItems"></div>'+
            '<div class="de-bp-guide" id="deBpGuide"><div class="de-bp-guide-empty">Select a binding to see its description and usage guide.</div></div>'+
        '</div>';
    document.body.appendChild(el);
    return el;
}

// Type label map
const _deBpTypeLabels={action:'What happens',precondition:'When to show',scriptText:'NPC says'};
const _deBpTypeShort={action:'Action',precondition:'Condition',scriptText:'NPC Text'};
const _deBpTypeTips={action:'What should happen when the player picks this line? (open trade, accept task, end dialog, etc.)',precondition:'When should this dialog line be visible? (only on first visit, only when task is ready, etc.)',scriptText:'What should the NPC say here? Text is generated automatically at runtime (task details, reward info, etc.)'};

// Open popup (centered modal) — single-slot mode
function _deOpenBp(type,currentVal,handlerName,btnEl){
    _deBp.multi=false;_deBp.multiSlots=null;_deBp.multiActiveSlot=null;
    const el=_deBpEnsureEl();
    const ov=document.getElementById('deBindingOverlay');
    _deBp.type=type;_deBp.val=currentVal||'';_deBp.handler=handlerName;
    _deBp.items=_deBpBuildItems(type);_deBp.cats=_deBpGetCats(_deBp.items);
    _deBp.search='';_deBp.anchor=btnEl;_deBp.focusedId=currentVal||null;
    _deBp.activeCat=null;
    if(currentVal){const cur=_deBp.items.find(i=>i.id===currentVal);if(cur)_deBp.activeCat=cur.group;}
    if(!_deBp.activeCat&&_deBp.cats.length)_deBp.activeCat=_deBp.cats[0].id;
    // Show context type + hide slot tabs
    var ctxEl=document.getElementById('deBpContext');
    if(ctxEl)ctxEl.textContent=_deBpTypeLabels[type]||type;
    var slotTabsEl=document.getElementById('deBpSlotTabs');
    if(slotTabsEl)slotTabsEl.innerHTML='';
    el.style.display='flex';ov.style.display='block';_deBp.open=true;
    const si=el.querySelector('.de-bp-search');
    if(si){si.value='';si.focus();}
    document.addEventListener('keydown',_deBpKeyHandler,true);
    _deBpRender();
    _deBpRenderGuide(_deBp.focusedId);
}

// Open popup in multi-slot mode (node bindings: all 3 types in one picker)
// slots: { precondition:{val,handler}, scriptText:{val,handler}, action:{val,handler} }
function _deOpenBpMulti(slots,btnEl){
    _deBp.multi=true;_deBp.multiSlots=slots;
    // Start on first slot that has a value, or precondition
    var startSlot='precondition';
    if(slots.action&&slots.action.val)startSlot='action';
    if(slots.scriptText&&slots.scriptText.val)startSlot='scriptText';
    if(slots.precondition&&slots.precondition.val)startSlot='precondition';
    _deBpSwitchSlot(startSlot,btnEl,true);
}

// Switch active slot in multi mode
function _deBpSwitchSlot(slotType,btnEl,isInit){
    _deBp.multiActiveSlot=slotType;
    var slot=_deBp.multiSlots[slotType]||{val:'',handler:null};
    var el=_deBpEnsureEl();
    var ov=document.getElementById('deBindingOverlay');
    _deBp.type=slotType;_deBp.val=slot.val||'';_deBp.handler=slot.handler;
    // Precondition tab also shows scriptText bindings
    var items=_deBpBuildItems(slotType);
    if(slotType==='precondition'){
        var stItems=_deBpBuildItems('scriptText');
        stItems.forEach(function(i){i._isScriptText=true;});
        items=items.concat(stItems);
    }
    _deBp.items=items;_deBp.cats=_deBpGetCats(_deBp.items);
    if(isInit)_deBp.search='';
    _deBp.anchor=btnEl;_deBp.focusedId=slot.val||null;
    _deBp.activeCat=null;
    if(slot.val){var cur=_deBp.items.find(function(i){return i.id===slot.val;});if(cur)_deBp.activeCat=cur.group;}
    if(!_deBp.activeCat&&_deBp.cats.length)_deBp.activeCat=_deBp.cats[0].id;
    // Hide single-mode context label
    var ctxEl=document.getElementById('deBpContext');
    if(ctxEl)ctxEl.textContent='';
    // Render slot tabs + patterns bar
    _deBpRenderSlotTabs();
    _deBpRenderPatterns();
    if(isInit){
        el.style.display='flex';ov.style.display='block';_deBp.open=true;
        var si=el.querySelector('.de-bp-search');
        if(si){si.value='';si.focus();}
        document.addEventListener('keydown',_deBpKeyHandler,true);
    }
    _deBpRender();
    _deBpRenderGuide(_deBp.focusedId);
}

// Render the slot tabs in multi mode
function _deBpRenderSlotTabs(){
    var tabsEl=document.getElementById('deBpSlotTabs');
    if(!tabsEl||!_deBp.multi)return;
    var h='';
    // 2 visible tabs: precondition (includes scriptText) and action
    ['precondition','action'].forEach(function(t){
        // Show scriptText value badge inside the precondition tab
        var slot=_deBp.multiSlots[t]||{val:''};
        var active=(_deBp.multiActiveSlot===t)||(t==='precondition'&&_deBp.multiActiveSlot==='scriptText');
        var label=_deBpTypeLabels[t]||t;
        var hasVal=!!slot.val;
        var valLabel=hasVal?_deBpLabel(t,slot.val):'';
        var tip=_deBpTypeTips[t]||'';
        // For precondition tab, also check scriptText slot
        var stSlot=t==='precondition'?(_deBp.multiSlots['scriptText']||{val:''}):null;
        var stHasVal=stSlot&&!!stSlot.val;
        var stLabel=stHasVal?_deBpLabel('scriptText',stSlot.val):'';
        h+='<button class="de-bp-slot-tab'+(active?' active':'')+'" onclick="_deBpSwitchSlot(\''+t+'\',null,false)"'+(tip?' title="'+esc(tip)+'"':'')+'>';
        h+='<span class="de-bp-slot-tab-label">'+esc(label)+'</span>';
        if(hasVal){
            h+='<span class="de-bp-slot-tab-val" title="'+esc(valLabel)+'">'+esc(valLabel)+'</span>';
            h+='<span class="de-bp-slot-clear" onclick="event.stopPropagation();_deBpClearSlot(\''+t+'\')" title="Clear">&times;</span>';
        } else if(!stHasVal){
            h+='<span class="de-bp-slot-tab-none">None</span>';
        }
        if(stHasVal){
            h+='<span class="de-bp-slot-tab-val" style="color:#64b5f6" title="NPC says: '+esc(stLabel)+'">'+esc(stLabel)+'</span>';
            h+='<span class="de-bp-slot-clear" onclick="event.stopPropagation();_deBpClearSlot(\'scriptText\')" title="Clear NPC text">&times;</span>';
        }
        h+='</button>';
    });
    tabsEl.innerHTML=h;
}

// Clear a slot binding in multi mode
function _deBpClearSlot(slotType){
    if(!_deBp.multi||!_deBp.multiSlots||!_deBp.multiSlots[slotType])return;
    var slot=_deBp.multiSlots[slotType];
    slot.val='';
    var fn=_deBpHandlers[slot.handler];
    if(fn)fn('');
    if(_deBp.multiActiveSlot===slotType)_deBp.val='';
    _deBpRenderSlotTabs();
    _deBpRender();
    _deBpRenderGuide(null);
}

// Close popup
function _deCloseBp(){
    _deBp.open=false;
    const el=document.getElementById('deBindingPopup');
    const ov=document.getElementById('deBindingOverlay');
    if(el)el.style.display='none';if(ov)ov.style.display='none';
    document.removeEventListener('keydown',_deBpKeyHandler,true);
}

// Keyboard handler: Escape closes, arrows navigate, Enter selects
function _deBpKeyHandler(e){
    if(!_deBp.open)return;
    if(e.key==='Escape'){e.stopPropagation();e.preventDefault();_deCloseBp();return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.stopPropagation();e.preventDefault();
        var itemsEl=document.getElementById('deBpItems');
        if(!itemsEl)return;
        var btns=Array.from(itemsEl.querySelectorAll('.de-bp-item'));
        if(!btns.length)return;
        var curIdx=btns.findIndex(function(b){return b.dataset.bid===_deBp.focusedId;});
        var nextIdx=e.key==='ArrowDown'?curIdx+1:curIdx-1;
        if(nextIdx<0)nextIdx=btns.length-1;
        if(nextIdx>=btns.length)nextIdx=0;
        var bid=btns[nextIdx].dataset.bid||'';
        _deBpFocus(bid);
        btns[nextIdx].scrollIntoView({block:'nearest'});
        return;
    }
    if(e.key==='Enter'&&_deBp.focusedId!=null){
        e.stopPropagation();e.preventDefault();
        if(_deBpIsValidIn(_deBp.focusedId,_deBp.type)||!_deBp.focusedId)_deBpSelect(_deBp.focusedId);
        return;
    }
}

// Search filter — matches name, id, group, AND description
function _deBpFilter(query){
    _deBp.search=query.toLowerCase().trim();
    if(_deBp.search)_deBp.activeCat=null;
    else if(!_deBp.activeCat&&_deBp.cats.length)_deBp.activeCat=_deBp.cats[0].id;
    _deBpRender();
}

// Select category
function _deBpSelectCat(catId){
    _deBp.activeCat=catId;_deBp.search='';
    const el=document.getElementById('deBindingPopup');
    if(el){const s=el.querySelector('.de-bp-search');if(s)s.value='';}
    _deBpRender();
}

// Toggle super-group collapse
function _deBpToggleGroup(key){
    _deBp.collapsedGroups[key]=!_deBp.collapsedGroups[key];
    _deBpRender();
}

// Focus a binding (show in guide, highlight in list)
function _deBpFocus(id){
    _deBp.focusedId=id;
    // Update item highlight
    var itemsEl=document.getElementById('deBpItems');
    if(itemsEl){
        itemsEl.querySelectorAll('.de-bp-item').forEach(function(el){
            el.classList.toggle('focused',el.dataset.bid===id&&!el.classList.contains('selected'));
        });
    }
    _deBpRenderGuide(id);
}

// Select a binding (confirm choice)
function _deBpSelect(id){
    if(_deBp.multi){
        // If selecting a scriptText binding from the precondition tab, route to scriptText slot
        var targetSlot=_deBp.multiActiveSlot;
        if(id&&targetSlot==='precondition'){
            var selItem=_deBp.items.find(function(i){return i.id===id;});
            if(selItem&&selItem._isScriptText)targetSlot='scriptText';
        }
        var fn=_deBpHandlers[(_deBp.multiSlots[targetSlot]||{}).handler];
        if(fn)fn(id);
        // Update slot value in state
        var slot=_deBp.multiSlots[targetSlot];
        if(slot)slot.val=id;
        _deBp.val=id;
        _deBpRenderSlotTabs();
        _deBpRender();
        _deBpRenderGuide(id||null);
        return;
    }
    // Single-slot mode: apply and close
    if(_deBp.anchor){
        const span=_deBp.anchor.querySelector('.de-bp-label');
        if(span){
            if(id){const item=_deBp.items.find(i=>i.id===id);span.textContent=item?item.label:id;span.className='de-bp-label';}
            else{span.innerHTML='<span class="de-bp-none">None</span>';}
        }
    }
    var fn2=_deBpHandlers[_deBp.handler];
    _deCloseBp();
    if(fn2)fn2(id);
}

// Render guide panel for a binding
// ── Common Patterns — one-click multi-binding presets (multi-slot mode only) ──
var _deBpPatterns=[
    {name:'Hand in quest items',desc:'Player gives items to NPC, NPC checks and pays reward',
     slots:{action:'arch_task_try_complete',scriptText:'arch_text_task_result'},
     extra:{action2:'arch_task_deliver_rewards'}},
    {name:'Receive delivery',desc:'NPC receives a package and pays reward',
     slots:{precondition:'arch_is_delivery_target',action:'arch_delivery_try_complete',scriptText:'arch_delivery_result_text'},
     extra:{action2:'arch_delivery_deliver_rewards'}},
    {name:'First meeting only',desc:'This line only appears the first time the player meets this NPC',
     slots:{precondition:'arch_is_first_visit'}},
    {name:'Offer a job',desc:'NPC describes available work when they have tasks',
     slots:{precondition:'arch_has_task_pool',scriptText:'arch_text_task_offer_summary'}},
    {name:'Pick up items',desc:'Player picks up collected items from this NPC',
     slots:{precondition:'arch_is_delivery_target',action:'arch_collect_pickup'},
     extra:{}}
];

function _deBpRenderPatterns(){
    var el=document.getElementById('deBpPatterns');
    if(!el)return;
    if(!_deBp.multi){el.style.display='none';return;}
    el.style.display='flex';
    var h='<span style="color:#888;font-size:10px;margin-right:8px;white-space:nowrap" title="One-click presets that fill all 3 slots at once for common dialog setups">Quick setup:</span>';
    _deBpPatterns.forEach(function(p,pi){
        h+='<button class="btn b2 bs" style="padding:3px 10px;font-size:11px;white-space:nowrap" onclick="_deBpApplyPattern('+pi+')" title="'+esc(p.desc)+'">'+esc(p.name)+'</button>';
    });
    el.innerHTML=h;
}

function _deBpApplyPattern(pi){
    var p=_deBpPatterns[pi];
    if(!p||!_deBp.multi||!_deBp.multiSlots)return;
    // Auto-detect pool suffix from context
    var poolSuf='';
    if(typeof curTaskPoolTag!=='undefined'&&curTaskPoolTag&&curTaskPoolTag!=='default'){
        poolSuf='_'+curTaskPoolTag;
    }
    // Apply each slot
    ['precondition','action','scriptText'].forEach(function(slot){
        if(!p.slots[slot])return;
        var suffix=p.slots[slot];
        var items=_deBpBuildItems(slot);
        // Try pool-suffixed version first, then generic
        var match=poolSuf?items.find(function(i){return i.id.indexOf(suffix+poolSuf)>=0;}):null;
        if(!match)match=items.find(function(i){return i.id.indexOf(suffix)>=0;});
        if(match&&_deBp.multiSlots[slot]){
            _deBp.multiSlots[slot].val=match.id;
            if(_deBp.multiSlots[slot].handler&&typeof window[_deBp.multiSlots[slot].handler]==='function'){
                window[_deBp.multiSlots[slot].handler](match.id);
            }
        }
    });
    // Handle extra bindings (e.g. action2 = deliver_rewards appended to action via semicolon)
    if(p.extra&&p.extra.action2&&_deBp.multiSlots.action){
        var curAction=_deBp.multiSlots.action.val||'';
        var items2=_deBpBuildItems('action');
        var match2=poolSuf?items2.find(function(i){return i.id.indexOf(p.extra.action2+poolSuf)>=0;}):null;
        if(!match2)match2=items2.find(function(i){return i.id.indexOf(p.extra.action2)>=0;});
        if(match2&&curAction&&curAction.indexOf(match2.id)<0){
            var combined=curAction+';'+match2.id;
            _deBp.multiSlots.action.val=combined;
            if(_deBp.multiSlots.action.handler&&typeof window[_deBp.multiSlots.action.handler]==='function'){
                window[_deBp.multiSlots.action.handler](combined);
            }
        }
    }
    // Refresh UI
    _deBpSwitchSlot(_deBp.multiActiveSlot||'precondition',null,false);
    setStatus('Applied pattern: '+p.name,'ok');
}

// Smart suggestions — recommend bindings based on what's already on the node
function _deBpGetSuggestions(allItems){
    var suggestions=[];
    var seen={};
    function suggest(id,reason){
        if(seen[id])return;seen[id]=true;
        var item=allItems.find(function(i){return i.id===id;});
        if(item)suggestions.push({id:id,label:item.label,_reason:reason});
    }
    // Gather current node bindings
    var nodeVals=[];
    if(_deBp.multi&&_deBp.multiSlots){
        ['precondition','action','scriptText'].forEach(function(slot){
            var v=(_deBp.multiSlots[slot]||{}).val||'';
            if(v)nodeVals.push(v);
        });
    } else if(_deBp.val){
        nodeVals.push(_deBp.val);
    }
    var allV=nodeVals.join(' ');
    var has=function(s){return allV.indexOf(s)>=0;};
    var type=_deBp.type;
    var curVal=_deBp.multi?(_deBp.multiSlots[type]||{}).val||'':_deBp.val||'';

    // If node has try_complete → suggest deliver_rewards + task_result
    if(has('try_complete')){
        if(type==='action')suggest('dialogs.arch_task_deliver_rewards','pairs with turn-in');
        if(type==='scriptText')suggest('dialogs.arch_text_task_result','shows outcome');
    }
    // If node has deliver_rewards → suggest try_complete + task_result
    if(has('deliver_rewards')&&!has('try_complete')){
        if(type==='action')suggest('dialogs.arch_task_try_complete','pairs with rewards');
    }
    // If node has delivery_try_complete → suggest delivery result
    if(has('delivery_try_complete')){
        if(type==='action')suggest('dialogs.arch_delivery_deliver_rewards','pairs with delivery');
        if(type==='scriptText')suggest('dialogs.arch_delivery_result_text','shows outcome');
    }
    // If node has accept → no specific companion needed, but suggest offer_summary on adjacent
    if(has('task_accept')&&type==='scriptText'){
        suggest('dialogs.arch_text_task_offer_summary','describe what the task needs');
    }
    // If node has has_task_pool precondition → suggest offer summary text
    if(has('has_task_pool')){
        if(type==='scriptText')suggest('dialogs.arch_text_task_offer_summary','show what the job needs');
        if(type==='scriptText')suggest('dialogs.arch_text_pool_open','NPC intro text');
    }
    // If node has has_active_task → suggest task_ready as precondition
    if(has('has_active_task')&&type==='precondition'){
        suggest('dialogs.arch_task_ready','check if player can turn in');
    }
    // Empty node — suggest common starting points by slot type
    if(!nodeVals.length){
        if(type==='precondition'){
            suggest('dialogs.arch_is_first_visit','common: first meeting');
            suggest('dialogs.arch_has_task_pool','common: offer work');
            suggest('dialogs.arch_has_active_task','common: check progress');
        }
        if(type==='action'){
            suggest('dialogs.arch_task_accept','common: player takes job');
        }
    }
    return suggestions.slice(0,4);
}

// Check for missing companion bindings on the current node
function _deBpCheckPairings(selectedId){
    var warnings=[];
    if(!_deBp.multi||!_deBp.multiSlots)return warnings;
    // Gather all current+proposed bindings on this node
    var nodeBindings={};
    ['precondition','action','scriptText'].forEach(function(slot){
        var v=(_deBp.multiSlots[slot]||{}).val||'';
        if(v)nodeBindings[slot]=v;
    });
    // If the user is about to assign selectedId, simulate it
    if(selectedId)nodeBindings[_deBp.type]=selectedId;
    var allVals=Object.values(nodeBindings).join(' ');
    var has=function(s){return allVals.indexOf(s)>=0;};

    // try_complete needs deliver_rewards
    if(has('try_complete')&&!has('deliver_rewards')){
        warnings.push('This binding usually needs <b>"Give player their reward"</b> on the same node. Without it, the player won\'t get paid.');
    }
    // deliver_rewards needs try_complete
    if(has('deliver_rewards')&&!has('try_complete')&&!has('delivery_try_complete')){
        warnings.push('This gives rewards, but nothing checks if the task is actually done. Add <b>"Turn in the task"</b> on the same node.');
    }
    // try_complete + deliver_rewards should have task_result text
    if(has('try_complete')&&has('deliver_rewards')&&!has('task_result')&&!has('delivery_result')){
        warnings.push('Consider adding <b>"Show success or failure"</b> as auto-text so the NPC tells the player what happened.');
    }
    // delivery_try_complete should have arch_is_delivery_target somewhere
    if(has('delivery_try_complete')&&!has('is_delivery_target')){
        warnings.push('Delivery completion usually needs <b>"Player has a delivery for this NPC"</b> as a condition on the dialog to make sure the player is talking to the right NPC.');
    }
    // accept without offer summary nearby (not on same node, but worth noting)
    if(has('arch_task_accept')&&!has('offer_summary')&&!has('offer_details')&&!has('personality_npc_prompt')){
        warnings.push('The player is accepting a task — make sure an earlier node shows <b>what the task needs</b> (offer summary or details) so they know what they\'re agreeing to.');
    }
    return warnings;
}

function _deBpRenderGuide(id){
    const guideEl=document.getElementById('deBpGuide');
    if(!guideEl)return;
    if(!id){
        var hint=_deBp.multi
            ?'Click any binding to see what it does.<br><br><span style="color:#888;font-size:11px">Double-click or Enter to assign. Tabs above switch between condition/action/text slots.<br>Arrow keys to navigate. Esc to close.</span>'
            :'Click any binding to see what it does.<br><br><span style="color:#888;font-size:11px">Double-click or Enter to select. Arrow keys to navigate.</span>';
        guideEl.innerHTML='<div class="de-bp-guide-empty">'+hint+'</div>';
        return;
    }
    const item=_deBp.items.find(i=>i.id===id);
    const guide=getBindingGuide(id);
    const label=item?item.label:id.replace('dialogs.','');
    const isCurrent=id===_deBp.val;
    let h='';
    if(isCurrent)h+='<div style="color:#ff8c00;font-size:11px;margin-bottom:6px;font-weight:bold">&#10003; Currently assigned</div>';
    h+='<div class="de-bp-guide-title">'+esc(label)+'</div>';
    h+='<div class="de-bp-guide-id">'+esc(id)+'</div>';
    // Valid-in tags
    h+='<div class="de-bp-guide-tags">';
    ['precondition','action','scriptText'].forEach(function(t){
        var tLabel=(_deBpTypeShort||_deBpTypeLabels)[t]||t;
        var valid=guide?guide.validIn.indexOf(t)>=0:true;
        var isCurrent=t===_deBp.type;
        h+='<span class="de-bp-guide-tag '+(valid?'valid':'invalid')+'" style="'+(isCurrent?'outline:1px solid #ff8c00;':'')+'">'+esc(tLabel)+(valid?' ✓':' ✗')+'</span>';
    });
    h+='</div>';
    // Unavailable warning (ghost binding)
    var ghostReason=item&&item._unavailableReason;
    if(ghostReason){
        h+='<div class="de-bp-guide-section"><div style="color:#e05050;font-size:13px;line-height:1.5;background:rgba(224,80,80,.08);padding:10px 12px;border-radius:3px;border-left:3px solid #e05050">'+
            '<strong>Not available</strong><br>'+esc(ghostReason)+'</div></div>';
    }
    if(guide){
        h+='<div class="de-bp-guide-section"><div class="de-bp-guide-section-label">What it does</div><div class="de-bp-guide-desc">'+esc(guide.desc)+'</div></div>';
        h+='<div class="de-bp-guide-section"><div class="de-bp-guide-section-label">How to use it</div><div class="de-bp-guide-usage">'+esc(guide.usage)+'</div></div>';
    }else{
        h+='<div class="de-bp-guide-section"><div class="de-bp-guide-desc" style="color:#888">No guide entry for this binding. It may be a dynamic or custom binding.</div></div>';
        if(item&&item.note){
            h+='<div class="de-bp-guide-section"><div class="de-bp-guide-section-label">Note</div><div class="de-bp-guide-desc">'+esc(item.note)+'</div></div>';
        }
    }
    // Pairing warnings — check if common companion bindings are missing
    var _pairWarnings=_deBpCheckPairings(id);
    if(_pairWarnings.length){
        h+='<div class="de-bp-guide-section">';
        _pairWarnings.forEach(function(w){
            h+='<div style="color:#e8c060;font-size:12px;line-height:1.4;background:rgba(232,192,96,.08);padding:8px 10px;border-radius:3px;border-left:3px solid #e8c060;margin-bottom:6px">'+w+'</div>';
        });
        h+='</div>';
    }

    // Select button + clear button
    var valid=_deBpIsValidIn(id,_deBp.type)&&!ghostReason;
    var idEsc=JSON.stringify(id).replace(/'/g,'&#39;');
    var slotLabel=_deBpTypeLabels[_deBp.type]||_deBp.type;
    var btnText=_deBp.multi
        ?(valid?'Assign as '+slotLabel:'Assign Anyway (not recommended)')
        :(valid?'Select This Binding':'Select Anyway (not recommended)');
    h+='<div style="display:flex;gap:8px;margin-top:16px;align-items:center">';
    h+='<button class="de-bp-guide-select" onclick="_deBpSelect('+idEsc+')"'+(valid?'':' title="This binding is not designed for '+esc(slotLabel)+' slots"')+'>'+esc(btnText)+'</button>';
    if(_deBp.val)h+='<button class="de-bp-guide-select" style="background:#333;color:#ccc" onclick="_deBpSelect(\'\')">Clear</button>';
    h+='</div>';
    var footerHint=_deBp.multi
        ?'double-click to assign &middot; switch slots with tabs above &middot; Esc to close'
        :'or double-click in the list &middot; Enter to select &middot; Esc to cancel';
    h+='<div style="color:#555;font-size:11px;margin-top:8px">'+footerHint+'</div>';
    guideEl.innerHTML=h;
}

// Render popup contents
function _deBpRender(){
    const catsEl=document.getElementById('deBpCats');
    const itemsEl=document.getElementById('deBpItems');
    if(!catsEl||!itemsEl)return;
    const q=_deBp.search;
    let filtered=_deBp.items;
    if(q){
        filtered=_deBp.items.filter(function(i){
            if(i.label.toLowerCase().indexOf(q)>=0)return true;
            if(i.id.toLowerCase().indexOf(q)>=0)return true;
            if((i.group||'').toLowerCase().indexOf(q)>=0)return true;
            if((i.keywords||'').toLowerCase().indexOf(q)>=0)return true;
            var guide=getBindingGuide(i.id);
            if(guide){
                if(guide.desc.toLowerCase().indexOf(q)>=0)return true;
                if((guide.keywords||'').toLowerCase().indexOf(q)>=0)return true;
            }
            return false;
        });
    }
    // Category counts
    const cc={};filtered.forEach(i=>{cc[i.group]=(cc[i.group]||0)+1;});
    // Render categories (collapsible super-groups)
    const superGroups=_deBpSuperGroups(_deBp.cats);
    let ch='';
    if(q){
        ch+='<button class="de-bp-cat active" onclick="_deBpSelectCat(null)">All Results <span class="de-bp-cat-count">'+filtered.length+'</span></button>';
    }
    superGroups.forEach(function(sg){
        var groupHasResults=sg.cats.some(function(c){return(cc[c.id]||0)>0;});
        if(q&&!groupHasResults)return;
        var collapsed=!!_deBp.collapsedGroups[sg.key];
        ch+='<div class="de-bp-cat-group">';
        var _sgTip=_BP_GROUP_TIPS[sg.key]||'';
        ch+='<button class="de-bp-cat-header" onclick="_deBpToggleGroup(\''+sg.key.replace(/'/g,"\\'")+'\')"'+(_sgTip?' title="'+esc(_sgTip)+'"':'')+'>';
        ch+='<span class="de-bp-cat-arrow'+(collapsed?' collapsed':'')+'">&#9660;</span>'+esc(sg.key)+'</button>';
        if(!collapsed){
            sg.cats.forEach(function(cat){
                var cnt=cc[cat.id]||0;
                if(q&&!cnt)return;
                var active=!q&&_deBp.activeCat===cat.id;
                var dimmed=q&&!cnt;
                var _catTip=_BP_CAT_TIPS[cat.id]||'';
                ch+='<button class="de-bp-cat'+(active?' active':'')+(dimmed?' dimmed':'')+'" onclick="_deBpSelectCat(\''+cat.id.replace(/'/g,"\\'")+'\')" title="'+esc(_catTip||cat.label)+'">'+
                    esc(cat.label)+' <span class="de-bp-cat-count">'+cnt+'</span></button>';
            });
        }
        ch+='</div>';
    });
    catsEl.innerHTML=ch;
    // Render items — single click = focus (show guide), double-click = select
    const vis=q?filtered:filtered.filter(i=>i.group===_deBp.activeCat);
    let ih='';
    // Smart suggestions based on current node context
    if(!q){
        var suggestions=_deBpGetSuggestions(filtered);
        if(suggestions.length){
            ih+='<div style="padding:4px 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333">Suggested</div>';
            suggestions.forEach(function(s){
                var sel=s.id===_deBp.val;
                var focused=s.id===_deBp.focusedId;
                var idJson=JSON.stringify(s.id).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                var _sg=getBindingGuide(s.id);
                var _st=_sg&&_sg.validIn?_sg.validIn[0]:'action';
                var _dc=_st==='precondition'?'#66bb6a':_st==='scriptText'?'#64b5f6':'#ffa726';
                var _sgTip=_sg&&_sg.desc?esc(_sg.desc):'';
                ih+='<button class="de-bp-item'+(sel?' selected':'')+(focused&&!sel?' focused':'')+'" data-bid="'+esc(s.id)+'" style="border-left:2px solid #ff8c00" '+
                    (_sgTip?'title="'+_sgTip+'" ':'')+
                    'onclick="_deBpFocus('+idJson+')" ondblclick="_deBpSelect('+idJson+')">';
                ih+='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+_dc+';margin-right:5px;flex-shrink:0"></span>';
                ih+=esc(s.label);
                if(s._reason)ih+='<span style="color:#888;font-size:10px;margin-left:6px">'+esc(s._reason)+'</span>';
                ih+='</button>';
            });
            ih+='<div style="height:1px;background:#333;margin:4px 0"></div>';
        }
    }
    // "None" option
    var noneIsCur=!_deBp.val;
    var noneFocused=_deBp.focusedId==='';
    ih+='<button class="de-bp-item de-bp-item-none'+(noneIsCur?' selected':'')+(noneFocused&&!noneIsCur?' focused':'')+'" data-bid="" onclick="_deBpFocus(\'\')" ondblclick="_deBpSelect(\'\')">'+
        (noneIsCur?'&#10003; ':'')+'None</button>';
    vis.forEach(function(i){
        const sel=i.id===_deBp.val;
        const focused=i.id===_deBp.focusedId;
        const isGhost=!!i._unavailableReason;
        const validSlot=_deBpIsValidIn(i.id,_deBp.type);
        const usable=validSlot&&!isGhost;
        var idJson=JSON.stringify(i.id).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        var _guide2=getBindingGuide(i.id);
        var _tipText=_guide2&&_guide2.desc?esc(_guide2.desc):(i.note?esc(i.note):'');
        ih+='<button class="de-bp-item'+(sel?' selected':'')+(focused&&!sel?' focused':'')+(!usable?' unavailable':'')+'" data-bid="'+esc(i.id)+'" '+
            (_tipText?'title="'+_tipText+'" ':'')+
            'onclick="_deBpFocus('+idJson+')" '+
            (usable?'ondblclick="_deBpSelect('+idJson+')" ':'')+
            '>';
        if(sel)ih+='<span style="margin-right:4px">&#10003;</span>';
        // Color dot by binding type
        var _guide=getBindingGuide(i.id);
        var _btype=_guide&&_guide.validIn?_guide.validIn[0]:'action';
        var _dotColor=_btype==='precondition'?'#66bb6a':_btype==='scriptText'?'#64b5f6':'#ffa726';
        ih+='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+_dotColor+';margin-right:5px;flex-shrink:0"></span>';
        ih+=esc(i.label);
        if(isGhost)ih+='<span class="de-bp-item-badge" style="background:rgba(224,80,80,.15);color:#e05050">N/A</span>';
        else if(!validSlot){
            var guide=getBindingGuide(i.id);
            var badgeType=guide&&guide.validIn?guide.validIn[0]:'action';
            var badgeCls=badgeType==='scriptText'?'txt':badgeType==='precondition'?'pre':'act';
            ih+='<span class="de-bp-item-badge '+badgeCls+'">'+esc(_deBpTypeLabels[badgeType]||'other')+'</span>';
        }
        ih+='</button>';
    });
    if(!vis.length&&q)ih='<div class="de-bp-empty">No matches for "'+esc(q)+'"</div>';
    if(!vis.length&&!q)ih='<div class="de-bp-empty">No bindings in this category</div>';
    itemsEl.innerHTML=ih;
}

// Register standard handlers
_deBpHandlers.node_precondition=function(v){deUpdateNodeMeta('precondition',v);_deRenderLeftPanel();};
_deBpHandlers.node_scriptText=function(v){deUpdateNodeScriptText(v);_deRenderLeftPanel();};
_deBpHandlers.node_action=function(v){deUpdateNodeMeta('action',v);_deRenderLeftPanel();};
_deBpHandlers.choice_precondition=function(v){deUpdateChoicePrecond(_deSelectedChoiceIdx,v);};
_deBpHandlers.choice_action=function(v){deUpdateChoiceAction(_deSelectedChoiceIdx,v);};

// ── Helper: render binding chips ──
function _deRenderChips(bindings){
    var html='';
    if(bindings.precondition){
        var c=typeof _classifyBinding==='function'?_classifyBinding(bindings.precondition):{icon:'⚙',label:bindings.precondition.replace('dialogs.','')};
        html+='<span class="de-chip de-chip-precond" title="Precondition">'+c.icon+' '+esc(c.label)+'</span>';
    }
    if(bindings.scriptText){
        var c=typeof _classifyBinding==='function'?_classifyBinding(bindings.scriptText):{icon:'📝',label:bindings.scriptText.replace('dialogs.','')};
        html+='<span class="de-chip de-chip-script" title="Script Text">'+c.icon+' '+esc(c.label)+'</span>';
    }
    if(bindings.action){
        bindings.action.split(';').forEach(function(a){
            var t=a.trim();if(!t)return;
            var c=typeof _classifyBinding==='function'?_classifyBinding(t):{icon:'▶',label:t.replace('dialogs.','')};
            html+='<span class="de-chip de-chip-action" title="Action">'+c.icon+' '+esc(c.label)+'</span>';
        });
    }
    if(bindings.hasInfo)html+='<span class="de-chip de-chip-info" title="has_info"><i class="bi">🔒</i> has: '+esc(bindings.hasInfo)+'</span>';
    if(bindings.dontHasInfo)html+='<span class="de-chip de-chip-info" title="dont_has_info"><i class="bi">🚫</i> !has: '+esc(bindings.dontHasInfo)+'</span>';
    if(bindings.giveInfo)html+='<span class="de-chip de-chip-info" title="give_info"><i class="bi">🔑</i> give: '+esc(bindings.giveInfo)+'</span>';
    if(bindings.disableInfo)html+='<span class="de-chip de-chip-info" title="disable_info"><i class="bi">🚫</i> disable: '+esc(bindings.disableInfo)+'</span>';
    return html;
}

// ── Left panel: node-level config ──
function _deRenderLeftPanel(){
    const panel=document.getElementById('deLeftContent');
    if(!panel)return;

    // Dialog tree tabs at top of panel
    let html='<div class="de-section-title">Dialogs</div>';
    html+='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px">';
    const dlg=getDlg();
    if(curTaskPoolTag){
        // Pool mode: show pool dialog tree tabs + Add Opener
        const pool=[...(Array.isArray(dlg?.taskPools)?dlg.taskPools:[]),...(Array.isArray(dlg?.customPools)?dlg.customPools:[])].find(p=>p.tag===curTaskPoolTag);
        if(pool){
            _migratePoolTrees(pool);
            pool.dialogTrees.forEach((t,i)=>{
                const active=curTaskPoolDlgIdx===i;
                html+=`<button class="de-node-tab${active?' active':''}" onclick="curTaskPoolDlgIdx=${i};resetDialogSimulator();_deRenderCenter();_deRenderLeftPanel();" style="font-size:10px;padding:3px 8px;color:#82b1ff;border-color:#1a3a5c">${esc(t.label||('Pool Dialog '+(i+1)))}</button>`;
            });
        }
        html+=`<button class="de-node-tab" onclick="addTaskPoolDialogTree('${esc(curTaskPoolTag)}')" style="font-size:10px;padding:3px 8px;color:#82b1ff;border-color:#1a3a5c">+ Add Opener</button>`;
    } else {
        const isMainView=_dePreviewMode&&!_dePreviewDrilled;
        html+=`<button class="de-node-tab${isMainView?' active':''}" onclick="_dePreviewMode=true;_dePreviewDrilled=false;resetDialogSimulator();_deRenderCenter();_deRenderLeftPanel();" style="font-size:10px;padding:3px 8px">Main</button>`;
        html+=`<button class="de-node-tab${_introTabActive?' active':''}" onclick="selectIntroTab();resetDialogSimulator();_deRenderCenter();_deRenderLeftPanel();" style="font-size:10px;padding:3px 8px;color:#8ac4ff;border-color:#3a5a7a">Intro</button>`;
        if(dlg&&dlg.dialogs){
            dlg.dialogs.forEach((t,i)=>{
                const active=!isMainView&&curVanillaCat===null&&curDlgTreeIdx===i&&_dePreviewDrilled;
                html+=`<button class="de-node-tab${active?' active':''}" onclick="dePreviewJumpToDialog(${i},'__hub__');_deRenderLeftPanel();" style="font-size:10px;padding:3px 8px">${esc(t.label||('Dialog '+(i+1)))}</button>`;
            });
        }
        const s=getD('settings')||{};
        const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
        const kept=(typeof STRIP_CATEGORIES!=='undefined')?STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id)):[];
        kept.forEach(cat=>{
            const active=!isMainView&&curVanillaCat===cat.id&&_dePreviewDrilled;
            html+=`<button class="de-node-tab${active?' active':''}" onclick="dePreviewJumpToVanilla('${esc(cat.id)}');_deRenderLeftPanel();" style="font-size:10px;padding:3px 8px;color:#ffe082;border-color:#554400">${esc(cat.label)}</button>`;
        });
    }
    html+='</div>';

    if(!_deEditMode){
        html+=`<div class="de-panel-hint">Click &#9998; on a choice<br>to configure it.</div>`;
        panel.innerHTML=html;return;
    }
    const d=getCurTree();
    if(!d||!_deSelectedNodeId){panel.innerHTML=html;return;}

    // Opener selected — left panel shows simple context
    if(_deSelectedNodeId==='__opener__'){
        const dlg=getDlg();
        const tree=dlg&&dlg.dialogs&&dlg.dialogs[_deSelectedChoiceIdx];
        if(tree){
            html+=`<div class="de-section-title">Node Config</div>`;
            html+=`<div class="de-field-hint">Editing opener for: ${esc(tree.label||('Dialog '+(_deSelectedChoiceIdx+1)))}</div>`;
        }
        panel.innerHTML=html;return;
    }

    const isHub=(_deSelectedNodeId==='__hub__');
    const n=isHub?null:(d.nodes||{})[_deSelectedNodeId];

    html+=`<div class="de-section-title">Node Config</div>`;

    if(isHub){
        html+=`<div class="de-field">
            <label>Player Opens With</label>
            <input type="text" value="${esc(d.opener||'')}" placeholder="I want to ask you something."
                oninput="deUpdateOpener(this.value)">
        </div>`;
    } else if(n){
        html+=`<div class="de-field">
            <label>Node ID</label>
            <span class="de-field-value">${esc(_deSelectedNodeId)}</span>
        </div>`;
        html+=`<div class="de-field">
            <label>Label</label>
            <input type="text" value="${esc(n.label||'')}" placeholder="Optional label..."
                oninput="deUpdateNodeLabel(this.value)">
        </div>`;
    }

    // ── Node-level binding pickers (feature #5) ──
    if(!isHub&&n){
        html+=`<div class="de-section-title" style="margin-top:16px">Bindings</div>`;
        html+=`<div class="de-field-hint">ARCH bindings for this node.</div>`;
        html+=`<div class="de-field"><label>Precondition</label>${_deBindingBtn('precondition',n.precondition||'','node_precondition')}</div>`;
        html+=`<div class="de-field"><label>NPC Script Text</label>${_deBindingBtn('scriptText',n.scriptText||'','node_scriptText')}</div>`;
        html+=`<div class="de-field"><label>Action</label>${_deBindingBtn('action',n.action||'','node_action')}</div>`;
        // Binding chips
        const chipHtml=_deRenderChips({precondition:n.precondition,scriptText:n.scriptText,action:n.action,hasInfo:n.hasInfo,dontHasInfo:n.dontHasInfo,giveInfo:n.giveInfo});
        if(chipHtml)html+=`<div style="margin:6px 0">${chipHtml}</div>`;
    }

    // Preconditions — min rank
    html+=`<div class="de-section-title" style="margin-top:16px">Preconditions</div>`;
    html+=`<div class="de-field-hint">Who can see this dialog node.</div>`;
    html+=`<div class="de-field">
        <label>Min Rank</label>
        <select onchange="deUpdateNodeMeta('minRank',this.value)">
            <option value="">Any</option>
            <option value="novice">Novice</option>
            <option value="experienced">Experienced</option>
            <option value="veteran">Veteran</option>
            <option value="master">Master</option>
        </select>
    </div>`;

    // Node-level info portions
    if(!isHub&&n){
        html+=`<div class="de-section-title" style="margin-top:16px">Info Portions</div>`;
        html+=`<div class="de-field">
            <label>🔒 Show when flag set</label>
            ${flagPickerHtml('hasInfo',n.hasInfo||'',"deUpdateNodeMeta('hasInfo',this.value)")}
        </div>`;
        html+=`<div class="de-field">
            <label>🚫 Hide when flag set</label>
            ${flagPickerHtml('dontHasInfo',n.dontHasInfo||'',"deUpdateNodeMeta('dontHasInfo',this.value)")}
        </div>`;
        html+=`<div class="de-field">
            <label>🔑 Set flag on actor</label>
            ${flagPickerHtml('giveInfo',n.giveInfo||'',"deUpdateNodeMeta('giveInfo',this.value)")}
        </div>`;
        const choices=n.choices||[];
        html+=`<div class="de-field-hint" style="margin-top:8px">${choices.length} choice${choices.length!==1?'s':''}</div>`;
    }

    panel.innerHTML=html;

    // Restore precondition select value
    if(!isHub&&n&&n.minRank){
        const selects=panel.querySelectorAll('select');
        // The min rank select is the last one before info portions
        selects.forEach(sel=>{
            const label=sel.closest('.de-field')?.querySelector('label');
            if(label&&label.textContent==='Min Rank')sel.value=n.minRank||'';
        });
    }
}

// ── Right panel: choice-level config ──
function _deRenderRightPanel(){
    const panel=document.getElementById('deRightContent');
    if(!panel)return;
    if(!_deEditMode){panel.innerHTML=`<div class="de-panel-hint">Click &#9998; on a choice<br>to configure it.</div>`;return;}

    // Opener editing — special case for Main tab dialog openers
    if(_deSelectedNodeId==='__opener__'&&_deSelectedChoiceIdx>=0){
        const dlg=getDlg();
        const tree=dlg&&dlg.dialogs&&dlg.dialogs[_deSelectedChoiceIdx];
        if(!tree){panel.innerHTML=`<div class="de-panel-hint">Opener not found.</div>`;return;}
        let oh=`<div class="de-section-title">Opener ${_deSelectedChoiceIdx+1} Config</div>`;
        oh+=`<div class="de-field">
            <label>Opener Text</label>
            <input type="text" value="${esc(tree.opener||'')}" placeholder="I want to ask you something."
                oninput="deUpdateOpenerText(${_deSelectedChoiceIdx},this.value)">
        </div>`;
        oh+=`<div class="de-field">
            <label>Label</label>
            <input type="text" value="${esc(tree.label||'')}" placeholder="Dialog tab label"
                oninput="deUpdateOpenerLabel(${_deSelectedChoiceIdx},this.value)">
        </div>`;
        oh+=`<div class="de-field">
            <label>Hub NPC Text</label>
            <input type="text" value="${esc(tree.hub||'')}" placeholder="What do you need?"
                oninput="deUpdateOpenerHub(${_deSelectedChoiceIdx},this.value)">
        </div>`;
        // Delete opener
        if(dlg.dialogs.length>1){
            oh+=`<div style="margin-top:20px">
                <button class="de-btn-danger" onclick="deDeleteOpener(${_deSelectedChoiceIdx})">&#10005; Remove Dialog</button>
            </div>`;
        }
        panel.innerHTML=oh;return;
    }

    const d=getCurTree();
    if(!d||_deSelectedChoiceIdx<0){
        panel.innerHTML=`<div class="de-panel-hint">Click a player choice<br>to configure it here.</div>`;
        return;
    }
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    const ch=choices[_deSelectedChoiceIdx];
    if(!ch){
        panel.innerHTML=`<div class="de-panel-hint">Choice not found.</div>`;
        return;
    }

    const ci=_deSelectedChoiceIdx;
    let html=`<div class="de-section-title">Choice ${ci+1} Config</div>`;

    // Choice reorder buttons (feature #12)
    html+=`<div style="margin-bottom:8px;display:flex;align-items:center;gap:4px">`;
    html+=`<span style="color:#888;font-size:10px">Reorder:</span>`;
    html+=`<button class="de-reorder-btn" onclick="deMoveChoice(${ci},-1)" title="Move up"${ci===0?' disabled':''}>&#9650;</button>`;
    html+=`<button class="de-reorder-btn" onclick="deMoveChoice(${ci},1)" title="Move down"${ci>=choices.length-1?' disabled':''}>&#9660;</button>`;
    html+=`</div>`;

    // Link target
    const next=ch.next||'__hub__';
    html+=`<div class="de-field">
        <label>Links To</label>
        <select onchange="_deHandleLinkChange(${ci},this.value,this)">
            <option value="__hub__"${next==='__hub__'?' selected':''}>&larr; Back to Hub</option>
            <option value="__end__"${next==='__end__'?' selected':''}>&times; End Conversation</option>`;
    // List other nodes
    const nodes=d.nodes||{};
    Object.keys(nodes).forEach(nid=>{
        if(nid===_deSelectedNodeId)return;
        const preview=String(nodes[nid].npc||'').slice(0,30);
        html+=`<option value="${esc(nid)}"${next===nid?' selected':''}>${esc(nid)}${preview?': '+esc(preview):''}</option>`;
    });
    // Pool insert targets
    const _dlg=getDlg();
    const _allPools=[...(Array.isArray(_dlg.taskPools)?_dlg.taskPools:[]),...(Array.isArray(_dlg.customPools)?_dlg.customPools:[])];
    if(_allPools.length){
        html+=`<optgroup label="Insert Task Flow">`;
        _allPools.forEach(p=>{
            const tag=p.tag||'default';
            html+=`<option value="__pool_insert_${esc(tag)}__">Pool: ${esc(tag)}</option>`;
        });
        html+=`</optgroup>`;
        html+=`<optgroup label="Insert Turnin">`;
        _allPools.forEach(p=>{
            const tag=p.tag||'default';
            html+=`<option value="__turnin_insert_${esc(tag)}__">Turnin: ${esc(tag)}</option>`;
        });
        html+=`</optgroup>`;
    }
    html+=`</select></div>`;

    // "Add Node" button when choice ends conversation (feature #3)
    if(next==='__end__'){
        html+=`<div style="margin:4px 0 8px">
            <button class="de-add-node-btn" onclick="deAddNodeFromChoice(${ci})" title="Create a new node and link this choice to it">&rarr; Add Node</button>
        </div>`;
    }

    // Precondition (ARCH) — picker
    html+=`<div class="de-field"><label>Precondition</label>${_deBindingBtn('precondition',ch.precondition||'','choice_precondition')}</div>`;

    // Action — picker (includes DIALOG_ACTIONS + ARCH bindings)
    html+=`<div class="de-field"><label>Script Action</label>${_deBindingBtn('action',ch.action||'','choice_action')}</div>`;

    // Action note
    if(ch.action){
        const def=DIALOG_ACTIONS.find(a=>a.id===ch.action);
        if(def&&def.note){
            html+=`<div class="de-field-hint" style="color:#ffb347">${esc(def.note)}</div>`;
        }
    }

    // Binding chips for choice (feature #7)
    const choiceChips=_deRenderChips({precondition:ch.precondition,action:ch.action,hasInfo:ch.hasInfo,dontHasInfo:ch.dontHasInfo,giveInfo:ch.giveInfo,disableInfo:ch.disableInfo});
    if(choiceChips)html+=`<div style="margin:6px 0">${choiceChips}</div>`;

    // Info portions
    html+=`<div class="de-section-title" style="margin-top:16px">Story Flags</div>`;
    html+=`<div class="de-field">
        <label>🔒 Show when flag set</label>
        ${flagPickerHtml('hasInfo',ch.hasInfo||'',"deUpdateChoiceMeta("+ci+",'hasInfo',this.value)")}
    </div>`;
    html+=`<div class="de-field">
        <label>🚫 Hide when flag set</label>
        ${flagPickerHtml('dontHasInfo',ch.dontHasInfo||'',"deUpdateChoiceMeta("+ci+",'dontHasInfo',this.value)")}
    </div>`;
    html+=`<div class="de-field">
        <label>🔑 Set flag</label>
        ${flagPickerHtml('giveInfo',ch.giveInfo||'',"deUpdateChoiceMeta("+ci+",'giveInfo',this.value)")}
    </div>`;
    html+=`<div class="de-field">
        <label>🔓 Remove flag</label>
        ${flagPickerHtml('disableInfo',ch.disableInfo||'',"deUpdateChoiceMeta("+ci+",'disableInfo',this.value)")}
    </div>`;

    // Delete choice button
    html+=`<div style="margin-top:20px">
        <button class="de-btn-danger" onclick="deDeleteChoice(${ci})">&#10005; Remove Choice</button>
    </div>`;

    panel.innerHTML=html;
}

// ── Select a choice (for right panel) ──
function deSelectChoice(ci){
    _deSelectedChoiceIdx=ci;
    _deRenderCenter();
    _deRenderRightPanel();
}

// ── Preview mode toggle ──
function deTogglePreview(on){
    _dePreviewMode=!!on;
    _dePreviewDrilled=false;
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderToolbar();
}

// ── Render all dialogs for preview mode ──
function _deRenderPreviewChoices(){
    const choArea=document.getElementById('deChoicesArea');
    if(!choArea)return;
    const dlg=getDlg();
    if(!dlg){choArea.innerHTML='';return;}
    const dialogs=dlg.dialogs||[];
    let html='';
    let lineNo=1;
    // Each custom dialog shown by its opener text — with edit button
    dialogs.forEach((t,i)=>{
        const opener=String(t.opener||'').trim()||('Dialog '+(i+1));
        // Inline editing mode for this opener
        if(_deEditMode&&_deSelectedNodeId==='__opener__'&&_deSelectedChoiceIdx===i){
            html+=`<div class="sim-opt de-editing">
                <span class="de-choice-num">${lineNo++}.</span>
                <input type="text" class="de-inline-edit" value="${esc(opener)}" oninput="deUpdateOpenerText(${i},this.value)" autofocus>
                <button class="de-edit-btn active" onclick="event.stopPropagation();deStopEdit()" title="Done">&#10003;</button>
            </div>`;
        } else {
            html+=`<button class="sim-opt" onclick="dePreviewJumpToDialog(${i},'__hub__')">${lineNo++}. ${esc(opener)}<span class="de-edit-btn" onclick="event.stopPropagation();deEditOpener(${i})" title="Edit">&#9998;</span></button>`;
        }
    });
    // Vanilla dialog openers (trade, tasks, info)
    const s=getD('settings')||{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
    const kept=(typeof STRIP_CATEGORIES!=='undefined')?STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id)):[];
    kept.forEach(cat=>{
        const defaults=(typeof VANILLA_DIALOG_DEFAULTS!=='undefined')?VANILLA_DIALOG_DEFAULTS[cat.id]:null;
        const opener=defaults&&defaults.opener?defaults.opener:cat.label;
        const _editable=typeof isVanillaCatEditable==='function'&&isVanillaCatEditable(cat.id);
        html+=`<button class="sim-opt" ${_editable?`onclick="dePreviewJumpToVanilla('${esc(cat.id)}')"`:''} style="${_editable?'':'opacity:0.5;cursor:default;'}">${lineNo++}. ${esc(opener)}</button>`;
    });
    choArea.innerHTML=html;
}
function dePreviewJumpToDialog(dlgIdx,nodeId){
    _deNavPush();
    _dePreviewDrilled=true;
    _dePreviewMode=true;
    curDlgTreeIdx=dlgIdx;
    curVanillaCat=null;
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderToolbar();
}
function dePreviewJumpToVanilla(catId){
    if(typeof isVanillaCatEditable==='function'&&!isVanillaCatEditable(catId))return;
    _deNavPush();
    _dePreviewDrilled=true;
    _dePreviewMode=true;
    curVanillaCat=catId;
    resetDialogSimulator();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderToolbar();
}

// ── Data update helpers ──
function deUpdateNpcText(val){
    const d=getCurTree();if(!d)return;
    if(_deSelectedNodeId==='__hub__'){d.hub=val;}
    else{const n=(d.nodes||{})[_deSelectedNodeId];if(n)n.npc=val;}
    autoSave();renderGraphEditor(d);
}
function deUpdateOpener(val){
    const d=getCurTree();if(!d)return;
    d.opener=val;
    autoSave();renderGraphEditor(d);
}
function deUpdateNodeLabel(val){
    const d=getCurTree();if(!d)return;
    const n=(d.nodes||{})[_deSelectedNodeId];
    if(n){n.label=val;autoSave();renderGraphEditor(d);}
}
function deUpdateNodeMeta(key,val){
    const d=getCurTree();if(!d||_deSelectedNodeId==='__hub__')return;
    const n=(d.nodes||{})[_deSelectedNodeId];
    if(n){n[key]=val||undefined;autoSave();}
}
function deUpdateChoicePrecond(ci,val){
    const d=getCurTree();if(!d)return;
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    if(!choices[ci])return;
    if(val)choices[ci].precondition=val;
    else delete choices[ci].precondition;
    autoSave();
    _deRenderRightPanel(); // refresh chips
}
function deUpdateNodeScriptText(val){
    const d=getCurTree();if(!d||_deSelectedNodeId==='__hub__')return;
    const n=(d.nodes||{})[_deSelectedNodeId];if(!n)return;
    if(val)n.scriptText=val;
    else delete n.scriptText;
    autoSave();
}
function deUpdateChoiceText(ci,val){
    const d=getCurTree();if(!d)return;
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    if(choices[ci]){choices[ci].text=val;autoSave();renderGraphEditor(d);}
}
function _deHandleLinkChange(ci,val,selectEl){
    // Pool insert — create node chain, not just a link change
    const poolMatch=val.match(/^__pool_insert_(.+)__$/);
    if(poolMatch){
        deInsertPoolFlow(_deSelectedNodeId,ci,poolMatch[1]);
        _deRenderRightPanel();
        return;
    }
    const turninMatch=val.match(/^__turnin_insert_(.+)__$/);
    if(turninMatch){
        deInsertTurninFlow(_deSelectedNodeId,ci,turninMatch[1]);
        _deRenderRightPanel();
        return;
    }
    // Normal link update
    deUpdateChoiceLink(ci,val);
}
function deUpdateChoiceLink(ci,val){
    const d=getCurTree();if(!d)return;
    flatSetChoiceNext(d,_deSelectedNodeId,ci,val);
    autoSave();renderBranches();
    _deRenderRightPanel();
}
function deUpdateChoiceMeta(ci,field,val){
    const d=getCurTree();if(!d)return;
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    if(!choices[ci])return;
    if(val)choices[ci][field]=val;
    else delete choices[ci][field];
    autoSave();
    _deRenderRightPanel(); // refresh chips
}
function deUpdateChoiceAction(ci,val){
    const d=getCurTree();if(!d)return;
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    if(!choices[ci])return;
    if(val)choices[ci].action=val;
    else delete choices[ci].action;
    autoSave();renderGraphEditor(d);
    _deRenderCenter();
    _deRenderRightPanel(); // refresh chips
}
function deAddChoice(){
    const d=getCurTree();if(!d)return;
    graphPushUndo();
    const isHub=(_deSelectedNodeId==='__hub__');
    if(isHub){
        d.hubChoices=d.hubChoices||[];
        d.hubChoices.push({text:'',next:'__hub__'});
    } else {
        const n=(d.nodes||{})[_deSelectedNodeId];
        if(!n)return;
        n.choices=n.choices||[];
        n.choices.push({text:'',next:'__hub__'});
    }
    autoSave();renderBranches();
    _deSelectedChoiceIdx=-1;
    _deRenderCenter();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Add Node from choice that ends conversation (feature #3) ──
function deAddNodeFromChoice(ci){
    const d=getCurTree();if(!d)return;
    graphPushUndo();
    const newId=flatCreateNode(d);
    flatSetChoiceNext(d,_deSelectedNodeId,ci,newId);
    autoSave();renderBranches();
    // Navigate to the new node
    _deNavPush();
    _deSelectedNodeId=newId;
    _deSelectedChoiceIdx=-1;
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Choice reorder: move up/down (feature #12) ──
function deMoveChoice(ci,direction){
    const d=getCurTree();if(!d)return;
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    const newIdx=ci+direction;
    if(newIdx<0||newIdx>=choices.length)return;
    graphPushUndo();
    // Swap
    const tmp=choices[ci];
    choices[ci]=choices[newIdx];
    choices[newIdx]=tmp;
    // Update selection to follow the moved choice
    _deSelectedChoiceIdx=newIdx;
    autoSave();renderBranches();
    _deRenderCenter();
    _deRenderRightPanel();
    _deRenderToolbar();
}

function deDeleteChoice(ci){
    const d=getCurTree();if(!d)return;
    graphPushUndo();
    const isHub=(_deSelectedNodeId==='__hub__');
    const choices=isHub?(d.hubChoices||[]):((d.nodes||{})[_deSelectedNodeId]?.choices||[]);
    choices.splice(ci,1);
    _deSelectedChoiceIdx=-1;
    autoSave();renderBranches();
    _deRenderCenter();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Opener editing (Main tab preview choices) ──
function deEditOpener(dlgIdx){
    _deSelectedNodeId='__opener__';
    _deSelectedChoiceIdx=dlgIdx;
    _deEditMode=true;
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}
function deUpdateOpenerText(dlgIdx,val){
    const dlg=getDlg();
    if(!dlg||!dlg.dialogs||!dlg.dialogs[dlgIdx])return;
    dlg.dialogs[dlgIdx].opener=val;
    autoSave();
}
function deUpdateOpenerLabel(dlgIdx,val){
    const dlg=getDlg();
    if(!dlg||!dlg.dialogs||!dlg.dialogs[dlgIdx])return;
    dlg.dialogs[dlgIdx].label=val;
    autoSave();
    _deRenderLeftPanel(); // refresh tab labels
}
function deUpdateOpenerHub(dlgIdx,val){
    const dlg=getDlg();
    if(!dlg||!dlg.dialogs||!dlg.dialogs[dlgIdx])return;
    dlg.dialogs[dlgIdx].hub=val;
    autoSave();
}
function deDeleteOpener(dlgIdx){
    const dlg=getDlg();
    if(!dlg||!dlg.dialogs||dlg.dialogs.length<=1)return;
    if(!confirm('Delete this dialog tree? This cannot be undone.'))return;
    graphPushUndo();
    dlg.dialogs.splice(dlgIdx,1);
    _deSelectedNodeId=null;
    _deSelectedChoiceIdx=-1;
    _deEditMode=false;
    autoSave();renderBranches();
    _deRenderCenter();
    _deRenderLeftPanel();
    _deRenderRightPanel();
    _deRenderToolbar();
}

// ── Draggable side panels (for positioning) ──
let _deDrag=null;
function _deDragInit(){}
function _deDragDestroy(){}
function _deDragStart(e){
    if(e.target.tagName==='BUTTON')return;
    const panel=e.target.closest('.de-side-panel');
    if(!panel)return;
    e.preventDefault();
    const rect=panel.getBoundingClientRect();
    _deDrag={panel,startX:e.clientX,startY:e.clientY,origLeft:rect.left,origTop:rect.top};
    panel.style.position='fixed';
    panel.style.left=rect.left+'px';
    panel.style.top=rect.top+'px';
    document.addEventListener('mousemove',_deDragMove);
    document.addEventListener('mouseup',_deDragEnd);
}
function _deDragMove(e){
    if(!_deDrag)return;
    var dx=e.clientX-_deDrag.startX;
    var dy=e.clientY-_deDrag.startY;
    _deDrag.panel.style.left=(_deDrag.origLeft+dx)+'px';
    _deDrag.panel.style.top=(_deDrag.origTop+dy)+'px';
    _deDrag.panel.style.height='auto';
    _deDrag.panel.style.maxHeight='80vh';
    // Log position to console so you can grab the values
    var r=_deDrag.panel.getBoundingClientRect();
    console.log(_deDrag.panel.id+': left='+Math.round(r.left)+' top='+Math.round(r.top)+' width='+Math.round(r.width)+' right='+Math.round(r.right));
}
function _deDragEnd(){
    document.removeEventListener('mousemove',_deDragMove);
    document.removeEventListener('mouseup',_deDragEnd);
    _deDrag=null;
}

// ── Toggle side panels ──
function deToggleLeft(){
    const panel=document.getElementById('deLeftPanel');
    if(!panel)return;
    panel.classList.toggle('collapsed');
    _deResizeSync();
}
function deToggleRight(){
    const panel=document.getElementById('deRightPanel');
    if(!panel)return;
    panel.classList.toggle('collapsed');
    _deResizeSync();
}
