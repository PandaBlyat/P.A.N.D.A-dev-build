// ═══════════════════════════════════════════
// MO2 FOLDER SCANNER
// ═══════════════════════════════════════════
// MO2 scanner — tries showDirectoryPicker (Chrome/Edge), falls back to
// <input webkitdirectory> which works in Brave, Firefox, and all Chromium.
function scanMO2Folder(){
    if(window.showDirectoryPicker){
        // Modern API — walk the directory handle tree
        window.showDirectoryPicker({mode:'read'})
            .then(dir=>processMO2DirectoryHandle(dir))
            .catch(e=>{if(e.name!=='AbortError')console.warn(e);
                document.getElementById('mo2ScanStatus').textContent='Cancelled.';});
    } else {
        // Fallback: file input with webkitdirectory
        const inp=document.createElement('input');
        inp.type='file';
        inp.webkitdirectory=true;  // lets user pick an entire folder
        inp.multiple=true;
        inp.onchange=e=>processMO2FileList(e.target.files);
        inp.click();
    }
}

// Path A: modern File System Access API (Chrome/Edge)
async function processMO2DirectoryHandle(rootDir){
    const statusEl=document.getElementById('mo2ScanStatus');
    const reportEl=document.getElementById('mo2ScanReport');
    statusEl.textContent='Scanning…';
    reportEl.style.display='block';reportEl.textContent='';
    const log=msg=>{reportEl.textContent+=msg+'\n';reportEl.scrollTop=reportEl.scrollHeight;};
    log(`Scanning: ${rootDir.name}/`);

    const importedGroups=[];
    const importedSolos=[];
    let scanned=0,found=0;
    for await(const [modName,modEntry] of rootDir.entries()){
        if(modEntry.kind!=='directory')continue;
        scanned++;
        // Support both legacy and canonical script naming.
        const scriptsByPrefix=await findFilesRecursive(modEntry,'custom_archetypes_','.script');
        const scriptsByName=await findFilesByExactNameRecursive(modEntry,['custom_archetypes.script']);
        const scriptsByPath=new Map();
        [...scriptsByPrefix,...scriptsByName].forEach(f=>{
            const key=f.path||f.name;
            if(!scriptsByPath.has(key))scriptsByPath.set(key,f);
        });
        const scripts=[...scriptsByPath.values()];
        // Fallback: no script found — look for arch_pack_*.ltx directly
        const packLtxFiles=scripts.length?[]:await findFilesRecursive(modEntry,'arch_pack_','.ltx');
        if(!scripts.length&&!packLtxFiles.length)continue;
        const allFiles=await findFilesRecursive(modEntry,'','');
        const fileByPath=new Map();
        allFiles.forEach(f=>fileByPath.set(importNormPath(f.path||f.name),f));
        found++;
        const groupChars=[];
        groupChars._globalBlocks={};
        if(scripts.length){
            log(`\n📁 ${modName} (${scripts.length} ARCH script${scripts.length>1?'s':''})`);
            for(const {name,handle,path} of scripts){
                const text=await handle.text();
                const parsed=await parseArchScript(text,{
                    scriptPath:path||name,
                    availablePaths:[...fileByPath.keys()],
                    readTextByPath:async relPath=>{
                        const rec=fileByPath.get(importNormPath(relPath));
                        return rec&&rec.handle?await rec.handle.text():'';
                    }
                });
                log(`  └─ ${name}: ${parsed.chars.length} archetype(s)`);
                parsed.chars.forEach(c=>log(`       • ${c.archId}`));
                if(parsed.skipped.length)log(`     ⚠ skipped: ${parsed.skipped.join(', ')}`);
                groupChars.push(...parsed.chars);
            }
        } else {
            log(`\n📁 ${modName} (${packLtxFiles.length} ARCH pack LTX${packLtxFiles.length>1?'s':''})`);
            for(const {name,handle,path} of packLtxFiles){
                const ltxText=await handle.text();
                const chars=parseRuntimeArchetypesLtxToChars(ltxText)||[];
                log(`  └─ ${name}: ${chars.length} archetype(s)`);
                chars.forEach(c=>log(`       • ${c.archId}`));
                if(chars._globalBlocks)Object.assign(groupChars._globalBlocks,chars._globalBlocks);
                // Hydrate dialogs from companion files
                const importCtx={
                    availablePaths:[...fileByPath.keys()],
                    readTextByPath:async relPath=>{
                        const rec=fileByPath.get(importNormPath(relPath));
                        return rec&&rec.handle?await rec.handle.text():'';
                    }
                };
                await hydrateLtxPackDialogs(chars,ltxText,importCtx,fileByPath);
                groupChars.push(...chars);
            }
        }
        if(groupChars.length){
            const sub=splitCharsByGlobalBlock(modName,groupChars);
            sub.groups.forEach(g=>importedGroups.push(g));
            sub.solos.forEach(ch=>importedSolos.push(ch));
        }
    }
    log(`\n──────────────────`);
    log(`Scanned ${scanned} mod folder(s), ARCH found in ${found}.`);
    finishMO2Import(importedGroups,importedSolos,statusEl,reportEl,log);
}

// Path B: webkitdirectory FileList (Brave, Firefox, all Chromium)
// FileList entries have .webkitRelativePath = "modsRoot/ModName/path/to/file.ext"
async function processMO2FileList(fileList){
    const statusEl=document.getElementById('mo2ScanStatus');
    const reportEl=document.getElementById('mo2ScanReport');
    if(!fileList||!fileList.length){statusEl.textContent='No files selected.';return;}
    statusEl.textContent='Scanning…';
    reportEl.style.display='block';reportEl.textContent='';
    const log=msg=>{reportEl.textContent+=msg+'\n';reportEl.scrollTop=reportEl.scrollHeight;};

    // Group files by mod folder.
    // Supports both:
    // 1) selecting MO2 mods root      -> modsRoot/ModName/gamedata/...
    // 2) selecting a single mod folder -> ModName/gamedata/...
    const modMap={}; // modName → {scripts:[{name,file,path}], filesByPath:Map}
    for(const file of fileList){
        const parts=file.webkitRelativePath.split('/');
        if(parts.length<2)continue;
        const second=String(parts[1]||'').toLowerCase();
        const singleModFolderSelected=(second==='gamedata'||second==='meta.ini'||second==='readme.txt');
        const modName=singleModFolderSelected ? parts[0] : parts[1];
        const relPath=singleModFolderSelected ? parts.slice(1).join('/') : parts.slice(2).join('/');
        const fileName=parts[parts.length-1];
        modMap[modName]=modMap[modName]||{scripts:[],filesByPath:new Map()};
        if(relPath)modMap[modName].filesByPath.set(importNormPath(relPath),file);
        const isArchScript=(fileName==='custom_archetypes.script')||(fileName.startsWith('custom_archetypes_')&&fileName.endsWith('.script'));
        const isPackLtx=fileName.startsWith('arch_pack_')&&fileName.endsWith('.ltx');
        if(!isArchScript&&!isPackLtx)continue;
        if(isArchScript)modMap[modName].scripts.push({name:fileName,file,path:relPath||fileName});
        if(isPackLtx){modMap[modName].packLtx=modMap[modName].packLtx||[];modMap[modName].packLtx.push({name:fileName,file,path:relPath||fileName});}
    }

    const modNames=Object.keys(modMap).filter(n=>{const r=modMap[n];return r&&((r.scripts&&r.scripts.length)||(r.packLtx&&r.packLtx.length));});
    log(`Root folder: ${fileList[0].webkitRelativePath.split('/')[0]}/`);
    log(`Found ARCH scripts in ${modNames.length} mod folder(s).`);

    const importedGroups=[];
    const importedSolos=[];
    for(const modName of modNames){
        const modRec=modMap[modName];
        const groupChars=[];
        groupChars._globalBlocks={};
        if(modRec.scripts&&modRec.scripts.length){
            log(`\n📁 ${modName} (${modRec.scripts.length} script${modRec.scripts.length>1?'s':''})`);
            for(const {name,file,path} of modRec.scripts){
                const text=await file.text();
                const parsed=await parseArchScript(text,{
                    scriptPath:path||name,
                    availablePaths:[...modRec.filesByPath.keys()],
                    readTextByPath:async rel=>{
                        const f=modRec.filesByPath.get(importNormPath(rel));
                        return f?await f.text():'';
                    }
                });
                log(`  └─ ${name}: ${parsed.chars.length} archetype(s)`);
                parsed.chars.forEach(c=>log(`       • ${c.archId}`));
                if(parsed.skipped.length)log(`     ⚠ skipped: ${parsed.skipped.join(', ')}`);
                groupChars.push(...parsed.chars);
            }
        } else if(modRec.packLtx&&modRec.packLtx.length){
            log(`\n📁 ${modName} (${modRec.packLtx.length} ARCH pack LTX${modRec.packLtx.length>1?'s':''})`);
            for(const {name,file,path} of modRec.packLtx){
                const ltxText=await file.text();
                const chars=parseRuntimeArchetypesLtxToChars(ltxText)||[];
                log(`  └─ ${name}: ${chars.length} archetype(s)`);
                chars.forEach(c=>log(`       • ${c.archId}`));
                if(chars._globalBlocks)Object.assign(groupChars._globalBlocks,chars._globalBlocks);
                const importCtx={
                    availablePaths:[...modRec.filesByPath.keys()],
                    readTextByPath:async rel=>{
                        const f=modRec.filesByPath.get(importNormPath(rel));
                        return f?await f.text():'';
                    }
                };
                await hydrateLtxPackDialogs(chars,ltxText,importCtx);
                groupChars.push(...chars);
            }
        }
        if(groupChars.length){
            const sub=splitCharsByGlobalBlock(modName,groupChars);
            sub.groups.forEach(g=>importedGroups.push(g));
            sub.solos.forEach(ch=>importedSolos.push(ch));
        }
    }
    log(`\n──────────────────`);
    log(`Total: ${importedGroups.flatMap(g=>g.chars).length+importedSolos.length} archetype(s) across ${importedGroups.length} group(s) + ${importedSolos.length} solo(s).`);
    finishMO2Import(importedGroups,importedSolos,statusEl,reportEl,log);
}

function splitCharsByGlobalBlock(modName,chars){
    const blocks=chars._globalBlocks||{};
    const byBlock={};
    const solos=[];
    chars.forEach(ch=>{
        if(ch.globalBlockId){
            if(!byBlock[ch.globalBlockId])byBlock[ch.globalBlockId]=[];
            byBlock[ch.globalBlockId].push(ch);
        } else {
            solos.push(ch);
        }
    });
    const groups=[];
    Object.entries(byBlock).forEach(([blockId,blockChars])=>{
        const defaults=mkDefaults();
        if(blocks[blockId])defaults.settings=blocks[blockId];
        groups.push({name:`${modName} [${blockId}]`,defaults,chars:blockChars});
    });
    return {groups,solos};
}

// Shared: confirm + merge imported groups into project
function finishMO2Import(importedGroups,importedSolos,statusEl,reportEl,log){
    if(!importedGroups.length&&!importedSolos.length){statusEl.textContent='Nothing found.';return;}
    const totalGrp=importedGroups.flatMap(g=>g.chars).length;
    const total=totalGrp+importedSolos.length;
    // Collect and display import report
    const allWarnings=[];
    const allHints=[];
    const allErrors=[];
    const collectWarnings=ch=>{
        if(!ch.importWarnings||!ch.importWarnings.length)return;
        ch.importWarnings.forEach(w=>{
            if(w.type==='archetype')allWarnings.push(`  ⚠ ${ch.archId}: unknown field "${w.field}" = ${w.value}`);
            else if(w.type==='task')allWarnings.push(`  ⚠ ${ch.archId} task ${w.task}: unknown field "${w.field}" = ${w.value}`);
            else if(w.type==='section')allWarnings.push(`  ⚠ [${w.section}]: unknown field "${w.field}" = ${w.value}`);
            else if(w.type==='missing_task')allErrors.push(`  ❌ ${ch.archId}: ${w.message}`);
            else if(w.type==='empty_pool')allErrors.push(`  ❌ ${ch.archId}: ${w.message}`);
            else if(w.type==='hint')allHints.push(`  💡 ${ch.archId}: ${w.value}`);
        });
    };
    importedGroups.forEach(ig=>ig.chars.forEach(collectWarnings));
    importedSolos.forEach(collectWarnings);

    // Import summary report
    var allCharsFlat=[];
    importedGroups.forEach(function(g){g.chars.forEach(function(c){allCharsFlat.push(c);});});
    importedSolos.forEach(function(c){allCharsFlat.push(c);});

    // Task summary
    var taskStats={fetch:0,delivery:0,talk:0,collect:0,total:0};
    var poolStats={defined:0,custom:0};
    var introCount=0;
    var connectedArchs=new Set();
    allCharsFlat.forEach(function(ch){
        var dlg=ch.ov&&ch.ov.dlg;
        if(!dlg)return;
        if(dlg.introDialog||dlg.introDialogId)introCount++;
        var pools=(dlg.taskPools||[]).concat(dlg.customPools||[]);
        pools.forEach(function(p){
            if(['default','advanced','rare','elite','special'].indexOf(p.tag)>=0)poolStats.defined++;
            else poolStats.custom++;
            (p.tasks||[]).forEach(function(t){
                var kind=t.type||'fetch';
                taskStats[kind]=(taskStats[kind]||0)+1;
                taskStats.total++;
                if(t.deliverToArchetype){connectedArchs.add(t.deliverToArchetype);}
                if(t.talkToArchetype&&!t.talkToGiver){connectedArchs.add(t.talkToArchetype);}
                if(t.collectFromArchetype){connectedArchs.add(t.collectFromArchetype);}
            });
        });
    });

    // Log summary
    log(`\n── Import Summary ──`);
    if(taskStats.total){
        var kindList=[];
        if(taskStats.fetch)kindList.push('🎒 '+taskStats.fetch+' fetch');
        if(taskStats.delivery)kindList.push('📦 '+taskStats.delivery+' delivery');
        if(taskStats.talk)kindList.push('💬 '+taskStats.talk+' talk');
        if(taskStats.collect)kindList.push('📋 '+taskStats.collect+' collect');
        log(`  Tasks: ${taskStats.total} total (${kindList.join(', ')})`);
        log(`  Pools: ${poolStats.defined} defined, ${poolStats.custom} custom`);
    } else {
        log(`  Tasks: none`);
    }
    if(introCount)log(`  Intro dialogs: ${introCount} archetype(s) with first-meeting dialog`);
    if(connectedArchs.size)log(`  Connected archetypes: ${[...connectedArchs].join(', ')}`);

    // Dialog import status
    allCharsFlat.forEach(function(ch){
        var dlg=ch.ov&&ch.ov.dlg;
        if(!dlg)return;
        var dialogs=dlg.dialogs||[];
        var customDialogCount=dialogs.filter(function(d){return d&&d._sourceDialogId;}).length;
        var hasIntro=!!(dlg.introDialog);
        var parts=[];
        if(customDialogCount)parts.push(customDialogCount+' custom dialog'+(customDialogCount>1?'s':''));
        if(hasIntro)parts.push('intro ✓');
        var pools=(dlg.taskPools||[]).concat(dlg.customPools||[]);
        var taskCount=0;pools.forEach(function(p){taskCount+=(p.tasks||[]).length;});
        if(taskCount)parts.push(taskCount+' task'+(taskCount>1?'s':''));
        if(parts.length)log(`  ${ch.archId}: ${parts.join(', ')}`);
    });

    // Errors
    if(allErrors.length){
        log(`\n❌ Errors (${allErrors.length}):`);
        allErrors.forEach(w=>log(w));
    }
    // Warnings
    if(allWarnings.length){
        log(`\n⚠ Warnings (${allWarnings.length} unrecognized field${allWarnings.length>1?'s':''}):`);
        log(`  These fields exist in the original LTX but are not supported by the generator.`);
        log(`  They will be LOST on re-export.`);
        allWarnings.forEach(w=>log(w));
    }
    // Hints
    if(allHints.length){
        log(`\n💡 Hints:`);
        allHints.forEach(w=>log(w));
    }
    if(!allErrors.length&&!allWarnings.length&&!allHints.length){
        log(`\n✓ Clean import — no warnings or errors.`);
    }
    const desc=[];
    if(importedGroups.length)desc.push(`${importedGroups.length} group(s) with ${totalGrp} archetype(s)`);
    if(importedSolos.length)desc.push(`${importedSolos.length} solo archetype(s)`);
    const doMerge=confirm(
        `Found ${desc.join(' + ')}.` +
        (allWarnings.length?`\n\n⚠ ${allWarnings.length} unrecognized field(s) detected — see import log for details.\nThese fields will be lost on re-export.`:'')+
        `\n\nMerge into current project?\n(Existing groups are kept — new ones added alongside.)`
    );
    if(!doMerge){statusEl.textContent='Cancelled.';return;}
    importedGroups.forEach(ig=>{
        let name=ig.name;let n=2;
        while(groups.find(g=>g.name===name))name=`${ig.name}_${n++}`;
        ig.name=name;groups.push(ig);
    });
    importedSolos.forEach(ch=>{
        soloChars.push(ch);
    });
    // Auto-create connected archetype groups from task target references
    _autoConnectTaskTargets(importedGroups,importedSolos);
    renderGroupList();renderExportGroupSelect();
    if(typeof renderConnGroups==='function')renderConnGroups();
    const warnSuffix=allWarnings.length?` (${allWarnings.length} warning${allWarnings.length>1?'s':''})`:'';
    statusEl.textContent=`Imported ${desc.join(' + ')}.${warnSuffix}`;
    log(`\n✓ Import complete.${warnSuffix}`);
    setStatus(`Imported ${desc.join(' + ')} from MO2 folder.${warnSuffix}`,allWarnings.length?'warn':'ok');
}

function _autoConnectTaskTargets(importedGroups,importedSolos){
    // Scan all imported archetypes for task target references
    // Create a connection group per pack with all involved archetypes
    var allChars=[];
    importedGroups.forEach(function(g){g.chars.forEach(function(ch){allChars.push(ch);});});
    importedSolos.forEach(function(ch){allChars.push(ch);});
    var connMembers={};  // archId → true
    var hasConn=false;
    allChars.forEach(function(ch){
        var dlg=ch.ov&&ch.ov.dlg;
        if(!dlg)return;
        var pools=(dlg.taskPools||[]).concat(dlg.customPools||[]);
        pools.forEach(function(p){
            (p.tasks||[]).forEach(function(t){
                // The giver archetype
                connMembers[ch.archId]=true;
                // Target archetypes
                if(t.type==='delivery'&&t.deliverToArchetype){connMembers[t.deliverToArchetype]=true;hasConn=true;}
                if(t.type==='talk'&&t.talkToArchetype&&!t.talkToGiver){connMembers[t.talkToArchetype]=true;hasConn=true;}
                if(t.type==='collect'&&t.collectFromArchetype){connMembers[t.collectFromArchetype]=true;hasConn=true;}
            });
        });
    });
    if(!hasConn)return;
    // Create a connection group with all involved archetypes
    if(typeof connGroups==='undefined')return;
    var name='imported_connections';
    var n=2;while(connGroups.find(function(g){return g.name===name;}))name='imported_connections_'+n++;
    var members=Object.keys(connMembers).map(function(aid){return{archId:aid,src:'solo',gi:-1,ci:-1};});
    connGroups.push({name:name,members:members});
}

// Recursively find files whose name starts with prefix and ends with suffix
async function findFilesRecursive(dirHandle,prefix,suffix,relPath=''){
    const results=[];
    for await(const [name,entry] of dirHandle.entries()){
        const path=relPath?`${relPath}/${name}`:name;
        if(entry.kind==='file'&&name.startsWith(prefix)&&name.endsWith(suffix)){
            results.push({name,path,handle:entry});
        } else if(entry.kind==='directory'){
            // Recurse but skip common non-content dirs
            if(name==='node_modules'||name==='.git')continue;
            const sub=await findFilesRecursive(entry,prefix,suffix,path);
            results.push(...sub);
        }
    }
    return results;
}

// Recursively find files by exact name (case-sensitive from FS API)
async function findFilesByExactNameRecursive(dirHandle,names,relPath=''){
    const wanted=new Set(names||[]);
    const results=[];
    for await(const [name,entry] of dirHandle.entries()){
        const path=relPath?`${relPath}/${name}`:name;
        if(entry.kind==='file'&&wanted.has(name)){
            results.push({name,path,handle:entry});
        } else if(entry.kind==='directory'){
            if(name==='node_modules'||name==='.git')continue;
            const sub=await findFilesByExactNameRecursive(entry,names,path);
            results.push(...sub);
        }
    }
    return results;
}

// Parse an ARCH-generated custom_archetypes*.script back into character objects
async function parseArchScript(text,importCtx){
    const chars=[];
    const skipped=[];
    const tableBody=extractLuaNamedTableBody(text,'CUSTOM_ARCHETYPES');
    if(tableBody){
        const entries=parseLuaTopLevelTableEntries(tableBody);
        entries.forEach(ent=>{
            if(!ent||!ent.id||ent.id==='CUSTOM_ARCHETYPES')return;
            try{
                const ch={archId:ent.id,displayName:'',ov:{settings:parseArchSettings(ent.body||'')}};
                chars.push(ch);
            }catch(e){
                skipped.push(ent.id);
            }
        });
        if(chars.length)await hydrateImportedArchDialogs(chars,text,importCtx);
        return {chars,skipped};
    }

    // Remake manifest path: thin script + archetypes exported in files.archetypes_ltx
    const ltxRel=findArchetypesLtxPathInManifestScript(text, importCtx&&importCtx.availablePaths);
    if(ltxRel&&importCtx&&typeof importCtx.readTextByPath==='function'){
        const ltxText=await safeImportRead(importCtx, ltxRel);
        const parsed=parseRuntimeArchetypesLtxToChars(ltxText);
        if(parsed&&parsed.length){
            parsed.forEach(ch=>chars.push(ch));
            await hydrateImportedArchDialogs(chars,text,importCtx);
            return {chars,skipped};
        }
    }

    // Fallback for older/partial formats: loose regex over flat entry blocks
    const archBlockRe=/^\s*(\w+)\s*=\s*\{([\s\S]*?)^\s*\},\s*$/gm;
    let m;
    while((m=archBlockRe.exec(text))!==null){
        const archId=m[1];
        const body=m[2];
        if(archId==='CUSTOM_ARCHETYPES')continue;
        try{
            const ch={archId,displayName:'',ov:{settings:parseArchSettings(body)}};
            chars.push(ch);
        }catch(e){
            skipped.push(archId);
        }
    }
    if(chars.length)await hydrateImportedArchDialogs(chars,text,importCtx);
    return {chars,skipped};
}

function findArchetypesLtxPathInManifestScript(scriptText, availablePaths){
    const text=String(scriptText||'');
    const m=text.match(/archetypes_ltx\s*=\s*"([^"]+)"/);
    const relRaw=m&&m[1]?String(m[1]):'';
    const normPaths=(Array.isArray(availablePaths)?availablePaths:[]).map(importNormPath);
    if(relRaw){
        const want=importNormPath(`gamedata/configs/${relRaw.replace(/\\/g,'/')}`);
        const found=normPaths.find(p=>p===want||p.endsWith('/'+want));
        if(found)return found;
    }
    return normPaths.find(p=>/gamedata\/configs\/misc\/arch_pack_[^/]+\.ltx$/.test(p))||'';
}

const KNOWN_ARCHETYPE_KEYS=new Set([
    'enabled','community_include','community_exclude','location_include','location_exclude',
    'rank_include','rank_exclude','male','female','ltx','buy','sell','amount','tier','chance',
    'available_after_days','respawn','dialog_profile','dialog_priority','dialog_ids','dialog_id',
    'name_format_type','name_format_text','spawn_inherit','spawn_primary','spawn_secondary',
    'spawn_extra','news_on_death','news_on_area','news_icon','specialization',
    'strip_dialog_categories','trade_preset','goodwill_mode','regular_visit_threshold',
    'buy_modifier_per_trust','sell_modifier_per_trust','assign_to','dialog_remove','dialog_add',
    'global_block','intro_dialog','intro_done_info'
]);
const KNOWN_TASK_KEYS=new Set([
    'kind','text_prefix','item_section','items','item_category','category_mode','amount',
    'on_target_death',
    'weight','pda_priority','repeatable','once_per_actor','cooldown_hours','enabled',
    'use_pda_task','pda_task_id','pda_icon',
    'reward_money','reward_items','reward_goodwill','reward_goodwill_community',
    'reward_buy_modifier','reward_sell_modifier',
    'summary_text','details_text','accepted_text','completed_text',
    'min_rank','max_rank','requires_trust',
    'requires_task_done','requires_info',
    'deliver_item','deliver_amount','deliver_to_archetype','on_complete_task','on_complete_info',
    'talk_to_archetype','talk_to_giver',
    'collect_from_archetype','collect_item','collect_amount'
]);
const KNOWN_META_KEYS=new Set([
    'pack_id','schema_version','dialog_xml','text_eng','text_rus',
    'task_pool_ids','global_block_ids'
]);
const KNOWN_POOL_KEYS=new Set([
    'archetype_id','enabled','cooldown_hours','task_ids','pool_tag',
    'dialog_open_text','dialog_npc_prompt',
    'personality_accept','personality_decline','personality_turnin_actor','personality_turnin_npc'
]);
const KNOWN_PACK_KEYS=new Set(['archetype_ids']);

function parseRuntimeArchetypesLtxToChars(ltxText){
    const text=String(ltxText||'');
    if(!text.trim())return[];
    const sections={};
    let current='';
    text.split(/\r?\n/).forEach(raw=>{
        let line=String(raw||'').replace(/^\uFEFF/,'').trim();
        if(!line||line.startsWith(';'))return;
        const sec=line.match(/^\[([^\]]+)\]$/);
        if(sec){
            current=sec[1].trim();
            sections[current]=sections[current]||{};
            return;
        }
        if(!current)return;
        const eq=line.indexOf('=');
        if(eq<0)return;
        const key=line.slice(0,eq).trim();
        let value=line.slice(eq+1).trim();
        // Strip outer quotes from LTX string values
        if(value.length>=2&&value[0]==='"'&&value[value.length-1]==='"')value=value.slice(1,-1);
        sections[current][key]=value;
    });

    // Parse global blocks
    const globalBlocks={};
    Object.keys(sections).forEach(secName=>{
        if(!secName.startsWith('arch_global_block_'))return;
        const blockId=secName.slice('arch_global_block_'.length);
        const bs=sections[secName];
        const d=dc(DEFAULT_SETTINGS);
        if('enabled' in bs)d.enabled=parseIniBoolLoose(bs.enabled,true);
        if('respawn' in bs)d.respawn=parseIniBoolLoose(bs.respawn,true);
        if(bs.tier)d.tier=String(bs.tier);
        if(bs.chance)d.chance=String(bs.chance);
        if(bs.amount)d.amount=String(bs.amount);
        if(bs.buy)d.buyMod=String(bs.buy);
        if(bs.sell)d.sellMod=String(bs.sell);
        if(bs.available_after_days)d.availableAfterDays=String(bs.available_after_days);
        if(bs.community_include)d.commVals=String(bs.community_include).split(',').map(v=>v.trim()).filter(Boolean);
        if(bs.location_include)d.locVals=String(bs.location_include).split(',').map(v=>v.trim()).filter(Boolean);
        if(bs.rank_include)d.rankVals=String(bs.rank_include).split(',').map(v=>v.trim()).filter(Boolean);
        globalBlocks[blockId]=d;
    });

    const pack=sections['arch_runtime_pack']||{};
    const ids=String(pack.archetype_ids||'').split(',').map(s=>s.trim()).filter(Boolean);
    const chars=[];
    chars._globalBlocks=globalBlocks;
    ids.forEach(id=>{
        const sec=sections[`arch_runtime_${id}`];
        if(!sec)return;
        const s=dc(DEFAULT_SETTINGS);
        s.enabled = parseIniBoolLoose(sec.enabled, true);
        applyImportFilterFromLtx(sec,'community_include','community_exclude','commMode','commVals',s);
        applyImportFilterFromLtx(sec,'location_include','location_exclude','locMode','locVals',s);
        applyImportFilterFromLtx(sec,'rank_include','rank_exclude','rankMode','rankVals',s,true);
        if('male' in sec)s.male=parseIniBoolLoose(sec.male, true);
        if('female' in sec)s.female=parseIniBoolLoose(sec.female, true);
        if(sec.ltx)s.ltxPath=sec.ltx;
        if(sec.buy)s.buyMod=String(sec.buy);
        if(sec.sell)s.sellMod=String(sec.sell);
        if(sec.amount)s.amount=String(sec.amount);
        if(sec.tier)s.tier=String(sec.tier);
        if(sec.chance)s.chance=String(sec.chance);
        if(sec.available_after_days)s.availableAfterDays=String(sec.available_after_days);
        if('respawn' in sec)s.respawn=parseIniBoolLoose(sec.respawn, true);
        if(sec.dialog_profile)s.dialogProfile=sec.dialog_profile;
        if(sec.dialog_priority)s.dialogPriority=String(sec.dialog_priority);
        if(sec.dialog_ids)s.dialogIdsCsv=sec.dialog_ids;
        if(sec.name_prefix)s.namePrefix=sec.name_prefix;
        if(sec.name_full)s.nameFullName=sec.name_full;
        if(sec.name_suffix)s.nameSuffix=sec.name_suffix;
        // Legacy import compat (old name_format_type/text keys)
        if(!s.namePrefix&&!s.nameFullName&&!s.nameSuffix&&sec.name_format_type&&sec.name_format_text){
            if(sec.name_format_type==='prefix')s.namePrefix=sec.name_format_text;
            else if(sec.name_format_type==='suffix')s.nameSuffix=sec.name_format_text;
            else if(sec.name_format_type==='full'||sec.name_format_type==='replace')s.nameFullName=sec.name_format_text;
        }
        if(sec.spawn_inherit)s.spawnInherit=sec.spawn_inherit;
        if(sec.spawn_primary)s.spawnPrimary=normalizeImportedSpawnCsv(sec.spawn_primary);
        if(sec.spawn_secondary)s.spawnSecondary=normalizeImportedSpawnCsv(sec.spawn_secondary);
        if(sec.spawn_extra)s.spawnExtra=normalizeImportedSpawnCsv(sec.spawn_extra);
        // Dynamic news: semicolons → newlines for editor
        if(sec.news_on_death)s.newsOnDeath=String(sec.news_on_death).split(';').map(t=>t.trim()).filter(Boolean).join('\n');
        if(sec.news_on_area)s.newsOnArea=String(sec.news_on_area).split(';').map(t=>t.trim()).filter(Boolean).join('\n');
        if(sec.news_icon)s.newsIcon=sec.news_icon;
        if(sec.specialization)s.specialization=sec.specialization;
        if(sec.strip_dialog_categories)s.stripCategories=String(sec.strip_dialog_categories).split(',').map(t=>t.trim()).filter(Boolean);
        if(sec.dialog_remove)s.dialogRemove=sec.dialog_remove;
        if(sec.dialog_add)s.dialogAdd=sec.dialog_add;
        if(sec.trade_preset)s.tradePreset=sec.trade_preset;
        if(sec.goodwill_mode)s.goodwillMode=sec.goodwill_mode;
        if(sec.regular_visit_threshold)s.regularVisitThreshold=String(sec.regular_visit_threshold);
        if(sec.buy_modifier_per_trust)s.buyModPerTrust=String(sec.buy_modifier_per_trust);
        if(sec.sell_modifier_per_trust)s.sellModPerTrust=String(sec.sell_modifier_per_trust);
        if(sec.assign_to)s.assignTo=sec.assign_to;
        if(sec.intro_dialog)s.introDialog=sec.intro_dialog;
        if(sec.intro_done_info)s.introDoneInfo=sec.intro_done_info;
        // Detect unrecognized archetype fields
        const warnings=[];
        Object.keys(sec).forEach(k=>{
            if(!KNOWN_ARCHETYPE_KEYS.has(k))warnings.push({type:'archetype',field:k,value:String(sec[k]).slice(0,80)});
        });
        // Parse tasks from task pools for this archetype
        const _allSecNames=Object.keys(sections);
        const _poolSecs=_allSecNames.filter(s=>s.startsWith('arch_task_pool'));
        const _taskSecs=_allSecNames.filter(s=>s.startsWith('arch_task_')&&!s.startsWith('arch_task_pool'));
        console.log(`[ARCH import] Archetype "${id}" — ${_allSecNames.length} sections total, ${_poolSecs.length} pool sections, ${_taskSecs.length} task sections`);
        if(_poolSecs.length)console.log('[ARCH import] Pool sections:',_poolSecs);
        if(_taskSecs.length)console.log('[ARCH import] Task sections:',_taskSecs);
        if(!_poolSecs.length)console.warn('[ARCH import] NO pool sections found! All section names:',_allSecNames);
        const {taskPools,customPools}=parseTaskPoolsForArchetype(id,sections,warnings);
        console.log(`[ARCH import] Result: ${taskPools.length} defined pools, ${customPools.length} custom pools, tasks: ${taskPools.map(p=>p.tag+':'+p.tasks.length).join(', ')||'none'}`);
        const ch={archId:id,displayName:s.nameFullName||'',ov:{settings:s}};
        if(taskPools.length||customPools.length){
            ch.ov.dlg=ch.ov.dlg||dc(DEFAULT_DLG);
            if(taskPools.length)ch.ov.dlg.taskPools=taskPools;
            if(customPools.length)ch.ov.dlg.customPools=customPools;
        }
        // Store intro dialog info on dlg data
        if(s.introDialog||s.introDoneInfo){
            ch.ov.dlg=ch.ov.dlg||dc(DEFAULT_DLG);
            ch.ov.dlg.introDialogId=s.introDialog||'';
            ch.ov.dlg.introDoneInfo=s.introDoneInfo||'';
        }
        if(sec.global_block&&globalBlocks[sec.global_block])ch.globalBlockId=sec.global_block;
        if(warnings.length)ch.importWarnings=warnings;
        chars.push(ch);
    });
    // Check meta and pool sections for unknown keys
    const globalWarnings=[];
    Object.keys(sections).forEach(secName=>{
        let knownSet=null;
        if(secName==='arch_pack_meta')knownSet=KNOWN_META_KEYS;
        else if(secName==='arch_runtime_pack')knownSet=KNOWN_PACK_KEYS;
        // Pool keys checked inside parseTaskPoolsForArchetype
        if(!knownSet)return;
        Object.keys(sections[secName]).forEach(k=>{
            if(!knownSet.has(k))globalWarnings.push({section:secName,field:k,value:String(sections[secName][k]).slice(0,80)});
        });
    });
    if(globalWarnings.length&&chars.length){
        chars[0].importWarnings=(chars[0].importWarnings||[]).concat(globalWarnings.map(w=>({type:'section',section:w.section,field:w.field,value:w.value})));
    }
    return chars;
}

// Auto-generated dialog pools: pool_tag_1..10. Narrative/custom pools: slot_1..20.
const _BUILTIN_POOL_TAGS=new Set();
for(var _i=1;_i<=10;_i++)_BUILTIN_POOL_TAGS.add('pool_tag_'+_i);
// Legacy builtin tags (still recognized for backwards compat)
['default','advanced','rare','elite','special'].forEach(function(t){_BUILTIN_POOL_TAGS.add(t);});

function _parseTaskFromLtx(tid,ts,warnings){
    const t={
        type:'fetch',
        id:tid,
        enabled:parseIniBoolLoose(ts.enabled,true),
        weight:(ts.weight!=null&&ts.weight!=='')?Number(ts.weight):1,
        fetchMode:'single',
        target:'',
        count:Number(ts.amount)||1,
        itemCategory:'',
        categoryMode:ts.category_mode||'npc_choice',
        shoppingItems:'',
        moneyReward:Number(ts.reward_money)||0,
        reward:'',
        rewardGoodwill:Number(ts.reward_goodwill)||0,
        rewardBuyMod:Number(ts.reward_buy_modifier)||0,
        rewardSellMod:Number(ts.reward_sell_modifier)||0,
        rewardItems:ts.reward_items||'',
        rewardGoodwillCommunity:ts.reward_goodwill_community||'',
        textPrefix:ts.text_prefix||'',
        repeatable:parseIniBoolLoose(ts.repeatable,true),
        cooldownHours:Number(ts.cooldown_hours)||0,
        pdaPriority:Number(ts.pda_priority)||5,
        oncePerActor:parseIniBoolLoose(ts.once_per_actor,false),
        usePdaTask:parseIniBoolLoose(ts.use_pda_task,false),
        pdaTaskId:ts.pda_task_id||'',
        pdaIcon:ts.pda_icon||'',
        minRank:ts.min_rank||'',
        maxRank:ts.max_rank||'',
        requiresTrust:Number(ts.requires_trust)||0,
        requiresTaskDone:ts.requires_task_done||'',
        requiresInfo:ts.requires_info||'',
        textMode:'simple',
        openingDialogue:ts.summary_text||'',
        desc:ts.details_text||'',
        acceptedText:ts.accepted_text||'',
        completedText:ts.completed_text||'',
        completionNode:''
    };
    // Detect task kind from fields
    var kind=ts.kind||'fetch';
    if(!ts.kind){
        // Auto-detect from fields present
        if(ts.deliver_to_archetype||ts.deliver_item)kind='delivery';
        else if(ts.talk_to_archetype||ts.talk_to_giver)kind='talk';
        else if(ts.collect_from_archetype||ts.collect_item)kind='collect';
    }
    t.type=kind;

    // Common chaining fields (all kinds)
    if(ts.on_complete_task)t.onCompleteTask=ts.on_complete_task;
    if(ts.on_complete_info)t.onCompleteInfo=ts.on_complete_info;

    if(kind==='delivery'){
        t.fetchMode=undefined;
        t.deliverItem=ts.deliver_item||ts.item_section||'';
        t.deliverAmount=Number(ts.deliver_amount||ts.amount)||1;
        t.deliverToArchetype=ts.deliver_to_archetype||'';
        t.target=t.deliverItem; // for chip display
    } else if(kind==='talk'){
        t.fetchMode=undefined;
        t.talkToArchetype=ts.talk_to_archetype||'';
        t.talkToGiver=parseIniBoolLoose(ts.talk_to_giver,false);
    } else if(kind==='collect'){
        t.fetchMode=undefined;
        t.collectFromArchetype=ts.collect_from_archetype||'';
        t.collectItem=ts.collect_item||ts.item_section||'';
        t.collectAmount=Number(ts.collect_amount||ts.amount)||1;
        t.target=t.collectItem; // for chip display
    } else {
        // Fetch
        if(ts.items){
            t.fetchMode='shopping';
            t.shoppingItems=String(ts.items).split(',').map(s=>s.trim()).filter(Boolean).join('\n');
        } else if(ts.item_category){
            t.fetchMode='category';
            t.itemCategory=ts.item_category;
        } else if(ts.item_section){
            t.fetchMode='single';
            t.target=ts.item_section;
        }
    }
    if(t.acceptedText||t.completedText)t.textMode='detailed';
    Object.keys(ts).forEach(k=>{
        if(!KNOWN_TASK_KEYS.has(k))warnings.push({type:'task',task:tid,field:k,value:String(ts[k]).slice(0,80)});
    });
    return t;
}

function parseTaskPoolsForArchetype(archId,sections,warnings){
    warnings=warnings||[];
    const taskPools=[];
    const customPools=[];
    Object.keys(sections).forEach(secName=>{
        if(!secName.startsWith('arch_task_pool_'))return;
        const pool=sections[secName];
        if(pool.archetype_id!==archId)return;
        // Tag from explicit pool_tag field, or infer from section name (arch_task_pool_<archId>_<tag>)
        var tag=pool.pool_tag||'';
        if(!tag){
            var sfx=secName.replace('arch_task_pool_','');
            if(sfx.startsWith(archId+'_'))tag=sfx.slice(archId.length+1);
            else tag=sfx;
        }
        if(!tag)tag='default';
        const taskIds=String(pool.task_ids||'').split(',').map(s=>s.trim()).filter(Boolean);
        const tasks=[];
        taskIds.forEach(tid=>{
            const ts=sections[`arch_task_${tid}`];
            if(!ts){
                console.warn(`[ARCH import] Task section "arch_task_${tid}" not found. Available sections:`,Object.keys(sections).filter(s=>s.startsWith('arch_task')));
                warnings.push({type:'missing_task',pool:secName,taskId:tid,message:`Task "${tid}" referenced in pool but section [arch_task_${tid}] not found in LTX`});
                return;
            }
            tasks.push(_parseTaskFromLtx(tid,ts,warnings));
        });
        const poolObj={
            tag,
            enabled:parseIniBoolLoose(pool.enabled,true),
            cooldownHours:Number(pool.cooldown_hours)||0,
            dialogOpenText:pool.dialog_open_text||'',
            dialogNpcPrompt:pool.dialog_npc_prompt||'',
            personalityAccept:pool.personality_accept||'',
            personalityDecline:pool.personality_decline||'',
            personalityTurninActor:pool.personality_turnin_actor||'',
            personalityTurninNpc:pool.personality_turnin_npc||'',
            tasks
        };
        if(taskIds.length&&!tasks.length){
            warnings.push({type:'empty_pool',pool:secName,tag,message:`Pool "${tag}" lists ${taskIds.length} task(s) but none could be resolved — task sections missing from LTX`});
        }
        if(_BUILTIN_POOL_TAGS.has(tag))taskPools.push(poolObj);
        else customPools.push(poolObj);
        // Check for unknown pool keys
        Object.keys(pool).forEach(k=>{
            if(!KNOWN_POOL_KEYS.has(k))warnings.push({type:'section',section:secName,field:k,value:String(pool[k]).slice(0,80)});
        });
    });
    return{taskPools,customPools};
}

function parseIniBoolLoose(v, fallback){
    const t=String(v==null?'':v).trim().toLowerCase();
    if(['true','1','yes','on'].includes(t))return true;
    if(['false','0','no','off'].includes(t))return false;
    return fallback;
}

function applyImportFilterFromLtx(sec, incKey, excKey, modeKey, valsKey, settings, rankMode=false){
    const inc=String(sec[incKey]||'').split(',').map(s=>s.trim()).filter(Boolean);
    const exc=String(sec[excKey]||'').split(',').map(s=>s.trim()).filter(Boolean);
    const excValsKey=valsKey.replace(/Vals$/,'ExcVals');
    if(inc.length){
        settings[modeKey]='inc';
        settings[valsKey]=inc;
        if(exc.length)settings[excValsKey]=exc;
    }else if(exc.length){
        settings[modeKey]='exc';
        settings[valsKey]=exc;
    }else if(rankMode){
        settings[modeKey]='inc';
        settings[valsKey]=[];
    }
}

function normalizeImportedSpawnCsv(value){
    return String(value||'')
        .split(',')
        .map(s=>s.trim())
        .filter(Boolean)
        .join('\n');
}

function extractLuaNamedTableBody(text,tableName){
    const re=new RegExp('(?:^|\\n)\\s*(?:local\\s+)?'+tableName+'\\s*=\\s*\\{','m');
    const m=text.match(re);
    if(!m)return'';
    const start=text.indexOf('{',m.index>=0?m.index:0);
    if(start<0)return'';
    let depth=0;
    let inStr=null;
    let esc=false;
    for(let i=start;i<text.length;i++){
        const ch=text[i];
        if(inStr){
            if(esc){esc=false;continue;}
            if(ch==='\\'){esc=true;continue;}
            if(ch===inStr){inStr=null;}
            continue;
        }
        if(ch==='"'||ch==="'"){inStr=ch;continue;}
        if(ch==='-'&&text[i+1]==='-'){
            while(i<text.length&&text[i]!=='\n')i++;
            continue;
        }
        if(ch==='{'){
            depth++;
            continue;
        }
        if(ch==='}'){
            depth--;
            if(depth===0){
                return text.slice(start+1,i);
            }
        }
    }
    return'';
}

function extractLuaFieldTableBody(text,fieldName){
    const re=new RegExp('(?:^|\\n)\\s*'+fieldName+'\\s*=\\s*\\{','m');
    const m=String(text||'').match(re);
    if(!m)return'';
    const src=String(text||'');
    const start=src.indexOf('{',m.index>=0?m.index:0);
    if(start<0)return'';
    let depth=0;
    let inStr=null;
    let esc=false;
    for(let i=start;i<src.length;i++){
        const ch=src[i];
        if(inStr){
            if(esc){esc=false;continue;}
            if(ch==='\\'){esc=true;continue;}
            if(ch===inStr){inStr=null;}
            continue;
        }
        if(ch==='"'||ch==="'"){inStr=ch;continue;}
        if(ch==='-'&&src[i+1]==='-'){
            while(i<src.length&&src[i]!=='\n')i++;
            continue;
        }
        if(ch==='{'){depth++;continue;}
        if(ch==='}'){
            depth--;
            if(depth===0)return src.slice(start+1,i);
        }
    }
    return'';
}

function parseLuaTopLevelTableEntries(tableBody){
    const entries=[];
    const lines=String(tableBody||'').split(/\r?\n/);
    let i=0;
    while(i<lines.length){
        const line=lines[i];
        const m=line.match(/^\s*([A-Za-z_]\w*)\s*=\s*\{\s*$/);
        if(!m){i++;continue;}
        const id=m[1];
        let depth=luaBraceDelta(line); // starts at 1 for the entry
        const bodyLines=[];
        i++;
        while(i<lines.length&&depth>0){
            const cur=lines[i];
            const nextDepth=depth+luaBraceDelta(cur);
            if(!(depth===1&&nextDepth===0&&/^\s*\},?\s*$/.test(cur))){
                bodyLines.push(cur);
            }
            depth=nextDepth;
            i++;
        }
        entries.push({id,body:bodyLines.join('\n')});
    }
    return entries;
}

function luaBraceDelta(line){
    let delta=0;
    let inStr=null;
    let esc=false;
    const s=String(line||'');
    for(let i=0;i<s.length;i++){
        const ch=s[i];
        if(inStr){
            if(esc){esc=false;continue;}
            if(ch==='\\'){esc=true;continue;}
            if(ch===inStr){inStr=null;}
            continue;
        }
        if(ch==='"'||ch==="'"){inStr=ch;continue;}
        if(ch==='-'&&s[i+1]==='-')break;
        if(ch==='{')delta++;
        else if(ch==='}')delta--;
    }
    return delta;
}

// Extract settings fields from an archetype body block
function parseArchSettings(body){
    const s=dc(DEFAULT_SETTINGS);

    // community_include / community_exclude
    const commInc=extractLuaStringArray(body,'community_include');
    const commExc=extractLuaStringArray(body,'community_exclude');
    if(commInc.length){s.commMode='inc';s.commVals=commInc;}
    else if(commExc.length){s.commMode='exc';s.commVals=commExc;}

    // location_include / location_exclude
    const locInc=extractLuaStringArray(body,'location_include');
    const locExc=extractLuaStringArray(body,'location_exclude');
    if(locInc.length){s.locMode='inc';s.locVals=locInc;}
    else if(locExc.length){s.locMode='exc';s.locVals=locExc;}

    // rank_include / rank_exclude
    const rankInc=extractLuaStringArray(body,'rank_include');
    const rankExc=extractLuaStringArray(body,'rank_exclude');
    if(rankInc.length){s.rankMode='inc';s.rankVals=rankInc;}
    else if(rankExc.length){s.rankMode='exc';s.rankVals=rankExc;}

    // buy/sell mods
    const buy=body.match(/buy\s*=\s*([\d.]+)/);
    const sell=body.match(/sell\s*=\s*([\d.]+)/);
    if(buy)s.buyMod=buy[1];
    if(sell)s.sellMod=sell[1];

    // amount, tier/chance/calendar, respawn
    const amt=body.match(/amount\s*=\s*(\d+)/);
    const tierM=body.match(/tier\s*=\s*(\d+)/);
    const chanceM=body.match(/chance\s*=\s*(\d+)/);
    const aadM=body.match(/available_after_days\s*=\s*(\d+)/);
    const resp=body.match(/respawn\s*=\s*(true|false)/);
    if(amt)s.amount=amt[1];
    if(tierM)s.tier=tierM[1];
    if(chanceM)s.chance=chanceM[1];
    if(aadM)s.availableAfterDays=aadM[1];
    if(resp)s.respawn=resp[1]==='true';

    const enabled=body.match(/enabled\s*=\s*(true|false)/);
    if(enabled)s.enabled=enabled[1]==='true';

    const dprof=body.match(/dialog_profile\s*=\s*"([^"]*)"/);
    const dprio=body.match(/dialog_priority\s*=\s*(\d+)/);
    if(dprof)s.dialogProfile=dprof[1];
    if(dprio)s.dialogPriority=dprio[1];

    const dids=extractLuaStringArray(body,'dialog_ids');
    if(dids.length)s.dialogIdsCsv=dids.join(', ');

    return s;
}

// Extract {"val1","val2",...} as a JS array from a Lua field
function extractLuaStringArray(body,field){
    const re=new RegExp(field+'\\s*=\\s*\\{([^}]*)\\}');
    const m=body.match(re);
    if(!m)return[];
    return(m[1].match(/"([^"]+)"/g)||[]).map(s=>s.slice(1,-1));
}

function importNormPath(p){
    return String(p||'').replace(/\\/g,'/').replace(/^\.?\//,'').toLowerCase();
}

async function hydrateImportedArchDialogs(chars,scriptText,importCtx){
    if(!importCtx||!Array.isArray(chars)||!chars.length)return;
    const paths=Array.isArray(importCtx.availablePaths)?importCtx.availablePaths.map(importNormPath):[];
    if(!paths.length||typeof importCtx.readTextByPath!=='function')return;

    const packPaths=pickImportPackFiles(scriptText, paths);
    console.log('[ARCH import] hydrateDialogs: dialog_xml=',packPaths.dialog_xml,'text_eng=',packPaths.text_eng,'availablePaths count=',paths.length);
    // Also try to find dialog_xml/text_eng from LTX meta if not found from script
    if(!packPaths.dialog_xml.length||!packPaths.text_eng.length){
        // Scan chars for LTX-sourced introDialogId hints, and scan available paths more broadly
        var normPaths=paths;
        if(!packPaths.dialog_xml.length){
            normPaths.forEach(function(p){
                if(/gamedata\/configs\/misc\/dialogs_arch[^/]*\.xml$/i.test(p)&&packPaths.dialog_xml.indexOf(p)<0)packPaths.dialog_xml.push(p);
            });
        }
        if(!packPaths.text_eng.length){
            normPaths.forEach(function(p){
                if(/gamedata\/configs\/text\/eng\/st_arch[^/]*\.xml$/i.test(p)&&packPaths.text_eng.indexOf(p)<0)packPaths.text_eng.push(p);
            });
        }
        console.log('[ARCH import] hydrateDialogs after fallback: dialog_xml=',packPaths.dialog_xml,'text_eng=',packPaths.text_eng);
    }
    const dialogXmlTexts=await Promise.all((packPaths.dialog_xml||[]).map(p=>safeImportRead(importCtx,p)));
    const textEngTexts=await Promise.all((packPaths.text_eng||[]).map(p=>safeImportRead(importCtx,p)));
    const textRusTexts=await Promise.all((packPaths.text_rus||[]).map(p=>safeImportRead(importCtx,p)));
    console.log('[ARCH import] hydrateDialogs: dialogXml read count=',dialogXmlTexts.filter(Boolean).length,'textEng read count=',textEngTexts.filter(Boolean).length);

    const branchTextMap=Object.assign({},
        ...textRusTexts.map(parseStringTableXmlMap),
        ...textEngTexts.map(parseStringTableXmlMap)
    );
    const vanillaMap=Object.assign({},
        ...textRusTexts.map(parseStringTableXmlMap),
        ...textEngTexts.map(parseStringTableXmlMap)
    );

    const dialogDocs=dialogXmlTexts
        .map(parseDialogsXmlDoc)
        .filter(Boolean);
    console.log('[ARCH import] hydrateDialogs: parsed dialog docs=',dialogDocs.length);
    if(!dialogDocs.length)return;

    // Log intro detection
    chars.forEach(function(ch){
        if(ch.ov&&ch.ov.dlg&&ch.ov.dlg.introDialogId)console.log('[ARCH import] Arch "'+ch.archId+'" has introDialogId="'+ch.ov.dlg.introDialogId+'"');
    });

    chars.forEach(ch=>{
        if(!ch||!ch.archId)return;
        const importedDialogs=collectImportedDialogsForArch(dialogDocs, branchTextMap, ch.archId);
        const importedVanilla=collectImportedVanillaForArch(vanillaMap, ch.archId);
        if(importedDialogs.length||hasVanillaContent(importedVanilla)){
            ch.ov=ch.ov||{};
            const dlg=ch.ov.dlg||dc(DEFAULT_DLG);
            // Detect intro dialog and move it to introDialog
            const introId=dlg.introDialogId||'';
            console.log('[ARCH import] '+ch.archId+': introDialogId="'+introId+'", importedDialogs='+importedDialogs.length+', sourceIds='+importedDialogs.map(function(d){return d._sourceDialogId;}).join(','));
            let introTree=null;
            const regularDialogs=[];
            if(introId){
                importedDialogs.forEach(function(d){
                    console.log('[ARCH import]   comparing _sourceDialogId="'+d._sourceDialogId+'" vs introId="'+introId+'" → '+(d._sourceDialogId===introId?'MATCH':'no'));
                    if(d._sourceDialogId===introId)introTree=d;
                    else regularDialogs.push(d);
                });
            } else {
                regularDialogs.push.apply(regularDialogs,importedDialogs);
            }
            console.log('[ARCH import] '+ch.archId+': introTree='+(introTree?'FOUND':'null')+', regularDialogs='+regularDialogs.length);
            if(regularDialogs.length){
                dlg.dialogs=regularDialogs;
            }
            if(introTree){
                dlg.introDialog=introTree;
                dlg.introDialog.label='Intro';
            }
            dlg.vanilla=Object.assign({}, dlg.vanilla||ensureVanillaDlg(null), importedVanilla||{});
            dlg.graph=dlg.graph||{view:'tree'};
            ch.ov.dlg=dlg;
        }
    });
}

async function safeImportRead(importCtx, relPath){
    try{
        return await importCtx.readTextByPath(relPath);
    }catch(_e){
        return '';
    }
}

function pickImportPackFiles(scriptText, availablePaths){
    const out={dialog_xml:[], text_eng:[], text_rus:[]};
    const normPaths=(availablePaths||[]).map(importNormPath);
    let packBody=extractLuaNamedTableBody(scriptText||'','PACK_FILES');
    if(!packBody){
        const manifestBody=extractLuaNamedTableBody(scriptText||'','CREATION_PACK');
        if(manifestBody){
            packBody=extractLuaFieldTableBody(manifestBody,'files');
        }
    }
    if(packBody){
        ['dialog_xml','text_eng','text_rus'].forEach(key=>{
            const vals=extractLuaStringArray(packBody,key);
            vals.forEach(v=>{
                const want=importNormPath(`gamedata/configs/${String(v||'').replace(/\\/g,'/')}`);
                const found=normPaths.find(p=>p===want||p.endsWith('/'+want));
                if(found&&!out[key].includes(found))out[key].push(found);
            });
        });
    }

    // Canonical V5 fallback when PACK_FILES is absent.
    if(!out.dialog_xml.length){
        normPaths.forEach(p=>{
            if(/gamedata\/configs\/misc\/dialogs_arch[^/]*\.xml$/.test(p))out.dialog_xml.push(p);
        });
    }
    if(!out.text_eng.length){
        normPaths.forEach(p=>{
            if(/gamedata\/configs\/text\/eng\/.*branches\.xml$/.test(p))out.text_eng.push(p);
            if(/gamedata\/configs\/text\/eng\/.*(personality_edits|topic_strings)\.xml$/.test(p))out.text_eng.push(p);
        });
    }
    if(!out.text_rus.length){
        normPaths.forEach(p=>{
            if(/gamedata\/configs\/text\/rus\/.*branches\.xml$/.test(p))out.text_rus.push(p);
            if(/gamedata\/configs\/text\/rus\/.*(personality_edits|topic_strings)\.xml$/.test(p))out.text_rus.push(p);
        });
    }
    return out;
}

function parseDialogsXmlDoc(xmlText){
    if(!String(xmlText||'').trim())return null;
    try{
        const doc=new DOMParser().parseFromString(xmlText,'application/xml');
        if(doc.querySelector('parsererror'))return null;
        return doc;
    }catch(_e){
        return null;
    }
}

function parseStringTableXmlMap(xmlText){
    const out={};
    if(!String(xmlText||'').trim())return out;
    try{
        const doc=new DOMParser().parseFromString(xmlText,'application/xml');
        if(doc.querySelector('parsererror'))return out;
        doc.querySelectorAll('string[id]').forEach(node=>{
            const id=String(node.getAttribute('id')||'').trim();
            if(!id)return;
            const textEl=node.querySelector('text');
            out[id]=(textEl&&textEl.textContent!=null)?String(textEl.textContent):'';
        });
    }catch(_e){}
    return out;
}

function collectImportedDialogsForArch(dialogDocs,textMap,archId){
    const out=[];
    const wantPre=`dialogs.arch_is_${archId}`;
    const dialogs=[];
    dialogDocs.forEach(doc=>{
        doc.querySelectorAll('dialog[id]').forEach(d=>{
            const preNode=d.querySelector('precondition');
            const pre=String(preNode&&preNode.textContent||'').trim();
            if(pre===wantPre)dialogs.push(d);
        });
    });
    dialogs.sort((a,b)=>String(a.getAttribute('id')||'').localeCompare(String(b.getAttribute('id')||'')));
    dialogs.forEach((dlgEl,idx)=>{
        const parsed=parseGeneratedDialogPhraseListToFlat(dlgEl,textMap||{});
        if(parsed){
            parsed.id=`dlg_${idx+1}`;
            parsed._sourceDialogId=String(dlgEl.getAttribute('id')||'');
            parsed.label=parsed._sourceDialogId||('Dialog '+(idx+1));
            // Preserve dialog-level preconditions, has_info, dont_has_info beyond arch_is_<id>
            const _dlgPreconditions=[];
            const _dlgHasInfos=[];
            const _dlgDontHasInfos=[];
            // Only direct children of <dialog>, not phrases
            [...dlgEl.children].forEach(ch=>{
                const tag=ch.tagName.toLowerCase();
                const v=String(ch.textContent||'').trim();
                if(!v)return;
                if(tag==='precondition'&&v!==wantPre)_dlgPreconditions.push(v);
                else if(tag==='has_info')_dlgHasInfos.push(v);
                else if(tag==='dont_has_info')_dlgDontHasInfos.push(v);
            });
            if(_dlgPreconditions.length)parsed._dialogPreconditions=_dlgPreconditions;
            if(_dlgHasInfos.length)parsed._dialogHasInfo=_dlgHasInfos;
            if(_dlgDontHasInfos.length)parsed._dialogDontHasInfo=_dlgDontHasInfos;
            out.push(parsed);
        }
    });
    return out;
}

function parseGeneratedDialogPhraseListToFlat(dialogEl,textMap){
    if(!dialogEl)return null;
    const phrases={};
    dialogEl.querySelectorAll('phrase[id]').forEach(ph=>{
        const idNum=Number(ph.getAttribute('id'));
        if(!Number.isFinite(idNum))return;
        const sid=String((ph.querySelector('text')||{}).textContent||'').trim();
        const nexts=[...ph.querySelectorAll('next')].map(n=>Number(String(n.textContent||'').trim())).filter(Number.isFinite);
        const entry={id:idNum,sid,nexts};
        // Preserve task bindings
        const _pre=ph.querySelector('precondition');if(_pre)entry.precondition=String(_pre.textContent||'').trim();
        const _st=ph.querySelector('script_text');if(_st)entry.scriptText=String(_st.textContent||'').trim();
        const _acts=[...ph.querySelectorAll('action')].map(a=>String(a.textContent||'').trim()).filter(Boolean);
        if(_acts.length)entry.action=_acts.join(';');
        // Support multiple info portions per phrase (semicolon-joined for multi-value)
        const _hiAll=[...ph.querySelectorAll('has_info')].map(e=>String(e.textContent||'').trim()).filter(Boolean);
        if(_hiAll.length)entry.hasInfo=_hiAll.join(';');
        const _dhiAll=[...ph.querySelectorAll('dont_has_info')].map(e=>String(e.textContent||'').trim()).filter(Boolean);
        if(_dhiAll.length)entry.dontHasInfo=_dhiAll.join(';');
        const _giAll=[...ph.querySelectorAll('give_info')].map(e=>String(e.textContent||'').trim()).filter(Boolean);
        if(_giAll.length)entry.giveInfo=_giAll.join(';');
        const _diAll=[...ph.querySelectorAll('disable_info')].map(e=>String(e.textContent||'').trim()).filter(Boolean);
        if(_diAll.length)entry.disableInfo=_diAll.join(';');
        phrases[idNum]=entry;
    });
    if(!phrases[0])return null;
    // Find the "phrase 1" — may not be literal ID 1 in hand-authored dialogs
    var _p0nexts=phrases[0].nexts||[];
    var _followId=phrases[1]?1:(_p0nexts.length?_p0nexts[0]:null);
    if(_followId==null||!phrases[_followId])return null;

    const sidText=sid=>Object.prototype.hasOwnProperty.call(textMap,sid)?String(textMap[sid]||''):String(sid||'');

    // Detect start_dialog (NPC speaks first) vs actor_dialog (player speaks first)
    // start_dialog: phrase 0 = NPC greeting, then actor responds
    // actor_dialog: phrase 0 = player opener, then NPC responds (hub)
    var _isNpcFirst=false;
    if(phrases[0].giveInfo||phrases[0].dontHasInfo||phrases[0].hasInfo){
        _isNpcFirst=true;
    }

    var opener,hub,hubId,introGreeting;
    if(_isNpcFirst){
        // start_dialog (intro): 3-tier structure
        //   introGreeting = NPC's first line (phrase 0) — tier 1
        //   opener = actor's response (phrase follow) — tier 2
        //   hub = NPC's second response (phrase follow's first next) — tier 3 (with give_info, choices)
        //   hubChoices = from hub phrase's nexts
        introGreeting=sidText(phrases[0].sid)||'...';
        var _actorPhrase=phrases[_followId];
        opener=sidText(_actorPhrase?_actorPhrase.sid:'')||'...'; // actor response
        var _hubCandidates=_actorPhrase?(_actorPhrase.nexts||[]):[];
        hubId=_hubCandidates.length?_hubCandidates[0]:_followId;
        hub=sidText((phrases[hubId]||{}).sid)||'...';
    } else {
        // actor_dialog: phrase 0 = player opener, follow = NPC hub/greeting
        opener=sidText(phrases[0].sid)||'I want to ask you something.';
        hubId=_followId;
        hub=sidText((phrases[hubId]||{}).sid)||'What do you want to know?';
    }

    // Detect branched NPC responses: opener phrase 0 has multiple nexts that are ALL
    // gated NPC phrases (turnin pattern). Capture extras as hub variations.
    var _hubVariations=[];
    if(!_isNpcFirst&&_p0nexts.length>1){
        var _extraNpcNexts=_p0nexts.filter(function(nx){return nx!==hubId&&phrases[nx];});
        var _allGatedNpc=_extraNpcNexts.length>0&&_extraNpcNexts.every(function(nx){
            var ph=phrases[nx];
            return ph&&(ph.hasInfo||ph.dontHasInfo||ph.precondition);
        });
        if(_allGatedNpc){
            _extraNpcNexts.forEach(function(nx){
                var ph=phrases[nx];
                var vo={text:sidText(ph.sid)||'...'};
                if(ph.hasInfo)vo.hasInfo=ph.hasInfo;
                if(ph.dontHasInfo)vo.dontHasInfo=ph.dontHasInfo;
                if(ph.giveInfo)vo.giveInfo=ph.giveInfo;
                if(ph.action)vo.action=ph.action;
                if(ph.precondition)vo.precondition=ph.precondition;
                _hubVariations.push(vo);
            });
        }
    }

    const nodes={};
    const memo={};
    const visiting={};
    let synthCounter=1;
    function nodeKeyFor(npcPhraseId){return `n${npcPhraseId}`;}
    function syntheticNode(text,nextTag){
        const id=`n_imp_${synthCounter++}`;
        nodes[id]={npc:text||'...',choices:[{text:'I have another question.',next:nextTag||'__hub__'}]};
        return id;
    }
    function ensureNodeFromNpc(npcPhraseId){
        if(!phrases[npcPhraseId])return null;
        const key=nodeKeyFor(npcPhraseId);
        if(memo[npcPhraseId])return memo[npcPhraseId];
        if(visiting[npcPhraseId])return key;
        visiting[npcPhraseId]=true;
        const ph=phrases[npcPhraseId];
        const npcText=sidText(ph.sid)||'...';
        const choices=[];
        let addedEnd=false;
        for(const nx of ph.nexts||[]){
            const tgt=phrases[nx];
            if(!tgt){
                continue;
            }
            if(nx===99||tgt.sid==='dm_universal_actor_exit'){
                if(!addedEnd){
                    const _exitCh={text:'I understand.',next:'__end__'};
                    if(tgt.precondition)_exitCh.precondition=tgt.precondition;
                    if(tgt.hasInfo)_exitCh.hasInfo=tgt.hasInfo;
                    if(tgt.dontHasInfo)_exitCh.dontHasInfo=tgt.dontHasInfo;
                    choices.push(_exitCh);
                    addedEnd=!tgt.precondition; // don't suppress further exits if this one is conditional
                }
                continue;
            }
            if(isReturnPhraseToHub(tgt,hubId,phrases)){
                choices.push({text:sidText(tgt.sid)||'I have another question.',next:'__hub__'});
                continue;
            }
            // Expected generated pattern: NPC -> player phrase -> NPC
            const playerText=sidText(tgt.sid)||'...';
            const nextNpcId=(tgt.nexts&&tgt.nexts.length)?tgt.nexts[0]:null;
            if(nextNpcId===null||nextNpcId===undefined){
                // Player phrase with no <next> — ends conversation
                const _chTerm={text:playerText,next:'__end__'};
                if(tgt.action)_chTerm.action=tgt.action;
                if(tgt.precondition)_chTerm.precondition=tgt.precondition;
                if(tgt.hasInfo)_chTerm.hasInfo=tgt.hasInfo;
                if(tgt.dontHasInfo)_chTerm.dontHasInfo=tgt.dontHasInfo;
                if(tgt.giveInfo)_chTerm.giveInfo=tgt.giveInfo;
                if(tgt.disableInfo)_chTerm.disableInfo=tgt.disableInfo;
                choices.push(_chTerm);
                continue;
            }
            if(nextNpcId===99){
                const _ch2={text:playerText,next:'__end__'};
                if(tgt.action)_ch2.action=tgt.action;
                if(tgt.giveInfo)_ch2.giveInfo=tgt.giveInfo;
                if(tgt.disableInfo)_ch2.disableInfo=tgt.disableInfo;
                choices.push(_ch2);
                continue;
            }
            const nextNpc=phrases[nextNpcId];
            if(nextNpc&&isReturnPhraseToHub(nextNpc,hubId,phrases)){
                const _ch3={text:playerText,next:'__hub__'};
                if(tgt.action)_ch3.action=tgt.action;
                if(tgt.giveInfo)_ch3.giveInfo=tgt.giveInfo;
                choices.push(_ch3);
                continue;
            }
            if(!nextNpc){
                const _chEnd={text:playerText,next:'__end__'};
                if(tgt.action)_chEnd.action=tgt.action;
                if(tgt.precondition)_chEnd.precondition=tgt.precondition;
                if(tgt.hasInfo)_chEnd.hasInfo=tgt.hasInfo;
                if(tgt.dontHasInfo)_chEnd.dontHasInfo=tgt.dontHasInfo;
                if(tgt.giveInfo)_chEnd.giveInfo=tgt.giveInfo;
                if(tgt.disableInfo)_chEnd.disableInfo=tgt.disableInfo;
                choices.push(_chEnd);
                continue;
            }
            const childKey=ensureNodeFromNpc(nextNpcId)||'__hub__';
            const _ch={text:playerText,next:childKey};
            // Carry player phrase bindings to choice
            if(tgt.precondition)_ch.precondition=tgt.precondition;
            if(tgt.action)_ch.action=tgt.action;
            if(tgt.hasInfo)_ch.hasInfo=tgt.hasInfo;
            if(tgt.dontHasInfo)_ch.dontHasInfo=tgt.dontHasInfo;
            if(tgt.giveInfo)_ch.giveInfo=tgt.giveInfo;
            if(tgt.disableInfo)_ch.disableInfo=tgt.disableInfo;
            choices.push(_ch);
        }
        if(!choices.length)choices.push({text:'I have another question.',next:'__hub__'});
        const _node={npc:npcText,choices};
        // Carry NPC phrase bindings to node
        if(ph.precondition)_node.precondition=ph.precondition;
        if(ph.scriptText)_node.scriptText=ph.scriptText;
        if(ph.action)_node.action=ph.action;
        if(ph.hasInfo)_node.hasInfo=ph.hasInfo;
        if(ph.dontHasInfo)_node.dontHasInfo=ph.dontHasInfo;
        if(ph.giveInfo)_node.giveInfo=ph.giveInfo;
        if(ph.disableInfo)_node.disableInfo=ph.disableInfo;
        nodes[key]=_node;
        memo[npcPhraseId]=key;
        delete visiting[npcPhraseId];
        return key;
    }

    const hubChoices=[];
    const hubPhrase=phrases[hubId];
    (hubPhrase.nexts||[]).forEach(nx=>{
        const tgt=phrases[nx];
        if(!tgt)return;
        if(nx===99||tgt.sid==='dm_universal_actor_exit')return;
        if(isReturnPhraseToHub(tgt,hubId,phrases))return;
        const choiceText=sidText(tgt.sid)||'...';
        const nextNpcId=(tgt.nexts&&tgt.nexts.length)?tgt.nexts[0]:null;
        // Helper: copy phrase bindings to choice object
        function _copyBindings(ch){
            if(tgt.precondition)ch.precondition=tgt.precondition;
            if(tgt.action)ch.action=tgt.action;
            if(tgt.hasInfo)ch.hasInfo=tgt.hasInfo;
            if(tgt.dontHasInfo)ch.dontHasInfo=tgt.dontHasInfo;
            if(tgt.giveInfo)ch.giveInfo=tgt.giveInfo;
            if(tgt.disableInfo)ch.disableInfo=tgt.disableInfo;
            return ch;
        }
        if(nextNpcId===99||nextNpcId===null||nextNpcId===undefined){
            hubChoices.push(_copyBindings({text:choiceText,next:'__end__'}));
            return;
        }
        if(nextNpcId!=null&&phrases[nextNpcId]&&isReturnPhraseToHub(phrases[nextNpcId],hubId,phrases)){
            hubChoices.push(_copyBindings({text:choiceText,next:'__hub__'}));
            return;
        }
        const childKey=ensureNodeFromNpc(nextNpcId);
        if(childKey)hubChoices.push(_copyBindings({text:choiceText,next:childKey}));
    });
    if(!hubChoices.length)hubChoices.push({text:'I understand.',next:'__end__'});

    // Store hub-level and opener-level bindings (actions, preconditions, info portions on the hub/opener phrases themselves)
    var _hubBindings={};
    if(hubPhrase){
        if(hubPhrase.action)_hubBindings.hubAction=hubPhrase.action;
        if(hubPhrase.precondition)_hubBindings.hubPrecondition=hubPhrase.precondition;
        if(hubPhrase.scriptText)_hubBindings.hubScriptText=hubPhrase.scriptText;
        if(hubPhrase.hasInfo)_hubBindings.hubHasInfo=hubPhrase.hasInfo;
        if(hubPhrase.dontHasInfo)_hubBindings.hubDontHasInfo=hubPhrase.dontHasInfo;
        if(hubPhrase.giveInfo)_hubBindings.hubGiveInfo=hubPhrase.giveInfo;
    }
    var _openerBindings={};
    if(phrases[0]){
        if(phrases[0].action)_openerBindings.openerAction=phrases[0].action;
        if(phrases[0].precondition)_openerBindings.openerPrecondition=phrases[0].precondition;
        if(phrases[0].scriptText)_openerBindings.openerScriptText=phrases[0].scriptText;
    }

    // Store original string IDs for round-trip preservation
    var _origSids={};
    if(_isNpcFirst){
        _origSids.introGreeting=phrases[0].sid||'';  // NPC greeting (tier 1)
        _origSids.opener=phrases[_followId]?phrases[_followId].sid:'';  // actor response (tier 2)
    } else {
        _origSids.opener=phrases[0].sid||'';
    }
    _origSids.hub=(phrases[hubId]||{}).sid||'';
    // Store per-node original sids
    var _nodeOrigSids={};
    Object.keys(nodes).forEach(function(nid){
        var phId=Number(nid.replace(/^n/,''));
        if(phrases[phId])_nodeOrigSids[nid]={npc:phrases[phId].sid||''};
    });

    var result=Object.assign({opener,hub,hubChoices,nodes,layout:{},_origSids:_origSids,_nodeOrigSids:_nodeOrigSids},_hubBindings,_openerBindings);
    if(_hubVariations.length)result.hubVariations=_hubVariations;
    if(_isNpcFirst){
        result.introGreeting=introGreeting;
    }
    if(_isNpcFirst){
        // give_info belongs on the hub phrase (phrase 2), not on the opener
        // The hub phrase already has it via _hubBindings if present
        // If phrase 0 had give_info but hub doesn't, carry it to hub
        if(phrases[0].giveInfo&&!result.hubGiveInfo)result.hubGiveInfo=phrases[0].giveInfo;
    }
    return result;
}

function findHubPhraseId(phrases){
    const ids=Object.keys(phrases||{}).map(n=>Number(n)).filter(Number.isFinite).sort((a,b)=>a-b);
    for(const id of ids){
        const sid=String((phrases[id]&&phrases[id].sid)||'');
        if(/_hub$/i.test(sid))return id;
    }
    return ids[0]||1;
}

function isReturnPhraseToHub(phrase,hubId,phrases){
    if(!phrase)return false;
    const sid=String(phrase.sid||'');
    if(!/_ret$/i.test(sid))return false;
    const nexts=Array.isArray(phrase.nexts)?phrase.nexts:[];
    return nexts.includes(Number(hubId||1));
}

function collectImportedVanillaForArch(textMap,archId){
    const get=k=>String(textMap[k]||'');
    return {
        hello1:get(`dm_hello_arch_${archId}_1`),
        hello2:get(`dm_hello_arch_${archId}_2`),
        hello3:get(`dm_hello_arch_${archId}_3`),
        job:get(`dm_job_arch_${archId}_1`),
        anomalies:get(`dm_anomalies_arch_${archId}_1`),
        information:get(`dm_information_arch_${archId}_1`),
        tips:get(`dm_tips_arch_${archId}_1`),
        wounded:get(`dm_hello_arch_${archId}_wounded`)
    };
}

function hasVanillaContent(v){
    if(!v||typeof v!=='object')return false;
    return Object.values(v).some(x=>String(x||'').trim()!=='');
}

// Hydrate dialogs for LTX-only packs (no script wrapper)
// Reads dialog_xml and text_eng paths from [arch_pack_meta] section
async function hydrateLtxPackDialogs(chars,ltxText,importCtx){
    if(!chars.length||!importCtx)return;
    const lines=String(ltxText||'').split(/\r?\n/);
    let inMeta=false;
    const meta={};
    for(const raw of lines){
        const line=raw.trim();
        if(line==='[arch_pack_meta]'){inMeta=true;continue;}
        if(line.startsWith('[')&&inMeta)break;
        if(!inMeta)continue;
        const eq=line.indexOf('=');
        if(eq<0)continue;
        meta[line.slice(0,eq).trim()]=line.slice(eq+1).trim();
    }
    const normPaths=(importCtx.availablePaths||[]).map(importNormPath);
    const resolve=rel=>{
        const want=importNormPath(`gamedata/configs/${String(rel||'').replace(/\\/g,'/')}`);
        return normPaths.find(p=>p===want||p.endsWith('/'+want))||'';
    };
    const dialogXmlPaths=[];
    const textEngPaths=[];
    if(meta.dialog_xml){const p=resolve(meta.dialog_xml);if(p)dialogXmlPaths.push(p);}
    if(meta.text_eng){const p=resolve(meta.text_eng);if(p)textEngPaths.push(p);}
    // Fallback: find by naming convention
    if(!dialogXmlPaths.length)normPaths.forEach(p=>{if(/mod_dialog_manager_arch[^/]*\.ltx$/.test(p))dialogXmlPaths.push(p);});
    if(!textEngPaths.length)normPaths.forEach(p=>{if(/gamedata\/configs\/text\/eng\/st_arch_[^/]*\.xml$/.test(p))textEngPaths.push(p);});
    if(!dialogXmlPaths.length&&!textEngPaths.length)return;
    const dialogXmlTexts=await Promise.all(dialogXmlPaths.map(p=>safeImportRead(importCtx,p)));
    const textEngTexts=await Promise.all(textEngPaths.map(p=>safeImportRead(importCtx,p)));
    const textMap=Object.assign({},...textEngTexts.map(parseStringTableXmlMap));
    const dialogDocs=dialogXmlTexts.map(parseDialogsXmlDoc).filter(Boolean);
    chars.forEach(ch=>{
        if(!ch||!ch.archId)return;
        const importedDialogs=collectImportedDialogsForArch(dialogDocs,textMap,ch.archId);
        const importedVanilla=collectImportedVanillaForArch(textMap,ch.archId);
        if(importedDialogs.length||hasVanillaContent(importedVanilla)){
            ch.ov=ch.ov||{};
            const existingDlg=ch.ov.dlg||{};
            const dlg=dc(DEFAULT_DLG);
            // Detect intro dialog and separate it
            const introId=existingDlg.introDialogId||'';
            let introTree=null;
            const regularDialogs=[];
            if(introId){
                importedDialogs.forEach(function(d){
                    if(d._sourceDialogId===introId)introTree=d;
                    else regularDialogs.push(d);
                });
            } else {
                regularDialogs.push.apply(regularDialogs,importedDialogs);
            }
            if(regularDialogs.length)dlg.dialogs=regularDialogs;
            if(introTree){
                dlg.introDialog=introTree;
                dlg.introDialog.label='Intro';
            }
            // Preserve intro metadata
            if(introId)dlg.introDialogId=introId;
            if(existingDlg.introDoneInfo)dlg.introDoneInfo=existingDlg.introDoneInfo;
            dlg.vanilla=Object.assign({},dlg.vanilla||ensureVanillaDlg(null),importedVanilla||{});
            dlg.graph=dlg.graph||{view:'tree'};
            // Preserve task pool data from LTX parsing
            if(Array.isArray(existingDlg.taskPools))dlg.taskPools=existingDlg.taskPools;
            if(Array.isArray(existingDlg.customPools))dlg.customPools=existingDlg.customPools;
            if(Array.isArray(existingDlg.tasks))dlg.tasks=existingDlg.tasks;
            // Hydrate PDA text strings from text_prefix
            var _allPools=(dlg.taskPools||[]).concat(dlg.customPools||[]);
            _allPools.forEach(function(p){
                (p.tasks||[]).forEach(function(t){
                    var prefix=t.textPrefix;
                    if(!prefix)return;
                    var summary=textMap['dm_'+prefix+'_summary']||'';
                    var details=textMap['dm_'+prefix+'_details']||'';
                    if(summary&&!t.openingDialogue)t.openingDialogue=summary;
                    if(details&&!t.desc)t.desc=details;
                    // Store original string IDs for export
                    t._pdaSummarySid='dm_'+prefix+'_summary';
                    t._pdaDetailsSid='dm_'+prefix+'_details';
                });
            });
            ch.ov.dlg=dlg;
        }
    });
}

// ═══════════════════════════════════════════
// MO2 ITEM SCANNER
// ═══════════════════════════════════════════
// Scans MO2 mods/ folder for modded item definitions (.ltx) and string tables (.xml).
// Merges discovered items into ITEM_CATALOG so spawn loadout fields can reference them.

const _MO2_ITEM_CATALOGS_KEY='arch_item_catalogs';

function _mo2ItemScanSetBusy(busy){
    const btn=document.getElementById('mo2ItemScanBtn');
    const spinner=document.getElementById('mo2ItemScanSpinner');
    if(btn)btn.disabled=busy;
    if(spinner)spinner.style.display=busy?'':'none';
}

function scanMO2Items(){
    const statusEl=document.getElementById('mo2ItemScanStatus');
    _mo2ItemScanSetBusy(true);
    if(window.showDirectoryPicker){
        if(statusEl)statusEl.textContent='Opening folder picker…';
        window.showDirectoryPicker({mode:'read'})
            .then(async dir=>{
                try{await _scanItemsFromDir(dir);}
                catch(err){
                    const r=document.getElementById('mo2ItemScanReport');
                    if(statusEl)statusEl.textContent='Error — see log.';
                    if(r){r.style.display='block';r.textContent+='\n\nERROR: '+String(err.message||err);}
                    console.error('[ARCH] item scan error:',err);
                } finally {_mo2ItemScanSetBusy(false);}
            })
            .catch(e=>{
                _mo2ItemScanSetBusy(false);
                if(e.name==='AbortError'){if(statusEl)statusEl.textContent='Cancelled.';}
                else{if(statusEl)statusEl.textContent='Error: '+String(e.message||e);console.warn(e);}
            });
    } else {
        if(statusEl)statusEl.textContent='Select your mods/ folder — browser will enumerate files (may take a minute for large modlists)…';
        const inp=document.createElement('input');
        inp.type='file';
        inp.webkitdirectory=true;
        inp.multiple=true;
        inp.onchange=e=>{
            _scanItemsFromFileList(e.target.files)
                .catch(err=>{
                    if(statusEl)statusEl.textContent='Error — see log.';
                    const r=document.getElementById('mo2ItemScanReport');
                    if(r){r.style.display='block';r.textContent+='\n\nERROR: '+String(err.message||err);}
                    console.error('[ARCH] item scan error:',err);
                })
                .finally(()=>_mo2ItemScanSetBusy(false));
        };
        inp.click();
    }
}

function clearMO2Items(){
    const scannedCount=ITEM_CATALOG.filter(it=>it&&it._scanned).length;
    if(scannedCount&&!confirm(`Remove all ${scannedCount} modded items from the catalog?`))return;
    try{localStorage.removeItem(_MO2_ITEM_CATALOGS_KEY);}catch(_){}
    // Remove scanned items from catalog
    for(let i=ITEM_CATALOG.length-1;i>=0;i--){
        if(ITEM_CATALOG[i]&&ITEM_CATALOG[i]._scanned)ITEM_CATALOG.splice(i,1);
    }
    _rebuildItemLookups();
    const s=document.getElementById('mo2ItemScanStatus');
    if(s)s.textContent='Cleared.';
    const c=document.getElementById('mo2ItemCount');
    if(c)c.textContent='No modded items loaded';
    const r=document.getElementById('mo2ItemScanReport');
    if(r){r.textContent='';r.style.display='none';}
}

async function _scanItemsFromDir(rootDir){
    const statusEl=document.getElementById('mo2ItemScanStatus');
    const reportEl=document.getElementById('mo2ItemScanReport');
    if(statusEl)statusEl.textContent='Scanning…';
    if(reportEl){reportEl.style.display='block';reportEl.textContent='';}
    const log=msg=>{if(reportEl){reportEl.textContent+=msg+'\n';reportEl.scrollTop=reportEl.scrollHeight;}};
    log(`Scanning: ${rootDir.name}/`);

    const allItems=[];
    const allDisabled=new Set();
    let modsScanned=0,modsWithItems=0;
    for await(const [modName,modEntry] of rootDir.entries()){
        if(modEntry.kind!=='directory')continue;
        modsScanned++;
        if(statusEl)statusEl.textContent=`Scanning… (${modsScanned} mods checked, ${allItems.length} items found)`;
        const ltxFiles=await _findLtxInItems(modEntry);
        const xmlFiles=await _findStringTablesInMod(modEntry);
        if(!ltxFiles.length)continue;
        modsWithItems++;
        // Parse string tables first for display names
        const nameMap={};
        for(const {handle} of xmlFiles){
            const text=await handle.text();
            Object.assign(nameMap,_parseStringTable(text));
        }
        // Parse LTX sections
        let modItemCount=0;
        for(const {name,handle} of ltxFiles){
            const text=await handle.text();
            const {sections,disabled}=_parseLtxSections(text);
            disabled.forEach(id=>allDisabled.add(id));
            for(const secId of Object.keys(sections)){
                if(secId.startsWith('_')||secId.includes(':'))continue;
                const cat=_classifyLtxSection(secId,sections[secId]);
                if(!cat)continue;
                const displayName=nameMap[`st_${secId}_name`]||nameMap[secId]||'';
                allItems.push({id:secId,name:displayName||secId,cat,_scanned:true,_mod:modName});
                modItemCount++;
            }
        }
        if(modItemCount)log(`  📦 ${modName}: ${modItemCount} item(s)`);
    }
    // Remove items disabled by patch mods (;[section_id] in any LTX file)
    const beforeCount=allItems.length;
    const filtered=allDisabled.size?allItems.filter(it=>!allDisabled.has(it.id)):allItems;
    const removedCount=beforeCount-filtered.length;
    log(`\n──────────────────`);
    log(`Scanned ${modsScanned} mod(s), items found in ${modsWithItems}.`);
    log(`Total new items: ${filtered.length}${removedCount?` (${removedCount} disabled by patches)`:''}`);
    if(!filtered.length){if(statusEl)statusEl.textContent='No new items found.';return;}
    const nameEl=document.getElementById('mo2CatalogName');
    const catalogName=(nameEl?nameEl.value.trim():'')||'Modlist';
    const added=_mergeScannedItems(filtered,catalogName);
    if(statusEl)statusEl.textContent=`Done — ${added} new items added to "${catalogName}".`;
}

async function _scanItemsFromFileList(fileList){
    const statusEl=document.getElementById('mo2ItemScanStatus');
    const reportEl=document.getElementById('mo2ItemScanReport');
    if(!fileList||!fileList.length){if(statusEl)statusEl.textContent='No files selected.';return;}
    if(statusEl)statusEl.textContent='Scanning…';
    if(reportEl){reportEl.style.display='block';reportEl.textContent='';}
    const log=msg=>{if(reportEl){reportEl.textContent+=msg+'\n';reportEl.scrollTop=reportEl.scrollHeight;}};

    // Group files by mod folder
    if(statusEl)statusEl.textContent='Grouping files…';
    const modFiles={};
    for(const file of fileList){
        const parts=file.webkitRelativePath.split('/');
        if(parts.length<2)continue;
        const second=String(parts[1]||'').toLowerCase();
        const singleMod=(second==='gamedata'||second==='meta.ini');
        const modName=singleMod?parts[0]:parts[1];
        const relPath=singleMod?parts.slice(1).join('/'):parts.slice(2).join('/');
        modFiles[modName]=modFiles[modName]||[];
        modFiles[modName].push({relPath:relPath.toLowerCase(),file});
    }
    const modNames=Object.keys(modFiles);
    log(`Found ${fileList.length} files across ${modNames.length} mod folders.`);

    const allItems=[];
    const allDisabled=new Set();
    let modsScanned=0,modsWithItems=0;
    for(const [modName,files] of Object.entries(modFiles)){
        modsScanned++;
        if(statusEl)statusEl.textContent=`Scanning… (${modsScanned}/${modNames.length} mods, ${allItems.length} items)`;
        const ltxFiles=files.filter(f=>/^gamedata\/configs\/items\/.*\.ltx$/i.test(f.relPath)&&
            !/\/(?:settings|trade|npc_loadouts|parts_custom|upgrades|hideout_furniture|item_sounds|displays|presets)\//i.test(f.relPath));
        const xmlFiles=files.filter(f=>/^gamedata\/configs\/text\/eng\/st_item.*\.xml$/i.test(f.relPath));
        if(!ltxFiles.length)continue;
        modsWithItems++;
        const nameMap={};
        for(const {file} of xmlFiles){
            const text=await file.text();
            Object.assign(nameMap,_parseStringTable(text));
        }
        let modItemCount=0;
        for(const {file} of ltxFiles){
            const text=await file.text();
            const {sections,disabled}=_parseLtxSections(text);
            disabled.forEach(id=>allDisabled.add(id));
            for(const secId of Object.keys(sections)){
                if(secId.startsWith('_')||secId.includes(':'))continue;
                const cat=_classifyLtxSection(secId,sections[secId]);
                if(!cat)continue;
                const displayName=nameMap[`st_${secId}_name`]||nameMap[secId]||'';
                allItems.push({id:secId,name:displayName||secId,cat,_scanned:true,_mod:modName});
                modItemCount++;
            }
        }
        if(modItemCount)log(`  📦 ${modName}: ${modItemCount} item(s)`);
    }
    // Remove items disabled by patch mods (;[section_id] in any LTX file)
    const beforeCount=allItems.length;
    const filtered=allDisabled.size?allItems.filter(it=>!allDisabled.has(it.id)):allItems;
    const removedCount=beforeCount-filtered.length;
    log(`\nScanned ${modsScanned} mod folder(s), items found in ${modsWithItems}.`);
    log(`Total new items: ${filtered.length}${removedCount?` (${removedCount} disabled by patches)`:''}`);
    if(!filtered.length){if(statusEl)statusEl.textContent='No new items found.';return;}
    const nameEl=document.getElementById('mo2CatalogName');
    const catalogName=(nameEl?nameEl.value.trim():'')||'Modlist';
    const added=_mergeScannedItems(filtered,catalogName);
    if(statusEl)statusEl.textContent=`Done — ${added} new items added to "${catalogName}".`;
}

function _parseLtxSections(text){
    const sections={};
    const disabled=new Set();
    let current='';
    String(text||'').split(/\r?\n/).forEach(raw=>{
        const trimmed=raw.replace(/^\uFEFF/,'').trim();
        // Detect commented-out section headers: ;[section_id] — item disabled by patch
        const disSec=trimmed.match(/^;\s*\[([^\]]+)\]/);
        if(disSec){disabled.add(disSec[1].trim());return;}
        // Detect DLTX deletion: ![section_id] — standard Anomaly method to remove sections
        const dltxDel=trimmed.match(/^!\[([^\]]+)\]/);
        if(dltxDel){disabled.add(dltxDel[1].trim());return;}
        let line=trimmed.replace(/;.*$/,'').trim();
        if(!line)return;
        const sec=line.match(/^\[([^\]]+)\]/);
        if(sec){current=sec[1].trim();sections[current]=sections[current]||{};return;}
        if(!current)return;
        const eq=line.indexOf('=');
        if(eq<0)return;
        sections[current][line.slice(0,eq).trim()]=line.slice(eq+1).trim();
    });
    return {sections,disabled};
}

function _parseStringTable(xmlText){
    const out={};
    if(!String(xmlText||'').trim())return out;
    try{
        const doc=new DOMParser().parseFromString(xmlText,'application/xml');
        if(doc.querySelector('parsererror'))return out;
        doc.querySelectorAll('string[id]').forEach(node=>{
            const id=String(node.getAttribute('id')||'').trim();
            if(!id)return;
            const textEl=node.querySelector('text');
            out[id]=(textEl&&textEl.textContent!=null)?String(textEl.textContent):'';
        });
    }catch(_){}
    return out;
}

// Dirs to skip under items/ — not item definitions
const _ITEMS_SKIP_DIRS=new Set(['settings','trade','npc_loadouts','parts_custom','upgrades',
    'hideout_furniture','item_sounds','displays','item_offsets','con_parts_list',
    'nor_parts_list','presets','weapons.mohidden']);

async function _findLtxInItems(modDirHandle){
    const results=[];
    // Navigate mod root → gamedata → configs → items, then walk everything below
    async function walkNav(dirHandle,path,depth){
        for await(const [name,entry] of dirHandle.entries()){
            const fullPath=path?`${path}/${name}`:name;
            if(entry.kind==='directory'){
                const lower=name.toLowerCase();
                if(depth===0&&lower==='gamedata') await walkNav(entry,fullPath,1);
                else if(depth===1&&lower==='configs') await walkNav(entry,fullPath,2);
                else if(depth===2&&lower==='items') await walkItemsDir(entry,fullPath);
            }
        }
    }
    // Once inside items/, walk all subdirs (except skipped ones)
    async function walkItemsDir(dirHandle,path){
        for await(const [name,entry] of dirHandle.entries()){
            const fullPath=`${path}/${name}`;
            if(entry.kind==='directory'){
                if(!_ITEMS_SKIP_DIRS.has(name.toLowerCase()))
                    await walkItemsDir(entry,fullPath);
            } else if(entry.kind==='file'&&name.endsWith('.ltx')){
                results.push({name,handle:await entry.getFile(),path:fullPath});
            }
        }
    }
    await walkNav(modDirHandle,'',0);
    return results;
}

async function _findStringTablesInMod(modDirHandle){
    const results=[];
    async function walk(dirHandle,path){
        for await(const [name,entry] of dirHandle.entries()){
            const fullPath=path?`${path}/${name}`:name;
            if(entry.kind==='directory'){
                const lower=name.toLowerCase();
                if(lower==='gamedata'||lower==='configs'||lower==='text'||lower==='eng')
                    await walk(entry,fullPath);
            } else if(entry.kind==='file'&&/^st_item.*\.xml$/i.test(name)){
                if(/gamedata\/configs\/text\/eng\//i.test(fullPath)){
                    results.push({name,handle:await entry.getFile(),path:fullPath});
                }
            }
        }
    }
    await walk(modDirHandle,'');
    return results;
}

// Map old cat strings (pre-fix) to proper _IB_CAT_OPTS keys
const _CAT_LEGACY_MAP={
    weapon:'w_rifle',grenade:'w_explosive',ammo:'w_ammo',addon:'i_attach',
    outfit:'o_medium',artefact:'i_arty',food:'i_food',medical:'i_medical',
    device:'i_device',mutant_part:'i_mutant_part',misc:'i_misc'
};
function _classifyLtxSection(secId,fields){
    const id=secId.toLowerCase();
    // Skip non-item engine sections
    if(fields&&(fields['GroupControlSection']||'discovery_dependency' in fields))return null;
    // Use weapon_class field when present for accurate weapon sub-type
    const wc=((fields&&(fields['weapon_class']||fields['kind']))||'').toLowerCase();
    // Weapons
    if(id.startsWith('wpn_')){
        if(wc==='pistol'||id.includes('pistol')||/_(pm|glock|usp|fort|sig|colt|beretta|desert|p226|rg6|mp443|tt|walther)(_|$)/.test(id))return 'w_pistol';
        if(wc==='shotgun'||id.includes('shotgun')||/_(sg|spas|ksg|toz|bm16|mossberg|remington|saiga_sh|benelli|ithaca)(_|$)/.test(id))return 'w_shotgun';
        if(wc==='smg'||id.includes('_smg')||/_(mp5|mp7|ump|pp19|pp2000|mac10|mp40|vityaz|kedr|bizon|scorpion_smg|p90)(_|$)/.test(id))return 'w_smg';
        if(wc==='sniper'||id.includes('sniper')||/_(svd|svu|mosin|l96|ssg|dragunov|orsis|ots_03|vintorez|vss|m200|sv98)(_|$)/.test(id))return 'w_sniper';
        if(wc==='knife'||wc==='melee'||id.includes('knife')||id.includes('_axe')||id.includes('_machete'))return 'w_melee';
        return 'w_rifle';
    }
    if(id.startsWith('grenade_'))return 'w_explosive';
    // Ammo
    if(id.startsWith('ammo_'))return 'w_ammo';
    // Magazines (Anomaly Magazines Redux)
    if(id.startsWith('mag_')||id.startsWith('tch_mag'))return 'i_attach';
    // Attachments / scopes
    if(id.startsWith('addon_')||id.startsWith('scope_')||id.startsWith('sil_')||id.startsWith('suppressor_'))return 'i_attach';
    // Outfits / helmets
    if(id.startsWith('helm_')||id.startsWith('helmet_'))return 'o_helmet';
    if(id.startsWith('outfit_')){
        if(/exo|seva|_heavy|_e_exo/.test(id))return 'o_heavy';
        return 'o_medium';
    }
    // Artefacts
    if(id.startsWith('af_container_')||id.startsWith('artefact_container'))return 'i_arty_cont';
    if(id.startsWith('af_')||id.startsWith('artefact_'))return 'i_arty';
    // Food / drink / medical
    if(id.startsWith('food_'))return 'i_food';
    if(id.startsWith('drink_'))return 'i_drink';
    if(id.startsWith('drug_')||id.startsWith('medkit')||id.startsWith('bandage')||
       id.startsWith('antirad')||id.startsWith('stimpack'))return 'i_medical';
    // Devices
    if(id.startsWith('device_'))return 'i_device';
    // Upgrades
    if(id.startsWith('upgrade_'))return 'i_upgrade';
    // Parts
    if(id.startsWith('mutant_part_'))return 'i_mutant_part';
    if(id.startsWith('part_'))return 'i_part';
    // Misc items
    if(id.startsWith('backpack_')||id.startsWith('item_')||id.startsWith('itm_'))return 'i_misc';
    // Fallback: any section with inv_weight or cost is likely an item
    if(fields&&(fields['inv_weight']||fields['cost']))return 'i_misc';
    return null;
}

function _mergeScannedItems(items,catalogName){
    if(!items||!items.length)return 0;
    catalogName=String(catalogName||'Modlist').trim()||'Modlist';
    // Deduplicate against existing catalog
    const existingIds=new Set();
    ITEM_CATALOG.forEach(it=>{if(it&&it.id)existingIds.add(it.id.toLowerCase());});
    const newItems=[];
    const seen=new Set();
    items.forEach(it=>{
        const key=it.id.toLowerCase();
        if(existingIds.has(key)||seen.has(key))return;
        seen.add(key);
        it._source=catalogName;
        newItems.push(it);
    });
    // Add to catalog and rebuild lookups
    newItems.forEach(it=>ITEM_CATALOG.push(it));
    if(newItems.length){
        _rebuildItemLookups();
        // Refresh any already-open item browsers so source filter appears
        document.querySelectorAll('[data-ibuid]').forEach(el=>{
            if(el._ibState&&typeof _ibRenderCatalog==='function')_ibRenderCatalog(el);
        });
        // Refresh spawn picker source dropdown
        if(typeof _updateSpawnPickSrc==='function')_updateSpawnPickSrc();
        if(typeof updateSpawnItemSelect==='function')updateSpawnItemSelect();
    }
    // Persist: load existing catalogs, add/merge this one
    try{
        let catalogs=[];
        const raw=localStorage.getItem(_MO2_ITEM_CATALOGS_KEY);
        if(raw)catalogs=JSON.parse(raw)||[];
        const existing=catalogs.find(c=>c.name===catalogName);
        if(existing)existing.items=[...existing.items,...newItems];
        else catalogs.push({name:catalogName,items:newItems});
        localStorage.setItem(_MO2_ITEM_CATALOGS_KEY,JSON.stringify(catalogs));
    }catch(_){}
    _updateMO2CountDisplay();
    return newItems.length;
}

function _updateMO2CountDisplay(){
    const c=document.getElementById('mo2ItemCount');
    if(!c)return;
    try{
        const raw=localStorage.getItem(_MO2_ITEM_CATALOGS_KEY);
        if(!raw){c.textContent='No modded items loaded';return;}
        const catalogs=JSON.parse(raw)||[];
        const total=catalogs.reduce((n,cat)=>n+(cat.items?cat.items.length:0),0);
        if(!total){c.textContent='No modded items loaded';return;}
        const names=catalogs.map(cat=>cat.name).join(', ');
        c.textContent=`${total} modded items (${names})`;
    }catch(_){c.textContent='Modded items loaded';}
}

function _rebuildItemLookups(){
    // Clear existing lookups
    Object.keys(ITEM_LOOKUP_BY_ID).forEach(k=>delete ITEM_LOOKUP_BY_ID[k]);
    Object.keys(ITEM_LOOKUP_BY_NAME).forEach(k=>delete ITEM_LOOKUP_BY_NAME[k]);
    Object.keys(ITEM_LOOKUP_BY_DISPLAY).forEach(k=>delete ITEM_LOOKUP_BY_DISPLAY[k]);
    // Rebuild from catalog
    ITEM_CATALOG.forEach(it=>{
        const id=String((it&&it.id)||'').trim();
        if(!id)return;
        const name=String((it&&it.name)||id).trim()||id;
        const key=id.toLowerCase();
        if(!ITEM_LOOKUP_BY_ID[key])
            ITEM_LOOKUP_BY_ID[key]={id,name,cat:String((it&&it.cat)||'misc')};
        const nk=name.toLowerCase();
        if(!ITEM_LOOKUP_BY_NAME[nk])ITEM_LOOKUP_BY_NAME[nk]=[];
        ITEM_LOOKUP_BY_NAME[nk].push({id,name,cat:String((it&&it.cat)||'misc')});
        const display=`${name} [${id}]`.toLowerCase();
        ITEM_LOOKUP_BY_DISPLAY[display]=id;
    });
}

// Auto-load persisted scanned items on startup
function _loadPersistedMO2Items(){
    try{
        const raw=localStorage.getItem(_MO2_ITEM_CATALOGS_KEY);
        if(!raw)return;
        const catalogs=JSON.parse(raw);
        if(!Array.isArray(catalogs)||!catalogs.length)return;
        const existingIds=new Set();
        ITEM_CATALOG.forEach(it=>{if(it&&it.id)existingIds.add(it.id.toLowerCase());});
        let added=0;
        catalogs.forEach(catalog=>{
            const items=Array.isArray(catalog.items)?catalog.items:(Array.isArray(catalog)?catalog:[]);
            const name=catalog.name||'Modlist';
            items.forEach(it=>{
                if(!it||!it.id)return;
                const key=it.id.toLowerCase();
                if(existingIds.has(key))return;
                existingIds.add(key);
                it._scanned=true;
                it._source=it._source||name;
                // Re-classify using ID (catches weapon sub-types, outfit types, etc.)
                // Fall back to legacy map only if classifier returns null (no fields available at load time)
                const reclassified=_classifyLtxSection(it.id,null);
                if(reclassified) it.cat=reclassified;
                else if(it.cat&&_CAT_LEGACY_MAP[it.cat])it.cat=_CAT_LEGACY_MAP[it.cat];
                ITEM_CATALOG.push(it);
                added++;
            });
        });
        if(added)_rebuildItemLookups();
        _updateMO2CountDisplay();
    }catch(_){}
}
// ── LTX File Browser ──
async function browseLtxFile(){
    const browser=document.getElementById('ltxFileBrowser');
    if(!browser)return;
    browser.innerHTML='<div style="padding:6px;color:#aaa;font-size:11px">Pick the folder to browse (e.g. your mod\'s gamedata/configs/ or a mods/ root)…</div>';
    browser.style.display='block';
    let rootDir;
    try{
        if(window.showDirectoryPicker){
            rootDir=await window.showDirectoryPicker({id:'ltxBrowse',mode:'read'});
        } else {
            browser.innerHTML='<div style="padding:6px;color:#f44;font-size:11px">Directory picker not supported in this browser.</div>';
            return;
        }
    }catch(e){browser.style.display='none';return;}
    browser.innerHTML='<div style="padding:6px;color:#aaa;font-size:11px">Scanning…</div>';
    // Collect all .ltx files, compute path relative to picked root
    const files=[];
    async function walk(dir,relPath){
        for await(const [name,entry] of dir.entries()){
            const fp=relPath?relPath+'/'+name:name;
            if(entry.kind==='directory') await walk(entry,fp);
            else if(name.endsWith('.ltx')) files.push(fp);
        }
    }
    await walk(rootDir,'');
    if(!files.length){browser.innerHTML='<div style="padding:6px;color:#aaa;font-size:11px">No .ltx files found in that folder.</div>';return;}
    // Find the "configs/" boundary to compute gamedata-relative path
    function toGamedataRel(p){
        const lower=p.toLowerCase();
        const idx=lower.indexOf('configs/');
        return idx>=0?p.slice(idx+8).replace(/\//g,'\\'):p.replace(/\//g,'\\');
    }
    let html='<div style="padding:4px 8px;font-size:10px;color:#555;border-bottom:1px solid #1e1e1e">'+files.length+' .ltx files — click to select</div>';
    files.sort();
    files.forEach(fp=>{
        const rel=toGamedataRel(fp);
        html+=`<div style="padding:3px 10px;font-size:11px;color:#aaa;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(rel)}" onmouseenter="this.style.background='#1e1e1e'" onmouseleave="this.style.background=''" onclick="_ltxFileSelect(${JSON.stringify(rel)})">${esc(rel)}</div>`;
    });
    browser.innerHTML=html;
}
function _ltxFileSelect(rel){
    const inp=document.getElementById('f_ltxPath');
    if(inp){inp.value=rel;saveField('ltxPath',rel);}
    const browser=document.getElementById('ltxFileBrowser');
    if(browser)browser.style.display='none';
}

// Run on load
if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',_loadPersistedMO2Items);
} else {
    _loadPersistedMO2Items();
}

