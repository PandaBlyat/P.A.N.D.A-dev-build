// ═══════════════════════════════════════════
// EXPORT TAB: GROUP SELECTOR
// ═══════════════════════════════════════════
function renderExportGroupSelect(){
    const box=document.getElementById('exportGroupSelect');if(!box)return;
    box.innerHTML='';
    groups.forEach((g,gi)=>{
        const row=document.createElement('label');
        row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;background:#1e1e1e;border:1px solid #333;border-radius:4px;cursor:pointer';
        row.innerHTML=`<input type="checkbox" class="export-grp-chk" data-gi="${gi}" checked style="accent-color:#ff8c00">
            <span style="color:#d4d4d4;font-size:12px">📁 ${esc(g.name)}</span>
            <span style="color:#aaa;font-size:10px">(${g.chars.length} character${g.chars.length!==1?'s':''})</span>`;
        box.appendChild(row);
    });
    if(soloChars.length){
        const hdr=document.createElement('div');
        hdr.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;background:#1a1a1a;border:1px solid #444;border-radius:4px;cursor:pointer;user-select:none';
        hdr.innerHTML=`<span class="solo-export-arrow" style="color:#888;font-size:10px;transition:transform 0.15s">▶</span>
            <span style="color:#d4d4d4;font-size:12px">👤 Solo Characters</span>
            <span style="color:#aaa;font-size:10px">(${soloChars.length})</span>
            <label style="margin-left:auto;cursor:pointer;font-size:10px;color:#888" onclick="event.stopPropagation()"><input type="checkbox" checked onchange="document.querySelectorAll('.export-solo-chk').forEach(c=>c.checked=this.checked)" style="accent-color:#ff8c00"> all</label>`;
        const list=document.createElement('div');
        list.style.cssText='display:none;padding-left:20px;margin-top:4px';
        list.className='solo-export-list';
        soloChars.forEach((ch,si)=>{
            const row=document.createElement('label');
            row.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 10px;background:#1e1e1e;border:1px solid #333;border-radius:3px;cursor:pointer;margin-bottom:2px';
            row.innerHTML=`<input type="checkbox" class="export-grp-chk export-solo-chk" data-solo-idx="${si}" checked style="accent-color:#ff8c00">
                <span style="color:#d4d4d4;font-size:11px">${esc(ch.archId)}</span>`;
            list.appendChild(row);
        });
        hdr.addEventListener('click',()=>{
            const open=list.style.display!=='none';
            list.style.display=open?'none':'';
            hdr.querySelector('.solo-export-arrow').style.transform=open?'':'rotate(90deg)';
        });
        box.appendChild(hdr);
        box.appendChild(list);
    }
    // Connection groups
    if(typeof connGroups!=='undefined'&&connGroups.length){
        connGroups.forEach((cg,ci)=>{
            if(!cg.members.length)return;
            const row=document.createElement('label');
            row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;background:#1e1e1e;border:1px solid #3a5a8a;border-radius:4px;cursor:pointer';
            row.innerHTML=`<input type="checkbox" class="export-grp-chk" data-conn="${ci}" style="accent-color:#82b1ff">
                <span style="color:#82b1ff;font-size:12px">&#9741; ${esc(cg.name)}</span>
                <span style="color:#aaa;font-size:10px">(${cg.members.length} connected)</span>`;
            box.appendChild(row);
        });
    }
    if(!groups.length&&!soloChars.length){
        box.innerHTML='<div style="color:#aaa;font-size:12px;padding:8px">No groups or solo characters yet.</div>';
    }
}

function exportSelectAll(state){
    document.querySelectorAll('.export-grp-chk').forEach(c=>c.checked=state);
}

function getSelectedExportTargets(){
    // Returns [{label, slug, charList}] — one entry per checked group/solo
    const targets=[];
    const soloTargets=[];
    let checkboxes=document.querySelectorAll('.export-grp-chk');

    // If selector was not rendered yet, render once and retry.
    if(!checkboxes.length&&(groups.length||soloChars.length)){
        renderExportGroupSelect();
        checkboxes=document.querySelectorAll('.export-grp-chk');
    }

    checkboxes.forEach(chk=>{
        if(!chk.checked)return;
        if(chk.dataset.conn!==undefined){
            const ci=+chk.dataset.conn;
            const cg=typeof connGroups!=='undefined'?connGroups[ci]:null;
            if(!cg||!cg.members.length)return;
            // Resolve each member to its actual location (solo or group char)
            const charList=[];
            cg.members.forEach(m=>{
                for(let s=0;s<soloChars.length;s++){
                    if(soloChars[s].archId===m.archId){charList.push({solo:true,si:s});return;}
                }
                for(let g=0;g<groups.length;g++){
                    for(let c=0;c<groups[g].chars.length;c++){
                        if(groups[g].chars[c].archId===m.archId){charList.push({gi:g,ci:c});return;}
                    }
                }
            });
            if(charList.length)targets.push({
                label:cg.name,
                slug:cg.name.replace(/[^a-zA-Z0-9_]/g,'_').toLowerCase(),
                charList
            });
        } else if(chk.dataset.soloIdx!==undefined){
            const si=+chk.dataset.soloIdx;
            if(!soloChars[si])return;
            soloTargets.push({solo:true,si});
        } else {
            const gi=+chk.dataset.gi;
            const g=groups[gi];if(!g)return;
            targets.push({
                label:g.name,
                slug:g.name.replace(/[^a-zA-Z0-9_]/g,'_').toLowerCase(),
                charList:g.chars.map((_,ci)=>({gi,ci}))
            });
        }
    });

    // Collect selected solos into a single target
    if(soloTargets.length){
        targets.push({
            label:'solo',
            slug:'solo',
            charList:soloTargets
        });
    }

    // Safety fallback: if no UI checkboxes exist but data exists, export all.
    if(!targets.length&&!checkboxes.length){
        groups.forEach((g,gi)=>{
            if(!g||!Array.isArray(g.chars)||!g.chars.length)return;
            targets.push({
                label:g.name,
                slug:String(g.name||`group_${gi+1}`).replace(/[^a-zA-Z0-9_]/g,'_').toLowerCase(),
                charList:g.chars.map((_,ci)=>({gi,ci}))
            });
        });
        if(Array.isArray(soloChars)&&soloChars.length){
            targets.push({
                label:'solo',
                slug:'solo',
                charList:soloChars.map((_,si)=>({solo:true,si}))
            });
        }
    }
    return targets;
}

function downloadSelectedZips(){
    const targets=getSelectedExportTargets();
    if(!targets.length){setStatus('No groups selected.','warn');return;}
    let downloaded=0;
    targets.forEach((t,idx)=>{
        setTimeout(()=>{
            const {files}=buildExportArtifacts(t.charList);
            if(!files.length){setStatus(`No content to export for "${t.label}".`,'warn');return;}
            // Validate before download
            var valIssues=validateExportFiles(files);
            var criticals=valIssues.filter(function(i){return i.sev==='CRITICAL';});
            if(criticals.length){
                if(!confirm('Export has '+criticals.length+' CRITICAL issue(s) that will likely crash the game:\n\n'+criticals.map(function(i){return '- '+i.msg;}).join('\n')+'\n\nDownload anyway?'))return;
            }
            const zip=buildZip(files);
            const blob=new Blob([zip],{type:'application/zip'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=`ARCH_${t.slug}.zip`; // unique per group name
            document.body.appendChild(a);a.click();document.body.removeChild(a);
            URL.revokeObjectURL(url);
            downloaded++;
            var errCount=valIssues.filter(function(i){return i.sev==='ERROR';}).length;
            var statusMsg=`Downloaded ${downloaded} ZIP(s).`;
            if(errCount)statusMsg+=` (${errCount} validation warning(s) — check Preview for details)`;
            if(downloaded===targets.length)setStatus(statusMsg,errCount?'warn':'ok');
        },idx*300); // stagger 300ms so browser doesn't block multiple downloads
    });
}

function generatePreview(){
    const targets=getSelectedExportTargets();
    const charList=targets.flatMap(t=>t.charList);
    if(!charList.length){setStatus('No groups selected.','warn');return;}
    const {blocks}=buildExportArtifacts(charList);
    const eb=document.getElementById('exportBlocks');
    eb.innerHTML='';
    // Collect and display strip warnings
    const allWarnings=[];
    charList.forEach(t=>{
        let ch,e;
        if(t.solo){ch=soloChars[t.si];if(!ch)return;e={settings:Object.assign({},dc(DEFAULT_SETTINGS),ch.defaults?.settings||{},ch.ov?.settings||{}),dlg:Object.assign({},dc(DEFAULT_DLG),ch.defaults?.dlg||{},ch.ov?.dlg||{})};}
        else{ch=groups[t.gi]?.chars[t.ci];if(!ch)return;e=getEffective(t.gi,t.ci);}
        const w=collectStripWarnings(e.settings,e.dlg||{});
        w.forEach(msg=>{const full=`${ch.archId||'?'}: ${msg}`;if(!allWarnings.includes(full))allWarnings.push(full);});
    });
    if(allWarnings.length){
        eb.innerHTML+=`<div style="background:#3a2a00;border:1px solid #664400;border-radius:4px;padding:10px 14px;margin-bottom:12px"><div style="color:#ffb347;font-size:12px;font-weight:bold;margin-bottom:6px">Strip Warnings</div>${allWarnings.map(w=>`<div style="color:#e8c060;font-size:11px;margin-bottom:3px">&#9888; ${esc(w)}</div>`).join('')}</div>`;
    }
    // Run validation on the generated files
    var {files:exportFiles}=buildExportArtifacts(charList);
    var valIssues=validateExportFiles(exportFiles);
    var valDiv=document.createElement('div');
    valDiv.id='exportValidation';
    eb.appendChild(valDiv);
    renderValidationResults(valIssues,valDiv);

    blocks.forEach((b,idx)=>{
        const n=idx+1;
        eb.innerHTML+=`<div class="es"><h3>${n}. ${esc(b.title)}</h3>${b.file?`<div class="info">File: ${esc(b.file)}</div>`:''}<div class="ec" id="ec${n}">${esc(b.code)}</div><button class="btn b2 bs" onclick="copyCode('ec${n}',this)">Copy</button></div>`;
    });
    setStatus(`Preview: ${blocks.length} block(s).`,'ok');
}

// Keep generateAll as alias for backward compat with keyboard shortcut
function generateAll(){generatePreview();}

// ═══════════════════════════════════════════