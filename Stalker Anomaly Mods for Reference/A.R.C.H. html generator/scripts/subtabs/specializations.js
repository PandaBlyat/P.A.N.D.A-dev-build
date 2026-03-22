const SPECIALIZATION_DIALOG_MAP={
    technician:['dm_init_mechanic','dm_tech_repair'],
    medic:['dm_medic_general'],
    cook:['arch_spec_chef_dialog'],
    informant:['arch_spec_informant_dialog'],
    intel:['arch_spec_informant_dialog']
};
const SPECIALIZATION_DEFS=[
    {id:'technician',label:'Technician',desc:'Offers weapon and armor repair services.',serviceLabel:'I need your help with equipment.',serviceAction:'[Opens Repair UI]',dialogIds:['dm_init_mechanic','dm_tech_repair']},
    {id:'medic',label:'Medic',desc:'Provides healing services to the player.',serviceLabel:'I need medical help.',serviceAction:'[Opens Healing UI]',dialogIds:['dm_medic_general']},
    {id:'cook',label:'Cook',desc:'Custom cooking dialog — prepares food from mutant parts.',serviceLabel:'What have you got cooking?',serviceAction:'[Opens Cooking Dialog]',dialogIds:['arch_spec_chef_dialog'],wip:true},
    {id:'informant',label:'Informant',desc:'Custom intel-gathering dialog — provides stalker and mutant intel.',serviceLabel:'What information can you offer?',serviceAction:'[Opens Intel Dialog]',dialogIds:['arch_spec_informant_dialog'],wip:true}
];
const AMMO_CALIBER_HINTS=[
    {keys:['5.45','545','ak74','abakan','aek'],ammo:['5.45x39']},
    {keys:['5.56','556','lr300','m4','sig550','g36'],ammo:['5.56x45']},
    {keys:['7.62x39','762x39','akm','sks'],ammo:['7.62x39']},
    {keys:['7.62x54','svd','svu','mosin'],ammo:['7.62x54']},
    {keys:['9x18','pm','pb','fort'],ammo:['9x18']},
    {keys:['9x19','glock','beretta','mp5','mp7'],ammo:['9x19']},
    {keys:['45acp','45_acp','usp45','colt1911'],ammo:['11.43x23','.45']},
    {keys:['12x70','toz','bm16','saiga','protecta','spas'],ammo:['12x70']}
];
// ═══════════════════════════════════════════
// SPECIALIZATIONS
// ═══════════════════════════════════════════
function getActiveSpecializations(){
    const s=getD('settings');
    return parseSpecializations(s?.specialization||'');
}
function getSpecServiceOptions(){
    const specs=getActiveSpecializations();
    const opts=[];
    const seen={};
    specs.forEach(specId=>{
        const def=SPECIALIZATION_DEFS.find(d=>d.id===specId);
        if(!def)return;
        const key=def.serviceLabel;
        if(seen[key])return;
        seen[key]=true;
        opts.push({specId,label:def.serviceLabel,action:def.serviceAction});
    });
    return opts;
}
function renderSpecializationList(){
    const box=document.getElementById('specList');
    if(!box)return;
    const s=getD('settings');
    const current=parseSpecializations(s?.specialization||'');
    box.innerHTML=SPECIALIZATION_DEFS.map(spec=>{
        if(spec.wip){
            return `<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:rgba(20,20,20,0.4);border:1px solid #222;border-radius:2px;margin-bottom:6px;cursor:not-allowed;opacity:0.45">
                <input type="checkbox" disabled style="margin-top:3px;flex-shrink:0">
                <div>
                    <div style="color:#888;font-size:13px;font-weight:bold">${esc(spec.label)} <span style="font-size:10px;font-weight:normal;color:#777">— in the works</span></div>
                    <div style="color:#777;font-size:11px;margin-top:2px">${esc(spec.desc)}</div>
                </div>
            </label>`;
        }
        const checked=current.includes(spec.id);
        return `<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:${checked?'rgba(255,140,0,0.08)':'rgba(30,30,30,0.6)'};border:1px solid ${checked?'#ff8c00':'#333'};border-radius:2px;margin-bottom:6px;cursor:pointer;transition:all .15s">
            <input type="checkbox" ${checked?'checked':''} onchange="toggleSpecialization('${spec.id}',this.checked)" style="accent-color:#ff8c00;margin-top:3px;flex-shrink:0">
            <div>
                <div style="color:${checked?'#ff8c00':'#d4d4d4'};font-size:13px;font-weight:bold">${esc(spec.label)}</div>
                <div style="color:#888;font-size:11px;margin-top:2px">${esc(spec.desc)}</div>
                <div style="color:#888;font-size:10px;margin-top:3px">Dialog IDs: ${spec.dialogIds.join(', ')}</div>
            </div>
        </label>`;
    }).join('');
    if(typeof TexEditor!=='undefined'&&TexEditor.refreshLayers)TexEditor.refreshLayers('tex-screen-dialogue');
}
function toggleSpecialization(specId,checked){
    const s=getD('settings');
    const current=parseSpecializations(s?.specialization||'');
    if(checked&&!current.includes(specId)){current.push(specId);}
    else if(!checked){const idx=current.indexOf(specId);if(idx>=0)current.splice(idx,1);}
    saveField('specialization',current.join(', '));
    renderSpecializationList();
}

// ═══════════════════════════════════════════
// DUPLICATE NODE / DIALOG
// ═══════════════════════════════════════════
function duplicateCurrentDialog(){
    const container=getDlg();
    if(!container||!container.dialogs||!container.dialogs.length)return;
    const src=container.dialogs[curDlgTreeIdx];
    if(!src)return;
    const copy=JSON.parse(JSON.stringify(src)); // deep copy
    copy.id='dlg_'+Date.now();
    copy.label=(src.label||'Dialog')+' (copy)';
    // Offset layout so nodes don't overlap
    if(copy.layout){Object.keys(copy.layout).forEach(k=>{copy.layout[k]={x:copy.layout[k].x+40,y:copy.layout[k].y+40};});}
    container.dialogs.push(copy);
    curDlgTreeIdx=container.dialogs.length-1;
    autoSave();renderDialogTreeTabs();renderBranches();
    setStatus(`Dialog duplicated as "${copy.label}".`,'ok');
}

