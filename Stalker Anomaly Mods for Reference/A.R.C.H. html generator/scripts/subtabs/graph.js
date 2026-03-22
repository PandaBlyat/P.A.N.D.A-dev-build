// ── Fullscreen overlay preservation across canvas.innerHTML rebuilds ──
function _detachFsOverlays(){
    const ids=['graphFsToolbar','graphFsErrors','dialogMinimap'];
    const saved=[];
    ids.forEach(id=>{const el=document.getElementById(id);if(el&&el.parentElement&&el.parentElement.id==='dialogGraphCanvas'){el.parentElement.removeChild(el);saved.push(el);}});
    return saved;
}
function _reattachFsOverlays(saved){
    if(!saved||!saved.length)return;
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    saved.forEach(el=>canvas.appendChild(el));
    if(typeof _updateFsOverlayPositions==='function')_updateFsOverlayPositions();
}

// ═══════════════════════════════════════════
// GRAPH STATE: DRAG, PAN, ZOOM, UNDO
// ═══════════════════════════════════════════
let graphDragState=null;  // node drag
let _graphDragRaf=null,_graphDragLastEv=null;  // RAF throttle for node drag
let _minimapRaf=null;  // RAF throttle for minimap updates
let graphPanState=null;   // canvas pan
let graphZoom=100;        // zoom percent
let graphUndoStack=[];    // undo history, max 10 snapshots
const GRAPH_UNDO_MAX=10;

// ── Undo helpers ──
function graphPushUndo(){
    const d=getCurTree();if(!d)return;
    const snap=JSON.stringify({nodes:d.nodes,hubChoices:d.hubChoices,layout:d.layout});
    // don't push duplicate
    if(graphUndoStack.length&&graphUndoStack[graphUndoStack.length-1]===snap)return;
    graphUndoStack.push(snap);
    if(graphUndoStack.length>GRAPH_UNDO_MAX)graphUndoStack.shift();
}
function graphUndo(){
    if(!graphUndoStack.length){setStatus('Nothing to undo.','ok');return;}
    const snap=JSON.parse(graphUndoStack.pop());
    const d=getCurTree();if(!d)return;
    d.nodes=snap.nodes;d.hubChoices=snap.hubChoices;d.layout=snap.layout;
    autoSave();renderBranches();setStatus('Undone.','ok');
}

// ── Node drag ──
// KEY INSIGHT: during drag we DON'T call renderGraphEditor — we move the DOM
// element directly. Only on drop do we commit and re-render once.
function startGraphDrag(nodeId,e){
    if(e.button!==0)return;
    if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||e.target.isContentEditable)return;
    e.preventDefault();e.stopPropagation();
    const _dragLayout=_getCurLayout();
    if(!_dragLayout)return;
    const canvas=document.getElementById('dialogGraphCanvas');if(!canvas)return;
    graphPushUndo();
    const pos=_dragLayout[nodeId]||{x:0,y:0};
    const r=canvas.getBoundingClientRect();
    const scale=graphZoom/100;
    // Capture cursor offset from node origin IN CANVAS SPACE.
    // canvas-space = (clientX - canvasLeft + scrollLeft) / zoom
    // Storing this offset means: as canvas scrolls, cursorCanvasX increases by same amount as scrollLeft,
    // so newNodeX = cursorCanvasX - offsetX also increases by same amount → node stays locked to cursor.
    const cursorCanvasX=(e.clientX-r.left+canvas.scrollLeft)/scale;
    const cursorCanvasY=(e.clientY-r.top +canvas.scrollTop )/scale;
    graphDragState={
        nodeId,
        offsetX:cursorCanvasX-pos.x,  // cursor-to-node-origin offset, constant throughout drag
        offsetY:cursorCanvasY-pos.y,
        activated:false,
        el:null,
        canvas
    };
    try{e.target.setPointerCapture(e.pointerId);}catch(err){}
}
function onGraphDragMove(ev){
    if(linkDragState){onLinkDragMoveInternal(ev);return;}
    if(!graphDragState)return;
    _graphDragLastEv=ev;
    if(_graphDragRaf)return;
    _graphDragRaf=requestAnimationFrame(function(){
        _graphDragRaf=null;
        const ev=_graphDragLastEv;
        if(!graphDragState||!ev)return;
        const canvas=graphDragState.canvas;
        const r=canvas.getBoundingClientRect();
        const scale=graphZoom/100;
        // Recompute cursor canvas-space position every frame.
        // scrollLeft is included so that when edge-scroll fires and shifts scrollLeft,
        // the very next frame this value increases by the same pixels → node moves with it → no drift.
        const cursorCanvasX=(ev.clientX-r.left+canvas.scrollLeft)/scale;
        const cursorCanvasY=(ev.clientY-r.top +canvas.scrollTop )/scale;
        const newX=Math.max(0,cursorCanvasX-graphDragState.offsetX);
        const newY=Math.max(0,cursorCanvasY-graphDragState.offsetY);

        if(!graphDragState.activated){
            const d=getCurTree();
            const orig=d?.layout[graphDragState.nodeId]||{x:0,y:0};
            if(Math.abs(newX-orig.x)<4&&Math.abs(newY-orig.y)<4)return;
            graphDragState.activated=true;
            const el=canvas.querySelector(`.dlg-node[data-nid="${graphDragState.nodeId}"]`);
            if(el){graphDragState.el=el;el.classList.add('dragging');el.style.willChange='transform';}
        }

        if(graphDragState.el){
            graphDragState.el.style.left=newX+'px';
            graphDragState.el.style.top =newY+'px';
        }

        // Edge auto-scroll: scroll canvas, then bubble to page ancestor
        const ZONE=60,SPEED=14;
        if(ev.clientX-r.left  <ZONE)canvas.scrollLeft-=SPEED;
        if(r.right-ev.clientX <ZONE)canvas.scrollLeft+=SPEED;
        if(ev.clientY-r.top   <ZONE)canvas.scrollTop -=SPEED;
        if(r.bottom-ev.clientY<ZONE){
            if(canvas.scrollTop<canvas.scrollHeight-canvas.clientHeight-1)canvas.scrollTop+=SPEED;
            else{
                let el=canvas.parentElement;
                while(el&&el!==document.body){
                    if(el.scrollHeight>el.clientHeight+2&&getComputedStyle(el).overflowY!=='visible'){el.scrollTop+=SPEED;break;}
                    el=el.parentElement;
                }
                if(!el||el===document.body)window.scrollBy(0,SPEED);
            }
        }
    });
}
function stopGraphDrag(){
    if(linkDragState){stopLinkDragInternal();return;}
    if(_graphDragRaf){cancelAnimationFrame(_graphDragRaf);_graphDragRaf=null;}_graphDragLastEv=null;
    if(!graphDragState)return;
    if(graphDragState.activated&&graphDragState.el){
        const el=graphDragState.el;
        el.classList.remove('dragging');el.style.willChange='';
        const newX=parseFloat(el.style.left)||0;
        const newY=parseFloat(el.style.top )||0;
        if(_mainTabActive){
            const _dl=getDlg();
            if(_dl&&_dl.mainLayout)_dl.mainLayout[graphDragState.nodeId]={x:newX,y:newY};
            renderMainGraphEditor();
        }else{
            const d=getCurTree();
            if(d&&d.layout)d.layout[graphDragState.nodeId]={x:newX,y:newY};
            renderGraphEditor(d);
        }
        autoSave();
    }
    graphDragState=null;
}

// ── Link drag: drag-to-connect from output port dots ──
let linkDragState=null;
function startLinkDrag(fromId,ci,e){
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const canvas=document.getElementById('dialogGraphCanvas');if(!canvas)return;
    let d,_ldLayout,_ldRealFrom=fromId,_ldVanillaCat=null;
    let _ldTaskPoolTag=null;
    if(_mainTabActive){
        const p=_mainParseId(fromId);
        if(!p)return;
        if(p.vanillaCat){
            _ldVanillaCat=p.vanillaCat;
            curVanillaCat=p.vanillaCat;
            d=getCurTree();if(!d){curVanillaCat=null;return;}
            curVanillaCat=null;
        }else if(p.taskPoolTag){
            _ldTaskPoolTag=p.taskPoolTag;
            curTaskPoolTag=p.taskPoolTag;
            d=getCurTree();if(!d){curTaskPoolTag=null;return;}
            curTaskPoolTag=null;
        }else if(p.dlgIdx>=0){
            curDlgTreeIdx=p.dlgIdx;
            d=getCurTree();if(!d)return;
        }else return;
        _ldLayout=getDlg().mainLayout||{};
        _ldRealFrom=p.nodeId;
    }else{
        d=getCurTree();if(!d)return;
        _ldLayout=d.layout||{};
    }
    graphPushUndo();
    closeLinkPicker();closeNodeAddMenu();
    const svg=canvas.querySelector('svg.dlg-links');if(!svg)return;
    const tempLine=document.createElementNS('http://www.w3.org/2000/svg','path');
    tempLine.setAttribute('class','dlg-link-temp');
    svg.appendChild(tempLine);
    const NW=220,NH=28,NN=44,NR=30;
    const fp=_ldLayout[fromId]||{x:0,y:0};
    const ox=fp.x+NW-10,oy=fp.y+NH+NN+ci*NR+NR/2;
    linkDragState={fromId:_ldRealFrom,ci,tempLine,canvas,svg,startX:ox,startY:oy,d,lastClientX:e.clientX,lastClientY:e.clientY,_mainDlgIdx:_mainTabActive?curDlgTreeIdx:-1,_vanillaCat:_ldVanillaCat,_taskPoolTag:_ldTaskPoolTag};
    e.target.classList.add('dragging');
    linkDragState.portEl=e.target;
    try{e.target.setPointerCapture(e.pointerId);}catch(err){}
}
function onLinkDragMoveInternal(ev){
    const st=linkDragState;if(!st)return;
    const canvas=st.canvas;
    const r=canvas.getBoundingClientRect();
    const scale=graphZoom/100;
    const cursorX=(ev.clientX-r.left+canvas.scrollLeft)/scale;
    const cursorY=(ev.clientY-r.top+canvas.scrollTop)/scale;
    const ox=st.startX,oy=st.startY;
    const dx=cursorX-ox;
    const ctrl=dx<0?-80:60;
    st.tempLine.setAttribute('d',`M ${ox} ${oy} C ${ox+ctrl} ${oy}, ${cursorX-ctrl} ${cursorY}, ${cursorX} ${cursorY}`);
    st.lastClientX=ev.clientX;st.lastClientY=ev.clientY;
    clearDropHighlights(canvas);
    const targetEl=findDropTargetNode(ev.clientX,ev.clientY,st.fromId);
    if(targetEl)targetEl.classList.add('drop-target');
}
function stopLinkDragInternal(){
    const st=linkDragState;if(!st)return;
    if(st.tempLine&&st.tempLine.parentNode)st.tempLine.remove();
    if(st.portEl)st.portEl.classList.remove('dragging');
    const dropTarget=st.canvas.querySelector('.dlg-node.drop-target');
    clearDropHighlights(st.canvas);
    const d=st.d;
    if(dropTarget){
        let targetNodeId=dropTarget.dataset.nid;
        if(targetNodeId){
            if(st._vanillaCat){
                const _tp=_mainParseId(targetNodeId);
                if(!_tp||_tp.vanillaCat!==st._vanillaCat){linkDragState=null;autoSave();renderBranches();return;}
                targetNodeId=_tp.nodeId;
            }else if(st._taskPoolTag){
                const _tp=_mainParseId(targetNodeId);
                if(!_tp||_tp.taskPoolTag!==st._taskPoolTag){linkDragState=null;autoSave();renderBranches();return;}
                targetNodeId=_tp.nodeId;
            }else if(st._mainDlgIdx>=0){
                const _tp=_mainParseId(targetNodeId);
                if(!_tp||_tp.dlgIdx!==st._mainDlgIdx){linkDragState=null;autoSave();renderBranches();return;}
                targetNodeId=_tp.nodeId;
            }
            if(targetNodeId==='__hub__')flatSetChoiceNext(d,st.fromId,st.ci,'__hub__');
            else flatSetChoiceNext(d,st.fromId,st.ci,targetNodeId);
        }
    }
    linkDragState=null;
    autoSave();renderBranches();
}
function findDropTargetNode(clientX,clientY,excludeId){
    const el=document.elementFromPoint(clientX,clientY);
    if(!el)return null;
    return el.closest('.dlg-node[data-nid]');
}
function clearDropHighlights(canvas){
    if(!canvas)return;
    canvas.querySelectorAll('.dlg-node.drop-target').forEach(n=>n.classList.remove('drop-target'));
}
function getPopupParent(){return document.fullscreenElement||document.webkitFullscreenElement||document.body;}
function showMiniLinkMenu(fromId,ci,btnEl){
    closeLinkPicker();
    const sp=fromId.replace(/'/g,"\\'");
    let html=`<div class="link-picker" id="linkPickerPopup"><div class="link-picker-title">Link to:</div>`;
    html+=`<button class="link-opt hub" onclick="setChoiceLink('${sp}',${ci},'__hub__')">↩ Return to Hub</button>`;
    html+=`<button class="link-opt exit" onclick="setChoiceLink('${sp}',${ci},'__end__')">✕ End Conversation</button></div>`;
    const popup=document.createElement('div');
    popup.innerHTML=html;
    const el=popup.firstChild;
    getPopupParent().appendChild(el);
    el.style.position='fixed';
    const rect=btnEl.getBoundingClientRect();
    el.style.left=Math.min(rect.left,window.innerWidth-240)+'px';
    el.style.top=(rect.bottom+4)+'px';
    el.style.zIndex='9999';
    _linkPickerOpen={fromId,ci};
    setTimeout(()=>document.addEventListener('click',_outsidePickerClose,{once:true,capture:true}),10);
}

// ── Canvas pan (left-click on empty canvas space) ──
let _canvasPanListening=false;
function initCanvasPan(){
    if(_canvasPanListening)return;
    _canvasPanListening=true;
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    canvas.classList.add('pannable');
    canvas.addEventListener('pointerdown',e=>{
        const onEmpty=e.target===canvas||e.target.classList.contains('dlg-scene')||e.target.classList.contains('dlg-links')||e.target.tagName==='svg';
        if(e.button!==0||!onEmpty)return;
        if(graphDragState)return;
        e.preventDefault();
        graphPanState={startX:e.clientX,startY:e.clientY,scrollLeft:canvas.scrollLeft,scrollTop:canvas.scrollTop,canvas};
        canvas.classList.add('panning');
        try{canvas.setPointerCapture(e.pointerId);}catch(err){}
    });
    canvas.addEventListener('pointermove',e=>{
        if(!graphPanState)return;
        const dx=e.clientX-graphPanState.startX;
        const dy=e.clientY-graphPanState.startY;
        graphPanState.canvas.scrollLeft=graphPanState.scrollLeft-dx;
        graphPanState.canvas.scrollTop=graphPanState.scrollTop-dy;
    });
    canvas.addEventListener('pointerup',()=>{
        if(!graphPanState)return;
        graphPanState.canvas.classList.remove('panning');
        graphPanState=null;
    });
}

// ── Zoom (Shift+scroll) ──
function setGraphZoom(val,pivotX,pivotY){
    // pivotX/Y: canvas-client coords to keep fixed under cursor
    const canvas=document.getElementById('dialogGraphCanvas');
    const oldZoom=graphZoom;
    graphZoom=Math.min(200,Math.max(25,Number(val)||100));
    const label=document.getElementById('graphZoomLabel');
    if(label)label.textContent=graphZoom+'%  Shift+scroll to zoom';
    const fsLabel=document.getElementById('graphFsZoomLabel');
    if(fsLabel)fsLabel.textContent=graphZoom+'%';
    const scene=document.querySelector('#dialogGraphCanvas .dlg-scene');
    if(!scene)return;
    scene.style.transformOrigin='top left';
    scene.style.transform=`scale(${graphZoom/100})`;
    // Adjust scroll so the point under cursor stays fixed
    if(canvas&&pivotX!=null){
        const r=canvas.getBoundingClientRect();
        // cursor offset within canvas viewport
        const cx=pivotX-r.left+canvas.scrollLeft;
        const cy=pivotY-r.top+canvas.scrollTop;
        // after zoom, the scene-space point cx/oldZoom*newZoom should map back to same client pos
        canvas.scrollLeft=cx*(graphZoom/oldZoom)-(pivotX-r.left);
        canvas.scrollTop =cy*(graphZoom/oldZoom)-(pivotY-r.top);
    }
}
function _onCanvasWheel(e){
    if(!e.shiftKey)return;
    e.preventDefault();
    const delta=e.deltaY>0?-10:10; // scroll down = zoom out
    setGraphZoom(graphZoom+delta,e.clientX,e.clientY);
}


// ── Reset View / Fit All ──
function graphResetView(){
    setGraphZoom(100);
    const canvas=document.getElementById('dialogGraphCanvas');
    if(canvas){canvas.scrollLeft=0;canvas.scrollTop=0;}
}
function graphFitAll(){
    const _fitLayout=_getCurLayout();
    if(!_fitLayout)return;
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    const positions=Object.values(_fitLayout);
    if(!positions.length)return;
    const NW=220,NH=160; // approx node width/height
    const minX=Math.min(...positions.map(p=>p.x));
    const minY=Math.min(...positions.map(p=>p.y));
    const maxX=Math.max(...positions.map(p=>p.x))+NW;
    const maxY=Math.max(...positions.map(p=>p.y))+NH;
    const contentW=maxX-minX+60;
    const contentH=maxY-minY+60;
    const scaleX=canvas.clientWidth/contentW;
    const scaleY=canvas.clientHeight/contentH;
    const newZoom=Math.floor(Math.min(scaleX,scaleY)*100);
    setGraphZoom(Math.min(150,Math.max(25,newZoom)));
    canvas.scrollLeft=(minX-30)*(graphZoom/100);
    canvas.scrollTop=(minY-30)*(graphZoom/100);
}

// ── Register canvas wheel+pan after canvas is available ──
function ensureCanvasInteractions(){
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas||canvas._interactionsInited)return;
    canvas._interactionsInited=true;
    canvas.addEventListener('wheel',_onCanvasWheel,{passive:false});
    initCanvasPan();
    canvas.addEventListener('scroll',updateMinimap,{passive:true});
    window.addEventListener('scroll',updateMinimap,{passive:true});
    window.addEventListener('resize',updateMinimap,{passive:true});
    // Recalculate viewport when minimap expands/contracts on hover
    const _mm=document.getElementById('dialogMinimap');
    if(_mm){_mm.addEventListener('mouseenter',()=>{_minimapRaf=null;requestAnimationFrame(_doUpdateMinimap);},{passive:true});
    _mm.addEventListener('mouseleave',()=>{_minimapRaf=null;requestAnimationFrame(_doUpdateMinimap);},{passive:true});}
}

// ── Minimap ──
// updateMinimap is RAF-throttled: any number of callers per frame collapses to one draw.
function updateMinimap(){
    if(_minimapRaf)return;
    _minimapRaf=requestAnimationFrame(_doUpdateMinimap);
}
function _doUpdateMinimap(){
    _minimapRaf=null;
    const canvas=document.getElementById('dialogGraphCanvas');
    const mm=document.getElementById('dialogMinimap');
    const mc=document.getElementById('minimapCanvas');
    const vp=document.getElementById('minimapViewport');
    if(!canvas||!mm||!mc||!vp)return;
    const scene=canvas.querySelector('.dlg-scene');
    if(!scene){mm.style.display='none';return;}
    mm.style.display='';
    // In fullscreen, canvas has contain/will-change that break position:fixed —
    // use position:absolute pinned to scroll offset instead
    const cRect=canvas.getBoundingClientRect();
    const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
    if(fsEl===canvas){
        mm.style.position='absolute';
        mm.style.left=(canvas.scrollLeft+canvas.clientWidth-mm.offsetWidth-8)+'px';
        mm.style.top=(canvas.scrollTop+canvas.clientHeight-mm.offsetHeight-8)+'px';
        mm.style.right='';mm.style.bottom='';
    }else{
        mm.style.position='';
        const visBottom=Math.min(cRect.bottom,window.innerHeight);
        const visRight=Math.min(cRect.right,window.innerWidth);
        mm.style.right=(window.innerWidth-visRight+8)+'px';
        mm.style.bottom=(window.innerHeight-visBottom+8)+'px';
        mm.style.left='';mm.style.top='';
    }
    const scale=graphZoom/100;
    // Read scene size from inline style (set by renderGraphEditor) — avoids offsetWidth reflow
    const worldW=Math.max(parseFloat(scene.style.width)||canvas.clientWidth||1,1);
    const worldH=Math.max(parseFloat(scene.style.height)||canvas.clientHeight||1,1);
    const ctx=mc.getContext('2d');
    const cw=mc.width,ch=mc.height;
    const sx=cw/worldW,sy=ch/worldH;
    ctx.clearRect(0,0,cw,ch);
    // Fixed node dimensions matching renderGraphEditor defaults — no DOM reads per node
    const NODE_W=220,NODE_H=80;
    ctx.strokeStyle='rgba(100,160,100,.35)';ctx.lineWidth=0.5;

    if(_mainTabActive){
        // Main tab — draw from mainLayout with prefixed IDs
        const dlg=getDlg();if(!dlg||!dlg.mainLayout)return;
        const layout=dlg.mainLayout;
        // Draw opener→hub links for each dialog tree
        (dlg.dialogs||[]).forEach((t,i)=>{
            const opPos=layout['__opener__'];const hbPos=layout[i+'.__hub__'];
            if(opPos&&hbPos){ctx.beginPath();ctx.moveTo((opPos.x+NODE_W)*sx,(opPos.y+NODE_H/2)*sy);ctx.lineTo(hbPos.x*sx,(hbPos.y+NODE_H/2)*sy);ctx.stroke();}
            const pfx=i+'.';
            (t.hubChoices||[]).forEach(ch=>{if(!ch.next||ch.next==='__end__'||ch.next==='__hub__')return;const fp=layout[pfx+'__hub__'],tp=layout[pfx+ch.next];if(!fp||!tp)return;ctx.beginPath();ctx.moveTo((fp.x+NODE_W)*sx,(fp.y+NODE_H/2)*sy);ctx.lineTo(tp.x*sx,(tp.y+NODE_H/2)*sy);ctx.stroke();});
            Object.entries(t.nodes||{}).forEach(([nid,n])=>{(n.choices||[]).forEach(ch=>{if(!ch.next||ch.next==='__end__'||ch.next==='__hub__')return;const fp=layout[pfx+nid],tp=layout[pfx+ch.next];if(!fp||!tp)return;ctx.beginPath();ctx.moveTo((fp.x+NODE_W)*sx,(fp.y+NODE_H/2)*sy);ctx.lineTo(tp.x*sx,(tp.y+NODE_H/2)*sy);ctx.stroke();});});
        });
        // Draw opener→hub links for vanilla trees
        Object.entries(dlg.vanillaDialogs||{}).forEach(([catId,vt])=>{
            const opPos=layout['__opener__'];const hbPos=layout['v_'+catId+'.__hub__'];
            if(opPos&&hbPos){ctx.beginPath();ctx.moveTo((opPos.x+NODE_W)*sx,(opPos.y+NODE_H/2)*sy);ctx.lineTo(hbPos.x*sx,(hbPos.y+NODE_H/2)*sy);ctx.stroke();}
            const pfx='v_'+catId+'.';
            (vt.hubChoices||[]).forEach(ch=>{if(!ch.next||ch.next==='__end__'||ch.next==='__hub__')return;const fp=layout[pfx+'__hub__'],tp=layout[pfx+ch.next];if(!fp||!tp)return;ctx.beginPath();ctx.moveTo((fp.x+NODE_W)*sx,(fp.y+NODE_H/2)*sy);ctx.lineTo(tp.x*sx,(tp.y+NODE_H/2)*sy);ctx.stroke();});
        });
        // Draw all nodes
        Object.entries(layout).forEach(([nid,pos])=>{
            if(nid==='__opener__'){ctx.fillStyle='#1e3a1e';ctx.strokeStyle='#90e090';}
            else if(nid.endsWith('.__hub__')){ctx.fillStyle='#4a3c08';ctx.strokeStyle='#ffe082';}
            else{ctx.fillStyle='#1a3a1a';ctx.strokeStyle='#5a8a5a';}
            ctx.fillRect(pos.x*sx,pos.y*sy,NODE_W*sx,NODE_H*sy);
            ctx.strokeRect(pos.x*sx,pos.y*sy,NODE_W*sx,NODE_H*sy);
        });
    } else {
    // Draw links from data (no querySelectorAll, no per-link DOM queries)
    const d=getCurTree();if(!d||!d.layout)return;
    function _drawLink(fromId,toId){
        if(!toId||toId==='__end__'||toId==='__hub__')return;
        const fp=d.layout[fromId],tp=d.layout[toId];
        if(!fp||!tp)return;
        ctx.beginPath();
        ctx.moveTo((fp.x+NODE_W)*sx,(fp.y+NODE_H/2)*sy);
        ctx.lineTo(tp.x*sx,(tp.y+NODE_H/2)*sy);
        ctx.stroke();
    }
    (d.hubChoices||[]).forEach(ch=>_drawLink('__hub__',ch.next));
    Object.entries(d.nodes||{}).forEach(([nid,n])=>{
        (n.choices||[]).forEach(ch=>_drawLink(nid,ch.next));
    });
    // Draw nodes from layout data (no querySelectorAll, no offsetWidth reads)
    // Opener→Hub link in minimap (can't use _drawLink since it skips __hub__ target)
    {const _op=d.layout['__opener__'],_hb=d.layout['__hub__'];
    if(_op&&_hb){ctx.beginPath();ctx.moveTo((_op.x+NODE_W)*sx,(_op.y+NODE_H/2)*sy);ctx.lineTo(_hb.x*sx,(_hb.y+NODE_H/2)*sy);ctx.stroke();}}
    Object.entries(d.layout).forEach(([nid,pos])=>{
        if(nid==='__opener__'){ctx.fillStyle='#1e3a1e';ctx.strokeStyle='#90e090';}
        else if(nid==='__hub__'){ctx.fillStyle='#4a3c08';ctx.strokeStyle='#ffe082';}
        else{ctx.fillStyle='#1a3a1a';ctx.strokeStyle='#5a8a5a';}
        ctx.fillRect(pos.x*sx,pos.y*sy,NODE_W*sx,NODE_H*sy);
        ctx.strokeRect(pos.x*sx,pos.y*sy,NODE_W*sx,NODE_H*sy);
    });
    }
    // Viewport rectangle — shows what portion of the scene is currently visible
    const winBot=Math.min(cRect.bottom,window.innerHeight);
    const winRight2=Math.min(cRect.right,window.innerWidth);
    const canvasVisTop=Math.max(0,-cRect.top);
    const canvasVisBot=Math.min(canvas.clientHeight,winBot-cRect.top);
    const canvasVisLeft=Math.max(0,-cRect.left);
    const canvasVisRight=Math.min(canvas.clientWidth,winRight2-cRect.left);
    const contentL=(canvas.scrollLeft+canvasVisLeft)/scale;
    const contentT=(canvas.scrollTop+canvasVisTop)/scale;
    const contentR=(canvas.scrollLeft+canvasVisRight)/scale;
    const contentB=(canvas.scrollTop+canvasVisBot)/scale;
    // Viewport rect: percentage-based so it scales correctly when minimap CSS-expands
    const vpX=contentL/worldW*100;
    const vpY=contentT/worldH*100;
    const vpW=(contentR-contentL)/worldW*100;
    const vpH=(contentB-contentT)/worldH*100;
    vp.style.left=Math.max(0,vpX)+'%';
    vp.style.top=Math.max(0,vpY)+'%';
    vp.style.width=Math.min(vpW,100-Math.max(0,vpX))+'%';
    vp.style.height=Math.min(vpH,100-Math.max(0,vpY))+'%';
    mm._mapData={worldW,worldH,cw,ch,scale};
}
function minimapNav(e){
    const mm=document.getElementById('dialogMinimap');
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!mm||!canvas||!mm._mapData)return;
    e.preventDefault();
    const rect=mm.getBoundingClientRect();
    const {worldW,worldH,scale}=mm._mapData;
    // Map click directly to scene coordinates (no offset)
    const worldX=(e.clientX-rect.left)/rect.width*worldW;
    const worldY=(e.clientY-rect.top)/rect.height*worldH;
    // Set canvas internal scroll to center the target
    canvas.scrollLeft=worldX*scale-canvas.clientWidth/2;
    canvas.scrollTop=worldY*scale-canvas.clientHeight/2;
    // Page scroll to center target vertically in window
    const pixInCanvas=worldY*scale-canvas.scrollTop;
    const canvasPageTop=canvas.getBoundingClientRect().top+window.scrollY;
    const targetAbsY=canvasPageTop+pixInCanvas;
    window.scrollTo({left:window.scrollX,top:Math.max(0,targetAbsY-window.innerHeight/2),behavior:'instant'});
    setTimeout(updateMinimap,20);
}
function minimapStartDrag(e){
    e.preventDefault();
    const mm=document.getElementById('dialogMinimap');
    if(mm)mm.classList.add('drag-active');
    minimapNav(e);
    const onMove=(ev)=>{if(ev.buttons&1)minimapNav(ev);else onUp();};
    const onUp=()=>{
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        const mm2=document.getElementById('dialogMinimap');
        if(mm2)mm2.classList.remove('drag-active');
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
}

// ── Returns the active layout object for drag/fit operations ──
function _getCurLayout(){
    if(_mainTabActive)return getDlg()?.mainLayout||null;
    return getCurTree()?.layout||null;
}

function renderBranches(){
    if(curGrp===null&&!(editMode==='solo'&&curSolo!==null))return;
    renderDialogTreeTabs();
    if(_mainTabActive){renderMainGraphEditor();return;}
    const tree=getCurTree();
    renderDialogInsights(tree);
}

// ── Auto-layout: BFS from hub, place nodes in columns by depth ──
function _estimateNodeHeight(id,d){
    const NW=220,NH=28,NN_BASE=44,NR=30,CHIP_LINE=14,GAP=20;
    const nodes=d.nodes||{};
    const isHub=(id==='__hub__');
    const npcText=isHub?String(d.hub||''):String(nodes[id]?.npc||'');
    const choices=isHub?(d.hubChoices||[]):(nodes[id]?.choices||[]);
    const nd=!isHub?nodes[id]:null;
    // NPC text area: ~14px per 30 chars wrapped in 220px width
    const npcLines=Math.max(1,Math.ceil(npcText.length/30));
    const npcH=Math.max(NN_BASE,npcLines*14+10);
    // Node-level binding chips
    let nodeChipLines=0;
    if(nd&&(nd.precondition||nd.scriptText||nd.action||nd.hasInfo||nd.dontHasInfo||nd.giveInfo)){
        if(nd.precondition)nodeChipLines++;
        if(nd.scriptText)nodeChipLines++;
        if(nd.action)nodeChipLines+=nd.action.split(';').length;
        if(nd.hasInfo)nodeChipLines++;
        if(nd.dontHasInfo)nodeChipLines++;
        if(nd.giveInfo)nodeChipLines++;
    }
    // Choice rows + choice-level chips
    let choiceH=0;
    choices.forEach(ch=>{
        choiceH+=NR;
        if(ch.action||ch.precondition||ch.giveInfo||ch.hasInfo||ch.dontHasInfo){
            let lines=0;
            if(ch.action)lines+=ch.action.split(';').length;
            if(ch.precondition)lines++;
            if(ch.giveInfo)lines++;
            if(ch.hasInfo)lines++;
            if(ch.dontHasInfo)lines++;
            choiceH+=lines*CHIP_LINE;
        }
    });
    choiceH+=NR; // +Response row
    return NH+npcH+nodeChipLines*CHIP_LINE+choiceH+GAP;
}

function applyFlatLayout(d,forceAll){
    d.layout=d.layout||{};
    const nodes=d.nodes||{};
    const X_STEP=310, X0=20, Y0=20;

    // Opener at column 0
    if(!d.layout['__opener__']||forceAll)d.layout['__opener__']={x:X0, y:Y0};

    // BFS to assign depths (hub=0, children=1+)
    const depth={};
    const queue=['__hub__'];
    depth['__hub__']=0;
    while(queue.length){
        const id=queue.shift();
        const choices=(id==='__hub__')?(d.hubChoices||[]):(nodes[id]?.choices||[]);
        choices.forEach(ch=>{
            if(!ch.next||ch.next==='__hub__'||ch.next==='__end__')return;
            if(depth[ch.next]===undefined){depth[ch.next]=depth[id]+1;queue.push(ch.next);}
        });
    }
    // Any orphan nodes get depth = max+1
    const maxDepth=Math.max(0,...Object.values(depth));
    Object.keys(nodes).forEach(id=>{if(depth[id]===undefined)depth[id]=maxDepth+1;});

    if(forceAll){
        // Full re-layout: position everything from scratch
        const byDepth={};
        ['__hub__',...Object.keys(nodes)].forEach(id=>{
            const d2=depth[id]||0;
            byDepth[d2]=byDepth[d2]||[];
            byDepth[d2].push(id);
        });
        Object.entries(byDepth).forEach(([d2,ids])=>{
            let y=Y0;
            ids.forEach(id=>{
                d.layout[id]={x:X0+(Number(d2)+1)*X_STEP, y};
                y+=_estimateNodeHeight(id,d);
            });
        });
    } else {
        // Incremental: only position nodes that don't have positions yet
        if(!d.layout['__hub__'])d.layout['__hub__']={x:X0+X_STEP, y:Y0};
        Object.keys(nodes).forEach(id=>{
            if(d.layout[id])return; // keep existing position
            const col=depth[id]||0;
            // Find max Y in this column to place below existing nodes
            let maxY=Y0;
            Object.keys(nodes).forEach(otherId=>{
                if((depth[otherId]||0)===col&&d.layout[otherId]){
                    maxY=Math.max(maxY,d.layout[otherId].y+_estimateNodeHeight(otherId,d));
                }
            });
            if(id!=='__hub__'&&(depth['__hub__']||0)===col&&d.layout['__hub__']){
                maxY=Math.max(maxY,d.layout['__hub__'].y+_estimateNodeHeight('__hub__',d));
            }
            d.layout[id]={x:X0+(col+1)*X_STEP, y:maxY};
        });
    }
}

// ── Link picker: small overlay dropdown to pick where a choice links to ──
let _linkPickerOpen=null; // {fromId, ci}
function _outsidePickerClose(e){
    const p=document.getElementById('linkPickerPopup');
    if(p&&!p.contains(e.target))closeLinkPicker();
}
function closeLinkPicker(){
    const p=document.getElementById('linkPickerPopup');
    if(p)p.remove();
    _linkPickerOpen=null;
}
function setChoiceLink(fromId,ci,nextId){
    closeLinkPicker();
    graphPushUndo();
    const d=getCurTree();
    if(nextId==='__new__'){
        const newId=flatCreateNode(d);
        flatSetChoiceNext(d,fromId,ci,newId);
    }else{
        flatSetChoiceNext(d,fromId,ci,nextId);
    }
    autoSave();renderBranches();
}

// ── Node bottom "Add ▾" menu ──
function closeNodeAddMenu(){const p=document.getElementById('nodeAddMenuPopup');if(p)p.remove();}
function openNodeAddMenu(nodeId,btnEl){
    closeNodeAddMenu();closeLinkPicker();
    const popup=document.createElement('div');
    popup.className='node-add-menu';popup.id='nodeAddMenuPopup';

    // Helper: add a button row
    const addOpt=(label,cls,fn)=>{
        const b=document.createElement('button');
        b.className='node-add-opt '+cls;b.textContent=label;
        b.addEventListener('click',e=>{e.stopPropagation();fn();});
        popup.appendChild(b);
    };

    addOpt('💬 Add Response','response',()=>{closeNodeAddMenu();addChild(nodeId);});
    addOpt('↩ Add Loop Response','loop',()=>{closeNodeAddMenu();addLoopResponse(nodeId);});

    // Task offer/turnin presets
    const tasks=getTaskList();
    if(tasks.length){
        const sep=document.createElement('div');sep.className='node-add-opt sep';sep.textContent='— Task Offer —';popup.appendChild(sep);
        tasks.forEach(t=>{
            const kicon={fetch:'🎒',delivery:'📦',talk:'💬',collect:'📋'}[t.type]||'📋';
            addOpt('<i class="bi">'+kicon+'</i> <i class="bi">📝</i> Offer: '+(t.openingDialogue||t.id),'task',()=>{
                closeNodeAddMenu();graphPushUndo();
                const d=getCurTree();
                const childId=flatCreateNode(d);
                d.nodes[childId].npc='Here\'s what I need...';
                d.nodes[childId].label='Offer: '+(t.openingDialogue||t.id);
                d.nodes[childId].action='dialogs.arch_accept_'+t.id;
                d.nodes[childId].choices=[{text:'I\'ll handle it.',next:'__hub__'},{text:'Not interested.',next:'__hub__'}];
                addChoiceTo(nodeId,childId);autoSave();renderBranches();
            });
        });
        const sep2=document.createElement('div');sep2.className='node-add-opt sep';sep2.textContent='— Task Turnin —';popup.appendChild(sep2);
        tasks.forEach(t=>{
            if(t.type==='fetch')return; // fetch turnin is via pool, not per-task
            const kicon={delivery:'📦',talk:'💬',collect:'📋'}[t.type]||'☑️';
            const completeBinding=t.type==='delivery'?'arch_delivery_complete_'+t.id:t.type==='talk'?'arch_talk_complete_'+t.id:'arch_collect_pickup_'+t.id;
            addOpt('<i class="bi">'+kicon+'</i> <i class="bi">☑️</i> Turnin: '+(t.openingDialogue||t.id),'task',()=>{
                closeNodeAddMenu();graphPushUndo();
                const d=getCurTree();
                const childId=flatCreateNode(d);
                d.nodes[childId].npc='Good, you\'re back.';
                d.nodes[childId].label='Turnin: '+(t.openingDialogue||t.id);
                d.nodes[childId].action='dialogs.'+completeBinding+';dialogs.arch_delivery_deliver_rewards';
                d.nodes[childId].choices=[{text:'What\'s next?',next:'__hub__'}];
                addChoiceTo(nodeId,childId);autoSave();renderBranches();
            });
        });
    } else {
        const sep=document.createElement('div');sep.className='node-add-opt sep';sep.textContent='No tasks — add in Tasks tab';popup.appendChild(sep);
    }
    // Pool offer preset
    var dlgData=typeof getDlg==='function'?getDlg():null;
    var allPools=[];
    if(dlgData){
        (dlgData.taskPools||[]).forEach(function(p){allPools.push(p.tag);});
        (dlgData.customPools||[]).forEach(function(p){allPools.push(p.tag);});
    }
    if(allPools.length){
        const sep3=document.createElement('div');sep3.className='node-add-opt sep';sep3.textContent='— Pool Offer —';popup.appendChild(sep3);
        allPools.forEach(tag=>{
            addOpt('<i class="bi">🎲</i> Pool: '+tag,'task',()=>{
                closeNodeAddMenu();graphPushUndo();
                const d=getCurTree();
                const childId=flatCreateNode(d);
                d.nodes[childId].npc='';
                d.nodes[childId].label='Pool: '+tag;
                d.nodes[childId].scriptText='dialogs.arch_text_task_offer_summary_'+tag;
                d.nodes[childId].precondition='dialogs.arch_has_task_pool_'+tag;
                d.nodes[childId].choices=[
                    {text:'I\'ll take the job.',next:'__hub__',action:'dialogs.arch_task_accept_'+tag},
                    {text:'Not now.',next:'__hub__'}
                ];
                addChoiceTo(nodeId,childId);autoSave();renderBranches();
            });
        });
    }

    // Specialization options — auto-create child node with default service dialog
    const specs=getActiveSpecializations();
    if(specs.length){
        const sep2=document.createElement('div');sep2.className='node-add-opt sep';sep2.textContent='— Specialization Service —';popup.appendChild(sep2);
        specs.forEach(specId=>{
            const def=SPECIALIZATION_DEFS.find(d=>d.id===specId);
            if(!def)return;
            addOpt('🔧 '+def.label,'response',()=>{
                closeNodeAddMenu();graphPushUndo();
                const d=getCurTree();
                const childId=flatCreateNode(d);
                if(specId==='cook'){
                    d.nodes[childId]={
                        npc:'Show me what you want cooked.',
                        label:'Cook Service',
                        choices:[
                            {text:'[Player selects ingredient]',next:'__hub__'},
                            {text:'I don\'t have anything right now.',next:'__hub__'},
                            {text:'Never mind.',next:'__hub__'}
                        ]
                    };
                } else if(specId==='informant'){
                    const stalkerLeadId=flatCreateNode(d);
                    d.nodes[stalkerLeadId]={
                        npc:'[Informant provides stalker intel]',
                        label:'Stalker Lead',
                        choices:[
                            {text:'Any other leads?',next:childId},
                            {text:'Thanks.',next:'__hub__'}
                        ]
                    };
                    const mutantLeadId=flatCreateNode(d);
                    d.nodes[mutantLeadId]={
                        npc:'[Informant provides mutant intel]',
                        label:'Mutant Lead',
                        choices:[
                            {text:'Any other leads?',next:childId},
                            {text:'Thanks.',next:'__hub__'}
                        ]
                    };
                    d.nodes[childId]={
                        npc:'What kind of lead do you need?',
                        label:'Informant Service',
                        choices:[
                            {text:'Any stalker sightings?',next:stalkerLeadId},
                            {text:'Any mutant activity?',next:mutantLeadId},
                            {text:'Never mind.',next:'__hub__'}
                        ]
                    };
                } else {
                    // Technician / Medic — vanilla UI service
                    d.nodes[childId]={
                        npc:def.serviceAction||'[Service UI opens]',
                        label:def.label,
                        choices:[
                            {text:'Thanks.',next:'__hub__'},
                            {text:'Never mind.',next:'__hub__'}
                        ]
                    };
                }
                const isHub=(nodeId==='__hub__');
                const choices=isHub?(d.hubChoices=d.hubChoices||[]):(flatGetNode(d,nodeId)?.choices);
                if(choices)choices.push({text:def.serviceLabel,next:childId});
                autoSave();renderBranches();
            });
        });
    }

    popup.style.visibility='hidden';
    getPopupParent().appendChild(popup);
    const rect=btnEl.getBoundingClientRect();
    const pw=popup.offsetWidth||200,ph=popup.offsetHeight||120;
    let left=rect.left,top=rect.bottom+4;
    if(left+pw>window.innerWidth-8)left=window.innerWidth-pw-8;
    if(top+ph>window.innerHeight-8)top=rect.top-ph-4;
    popup.style.left=left+'px';popup.style.top=top+'px';popup.style.visibility='';

    setTimeout(()=>document.addEventListener('click',_closeNodeAddOnOutside,{once:true,capture:true}),10);
}
function _closeNodeAddOnOutside(e){const p=document.getElementById('nodeAddMenuPopup');if(p&&!p.contains(e.target))closeNodeAddMenu();}
function addTaskResponse(nodeId,taskId,taskTitle){
    graphPushUndo();
    const d=getCurTree();
    const tasks=getTaskList();
    const task=tasks.find(t=>t.id===taskId);
    const summaryText=task&&task.openingDialogue?task.openingDialogue:(task&&task.desc?task.desc:'I have a job for you.');
    const detailsText=task&&task.desc?task.desc:'Bring me what I need and you will be rewarded.';
    // Details child node
    const detailsId=flatCreateNode(d);
    d.nodes[detailsId]={
        npc:detailsText,
        label:'Details: '+(taskTitle||taskId),
        choices:[
            {text:'I will take it.',next:'__hub__',taskId},
            {text:'Not now.',next:'__hub__'}
        ]
    };
    // Offer node
    const childId=flatCreateNode(d);
    d.nodes[childId]={
        npc:summaryText,
        label:'Task: '+(taskTitle||taskId),
        choices:[
            {text:'Give me details.',next:detailsId},
            {text:'I will take it.',next:'__hub__',taskId},
            {text:'Not now.',next:'__hub__'},
            {text:'Never mind.',next:'__hub__'}
        ]
    };
    const isHub=(nodeId==='__hub__');
    const choices=isHub?(d.hubChoices=d.hubChoices||[]):(flatGetNode(d,nodeId)?.choices);
    if(choices)choices.push({text:'(Task) '+taskTitle,next:childId,taskId});
    autoSave();renderBranches();
}
function addLoopResponse(nodeId){
    graphPushUndo();
    const d=getCurTree();
    const isHub=(nodeId==='__hub__');
    const choices=isHub?(d.hubChoices=d.hubChoices||[]):(flatGetNode(d,nodeId)?.choices);
    if(choices)choices.push({text:'I have another question.',next:'__hub__'});
    autoSave();renderBranches();
}

// ── Shared helpers ──
function _buildActionTip(actionStr){
    if(!actionStr)return '';
    return String(actionStr).split(';').map(function(a){var t=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===t;});return def?def.label:t;}).join(' + ');
}

// ── Shared node builder ──
// ── Node variation dropdown menu ──
// mode: 'node' (default) | 'tree' (for hub/opener — uses tree-level field)
// treeField: 'hub' or 'openerNpc' when mode='tree'
function _toggleNodeVarMenu(nodeId,btn,mode,treeField){
    var existing=btn.querySelector('.dlg-var-menu');
    if(existing){existing.remove();return;}
    document.querySelectorAll('.dlg-var-menu').forEach(function(m){m.remove();});
    var d=getCurTree();if(!d)return;
    var vc,av;
    if(mode==='tree'){
        vc=getTreeFieldVarCount(d,treeField);
        av=_getNodeVar(nodeId);
    } else {
        var n=flatGetNode(d,nodeId);if(!n)return;
        vc=getNodeVarCount(n);
        av=_getNodeVar(nodeId);
    }
    var menu=document.createElement('div');
    menu.className='dlg-var-menu';
    for(var i=0;i<vc;i++){
        (function(vi){
            var item=document.createElement('button');
            item.textContent=(vi+1)+'.';
            if(vi===av)item.className='active';
            item.onclick=function(e){e.stopPropagation();switchNodeVar(nodeId,vi);};
            menu.appendChild(item);
        })(i);
    }
    var addBtn=document.createElement('button');
    addBtn.textContent='+ variation';
    addBtn.className='dlg-var-add';
    addBtn.onclick=function(e){e.stopPropagation();
        if(mode==='tree')addTreeFieldVariation(treeField,nodeId);
        else addNodeVariation(nodeId);
    };
    menu.appendChild(addBtn);
    if(av>0){
        var rmBtn=document.createElement('button');
        rmBtn.textContent='\u2715 remove #'+(av+1);
        rmBtn.className='dlg-var-rm';
        rmBtn.onclick=function(e){e.stopPropagation();
            if(mode==='tree')removeTreeFieldVariation(treeField,nodeId,av);
            else removeNodeVariation(nodeId,av);
        };
        menu.appendChild(rmBtn);
    }
    btn.appendChild(menu);
    setTimeout(function(){document.addEventListener('click',function _cls(){document.querySelectorAll('.dlg-var-menu').forEach(function(m){m.remove();});document.removeEventListener('click',_cls);});},0);
}

// opts: { evtId, nodeId, pos, isHub, isOrphan, npcText, displayTitle, choices, node,
//         handlers:{action,link,del,rename,addChild,addMenu,keydown,npcInput,choiceInput,nodeBinding},
//         textColor, borderColor, selectedId }
function _buildNodeShared(opts){
    const sp=opts.evtId.replace(/'/g,"\\'");
    const npcEsc=esc(opts.npcText||'');
    const nd=opts.node; // null for hub
    const isHub=opts.isHub;
    const poolTag=nd?.poolTag;
    const hasBindings=nd&&(nd.precondition||nd.scriptText||nd.action);
    const accentColor=poolTag?'rgba(255,183,77,0.45)':(hasBindings?'rgba(255,183,77,0.45)':'');
    const borderStyle=opts.borderColor?'border-color:'+opts.borderColor+';':(accentColor?'border:2px solid '+accentColor+';':'');
    const poolBadge=poolTag?'<span style="position:absolute;top:2px;right:24px;font-size:9px;color:#ffb74d;opacity:0.8">\u2b21 '+esc(poolTag)+'</span>':'';
    const bindingChips=(nd&&(poolTag||hasBindings))?_buildPoolChips(nd):'';
    const textStyle=opts.textColor?' style="color:'+opts.textColor+'"':'';
    const h=opts.handlers;

    // Choice rows
    let rowsHtml='';
    (opts.choices||[]).forEach(function(ch,ci){
        const pEsc=esc(String(ch.text||'').trim());
        const actionTip=_buildActionTip(ch.action);
        const chLabel=_buildChoiceChipLabel(ch);
        rowsHtml+='<div class="dlg-node-row'+(ch.action?' has-action':'')+'" data-ci="'+ci+'"'+(actionTip?' title="'+esc(actionTip)+'"':'')+'>'
            +'<div class="dlg-node-row-text" contenteditable="true" spellcheck="false"'
            +' data-placeholder="Player text..."'+(opts.textColor?' style="color:'+opts.textColor+'"':'')
            +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
            +' onfocus="highlightLinkedRow(\''+sp+'\','+ci+')" onblur="clearLinkedRowHighlight()"'
            +(h.keydown?' onkeydown="'+h.keydown+'(\''+sp+'\','+ci+',event)"':'')
            +' oninput="'+h.choiceInput(sp,ci)+'"'
            +'>'+pEsc+'</div>'
            +'<button class="dlg-action-btn'+(ch.action?' active':'')+'" title="'+(ch.action?esc(actionTip):'Add action')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.action+'(\''+sp+'\','+ci+',this)">&#9889;</button>'
            +'<button class="dlg-lnk-btn" title="Link options" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.link+'(\''+sp+'\','+ci+',this)">\ud83d\udd17</button>'
            +'<button class="dlg-del-row" title="Remove response" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.del+'(\''+sp+'\','+ci+')">&#10005;</button>'
            +'<span class="dlg-port-area" onpointerdown="event.stopPropagation();startLinkDrag(\''+sp+'\','+ci+',event)"><span class="dlg-port-out"></span></span>'
            +'</div>'+chLabel;
    });
    rowsHtml+='<div class="dlg-node-add-row">'
        +'<button class="dlg-add-direct" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.addChild+'(\''+sp+'\')">+ Response</button>'
        +'<button class="dlg-add-menu-btn" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.addMenu+'(\''+sp+'\',this)" title="More options">&#9662;</button>'
        +'</div>';

    const headerClass=isHub?'dlg-node-header hub-header':'dlg-node-header';
    const headerStyle=opts.borderColor?'position:relative;border-color:'+opts.borderColor:'position:relative';
    const delBtn=isHub?'':'<button class="dlg-hbtn del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.deleteNode+'(\''+sp+'\')" title="Delete">&#10005;</button>';
    const bindingBtn='<button class="dlg-action-btn dlg-node-bind-btn'+(hasBindings?' active':'')+'" style="margin-left:auto;flex-shrink:0" title="'+(hasBindings?'Edit node bindings':'Add node binding')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();'+h.nodeBinding+'(\''+sp+'\',this)">&#9889;</button>';

    // Variation selector — nodes use node.npcVariations, hub uses tree.hubVariations
    var varHtml='';
    if(isHub){
        var av=_getNodeVar(opts.evtId);
        varHtml='<span class="dlg-node-var" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();_toggleNodeVarMenu(\''+sp+'\',this,\'tree\',\'hub\')">'+(av+1)+'</span>';
    } else if(nd){
        var av=_getNodeVar(opts.evtId);
        varHtml='<span class="dlg-node-var" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();_toggleNodeVarMenu(\''+sp+'\',this)">'+(av+1)+'</span>';
    }

    return '<div class="dlg-node'+(opts.selectedId===opts.evtId?' selected':'')+(opts.isOrphan?' orphan':'')+'" data-nid="'+esc(opts.evtId)+'" style="left:'+opts.pos.x+'px;top:'+opts.pos.y+'px;'+borderStyle+'" onclick="selectBranch(\''+sp+'\')">'
        +'<div class="'+headerClass+'" style="'+headerStyle+'" onpointerdown="startGraphDrag(\''+sp+'\',event)">'
        +'<span class="dlg-port-in"></span>'
        +varHtml
        +'<span class="dlg-node-title" ondblclick="event.stopPropagation();'+h.rename+'(this,\''+sp+'\')">'+esc(opts.displayTitle)+'</span>'
        +poolBadge+bindingBtn+delBtn
        +'</div>'
        +'<div class="dlg-node-npc" contenteditable="true" spellcheck="false"'
        +' data-placeholder="'+(isHub?'Hub NPC response...':'NPC says...')+'"'+textStyle
        +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation();selectBranch(\''+sp+'\',true)"'
        +' oninput="'+h.npcInput(sp)+'"'
        +'>'+npcEsc+'</div>'
        +(bindingChips||'')
        +rowsHtml
        +'</div>';
}

// ── Binding chips (shown on nodes with precondition/scriptText/action) ──
// ── Binding icon helper — maps raw binding strings to zone-worn icons ──
function _bi(emoji){return '<i class="bi">'+emoji+'</i>';}
function _classifyBinding(raw){
    var s=raw.replace('dialogs.','');
    if(s.indexOf('arch_accept_')===0)return{icon:_bi('📝'),label:'Accept: '+s.replace('arch_accept_','')};
    if(s.indexOf('arch_delivery_complete_')===0)return{icon:_bi('☑️'),label:'Complete: '+s.replace('arch_delivery_complete_','')};
    if(s.indexOf('arch_talk_complete_')===0)return{icon:_bi('☑️'),label:'Complete: '+s.replace('arch_talk_complete_','')};
    if(s.indexOf('arch_collect_pickup_')===0)return{icon:_bi('📋'),label:'Pickup: '+s.replace('arch_collect_pickup_','')};
    if(s==='arch_delivery_deliver_rewards')return{icon:_bi('💵'),label:'Give rewards'};
    if(s.indexOf('arch_task_deliver_rewards')===0)return{icon:_bi('💵'),label:'Give rewards'};
    if(s.indexOf('arch_has_task_pool_')===0)return{icon:_bi('🎲'),label:'Pool: '+s.replace('arch_has_task_pool_','')};
    if(s.indexOf('arch_text_task_offer_summary_')===0)return{icon:_bi('📜'),label:'Offer: '+s.replace('arch_text_task_offer_summary_','')};
    if(s.indexOf('arch_task_accept_')===0)return{icon:_bi('📝'),label:'Accept pool: '+s.replace('arch_task_accept_','')};
    if(s.indexOf('arch_task_try_complete_')===0)return{icon:_bi('☑️'),label:'Complete pool: '+s.replace('arch_task_try_complete_','')};
    // Fallback — show raw with generic icon
    return{icon:'▶',label:s};
}

function _buildPoolChips(node){
    if(!node)return '';
    var chips=[];
    if(node.precondition){var c=_classifyBinding(node.precondition);chips.push(c.icon+' '+c.label);}
    if(node.scriptText){var c=_classifyBinding(node.scriptText);chips.push(c.icon+' '+c.label);}
    if(node.action){
        node.action.split(';').forEach(function(a){
            var t=a.trim();if(!t)return;
            var c=_classifyBinding(t);chips.push(c.icon+' '+c.label);
        });
    }
    if(node.hasInfo)chips.push(_bi('🔒')+' has: '+node.hasInfo);
    if(node.dontHasInfo)chips.push(_bi('🚫')+' !has: '+node.dontHasInfo);
    if(node.giveInfo)chips.push(_bi('🔑')+' give: '+node.giveInfo);
    if(!chips.length)return '';
    return '<div style="padding:2px 6px;font-size:9px;color:#ffb74d;opacity:0.7;line-height:1.6">'+chips.join('<br>')+'</div>';
}

// ── Choice binding label (compact, shown inline on choice rows) ──
function _buildChoiceChipLabel(ch){
    if(!ch)return '';
    var parts=[];
    if(ch.action)ch.action.split(';').forEach(function(a){var t=a.trim();if(!t)return;var c=_classifyBinding(t);parts.push(c.icon+c.label);});
    if(ch.precondition){var c=_classifyBinding(ch.precondition);parts.push(c.icon+c.label);}
    if(ch.giveInfo)parts.push(_bi('🔑')+ch.giveInfo);
    if(ch.hasInfo)parts.push(_bi('🔒')+ch.hasInfo);
    if(ch.dontHasInfo)parts.push(_bi('🚫')+ch.dontHasInfo);
    if(!parts.length)return '';
    return '<div style="font-size:9px;color:#ffb74d;opacity:0.7;padding:2px 6px;line-height:1.6">'+parts.join('<br>')+'</div>';
}

// ── Main graph renderer ──
let _lastGraphArchKey=null;
function renderGraphEditor(d){
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    // Reset position whenever the active archetype changes
    const _archKey=(editMode==='solo')?('solo:'+curSolo):(editMode==='char'?'char:'+curGrp+':'+curChar:'grp:'+curGrp);
    const _archChanged=_archKey!==_lastGraphArchKey;
    if(_archChanged){
        _lastGraphArchKey=_archKey;
        graphZoom=100;
        canvas.scrollLeft=0;canvas.scrollTop=0;
        const _lbl=document.getElementById('graphZoomLabel');
        if(_lbl)_lbl.textContent='100%  Shift+scroll to zoom';
        const _sc=canvas.querySelector('.dlg-scene');
        if(_sc){_sc.style.transform='scale(1)';_sc.style.transformOrigin='top left';}
    }
    const nodes=d.nodes||{};
    const hubChoices=d.hubChoices||[];
    const nodeIds=Object.keys(nodes);

    d.layout=d.layout||{};
    if(!d.layout['__hub__']||!d.layout['__opener__']||nodeIds.some(id=>!d.layout[id])) applyFlatLayout(d);

    // ── Which node IDs are reachable from hub (BFS) — orphans get flagged ──
    const reachable=new Set(['__hub__']);
    const bfsQ=['__hub__'];
    while(bfsQ.length){
        const cur=bfsQ.shift();
        const arr=(cur==='__hub__')?hubChoices:(nodes[cur]?.choices||[]);
        arr.forEach(ch=>{if(ch.next&&!reachable.has(ch.next)&&nodes[ch.next]){reachable.add(ch.next);bfsQ.push(ch.next);}});
    }

    const NW=220, NH=28, NN=44, NR=30;
    const lines=[];
    let maxX=0,maxY=0;

    function drawLink(fromId,ci,toId){
        const fp=d.layout[fromId]||{x:0,y:0};
        const tp=d.layout[toId];if(!tp)return;
        const fromNN=(fromId==='__opener__')?0:NN; // opener has no NPC text area
        const ox=fp.x+NW-10, oy=fp.y+NH+fromNN+ci*NR+NR/2;
        const ix=tp.x,    iy=tp.y+NH/2;
        const isBack=(tp.x<=fp.x);
        const ctrl=isBack?-80:60;
        lines.push(`<path class="dlg-link${isBack?' dlg-link-back':''}" data-from="${fromId}" data-ci="${ci}" data-to="${toId}" d="M ${ox} ${oy} C ${ox+ctrl} ${oy}, ${ix-ctrl} ${iy}, ${ix} ${iy}"/>`);
        maxY=Math.max(maxY,Math.max(oy,iy)+20);
    }
    // Opener → Hub link
    drawLink('__opener__',0,'__hub__');
    // Track opener bounds
    {const op=d.layout['__opener__']||{x:0,y:0};maxX=Math.max(maxX,op.x+NW+20);maxY=Math.max(maxY,op.y+NH+NN+NR+60);}
    hubChoices.forEach((ch,ci)=>{if(ch.next&&ch.next!=='__hub__'&&ch.next!=='__end__'&&d.layout[ch.next])drawLink('__hub__',ci,ch.next);});
    nodeIds.forEach(id=>{
        const pos=d.layout[id]||{x:0,y:0};
        maxX=Math.max(maxX,pos.x+NW+20);
        (nodes[id]?.choices||[]).forEach((ch,ci)=>{if(ch.next&&ch.next!=='__hub__'&&ch.next!=='__end__'&&d.layout[ch.next])drawLink(id,ci,ch.next);});
        maxY=Math.max(maxY,pos.y+NH+NN+Math.max(1,(nodes[id]?.choices||[]).length)*NR+60);
    });
    {const p=d.layout['__hub__']||{x:0,y:0};maxX=Math.max(maxX,p.x+NW+20);maxY=Math.max(maxY,p.y+NH+NN+Math.max(1,hubChoices.length)*NR+60);}

    const _singleHandlers={
        action:'showActionMenu', link:'showMiniLinkMenu', del:'confirmRowDelete',
        rename:'startNodeRename', addChild:'addChild', addMenu:'openNodeAddMenu',
        deleteNode:'_singleDeleteNode', nodeBinding:'showNodeBindingMenu',
        keydown:'handleRowKeydown',
        npcInput:function(sp){return "flatSetNodeNpc(getCurTree(),'"+sp+"',this.textContent);autoSave()";},
        choiceInput:function(sp,ci){return "(function(el){var arr=(('"+sp+"'==='__hub__')?(getCurTree().hubChoices||[]):(getCurTree().nodes['"+sp+"']?.choices||[]));if(arr["+ci+"])arr["+ci+"].text=el.textContent;autoSave();})(this)";}
    };
    function _singleDeleteNode(sp){graphPushUndo();flatDeleteNode(getCurTree(),sp);autoSave();renderBranches();}
    function buildNode(id,isHub){
        const userLabel=isHub?'':String((nodes[id]?.label)||'').trim();
        return _buildNodeShared({
            evtId:id, nodeId:id,
            pos:d.layout[id]||{x:0,y:0},
            isHub, isOrphan:!isHub&&!reachable.has(id),
            npcText:isHub?getTreeFieldVarText(d,'hub','__hub__'):(nodes[id]?getNodeNpcText(nodes[id],id):''),
            displayTitle:isHub?'\u25cf HUB':(userLabel?'['+id+'] '+userLabel:'['+id+']'),
            choices:isHub?hubChoices:(nodes[id]?.choices||[]),
            node:isHub?null:nodes[id],
            handlers:Object.assign({},_singleHandlers,{
                npcInput:function(sp){return isHub?"setTreeFieldVarText('hub','__hub__',this.textContent)":"flatSetNodeNpc(getCurTree(),'"+sp+"',this.textContent);autoSave()";}
            }),
            selectedId:selectedBranchPath
        });
    }

    // ── Build opener node ──
    // Intro tab: 3-tier (NPC greeting → Player response → Hub)
    // Custom tabs: 1-tier (Actor opener → Hub)
    function buildOpenerNode(){
        const pos=d.layout['__opener__']||{x:0,y:0};
        const openerText=String(d.opener||'').trim();
        const _opHasBindings=d.openerPrecondition||d.openerAction||d.openerScriptText;
        const _opAv=_getNodeVar('__opener__');
        const _isIntro=!!_introTabActive;

        var html='<div class="dlg-node opener-node'+(selectedBranchPath==='__opener__'?' selected':'')+'" data-nid="__opener__" style="left:'+pos.x+'px;top:'+pos.y+'px" onclick="selectBranch(\'__opener__\')">'
            +'<div class="dlg-node-header opener-header" style="position:relative" onpointerdown="startGraphDrag(\'__opener__\',event)">';
        if(_isIntro){
            html+='<span class="dlg-node-var" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();_toggleNodeVarMenu(\'__opener__\',this,\'tree\',\'introGreeting\')">'+(_opAv+1)+'</span>';
        }
        html+='<span class="dlg-node-title">\u25b6 '+(_isIntro?'INTRO':'OPENER')+'</span>'
            +'<button class="dlg-action-btn dlg-node-bind-btn'+(_opHasBindings?' active':'')+'" style="margin-left:auto;flex-shrink:0" title="'+(_opHasBindings?'Edit opener bindings':'Add opener binding')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();showNodeBindingMenu(\'__opener__\',this)">&#9889;</button>'
            +'</div>';

        if(_isIntro){
            // ── INTRO: 3-tier ──
            // Tier 1: NPC greeting (phrase 0 — NPC speaks first)
            var greetingText=getTreeFieldVarText(d,'introGreeting','__opener__');
            html+='<div class="dlg-node-npc" contenteditable="true" spellcheck="false"'
                +' data-placeholder="NPC greeting — what the NPC says when you first meet..."'
                +' style="color:#c8c0b0;border-bottom:1px solid rgba(255,255,255,.06)"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation();selectBranch(\'__opener__\',true)"'
                +' oninput="setTreeFieldVarText(\'introGreeting\',\'__opener__\',this.textContent)"'
                +'>'+esc(greetingText)+'</div>';
            // Tier 2: Player response (phrase 1 — actor responds)
            html+='<div class="dlg-node-npc opener-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Player responds..."'
                +' style="border-bottom:1px solid rgba(255,255,255,.06)"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation();selectBranch(\'__opener__\',true)"'
                +' oninput="(function(el){getCurTree().opener=el.textContent;autoSave()})(this)"'
                +'>'+esc(openerText)+'</div>';
        } else {
            // ── CUSTOM: 1-tier — actor opener ──
            html+='<div class="dlg-node-npc opener-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Actor says..."'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation();selectBranch(\'__opener__\',true)"'
                +' oninput="(function(el){getCurTree().opener=el.textContent;autoSave()})(this)"'
                +'>'+esc(openerText)+'</div>';
        }

        html+='<div class="dlg-node-row" data-ci="0">'
            +'<div class="dlg-node-row-text" style="opacity:0.5;pointer-events:none">\u2192 Hub</div>'
            +'<span class="dlg-port-out"></span>'
            +'</div>'
            +'</div>';
        return html;
    }

    // Preserve scroll position across re-renders
    const _prevScrollL=canvas.scrollLeft;
    const _prevScrollT=canvas.scrollTop;
    const _hadContent=canvas.querySelector('.dlg-scene')!==null;

    const sceneW=Math.max(canvas.clientWidth||900,maxX+200);
    const sceneH=Math.max(canvas.clientHeight||600,maxY+100);
    const zoomStyle=`transform:scale(${graphZoom/100});transform-origin:top left`;
    const _savedOvl=_detachFsOverlays();
    canvas.innerHTML=`<div class="dlg-scene" style="width:${sceneW}px;height:${sceneH}px;${zoomStyle}">
        <svg class="dlg-links" width="${sceneW}" height="${sceneH}">${lines.join('')}</svg>
        ${buildOpenerNode()}${buildNode('__hub__',true)}${nodeIds.map(id=>buildNode(id,false)).join('')}
    </div>`;
    _reattachFsOverlays(_savedOvl);
    ensureCanvasInteractions(); // wire wheel zoom + pan after canvas rebuilt
    requestAnimationFrame(()=>{
        if(_hadContent){
            // Restore previous scroll position (user was already viewing this graph)
            canvas.scrollLeft=_prevScrollL;
            canvas.scrollTop=_prevScrollT;
        } else if(d.layout&&d.layout['__opener__']&&canvas.clientWidth>50){
            // First render — center on opener
            const hubPos=d.layout['__opener__'];
            const scale=graphZoom/100;
            const centerX=hubPos.x*scale+110*scale-canvas.clientWidth/2;
            const centerY=hubPos.y*scale+100*scale-canvas.clientHeight/2;
            canvas.scrollLeft=Math.max(0,centerX);
            canvas.scrollTop=Math.max(0,centerY);
        }
        setTimeout(updateMinimap,20);
        // Recalculate SVG link positions from actual DOM port positions
        setTimeout(_recalcLinksFromDOM,50);
    });
}

// Recalculate link paths from actual DOM port positions (handles variable-height nodes)
function _recalcLinksFromDOM(){
    var canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    var scene=canvas.querySelector('.dlg-scene');
    if(!scene)return;
    var sceneRect=scene.getBoundingClientRect();
    var scale=graphZoom/100;
    if(!scale)return;
    var paths=scene.querySelectorAll('.dlg-links path[data-from]');
    paths.forEach(function(path){
        var fromId=path.getAttribute('data-from');
        var ci=parseInt(path.getAttribute('data-ci'))||0;
        var toId=path.getAttribute('data-to');
        var fromNode=scene.querySelector('.dlg-node[data-nid="'+CSS.escape(fromId)+'"]');
        var toNode=scene.querySelector('.dlg-node[data-nid="'+CSS.escape(toId)+'"]');
        if(!fromNode||!toNode)return;
        // Find source port-out: match by data-ci on the row, or fall back to nth row
        var portOut=null;
        var ciRow=fromNode.querySelector('.dlg-node-row[data-ci="'+ci+'"]');
        if(ciRow)portOut=ciRow.querySelector('.dlg-port-out');
        if(!portOut){
            var allRows=fromNode.querySelectorAll('.dlg-node-row[data-ci]');
            if(allRows[ci])portOut=allRows[ci].querySelector('.dlg-port-out');
        }
        if(!portOut){
            // Last resort: find any port-out
            var allPorts=fromNode.querySelectorAll('.dlg-port-out');
            if(allPorts.length)portOut=allPorts[Math.min(ci,allPorts.length-1)];
        }
        var portIn=toNode.querySelector('.dlg-port-in');
        if(!portOut||!portIn)return;
        var outRect=portOut.getBoundingClientRect();
        var inRect=portIn.getBoundingClientRect();
        if(outRect.width===0||inRect.width===0)return; // not visible
        var ox=(outRect.left+outRect.width/2-sceneRect.left)/scale;
        var oy=(outRect.top+outRect.height/2-sceneRect.top)/scale;
        var ix=(inRect.left+inRect.width/2-sceneRect.left)/scale;
        var iy=(inRect.top+inRect.height/2-sceneRect.top)/scale;
        var isBack=(ix<=ox);
        var ctrl=isBack?-80:60;
        path.setAttribute('d','M '+ox+' '+oy+' C '+(ox+ctrl)+' '+oy+', '+(ix-ctrl)+' '+iy+', '+ix+' '+iy);
    });
}

function renderDialogInsights(d,validationPack){
    const validation=document.getElementById('dialogValidation');
    if(validation){
        const pack=validationPack||collectDialogValidation(d);
        var hdr='<div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Node Errors</div>';
        validation.innerHTML=hdr+(pack.issues.length===0?'<span style="color:#4caf50;font-size:10px">✓ No issues.</span>':pack.issues.map(s=>`<div style="color:#f87171;font-size:10px">• ${esc(s)}</div>`).join(''));
    }
    const bval=document.getElementById('bindingValidation');
    if(bval){
        const bp=collectBindingValidation(d);
        var hdr='<div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Binding Validation</div>';
        if(!bp.issues.length){
            bval.innerHTML=hdr+'<span style="color:#4caf50;font-size:10px">✓ No issues.</span>';
        } else {
            bval.innerHTML=hdr+bp.issues.map(function(iss){
                var color=iss.level==='crash'?'#f87171':iss.level==='warn'?'#fbbf24':'#777';
                return '<div style="color:'+color+';font-size:10px">'+iss.msg+'</div>';
            }).join('');
        }
    }
    if(typeof syncGraphFsErrors==='function')syncGraphFsErrors();
    renderGraphEditor(d);
    syncDialogSimulator(d);
}

let dialogSimState=null;
let dialogSimHash='';

// ═══════════════════════════════════════════
// MAIN TAB: MERGED GRAPH VIEW
// ═══════════════════════════════════════════

// ── Parse prefixed node ID ──
// Custom: "0.__hub__" → {dlgIdx:0, nodeId:"__hub__"}
// Vanilla: "v_trade.__hub__" → {dlgIdx:-1, vanillaCat:"trade", nodeId:"__hub__"}
function _mainParseId(id){
    if(id==='__opener__')return{dlgIdx:-1,nodeId:'__opener__'};
    if(id.startsWith('v_')){
        const dot=id.indexOf('.',2);
        if(dot<0)return null;
        return{dlgIdx:-1,vanillaCat:id.substring(2,dot),nodeId:id.substring(dot+1)};
    }
    if(id.startsWith('tp_')){
        const dot=id.indexOf('.',3);
        if(dot<0)return null;
        return{dlgIdx:-1,taskPoolTag:id.substring(3,dot),nodeId:id.substring(dot+1)};
    }
    const dot=id.indexOf('.');
    if(dot<0)return null;
    return{dlgIdx:parseInt(id.substring(0,dot)),nodeId:id.substring(dot+1)};
}

// ── Edit helpers: route changes to correct dialog ──
function mainSetOpener(di,text){
    const d=getDlg();if(d&&d.dialogs&&d.dialogs[di])d.dialogs[di].opener=text;autoSave();
}
function mainSetNpc(di,nodeId,text){
    const d=getDlg();const t=d&&d.dialogs&&d.dialogs[di];if(!t)return;
    if(nodeId==='__hub__')t.hub=text;else{const n=(t.nodes||{})[nodeId];if(n)n.npc=text;}
    autoSave();
}
function mainSetChoiceText(di,nodeId,ci,text){
    const d=getDlg();const t=d&&d.dialogs&&d.dialogs[di];if(!t)return;
    const arr=nodeId==='__hub__'?(t.hubChoices||[]):(t.nodes&&t.nodes[nodeId]?t.nodes[nodeId].choices||[]:[]);
    if(arr[ci])arr[ci].text=text;autoSave();
}
function mainAddChild(prefId){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    curDlgTreeIdx=p.dlgIdx;addChild(p.nodeId);
}
function mainDeleteNode(prefId){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    if(p.nodeId==='__hub__'||p.nodeId==='__opener__')return;
    if(!confirm('Delete node '+p.nodeId+'? Choices pointing to it will redirect to Hub.'))return;
    curDlgTreeIdx=p.dlgIdx;graphPushUndo();
    flatDeleteNode(getCurTree(),p.nodeId);
    const dl=getDlg();if(dl&&dl.mainLayout)delete dl.mainLayout[prefId];
    autoSave();renderBranches();
}
function mainDeleteDialog(di){deleteDialogTree(di);}
function mainStripVanilla(catId){stripVanillaCat(catId);if(_mainTabActive){delete getDlg().mainLayout;renderBranches();}}
// ── Opener action menu ──
function mainShowOpenerActionMenu(di,btnEl){
    closeActionMenu();
    const dlg=getDlg();const t=dlg&&dlg.dialogs&&dlg.dialogs[di];if(!t)return;
    const popup=document.createElement('div');
    popup.className='action-picker';popup.id='actionPickerPopup';
    // Resolve all current opener bindings
    const _curPre=t.openerPrecondition||'';
    const _curST=t.openerScriptText||'';
    const _curAct=t.openerAction||'';
    let html='<div class="action-picker-title">Opener Bindings</div>';
    if(_curPre)html+='<div style="color:#ffb74d;font-size:10px;padding:2px 8px">⚙ '+esc(_curPre)+'</div>';
    if(_curST)html+='<div style="color:#ffb74d;font-size:10px;padding:2px 8px">📝 '+esc(_curST)+'</div>';
    if(_curAct)html+='<div style="color:#ffb74d;font-size:10px;padding:2px 8px">▶ '+esc(_curAct)+'</div>';
    if(_curPre||_curST||_curAct){
        html+='<button class="action-opt clear" onclick="mainClearOpenerBindings('+di+')">&#10005; Clear All</button>';
        html+='<div style="border-top:1px solid #333;margin:2px 0"></div>';
    }
    const archB=buildArchBindings();
    // Preconditions
    if(archB.preconditions.length){
        html+='<div style="padding:4px 8px 2px;font-size:9px;color:#aaa">PRECONDITIONS</div>';
        archB.preconditions.forEach(function(p){
            var cur=_curPre===p.id;
            html+='<button class="action-opt'+(cur?' current':'')+'" onclick="mainSetOpenerBinding('+di+',\'openerPrecondition\',\''+esc(p.id)+'\')">'+esc(p.label)+'</button>';
        });
    }
    // Script Text
    if(archB.scriptTexts&&archB.scriptTexts.length){
        html+='<div style="border-top:1px solid #333;padding:4px 8px 2px;font-size:9px;color:#aaa">SCRIPT TEXT</div>';
        archB.scriptTexts.forEach(function(st){
            var cur=_curST===st.id;
            html+='<button class="action-opt'+(cur?' current':'')+'" onclick="mainSetOpenerBinding('+di+',\'openerScriptText\',\''+esc(st.id)+'\')">'+esc(st.label)+'</button>';
        });
    }
    // Actions (DIALOG_ACTIONS + ARCH bindings)
    html+='<div style="border-top:1px solid #333;padding:4px 8px 2px;font-size:9px;color:#aaa">ACTIONS</div>';
    var _activeSpecs=getActiveSpecializations();
    DIALOG_ACTIONS.forEach(function(a){
        if(!a.id)return;
        if(a.spec&&!_activeSpecs.includes(a.spec))return;
        var isCurrent=_curAct===a.id;
        var catLabel=a.category?' <span style="color:#999;font-size:9px">['+a.category+']</span>':'';
        html+='<button class="action-opt'+(isCurrent?' current':'')+'" onclick="mainSetOpenerAction('+di+',\''+esc(a.id)+'\')" title="'+esc(a.note||'')+'">'+esc(a.label)+catLabel+'</button>';
    });
    if(archB.actions.length){
        var _lag='';
        archB.actions.forEach(function(a){
            if(a.group!==_lag){if(_lag)html+='</optgroup>';html+='<div style="border-top:1px solid #333;padding:1px 8px;font-size:9px;color:#82b1ff">'+esc(a.group)+'</div>';_lag=a.group;}
            var isCurrent=_curAct===a.id;
            html+='<button class="action-opt'+(isCurrent?' current':'')+'" onclick="mainSetOpenerAction('+di+',\''+esc(a.id)+'\')">'+esc(a.label)+'</button>';
        });
    }
    popup.innerHTML=html;
    getPopupParent().appendChild(popup);
    var rect=btnEl.getBoundingClientRect();
    popup.style.position='fixed';
    popup.style.left=Math.min(rect.left,window.innerWidth-260)+'px';
    popup.style.top=Math.min(rect.bottom+4,window.innerHeight-popup.offsetHeight-8)+'px';
    popup.style.zIndex='9999';
    setTimeout(function(){document.addEventListener('click',_closeActionOnOutside,{once:true,capture:true});},10);
}
function mainSetOpenerAction(di,action){
    closeActionMenu();
    var dlg=getDlg();var t=dlg&&dlg.dialogs&&dlg.dialogs[di];if(!t)return;
    if(action)t.openerAction=action;else delete t.openerAction;
    autoSave();renderBranches();
}
function mainSetOpenerBinding(di,field,val){
    closeActionMenu();
    var dlg=getDlg();var t=dlg&&dlg.dialogs&&dlg.dialogs[di];if(!t)return;
    if(val)t[field]=val;else delete t[field];
    autoSave();renderBranches();
}
function mainClearOpenerBindings(di){
    closeActionMenu();
    var dlg=getDlg();var t=dlg&&dlg.dialogs&&dlg.dialogs[di];if(!t)return;
    delete t.openerPrecondition;delete t.openerScriptText;delete t.openerAction;
    autoSave();renderBranches();
}
function mainShowVanillaOpenerActionMenu(catId,btnEl){
    closeActionMenu();
    var vt=getVanillaTree(catId);if(!vt)return;
    var popup=document.createElement('div');
    popup.className='action-picker';popup.id='actionPickerPopup';
    var html='<div class="action-picker-title">Vanilla Opener Action</div>';
    if(vt.openerAction){
        var names=String(vt.openerAction).split(';').map(function(a){var at=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===at;});return def?def.label:at;}).join(' + ');
        html+='<div style="color:#ffb347;font-size:10px;padding:4px 8px;border-bottom:1px solid #333">'+esc(names)+'</div>';
        html+='<button class="action-opt clear" onclick="mainSetVanillaOpenerAction(\''+esc(catId)+'\',\'\')">&#10005; Remove Action</button>';
        html+='<div style="border-top:1px solid #333;margin:2px 0"></div>';
    }
    var _activeSpecs=getActiveSpecializations();
    DIALOG_ACTIONS.forEach(function(a){
        if(!a.id)return;
        if(a.spec&&!_activeSpecs.includes(a.spec))return;
        var isCurrent=vt.openerAction&&vt.openerAction===a.id;
        var catLabel=a.category?' <span style="color:#999;font-size:9px">['+a.category+']</span>':'';
        html+='<button class="action-opt'+(isCurrent?' current':'')+'" onclick="mainSetVanillaOpenerAction(\''+esc(catId)+'\',\''+esc(a.id)+'\')" title="'+esc(a.note||'')+'">'+esc(a.label)+catLabel+'</button>';
    });
    popup.innerHTML=html;
    getPopupParent().appendChild(popup);
    var rect=btnEl.getBoundingClientRect();
    popup.style.position='fixed';
    popup.style.left=Math.min(rect.left,window.innerWidth-260)+'px';
    popup.style.top=Math.min(rect.bottom+4,window.innerHeight-popup.offsetHeight-8)+'px';
    popup.style.zIndex='9999';
    setTimeout(function(){document.addEventListener('click',_closeActionOnOutside,{once:true,capture:true});},10);
}
function mainSetVanillaOpenerAction(catId,action){
    closeActionMenu();
    var vt=getVanillaTree(catId);if(!vt)return;
    if(action)vt.openerAction=action;else delete vt.openerAction;
    autoSave();renderBranches();
}
// ── Vanilla node edit helpers ──
function mainVanillaSetNpc(catId,nodeId,text){
    var t=getVanillaTree(catId);if(!t)return;
    if(nodeId==='__hub__')t.hub=text;else{var n=(t.nodes||{})[nodeId];if(n)n.npc=text;}
    autoSave();
}
function mainVanillaSetChoiceText(catId,nodeId,ci,text){
    var t=getVanillaTree(catId);if(!t)return;
    var arr=nodeId==='__hub__'?(t.hubChoices||[]):(t.nodes&&t.nodes[nodeId]?t.nodes[nodeId].choices||[]:[]);
    if(arr[ci])arr[ci].text=text;autoSave();
}
function mainVanillaAddChild(prefId){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat)return;
    curVanillaCat=p.vanillaCat;curDlgTreeIdx=0;
    addChild(p.nodeId);curVanillaCat=null;
}
function mainVanillaDeleteNode(prefId){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat)return;
    if(p.nodeId==='__hub__')return;
    if(!confirm('Delete node '+p.nodeId+'?'))return;
    curVanillaCat=p.vanillaCat;
    var t=getCurTree();if(!t)return;
    graphPushUndo();flatDeleteNode(t,p.nodeId);
    curVanillaCat=null;
    var dl=getDlg();if(dl&&dl.mainLayout)delete dl.mainLayout[prefId];
    autoSave();renderBranches();
}
function mainVanillaOpenAddMenu(prefId,btnEl){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat)return;
    curVanillaCat=p.vanillaCat;openNodeAddMenu(p.nodeId,btnEl);
}
function mainVanillaShowActionMenu(prefId,ci,btnEl){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat)return;
    curVanillaCat=p.vanillaCat;showActionMenu(p.nodeId,ci,btnEl);
}
function mainVanillaShowLinkMenu(prefId,ci,btnEl){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat)return;
    curVanillaCat=p.vanillaCat;showMiniLinkMenu(p.nodeId,ci,btnEl);
}
function mainVanillaConfirmRowDelete(prefId,ci){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat)return;
    curVanillaCat=p.vanillaCat;confirmRowDelete(p.nodeId,ci);
}
function mainVanillaHandleRowKeydown(prefId,ci,e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mainVanillaAddChild(prefId);return;}
}
function mainVanillaStartNodeRename(titleEl,prefId){
    var p=_mainParseId(prefId);if(!p||!p.vanillaCat||p.nodeId==='__hub__')return;
    curVanillaCat=p.vanillaCat;
    var n=getCurTree()?.nodes?.[p.nodeId];if(!n)return;
    titleEl.contentEditable='true';titleEl.textContent=n.label||'';titleEl.focus();
    var range=document.createRange();range.selectNodeContents(titleEl);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    var finish=function(){titleEl.contentEditable='false';n.label=titleEl.textContent.trim();curVanillaCat=null;autoSave();renderBranches();};
    titleEl.onblur=finish;
    titleEl.onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();titleEl.blur();}if(ev.key==='Escape'){titleEl.textContent=n.label||'';titleEl.blur();}};
}

// ── Task pool helpers for Main graph ──
function mainTaskPoolSetNpc(tag,nodeId,text){
    var t=getTaskPoolTree(tag);if(!t)return;
    if(nodeId==='__hub__')t.hub=text;else{var n=(t.nodes||{})[nodeId];if(n)n.npc=text;}
    autoSave();
}
function mainTaskPoolSetChoiceText(tag,nodeId,ci,text){
    var t=getTaskPoolTree(tag);if(!t)return;
    var arr=nodeId==='__hub__'?(t.hubChoices||[]):(t.nodes&&t.nodes[nodeId]?t.nodes[nodeId].choices||[]:[]);
    if(arr[ci])arr[ci].text=text;autoSave();
}
function mainTaskPoolAddChild(prefId){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag)return;
    curTaskPoolTag=p.taskPoolTag;curDlgTreeIdx=0;
    addChild(p.nodeId);curTaskPoolTag=null;
}
function mainTaskPoolDeleteNode(prefId){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag)return;
    if(p.nodeId==='__hub__')return;
    if(!confirm('Delete node '+p.nodeId+'?'))return;
    curTaskPoolTag=p.taskPoolTag;
    var t=getCurTree();if(!t)return;
    graphPushUndo();flatDeleteNode(t,p.nodeId);
    curTaskPoolTag=null;
    var dl=getDlg();if(dl&&dl.mainLayout)delete dl.mainLayout[prefId];
    autoSave();renderBranches();
}
function mainTaskPoolOpenAddMenu(prefId,btnEl){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag)return;
    curTaskPoolTag=p.taskPoolTag;openNodeAddMenu(p.nodeId,btnEl);
}
function mainTaskPoolShowActionMenu(prefId,ci,btnEl){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag)return;
    curTaskPoolTag=p.taskPoolTag;showActionMenu(p.nodeId,ci,btnEl);
}
function mainTaskPoolShowLinkMenu(prefId,ci,btnEl){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag)return;
    curTaskPoolTag=p.taskPoolTag;showMiniLinkMenu(p.nodeId,ci,btnEl);
}
function mainTaskPoolConfirmRowDelete(prefId,ci){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag)return;
    curTaskPoolTag=p.taskPoolTag;confirmRowDelete(p.nodeId,ci);
}
function mainTaskPoolHandleRowKeydown(prefId,ci,e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mainTaskPoolAddChild(prefId);return;}
}
function mainTaskPoolStartNodeRename(titleEl,prefId){
    var p=_mainParseId(prefId);if(!p||!p.taskPoolTag||p.nodeId==='__hub__')return;
    curTaskPoolTag=p.taskPoolTag;
    var n=getCurTree()?.nodes?.[p.nodeId];if(!n)return;
    titleEl.contentEditable='true';titleEl.textContent=n.label||'';titleEl.focus();
    var range=document.createRange();range.selectNodeContents(titleEl);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    var finish=function(){titleEl.contentEditable='false';n.label=titleEl.textContent.trim();curTaskPoolTag=null;autoSave();renderBranches();};
    titleEl.onblur=finish;
    titleEl.onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();titleEl.blur();}if(ev.key==='Escape'){titleEl.textContent=n.label||'';titleEl.blur();}};
}
function mainShowTaskPoolOpenerActionMenu(tag,btnEl){
    closeActionMenu();
    var tt=getTaskPoolTree(tag);if(!tt)return;
    var popup=document.createElement('div');
    popup.className='action-picker';popup.id='actionPickerPopup';
    var html='<div class="action-picker-title">Task Pool Opener Action</div>';
    if(tt.openerAction){
        var names=String(tt.openerAction).split(';').map(function(a){var at=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===at;});return def?def.label:at;}).join(' + ');
        html+='<div style="color:#82b1ff;font-size:10px;padding:4px 8px;border-bottom:1px solid #333">'+esc(names)+'</div>';
        html+='<button class="action-opt clear" onclick="mainSetTaskPoolOpenerAction(\''+esc(tag)+'\',\'\')">&#10005; Remove Action</button>';
        html+='<div style="border-top:1px solid #333;margin:2px 0"></div>';
    }
    DIALOG_ACTIONS.forEach(function(a){
        html+='<button class="action-opt" onclick="mainSetTaskPoolOpenerAction(\''+esc(tag)+'\',\''+esc(a.id)+'\')">'+esc(a.label)+'</button>';
    });
    popup.innerHTML=html;
    btnEl.parentElement.appendChild(popup);
    requestAnimationFrame(function(){document.addEventListener('mousedown',function _h(e2){if(!popup.contains(e2.target)){popup.remove();document.removeEventListener('mousedown',_h);}});});
}
function mainSetTaskPoolOpenerAction(tag,actionId){
    closeActionMenu();
    var tt=getTaskPoolTree(tag);if(!tt)return;
    tt.openerAction=actionId||'';
    autoSave();renderBranches();
}

// ── Opener "more options" menu (Add Opener with pre-configured content) ──
function mainOpenOpenerAddMenu(btnEl){
    closeNodeAddMenu();closeLinkPicker();
    var popup=document.createElement('div');
    popup.className='node-add-menu';popup.id='nodeAddMenuPopup';
    var addOpt=function(label,cls,fn){
        var b=document.createElement('button');b.className='node-add-opt '+cls;b.textContent=label;
        b.addEventListener('click',function(e){e.stopPropagation();fn();});popup.appendChild(b);
    };
    addOpt('\uD83D\uDCAC Add Empty Opener','response',function(){closeNodeAddMenu();addDialogTree();});
    var tasks=getTaskList();
    if(tasks.length){
        var sep=document.createElement('div');sep.className='node-add-opt sep';sep.textContent='\u2014 New Dialog with Task \u2014';popup.appendChild(sep);
        tasks.forEach(function(t){
            var lbl={fetch:'\uD83D\uDCE6',deliver:'\uD83D\uDCEC',kill:'\uD83D\uDC80'}[t.type]||'\uD83D\uDCCB';
            addOpt(lbl+' '+(t.openingDialogue||t.id),'task',function(){
                closeNodeAddMenu();addDialogTree();
                addTaskResponse('__hub__',t.id,t.openingDialogue||t.id);
            });
        });
    }
    var specs=getActiveSpecializations();
    if(specs.length){
        var sep2=document.createElement('div');sep2.className='node-add-opt sep';sep2.textContent='\u2014 New Dialog with Service \u2014';popup.appendChild(sep2);
        specs.forEach(function(specId){
            var def=SPECIALIZATION_DEFS.find(function(d){return d.id===specId;});
            if(!def)return;
            addOpt('\uD83D\uDD27 '+def.label,'response',function(){
                closeNodeAddMenu();addDialogTree();
                // Trigger the same spec service logic via the node add menu on the new dialog's hub
                curDlgTreeIdx=getDlg().dialogs.length-1;
                var hubBtn=document.querySelector('.dlg-node[data-nid="__opener__"]');
                // Just add the spec response directly
                graphPushUndo();var d=getCurTree();var childId=flatCreateNode(d);
                if(specId==='cook'){d.nodes[childId]={npc:'Show me what you want cooked.',label:'Cook Service',choices:[{text:'[Player selects ingredient]',next:'__hub__'},{text:'Never mind.',next:'__hub__'}]};}
                else if(specId==='informant'){var sId=flatCreateNode(d);d.nodes[sId]={npc:'[Informant provides stalker intel]',label:'Stalker Lead',choices:[{text:'Any other leads?',next:childId},{text:'Thanks.',next:'__hub__'}]};var mId=flatCreateNode(d);d.nodes[mId]={npc:'[Informant provides mutant intel]',label:'Mutant Lead',choices:[{text:'Any other leads?',next:childId},{text:'Thanks.',next:'__hub__'}]};d.nodes[childId]={npc:'What kind of lead do you need?',label:'Informant Service',choices:[{text:'Any stalker sightings?',next:sId},{text:'Any mutant activity?',next:mId},{text:'Never mind.',next:'__hub__'}]};}
                else{d.nodes[childId]={npc:def.serviceAction||'[Service UI opens]',label:def.label,choices:[{text:'Thanks.',next:'__hub__'},{text:'Never mind.',next:'__hub__'}]};}
                d.hubChoices=d.hubChoices||[];d.hubChoices.push({text:def.serviceLabel,next:childId});
                autoSave();renderBranches();
            });
        });
    }
    popup.style.visibility='hidden';
    getPopupParent().appendChild(popup);
    var rect=btnEl.getBoundingClientRect();
    var pw=popup.offsetWidth||200,ph=popup.offsetHeight||120;
    var left=rect.left,top=rect.bottom+4;
    if(left+pw>window.innerWidth-8)left=window.innerWidth-pw-8;
    if(top+ph>window.innerHeight-8)top=rect.top-ph-4;
    popup.style.left=left+'px';popup.style.top=top+'px';popup.style.visibility='';
    setTimeout(function(){document.addEventListener('click',_closeNodeAddOnOutside,{once:true,capture:true});},10);
}
function mainOpenAddMenu(prefId,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    curDlgTreeIdx=p.dlgIdx;openNodeAddMenu(p.nodeId,btnEl);
}
function mainShowActionMenu(prefId,ci,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    curDlgTreeIdx=p.dlgIdx;showActionMenu(p.nodeId,ci,btnEl);
}
function mainShowNodeBindingMenu(prefId,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    curDlgTreeIdx=p.dlgIdx;showNodeBindingMenu(p.nodeId,btnEl);
}
function mainShowLinkMenu(prefId,ci,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    curDlgTreeIdx=p.dlgIdx;showMiniLinkMenu(p.nodeId,ci,btnEl);
}
function mainConfirmRowDelete(prefId,ci){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    curDlgTreeIdx=p.dlgIdx;confirmRowDelete(p.nodeId,ci);
}
function mainHandleRowKeydown(prefId,ci,e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mainAddChild(prefId);return;}
    if(e.key==='Tab'&&!e.shiftKey){
        e.preventDefault();
        const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
        curDlgTreeIdx=p.dlgIdx;
        const d=getCurTree();
        const choices=(p.nodeId==='__hub__')?(d.hubChoices||[]):(d.nodes[p.nodeId]?.choices||[]);
        const ch=choices[ci];if(!ch)return;
        const targetId=ch.next;if(!targetId||targetId==='__end__')return;
        const tgtPref=targetId==='__hub__'?p.dlgIdx+'.__hub__':p.dlgIdx+'.'+targetId;
        const tgtNode=document.querySelector('.dlg-node[data-nid="'+tgtPref+'"] .dlg-node-npc');
        if(tgtNode)tgtNode.focus();
    }
}
function mainStartNodeRename(titleEl,prefId){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0||p.nodeId==='__hub__')return;
    curDlgTreeIdx=p.dlgIdx;
    const n=getCurTree()?.nodes?.[p.nodeId];if(!n)return;
    titleEl.contentEditable='true';
    titleEl.textContent=n.label||'';
    titleEl.focus();
    const range=document.createRange();range.selectNodeContents(titleEl);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    const finish=()=>{titleEl.contentEditable='false';n.label=titleEl.textContent.trim();autoSave();renderBranches();};
    titleEl.onblur=finish;
    titleEl.onkeydown=(ev)=>{if(ev.key==='Enter'){ev.preventDefault();titleEl.blur();}if(ev.key==='Escape'){titleEl.textContent=n.label||'';titleEl.blur();}};
}

// ── Auto-layout for merged view ──
function applyMainLayout(dlg){
    const layout=dlg.mainLayout=dlg.mainLayout||{};
    const dialogs=dlg.dialogs||[];
    const X_STEP=310,X0=20,Y0=20;
    layout['__opener__']={x:X0,y:Y0};
    let curY=Y0;
    function layoutTree(pfx,t){
        const hubH=_estimateNodeHeight('__hub__',t);
        if(!layout[pfx+'__hub__'])layout[pfx+'__hub__']={x:X0+X_STEP,y:curY};
        const nodes=t.nodes||{};
        const dep={};const queue=['__hub__'];dep['__hub__']=0;
        while(queue.length){
            const id=queue.shift();
            const choices=(id==='__hub__')?(t.hubChoices||[]):(nodes[id]?.choices||[]);
            choices.forEach(ch=>{
                if(!ch.next||ch.next==='__hub__'||ch.next==='__end__')return;
                if(dep[ch.next]===undefined){dep[ch.next]=dep[id]+1;queue.push(ch.next);}
            });
        }
        const maxD=Object.values(dep).length?Math.max(...Object.values(dep)):0;
        Object.keys(nodes).forEach(id=>{if(dep[id]===undefined)dep[id]=maxD+1;});
        const byDep={};
        Object.keys(nodes).forEach(id=>{const d2=dep[id]||0;byDep[d2]=byDep[d2]||[];byDep[d2].push(id);});
        let maxColH=hubH;
        Object.entries(byDep).forEach(([d2,ids])=>{
            let y=curY;
            ids.forEach(id=>{
                if(!layout[pfx+id]){
                    // Find max Y among already-positioned nodes in same column
                    let placeY=curY;
                    ids.forEach(oid=>{if(layout[pfx+oid]&&(dep[oid]||0)===(dep[id]||0))placeY=Math.max(placeY,layout[pfx+oid].y+_estimateNodeHeight(oid,t));});
                    layout[pfx+id]={x:X0+(Number(d2)+2)*X_STEP,y:placeY};
                }
                y=Math.max(y,layout[pfx+id].y+_estimateNodeHeight(id,t));
            });
            maxColH=Math.max(maxColH,y-curY);
        });
        curY+=maxColH+40;
    }
    dialogs.forEach((t,i)=>layoutTree(i+'.',t));
    // Vanilla trees
    const s=getD('settings')||{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
    STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id)).forEach(cat=>{
        const vt=getVanillaTree(cat.id);
        if(vt)layoutTree('v_'+cat.id+'.',vt);
    });
    // Task pool trees (custom pools only)
    const cPools=Array.isArray(dlg.customPools)?dlg.customPools:[];
    cPools.forEach(pool=>{
        const pt=(pool.dialogTrees&&pool.dialogTrees[0])||pool.dialogTree;
        if(pt)layoutTree('tp_'+pool.tag+'.',pt);
    });
}

let _mainGraphScroll={l:0,t:0,valid:false};
// ── Main graph renderer ──
function renderMainGraphEditor(){
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    // Save scroll before anything else
    if(canvas.querySelector('.dlg-scene')){_mainGraphScroll={l:canvas.scrollLeft,t:canvas.scrollTop,valid:true};}
    const dlg=getDlg();
    if(!dlg||!dlg.dialogs||!dlg.dialogs.length)return;
    const dialogs=dlg.dialogs;

    // Vanilla categories
    const s=getD('settings')||{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
    const vanillaCats=STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id));
    const vanillaTrees={};
    vanillaCats.forEach(cat=>{vanillaTrees[cat.id]=getVanillaTree(cat.id);});

    // Task pools (custom only)
    const taskPools=Array.isArray(dlg.customPools)?dlg.customPools.filter(p=>p.dialogTrees?.length||p.dialogTree):[];
    const taskPoolTrees={};
    taskPools.forEach(pool=>{taskPoolTrees[pool.tag]=(pool.dialogTrees&&pool.dialogTrees[0])||pool.dialogTree;});

    // Reset on archetype change
    const _archKey=(editMode==='solo')?('solo:'+curSolo):(editMode==='char'?'char:'+curGrp+':'+curChar:'grp:'+curGrp);
    const _archChanged=_archKey!==_lastGraphArchKey;
    if(_archChanged){
        _lastGraphArchKey=_archKey;
        graphZoom=100;canvas.scrollLeft=0;canvas.scrollTop=0;
        _mainGraphScroll={l:0,t:0,valid:false};
        const _lbl=document.getElementById('graphZoomLabel');
        if(_lbl)_lbl.textContent='100%  Shift+scroll to zoom';
        const _sc=canvas.querySelector('.dlg-scene');
        if(_sc){_sc.style.transform='scale(1)';_sc.style.transformOrigin='top left';}
    }

    if(!dlg.mainLayout)dlg.mainLayout={};
    const layout=dlg.mainLayout;

    // Check if layout needs init
    let needsLayout=!layout['__opener__'];
    if(!needsLayout){
        for(let i=0;i<dialogs.length;i++){
            if(!layout[i+'.__hub__']){needsLayout=true;break;}
            const nk=Object.keys(dialogs[i].nodes||{});
            for(let j=0;j<nk.length;j++){if(!layout[i+'.'+nk[j]]){needsLayout=true;break;}}
            if(needsLayout)break;
        }
        if(!needsLayout){
            for(let vi=0;vi<vanillaCats.length;vi++){
                const vp='v_'+vanillaCats[vi].id+'.';
                if(!layout[vp+'__hub__']){needsLayout=true;break;}
                const vt=vanillaTrees[vanillaCats[vi].id];
                if(vt){const vnk=Object.keys(vt.nodes||{});for(let j=0;j<vnk.length;j++){if(!layout[vp+vnk[j]]){needsLayout=true;break;}}}
                if(needsLayout)break;
            }
        }
        if(!needsLayout){
            for(let ti=0;ti<taskPools.length;ti++){
                const tpp='tp_'+taskPools[ti].tag+'.';
                if(!layout[tpp+'__hub__']){needsLayout=true;break;}
                const tt=taskPoolTrees[taskPools[ti].tag];
                if(tt){const tnk=Object.keys(tt.nodes||{});for(let j=0;j<tnk.length;j++){if(!layout[tpp+tnk[j]]){needsLayout=true;break;}}}
                if(needsLayout)break;
            }
        }
    }
    if(needsLayout)applyMainLayout(dlg);

    // Reachability per tree (custom + vanilla)
    const reachable=new Set();
    function bfsTree(pfx,t){
        const hubId=pfx+'__hub__';reachable.add(hubId);
        const bfsQ=[hubId];
        while(bfsQ.length){
            const cur=bfsQ.shift();
            let choices;
            if(cur===hubId)choices=t.hubChoices||[];
            else{const nid=cur.substring(pfx.length);const n=(t.nodes||{})[nid];choices=n?n.choices||[]:[];}
            choices.forEach(ch=>{
                if(!ch.next||ch.next==='__hub__'||ch.next==='__end__')return;
                const fullNext=pfx+ch.next;
                if(!reachable.has(fullNext)&&(t.nodes||{})[ch.next]){reachable.add(fullNext);bfsQ.push(fullNext);}
            });
        }
    }
    dialogs.forEach((t,i)=>bfsTree(i+'.',t));
    vanillaCats.forEach(cat=>{const vt=vanillaTrees[cat.id];if(vt)bfsTree('v_'+cat.id+'.',vt);});
    taskPools.forEach(pool=>{const tt=taskPoolTrees[pool.tag];if(tt)bfsTree('tp_'+pool.tag+'.',tt);});

    const NW=220,NH=28,NN=44,NR=30;
    const lines=[];
    let maxX=0,maxY=0;

    function drawLink(fromId,ci,toId){
        const fp=layout[fromId]||{x:0,y:0};
        const tp=layout[toId];if(!tp)return;
        const fromNN=(fromId==='__opener__')?0:NN; // opener has no NPC text area
        const ox=fp.x+NW-10,oy=fp.y+NH+fromNN+ci*NR+NR/2;
        const ix=tp.x,iy=tp.y+NH/2;
        const isBack=(tp.x<=fp.x);
        const ctrl=isBack?-80:60;
        lines.push('<path class="dlg-link'+(isBack?' dlg-link-back':'')+'" data-from="'+fromId+'" data-ci="'+ci+'" data-to="'+toId+'" d="M '+ox+' '+oy+' C '+(ox+ctrl)+' '+oy+', '+(ix-ctrl)+' '+iy+', '+ix+' '+iy+'"/>');
        maxY=Math.max(maxY,Math.max(oy,iy)+20);
    }

    // Draw links for a tree
    function drawTreeLinks(pfx,t){
        const hubId=pfx+'__hub__';
        const hubPos=layout[hubId]||{x:0,y:0};
        maxX=Math.max(maxX,hubPos.x+NW+20);
        (t.hubChoices||[]).forEach((ch,ci)=>{
            if(!ch.next||ch.next==='__hub__'||ch.next==='__end__')return;
            if(layout[pfx+ch.next])drawLink(hubId,ci,pfx+ch.next);
        });
        maxY=Math.max(maxY,hubPos.y+NH+NN+Math.max(1,(t.hubChoices||[]).length)*NR+60);
        Object.entries(t.nodes||{}).forEach(([nid,n])=>{
            const fullId=pfx+nid;const pos=layout[fullId]||{x:0,y:0};
            maxX=Math.max(maxX,pos.x+NW+20);
            (n.choices||[]).forEach((ch,ci)=>{
                if(!ch.next||ch.next==='__hub__'||ch.next==='__end__')return;
                if(layout[pfx+ch.next])drawLink(fullId,ci,pfx+ch.next);
            });
            maxY=Math.max(maxY,pos.y+NH+NN+Math.max(1,(n.choices||[]).length)*NR+60);
        });
    }

    // Opener → hub links (custom + vanilla + task pools)
    const totalOpenerRows=dialogs.length+vanillaCats.length+taskPools.length;
    let openerCi=0;
    dialogs.forEach((t,i)=>{
        if(layout[i+'.__hub__'])drawLink('__opener__',openerCi,i+'.__hub__');
        openerCi++;
    });
    vanillaCats.forEach(cat=>{
        const vp='v_'+cat.id+'.__hub__';
        if(layout[vp])drawLink('__opener__',openerCi,vp);
        openerCi++;
    });
    taskPools.forEach(pool=>{
        const tpp='tp_'+pool.tag+'.__hub__';
        if(layout[tpp])drawLink('__opener__',openerCi,tpp);
        openerCi++;
    });
    {const op=layout['__opener__']||{x:0,y:0};
     maxX=Math.max(maxX,op.x+NW+20);
     maxY=Math.max(maxY,op.y+NH+NN+Math.max(1,totalOpenerRows)*NR+60);}

    // Tree links (custom + vanilla + task pools)
    dialogs.forEach((t,i)=>drawTreeLinks(i+'.',t));
    vanillaCats.forEach(cat=>{const vt=vanillaTrees[cat.id];if(vt)drawTreeLinks('v_'+cat.id+'.',vt);});
    taskPools.forEach(pool=>{const tt=taskPoolTrees[pool.tag];if(tt)drawTreeLinks('tp_'+pool.tag+'.',tt);});

    // ── Build opener node ──
    function buildMainOpener(){
        const pos=layout['__opener__']||{x:0,y:0};
        let rowsHtml='';let ri=0;
        // Custom opener rows
        dialogs.forEach((t,i)=>{
            const opText=String(t.opener||'').trim();
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const _opHasBind=!!(t.openerAction||t.openerPrecondition||t.openerScriptText);
            const actionTip=[t.openerPrecondition?'⚙ '+t.openerPrecondition:'',t.openerScriptText?'📝 '+t.openerScriptText:'',t.openerAction?'▶ '+t.openerAction:''].filter(Boolean).join('\n');
            rowsHtml+='<div class="dlg-node-row'+(_opHasBind?' has-action':'')+'" data-ci="'+ri+'"'+(actionTip?' title="'+esc(actionTip)+'"':'')+'>'
                +'<div class="dlg-node-row-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Opener text..."'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +' oninput="mainSetOpener('+i+',this.textContent)"'
                +'>'+opEsc+'</div>'
                +'<button class="dlg-action-btn'+(_opHasBind?' active':'')+'" title="'+(_opHasBind?esc(actionTip):'Add bindings')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainShowOpenerActionMenu('+i+',this)">&#9889;</button>'
                +(dialogs.length>1?'<button class="dlg-del-row" title="Delete dialog" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainDeleteDialog('+i+')">&#10005;</button>':'')
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
            ri++;
        });
        // Vanilla opener rows
        vanillaCats.forEach(cat=>{
            const vt=vanillaTrees[cat.id];
            const opText=vt?String(vt.opener||'').trim():cat.label;
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const vAction=vt&&vt.openerAction?String(vt.openerAction):'';
            const vActionTip=vAction?String(vAction).split(';').map(function(a){var at=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===at;});return def?def.label:at;}).join(' + '):'';
            rowsHtml+='<div class="dlg-node-row'+(vAction?' has-action':'')+'" data-ci="'+ri+'" style="border-left:2px solid #ffe082"'+(vActionTip?' title="'+esc(vActionTip)+'"':'')+'>'
                +'<div class="dlg-node-row-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Vanilla opener..." style="color:#ffe082"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +' oninput="(function(el){var vt=getVanillaTree(\''+esc(cat.id)+'\');if(vt)vt.opener=el.textContent;autoSave();})(this)"'
                +'>'+opEsc+'</div>'
                +'<button class="dlg-action-btn'+(vAction?' active':'')+'" title="'+(vAction?esc(vActionTip):'Add action')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainShowVanillaOpenerActionMenu(\''+esc(cat.id)+'\',this)">&#9889;</button>'
                +'<button class="dlg-del-row" title="Strip '+esc(cat.label)+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainStripVanilla(\''+esc(cat.id)+'\')">&#10005;</button>'
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
            ri++;
        });
        // Task pool opener rows
        taskPools.forEach(pool=>{
            const tt=taskPoolTrees[pool.tag];
            const opText=tt?String(tt.opener||'').trim():pool.tag;
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const tAction=tt&&tt.openerAction?String(tt.openerAction):'';
            const tActionTip=tAction?String(tAction).split(';').map(function(a){var at=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===at;});return def?def.label:at;}).join(' + '):'';
            rowsHtml+='<div class="dlg-node-row'+(tAction?' has-action':'')+'" data-ci="'+ri+'" style="border-left:2px solid #82b1ff"'+(tActionTip?' title="'+esc(tActionTip)+'"':'')+'>'
                +'<div class="dlg-node-row-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Task pool opener..." style="color:#82b1ff"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +' oninput="(function(el){var tt=getTaskPoolTree(\''+esc(pool.tag)+'\');if(tt)tt.opener=el.textContent;autoSave();})(this)"'
                +'>'+opEsc+'</div>'
                +'<button class="dlg-action-btn'+(tAction?' active':'')+'" title="'+(tAction?esc(tActionTip):'Add action')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainShowTaskPoolOpenerActionMenu(\''+esc(pool.tag)+'\',this)">&#9889;</button>'
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
            ri++;
        });
        rowsHtml+='<div class="dlg-node-add-row">'
            +'<button class="dlg-add-direct" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();addDialogTree()">+ Add Opener</button>'
            +'<button class="dlg-add-menu-btn" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainOpenOpenerAddMenu(this)" title="More options">&#9662;</button>'
            +'</div>';
        const _opHasBindings=dlg.openerPrecondition||dlg.openerAction||dlg.openerScriptText;
        const helloText=String(dlg.openerNpc||'').trim();
        return '<div class="dlg-node opener-node'+(selectedBranchPath==='__opener__'?' selected':'')+'" data-nid="__opener__" style="left:'+pos.x+'px;top:'+pos.y+'px" onclick="selectBranch(\'__opener__\')">'
            +'<div class="dlg-node-header opener-header" style="position:relative" onpointerdown="startGraphDrag(\'__opener__\',event)">'
            +'<span class="dlg-node-title">&#9654; OPENER</span>'
            +'<button class="dlg-action-btn dlg-node-bind-btn'+(_opHasBindings?' active':'')+'" style="margin-left:auto;flex-shrink:0" title="'+(_opHasBindings?'Edit opener bindings':'Add opener binding')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();showNodeBindingMenu(\'__opener__\',this)">&#9889;</button>'
            +'</div>'
            +'<div class="dlg-node-npc" contenteditable="true" spellcheck="false"'
            +' data-placeholder="NPC hello response..."'
            +' style="border-bottom:1px solid #333;color:#aaa;font-style:italic"'
            +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation();selectBranch(\'__opener__\',true)"'
            +' oninput="(function(el){getDlg().openerNpc=el.textContent;autoSave();})(this)"'
            +'>'+esc(helloText)+'</div>'
            +rowsHtml
            +'</div>';
    }

    // ── Build hub or regular node (custom dialog) ──
    function buildMainNode(prefId,di){
        const p=_mainParseId(prefId);if(!p)return'';
        const nodeId=p.nodeId;const t=dialogs[di];if(!t)return'';
        const isHub=(nodeId==='__hub__');
        const origSp=nodeId.replace(/'/g,"\\'");
        const dlgLabel=t.label||('Dialog '+(di+1));
        const nodeLabel=isHub?'':(t.nodes[nodeId]?.label||'');
        return _buildNodeShared({
            evtId:prefId, nodeId,
            pos:layout[prefId]||{x:0,y:0},
            isHub, isOrphan:!isHub&&!reachable.has(prefId),
            npcText:isHub?String(t.hub||'').trim():String((t.nodes[nodeId]?.npc)||'').trim(),
            displayTitle:isHub?'\u25cf HUB \u2014 '+dlgLabel:(nodeLabel?'['+nodeId+'] '+nodeLabel:'['+nodeId+']'),
            choices:isHub?(t.hubChoices||[]):(t.nodes[nodeId]?.choices||[]),
            node:isHub?null:t.nodes[nodeId],
            handlers:{
                action:'mainShowActionMenu', link:'mainShowLinkMenu', del:'mainConfirmRowDelete',
                rename:'mainStartNodeRename', addChild:'mainAddChild', addMenu:'mainOpenAddMenu',
                deleteNode:'mainDeleteNode', nodeBinding:'mainShowNodeBindingMenu',
                keydown:'mainHandleRowKeydown',
                npcInput:function(sp){return isHub?'mainSetNpc('+di+',\'__hub__\',this.textContent)':'mainSetNpc('+di+',\''+origSp+'\',this.textContent)';},
                choiceInput:function(sp,ci){return 'mainSetChoiceText('+di+',\''+origSp+'\','+ci+',this.textContent)';}
            },
            selectedId:selectedBranchPath
        });
    }

    // ── Build vanilla hub or regular node ──
    function buildVanillaNode(prefId,catId){
        const p=_mainParseId(prefId);if(!p)return'';
        const nodeId=p.nodeId;const vt=vanillaTrees[catId];if(!vt)return'';
        const isHub=(nodeId==='__hub__');
        const origSp=nodeId.replace(/'/g,"\\'");
        const catSp=catId.replace(/'/g,"\\'");
        const catLabel=(STRIP_CATEGORIES.find(c=>c.id===catId)||{}).label||catId;
        const nodeLabel=isHub?'':(vt.nodes[nodeId]?.label||'');
        return _buildNodeShared({
            evtId:prefId, nodeId,
            pos:layout[prefId]||{x:0,y:0},
            isHub, isOrphan:!isHub&&!reachable.has(prefId),
            npcText:isHub?String(vt.hub||'').trim():String((vt.nodes[nodeId]?.npc)||'').trim(),
            displayTitle:isHub?'\u25cf HUB \u2014 '+catLabel+' (vanilla)':(nodeLabel?'['+nodeId+'] '+nodeLabel:'['+nodeId+']'),
            choices:isHub?(vt.hubChoices||[]):(vt.nodes[nodeId]?.choices||[]),
            node:isHub?null:vt.nodes[nodeId],
            handlers:{
                action:'mainVanillaShowActionMenu', link:'mainVanillaShowLinkMenu', del:'mainVanillaConfirmRowDelete',
                rename:'mainVanillaStartNodeRename', addChild:'mainVanillaAddChild', addMenu:'mainVanillaOpenAddMenu',
                deleteNode:'mainVanillaDeleteNode', nodeBinding:'mainShowNodeBindingMenu',
                keydown:'mainVanillaHandleRowKeydown',
                npcInput:function(sp){return isHub?'mainVanillaSetNpc(\''+catSp+'\',\'__hub__\',this.textContent)':'mainVanillaSetNpc(\''+catSp+'\',\''+origSp+'\',this.textContent)';},
                choiceInput:function(sp,ci){return 'mainVanillaSetChoiceText(\''+catSp+'\',\''+origSp+'\','+ci+',this.textContent)';}
            },
            textColor:'#ffe082', borderColor:'#ffe082',
            selectedId:selectedBranchPath
        });
    }

    // ── Build task pool hub or regular node ──
    function buildTaskPoolNode(prefId,tag){
        const p=_mainParseId(prefId);if(!p)return'';
        const nodeId=p.nodeId;const tt=taskPoolTrees[tag];if(!tt)return'';
        const isHub=(nodeId==='__hub__');
        const origSp=nodeId.replace(/'/g,"\\'");
        const tagSp=tag.replace(/'/g,"\\'");
        const nodeLabel=isHub?'':(tt.nodes[nodeId]?.label||'');
        return _buildNodeShared({
            evtId:prefId, nodeId,
            pos:layout[prefId]||{x:0,y:0},
            isHub, isOrphan:!isHub&&!reachable.has(prefId),
            npcText:isHub?String(tt.hub||'').trim():String((tt.nodes[nodeId]?.npc)||'').trim(),
            displayTitle:isHub?'\u25cf HUB \u2014 '+tag+' (task)':(nodeLabel?'['+nodeId+'] '+nodeLabel:'['+nodeId+']'),
            choices:isHub?(tt.hubChoices||[]):(tt.nodes[nodeId]?.choices||[]),
            node:isHub?null:tt.nodes[nodeId],
            handlers:{
                action:'mainTaskPoolShowActionMenu', link:'mainTaskPoolShowLinkMenu', del:'mainTaskPoolConfirmRowDelete',
                rename:'mainTaskPoolStartNodeRename', addChild:'mainTaskPoolAddChild', addMenu:'mainTaskPoolOpenAddMenu',
                deleteNode:'mainTaskPoolDeleteNode', nodeBinding:'mainShowNodeBindingMenu',
                keydown:'mainTaskPoolHandleRowKeydown',
                npcInput:function(sp){return isHub?'mainTaskPoolSetNpc(\''+tagSp+'\',\'__hub__\',this.textContent)':'mainTaskPoolSetNpc(\''+tagSp+'\',\''+origSp+'\',this.textContent)';},
                choiceInput:function(sp,ci){return 'mainTaskPoolSetChoiceText(\''+tagSp+'\',\''+origSp+'\','+ci+',this.textContent)';}
            },
            textColor:'#82b1ff', borderColor:'#82b1ff',
            selectedId:selectedBranchPath
        });
    }

    // ── Assemble scene ──
    let nodesHtml='';
    dialogs.forEach((t,i)=>{
        const pfx=i+'.';
        nodesHtml+=buildMainNode(pfx+'__hub__',i);
        Object.keys(t.nodes||{}).forEach(nid=>{nodesHtml+=buildMainNode(pfx+nid,i);});
    });
    vanillaCats.forEach(cat=>{
        const vt=vanillaTrees[cat.id];if(!vt)return;
        const vp='v_'+cat.id+'.';
        nodesHtml+=buildVanillaNode(vp+'__hub__',cat.id);
        Object.keys(vt.nodes||{}).forEach(nid=>{nodesHtml+=buildVanillaNode(vp+nid,cat.id);});
    });
    taskPools.forEach(pool=>{
        const tt=taskPoolTrees[pool.tag];if(!tt)return;
        const tpp='tp_'+pool.tag+'.';
        nodesHtml+=buildTaskPoolNode(tpp+'__hub__',pool.tag);
        Object.keys(tt.nodes||{}).forEach(nid=>{nodesHtml+=buildTaskPoolNode(tpp+nid,pool.tag);});
    });

    const sceneW=Math.max(canvas.clientWidth||900,maxX+200);
    const sceneH=Math.max(canvas.clientHeight||600,maxY+100);
    const zoomStyle='transform:scale('+(graphZoom/100)+');transform-origin:top left';
    const _savedOvl2=_detachFsOverlays();
    canvas.innerHTML='<div class="dlg-scene" style="width:'+sceneW+'px;height:'+sceneH+'px;'+zoomStyle+'">'
        +'<svg class="dlg-links" width="'+sceneW+'" height="'+sceneH+'">'+lines.join('')+'</svg>'
        +buildMainOpener()+nodesHtml
        +'</div>';
    _reattachFsOverlays(_savedOvl2);

    ensureCanvasInteractions();
    requestAnimationFrame(function(){
        if(_mainGraphScroll.valid){
            canvas.scrollLeft=_mainGraphScroll.l;
            canvas.scrollTop=_mainGraphScroll.t;
            _mainGraphScroll.valid=false;
        } else if(layout['__opener__']&&canvas.clientWidth>50){
            var pos=layout['__opener__'];
            var scale=graphZoom/100;
            canvas.scrollLeft=Math.max(0,pos.x*scale+110*scale-canvas.clientWidth/2);
            canvas.scrollTop=Math.max(0,pos.y*scale+100*scale-canvas.clientHeight/2);
        }
        setTimeout(updateMinimap,20);
        setTimeout(_recalcLinksFromDOM,50);
    });
}

// ═══════════════════════════════════════════
// POOL GRAPH EDITOR (task pool phrase canvas)

