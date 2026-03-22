function lintSpawnLines(text,slot,label){
    const issues=[];
    const lines=String(text||'').split(/\r?\n/);
    lines.forEach((raw,idx)=>{
        const line=raw.trim();
        if(!line)return;
        const parts=line.split(':').map(v=>v.trim());
        const sec=resolveItemSection(parts[0]||'');
        if(!sec){
            issues.push(`ERROR ${label} line ${idx+1}: missing item section.`);
            return;
        }
        if(!hasCatalogItem(sec)){
            issues.push(`WARN ${label} line ${idx+1}: '${sec}' is not in vanilla catalog (allowed for custom items).`);
        }
        if(slot==='extra'){
            if(parts.length!==2){
                issues.push(`WARN ${label} line ${idx+1}: expected "section:chance".`);
            }
            const chance=Number(parts[1]||100);
            if(!Number.isFinite(chance)||chance<0||chance>100)issues.push(`WARN ${label} line ${idx+1}: chance should be 0..100.`);
            return;
        }
        if(parts.length!==4){
            issues.push(`WARN ${label} line ${idx+1}: expected "section:attachment:ammo_type:chance".`);
        }
        const chance=Number(parts[3]!==undefined?parts[3]:100);
        if(!Number.isFinite(chance)||chance<0||chance>100)issues.push(`WARN ${label} line ${idx+1}: chance should be 0..100.`);
    });
    return issues;
}
function lintTradeLines(text,kind,label){
    const issues=[];
    const lines=String(text||'').split(/\r?\n/);
    lines.forEach((raw,idx)=>{
        const line=raw.trim();
        if(!line)return;
        const p=line.split(':').map(v=>v.trim());
        if(kind==='supply'){
            if(p.length!==5)issues.push(`WARN ${label} line ${idx+1}: expected "stock_tier:goodwill:section:qty:prob".`);
            if(String(p[0]||'').indexOf('stock_')!==0)issues.push(`WARN ${label} line ${idx+1}: tier usually starts with stock_.`);
            const sec=resolveItemSection(p[2]||'');
            if(!sec)issues.push(`ERROR ${label} line ${idx+1}: missing item section.`);
            else if(!hasCatalogItem(sec))issues.push(`WARN ${label} line ${idx+1}: '${sec}' is not in vanilla catalog.`);
            const gw=Number(p[1]||0),qty=Number(p[3]||1),prob=Number(p[4]||1);
            if(!Number.isFinite(gw))issues.push(`WARN ${label} line ${idx+1}: goodwill must be numeric.`);
            if(!Number.isFinite(qty)||qty<0)issues.push(`WARN ${label} line ${idx+1}: quantity must be >= 0.`);
            if(!Number.isFinite(prob)||prob<0)issues.push(`WARN ${label} line ${idx+1}: probability must be >= 0.`);
            return;
        }
        if(p.length!==3)issues.push(`WARN ${label} line ${idx+1}: expected "section:base:mult".`);
        const sec=resolveItemSection(p[0]||'');
        if(!sec)issues.push(`ERROR ${label} line ${idx+1}: missing item section.`);
        else if(!hasCatalogItem(sec))issues.push(`WARN ${label} line ${idx+1}: '${sec}' is not in vanilla catalog.`);
        const base=Number(p[1]||1),mult=Number(p[2]||1);
        if(!Number.isFinite(base)||base<0)issues.push(`WARN ${label} line ${idx+1}: base must be >= 0.`);
        if(!Number.isFinite(mult)||mult<0)issues.push(`WARN ${label} line ${idx+1}: mult must be >= 0.`);
    });
    return issues;
}
function normalizeSpawnLine(raw,slot){
    const line=String(raw||'').trim();
    if(!line)return null;
    const p=line.split(':').map(v=>v.trim());
    const sec=resolveItemSection(p[0]||'');
    if(!sec)return null;
    if(slot==='extra'){
        let chance=100;
        if(p.length>=2&&Number.isFinite(Number(p[1])))chance=Number(p[1]);
        else if(p.length>=4&&Number.isFinite(Number(p[3])))chance=Number(p[3]);
        chance=clampNumber(chance,0,100,100);
        return `${sec}:${numFmt(chance)}`;
    }
    let attach='0',ammo='0',chance=100;
    if(p.length===2){
        if(Number.isFinite(Number(p[1])))chance=Number(p[1]);
        else attach=p[1]||'0';
    }else if(p.length>=3){
        attach=p[1]||'0';
        ammo=p[2]||'0';
        if(p.length>=4&&Number.isFinite(Number(p[3])))chance=Number(p[3]);
    }
    chance=clampNumber(chance,0,100,100);
    return `${sec}:${attach||'0'}:${ammo||'0'}:${numFmt(chance)}`;
}
function normalizeTradeLine(raw,kind){
    const line=String(raw||'').trim();
    if(!line)return null;
    const p=line.split(':').map(v=>v.trim());
    if(kind==='supply'){
        let tier='stock_0',gw=0,sec='',qty=1,prob=1;
        if(String(p[0]||'').indexOf('stock_')===0){
            tier=p[0]||'stock_0';
            gw=Number.isFinite(Number(p[1]))?Number(p[1]):0;
            sec=resolveItemSection(p[2]||'');
            qty=Number.isFinite(Number(p[3]))?Number(p[3]):1;
            prob=Number.isFinite(Number(p[4]))?Number(p[4]):1;
        }else{
            sec=resolveItemSection(p[0]||'');
            tier=p[1]&&String(p[1]).indexOf('stock_')===0?p[1]:'stock_0';
            gw=Number.isFinite(Number(p[2]))?Number(p[2]):0;
            qty=Number.isFinite(Number(p[3]))?Number(p[3]):1;
            prob=Number.isFinite(Number(p[4]))?Number(p[4]):1;
        }
        if(!sec)return null;
        return `${tier}:${numFmt(gw)}:${sec}:${numFmt(Math.max(0,qty))}:${numFmt(Math.max(0,prob))}`;
    }
    const sec=resolveItemSection(p[0]||'');
    if(!sec)return null;
    const base=Number.isFinite(Number(p[1]))?Number(p[1]):1;
    const mult=Number.isFinite(Number(p[2]))?Number(p[2]):1;
    return `${sec}:${numFmt(Math.max(0,base))}:${numFmt(Math.max(0,mult))}`;
}
function getTextValue(id,fallback){
    const el=document.getElementById(id);
    if(el)return String(el.value||'');
    return String(fallback||'');
}
function runTradeLoadoutLint(){
    const s=(curGrp!==null)?getD('settings'):dc(DEFAULT_SETTINGS);
    const t=(curGrp!==null)?getTrade():dc(DEFAULT_TRADE);
    const issues=[]
        .concat(lintSpawnLines(getTextValue('f_spawnPrimary',s.spawnPrimary),'primary','Spawn Primary'))
        .concat(lintSpawnLines(getTextValue('f_spawnSecondary',s.spawnSecondary),'secondary','Spawn Secondary'))
        .concat(lintSpawnLines(getTextValue('f_spawnExtra',s.spawnExtra),'extra','Spawn Extra'))
        .concat(lintTradeLines(getTextValue('f_tradeBuyList',t.buyListRaw),'buy','Trade Buy'))
        .concat(lintTradeLines(getTextValue('f_tradeSellList',t.sellListRaw),'sell','Trade Sell'))
        .concat(lintTradeLines(getTextValue('f_tradeSupplyList',t.supplyListRaw),'supply','Trade Supply'));
    const errCount=issues.filter(v=>String(v).indexOf('ERROR')===0).length;
    const warnCount=issues.length-errCount;
    const rep=document.getElementById('tradeLoadoutLintReport');
    if(rep){
        if(!issues.length){
            rep.innerHTML='No lint warnings.';
        }else{
            const header=`Summary: errors=${errCount}, warnings=${warnCount}`;
            rep.innerHTML=`<span style="color:#9ad3ff">${esc(header)}</span><br><br>${issues.map(v=>`• ${esc(v)}`).join('<br>')}`;
        }
    }
    return issues;
}
_debouncedLint=_debounce(runTradeLoadoutLint,400);
function normalizeBlock(text,kind){
    const lines=String(text||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    const out=[];
    lines.forEach(line=>{
        let norm=null;
        if(kind==='spawn_primary')norm=normalizeSpawnLine(line,'primary');
        else if(kind==='spawn_secondary')norm=normalizeSpawnLine(line,'secondary');
        else if(kind==='spawn_extra')norm=normalizeSpawnLine(line,'extra');
        else if(kind==='trade_buy')norm=normalizeTradeLine(line,'buy');
        else if(kind==='trade_sell')norm=normalizeTradeLine(line,'sell');
        else if(kind==='trade_supply')norm=normalizeTradeLine(line,'supply');
        if(norm)out.push(norm);
    });
    return out.join('\n');
}
function autoFixTradeLoadout(){
    if(curGrp===null&&!(editMode==='solo'&&curSolo!==null))return;
    const fixes=[];
    function apply(id,kind,saveCb,key){
        const el=document.getElementById(id);
        if(el){
            const before=String(el.value||'');
            const after=normalizeBlock(before,kind);
            if(before!==after){el.value=after;if(saveCb)saveCb(key,after);fixes.push(id);}
        } else {
            // No textarea (spawn fields use chip UI) — read from data
            const s=getD('settings');
            if(s&&s[key]!=null){
                const before=String(s[key]||'');
                const after=normalizeBlock(before,kind);
                if(before!==after){saveField(key,after);fixes.push(key);}
            }
        }
    }
    apply('f_spawnPrimary','spawn_primary',saveField,'spawnPrimary');
    apply('f_spawnSecondary','spawn_secondary',saveField,'spawnSecondary');
    apply('f_spawnExtra','spawn_extra',saveField,'spawnExtra');
    apply('f_tradeBuyList','trade_buy',saveTradeField,'buyListRaw');
    apply('f_tradeSellList','trade_sell',saveTradeField,'sellListRaw');
    apply('f_tradeSupplyList','trade_supply',saveTradeField,'supplyListRaw');
    runTradeLoadoutLint();
    const _ta=document.getElementById('f_spawnAll');
    if(_ta){_ta.value=mergeSpawnSlots(getD('settings'));}
    if(typeof updateSpawnSlotPreview==='function')updateSpawnSlotPreview(getD('settings'));
    if(fixes.length){
        setStatus(`Auto-fix normalized ${fixes.length} field(s).`,'ok');
    }else{
        setStatus('Auto-fix: no changes needed.','ok');
    }
}
function uniqueList(arr){
    const seen=new Set();
    return arr.filter(v=>{
        const k=String(v||'').toLowerCase();
        if(!k||seen.has(k))return false;
        seen.add(k);
        return true;
    });
}
function findAmmoByPattern(pat){
    const key=String(pat||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!key)return [];
    return ITEM_CATALOG
        .filter(it=>String((it&&it.cat)||'').toLowerCase()==='ammo')
        .map(it=>String((it&&it.id)||'').trim())
        .filter(Boolean)
        .filter(id=>id.toLowerCase().replace(/[^a-z0-9]/g,'').indexOf(key)>=0);
}
function getAmmoSuggestionsForWeapon(section){
    const sec=String(section||'').toLowerCase();
    if(!sec)return [];
    const hitHint=AMMO_CALIBER_HINTS.find(h=>h.keys.some(k=>sec.indexOf(k)>=0));
    let out=[];
    if(hitHint){
        hitHint.ammo.forEach(p=>{out=out.concat(findAmmoByPattern(p));});
    }
    if(!out.length){
        const token=sec.match(/[0-9]{1,2}(?:[._]?[0-9]{1,2})?(?:x[0-9]{2})?/);
        if(token)out=out.concat(findAmmoByPattern(token[0]));
    }
    if(!out.length){
        out=ITEM_CATALOG.filter(it=>String((it&&it.cat)||'').toLowerCase()==='ammo').map(it=>String((it&&it.id)||'').trim()).filter(Boolean).slice(0,2);
    }
    return uniqueList(out).slice(0,3);
}
function appendUniqueLinesToField(fieldId,lines){
    const el=document.getElementById(fieldId);
    if(!el)return 0;
    const existing=String(el.value||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    const seen=new Set(existing.map(v=>v.toLowerCase()));
    let added=0;
    lines.forEach(line=>{
        const t=String(line||'').trim();
        if(!t)return;
        const k=t.toLowerCase();
        if(seen.has(k))return;
        seen.add(k);
        existing.push(t);
        added++;
    });
    if(added)el.value=existing.join('\n');
    return added;
}
function getWeaponSeedFromInput(inputId,fallbackFieldId){
    const raw=(document.getElementById(inputId)||{}).value||'';
    const sec=resolveItemSection(raw);
    if(sec&&sec.toLowerCase().indexOf('wpn_')===0)return sec;
    const fb=(document.getElementById(fallbackFieldId)||{}).value||'';
    const first=String(fb).split(/\r?\n/).map(v=>v.trim()).find(Boolean)||'';
    const parsed=resolveItemSection(first.split(':')[0]||'');
    if(parsed&&parsed.toLowerCase().indexOf('wpn_')===0)return parsed;
    return '';
}
function addSuggestedAmmoToSpawnExtra(){
    // Read primary weapon from data (no textarea)
    const s=getD('settings');
    const primaryRaw=String(s&&s.spawnPrimary||'');
    const first=primaryRaw.split(/\r?\n/).map(v=>v.trim()).find(Boolean)||'';
    const seed=resolveItemSection(first.split(':')[0]||'');
    if(!seed||seed.toLowerCase().indexOf('wpn_')!==0){alert('No weapon found in Primary loadout to suggest ammo for.');return;}
    const ammo=getAmmoSuggestionsForWeapon(seed);
    if(!ammo.length){alert('No ammo suggestions found for this weapon.');return;}
    // Append to extra via data
    const existing=String(s.spawnExtra||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    const seen=new Set(existing.map(v=>v.split(':')[0].toLowerCase()));
    let added=0;
    ammo.forEach(a=>{if(!seen.has(a.toLowerCase())){existing.push(`${a}:70`);seen.add(a.toLowerCase());added++;}});
    if(added){
        saveField('spawnExtra',existing.join('\n'));
        const ta=document.getElementById('f_spawnAll');
        if(ta){ta.value=mergeSpawnSlots(getD('settings'));}
        updateSpawnSlotPreview(getD('settings'));
        runTradeLoadoutLint();
        setStatus(`Added ${added} ammo suggestion(s) to Spawn Extra.`,'ok');
    }
}
function addSuggestedAmmoToTradeBuy(){
    const s=getD('settings');const pr=String(s&&s.spawnPrimary||'');
    const first=pr.split(/\r?\n/).map(v=>v.trim()).find(Boolean)||'';
    const seed=resolveItemSection(first.split(':')[0]||'');
    if(!seed||seed.toLowerCase().indexOf('wpn_')!==0){alert('No weapon found in Primary loadout to suggest ammo for.');return;}
    const ammo=getAmmoSuggestionsForWeapon(seed);
    const lines=ammo.map(a=>`${a}:0.9:1`);
    const added=appendUniqueLinesToField('f_tradeBuyList',lines);
    if(added){
        saveTradeField('buyListRaw',document.getElementById('f_tradeBuyList').value);
        runTradeLoadoutLint();
        setStatus(`Added ${added} ammo buy-line suggestion(s).`,'ok');
    }
}
function addSuggestedAmmoToTradeSupply(){
    const s2=getD('settings');const pr2=String(s2&&s2.spawnPrimary||'');
    const first2=pr2.split(/\r?\n/).map(v=>v.trim()).find(Boolean)||'';
    const seed=resolveItemSection(first2.split(':')[0]||'');
    if(!seed||seed.toLowerCase().indexOf('wpn_')!==0){alert('Select a weapon first.');return;}
    const ammo=getAmmoSuggestionsForWeapon(seed);
    const lines=ammo.map(a=>`stock_0:0:${a}:24:0.6`);
    const added=appendUniqueLinesToField('f_tradeSupplyList',lines);
    if(added){
        saveTradeField('supplyListRaw',document.getElementById('f_tradeSupplyList').value);
        runTradeLoadoutLint();
        setStatus(`Added ${added} ammo supply suggestion(s).`,'ok');
    }
}
function syncDialogId(){const v=sanitizeLuaId(document.getElementById('f_archId').value.trim(),'');document.getElementById('f_dialogId').value=v?'arch_'+v+'_dialog':'';}

