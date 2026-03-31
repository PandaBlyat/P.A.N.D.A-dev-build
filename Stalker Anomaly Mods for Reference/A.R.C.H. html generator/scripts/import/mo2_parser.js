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

