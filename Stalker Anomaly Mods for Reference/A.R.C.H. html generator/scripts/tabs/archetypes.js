// ═══════════════════════════════════════════
// GROUP & CHARACTER MANAGEMENT
// ═══════════════════════════════════════════
function _showFirstCreateWarning(){
    if(localStorage.getItem('arch_warning_seen')==='1')return;
    var ov=document.getElementById('archWarningOverlay');
    if(ov)ov.style.display='flex';
}

// ── Multi-select deletion ──
let _multiSelectMode=false;
const _selectedGroups=new Set();  // indices
const _selectedSolos=new Set();   // indices

function toggleMultiSelect(){
    _multiSelectMode=!_multiSelectMode;
    _selectedGroups.clear();
    _selectedSolos.clear();
    renderGroupList();
    _renderDeleteBar();
}
function toggleSelectGroup(gi,e){
    e.stopPropagation();
    if(_selectedGroups.has(gi))_selectedGroups.delete(gi);
    else _selectedGroups.add(gi);
    renderGroupList();
    _renderDeleteBar();
}
function toggleSelectSolo(si,e){
    e.stopPropagation();
    if(_selectedSolos.has(si))_selectedSolos.delete(si);
    else _selectedSolos.add(si);
    renderGroupList();
    _renderDeleteBar();
}
function selectAllGroups(){
    groups.forEach((_,i)=>_selectedGroups.add(i));
    renderGroupList();_renderDeleteBar();
}
function selectAllSolos(){
    soloChars.forEach((_,i)=>_selectedSolos.add(i));
    renderGroupList();_renderDeleteBar();
}
function deleteSelected(){
    const gc=_selectedGroups.size,sc=_selectedSolos.size;
    if(!gc&&!sc)return;
    const parts=[];
    if(gc)parts.push(gc+' group'+(gc>1?'s':''));
    if(sc)parts.push(sc+' solo character'+(sc>1?'s':''));
    if(!confirm('Delete '+parts.join(' and ')+'? This cannot be undone.'))return;
    // Delete in reverse order to preserve indices
    const gIdxs=[..._selectedGroups].sort((a,b)=>b-a);
    const sIdxs=[..._selectedSolos].sort((a,b)=>b-a);
    gIdxs.forEach(gi=>{
        groups.splice(gi,1);
        if(curGrp===gi){editMode=null;curGrp=null;curChar=null;}
        else if(curGrp!==null&&curGrp>gi)curGrp--;
    });
    sIdxs.forEach(si=>{
        soloChars.splice(si,1);
        if(editMode==='solo'&&curSolo===si){editMode=null;curSolo=null;}
        else if(editMode==='solo'&&curSolo!==null&&curSolo>si)curSolo--;
    });
    _selectedGroups.clear();_selectedSolos.clear();
    _multiSelectMode=false;
    updateModeBar();renderGroupList();_renderDeleteBar();
    setStatus('Deleted '+parts.join(' and ')+'.','warn');
}
function _renderDeleteBar(){
    let bar=document.getElementById('multiDeleteBar');
    if(!_multiSelectMode){
        if(bar)bar.remove();
        return;
    }
    if(!bar){
        bar=document.createElement('div');
        bar.id='multiDeleteBar';
        bar.className='multi-delete-bar';
        document.getElementById('tab-arch').appendChild(bar);
    }
    const count=_selectedGroups.size+_selectedSolos.size;
    bar.innerHTML=`<span>${count} selected</span>`
        +`<button class="btn b2 bs" onclick="selectAllGroups();selectAllSolos()">Select All</button>`
        +`<button class="btn bd bs" onclick="deleteSelected()" ${count?'':'disabled'}>Delete Selected</button>`
        +`<button class="btn b2 bs" onclick="toggleMultiSelect()">Cancel</button>`;
}

function createGroup(){
    const name=document.getElementById('newGrpName').value.trim();
    const count=Math.max(1,+document.getElementById('newGrpCount').value||1);
    if(!name){alert('Enter a group name.');return;}
    _showFirstCreateWarning();
    const grp={name,defaults:mkDefaults(),chars:[]};
    for(let i=1;i<=count;i++){
        grp.chars.push({archId:name+'_'+i,displayName:'',ov:{}});
    }
    groups.push(grp);
    document.getElementById('newGrpName').value='';
    renderGroupList();
    setStatus(`Created group '${name}' with ${count} character(s).`,'ok');
}

function addCharToGroup(gi){
    const g=groups[gi];
    const n=g.chars.length+1;
    g.chars.push({archId:g.name+'_'+n,displayName:'',ov:{}});
    renderGroupList();
    setStatus(`Added '${g.name}_${n}'.`,'ok');
}

function rmGroup(gi){
    const g=groups[gi];
    const removedName=(g&&g.name)||'group';
    const charCount=g&&g.chars?g.chars.length:0;
    if(!confirm(`Delete group "${removedName}"${charCount?` and its ${charCount} character(s)`:' '}? This cannot be undone.`))return;
    groups.splice(gi,1);
    if(curGrp===gi){editMode=null;curGrp=null;curChar=null;updateModeBar();}       // deleted the active group
    else if(curGrp!==null&&curGrp>gi){curGrp--;updateModeBar();}                    // deleted before active — shift
    renderGroupList();
    setStatus(`Deleted group '${removedName}'.`,'warn');
}

function rmChar(gi,ci){
    const removed=(groups[gi]&&groups[gi].chars&&groups[gi].chars[ci])?groups[gi].chars[ci].archId:'character';
    if(!confirm(`Delete character "${removed}"? This cannot be undone.`))return;
    groups[gi].chars.splice(ci,1);
    if(curGrp===gi&&curChar!==null){                // adjust curChar if editing same group
        if(curChar===ci){editMode='group';curChar=null;updateModeBar();}  // deleted the active char
        else if(curChar>ci){curChar--;updateModeBar();}                    // deleted before active — shift down
    }
    renderGroupList();
    setStatus(`Deleted character '${removed}'.`,'warn');
}

function editGroup(gi){
    editMode='group';curGrp=gi;curChar=null;
    updateModeBar();renderGroupList();
    switchTab('settings');
}

function editChar(gi,ci){
    editMode='char';curGrp=gi;curChar=ci;
    updateModeBar();renderGroupList();
    switchTab('settings');
}

function goToArchTab(){switchTab('arch');}

function switchTab(tab){
    document.querySelectorAll('.tb').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);});
    document.querySelectorAll('.tc').forEach(c=>{c.classList.toggle('active',c.id==='tab-'+tab);});
    if(tab==='export')renderExportGroupSelect();
    else if(tab!=='arch')refreshTab(tab);
    if(typeof TexEditor!=='undefined')TexEditor.onMainTabChanged(tab);
}

function updateModeBar(){
    const mt=document.getElementById('modeText');
    const mb=document.getElementById('modeBtnBack');
    if(editMode==='solo'&&curSolo!==null){
        mb.style.display='inline-block';
        var _snpc=getCurrentStoryNpc();
        if(_snpc){
            mt.innerHTML='<span style="color:#ffe082">'+esc(_snpc.name)+'</span> <span style="color:#888">— '+esc(_snpc.role)+', '+esc(_snpc.loc)+'</span>';
        } else {
            mt.innerHTML='SOLO: <span style="color:#ff8c00">'+esc(soloChars[curSolo]?.archId||'?')+'</span>';
        }
        return;
    }
    if(!editMode||curGrp===null){mt.textContent='No group selected';mb.style.display='none';return;}
    mb.style.display='inline-block';
    if(editMode==='group'){
        mt.innerHTML='GROUP: <span style="color:#4caf50">'+esc(groups[curGrp].name)+'</span> (shared defaults)';
    }else{
        const ch=groups[curGrp].chars[curChar];
        mt.innerHTML='CHARACTER: <span style="color:#0096ff">'+esc(ch.archId)+'</span> in '+esc(groups[curGrp].name);
    }
}

function grpStatus(gi){
    const g=groups[gi];if(!g)return'bad';
    const d=g.defaults?.settings||{};
    const hasComm=Array.isArray(d.commVals)&&d.commVals.length>0;
    const hasLtx=!!d.ltxPath;
    const hasTrade=!!(g.defaults?.trade?.tradeParent);
    if(!hasComm&&!hasLtx)return'bad';
    if(!hasTrade)return'warn';
    return'ok';
}
function soloStatus(si){
    const ch=soloChars[si];if(!ch)return'bad';
    const s=ch.ov?.settings||{};
    const hasComm=Array.isArray(s.commVals)&&s.commVals.length>0;
    const hasLtx=!!s.ltxPath;
    if(!hasComm||!hasLtx)return'bad';
    return'ok';
}
function renderGroupList(){
    const c=document.getElementById('groupList');c.innerHTML='';
    groups.forEach((g,gi)=>{
        let chars='';
        g.chars.forEach((ch,ci)=>{
            const active=(editMode==='char'&&curGrp===gi&&curChar===ci)?'active':'';
            const _cg=typeof getConnGroupsForArch==='function'?getConnGroupsForArch(ch.archId):[];
            const _connIcon=_cg.length?'<span style="color:#82b1ff;font-size:10px;margin-right:2px" title="Connected: '+esc(_cg.join(', '))+'">&#9741;</span>':'';
            chars+=`<span class="char-pill ${active}" draggable="true"
                ondragstart="onCharDragStart(event,'group',${gi},${ci})"
                ondragend="onCharDragEnd(event)"
                onclick="editChar(${gi},${ci})"
            ><button class="char-dup-btn" title="Duplicate" onclick="event.stopPropagation();dupChar(${gi},${ci})">⧉</button>${_connIcon}${esc(ch.archId)}<button class="char-del-btn" title="Delete character" onclick="event.stopPropagation();rmChar(${gi},${ci})">×</button></span>`;
        });
        const grpActive=(editMode==='group'&&curGrp===gi)?'grp-mode':'';
        const dot=grpStatus(gi);
        const dotTip=dot==='ok'?'Complete':dot==='warn'?'Missing trade config':'Missing community/LTX';
        const _msSel=_multiSelectMode&&_selectedGroups.has(gi);
        const _msChk=_multiSelectMode?`<input type="checkbox" class="ms-chk" ${_msSel?'checked':''} onclick="toggleSelectGroup(${gi},event)" style="accent-color:#ff8c00;margin-right:8px;cursor:pointer">`:'';
        c.innerHTML+=`<div class="grp-card${_msSel?' ms-selected':''}" data-gi="${gi}"
            ondragover="event.preventDefault();this.classList.add('drag-over')"
            ondragleave="this.classList.remove('drag-over')"
            ondrop="dropCharOnto('group',${gi},event);this.classList.remove('drag-over')"
            ${_multiSelectMode?'onclick="toggleSelectGroup('+gi+',event)"':''}>
            <div style="display:flex;justify-content:space-between;align-items:center">
                <h3 style="display:flex;align-items:center;gap:0">${_msChk}${esc(g.name)} (${g.chars.length})<span class="comp-dot ${dot}" title="${dotTip}"></span></h3>
                <div style="display:flex;gap:6px">
                    <button class="btn b2 bs" onclick="addCharToGroup(${gi})">+ Char</button>
                    <button class="btn b2 bs" title="Duplicate group" onclick="dupGroup(${gi})">⧉</button>
                    <button class="btn bd bs" onclick="rmGroup(${gi})">Delete</button>
                </div>
            </div>
            <div style="margin-top:8px">
                <span class="char-pill ${grpActive}" onclick="editGroup(${gi})">⚙ GROUP SETTINGS</span>
                ${chars}
            </div>
        </div>`;
    });

    // Render solo chars
    const soloBox=document.getElementById('soloCharList');
    if(soloBox){
        soloBox.innerHTML='';
        soloChars.forEach((ch,si)=>{
            // Story NPCs render in their own section
            var _assignTo=(ch.ov&&ch.ov.settings&&ch.ov.settings.assignTo)||(ch.defaults&&ch.defaults.settings&&ch.defaults.settings.assignTo)||'';
            if(_assignTo&&STORY_NPC_LOOKUP[_assignTo])return;
            const active=(editMode==='solo'&&curSolo===si)?'active':'';
            const dot=soloStatus(si);
            const dotTip=dot==='ok'?'Complete':'Missing community or LTX';
            const _msSel=_multiSelectMode&&_selectedSolos.has(si);
            const pill=document.createElement('span');
            pill.className=`char-pill ${active}${_msSel?' ms-selected':''}`;
            pill.draggable=true;
            const _scg=typeof getConnGroupsForArch==='function'?getConnGroupsForArch(ch.archId):[];
            const _sconnIcon=_scg.length?`<span style="color:#82b1ff;font-size:10px;margin-right:2px" title="Connected: ${esc(_scg.join(', '))}">&#9741;</span>`:'';
            const _msChk=_multiSelectMode?`<input type="checkbox" class="ms-chk" ${_msSel?'checked':''} onclick="toggleSelectSolo(${si},event)" style="accent-color:#ff8c00;cursor:pointer">`:'';
            pill.innerHTML=`${_msChk}<button class="char-dup-btn" title="Duplicate" onclick="event.stopPropagation();dupSoloChar(${si})">⧉</button>${_sconnIcon}${esc(ch.archId)}<span class="comp-dot ${dot}" title="${dotTip}" style="margin-left:4px"></span><button class="char-del-btn" title="Delete" onclick="event.stopPropagation();rmSoloChar(${si})">×</button>`;
            if(_multiSelectMode){
                pill.addEventListener('click',(e)=>toggleSelectSolo(si,e));
            } else {
                pill.addEventListener('click',()=>editSoloChar(si));
            }
            pill.addEventListener('dragstart',e=>onCharDragStart(e,'solo',-1,si));
            pill.addEventListener('dragend',onCharDragEnd);
            soloBox.appendChild(pill);
        });
    }
    if(typeof autoSave==='function')autoSave();
    if(typeof renderSidebar==='function')renderSidebar();
    // Story NPC section
    renderStoryNpcList();
    var _snpSel=document.getElementById('storyNpcPicker');
    if(_snpSel){_snpSel.innerHTML='';populateStoryNpcPicker();}
    // keep export selector in sync whenever groups/solo change
    if(document.getElementById('tab-export')?.classList.contains('active'))renderExportGroupSelect();
}

// ── Solo character management ──
function createSoloChar(){
    _showFirstCreateWarning();
    const raw=document.getElementById('newGrpName').value.trim();
    let archId;
    if(raw){
        archId=sanitizeLuaId(raw,'solo_char');
        if(soloChars.find(c=>c.archId===archId)){let n=2;while(soloChars.find(c=>c.archId===archId+'_'+n))n++;archId=archId+'_'+n;}
    }else{
        archId='solo_char_'+(soloChars.length+1);
    }
    soloChars.push({archId,displayName:'',ov:{},_solo:true,defaults:mkDefaults()});
    renderGroupList();setStatus('Created solo character.','ok');
}
function rmSoloChar(si){
    const ch=soloChars[si];
    const _at=ch&&ch.ov&&ch.ov.settings&&ch.ov.settings.assignTo||'';
    const _snpc=(_at&&typeof STORY_NPC_LOOKUP!=='undefined')?STORY_NPC_LOOKUP[_at]:null;
    const removed=_snpc?_snpc.name:(ch?.archId||'character');
    const label=_snpc?('story NPC "'+removed+'" ('+_snpc.loc+')'):('solo character "'+removed+'"');
    if(!confirm('Delete '+label+'? This cannot be undone.'))return;
    soloChars.splice(si,1);
    if(editMode==='solo'&&curSolo===si){editMode=null;curSolo=null;updateModeBar();}
    else if(editMode==='solo'&&curSolo!==null&&curSolo>si){curSolo--;updateModeBar();}
    renderGroupList();setStatus('Deleted '+label+'.','warn');
}
// Returns the STORY_NPC_LOOKUP entry if the current selection is a story NPC, else null
function getCurrentStoryNpc(){
    if(editMode!=='solo'||curSolo===null)return null;
    var ch=soloChars[curSolo];if(!ch)return null;
    var at=(ch.ov&&ch.ov.settings&&ch.ov.settings.assignTo)||(ch.defaults&&ch.defaults.settings&&ch.defaults.settings.assignTo)||'';
    return(at&&typeof STORY_NPC_LOOKUP!=='undefined')?STORY_NPC_LOOKUP[at]||null:null;
}

function editSoloChar(si){
    editMode='solo';curSolo=si;curGrp=null;curChar=null;
    curVanillaServiceIdx=null;
    var _at=(soloChars[si]&&soloChars[si].ov&&soloChars[si].ov.settings&&soloChars[si].ov.settings.assignTo)||'';
    // Lazy-init vanilla services for story NPCs loaded from localStorage
    if(_at&&typeof STORY_NPC_LOOKUP!=='undefined'&&STORY_NPC_LOOKUP[_at]){
        var ch=soloChars[si];
        var dlg=ch&&ch.ov&&ch.ov.dlg;
        if(dlg&&!Array.isArray(dlg.vanillaServices)){
            dlg.vanillaServices=_buildVanillaServiceTrees(_at,STORY_NPC_LOOKUP[_at].block);
        }
    }
    updateAssignToTabVisibility(_at);
    updateModeBar();renderGroupList();
    switchTab(_at?'arch':'settings');
}

// ── Drag-and-drop between groups and solo ──
let _dragSrc=null; // {type:'group'|'solo', gi, ci}
function onCharDragStart(e,type,gi,ci){
    _dragSrc={type,gi,ci};
    e.dataTransfer.effectAllowed='move';
    e.target.classList.add('dragging-pill');
}
function onCharDragEnd(e){e.target.classList.remove('dragging-pill');}
function dropCharOnto(destType,destGi,e){
    e.preventDefault();
    if(!_dragSrc)return;
    // Get the character being moved
    let ch;
    if(_dragSrc.type==='group'){
        ch=groups[_dragSrc.gi]?.chars[_dragSrc.ci];
        if(!ch)return;
        ch=JSON.parse(JSON.stringify(ch)); // deep copy before removal
        rmChar(_dragSrc.gi,_dragSrc.ci);  // remove from source
    } else {
        ch=soloChars[_dragSrc.ci];
        if(!ch)return;
        ch=JSON.parse(JSON.stringify(ch));
        soloChars.splice(_dragSrc.ci,1);  // remove from solo
        if(editMode==='solo'&&curSolo===_dragSrc.ci){editMode=null;curSolo=null;updateModeBar();}
    }
    // Place at destination
    if(destType==='solo'){
        // Merge group defaults into char so nothing is lost when leaving the group
        if(_dragSrc.type==='group'){
            const srcG=groups[_dragSrc.gi];
            if(srcG){
                ['settings','trade','dlg'].forEach(tab=>{
                    const def=srcG.defaults[tab];
                    if(def&&!ch.ov?.[tab]){
                        // Char had no override — adopt group defaults as its own
                        ch.ov=ch.ov||{};
                        ch.ov[tab]=dc(def);
                    }
                });
            }
        }
        ch._solo=true;
        ch.defaults=ch.defaults||mkDefaults();
        soloChars.push(ch);
    } else {
        delete ch._solo;delete ch.defaults;
        groups[destGi].chars.push(ch);
    }
    _dragSrc=null;
    renderGroupList();autoSave();
}

function onArchIdInput(raw){
    let ch;
    if(editMode==='solo'&&curSolo!==null){ch=soloChars[curSolo];}
    else if(editMode==='char'&&curGrp!==null){ch=groups[curGrp].chars[curChar];}
    else return;
    const prev=sanitizeLuaId(ch.archId,'');
    const next=sanitizeLuaId(raw,prev||'arch_entry');
    ch.archId=next;
    if(!String(ch.displayName||'').trim()){
        const nice=titleCaseWords(next.replace(/^arch_/,'').replace(/_/g,' '));
        ch.displayName=nice;
        const dn=document.getElementById('f_displayName');if(dn)dn.value=nice;
    }
    syncDialogId();updateModeBar();renderGroupList();
    if(typeof autoSave==='function')autoSave();
    if(typeof validateArchId==='function')validateArchId(raw);
}

// ═══════════════════════════════════════════
// STORY NPC — Unique Vanilla NPCs
// ═══════════════════════════════════════════

function populateStoryNpcPicker(){
    var sel=document.getElementById('storyNpcPicker');
    if(!sel||sel.options.length>1)return;
    sel.innerHTML='<option value="">-- Select a Vanilla NPC --</option>';
    var locs={};
    STORY_NPCS.forEach(function(n){
        if(!locs[n.loc])locs[n.loc]=[];
        locs[n.loc].push(n);
    });
    Object.keys(locs).forEach(function(loc){
        var grp=document.createElement('optgroup');
        grp.label=loc;
        locs[loc].forEach(function(n){
            var opt=document.createElement('option');
            opt.value=n.id;
            opt.textContent=n.name+' — '+n.role;
            // Grey out already-added NPCs
            if(soloChars.some(function(c){return c.ov&&c.ov.settings&&c.ov.settings.assignTo===n.id;}))
                {opt.disabled=true;opt.textContent+=' (added)';}
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });
}

// Convert vanilla dialog phrase data into generator dialog tree format
function _buildStoryNpcDialogTrees(npcId,archId){
    var vanillaData=STORY_NPC_VANILLA_DIALOG_DATA[npcId];
    if(!vanillaData)return[];
    var trees=[];
    var treeIdx=0;
    Object.keys(vanillaData).forEach(function(dialogId){
        var dlg=vanillaData[dialogId];
        var phrases=dlg.phrases||[];
        if(!phrases.length)return;
        // Build phrase lookup
        var byId={};
        phrases.forEach(function(p){byId[p.id]=p;});
        // Phrase 0 is always the opener (actor or NPC)
        var p0=byId['0'];
        if(!p0)return;
        // Determine dialog structure:
        // Simple: opener (actor) -> response (NPC) -> end
        // Hub: opener (actor) -> hub (NPC) -> choices -> nodes
        var openerText=p0.text||dialogId;
        // Find the hub phrase (first NPC response after opener)
        var hubPhraseId=(p0.next&&p0.next[0])||null;
        var hubPhrase=hubPhraseId?byId[hubPhraseId]:null;
        var hubText=hubPhrase?(hubPhrase.text||'...'):'...';
        // Build hub choices from hub's next refs
        var hubChoices=[];
        var nodes={};
        var nodeCounter=1;
        if(hubPhrase&&hubPhrase.next&&hubPhrase.next.length){
            hubPhrase.next.forEach(function(nextId){
                var choicePhrase=byId[nextId];
                if(!choicePhrase)return;
                var choiceText=choicePhrase.text||'...';
                // Check if this choice leads to an NPC response
                var responseId=(choicePhrase.next&&choicePhrase.next[0])||null;
                var responsePhrase=responseId?byId[responseId]:null;
                var choice={text:choiceText,next:'__end__'};
                if(choicePhrase.action)choice.action=choicePhrase.action;
                if(choicePhrase.precondition)choice.precondition=choicePhrase.precondition;
                if(choicePhrase.has_info)choice.hasInfo=choicePhrase.has_info;
                if(choicePhrase.dont_has_info)choice.dontHasInfo=choicePhrase.dont_has_info;
                if(choicePhrase.give_info)choice.giveInfo=choicePhrase.give_info;
                if(responsePhrase){
                    var nodeId='n'+nodeCounter++;
                    var npcResponse=responsePhrase.text||'...';
                    var node={npc:npcResponse,label:'',choices:[{text:'Continue',next:'__hub__'}]};
                    if(responsePhrase.action)node.action=responsePhrase.action;
                    if(responsePhrase.give_info)node.giveInfo=responsePhrase.give_info;
                    if(responsePhrase.has_info)node.hasInfo=responsePhrase.has_info;
                    if(responsePhrase.dont_has_info)node.dontHasInfo=responsePhrase.dont_has_info;
                    // Check if response leads to more choices (deeper tree)
                    if(responsePhrase.next&&responsePhrase.next.length){
                        var subChoices=[];
                        responsePhrase.next.forEach(function(subNextId){
                            var subPhrase=byId[subNextId];
                            if(!subPhrase)return;
                            var sc={text:subPhrase.text||'...',next:'__end__'};
                            if(subPhrase.action)sc.action=subPhrase.action;
                            if(subPhrase.precondition)sc.precondition=subPhrase.precondition;
                            if(subPhrase.give_info)sc.giveInfo=subPhrase.give_info;
                            // Check if sub-choice leads to another NPC response
                            var subRespId=(subPhrase.next&&subPhrase.next[0])||null;
                            var subResp=subRespId?byId[subRespId]:null;
                            if(subResp){
                                var subNodeId='n'+nodeCounter++;
                                nodes[subNodeId]={npc:subResp.text||'...',label:'',choices:[{text:'OK',next:'__hub__'}]};
                                if(subResp.action)nodes[subNodeId].action=subResp.action;
                                if(subResp.give_info)nodes[subNodeId].giveInfo=subResp.give_info;
                                sc.next=subNodeId;
                            }
                            subChoices.push(sc);
                        });
                        if(subChoices.length)node.choices=subChoices;
                    }
                    nodes[nodeId]=node;
                    choice.next=nodeId;
                }
                hubChoices.push(choice);
            });
        }
        // If no hub choices but hub has text, it's a simple linear dialog
        if(!hubChoices.length&&hubText!=='...'){
            hubChoices.push({text:'I see.',next:'__end__'});
        }
        treeIdx++;
        var tree={
            id:'dlg_'+treeIdx,
            label:_formatDialogLabel(dialogId),
            _sourceDialogId:dialogId,
            opener:openerText,
            hub:hubText,
            hubChoices:hubChoices,
            nodes:nodes,
            layout:{}
        };
        // Carry dialog-level metadata
        if(hubPhrase&&hubPhrase.action)tree.hubAction=hubPhrase.action;
        if(hubPhrase&&hubPhrase.script_text)tree.hubScriptText=hubPhrase.script_text;
        if(hubPhrase&&hubPhrase.give_info)tree.hubGiveInfo=hubPhrase.give_info;
        trees.push(tree);
    });
    return trees;
}
function _formatDialogLabel(dialogId){
    // Turn dialog_id into a readable label
    return dialogId.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();}).replace(/^Sidorovich |^Sakharov |^Dushman |^Barkeep /,'');
}

// Build vanilla service dialog trees for a story NPC based on their actual dialog list
function _buildVanillaServiceTrees(npcId,block){
    if(typeof getStoryNpcServiceCategories!=='function')return[];
    if(typeof STORY_NPC_SERVICE_TREES==='undefined')return[];
    var cats=getStoryNpcServiceCategories(npcId);
    var trees=[];
    cats.forEach(function(cat){
        var catTrees=STORY_NPC_SERVICE_TREES[cat.id];
        if(!catTrees)return;
        // Pick block-specific tree or _default
        var treeData=catTrees[block]||catTrees._default;
        if(!treeData)return;
        trees.push({
            id:'vsvc_'+cat.id,
            label:cat.label,
            _vanillaService:true,
            _serviceCatId:cat.id,
            opener:treeData.opener||'',
            hub:treeData.hub||'',
            hubChoices:dc(treeData.hubChoices||[]),
            nodes:dc(treeData.nodes||{}),
            layout:{}
        });
    });
    return trees;
}

function addStoryNpc(){
    _showFirstCreateWarning();
    var sel=document.getElementById('storyNpcPicker');
    if(!sel||!sel.value)return;
    var npcId=sel.value;
    var npc=STORY_NPC_LOOKUP[npcId];
    if(!npc)return;
    // Check if already added
    if(soloChars.some(function(c){return c.ov&&c.ov.settings&&c.ov.settings.assignTo===npcId;})){
        setStatus(npc.name+' is already added.','warn');return;
    }
    // Create solo character with assign_to pre-set
    var archId=sanitizeLuaId('story_'+npcId,'story_npc');
    var defaults=mkDefaults();
    defaults.settings.assignTo=npcId;
    defaults.settings.stripCategories=[];
    var ch={archId:archId,displayName:npc.name,ov:{settings:{assignTo:npcId}},_solo:true,defaults:defaults};
    // Story NPCs start with empty custom dialogs — no default "Dialog 1" opener.
    var dlgData=dc(DEFAULT_DLG);
    dlgData.dialogs=[];
    // Pre-populate from vanilla dialog data if available
    if(typeof STORY_NPC_VANILLA_DIALOG_DATA!=='undefined'&&STORY_NPC_VANILLA_DIALOG_DATA[npcId]){
        dlgData.dialogs=_buildStoryNpcDialogTrees(npcId,archId);
    }
    // Build vanilla service trees for this NPC
    dlgData.vanillaServices=_buildVanillaServiceTrees(npcId,npc.block);
    ch.ov.dlg=dlgData;
    soloChars.push(ch);
    curSolo=soloChars.length-1;editMode='solo';curGrp=null;curChar=null;
    autoSave();updateModeBar();renderGroupList();renderStoryNpcList();
    updateAssignToTabVisibility(npcId);
    // Reset picker
    sel.innerHTML='';populateStoryNpcPicker();sel.value='';
    setStatus('Added '+npc.name+' ('+npc.loc+')','ok');
}

function renderStoryNpcList(){
    var el=document.getElementById('storyNpcList');
    if(!el)return;
    var html='';
    soloChars.forEach(function(c,si){
        var assignTo=(c.ov&&c.ov.settings&&c.ov.settings.assignTo)||(c.defaults&&c.defaults.settings&&c.defaults.settings.assignTo)||'';
        if(!assignTo)return;
        var npc=(typeof STORY_NPC_LOOKUP!=='undefined')?STORY_NPC_LOOKUP[assignTo]:null;
        if(!npc)return;
        var label=npc.name+' — '+npc.loc;
        var active=editMode==='solo'&&curSolo===si;
        var dlgCount=(typeof STORY_NPC_DIALOGS!=='undefined'&&STORY_NPC_DIALOGS[assignTo])?STORY_NPC_DIALOGS[assignTo].length:0;
        var uniqueCount=(typeof getStoryNpcUniqueDialogs==='function')?getStoryNpcUniqueDialogs(assignTo).length:0;
        var dlgBadge=dlgCount?'<span style="font-size:9px;color:#888;margin-left:4px" title="'+dlgCount+' vanilla dialogs ('+uniqueCount+' unique)">'+dlgCount+'d</span>':'';
        html+='<span class="char-pill'+(active?' active':'')+'" onclick="editSoloChar('+si+')" style="cursor:pointer;padding:4px 10px">';
        html+='<span style="color:'+(active?'#ffe082':'#ccc')+'">'+esc(label)+'</span>'+dlgBadge;
        html+='<button class="char-del-btn" title="Remove" onclick="event.stopPropagation();rmSoloChar('+si+')">×</button>';
        html+='</span>';
    });
    el.innerHTML=html;
}

function updateAssignToTabVisibility(val){
    var isStory=!!(val&&typeof STORY_NPC_LOOKUP!=='undefined'&&STORY_NPC_LOOKUP[val]);
    var settingsTab=document.querySelector('.tb[data-tab="settings"]');
    var tradeTab=document.querySelector('.tb[data-tab="trade"]');
    var dialogsTab=document.querySelector('.tb[data-tab="dialogs"]');
    var _disTab=function(tab,hide){
        if(!tab)return;
        tab.disabled=hide;tab.style.opacity=hide?'0.35':'';
        tab.style.pointerEvents=hide?'none':'';
        tab.title=hide?'Not available for Unique Vanilla NPCs':'';
    };
    _disTab(settingsTab,isStory);
    _disTab(tradeTab,isStory);
    if(isStory){
        var activeTab=document.querySelector('.tb.active');
        if(activeTab&&(activeTab.dataset.tab==='settings'||activeTab.dataset.tab==='trade')){
            var archTab=document.querySelector('.tb[data-tab="arch"]');
            if(archTab)archTab.click();
        }
        renderStoryNpcInfoCard();
    } else {
        var card=document.getElementById('storyNpcInfoCard');
        if(card)card.remove();
    }
}

// ═══════════════════════════════════════════
// STORY NPC INFO CARD
// ═══════════════════════════════════════════

function renderStoryNpcInfoCard(){
    var npc=getCurrentStoryNpc();
    if(!npc)return;
    var el=document.getElementById('storyNpcInfoCard');
    if(!el){
        el=document.createElement('div');
        el.id='storyNpcInfoCard';
        // Insert at top of tab-arch, after the create/solo sections
        var archTab=document.getElementById('tab-arch');
        if(!archTab)return;
        var storySection=document.getElementById('storyNpcSection');
        if(storySection&&storySection.nextElementSibling){
            archTab.insertBefore(el,storySection.nextElementSibling);
        } else {
            archTab.appendChild(el);
        }
    }

    // Gather vanilla dialog info
    var vanillaDlgs=(typeof STORY_NPC_DIALOGS!=='undefined')?STORY_NPC_DIALOGS[npc.id]||[]:[];
    var uniqueDlgs=(typeof getStoryNpcUniqueDialogs==='function')?getStoryNpcUniqueDialogs(npc.id):[];
    var commonDlgs=(typeof STORY_NPC_COMMON_DIALOGS!=='undefined')?STORY_NPC_COMMON_DIALOGS:{};

    // Classify vanilla dialogs by category
    var commonSet=new Set();
    Object.values(commonDlgs).forEach(function(arr){arr.forEach(function(d){commonSet.add(d);});});

    // Determine services from block and vanilla dialogs
    var services=[];
    if(npc.block==='trader')services.push('Trade');
    if(npc.block==='tech')services.push('Repair/Upgrade');
    if(npc.block==='medic')services.push('Healing');
    if(npc.block==='barman')services.push('Food/Drink');
    if(vanillaDlgs.indexOf('dm_ordered_task_dialog')>=0)services.push('Tasks');
    if(vanillaDlgs.indexOf('dm_broker_dialog')>=0)services.push('Broker');

    // Build service dialog list
    var svcHtml='';
    vanillaDlgs.forEach(function(d){
        if(commonSet.has(d)||d.indexOf('_meet_dialog')>=0||d.indexOf('_game_start_dialog')>=0||d.indexOf('drx_sl_mechanic_task_dialog')>=0)return;
        svcHtml+='<span style="display:inline-block;background:#2a2a2a;color:#bbb;padding:2px 8px;border-radius:3px;font-size:11px;margin:2px">'+esc(d)+'</span>';
    });

    var iconPath='icons/story_npcs/'+npc.id+'.png';
    var h='<div style="background:#1a1a1a;border:1px solid #444;border-radius:6px;padding:16px;margin:12px 0">';
    h+='<div style="display:flex;gap:14px;align-items:flex-start">';
    h+='<img src="'+iconPath+'" alt="" style="width:123px;height:87px;border-radius:4px;border:1px solid #555;flex-shrink:0;image-rendering:pixelated" onerror="this.style.display=\'none\'">';
    h+='<div style="flex:1;display:flex;justify-content:space-between;align-items:flex-start">';
    h+='<div>';
    h+='<div style="font-size:18px;font-weight:bold;color:#ffe082">'+esc(npc.name)+'</div>';
    h+='<div style="color:#999;font-size:13px;margin-top:2px">'+esc(npc.role)+' — '+esc(npc.loc)+'</div>';
    h+='</div>';
    h+='<div style="text-align:right">';
    h+='<div style="font-size:11px;color:#666">Archetype ID</div>';
    h+='<div style="font-family:monospace;color:#82b1ff;font-size:12px">story_'+esc(npc.id)+'</div>';
    h+='</div>';
    h+='</div>';
    h+='</div>';

    // Services row
    h+='<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">';
    services.forEach(function(s){
        h+='<span style="background:#2d3a2d;color:#a5d6a7;padding:3px 10px;border-radius:12px;font-size:11px">'+esc(s)+'</span>';
    });
    h+='</div>';

    // Vanilla dialogs
    h+='<div style="margin-top:12px">';
    h+='<div style="color:#888;font-size:11px;margin-bottom:4px">Vanilla dialogs ('+vanillaDlgs.length+' total, '+uniqueDlgs.length+' unique to this NPC)</div>';
    if(svcHtml){
        h+='<div style="display:flex;flex-wrap:wrap;gap:0">'+svcHtml+'</div>';
    } else {
        h+='<div style="color:#555;font-size:11px;font-style:italic">No unique dialogs</div>';
    }
    h+='</div>';

    // Safety note
    h+='<div style="margin-top:10px;color:#666;font-size:11px">This NPC is <span style="color:#a5d6a7">SAFE</span> — immortal, fixed location, persists across saves. Your pack adds dialogs and tasks on top of vanilla.</div>';

    h+='</div>';
    el.innerHTML=h;
}

// ═══════════════════════════════════════════
// CONNECTED ARCHETYPES
// ═══════════════════════════════════════════
// Visual grouping of archetypes that interact (tasks, dialogs, chains).
// Stored in global `connGroups` array: [{name, members:[{archId, src:'solo'|'group', gi, ci, si}]}]
// Does NOT affect export — purely organizational.

if(typeof connGroups==='undefined')var connGroups=[];

function createConnGroup(){
    const inp=document.getElementById('newConnGroupName');
    const name=(inp?inp.value.trim():'')||'connection_'+(connGroups.length+1);
    connGroups.push({name,members:[]});
    if(inp)inp.value='';
    renderConnGroups();autoSave();
    setStatus(`Created connection group '${name}'.`,'ok');
}
function rmConnGroup(idx){
    if(!confirm('Delete connection group "'+connGroups[idx].name+'"?'))return;
    connGroups.splice(idx,1);
    renderConnGroups();autoSave();
}
function renameConnGroup(idx,val){
    connGroups[idx].name=String(val||'').trim()||('connection_'+(idx+1));
    autoSave();
}
function rmConnMember(gi,mi){
    connGroups[gi].members.splice(mi,1);
    renderConnGroups();autoSave();
}
function dropCharOntoConn(connIdx,e){
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if(!_dragSrc)return;
    // Resolve archId from drag source
    let archId='';
    if(_dragSrc.type==='group'){
        archId=groups[_dragSrc.gi]?.chars[_dragSrc.ci]?.archId||'';
    } else {
        archId=soloChars[_dragSrc.ci]?.archId||'';
    }
    if(!archId)return;
    // Don't add duplicates
    const cg=connGroups[connIdx];
    if(cg.members.find(m=>m.archId===archId))return;
    cg.members.push({archId, src:_dragSrc.type, gi:_dragSrc.gi, ci:_dragSrc.ci});
    // Don't remove from source — connections are references, not moves
    _dragSrc=null;
    renderConnGroups();autoSave();
}
// Scan all task pools for archetype target references → {archId: [{kind, taskLabel}]}
function _getTaskArchRefs(){
    var refs={};
    function scan(pools){
        if(!Array.isArray(pools))return;
        pools.forEach(function(p){
            (p.tasks||[]).forEach(function(t){
                var aid=null,kind='';
                if(t.type==='delivery'&&t.deliverToArchetype){aid=t.deliverToArchetype;kind='📦 Delivery';}
                if(t.type==='talk'&&t.talkToArchetype&&!t.talkToGiver){aid=t.talkToArchetype;kind='💬 Talk';}
                if(t.type==='collect'&&t.collectFromArchetype){aid=t.collectFromArchetype;kind='📋 Collect';}
                if(aid){
                    if(!refs[aid])refs[aid]=[];
                    refs[aid].push({kind:kind,label:t.openingDialogue||t.id||''});
                }
            });
        });
    }
    var d=getDlg();
    if(d){scan(d.taskPools);scan(d.customPools);}
    return refs;
}

function renderConnGroups(){
    const el=document.getElementById('connGroupList');
    if(!el)return;
    const taskRefs=_getTaskArchRefs();
    if(!connGroups.length){el.innerHTML='<div style="color:#666;font-size:12px;padding:4px 0">No connection groups yet.</div>';return;}
    let html='';
    connGroups.forEach((cg,gi)=>{
        let members='';
        cg.members.forEach((m,mi)=>{
            const valid=_resolveConnMember(m);
            const loc=_findArchLocation(m.archId);
            const clickFn=loc?('onclick="'+loc.fn+'"'):'';
            const activeClass=(loc&&loc.active)?'active':'';
            // Task relationship badges
            const trefs=taskRefs[m.archId];
            let badges='';
            if(trefs){
                var seen={};
                trefs.forEach(function(r){
                    var icon=r.kind.indexOf('📦')>=0?'📦':r.kind.indexOf('💬')>=0?'💬':'📋';
                    if(seen[icon])return;seen[icon]=true;
                    badges+=' <i class="bi" style="font-size:10px" title="'+esc(r.kind+' target: '+r.label)+'">'+icon+'</i>';
                });
            }
            members+='<span class="char-pill '+activeClass+(valid?'':' orphan')+'" '+clickFn+'>'
                +esc(m.archId)+badges
                +'<button class="char-del-btn" title="Remove from connection" onclick="event.stopPropagation();rmConnMember('+gi+','+mi+')">×</button>'
                +'</span>';
        });
        html+='<div class="grp-card" style="border-left:3px solid #82b1ff"'
            +' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"'
            +' ondragleave="this.classList.remove(\'drag-over\')"'
            +' ondrop="dropCharOntoConn('+gi+',event)">'
            +'<div style="display:flex;justify-content:space-between;align-items:center">'
            +'<h3 style="color:#82b1ff"><span contenteditable="true" spellcheck="false" onblur="renameConnGroup('+gi+',this.textContent)">'+esc(cg.name)+'</span> ('+cg.members.length+')</h3>'
            +'<button class="btn bd bs" onclick="rmConnGroup('+gi+')">Delete</button>'
            +'</div>'
            +'<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;min-height:24px">'
            +(members||'<span style="color:#555;font-size:11px">Drag archetypes here</span>')
            +'</div>'
            +'</div>';
    });
    el.innerHTML=html;
}
// Find where an archId lives (solo or group) and return click handler + active state
function _findArchLocation(archId){
    for(let s=0;s<soloChars.length;s++){
        if(soloChars[s].archId===archId)return{fn:'editSoloChar('+s+')',active:editMode==='solo'&&curSolo===s};
    }
    for(let g=0;g<groups.length;g++){
        for(let c=0;c<groups[g].chars.length;c++){
            if(groups[g].chars[c].archId===archId)return{fn:'editChar('+g+','+c+')',active:editMode==='char'&&curGrp===g&&curChar===c};
        }
    }
    return null;
}
// Check if an archId belongs to any connection group
function getConnGroupsForArch(archId){
    const result=[];
    connGroups.forEach(cg=>{if(cg.members.find(m=>m.archId===archId))result.push(cg.name);});
    return result;
}
function _resolveConnMember(m){
    // Check if the archId still exists in groups or solo
    for(let g=0;g<groups.length;g++){
        for(let c=0;c<groups[g].chars.length;c++){
            if(groups[g].chars[c].archId===m.archId)return true;
        }
    }
    for(let s=0;s<soloChars.length;s++){
        if(soloChars[s].archId===m.archId)return true;
    }
    return false;
}

