// ═══════════════════════════════════════════
// TAB REFRESH (populate from data)
// ═══════════════════════════════════════════
function refreshTab(tab){
    const hasEdit=(editMode&&(curGrp!==null||editMode==='solo'));
    if(!hasEdit)return;

    if(tab==='settings'){
        document.getElementById('secPerChar').style.display=(editMode==='char'||editMode==='solo')?'block':'none';
        const s=getD('settings');
        if(editMode==='char'){
            const ch=groups[curGrp].chars[curChar];
            document.getElementById('f_archId').value=ch.archId;
            document.getElementById('f_displayName').value=ch.displayName||'';
            syncDialogId();
        } else if(editMode==='solo'&&curSolo!==null){
            const ch=soloChars[curSolo];
            document.getElementById('f_archId').value=ch.archId;
            document.getElementById('f_displayName').value=ch.displayName||'';
            syncDialogId();
        }
        document.getElementById('f_namePrefix').value=s.namePrefix||'';
        document.getElementById('f_nameFullName').value=s.nameFullName||'';
        document.getElementById('f_nameSuffix').value=s.nameSuffix||'';
        updateNamePreview();
        setFilterUI('Comm',s.commMode,s.commVals);
        setFilterUI('Loc',s.locMode,s.locVals);
        setFilterUI('Rank',s.rankMode,s.rankVals);
        document.getElementById('f_male').checked=s.male!==false;
        document.getElementById('f_female').checked=s.female!==false;
        document.getElementById('f_buyMod').value=s.buyMod||'0.85';
        document.getElementById('f_sellMod').value=s.sellMod||'1.15';
        document.getElementById('f_ltxPath').value=s.ltxPath||'';
        document.getElementById('f_amount').value=s.amount||'1';
        document.getElementById('f_tier').value=s.tier||'3';
        document.getElementById('f_chance').value=s.chance||'100';
        document.getElementById('f_availableAfterDays').value=s.availableAfterDays||'0';
        document.getElementById('f_respawn').checked=s.respawn!==false;
        const si=document.getElementById('f_spawnInherit');if(si)si.value=s.spawnInherit||'';
        const dr=document.getElementById('f_dialogRemove');if(dr)dr.value=s.dialogRemove||'';
        // Merge 3 internal slots into unified textarea
        const spawnAll=document.getElementById('f_spawnAll');
        if(spawnAll) spawnAll.value=mergeSpawnSlots(s);
        updateSpawnSlotPreview(s);
        // Populate spawn picker category dropdown from _IB_CAT_OPTS
        const spawnCatSel=document.getElementById('spawnPickCat');
        if(spawnCatSel&&!spawnCatSel.options.length){
            spawnCatSel.innerHTML=_IB_CAT_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
        }
        updateSpawnItemSelect();
        const wc=document.getElementById('f_wizCommunity');
        const wl=document.getElementById('f_wizLocation');
        if(wc&&s.commVals&&s.commVals.length)wc.value=s.commVals[0];
        if(wl&&s.locVals&&s.locVals.length)wl.value=s.locVals[0];
        runTradeLoadoutLint();
    }else if(tab==='trade'){
        const t=getTrade();
        _rebuildTradeParentOptions();
        document.getElementById('f_tradeParent').value=t.tradeParent||'';
        document.getElementById('f_tradeCond').value=t.tradeCond||'0.5';
        document.getElementById('f_tradeBuyExp').value=t.tradeBuyExp||'1.0';
        document.getElementById('f_tradeSellExp').value=t.tradeSellExp||'1.0';
        document.getElementById('f_tradeBuyList').value=t.buyListRaw||'';
        document.getElementById('f_tradeSellList').value=t.sellListRaw||'';
        document.getElementById('f_tradeSupplyList').value=t.supplyListRaw||'';
        runTradeLoadoutLint();
        // Re-init open trade item browsers
        ['ib_trade_buy','ib_trade_sell','ib_trade_supply'].forEach(hid=>{
            if(_tradeIbOpen[hid]){const h=document.getElementById(hid);if(h){h._ibCfg=null;_initTradeIb(hid,h);}}
        });
    }else if(tab==='dialogs'){
        getCurTree(); // ensure migration runs
        renderDialogTreeTabs();
        hideNodeEditPanel();
        renderBranches();
        if(curDlgSubtab==='tasks')renderTaskList();
        if(curDlgSubtab==='specializations')renderSpecializationList();
        // Populate news fields from data
        const ns=getD('settings')||{};
        const niEl=document.getElementById('f_newsIcon');
        if(niEl)niEl.value=ns.newsIcon||'';
        const ndEl=document.getElementById('f_newsOnDeath');
        if(ndEl)ndEl.value=ns.newsOnDeath||'';
        const naEl=document.getElementById('f_newsOnArea');
        if(naEl)naEl.value=ns.newsOnArea||'';
        if(curDlgSubtab==='news')renderNewsPreview();
    }
}

function setFilterUI(cat,mode,vals){
    const modeEl=document.getElementById('mode'+cat);
    modeEl.querySelectorAll('button').forEach(b=>b.className='');
    const isEmpty=!vals||!vals.length;
    // children[0]=All, children[1]=Include, children[2]=Exclude
    if(mode==='inc'&&isEmpty)modeEl.children[0].className='aa';
    else if(mode==='inc')modeEl.children[1].className='ai';
    else if(mode==='exc')modeEl.children[2].className='ae';
    const boxMap={Comm:'filterComm',Loc:'filterLoc',Rank:'filterRank'};
    const box=document.getElementById(boxMap[cat]);
    box.querySelectorAll('input').forEach(cb=>{cb.checked=(vals||[]).includes(cb.value);});
    box.querySelectorAll('.mi').forEach(el=>el.classList.toggle('exc',mode==='exc'));
}

// ── Name preview ──
const _NP_FIRST=['Alex','Dima','Kolya','Misha','Vasya','Sasha','Boris','Anton','Yura','Grisha'];
const _NP_LAST=['Baranov','Petrov','Ivanov','Kozlov','Smirnov','Volkov','Morozov','Lebedev','Novikov','Sokolov'];
let _npFirst='',_npLast='';
function rerollNamePreview(){
    _npFirst=_NP_FIRST[Math.floor(Math.random()*_NP_FIRST.length)];
    _npLast=_NP_LAST[Math.floor(Math.random()*_NP_LAST.length)];
    updateNamePreview();
}
function updateNamePreview(){
    const el=document.getElementById('namePreviewText');
    if(!el)return;
    if(!_npFirst){_npFirst=_NP_FIRST[Math.floor(Math.random()*_NP_FIRST.length)];_npLast=_NP_LAST[Math.floor(Math.random()*_NP_LAST.length)];}
    const prefix=((document.getElementById('f_namePrefix')||{}).value||'').trim();
    const full=((document.getElementById('f_nameFullName')||{}).value||'').trim();
    const suffix=((document.getElementById('f_nameSuffix')||{}).value||'').trim();
    const base=full||(_npFirst+' '+_npLast);
    const parts=[];
    if(prefix)parts.push(prefix);
    parts.push(base);
    if(suffix)parts.push(suffix);
    el.textContent=parts.join(' ');
}

// Vanilla trade presets — extracted from Vanilla files/configs/items/trade/
// Buy/sell format: item:baseMult:sellMult  Supply format: tier:gw:item:qty:prob
var TRADE_PRESETS={
    generic:{label:'Generic (Trasher)',parent:'trasher',condition:0.50,buyExp:2.25,sellExp:0.75,buy:[],sell:[],supply:[]},
    barman:{label:'Barman',parent:'barman',condition:0.50,buyExp:2.25,sellExp:0.75,
        buy:['mutant_part_flesh_meat:0.6:0.6','mutant_part_boar_chop:0.3:0.3','mutant_part_dog_meat:0.6:0.6','mutant_part_psevdodog_meat:0.6:0.6','mutant_part_krovosos_meat:0.6:0.6','mutant_part_snork_hand:0.3:0.3','mutant_part_chimera_meat:0.6:0.6','mutant_part_tushkano_meat:0.6:0.6','mutant_part_psysucker_meat:0.6:0.6','mutant_part_lurker_meat:0.6:0.6',
        'mutant_part_krovosos_jaw:0.3:0.3','mutant_part_boar_leg:0.3:0.3','mutant_part_chimera_kogot:0.3:0.3','mutant_part_dog_tail:0.3:0.3','mutant_part_flesh_eye:0.3:0.3','mutant_part_psevdodog_tail:0.3:0.3','mutant_part_snork_leg:0.3:0.3','mutant_part_snork_mask:0.3:0.3','mutant_part_tushkano_head:0.3:0.3','mutant_part_pseudogigant_eye:0.3:0.3','mutant_part_pseudogigant_hand:0.3:0.3','mutant_part_chimera_claw:0.3:0.3','mutant_part_cat_tail:0.3:0.3','mutant_part_burer_hand:0.3:0.3','mutant_part_zombi_hand:0.3:0.3','mutant_part_controller_hand:0.3:0.3','mutant_part_controller_glass:0.3:0.3','mutant_part_fracture_hand:0.3:0.3','mutant_part_dog_liver:0.3:0.3','mutant_part_dog_heart:0.3:0.3','mutant_part_cat_thyroid:0.3:0.3','mutant_part_cat_claw:0.3:0.3','mutant_part_lurker_tail:0.3:0.3','mutant_part_lurker_eye:0.3:0.3','mutant_part_psysucker_hand:0.3:0.3',
        'hide_chimera:0.3:0.3','hide_pseudogiant:0.3:0.3','hide_psy_dog:0.3:0.3','hide_pseudodog:0.3:0.3','hide_burer:0.3:0.3','hide_controller:0.3:0.3','hide_bloodsucker:0.3:0.3','hide_boar:0.3:0.3','hide_flesh:0.3:0.3','hide_lurker:0.3:0.3','hide_psysucker:0.3:0.3',
        'af_ameba_mica:0.3:0.3','af_ameba_slime:0.3:0.3','af_ameba_slug:0.3:0.3','af_baloon:0.3:0.3','af_blood:0.3:0.3','af_compass:0.3:0.3','af_cristall:0.3:0.3','af_cristall_flower:0.3:0.3','af_drops:0.3:0.3','af_dummy_battery:0.3:0.3','af_dummy_dummy:0.3:0.3','af_dummy_glassbeads:0.3:0.3','af_dummy_pellicle:0.3:0.3','af_dummy_spring:0.3:0.3','af_electra_flash:0.3:0.3','af_electra_moonlight:0.3:0.3','af_electra_sparkler:0.3:0.3','af_eye:0.3:0.3','af_fire:0.3:0.3','af_fireball:0.3:0.3','af_fuzz_kolobok:0.3:0.3','af_glass:0.3:0.3','af_gold_fish:0.3:0.3','af_gravi:0.3:0.3','af_ice:0.3:0.3','af_medusa:0.3:0.3','af_mincer_meat:0.3:0.3','af_night_star:0.3:0.3','af_oasis_heart:0.3:0.3','af_quest_b14_twisted:0.3:0.3','af_rusty_kristall:0.3:0.3','af_rusty_sea:0.3:0.3','af_rusty_thorn:0.3:0.3','af_soul:0.3:0.3','af_vyvert:0.3:0.3','jup_b1_half_artifact:0.3:0.3',
        'af_black_spray:0.3:0.3','af_bracelet:0.3:0.3','af_empty:0.3:0.3','af_full_empty:0.3:0.3','af_itcher:0.3:0.3','af_lobster_eyes:0.3:0.3','af_pin:0.3:0.3','af_ring:0.3:0.3','af_sponge:0.3:0.3','greh_patch:3:3'],
        sell:[],
        supply:['supplies_1:0:meat_tushkano:6:1','supplies_1:0:meat_dog:6:1','supplies_1:0:meat_pseudodog:4:1','supplies_1:0:meat_flesh:4:1','supplies_1:0:meat_boar:4:1','supplies_1:0:meat_bloodsucker:2:1','supplies_1:0:meat_snork:4:1','supplies_1:0:meat_chimera:1:1','supplies_1:0:meat_lurker:1:1','supplies_1:0:meat_psysucker:1:1',
        'supplies_1:0:meat_tushkano_b:3:0.7','supplies_1:0:meat_dog_b:3:0.7','supplies_1:0:meat_pseudodog_b:2:0.7','supplies_1:0:meat_flesh_b:2:0.7','supplies_1:0:meat_boar_b:3:0.7','supplies_1:0:meat_bloodsucker_b:1:0.7','supplies_1:0:meat_snork_b:2:0.7','supplies_1:0:meat_chimera_b:1:0.7','supplies_1:0:meat_lurker_b:1:0.7','supplies_1:0:meat_psysucker_b:1:0.7',
        'supplies_1:0:meat_tushkano_a:1:0.3','supplies_1:0:meat_dog_a:1:0.3','supplies_1:0:meat_pseudodog_a:1:0.3','supplies_1:0:meat_flesh_a:1:0.3','supplies_1:0:meat_boar_a:1:0.3','supplies_1:0:meat_bloodsucker_a:1:0.3','supplies_1:0:meat_snork_a:1:0.3','supplies_1:0:meat_chimera_a:1:0.3','supplies_1:0:meat_lurker_a:1:0.3','supplies_1:0:meat_psysucker_a:1:0.3',
        'supplies_1:0:bread:4:1','supplies_1:0:breadold:6:1','supplies_1:0:kolbasa:4:1','supplies_1:0:tushonka:4:1','supplies_1:0:conserva:4:1','supplies_1:0:tomato:2:1','supplies_1:0:sausage:2:1','supplies_1:0:corn:2:1','supplies_1:0:beans:2:1','supplies_1:0:chili:2:1','supplies_1:0:salmon:2:1','supplies_1:0:raisins:2:1','supplies_1:0:chocolate:2:1','supplies_1:0:nuts:2:1','supplies_1:0:mre:1:1','supplies_1:0:ration_ru:1:1','supplies_1:0:ration_ukr:1:1',
        'supplies_1:0:mint:4:1','supplies_1:0:mineral_water:2:1','supplies_1:0:caffeine:2:1','supplies_1:0:hand_rolling_tobacco:2:1','supplies_1:0:cigar:1:1','supplies_1:0:cigarettes_lucky:3:1','supplies_1:0:cigarettes_russian:3:1','supplies_1:0:beer:3:1','supplies_1:0:vodka:3:1','supplies_1:0:vodka2:3:1','supplies_1:0:energy_drink:3:1','supplies_1:0:water_drink:2:1','supplies_1:0:cigarettes:4:1','supplies_1:0:tea:2:1','supplies_1:0:akvatab:3:1','supplies_1:0:flask:2:1','supplies_1:0:bottle_metal:2:1','supplies_1:0:vodka_quality:2:1','supplies_1:0:tobacco:2:1','supplies_1:0:marijuana:1:1','supplies_1:0:cigar1:2:1','supplies_1:0:cigar2:2:1','supplies_1:0:cigar3:2:1','supplies_1:0:cooking:4:1','supplies_1:0:fieldcooker:1:1',
        'supplies_1:0:kerosene:1:1','supplies_1:0:charcoal:2:1','supplies_1:0:explo_balon_gas:1:1','supplies_1:0:explo_jerrycan_fuel:1:1','supplies_1:0:box_matches:4:1']},
    medic:{label:'Medic',parent:'medic',condition:0.50,buyExp:2.25,sellExp:0.75,
        buy:['itm_drugkit:2.0:2.0'],sell:['itm_drugkit:2.0:2.0'],
        supply:['supplies_1:0:glucose_s:2:1','supplies_1:0:glucose:2:1','supplies_1:0:drug_sleepingpills:2:1','supplies_1:0:bandage:3:1','supplies_1:0:medkit:2:1','supplies_1:0:medkit_ai1:1:1','supplies_1:0:antirad_cystamine:2:1','supplies_1:0:antibio_chlor:2:1','supplies_1:0:jgut:2:1','supplies_1:0:yadylin:2:1','supplies_1:0:analgetic:2:1','supplies_1:0:antirad_kalium:2:1','supplies_1:0:antibio_sulfad:2:1','supplies_1:0:antiemetic:2:1','supplies_1:0:medkit_army:1:1','supplies_1:0:antirad:2:1','supplies_1:0:stimpack:2:1','supplies_1:0:caffeine:2:1','supplies_1:0:protein:2:1','supplies_1:0:akvatab:2:1','supplies_1:0:cocaine:2:1','supplies_1:0:tetanus:2:1','supplies_1:0:adrenalin:2:1','supplies_1:0:salicidic_acid:2:1','supplies_1:0:morphine:2:1','supplies_1:0:drug_anabiotic:2:1','supplies_1:0:drug_booster:2:1','supplies_1:0:drug_coagulant:2:1','supplies_1:0:drug_antidot:2:1','supplies_1:0:drug_radioprotector:2:1','supplies_1:0:drug_psy_blockade:2:1']},
    mechanic:{label:'Mechanic',parent:'mechanic, toolkits_h',condition:0.01,buyExp:1.75,sellExp:0.75,
        buy:[],sell:[],
        supply:['supplies_1:0:swiss_knife:1:1','supplies_1:0:ball_hammer:2:1','supplies_1:0:duct_tape:2:1','supplies_1:0:grease:2:1','supplies_1:0:sharpening_stones:1:1','supplies_1:0:gun_oil:1:1','supplies_1:0:gun_oil_ru_d:1:1','supplies_1:0:gun_oil_ru:1:1','supplies_1:0:solvent:1:1','supplies_1:0:cleaning_kit_p:1:1','supplies_1:0:cleaning_kit_s:1:1','supplies_1:0:cleaning_kit_r5:1:1','supplies_1:0:cleaning_kit_r7:1:1','supplies_1:0:cleaning_kit_u:1:1','supplies_1:0:toolkit_p:1:1','supplies_1:0:sewing_kit_b:1:1','supplies_1:0:sewing_kit_a:1:1','supplies_1:0:sewing_kit_h:1:1','supplies_1:0:glue_b:1:1','supplies_1:0:glue_a:1:1','supplies_1:0:glue_e:1:1','supplies_1:0:armor_repair_fa:1:1','supplies_1:0:helmet_repair_kit:1:1','supplies_1:0:light_repair_kit:1:1','supplies_1:0:leatherman_tool:1:1','supplies_1:0:rasp_tool:1:1','supplies_1:0:ramrod_tool:1:1','supplies_1:0:sewing_thread:3:1','supplies_1:0:heavy_sewing_thread:1:1']},
    scientist:{label:'Scientist',parent:'scientist,artefacts_h',condition:0.60,buyExp:2.25,sellExp:0.75,
        buy:[],sell:[],
        supply:['supplies_1:0:detector_radio:1:1','supplies_1:0:detector_geiger:1:1','supplies_1:0:device_pda_1:1:1','supplies_1:0:device_torch_dummy:1:1','supplies_1:0:device_torch_nv_1:1:1','supplies_1:0:batteries_dead:6:1','supplies_1:0:bolts_pack:2:1','supplies_1:0:medkit:3:1','supplies_1:0:medkit_ai1:2:1','supplies_1:0:medkit_ai2:2:1','supplies_1:0:medkit_ai3:2:1','supplies_1:0:antirad_kalium:2:1','supplies_1:0:antirad_cystamine:2:1','supplies_1:0:antibio_sulfad:2:1','supplies_1:0:antiemetic:2:1','supplies_1:0:antibio_chlor:2:1','supplies_1:0:jgut:2:1','supplies_1:0:yadylin:2:1','supplies_1:0:analgetic:2:1','supplies_1:0:medkit_scientic:2:1','supplies_1:0:bandage:5:1','supplies_1:0:antirad:2:1','supplies_1:0:stimpack_army:3:1','supplies_1:0:stimpack_scientic:2:1','supplies_1:0:survival_kit:2:1','supplies_1:0:salicidic_acid:2:1','supplies_1:0:morphine:2:1','supplies_1:0:tetanus:3:1','supplies_1:0:adrenalin:3:1','supplies_1:0:drug_booster:3:1','supplies_1:0:drug_coagulant:3:1','supplies_1:0:drug_antidot:3:1','supplies_1:0:drug_radioprotector:3:1','supplies_1:0:drug_psy_blockade:3:1','supplies_1:0:drug_sleepingpills:3:1',
        'supplies_1:0:af_camelbak:1:1','supplies_1:0:af_cooler:1:1','supplies_1:0:af_surge:1:1','supplies_1:0:af_freon:1:1','supplies_1:0:af_frames:1:1','supplies_1:0:af_grid:1:1','supplies_1:0:af_kevlar:2:1','supplies_1:0:af_plates:2:1','supplies_1:0:af_aac:2:1','supplies_1:0:af_aam:2:1','supplies_1:0:lead_box:3:1','supplies_1:0:ecolog_guard_outfit:1:1','supplies_1:0:ecolog_outfit_orange:1:1','supplies_1:0:helm_respirator:1:1','supplies_1:0:helm_m40:1:1','supplies_1:0:detector_simple:1:1','supplies_1:0:detector_advanced:1:1']}
};
function _rebuildTradeParentOptions(){
    var sel=document.getElementById('f_tradeParent');
    if(!sel)return;
    var cur=sel.value;
    var showVanilla=document.getElementById('f_showVanillaPresets');
    var html='<option value="">None</option>';
    // Loaded archetypes (excluding self)
    var archIds=[];
    var curArchId=null;
    if(editMode==='char'&&curGrp!==null){
        curArchId=groups[curGrp].chars[curChar]&&groups[curGrp].chars[curChar].archId;
    }else if(editMode==='solo'&&curSolo!==null){
        curArchId=soloChars[curSolo]&&soloChars[curSolo].archId;
    }
    groups.forEach(function(g){
        g.chars.forEach(function(ch){
            if(ch.archId&&ch.archId!==curArchId&&archIds.indexOf(ch.archId)===-1)archIds.push(ch.archId);
        });
    });
    if(Array.isArray(soloChars))soloChars.forEach(function(ch){
        if(ch.archId&&ch.archId!==curArchId&&archIds.indexOf(ch.archId)===-1)archIds.push(ch.archId);
    });
    if(archIds.length){
        html+='<optgroup label="Loaded Archetypes">';
        archIds.forEach(function(id){html+='<option value="'+esc(id)+'">'+esc(id)+'</option>';});
        html+='</optgroup>';
    }
    // Vanilla presets — only when "+vanilla" checkbox is on
    if(showVanilla&&showVanilla.checked){
        html+='<optgroup label="Vanilla Presets">';
        Object.keys(TRADE_PRESETS).forEach(function(k){
            html+='<option value="'+k+'">'+TRADE_PRESETS[k].label+'</option>';
        });
        html+='</optgroup>';
    }
    sel.innerHTML=html;
    // Restore selection
    if(cur)sel.value=cur;
}
function applyTradePreset(key){
    var preset=TRADE_PRESETS[key];
    if(!preset)return;
    saveTradeField('tradeParent',key);
    // Set condition and exponents from preset
    var condEl=document.getElementById('f_tradeCond');
    if(condEl){condEl.value=preset.condition;saveTradeField('tradeCond',String(preset.condition));}
    var buyExpEl=document.getElementById('f_tradeBuyExp');
    if(buyExpEl){buyExpEl.value=preset.buyExp;saveTradeField('tradeBuyExp',String(preset.buyExp));}
    var sellExpEl=document.getElementById('f_tradeSellExp');
    if(sellExpEl){sellExpEl.value=preset.sellExp;saveTradeField('tradeSellExp',String(preset.sellExp));}
    // Populate buy list
    var buyTa=document.getElementById('f_tradeBuyList');
    if(buyTa){buyTa.value=preset.buy.join('\n');saveTradeField('buyListRaw',buyTa.value);}
    // Populate sell list
    var sellTa=document.getElementById('f_tradeSellList');
    if(sellTa){sellTa.value=preset.sell.join('\n');saveTradeField('sellListRaw',sellTa.value);}
    // Populate supply list
    var supplyTa=document.getElementById('f_tradeSupplyList');
    if(supplyTa){supplyTa.value=preset.supply.join('\n');saveTradeField('supplyListRaw',supplyTa.value);}
    // Refresh item browsers if open
    ['ib_trade_buy','ib_trade_sell','ib_trade_supply'].forEach(function(hid){
        if(_tradeIbOpen&&_tradeIbOpen[hid]){var h=document.getElementById(hid);if(h){h._ibCfg=null;_initTradeIb(hid,h);}}
    });
    runTradeLoadoutLint();
}
function setFM(cat,mode,btn){
    const modeMap={Comm:'commMode',Loc:'locMode',Rank:'rankMode'};
    const valsMap={Comm:'commVals',Loc:'locVals',Rank:'rankVals'};
    const boxMap={Comm:'filterComm',Loc:'filterLoc',Rank:'filterRank'};
    const saveMode=mode==='all'?'inc':mode;
    saveField(modeMap[cat],saveMode);
    if(mode==='all'){saveField(valsMap[cat],[]);}
    btn.parentElement.querySelectorAll('button').forEach(b=>b.className='');
    if(mode==='all')btn.className='aa';
    else if(mode==='inc')btn.className='ai';
    else if(mode==='exc')btn.className='ae';
    const box=document.getElementById(boxMap[cat]);
    if(mode==='all')box.querySelectorAll('input').forEach(cb=>cb.checked=false);
    box.querySelectorAll('.mi').forEach(el=>el.classList.toggle('exc',saveMode==='exc'));
}
