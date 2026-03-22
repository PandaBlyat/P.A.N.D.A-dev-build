// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.tb').forEach(b=>b.addEventListener('click',()=>{
        document.querySelectorAll('.tb').forEach(x=>x.classList.remove('active'));
        document.querySelectorAll('.tc').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');document.getElementById('tab-'+b.dataset.tab).classList.add('active');
        if(b.dataset.tab==='export')renderExportGroupSelect();
        else if(b.dataset.tab!=='arch')refreshTab(b.dataset.tab);
        if(typeof TexEditor!=='undefined')TexEditor.onMainTabChanged(b.dataset.tab);
    }));
    initItemBrowsers();
    // Populate spawn picker category dropdown eagerly (was lazy in refreshTab('settings'))
    const _spCat=document.getElementById('spawnPickCat');
    if(_spCat&&!_spCat.options.length)_spCat.innerHTML=_IB_CAT_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    updateSpawnItemSelect();
    buildMS('filterComm',COMM);buildMS('filterLoc',LOCS);buildMS('filterRank',RANKS_D,true);
    let texEditorLoadState='idle';
    function loadTexEditorScript(forceRetry){
        if(typeof TexEditor!=='undefined'){texEditorLoadState='loaded';return;}
        if(texEditorLoadState==='loading')return;
        if(texEditorLoadState==='failed'&&!forceRetry)return;
        texEditorLoadState='loading';
        var s=document.createElement('script');
        s.src='scripts/arch_generator_v15_texture_overlay.dev.js';
        s.dataset.archTexEditor='1';
        s.onload=function(){
            texEditorLoadState='loaded';
            if(typeof TexEditor!=='undefined'&&TexEditor.onMainTabChanged){
                var activeTab=document.querySelector('.tb.active[data-tab]');
                TexEditor.onMainTabChanged(activeTab?activeTab.dataset.tab:'arch');
            }
            if(window.refreshV15LayerBindings)window.refreshV15LayerBindings();
        };
        s.onerror=function(){
            texEditorLoadState='failed';
            if(s.parentNode)s.parentNode.removeChild(s);
            console.warn('[ARCH] Failed to load texture editor script.');
        };
        document.head.appendChild(s);
    }
    // Auto-load editor on startup so overlay drawings are available immediately.
    loadTexEditorScript();
    document.addEventListener('pointermove',onGraphDragMove);
    document.addEventListener('pointerup',stopGraphDrag);    document.addEventListener('fullscreenchange',updateGraphFullscreenButton);
    document.addEventListener('webkitfullscreenchange',updateGraphFullscreenButton);
    const dlgSearch=document.getElementById('f_dlgSearch');
    const dlgReplace=document.getElementById('f_dlgReplace');
    if(dlgSearch)dlgSearch.addEventListener('keydown',e=>{if(e.key==='Enter')runDialogSearch();});
    if(dlgReplace)dlgReplace.addEventListener('keydown',e=>{if(e.key==='Enter')runDialogReplaceAll();});
    document.addEventListener('click',e=>{if(!e.target.closest('.ti')&&!e.target.closest('.tp'))closeTip();});
    document.addEventListener('keydown',e=>{
        // Ctrl+K command palette
        if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&String(e.key||'').toLowerCase()==='k'){
            e.preventDefault();if(typeof openCmdPalette==='function')openCmdPalette();return;
        }
        // Escape: close overlays
        if(e.key==='Escape'){
            const pal=document.getElementById('cmdPalette');
            if(pal&&!pal.classList.contains('hidden')){e.preventDefault();if(typeof closeCmdPalette==='function')closeCmdPalette();return;}
        }
        // N: toggle sidebar
        if(e.key==='n'&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
            const tag=document.activeElement?document.activeElement.tagName:'';
            if(tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){e.preventDefault();if(typeof toggleSidebar==='function')toggleSidebar();return;}
        }
        if(e.key==='F1'){
            const tag=document.activeElement?document.activeElement.tagName:'';
            if(tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){
                e.preventDefault();
                loadTexEditorScript(true);
                return;
            }
        }
        if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&String(e.key||'').toLowerCase()==='s'){
            e.preventDefault();autoSave();setStatus('Saved.','ok');return;
        }
        if((e.ctrlKey||e.metaKey)&&String(e.key||'').toLowerCase()==='enter'){
            const exp=document.getElementById('tab-export');
            if(exp&&exp.classList.contains('active')){e.preventDefault();generateAll();}
        }
        // Delete key: remove selected graph node
        if((e.key==='Delete'||e.key==='Backspace')&&!e.ctrlKey&&!e.metaKey){
            const tag=document.activeElement?.tagName;
            const isEditing=tag==='INPUT'||tag==='TEXTAREA'||document.activeElement?.isContentEditable;
            if(!isEditing&&selectedBranchPath&&selectedBranchPath!=='__hub__'&&selectedBranchPath!=='__opener__'&&curDlgSubtab==='graph'&&!_mainTabActive){
                e.preventDefault();
                deleteSelectedBranch();
            }
        }
        // Ctrl+Z undo
        if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&String(e.key||'').toLowerCase()==='z'){
            const tag=document.activeElement?.tagName;
            const isEditing=tag==='INPUT'||tag==='TEXTAREA'||document.activeElement?.isContentEditable;
            if(!isEditing&&curDlgSubtab==='graph'){e.preventDefault();graphUndo();}
        }
    });
    // ── Spawn textarea ↔ spawnPickItem Tab-link ──
    const _spawnPickTaIds=new Set(['f_spawnPrimary','f_spawnSecondary','f_spawnExtra']);
    const _spawnPickSlotMap={'f_spawnPrimary':'primary','f_spawnSecondary':'secondary','f_spawnExtra':'extra'};
    let _spawnPickLastTa=null;
    document.addEventListener('focusin',e=>{
        if(e.target.tagName==='TEXTAREA'&&_spawnPickTaIds.has(e.target.id)){
            _spawnPickLastTa=e.target;
            const p=document.getElementById('spawnPickItem');
            if(p)p.classList.add('ib-linked');
        }
    });
    document.addEventListener('focusout',e=>{
        if(e.target.tagName==='TEXTAREA'&&_spawnPickTaIds.has(e.target.id)){
            const p=document.getElementById('spawnPickItem');
            if(p&&e.relatedTarget!==p)p.classList.remove('ib-linked');
        }
    });
    document.addEventListener('keydown',e=>{
        if(e.key==='Tab'&&!e.shiftKey&&e.target.tagName==='TEXTAREA'&&_spawnPickTaIds.has(e.target.id)){
            const p=document.getElementById('spawnPickItem');if(!p)return;
            e.preventDefault();
            _spawnPickLastTa=e.target;_ibReturnFocusEl=e.target;
            const slot=document.getElementById('spawnPickSlot');
            if(slot)slot.value=_spawnPickSlotMap[e.target.id];
            p.classList.add('ib-linked');p.focus();
        }
    });
    // Typing in spawn textarea filters spawnPickItem by current line's partial id
    document.addEventListener('input',e=>{
        if(e.target.tagName==='TEXTAREA'&&_spawnPickTaIds.has(e.target.id)){
            const ta=e.target,pos=ta.selectionStart;
            const lineStart=ta.value.lastIndexOf('\n',pos-1)+1;
            const partial=ta.value.slice(lineStart,pos).split(':')[0].trim();
            const srch=document.getElementById('spawnPickSearch');
            if(srch&&srch.value!==partial){srch.value=partial;updateSpawnItemSelect();}
        }
    });
    const _spPickEl=document.getElementById('spawnPickItem');
    if(_spPickEl){
        _spPickEl.addEventListener('focus',()=>{
            _spPickEl.classList.add('ib-linked');
            if(_spawnPickLastTa)_spawnPickLastTa.classList.add('ib-linked');
        });
        _spPickEl.addEventListener('keydown',e=>{
            if(e.key==='Tab'||e.key==='Escape'){
                e.preventDefault();
                _spPickEl.classList.remove('ib-linked');_ibReturnFocusEl=null;
                if(_spawnPickLastTa){_spawnPickLastTa.classList.remove('ib-linked');_spawnPickLastTa.focus();}
            } else if(e.key==='Enter'){
                e.preventDefault();
                addSpawnPickerItem(); // focus stays on list — Tab returns to textarea
            } else if(e.key==='Backspace'||(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey)){
                // Redirect typing to search box without losing list focus context
                e.preventDefault();
                const srch=document.getElementById('spawnPickSearch');
                if(!srch)return;
                if(e.key==='Backspace') srch.value=srch.value.slice(0,-1);
                else srch.value+=e.key;
                updateSpawnItemSelect();
                // Keep list focused so arrow keys still work
                _spPickEl.focus();
            }
        });
        _spPickEl.addEventListener('blur',e=>{
            if(!_spawnPickTaIds.has(e.relatedTarget?.id)){
                _spPickEl.classList.remove('ib-linked');
                if(_spawnPickLastTa)_spawnPickLastTa.classList.remove('ib-linked');
            }
        });
    }
    // ── Trade textarea ↔ item browser Tab-link ──
    const _tradeTaToHost={'f_tradeBuyList':'ib_trade_buy','f_tradeSellList':'ib_trade_sell','f_tradeSupplyList':'ib_trade_supply'};
    const _tradeHostToTa={'ib_trade_buy':'f_tradeBuyList','ib_trade_sell':'f_tradeSellList','ib_trade_supply':'f_tradeSupplyList'};
    let _tradeLastTa=null;
    document.addEventListener('focusin',e=>{
        if(e.target.tagName==='TEXTAREA'&&_tradeTaToHost[e.target.id]){
            _tradeLastTa=e.target;
            const h=document.getElementById(_tradeTaToHost[e.target.id]);
            if(h){const l=h.querySelector('.item-browser-list');if(l)l.classList.add('ib-linked');}
        }
        // Trade browser list focus → textarea highlight
        if(e.target.classList&&e.target.classList.contains('item-browser-list')){
            const h=e.target.closest('[id^="ib_trade_"]');
            if(h&&_tradeHostToTa[h.id]){
                const ta=document.getElementById(_tradeHostToTa[h.id]);
                if(ta){_tradeLastTa=ta;ta.classList.add('ib-linked');}
                e.target.classList.add('ib-linked');
            }
        }
    });
    document.addEventListener('focusout',e=>{
        if(e.target.tagName==='TEXTAREA'&&_tradeTaToHost[e.target.id]){
            const h=document.getElementById(_tradeTaToHost[e.target.id]);
            if(h){const l=h.querySelector('.item-browser-list');if(l&&e.relatedTarget!==l)l.classList.remove('ib-linked');}
        }
        // Trade browser list blur → textarea un-highlight
        if(e.target.classList&&e.target.classList.contains('item-browser-list')){
            const h=e.target.closest('[id^="ib_trade_"]');
            if(h&&_tradeHostToTa[h.id]){
                const ta=document.getElementById(_tradeHostToTa[h.id]);
                if(ta&&e.relatedTarget!==ta)ta.classList.remove('ib-linked');
            }
        }
    });
    document.addEventListener('keydown',e=>{
        if(e.key==='Tab'&&!e.shiftKey&&e.target.tagName==='TEXTAREA'&&_tradeTaToHost[e.target.id]){
            const h=document.getElementById(_tradeTaToHost[e.target.id]);if(!h)return;
            const l=h.querySelector('.item-browser-list');if(!l)return;
            e.preventDefault();
            _tradeLastTa=e.target;_ibReturnFocusEl=e.target;
            e.target.classList.add('ib-linked');
            l.classList.add('ib-linked');l.focus();
        }
    });
    if(document.getElementById('tab-export')?.classList.contains('active')){
        renderExportGroupSelect();
    }
    // Render auto-loaded project data (groups/soloChars restored in ux.js)
    if(groups.length||soloChars.length){
        renderGroupList();
        console.log('[ARCH] Auto-loaded',groups.length,'groups,',soloChars.length,'solo');
    }
    if(typeof renderConnGroups==='function')renderConnGroups();
    setStatus('Ready.','ok');
    runTradeLoadoutLint();
    _initNumSteppers();
});
function _wrapNumInput(inp){
    if(inp.readOnly||inp.disabled)return;
    if(inp.classList.contains('chip-count')||inp.classList.contains('tiny-input'))return;
    if(inp.closest('.num-stepper-wrap'))return;
    const step=inp.step&&inp.step!=='any'&&inp.step!==''?+inp.step:1;
    const min=inp.min!==''?parseFloat(inp.min):-Infinity;
    const max=inp.max!==''?parseFloat(inp.max):Infinity;
    const dec=step.toString().includes('.')?step.toString().split('.')[1].length:0;
    const round=v=>dec>0?parseFloat(v.toFixed(dec)):v;
    const wrap=document.createElement('span');
    wrap.className='num-stepper-wrap';
    const fire=()=>{inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));};
    const btnM=document.createElement('button');
    btnM.type='button';btnM.className='chip-step';btnM.textContent='−';
    btnM.addEventListener('mousedown',e=>e.stopPropagation());
    btnM.addEventListener('click',e=>{e.stopPropagation();const v=round(parseFloat(inp.value||0)-step);inp.value=isFinite(min)?Math.max(min,v):v;fire();});
    const btnP=document.createElement('button');
    btnP.type='button';btnP.className='chip-step';btnP.textContent='+';
    btnP.addEventListener('mousedown',e=>e.stopPropagation());
    btnP.addEventListener('click',e=>{e.stopPropagation();const v=round(parseFloat(inp.value||0)+step);inp.value=isFinite(max)?Math.min(max,v):v;fire();});
    inp.parentNode.insertBefore(wrap,inp);
    wrap.appendChild(btnM);wrap.appendChild(inp);wrap.appendChild(btnP);
}
function _initNumSteppers(){
    document.querySelectorAll('input[type=number]').forEach(_wrapNumInput);
    new MutationObserver(muts=>muts.forEach(m=>m.addedNodes.forEach(node=>{
        if(node.nodeType!==1)return;
        if(node.matches('input[type=number]'))_wrapNumInput(node);
        node.querySelectorAll('input[type=number]').forEach(_wrapNumInput);
    }))).observe(document.body,{childList:true,subtree:true});
}
// ═══════════════════════════════════════════
// DIALOG SUBTABS
// ═══════════════════════════════════════════
let curDlgSubtab='graph'; // 'graph' | 'tasks' | 'specializations' | 'news'
function switchDlgSubtab(name,btn){
    curDlgSubtab=name;
    document.querySelectorAll('.dlg-stab').forEach(b=>b.classList.remove('active'));
    if(btn)btn.classList.add('active');
    document.querySelectorAll('.dlg-stab-panel').forEach(p=>p.style.display='none');
    const panel=document.getElementById('dlgStab_'+name);
    if(panel)panel.style.display='';
    if(name==='graph')renderBranches();
    if(name==='tasks')renderTaskList();
    if(name==='specializations')renderSpecializationList();
    if(name==='news')renderNewsPreview();
}

