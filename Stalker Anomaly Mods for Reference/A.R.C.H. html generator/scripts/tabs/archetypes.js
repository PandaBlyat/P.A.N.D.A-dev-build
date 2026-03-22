// ═══════════════════════════════════════════
// GROUP & CHARACTER MANAGEMENT
// ═══════════════════════════════════════════

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
        mt.innerHTML='SOLO: <span style="color:#ff8c00">'+esc(soloChars[curSolo]?.archId||'?')+'</span>';
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
    // keep export selector in sync whenever groups/solo change
    if(document.getElementById('tab-export')?.classList.contains('active'))renderExportGroupSelect();
}

// ── Solo character management ──
function createSoloChar(){
    const name=document.getElementById('newGrpName').value.trim()||'solo_char';
    soloChars.push({archId:name+'_'+(soloChars.length+1),displayName:'',ov:{},_solo:true,defaults:mkDefaults()});
    renderGroupList();setStatus('Created solo character.','ok');
}
function rmSoloChar(si){
    const removed=soloChars[si]?.archId||'character';
    if(!confirm(`Delete solo character "${removed}"? This cannot be undone.`))return;
    soloChars.splice(si,1);
    if(editMode==='solo'&&curSolo===si){editMode=null;curSolo=null;updateModeBar();}
    else if(editMode==='solo'&&curSolo!==null&&curSolo>si){curSolo--;updateModeBar();}
    renderGroupList();setStatus(`Deleted solo character '${removed}'.`,'warn');
}
function editSoloChar(si){
    editMode='solo';curSolo=si;curGrp=null;curChar=null;
    updateModeBar();renderGroupList();switchTab('settings');
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

