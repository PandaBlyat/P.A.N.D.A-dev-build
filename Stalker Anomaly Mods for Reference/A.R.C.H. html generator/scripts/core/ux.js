// ═══════════════════════════════════════════
// ZIP BUILDER (pure JS, no dependencies)
// ═══════════════════════════════════════════
function crc32(buf){
    const t=new Int32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xEDB88320^(c>>>1):(c>>>1);t[i]=c;}
    let crc=0xFFFFFFFF;for(let i=0;i<buf.length;i++)crc=t[(crc^buf[i])&0xFF]^(crc>>>8);return(crc^0xFFFFFFFF)>>>0;
}

function buildZip(files){
    const te=new TextEncoder();
    const entries=files.map(f=>({path:te.encode(f.path),data:te.encode(f.data)}));
    let offset=0;const locals=[],centrals=[];
    for(const e of entries){
        const cr=crc32(e.data);
        const lh=new Uint8Array(30+e.path.length);const lv=new DataView(lh.buffer);
        lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(8,0,true);
        lv.setUint32(14,cr,true);lv.setUint32(18,e.data.length,true);lv.setUint32(22,e.data.length,true);
        lv.setUint16(26,e.path.length,true);lh.set(e.path,30);
        locals.push(lh);
        const ch=new Uint8Array(46+e.path.length);const cv=new DataView(ch.buffer);
        cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
        cv.setUint32(16,cr,true);cv.setUint32(20,e.data.length,true);cv.setUint32(24,e.data.length,true);
        cv.setUint16(28,e.path.length,true);cv.setUint32(42,offset,true);ch.set(e.path,46);
        centrals.push(ch);
        offset+=lh.length+e.data.length;
    }
    const cdOff=offset;let cdSz=0;centrals.forEach(c=>cdSz+=c.length);
    const ecd=new Uint8Array(22);const ev=new DataView(ecd.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
    ev.setUint32(12,cdSz,true);ev.setUint32(16,cdOff,true);
    const zip=new Uint8Array(offset+cdSz+22);let pos=0;
    for(let i=0;i<entries.length;i++){zip.set(locals[i],pos);pos+=locals[i].length;zip.set(entries[i].data,pos);pos+=entries[i].data.length;}
    for(const c of centrals){zip.set(c,pos);pos+=c.length;}
    zip.set(ecd,pos);return zip;
}

function copyCode(elId,btn){
    const txt=document.getElementById(elId)?.textContent||'';
    navigator.clipboard.writeText(txt).then(()=>{btn.textContent='✓ Copied!';btn.classList.add('copy-ok');setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copy-ok');},2000);
    }).catch(()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);btn.textContent='✓ Copied!';setTimeout(()=>{btn.textContent='Copy';},2000);});
}

// ═══════════════════════════════════════════
// PROJECT PERSISTENCE (autosave + IndexedDB backups)
// ═══════════════════════════════════════════
const SAVE_KEY='arch_gen_v5_project';
const BACKUP_DB='arch_backups';
const BACKUP_STORE='snapshots';
const BACKUP_MAX=10;
let _backupDb=null;
let _backupThrottle=0;

function _getProjectData(){
    return{groups,soloChars,connGroups:typeof connGroups!=='undefined'?connGroups:[],savedCategories:typeof savedCategories!=='undefined'?savedCategories:[],_v:5};
}
let _autoSaveTimer=0;
function autoSave(){
    // Debounce: actual write happens 300ms after last call
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer=setTimeout(_doAutoSave,300);
}
function _doAutoSave(){
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(_getProjectData()));}catch(e){}
    // Throttled backup: at most once per 5 minutes
    const now=Date.now();
    if(now-_backupThrottle>300000){
        _backupThrottle=now;
        _backupSnapshot();
    }
}

// ── IndexedDB backup system ──
function _openBackupDb(){
    return new Promise((resolve,reject)=>{
        if(_backupDb){resolve(_backupDb);return;}
        const req=indexedDB.open(BACKUP_DB,1);
        req.onupgradeneeded=()=>{
            const db=req.result;
            if(!db.objectStoreNames.contains(BACKUP_STORE)){
                db.createObjectStore(BACKUP_STORE,{keyPath:'ts'});
            }
        };
        req.onsuccess=()=>{_backupDb=req.result;resolve(_backupDb);};
        req.onerror=()=>reject(req.error);
    });
}
function _backupSnapshot(){
    _openBackupDb().then(db=>{
        const data=JSON.parse(JSON.stringify(_getProjectData()));
        const groupCount=data.groups?data.groups.length:0;
        const soloCount=data.soloChars?data.soloChars.length:0;
        const charCount=(data.groups||[]).reduce((s,g)=>s+(g.chars?g.chars.length:0),0)+soloCount;
        const names=(data.groups||[]).map(g=>g.name).concat((data.soloChars||[]).map(c=>c.archId)).slice(0,6);
        const entry={
            ts:Date.now(),
            data:data,
            meta:{groupCount,soloCount,charCount,names}
        };
        const tx=db.transaction(BACKUP_STORE,'readwrite');
        const store=tx.objectStore(BACKUP_STORE);
        store.put(entry);
        // Trim to max
        const getAll=store.getAll();
        getAll.onsuccess=()=>{
            const all=getAll.result;
            if(all.length>BACKUP_MAX){
                all.sort((a,b)=>a.ts-b.ts);
                const toDelete=all.slice(0,all.length-BACKUP_MAX);
                toDelete.forEach(e=>store.delete(e.ts));
            }
        };
    }).catch(()=>{});
}
function _listBackups(){
    return _openBackupDb().then(db=>{
        return new Promise((resolve,reject)=>{
            const tx=db.transaction(BACKUP_STORE,'readonly');
            const req=tx.objectStore(BACKUP_STORE).getAll();
            req.onsuccess=()=>{
                const all=req.result;
                all.sort((a,b)=>b.ts-a.ts);
                resolve(all);
            };
            req.onerror=()=>reject(req.error);
        });
    });
}
function _restoreBackup(ts){
    return _openBackupDb().then(db=>{
        return new Promise((resolve,reject)=>{
            const tx=db.transaction(BACKUP_STORE,'readonly');
            const req=tx.objectStore(BACKUP_STORE).get(ts);
            req.onsuccess=()=>{
                const entry=req.result;
                if(!entry||!entry.data){reject('Backup not found');return;}
                const d=entry.data;
                if(Array.isArray(d.groups))groups=d.groups;
                if(Array.isArray(d.soloChars))soloChars=d.soloChars;
                if(Array.isArray(d.connGroups))connGroups=d.connGroups;
                autoSave();
                resolve();
            };
            req.onerror=()=>reject(req.error);
        });
    });
}
function _deleteBackup(ts){
    return _openBackupDb().then(db=>{
        return new Promise(resolve=>{
            const tx=db.transaction(BACKUP_STORE,'readwrite');
            tx.objectStore(BACKUP_STORE).delete(ts);
            tx.oncomplete=resolve;
        });
    });
}

// ── Download / Upload project file ──
function downloadProjectBackup(){
    const data=_getProjectData();
    data._backupDate=new Date().toISOString();
    const json=JSON.stringify(data,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='arch_project_backup_'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('Backup downloaded.','ok');
}
function uploadProjectBackup(file){
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
        try{
            const d=JSON.parse(reader.result);
            if(!Array.isArray(d.groups)&&!Array.isArray(d.soloChars)){
                alert('Invalid backup file — no groups or characters found.');return;
            }
            if(!confirm('Restore from backup? This will replace ALL current data.'))return;
            // Snapshot current state before overwriting
            _backupSnapshot();
            if(Array.isArray(d.groups))groups=d.groups;
            if(Array.isArray(d.soloChars))soloChars=d.soloChars;
            if(Array.isArray(d.connGroups))connGroups=d.connGroups;
            autoSave();
            editMode=null;curGrp=null;curChar=null;curSolo=null;
            updateModeBar();renderGroupList();
            setStatus('Restored from backup file.','ok');
        }catch(e){alert('Failed to parse backup file: '+e.message);}
    };
    reader.readAsText(file);
}

// ── Backup manager panel ──
function openBackupManager(){
    const panel=document.getElementById('backupPanel');
    if(!panel)return;
    panel.style.display='block';
    const cb=document.getElementById('closeBackupBtn');if(cb)cb.style.display='';
    panel.innerHTML='<div style="color:#888;font-size:12px">Loading backups...</div>';
    _listBackups().then(all=>{
        if(!all.length){
            panel.innerHTML='<div style="color:#888;font-size:12px;padding:8px 0">No automatic backups yet. They are created every 30 seconds while you work.</div>';
            return;
        }
        let html='<div style="font-size:11px;color:#888;margin-bottom:8px">'+all.length+' backup'+(all.length!==1?'s':'')+' (max '+BACKUP_MAX+')</div>';
        all.forEach(entry=>{
            const d=new Date(entry.ts);
            const time=d.toLocaleDateString()+' '+d.toLocaleTimeString();
            const m=entry.meta||{};
            const info=m.charCount?m.charCount+' characters':'';
            const names=(m.names||[]).slice(0,4).join(', ');
            html+=`<div class="backup-entry">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <span style="color:#ccc;font-size:12px">${esc(time)}</span>
                        <span style="color:#888;font-size:11px;margin-left:8px">${esc(info)}</span>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="btn b2 bs" onclick="restoreBackupConfirm(${entry.ts})">Restore</button>
                        <button class="btn bd bs" onclick="deleteBackupConfirm(${entry.ts})">×</button>
                    </div>
                </div>
                ${names?'<div style="color:#666;font-size:10px;margin-top:2px">'+esc(names)+'</div>':''}
            </div>`;
        });
        panel.innerHTML=html;
    }).catch(()=>{
        panel.innerHTML='<div style="color:#f08080;font-size:12px">Failed to load backups.</div>';
    });
}
function closeBackupManager(){
    const panel=document.getElementById('backupPanel');
    if(panel)panel.style.display='none';
    const cb=document.getElementById('closeBackupBtn');if(cb)cb.style.display='none';
}
function restoreBackupConfirm(ts){
    if(!confirm('Restore this backup? Current data will be backed up first, then replaced.'))return;
    _backupSnapshot(); // save current state before restoring
    _restoreBackup(ts).then(()=>{
        editMode=null;curGrp=null;curChar=null;curSolo=null;
        updateModeBar();renderGroupList();
        setStatus('Restored from backup.','ok');
        openBackupManager(); // refresh list
    }).catch(e=>alert('Restore failed: '+e));
}
function deleteBackupConfirm(ts){
    if(!confirm('Delete this backup?'))return;
    _deleteBackup(ts).then(()=>openBackupManager());
}

// Auto-load on page open — restore data eagerly; rendering deferred to init.js DOMContentLoaded
(function(){try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(raw){const d=JSON.parse(raw);if(Array.isArray(d.groups))groups=d.groups;if(Array.isArray(d.soloChars))soloChars=d.soloChars;if(Array.isArray(d.connGroups))connGroups=d.connGroups;if(Array.isArray(d.savedCategories))savedCategories=d.savedCategories;}
}catch(e){}})();
// Ensure first backup exists on load
setTimeout(_backupSnapshot,2000);
// ═══════════════════════════════════════════
// UX IMPROVEMENTS — SIDEBAR, PALETTE, BULK, DIFF
// ═══════════════════════════════════════════

// ── Sidebar ──
const SB_FAV_KEY='arch_sidebar_favs';
let _sbFavs=[];try{_sbFavs=JSON.parse(localStorage.getItem(SB_FAV_KEY)||'[]');}catch(e){_sbFavs=[];}
function toggleFav(key){
    const idx=_sbFavs.indexOf(key);
    if(idx>=0)_sbFavs.splice(idx,1);else _sbFavs.push(key);
    try{localStorage.setItem(SB_FAV_KEY,JSON.stringify(_sbFavs));}catch(e){}
    renderSidebar();
}
function toggleSidebar(){
    const sb=document.getElementById('archSidebar');
    const btn=document.getElementById('sidebarToggleBtn');
    if(!sb)return;
    const open=sb.classList.toggle('open');
    if(btn){
        btn.classList.toggle('open',open);
        btn.style.left=open?'220px':'0px';
    }
    if(open){renderSidebar();const inp=document.getElementById('sbSearchInput');if(inp)setTimeout(()=>inp.focus(),50);}
}

function renderSidebar(){
    const list=document.getElementById('sbList');
    if(!list)return;
    const sb=document.getElementById('archSidebar');
    if(!sb||!sb.classList.contains('open'))return;
    const q=(document.getElementById('sbSearchInput')?.value||'').toLowerCase();
    list.innerHTML='';
    function isActive(type,gi,ci,si){
        if(type==='group')return editMode==='group'&&curGrp===gi;
        if(type==='char')return editMode==='char'&&curGrp===gi&&curChar===ci;
        if(type==='solo')return editMode==='solo'&&curSolo===si;
        return false;
    }
    function favKey(type,gi,ci,si){return type==='solo'?'solo:'+si:type==='group'?'grp:'+gi:'char:'+gi+':'+ci;}
    function addItem(label,type,gi,ci,si,indent){
        if(q&&!label.toLowerCase().includes(q))return;
        const key=favKey(type,gi,ci,si);
        const isFav=_sbFavs.includes(key);
        const active=isActive(type,gi,ci,si);
        const div=document.createElement('div');
        div.className='sb-item'+(active?' active':'');
        div.style.paddingLeft=(indent||10)+'px';
        div.innerHTML=`<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</span><button class="sb-fav${isFav?' on':''}" onclick="event.stopPropagation();toggleFav('${key}')" title="Favourite">★</button>`;
        div.addEventListener('click',()=>{
            if(type==='group')editGroup(gi);
            else if(type==='char')editChar(gi,ci);
            else if(type==='solo')editSoloChar(si);
            renderSidebar();
        });
        list.appendChild(div);
    }
    // Favourites section
    const favItems=[];
    groups.forEach((g,gi)=>{
        if(_sbFavs.includes('grp:'+gi))favItems.push({label:'⚙ '+g.name,type:'group',gi,ci:-1,si:-1});
        g.chars.forEach((ch,ci)=>{if(_sbFavs.includes('char:'+gi+':'+ci))favItems.push({label:ch.archId,type:'char',gi,ci,si:-1});});
    });
    soloChars.forEach((ch,si)=>{if(_sbFavs.includes('solo:'+si))favItems.push({label:ch.archId,type:'solo',gi:-1,ci:-1,si});});
    if(favItems.length&&!q){
        const fh=document.createElement('div');fh.className='sb-group';fh.textContent='★ Favourites';list.appendChild(fh);
        favItems.forEach(f=>addItem(f.label,f.type,f.gi,f.ci,f.si,10));
        const sep=document.createElement('div');sep.style.cssText='height:1px;background:#222;margin:4px 0';list.appendChild(sep);
    }
    // Solo chars
    if(soloChars.length){
        const sh=document.createElement('div');sh.className='sb-group';sh.textContent='Solo';list.appendChild(sh);
        soloChars.forEach((ch,si)=>addItem(ch.archId,'solo',-1,-1,si,10));
    }
    // Groups
    groups.forEach((g,gi)=>{
        if(q&&!g.name.toLowerCase().includes(q)&&!g.chars.some(c=>c.archId.toLowerCase().includes(q)))return;
        const gh=document.createElement('div');gh.className='sb-group';gh.textContent=g.name;list.appendChild(gh);
        const gkey='grp:'+gi;const gFav=_sbFavs.includes(gkey);
        const gitem=document.createElement('div');
        gitem.className='sb-item'+(isActive('group',gi,-1,-1)?' active':'');
        gitem.style.paddingLeft='10px';
        gitem.innerHTML=`<span style="color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">⚙ Group settings</span><button class="sb-fav${gFav?' on':''}" onclick="event.stopPropagation();toggleFav('${gkey}')" title="Favourite">★</button>`;
        gitem.addEventListener('click',()=>{editGroup(gi);renderSidebar();});
        list.appendChild(gitem);
        g.chars.forEach((ch,ci)=>addItem(ch.archId,'char',gi,ci,-1,18));
    });
    if(!list.children.length){list.innerHTML='<div class="cmd-empty">No archetypes yet</div>';}
}

// ── Command Palette ──
let _cmdAllItems=[],_cmdItems=[],_cmdSel=0;
function buildCmdIndex(){
    const items=[];
    items.push({icon:'⚙',label:'Create New Group',hint:'',action:()=>{switchTab('arch');document.getElementById('newGrpName')?.focus();}});
    items.push({icon:'◈',label:'Create Solo Character',hint:'',action:()=>createSoloChar()});
    items.push({icon:'↓',label:'Export / Generate',hint:'Ctrl+Enter',action:()=>switchTab('export')});
    items.push({icon:'◀',label:'Toggle Sidebar',hint:'N',action:()=>toggleSidebar()});
    items.push({icon:'S',label:'Settings Tab',hint:'',action:()=>switchTab('settings')});
    items.push({icon:'T',label:'Trade Tab',hint:'',action:()=>switchTab('trade')});
    items.push({icon:'D',label:'Advanced / Dialogs Tab',hint:'',action:()=>switchTab('dialogs')});
    items.push({icon:'E',label:'Export Tab',hint:'',action:()=>switchTab('export')});
    groups.forEach((g,gi)=>{
        items.push({icon:'⚙',label:'Edit group: '+g.name,hint:'group',action:()=>{editGroup(gi);switchTab('settings');}});
        g.chars.forEach((ch,ci)=>{items.push({icon:'◉',label:ch.archId,hint:g.name,action:()=>{editChar(gi,ci);switchTab('settings');}});});
    });
    soloChars.forEach((ch,si)=>{items.push({icon:'◈',label:ch.archId+' (solo)',hint:'solo',action:()=>{editSoloChar(si);switchTab('settings');}});});
    return items;
}
function openCmdPalette(){
    const pal=document.getElementById('cmdPalette');if(!pal)return;
    pal.classList.remove('hidden');
    _cmdAllItems=buildCmdIndex();_cmdSel=0;
    const inp=document.getElementById('cmdInput');if(inp){inp.value='';inp.focus();}
    renderCmdItems(_cmdAllItems);
}
function closeCmdPalette(){
    const pal=document.getElementById('cmdPalette');if(pal)pal.classList.add('hidden');
}
function filterCmd(q){
    q=q.toLowerCase();
    _cmdItems=q?_cmdAllItems.filter(it=>it.label.toLowerCase().includes(q)||it.hint.toLowerCase().includes(q)):_cmdAllItems;
    _cmdSel=0;renderCmdItems(_cmdItems);
}
function renderCmdItems(items){
    const res=document.getElementById('cmdResults');if(!res)return;
    if(!items.length){res.innerHTML='<div class="cmd-empty">No results</div>';return;}
    res.innerHTML=items.slice(0,20).map((it,i)=>`<div class="cmd-item${i===_cmdSel?' sel':''}" data-i="${i}" onmouseenter="cmdHover(${i})" onclick="cmdExec(${i})"><span class="cmd-icon">${it.icon}</span><span class="cmd-label">${esc(it.label)}</span><span class="cmd-hint">${esc(it.hint)}</span></div>`).join('');
}
function cmdHover(i){_cmdSel=i;cmdHighlight();}
function cmdHighlight(){
    document.querySelectorAll('.cmd-item').forEach((el,i)=>el.classList.toggle('sel',i===_cmdSel));
    const sel=document.querySelector(`.cmd-item[data-i="${_cmdSel}"]`);
    if(sel)sel.scrollIntoView({block:'nearest'});
}
function cmdExec(i){const it=_cmdItems[i];if(it&&it.action){closeCmdPalette();it.action();}}
function onCmdKey(e){
    if(e.key==='Escape'){closeCmdPalette();return;}
    if(e.key==='ArrowDown'){e.preventDefault();_cmdSel=Math.min(_cmdSel+1,Math.min(_cmdItems.length,20)-1);cmdHighlight();return;}
    if(e.key==='ArrowUp'){e.preventDefault();_cmdSel=Math.max(_cmdSel-1,0);cmdHighlight();return;}
    if(e.key==='Enter'){e.preventDefault();cmdExec(_cmdSel);return;}
}

// ── Inline Validation ──
function validateArchId(raw){
    const fg=document.getElementById('f_archId')?.closest('.fg');if(!fg)return;
    let errEl=fg.querySelector('.field-err');
    if(!raw||!raw.trim()){
        fg.classList.add('field-invalid');
        if(!errEl){errEl=document.createElement('span');errEl.className='field-err';fg.appendChild(errEl);}
        errEl.textContent='Archetype ID is required';return;
    }
    if(!/^[a-zA-Z0-9_]+$/.test(raw.trim())){
        fg.classList.add('field-invalid');
        if(!errEl){errEl=document.createElement('span');errEl.className='field-err';fg.appendChild(errEl);}
        errEl.textContent='Only letters, digits and underscores';return;
    }
    fg.classList.remove('field-invalid');
    if(errEl)errEl.remove();
}

// ── Duplicate helpers ──
function dupChar(gi,ci){
    const src=groups[gi]?.chars[ci];if(!src)return;
    const clone=JSON.parse(JSON.stringify(src));
    clone.archId=src.archId+'_copy';clone.displayName=(src.displayName||src.archId)+'_copy';
    groups[gi].chars.splice(ci+1,0,clone);
    renderGroupList();setStatus(`Duplicated '${src.archId}'.`,'ok');
}
function dupSoloChar(si){
    const src=soloChars[si];if(!src)return;
    const clone=JSON.parse(JSON.stringify(src));
    clone.archId=src.archId+'_copy';clone.displayName=(src.displayName||src.archId)+'_copy';
    soloChars.splice(si+1,0,clone);
    renderGroupList();setStatus(`Duplicated '${src.archId}'.`,'ok');
}
function dupGroup(gi){
    const src=groups[gi];if(!src)return;
    const clone=JSON.parse(JSON.stringify(src));
    clone.name=src.name+'_copy';
    clone.chars.forEach(ch=>{ch.archId=ch.archId+'_copy';});
    groups.splice(gi+1,0,clone);
    renderGroupList();setStatus(`Duplicated group '${src.name}'.`,'ok');
}


(function() {
    var locked = false;
    var lockBtn = document.getElementById("archLockBtn");
    var overlay = document.getElementById("archLockOverlay");
    var unlockBtn = document.getElementById("archUnlockBtn");

    function setLock(on) {
        locked = on;
        if (overlay) overlay.hidden = !on;
        if (unlockBtn) unlockBtn.hidden = !on;
        if (lockBtn) {
            lockBtn.style.color = on ? "#ff8c00" : "#888";
            lockBtn.style.borderColor = on ? "rgba(255,140,0,0.5)" : "rgba(255,255,255,0.15)";
            lockBtn.title = on ? "Locked - click or press Escape to unlock" : "Lock generator (F2)";
        }
        var container = document.querySelector(".container");
        if (container) container.classList.toggle("arch-locked", on);
    }

    if (lockBtn) lockBtn.addEventListener("click", function() { setLock(!locked); });
    if (unlockBtn) unlockBtn.addEventListener("click", function() { setLock(false); });

    window.addEventListener("keydown", function(e) {
        if (e.key === "F2") { e.preventDefault(); setLock(!locked); }
        if (e.key === "Escape" && locked) setLock(false);
    });
})();
