(function(){
function q(s,r){return(r||document).querySelector(s)}
function qa(s,r){return Array.from((r||document).querySelectorAll(s))}
function tag(el,layer,group,scene,subtab){if(!el)return;el.dataset.layer=layer;el.dataset.layerGroup=group;el.dataset.layerScene=scene;if(subtab)el.dataset.layerSubtab=subtab}
function keepComposite(el){if(el)el.dataset.layerKeepComposite='1'}
function clean(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function ensureTextSpans(){
  qa('.tb[data-tab]').forEach(btn=>{if(btn.querySelector(':scope > .tex-tab-text'))return;const t=(btn.textContent||'').trim();btn.textContent='';const s=document.createElement('span');s.className='tex-tab-text';s.textContent=t;btn.appendChild(s);});
  qa('.dlg-stab[data-stab]').forEach(btn=>{if(btn.querySelector(':scope > .tex-stab-text'))return;const t=(btn.textContent||'').trim();btn.textContent='';const s=document.createElement('span');s.className='tex-stab-text';s.textContent=t;btn.appendChild(s);});
  const ss=q('#statusStrip');
  if(ss&&!q('#statusStripText',ss)){const t=(ss.textContent||'').trim();ss.textContent='';const s=document.createElement('span');s.id='statusStripText';s.textContent=t;ss.appendChild(s);}
}
function tagChrome(scene){
  ensureTextSpans();
  tag(document.body,'chrome/body-bg','chrome',scene);
  tag(q('.container'),'chrome/container-bg','chrome',scene);
  tag(q('.header'),'chrome/header-bar','chrome',scene);
  tag(q('.header h1'),'chrome/header-title','chrome',scene);
  tag(q('.header p'),'chrome/header-version','chrome',scene);
  tag(q('#modeBar'),'chrome/modebar','chrome',scene);
  tag(q('#modeBar .mode-label'),'chrome/modebar-label','chrome',scene);
  tag(q('#modeBar .mode-val'),'chrome/modebar-val','chrome',scene);
  tag(q('#modeBar .mode-btn'),'chrome/modebar-back-btn','chrome',scene);
  tag(q('#statusStrip'),'chrome/status-strip','chrome',scene);
  keepComposite(q('#statusStrip'));
  tag(q('#statusStripText'),'chrome/status-text','chrome',scene);
  tag(q('.tabs'),'chrome/tabbar','chrome',scene);
  const m={arch:'archetypes',settings:'settings',trade:'trade',dialogs:'advanced',export:'export'};
  qa('.tb[data-tab]').forEach(btn=>{const k=m[btn.dataset.tab]||btn.dataset.tab;tag(btn,'chrome/tab-'+k,'chrome',scene);});
  tag(q('#texLayerShowBtn'),'chrome/show-layers-btn','chrome',scene);
  tag(q('#texZoomOutBtn'),'chrome/zoom-minus','chrome',scene);
  tag(q('#texZoomLabel'),'chrome/zoom-pct','chrome',scene);
  tag(q('#texZoomInBtn'),'chrome/zoom-plus','chrome',scene);
  tag(q('#texZoomResetBtn'),'chrome/zoom-reset','chrome',scene);
}
function autoTagTab(tabId,scene,prefix){
  const tab=q('#'+tabId);if(!tab)return;
  const sectionAlias={settings:{}};
  qa('.sec',tab).forEach((sec,si)=>{
    const st=q('.st',sec);const title=clean((st&&st.textContent||('section-'+(si+1))).replace(/\?/g,''))||('section-'+(si+1));
    const alias=(sectionAlias[prefix]&&sectionAlias[prefix][title])||title;
    const g=prefix+'/'+alias;
    tag(sec,g+'/window',g,scene);
    if(st)tag(st,g+'/title',g,scene);
    qa('label,input,select,textarea,button,.info,.item-pick,.picker-items,.picker-track,.picker-thumb,.sim-tools,.sim-wrap,.sim-log,.sim-opts,[id]',sec).forEach((el,ei)=>{
      if(el.dataset.layerScene)return;
      const n=clean(el.id||String(el.className||'').split(/\s+/)[0]||el.tagName)||('el-'+(ei+1));
      tag(el,g+'/'+n,g,scene);
    });
  });
}
function tagSpawnFiltersDynamic(){
  const commMap={stalker:'loners',dolg:'duty',killer:'killer'};
  const COMM_L=(typeof COMM!=='undefined'&&Array.isArray(COMM))?COMM:[];
  const LOCS_L=(typeof LOCS!=='undefined'&&Array.isArray(LOCS))?LOCS:[];
  const RANKS_L=(typeof RANKS_D!=='undefined'&&Array.isArray(RANKS_D))?RANKS_D:[];
  const pairSets=[
    {box:'#filterComm',group:'settings/spawn-filters',prefix:'community',items:COMM_L.map(([v])=>v)},
    {box:'#filterLoc',group:'settings/spawn-filters',prefix:'location',items:LOCS_L.map(([v])=>v)},
    {box:'#filterRank',group:'settings/spawn-filters',prefix:'rank',items:RANKS_L.map(([v])=>v)}
  ];
  tag(q('#modeComm'),'settings/spawn-filters/community-mode','settings/spawn-filters','tex-screen-settings');
  tag(q('#modeLoc'),'settings/spawn-filters/location-mode','settings/spawn-filters','tex-screen-settings');
  tag(q('#modeRank'),'settings/spawn-filters/rank-mode','settings/spawn-filters','tex-screen-settings');
  [['#modeComm','community'],['#modeLoc','location'],['#modeRank','rank']].forEach(([sel,p])=>{
    const mode=q(sel); if(!mode)return;
    const btns=qa('button',mode);
    if(btns[0])tag(btns[0],`settings/spawn-filters/${p}-off-btn`,'settings/spawn-filters','tex-screen-settings');
    if(btns[1])tag(btns[1],`settings/spawn-filters/${p}-inc-btn`,'settings/spawn-filters','tex-screen-settings');
    if(btns[2])tag(btns[2],`settings/spawn-filters/${p}-exc-btn`,'settings/spawn-filters','tex-screen-settings');
  });
  pairSets.forEach(set=>{
    const box=q(set.box); if(!box)return;
    qa(':scope > .mi',box).forEach((row,i)=>{
      const input=q('input',row), label=q('label',row);
      const raw=(input&&input.value)||set.items[i]||('item_'+(i+1));
      const key=clean(set.prefix==='community'?(commMap[raw]||raw):raw)||('item-'+(i+1));
      const g='settings/spawn-filters';
      if(input)tag(input,`${g}/${set.prefix}-${key}-chk`,g,'tex-screen-settings');
      if(label)tag(label,`${g}/${set.prefix}-${key}-text`,g,'tex-screen-settings');
    });
  });
  const wrapChkText=(input,id)=>{
    if(!input)return;
    const lbl=input.closest('label'); if(!lbl)return;
    let span=lbl.querySelector(':scope > .tex-chk-text');
    if(!span){
      span=document.createElement('span');
      span.className='tex-chk-text';
      const txt=Array.from(lbl.childNodes).find(n=>n.nodeType===3&&String(n.textContent||'').trim());
      span.textContent=txt?String(txt.textContent||'').trim():'';
      if(txt) lbl.removeChild(txt);
      lbl.appendChild(span);
    }
    tag(span,id,'settings/spawn-filters','tex-screen-settings');
  };
  const male=q('#f_male'), female=q('#f_female');
  if(male){ tag(male,'settings/spawn-filters/male-chk','settings/spawn-filters','tex-screen-settings'); wrapChkText(male,'settings/spawn-filters/male-text'); }
  if(female){ tag(female,'settings/spawn-filters/female-chk','settings/spawn-filters','tex-screen-settings'); wrapChkText(female,'settings/spawn-filters/female-text'); }
}
function tagAdvancedSubtabs(){
  const bar=q('#tab-dialogs .dlg-subtab-bar')||q('#tab-dialogs .dlg-stab-wrap')||q('#tab-dialogs .dlg-stabbar')||q('#tab-dialogs .dlg-stab-row');
  if(bar)tag(bar,'dialogs/subtab-bar/bar','dialogs/subtab-bar','tex-screen-dialogue');
  qa('.dlg-stab[data-stab]').forEach(btn=>{
    const mk={graph:'node-graph',preview:'preview',tasks:'tasks',specializations:'specs'}[btn.dataset.stab]||btn.dataset.stab;
    tag(btn,'dialogs/subtab-bar/'+mk+'-btn','dialogs/subtab-bar','tex-screen-dialogue');
  });
  [['graph','graph'],['preview','preview'],['tasks','tasks'],['specializations','specializations']].forEach(([id,sub])=>{
    const panel=q('#dlgStab_'+id); if(!panel)return;
    qa('*',panel).forEach(el=>{ if(el.dataset.layerScene) el.dataset.layerSubtab=sub; });
  });
}
function tagTaskDynamic(){
  const box=q('#taskList'); if(!box)return;
  tag(box,'dialogs/tasks/task-list','dialogs/tasks','tex-screen-dialogue','tasks');
  qa('.task-card',box).forEach((card,i)=>{
    const g=`dialogs/tasks/task-${i+1}`;
    tag(card,`${g}/card`,g,'tex-screen-dialogue','tasks');
    qa('button,input,select,textarea,.task-card-header,.task-card-body,.task-label,.task-type-badge',card).forEach((el,j)=>{
      if(el.dataset.layerScene)return;
      const n=clean(String(el.className||'').split(/\s+/)[0]||el.tagName)||('el-'+(j+1));
      tag(el,`${g}/${n}`,g,'tex-screen-dialogue','tasks');
    });
  });
}
function tagSpecDynamic(){
  const box=q('#specList'); if(!box)return;
  tag(box,'dialogs/specializations/window','dialogs/specializations','tex-screen-dialogue','specializations');
  const defs=Array.isArray(window.SPECIALIZATION_DEFS)?window.SPECIALIZATION_DEFS:[];
  qa(':scope > label',box).forEach((card,i)=>{
    const id=(defs[i]&&defs[i].id)||('spec_'+(i+1));
    const g='dialogs/specializations/'+id;
    tag(card,`${g}/card`,g,'tex-screen-dialogue','specializations');
    const chk=q('input[type="checkbox"]',card); if(chk)tag(chk,`${g}/chk`,g,'tex-screen-dialogue','specializations');
    const txt=qa('div > div',card);
    if(txt[0])tag(txt[0],`${g}/name`,g,'tex-screen-dialogue','specializations');
    if(txt[1])tag(txt[1],`${g}/desc`,g,'tex-screen-dialogue','specializations');
    if(txt[2])tag(txt[2],`${g}/dialog-ids`,g,'tex-screen-dialogue','specializations');
  });
}
function currentSceneFallback(){
  const b=q('.tb.active[data-tab]');
  const m={settings:'tex-screen-settings',trade:'tex-screen-trade',dialogs:'tex-screen-dialogue'};
  return m[b&&b.dataset&&b.dataset.tab]||'tex-screen-settings';
}
function register(sceneHint){
  tagChrome(sceneHint||currentSceneFallback());
  tag(q('#noEditMsg'),'settings/no-edit-msg/box','settings/no-edit-msg','tex-screen-settings');
  tag(q('#noEditTrade'),'trade/no-edit-msg/box','trade/no-edit-msg','tex-screen-trade');
  tag(q('#noEditDlg'),'dialogs/no-edit-msg/box','dialogs/no-edit-msg','tex-screen-dialogue');
  autoTagTab('tab-settings','tex-screen-settings','settings');
  autoTagTab('tab-trade','tex-screen-trade','trade');
  autoTagTab('tab-dialogs','tex-screen-dialogue','dialogs');
  tagSpawnFiltersDynamic();
  tagAdvancedSubtabs();
  tagTaskDynamic();
  tagSpecDynamic();
  qa('[data-layer-scene]').forEach(el=>{delete el.dataset.layerComposite;});
  qa('[data-layer-scene]').forEach(el=>{
    const sc=el.dataset.layerScene;
    if(!sc) return;
    if(el.dataset.layerKeepComposite==='1') return;
    if(el.querySelector('[data-layer-scene="'+sc+'"]')) el.dataset.layerComposite='1';
  });
}
function refresh(scene){ const sc=scene||currentSceneFallback(); register(sc); if(typeof TexEditor!=='undefined'&&TexEditor.refreshLayers) TexEditor.refreshLayers(sc); }
window.refreshV15LayerBindings = refresh;
['renderTaskList','renderSpecializationList','switchDlgSubtab'].forEach(name=>{
  const fn=window[name]; if(typeof fn!=='function' || fn.__layerWrap)return;
  const w=function(){ const r=fn.apply(this,arguments); try{refresh('tex-screen-dialogue')}catch(_e){} return r; };
  w.__layerWrap=true; window[name]=w;
});
let tmr=0; const sched=()=>{clearTimeout(tmr);tmr=setTimeout(()=>refresh(),80);};
['tab-settings','tab-trade','tab-dialogs','taskList','specList','statusStrip'].forEach(id=>{const el=document.getElementById(id); if(el) new MutationObserver(sched).observe(el,{childList:true,subtree:true,characterData:true});});
qa('.tb[data-tab]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(()=>refresh(),0)));
setTimeout(()=>refresh(),0);
})();
