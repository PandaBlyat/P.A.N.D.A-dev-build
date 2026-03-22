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
        const pool=(Array.isArray(dlg?.customPools)?dlg.customPools:[]).find(p=>p.tag===curTaskPoolTag);
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

    // ── Node-level binding dropdowns (feature #5) ──
    const _archB2=buildArchBindings();

    // Precondition dropdown
    if(!isHub&&n){
        html+=`<div class="de-section-title" style="margin-top:16px">Bindings</div>`;
        html+=`<div class="de-field-hint">ARCH bindings for this node.</div>`;

        // Precondition
        if(_archB2.preconditions.length){
            const _curPrecond=n.precondition||'';
            html+=`<div class="de-field">
            <label>Precondition</label>
            <select onchange="deUpdateNodeMeta('precondition',this.value)">
                <option value="">None</option>`;
            let _lpg='';
            _archB2.preconditions.forEach(p=>{
                if(p.group!==_lpg){if(_lpg)html+=`</optgroup>`;html+=`<optgroup label="${esc(p.group)}">`;_lpg=p.group;}
                html+=`<option value="${esc(p.id)}"${_curPrecond===p.id?' selected':''}>${esc(p.label)}</option>`;
            });
            if(_lpg)html+=`</optgroup>`;
            html+=`</select></div>`;
        }

        // Script Text dropdown
        if(_archB2.scriptTexts.length){
            const _curST=n.scriptText||'';
            html+=`<div class="de-field">
            <label>NPC Script Text</label>
            <select onchange="deUpdateNodeScriptText(this.value)">
                <option value="">&mdash; Plain text &mdash;</option>`;
            let _lstg='';
            _archB2.scriptTexts.forEach(st=>{
                if(st.group!==_lstg){if(_lstg)html+=`</optgroup>`;html+=`<optgroup label="${esc(st.group)}">`;_lstg=st.group;}
                html+=`<option value="${esc(st.id)}"${_curST===st.id?' selected':''}>${esc(st.label)}</option>`;
            });
            if(_lstg)html+=`</optgroup>`;
            html+=`</select></div>`;
        }

        // Action dropdown
        if(_archB2.actions.length){
            const _curAction=n.action||'';
            html+=`<div class="de-field">
            <label>Action</label>
            <select onchange="deUpdateNodeMeta('action',this.value)">
                <option value="">None</option>`;
            let _lag='';
            _archB2.actions.forEach(a=>{
                if(a.group!==_lag){if(_lag)html+=`</optgroup>`;html+=`<optgroup label="${esc(a.group)}">`;_lag=a.group;}
                html+=`<option value="${esc(a.id)}"${_curAction===a.id?' selected':''}>${esc(a.label)}</option>`;
            });
            if(_lag)html+=`</optgroup>`;
            html+=`</select></div>`;
        }

        // Binding chips (feature #7) — show current bindings as colored chips
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
            <label>has_info</label>
            <input type="text" value="${esc(n.hasInfo||'')}" placeholder="gate visibility" oninput="deUpdateNodeMeta('hasInfo',this.value)">
        </div>`;
        html+=`<div class="de-field">
            <label>dont_has_info</label>
            <input type="text" value="${esc(n.dontHasInfo||'')}" placeholder="hide when info set" oninput="deUpdateNodeMeta('dontHasInfo',this.value)">
        </div>`;
        html+=`<div class="de-field">
            <label>give_info</label>
            <input type="text" value="${esc(n.giveInfo||'')}" placeholder="set on actor" oninput="deUpdateNodeMeta('giveInfo',this.value)">
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
    const archB=buildArchBindings();
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

    // Precondition (ARCH)
    const currentPrecond=ch.precondition||'';
    if(archB.preconditions.length){
        html+=`<div class="de-field">
        <label>Precondition</label>
        <select onchange="deUpdateChoicePrecond(${ci},this.value)">
            <option value="">None</option>`;
        let _lpg='';
        archB.preconditions.forEach(p=>{
            if(p.group!==_lpg){if(_lpg)html+=`</optgroup>`;html+=`<optgroup label="${esc(p.group)}">`;_lpg=p.group;}
            html+=`<option value="${esc(p.id)}"${currentPrecond===p.id?' selected':''}>${esc(p.label)}</option>`;
        });
        if(_lpg)html+=`</optgroup>`;
        html+=`</select></div>`;
    }

    // Action
    const currentAction=ch.action||'';
    html+=`<div class="de-field">
        <label>Script Action</label>
        <select onchange="deUpdateChoiceAction(${ci},this.value)">
            <option value="">None</option>`;
    const _activeSpecs=getActiveSpecializations();
    DIALOG_ACTIONS.forEach(a=>{
        if(!a.id)return;
        if(a.spec&&!_activeSpecs.includes(a.spec))return;
        html+=`<option value="${esc(a.id)}"${currentAction===a.id?' selected':''}>${esc(a.label)}</option>`;
    });
    if(archB.actions.length){
        let _lag='';
        archB.actions.forEach(a=>{
            if(a.group!==_lag){if(_lag)html+=`</optgroup>`;html+=`<optgroup label="${esc(a.group)}">`;_lag=a.group;}
            html+=`<option value="${esc(a.id)}"${currentAction===a.id?' selected':''}>${esc(a.label)}</option>`;
        });
        if(_lag)html+=`</optgroup>`;
    }
    html+=`</select></div>`;

    if(currentAction){
        const def=DIALOG_ACTIONS.find(a=>a.id===currentAction);
        if(def&&def.note){
            html+=`<div class="de-field-hint" style="color:#ffb347">${esc(def.note)}</div>`;
        }
    }

    // Binding chips for choice (feature #7)
    const choiceChips=_deRenderChips({precondition:ch.precondition,action:ch.action,hasInfo:ch.hasInfo,dontHasInfo:ch.dontHasInfo,giveInfo:ch.giveInfo,disableInfo:ch.disableInfo});
    if(choiceChips)html+=`<div style="margin:6px 0">${choiceChips}</div>`;

    // Info portions
    html+=`<div class="de-section-title" style="margin-top:16px">Info Portions</div>`;
    html+=`<div class="de-field">
        <label>has_info</label>
        <input type="text" value="${esc(ch.hasInfo||'')}" placeholder="requires info portion" oninput="deUpdateChoiceMeta(${ci},'hasInfo',this.value)">
    </div>`;
    html+=`<div class="de-field">
        <label>dont_has_info</label>
        <input type="text" value="${esc(ch.dontHasInfo||'')}" placeholder="requires NO info portion" oninput="deUpdateChoiceMeta(${ci},'dontHasInfo',this.value)">
    </div>`;
    html+=`<div class="de-field">
        <label>give_info</label>
        <input type="text" value="${esc(ch.giveInfo||'')}" placeholder="sets info on actor" oninput="deUpdateChoiceMeta(${ci},'giveInfo',this.value)">
    </div>`;
    html+=`<div class="de-field">
        <label>disable_info</label>
        <input type="text" value="${esc(ch.disableInfo||'')}" placeholder="removes info from actor" oninput="deUpdateChoiceMeta(${ci},'disableInfo',this.value)">
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
        html+=`<button class="sim-opt" onclick="dePreviewJumpToVanilla('${esc(cat.id)}')">${lineNo++}. ${esc(opener)}</button>`;
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
