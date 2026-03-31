// ═══════════════════════════════════════════
// MAIN TAB: MERGED GRAPH VIEW
// ═══════════════════════════════════════════

// ── Parse prefixed node ID ──
// Custom: "0.__hub__" → {dlgIdx:0, nodeId:"__hub__"}
// Vanilla: "v_trade.__hub__" → {dlgIdx:-1, vanillaCat:"trade", nodeId:"__hub__"}
function _mainParseId(id){
    if(id==='__opener__')return{dlgIdx:-1,nodeId:'__opener__'};
    if(id.startsWith('vs_')){
        const dot=id.indexOf('.',3);
        if(dot<0)return null;
        return{dlgIdx:-1,vanillaServiceIdx:parseInt(id.substring(3,dot)),nodeId:id.substring(dot+1)};
    }
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
// Returns the active dialog array (regular or companion)
function _activeDialogs(){
    const d=getDlg();if(!d)return[];
    return _companionAllActive?(d.companionDialogs||[]):(d.dialogs||[]);
}
function _activeLayoutKey(){return _companionAllActive?'companionMainLayout':'mainLayout';}
function mainSetOpener(di,text){
    const arr=_activeDialogs();if(arr[di])arr[di].opener=text;autoSave();
}
function mainSetNpc(di,nodeId,text){
    const t=_activeDialogs()[di];if(!t)return;
    if(nodeId==='__hub__')t.hub=text;else{const n=(t.nodes||{})[nodeId];if(n)n.npc=text;}
    autoSave();
}
function mainSetChoiceText(di,nodeId,ci,text){
    const t=_activeDialogs()[di];if(!t)return;
    const arr=nodeId==='__hub__'?(t.hubChoices||[]):(t.nodes&&t.nodes[nodeId]?t.nodes[nodeId].choices||[]:[]);
    if(arr[ci])arr[ci].text=text;autoSave();
}
function mainAddChild(prefId){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    if(_companionAllActive){curCompanionDlgIdx=p.dlgIdx;}else{curDlgTreeIdx=p.dlgIdx;}
    addChild(p.nodeId);
}
function mainDeleteNode(prefId){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    if(p.nodeId==='__hub__'||p.nodeId==='__opener__')return;
    if(!confirm('Delete node '+p.nodeId+'? Choices pointing to it will redirect to Hub.'))return;
    if(_companionAllActive){curCompanionDlgIdx=p.dlgIdx;}else{curDlgTreeIdx=p.dlgIdx;}
    graphPushUndo();
    flatDeleteNode(getCurTree(),p.nodeId);
    const dl=getDlg();const lk=_activeLayoutKey();if(dl&&dl[lk])delete dl[lk][prefId];
    autoSave();renderBranches();
}
function mainDeleteDialog(di){
    if(_companionAllActive){deleteCompanionDialog(di);}else{deleteDialogTree(di);}
}
function mainStripVanilla(catId){stripVanillaCat(catId);if(_mainTabActive){delete getDlg().mainLayout;renderBranches();}}
// ── Opener binding menu (multi-slot) ──
function mainShowOpenerActionMenu(di,btnEl){
    closeActionMenu();
    const t=_activeDialogs()[di];if(!t)return;
    var slots={};
    ['precondition','scriptText','action'].forEach(function(field){
        var key='opener'+field.charAt(0).toUpperCase()+field.slice(1);
        var handlerName='_graphOpener_'+field;
        _deBpHandlers[handlerName]=function(val){mainSetOpenerBinding(di,key,val);};
        slots[field]={val:t[key]||'',handler:handlerName};
    });
    _deOpenBpMulti(slots,btnEl);
}
function mainSetOpenerAction(di,action){
    closeActionMenu();
    const t=_activeDialogs()[di];if(!t)return;
    if(action)t.openerAction=action;else delete t.openerAction;
    autoSave();renderBranches();
}
function mainSetOpenerBinding(di,field,val){
    closeActionMenu();
    const t=_activeDialogs()[di];if(!t)return;
    if(val)t[field]=val;else delete t[field];
    autoSave();renderBranches();
}
function mainClearOpenerBindings(di){
    closeActionMenu();
    const t=_activeDialogs()[di];if(!t)return;
    delete t.openerPrecondition;delete t.openerScriptText;delete t.openerAction;
    autoSave();renderBranches();
}
function mainShowVanillaOpenerActionMenu(catId,btnEl){
    closeActionMenu();
    var vt=getVanillaTree(catId);if(!vt)return;
    _deBpHandlers._graphVanillaOpener=function(val){mainSetVanillaOpenerAction(catId,val);};
    _deOpenBp('action',vt.openerAction||'','_graphVanillaOpener',btnEl);
}
function mainSetVanillaOpenerAction(catId,action){
    closeActionMenu();
    var vt=getVanillaTree(catId);if(!vt)return;
    if(action)vt.openerAction=action;else delete vt.openerAction;
    autoSave();renderBranches();
}
// ── Vanilla node edit helpers ──
function mainVanillaSetNpc(catId,nodeId,text){
    if(typeof isVanillaCatEditable==='function'&&!isVanillaCatEditable(catId))return;
    var t=getVanillaTree(catId);if(!t)return;
    if(nodeId==='__hub__')t.hub=text;else{var n=(t.nodes||{})[nodeId];if(n)n.npc=text;}
    autoSave();
}
function mainVanillaSetChoiceText(catId,nodeId,ci,text){
    if(typeof isVanillaCatEditable==='function'&&!isVanillaCatEditable(catId))return;
    var t=getVanillaTree(catId);if(!t)return;
    var arr=nodeId==='__hub__'?(t.hubChoices||[]):(t.nodes&&t.nodes[nodeId]?t.nodes[nodeId].choices||[]:[]);
    if(arr[ci])arr[ci].text=text;autoSave();
}
function _vanillaCatEditableGuard(p){return p&&p.vanillaCat&&typeof isVanillaCatEditable==='function'&&isVanillaCatEditable(p.vanillaCat);}
function mainVanillaAddChild(prefId){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
    curVanillaCat=p.vanillaCat;curDlgTreeIdx=0;
    addChild(p.nodeId);curVanillaCat=null;
}
function mainVanillaDeleteNode(prefId){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
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
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
    curVanillaCat=p.vanillaCat;openNodeAddMenu(p.nodeId,btnEl);
}
function mainVanillaShowActionMenu(prefId,ci,btnEl){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
    curVanillaCat=p.vanillaCat;showActionMenu(p.nodeId,ci,btnEl);
}
function mainVanillaShowLinkMenu(prefId,ci,btnEl){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
    curVanillaCat=p.vanillaCat;showMiniLinkMenu(p.nodeId,ci,btnEl);
}
function mainVanillaConfirmRowDelete(prefId,ci){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
    curVanillaCat=p.vanillaCat;confirmRowDelete(p.nodeId,ci);
}
function mainVanillaHandleRowKeydown(prefId,ci,e){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p))return;
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mainVanillaAddChild(prefId);return;}
}
function mainVanillaStartNodeRename(titleEl,prefId){
    var p=_mainParseId(prefId);if(!_vanillaCatEditableGuard(p)||p.nodeId==='__hub__')return;
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
    _deBpHandlers._graphPoolOpener=function(val){mainSetTaskPoolOpenerAction(tag,val);};
    _deOpenBp('action',tt.openerAction||'','_graphPoolOpener',btnEl);
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
function _setActiveDlgIdx(idx){if(_companionAllActive)curCompanionDlgIdx=idx;else curDlgTreeIdx=idx;}
function mainOpenAddMenu(prefId,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    _setActiveDlgIdx(p.dlgIdx);openNodeAddMenu(p.nodeId,btnEl);
}
function mainShowActionMenu(prefId,ci,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    _setActiveDlgIdx(p.dlgIdx);showActionMenu(p.nodeId,ci,btnEl);
}
function mainShowNodeBindingMenu(prefId,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    _setActiveDlgIdx(p.dlgIdx);showNodeBindingMenu(p.nodeId,btnEl);
}
function mainShowLinkMenu(prefId,ci,btnEl){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    _setActiveDlgIdx(p.dlgIdx);showMiniLinkMenu(p.nodeId,ci,btnEl);
}
function mainConfirmRowDelete(prefId,ci){
    const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
    _setActiveDlgIdx(p.dlgIdx);confirmRowDelete(p.nodeId,ci);
}
function mainHandleRowKeydown(prefId,ci,e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mainAddChild(prefId);return;}
    if(e.key==='Tab'&&!e.shiftKey){
        e.preventDefault();
        const p=_mainParseId(prefId);if(!p||p.dlgIdx<0)return;
        _setActiveDlgIdx(p.dlgIdx);
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
    _setActiveDlgIdx(p.dlgIdx);
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
    const _isComp=_companionAllActive;
    const _layoutKey=_isComp?'companionMainLayout':'mainLayout';
    const layout=dlg[_layoutKey]=dlg[_layoutKey]||{};
    const dialogs=_isComp?(dlg.companionDialogs||[]):(dlg.dialogs||[]);
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
    if(!_isComp){
        // Vanilla trees
        const s=getD('settings')||{};
        const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
        const _layoutExcluded=new Set(['wounded']);
        STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id)&&!_layoutExcluded.has(c.id)).forEach(cat=>{
            const vt=getVanillaTree(cat.id);
            if(vt)layoutTree('v_'+cat.id+'.',vt);
        });
        // Vanilla service trees (story NPCs)
        if(Array.isArray(dlg.vanillaServices)){
            dlg.vanillaServices.forEach((svc,i)=>layoutTree('vs_'+i+'.',svc));
        }
        // Excluded opener nodes — separate, positioned below everything
        const _excludedIds=['wounded'];
        _excludedIds.forEach(catId=>{
            if(stripped.includes(catId))return;
            if(!STRIP_CATEGORIES.find(c=>c.id===catId))return;
            const opId='__'+catId+'_opener__';
            layout[opId]={x:X0,y:curY+20};
            const vt=getVanillaTree(catId);
            if(vt)layoutTree('v_'+catId+'.',vt);
        });
    }
}

let _mainGraphScroll={l:0,t:0,valid:false};
// ── Main graph renderer ──
function renderMainGraphEditor(){
    const canvas=document.getElementById('dialogGraphCanvas');
    if(!canvas)return;
    // Save scroll before anything else
    if(canvas.querySelector('.dlg-scene')){_mainGraphScroll={l:canvas.scrollLeft,t:canvas.scrollTop,valid:true};}
    const dlg=getDlg();
    if(!dlg)return;
    const _isCompAll=_companionAllActive;
    // Story NPCs may have 0 custom dialogs
    var _isSNpcGraph=!_isCompAll&&typeof getCurrentStoryNpc==='function'&&getCurrentStoryNpc()!==null;
    var _hasVanillaSvc=_isSNpcGraph&&Array.isArray(dlg.vanillaServices)&&dlg.vanillaServices.length>0;
    // In companion mode, use companion dialogs
    const dialogs=_isCompAll?ensureCompanionDialogs():(dlg.dialogs||[]);
    if(!dialogs.length){
        if(_isCompAll){
            canvas.innerHTML='<div style="padding:40px;text-align:center;color:#888"><div style="font-size:16px;margin-bottom:8px">No companion dialogs yet</div><div style="font-size:13px">Click <b>+ Add Dialog</b> in the Companion row to create one.</div></div>';
            return;
        }
        if(_isSNpcGraph&&!_hasVanillaSvc){
            canvas.innerHTML='<div style="padding:40px;text-align:center;color:#888"><div style="font-size:16px;margin-bottom:8px">No custom dialogs yet</div><div style="font-size:13px">Click <b>+ Add Dialog</b> above to create a new conversation for this NPC.</div></div>';
            return;
        }
        if(!_isSNpcGraph)return;
    }

    // Vanilla categories (hidden for story NPCs and companion mode)
    const s=getD('settings')||{};
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
    const vanillaCats=(_isSNpcGraph||_isCompAll)?[]:STRIP_CATEGORIES.filter(c=>!stripped.includes(c.id));
    const vanillaTrees={};
    vanillaCats.forEach(cat=>{vanillaTrees[cat.id]=getVanillaTree(cat.id);});

    // Vanilla service trees (story NPCs only, not companion mode)
    const vanillaSvcs=_isSNpcGraph&&Array.isArray(dlg.vanillaServices)?dlg.vanillaServices:[];

    // Task pool graph trees removed — pools are managed in Tasks sub-tab only
    const taskPools=[];
    const taskPoolTrees={};

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

    const _layoutKey=_isCompAll?'companionMainLayout':'mainLayout';
    if(!dlg[_layoutKey])dlg[_layoutKey]={};
    const layout=dlg[_layoutKey];

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
            for(let vi=0;vi<vanillaSvcs.length;vi++){
                const vsp='vs_'+vi+'.';
                if(!layout[vsp+'__hub__']){needsLayout=true;break;}
                const vst=vanillaSvcs[vi];
                if(vst){const vnk=Object.keys(vst.nodes||{});for(let j=0;j<vnk.length;j++){if(!layout[vsp+vnk[j]]){needsLayout=true;break;}}}
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
    // Entries excluded from standard opener reordering (conditional vanilla categories)
    const _openerExcluded=new Set(['wounded']);
    // Check wounded opener
    if(!needsLayout&&vanillaCats.some(c=>c.id==='wounded')&&!layout['__wounded_opener__'])needsLayout=true;
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
    vanillaSvcs.forEach((svc,i)=>bfsTree('vs_'+i+'.',svc));
    taskPools.forEach(pool=>{const tt=taskPoolTrees[pool.tag];if(tt)bfsTree('tp_'+pool.tag+'.',tt);});

    const NW=220,NH=28,NN=44,NR=30;
    const lines=[];
    let maxX=0,maxY=0;

    function drawLink(fromId,ci,toId){
        const fp=layout[fromId]||{x:0,y:0};
        const tp=layout[toId];if(!tp)return;
        const fromNN=(fromId==='__opener__'||fromId.endsWith('_opener__'))?0:NN; // opener nodes have no NPC text area
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

    // ── Build ordered opener row list ──
    // Each entry: {type, key, hubId}
    // type: 'dialog','vanilla','service','pool'
    // key: dialog index, cat id, service index, pool tag
    // _openerExcluded declared above (line ~481)
    function _buildOpenerEntries(){
        const entries=[];
        dialogs.forEach((t,i)=>entries.push({type:'dialog',key:i,hubId:i+'.__hub__'}));
        vanillaCats.forEach(cat=>{
            if(_openerExcluded.has(cat.id))return;
            entries.push({type:'vanilla',key:cat.id,hubId:'v_'+cat.id+'.__hub__'});
        });
        vanillaSvcs.forEach((svc,i)=>entries.push({type:'service',key:i,hubId:'vs_'+i+'.__hub__'}));
        taskPools.forEach(pool=>entries.push({type:'pool',key:pool.tag,hubId:'tp_'+pool.tag+'.__hub__'}));
        return entries;
    }
    function _getOpenerOrder(){
        const all=_buildOpenerEntries();
        const saved=_isCompAll?dlg.companionOpenerOrder:dlg.openerOrder;
        if(!Array.isArray(saved)||!saved.length)return all;
        // Rebuild from saved order, adding any new entries at the end
        const ordered=[];const used=new Set();
        saved.forEach(s=>{
            const match=all.find(e=>e.type===s.type&&String(e.key)===String(s.key));
            if(match&&!used.has(match.hubId)){ordered.push(match);used.add(match.hubId);}
        });
        all.forEach(e=>{if(!used.has(e.hubId))ordered.push(e);});
        return ordered;
    }
    const openerEntries=_getOpenerOrder();
    const totalOpenerRows=openerEntries.length;

    // Opener → hub links following saved order
    openerEntries.forEach((entry,ci)=>{
        if(layout[entry.hubId])drawLink('__opener__',ci,entry.hubId);
    });
    {const op=layout['__opener__']||{x:0,y:0};
     maxX=Math.max(maxX,op.x+NW+20);
     maxY=Math.max(maxY,op.y+NH+NN+Math.max(1,totalOpenerRows)*NR+60);}

    // Tree links (custom + vanilla + task pools)
    dialogs.forEach((t,i)=>drawTreeLinks(i+'.',t));
    vanillaCats.forEach(cat=>{const vt=vanillaTrees[cat.id];if(vt)drawTreeLinks('v_'+cat.id+'.',vt);});
    vanillaSvcs.forEach((svc,i)=>drawTreeLinks('vs_'+i+'.',svc));
    taskPools.forEach(pool=>{const tt=taskPoolTrees[pool.tag];if(tt)drawTreeLinks('tp_'+pool.tag+'.',tt);});

    // ── Build opener node ──
    function _openerRowHtml(entry,ri){
        if(entry.type==='dialog'){
            const i=entry.key;const t=dialogs[i];if(!t)return'';
            const _compRO=!!(_isCompAll&&i===0&&t.id==='comp_dlg_1');
            const opText=String(t.opener||'').trim();
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const _opHasBind=!!(t.openerAction||t.openerPrecondition||t.openerScriptText);
            const actionTip=[t.openerPrecondition?'⚙ '+t.openerPrecondition:'',t.openerScriptText?'📝 '+t.openerScriptText:'',t.openerAction?'▶ '+t.openerAction:''].filter(Boolean).join('\n');
            return '<div class="dlg-node-row'+(_opHasBind?' has-action':'')+'" data-ci="'+ri+'" data-otype="dialog" data-okey="'+i+'" style="'+(_compRO?'opacity:0.6;':'')+'"'+(_compRO?'':' draggable="true" ondragstart="openerRowDragStart(event,'+ri+')" ondragover="openerRowDragOver(event)" ondrop="openerRowDrop(event,'+ri+')"')+'>'
                +'<span class="opener-row-num">'+(ri+1)+'</span>'
                +'<div class="dlg-node-row-text"'+(_compRO?'':' contenteditable="true"')+' spellcheck="false"'
                +' data-placeholder="Opener text..."'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +(_compRO?'':' oninput="mainSetOpener('+i+',this.textContent)"')
                +'>'+opEsc+'</div>'
                +(_compRO?'':'<button class="dlg-action-btn'+(_opHasBind?' active':'')+'" title="'+(_opHasBind?esc(actionTip):'Add bindings')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainShowOpenerActionMenu('+i+',this)">&#9889;</button>')
                +(dialogs.length>1&&!_compRO?'<button class="dlg-del-row" title="Delete dialog" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainDeleteDialog('+i+')">&#10005;</button>':'')
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
        }
        if(entry.type==='vanilla'){
            const catId=entry.key;const cat=vanillaCats.find(c=>c.id===catId);if(!cat)return'';
            const vt=vanillaTrees[catId];
            const _catEditable=typeof isVanillaCatEditable==='function'&&isVanillaCatEditable(catId);
            const opText=vt?String(vt.opener||'').trim():cat.label;
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const vAction=vt&&vt.openerAction?String(vt.openerAction):'';
            const vActionTip=vAction?String(vAction).split(';').map(function(a){var at=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===at;});return def?def.label:at;}).join(' + '):'';
            return '<div class="dlg-node-row'+(vAction?' has-action':'')+'" data-ci="'+ri+'" data-otype="vanilla" data-okey="'+esc(catId)+'" style="border-left:2px solid #ffe082;'+(_catEditable?'':'opacity:0.6;')+'"'+(_catEditable?' draggable="true" ondragstart="openerRowDragStart(event,'+ri+')" ondragover="openerRowDragOver(event)" ondrop="openerRowDrop(event,'+ri+')"':'')+(vActionTip?' title="'+esc(vActionTip)+'"':'')+'>'
                +'<span class="opener-row-num">'+(ri+1)+'</span>'
                +'<div class="dlg-node-row-text"'+(_catEditable?' contenteditable="true"':'')+' spellcheck="false"'
                +' data-placeholder="Vanilla opener..." style="color:#ffe082"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +(_catEditable?' oninput="(function(el){var vt=getVanillaTree(\''+esc(catId)+'\');if(vt)vt.opener=el.textContent;autoSave();})(this)"':'')
                +'>'+opEsc+'</div>'
                +(_catEditable?'<button class="dlg-action-btn'+(vAction?' active':'')+'" title="'+(vAction?esc(vActionTip):'Add action')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainShowVanillaOpenerActionMenu(\''+esc(catId)+'\',this)">&#9889;</button>':'')
                +'<button class="dlg-del-row" title="Strip '+esc(cat.label)+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainStripVanilla(\''+esc(catId)+'\')">&#10005;</button>'
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
        }
        if(entry.type==='service'){
            const si=entry.key;const svc=vanillaSvcs[si];if(!svc)return'';
            const opText=String(svc.opener||'').trim()||svc.label||'';
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            return '<div class="dlg-node-row" data-ci="'+ri+'" data-otype="service" data-okey="'+si+'" style="border-left:2px solid #ffe082" draggable="true" ondragstart="openerRowDragStart(event,'+ri+')" ondragover="openerRowDragOver(event)" ondrop="openerRowDrop(event,'+ri+')">'
                +'<span class="opener-row-num">'+(ri+1)+'</span>'
                +'<div class="dlg-node-row-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Service opener..." style="color:#ffe082"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +' oninput="(function(el){var d=getDlg();if(d&&d.vanillaServices&&d.vanillaServices['+si+'])d.vanillaServices['+si+'].opener=el.textContent;autoSave();})(this)"'
                +'>'+opEsc+'</div>'
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
        }
        if(entry.type==='pool'){
            const tag=entry.key;const pool=taskPools.find(p=>p.tag===tag);
            const tt=taskPoolTrees[tag];
            const opText=tt?String(tt.opener||'').trim():(pool?pool.tag:tag);
            const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const tAction=tt&&tt.openerAction?String(tt.openerAction):'';
            const tActionTip=tAction?String(tAction).split(';').map(function(a){var at=a.trim();var def=DIALOG_ACTIONS.find(function(d){return d.id===at;});return def?def.label:at;}).join(' + '):'';
            return '<div class="dlg-node-row'+(tAction?' has-action':'')+'" data-ci="'+ri+'" data-otype="pool" data-okey="'+esc(tag)+'" style="border-left:2px solid #82b1ff" draggable="true" ondragstart="openerRowDragStart(event,'+ri+')" ondragover="openerRowDragOver(event)" ondrop="openerRowDrop(event,'+ri+')"'+(tActionTip?' title="'+esc(tActionTip)+'"':'')+'>'
                +'<span class="opener-row-num">'+(ri+1)+'</span>'
                +'<div class="dlg-node-row-text" contenteditable="true" spellcheck="false"'
                +' data-placeholder="Task pool opener..." style="color:#82b1ff"'
                +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
                +' oninput="(function(el){var tt=getTaskPoolTree(\''+esc(tag)+'\');if(tt)tt.opener=el.textContent;autoSave();})(this)"'
                +'>'+opEsc+'</div>'
                +'<button class="dlg-action-btn'+(tAction?' active':'')+'" title="'+(tAction?esc(tActionTip):'Add action')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainShowTaskPoolOpenerActionMenu(\''+esc(tag)+'\',this)">&#9889;</button>'
                +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
                +'</div>';
        }
        return '';
    }
    function buildMainOpener(){
        const pos=layout['__opener__']||{x:0,y:0};
        let rowsHtml='';
        openerEntries.forEach((entry,ri)=>{rowsHtml+=_openerRowHtml(entry,ri);});
        if(_isCompAll){
            rowsHtml+='<div class="dlg-node-add-row">'
                +'<button class="dlg-add-direct" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();addCompanionDialog()">+ Add Opener</button>'
                +'</div>';
        } else {
            rowsHtml+='<div class="dlg-node-add-row">'
                +'<button class="dlg-add-direct" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();addDialogTree()">+ Add Opener</button>'
                +'<button class="dlg-add-menu-btn" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainOpenOpenerAddMenu(this)" title="More options">&#9662;</button>'
                +'</div>';
        }
        const _opField=_isCompAll?'companionOpenerNpc':'openerNpc';
        const _opHasBindings=dlg.openerPrecondition||dlg.openerAction||dlg.openerScriptText;
        const helloText=String(dlg[_opField]||'').trim();
        const _compStyle=_isCompAll;
        const _headerBg=_compStyle?'background:rgba(20,40,80,.6)':'';
        const _titleColor=_compStyle?'color:#82b1ff':'';
        const _titleIcon=_compStyle?'&#9741;':'&#9654;';
        const _titleText=_compStyle?'COMPANION OPENER':'OPENER';
        const _npcColor=_compStyle?'color:#82b1ff':'color:#aaa';
        const _placeholder=_compStyle?'Companion greeting...':'NPC hello response...';
        return '<div class="dlg-node opener-node'+(selectedBranchPath==='__opener__'?' selected':'')+'" data-nid="__opener__" style="left:'+pos.x+'px;top:'+pos.y+'px'+(_compStyle?';border-color:#3a5a8a':'')+'" onclick="selectBranch(\'__opener__\')">'
            +'<div class="dlg-node-header opener-header" style="position:relative;'+_headerBg+'" onpointerdown="startGraphDrag(\'__opener__\',event)">'
            +'<span class="dlg-node-title" style="'+_titleColor+'">'+_titleIcon+' '+_titleText+'</span>'
            +(_compStyle?'':'<button class="dlg-action-btn dlg-node-bind-btn'+(_opHasBindings?' active':'')+'" style="margin-left:auto;flex-shrink:0" title="'+(_opHasBindings?'Edit opener bindings':'Add opener binding')+'" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();showNodeBindingMenu(\'__opener__\',this)">&#9889;</button>')
            +'</div>'
            +'<div class="dlg-node-npc" contenteditable="true" spellcheck="false"'
            +' data-placeholder="'+_placeholder+'"'
            +' style="border-bottom:1px solid #333;'+_npcColor+';font-style:italic"'
            +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation();selectBranch(\'__opener__\',true)"'
            +' oninput="(function(el){getDlg().'+_opField+'=el.textContent;autoSave();})(this)"'
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
        const _nodeOpts={
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
        };
        if(_isCompAll){_nodeOpts.textColor='#82b1ff';_nodeOpts.borderColor='#5080c0';if(di===0)_nodeOpts.readOnly=true;}
        return _buildNodeShared(_nodeOpts);
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
        const _catEditable=typeof isVanillaCatEditable==='function'&&isVanillaCatEditable(catId);
        return _buildNodeShared({
            evtId:prefId, nodeId,
            pos:layout[prefId]||{x:0,y:0},
            isHub, isOrphan:!isHub&&!reachable.has(prefId),
            readOnly:!_catEditable,
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

    // ── Build vanilla service node (story NPCs) — same look as vanilla nodes ──
    function buildVanillaServiceNode(prefId,svcIdx){
        const p=_mainParseId(prefId);if(!p)return'';
        const nodeId=p.nodeId;const svc=vanillaSvcs[svcIdx];if(!svc)return'';
        const isHub=(nodeId==='__hub__');
        const origSp=nodeId.replace(/'/g,"\\'");
        const svcLabel=svc.label||('Service '+(svcIdx+1));
        const nodeLabel=isHub?'':(svc.nodes[nodeId]?.label||'');
        return _buildNodeShared({
            evtId:prefId, nodeId,
            pos:layout[prefId]||{x:0,y:0},
            isHub, isOrphan:!isHub&&!reachable.has(prefId),
            npcText:isHub?String(svc.hub||'').trim():String((svc.nodes[nodeId]?.npc)||'').trim(),
            displayTitle:isHub?'\u25cf HUB \u2014 '+svcLabel+' (vanilla)':(nodeLabel?'['+nodeId+'] '+nodeLabel:'['+nodeId+']'),
            choices:isHub?(svc.hubChoices||[]):(svc.nodes[nodeId]?.choices||[]),
            node:isHub?null:svc.nodes[nodeId],
            handlers:{
                action:'mainVanillaShowActionMenu', link:'mainVanillaShowLinkMenu', del:'mainVanillaConfirmRowDelete',
                rename:'mainVanillaStartNodeRename', addChild:'mainVanillaAddChild', addMenu:'mainVanillaOpenAddMenu',
                deleteNode:'mainVanillaDeleteNode', nodeBinding:'mainShowNodeBindingMenu',
                keydown:'mainVanillaHandleRowKeydown',
                npcInput:function(){return '(function(el){var d=getDlg();if(d&&d.vanillaServices&&d.vanillaServices['+svcIdx+']){var s=d.vanillaServices['+svcIdx+'];'+(isHub?'s.hub=el.textContent':'if(s.nodes&&s.nodes[\"'+origSp+'\"])s.nodes[\"'+origSp+'\"].npc=el.textContent')+';autoSave();}})(this)';},
                choiceInput:function(sp,ci){return '(function(el){var d=getDlg();if(d&&d.vanillaServices&&d.vanillaServices['+svcIdx+']){var s=d.vanillaServices['+svcIdx+'];var ch='+(isHub?'s.hubChoices':'s.nodes&&s.nodes[\"'+origSp+'\"]&&s.nodes[\"'+origSp+'\"].choices')+';if(ch&&ch['+ci+'])ch['+ci+'].text=el.textContent;autoSave();}})(this)';}
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
    // ── Build excluded opener nodes (wounded — separate from main opener) ──
    const _excludedMeta={
        wounded:{icon:'&#9888;',title:'WOUNDED',color:'#ffe082',bg:'rgba(80,50,20,.6)',border:'#b08030',placeholder:'Wounded greeting...'}
    };
    vanillaCats.forEach(cat=>{
        if(!_openerExcluded.has(cat.id))return;
        const vt=vanillaTrees[cat.id];if(!vt)return;
        const opId='__'+cat.id+'_opener__';
        const hubId='v_'+cat.id+'.__hub__';
        if(!layout[opId])layout[opId]={x:20,y:maxY+40};
        maxY=Math.max(maxY,layout[opId].y+NH+NR+60);
        if(layout[hubId])drawLink(opId,0,hubId);
    });

    let nodesHtml='';
    // Excluded opener nodes
    vanillaCats.forEach(cat=>{
        if(!_openerExcluded.has(cat.id))return;
        const vt=vanillaTrees[cat.id];if(!vt)return;
        const meta=_excludedMeta[cat.id]||{icon:'&#9679;',title:cat.id.toUpperCase(),color:'#ffe082',bg:'rgba(80,50,20,.6)',border:'#b08030',placeholder:'Opener...'};
        const _exEditable=typeof isVanillaCatEditable==='function'&&isVanillaCatEditable(cat.id);
        const opId='__'+cat.id+'_opener__';
        const pos=layout[opId]||{x:20,y:0};
        const opText=String(vt.opener||'').trim();
        const opEsc=opText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        nodesHtml+='<div class="dlg-node opener-node" data-nid="'+opId+'" style="left:'+pos.x+'px;top:'+pos.y+'px;border-color:'+meta.border+';'+(_exEditable?'':'opacity:0.7;')+'" onclick="selectBranch(\''+opId+'\')">'
            +'<div class="dlg-node-header" style="background:'+meta.bg+';position:relative" onpointerdown="startGraphDrag(\''+opId+'\',event)">'
            +'<span class="dlg-node-title" style="color:'+meta.color+'">'+meta.icon+' '+meta.title+'</span>'
            +'<button class="dlg-del-row" style="margin-left:auto" title="Strip '+cat.id+' dialog" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();mainStripVanilla(\''+esc(cat.id)+'\')">&#10005;</button>'
            +'</div>'
            +'<div class="dlg-node-row" data-ci="0" style="border-left:2px solid '+meta.color+'">'
            +'<div class="dlg-node-row-text"'+(_exEditable?' contenteditable="true"':'')+' spellcheck="false"'
            +' data-placeholder="'+meta.placeholder+'" style="color:'+meta.color+'"'
            +' onmousedown="event.stopPropagation()" onclick="event.stopPropagation()"'
            +(_exEditable?' oninput="(function(el){var vt=getVanillaTree(\''+esc(cat.id)+'\');if(vt)vt.opener=el.textContent;autoSave();})(this)"':'')
            +'>'+opEsc+'</div>'
            +'<span class="dlg-port-area"><span class="dlg-port-out"></span></span>'
            +'</div>'
            +'</div>';
    });
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
    vanillaSvcs.forEach((svc,i)=>{
        const vsp='vs_'+i+'.';
        nodesHtml+=buildVanillaServiceNode(vsp+'__hub__',i);
        Object.keys(svc.nodes||{}).forEach(nid=>{nodesHtml+=buildVanillaServiceNode(vsp+nid,i);});
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

