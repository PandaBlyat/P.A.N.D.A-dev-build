function getSimActorName(){return 'Stalker';}
function getSimNpcName(){
    if(editMode==='solo'&&curSolo!==null){
        const ch=soloChars[curSolo];
        return (ch.displayName&&String(ch.displayName).trim())||ch.archId||'NPC';
    }
    if(curGrp===null)return 'NPC';
    if(editMode==='char'){
        const ch=groups[curGrp].chars[curChar];
        return (ch.displayName&&String(ch.displayName).trim())||ch.archId||'NPC';
    }
    return groups[curGrp].name||'NPC';
}
function simLine(speaker,text){
    return {speaker,text:String(text||'').trim()||'...'};
}
function simSnapshot(){
    if(!dialogSimState)return null;
    const snap=dc(dialogSimState);
    snap.history=[];
    return snap;
}
function simPushHistory(){
    if(!dialogSimState)return;
    if(!Array.isArray(dialogSimState.history))dialogSimState.history=[];
    const snap=simSnapshot();
    if(!snap)return;
    dialogSimState.history.push(snap);
    if(dialogSimState.history.length>80)dialogSimState.history.shift();
}
function syncDialogSimulator(d){
    const specs=getActiveSpecializations();
    const h=JSON.stringify({tree:d||{},specs});
    if(h!==dialogSimHash){dialogSimHash=h;resetDialogSimulator();}
    else renderDialogSimulator();
}
function resetDialogSimulator(){
    const d=getCurTree();
    const specs=getActiveSpecializations();
    dialogSimHash=JSON.stringify({tree:d||{},specs});
    const log=[];
    if(d&&d.opener)log.push(simLine('actor',d.opener));
    if(d&&d.hub)log.push(simLine('npc',d.hub));
    if(!log.length)log.push(simLine('npc','...'));
    dialogSimState={
        mode:'hub',
        nodeId:null,
        history:[],
        log:log
    };
    renderDialogSimulator();
}
function simBackToHub(){
    if(!dialogSimState)return;
    simPushHistory();
    const d=getCurTree();
    dialogSimState.mode='hub';dialogSimState.nodeId=null;
    dialogSimState.log.push(simLine('npc',d.hub||'What do you want to know?'));
    renderDialogSimulator();
}
function simUndo(){
    if(!dialogSimState||!Array.isArray(dialogSimState.history)||!dialogSimState.history.length)return;
    dialogSimState=dialogSimState.history.pop();
    renderDialogSimulator();
}
function simGoToHub(){
    if(!dialogSimState)return;
    simPushHistory();
    const d=getCurTree();
    dialogSimState.log.push(simLine('actor','Anyone posting jobs around here?'));
    if(d.opener)dialogSimState.log.push(simLine('npc',d.opener));
    if(d.hub)dialogSimState.log.push(simLine('npc',d.hub));
    dialogSimState.mode='hub';dialogSimState.nodeId=null;
    renderDialogSimulator();
}
function simReturnToMainMenu(){
    if(!dialogSimState)return;
    simPushHistory();
    const container=getDlg();
    const helloLine=simPickVanillaNpcLine('hello',(container&&container.vanilla)||null);
    dialogSimState.log.push(simLine('npc',helloLine||'Anything else?'));
    dialogSimState.mode='main_menu';dialogSimState.nodeId=null;
    renderDialogSimulator();
}
function simPickService(idx){
    if(!dialogSimState)return;
    const serviceOpts=getSpecServiceOptions();
    const svc=serviceOpts[idx];
    if(!svc)return;
    simPushHistory();
    dialogSimState.log.push(simLine('actor',svc.label));
    dialogSimState.log.push({speaker:'system',text:svc.action});
    dialogSimState.mode='service_action';dialogSimState.nodeId=null;
    renderDialogSimulator();
}
function simSelectVanillaTopicFromMain(key){
    if(!dialogSimState)return;
    const container=getDlg();
    const defs=Array.isArray(dialogSimState.lastVanillaOpts)?dialogSimState.lastVanillaOpts:simGetVanillaOptionDefs(null);
    let actorLine='...';for(const o of defs){if(o.key===key){actorLine=o.label;break;}}
    const npcLine=simPickVanillaNpcLine(key,(container&&container.vanilla)||null);
    if(!String(npcLine||'').trim()){
        simPushHistory();
        dialogSimState.log.push(simLine('actor',actorLine));
        dialogSimState.log.push(simLine('npc','...'));
        dialogSimState.mode='vanilla_response';dialogSimState.nodeId=null;
        renderDialogSimulator();return;
    }
    simPushHistory();
    dialogSimState.log.push(simLine('actor',actorLine));
    dialogSimState.log.push(simLine('npc',npcLine));
    dialogSimState.mode='vanilla_response';dialogSimState.nodeId=null;
    renderDialogSimulator();
}
function simPickChoice(fromId,ci){
    if(!dialogSimState)return;
    const d=getCurTree();
    const arr=(fromId==='__hub__')?(d.hubChoices||[]):(d.nodes[fromId]?.choices||[]);
    const ch=arr[ci];
    if(!ch)return;
    simPushHistory();
    dialogSimState.log.push(simLine('actor',ch.text||'...'));
    if(ch.action){
        const actionNames=String(ch.action).split(';').map(a=>{const t=a.trim();const def=DIALOG_ACTIONS.find(d=>d.id===t);return def?def.label:t;}).join(' + ');
        dialogSimState.log.push({speaker:'system',text:'[Action: '+actionNames+']'});
    }
    if(ch.next==='__end__'){
        dialogSimState.mode='exit';dialogSimState.exitFromNodeId=fromId;dialogSimState.nodeId=null;
    }else if(ch.next==='__hub__'||!ch.next){
        dialogSimState.mode='hub';dialogSimState.nodeId=null;
        dialogSimState.log.push(simLine('npc',d.hub||'What do you want to know?'));
    }else{
        const n=d.nodes[ch.next];
        if(!n){dialogSimState.mode='hub';dialogSimState.nodeId=null;return;}
        dialogSimState.log.push(simLine('npc',n.npc||'...'));
        dialogSimState.mode='node';dialogSimState.nodeId=ch.next;
    }
    renderDialogSimulator();
}
function simGetVanillaOptionDefs(d){
    const ao=VANILLA_DIALOG_PREVIEW.actor_options||{};
    const pick=(arr,fb)=>Array.isArray(arr)&&arr.length?arr[Math.floor(Math.random()*arr.length)]:fb;
    return [{key:'job',label:pick(ao.job,'Anyone posting jobs around here?')},{key:'anomalies',label:pick(ao.anomalies,'You know anything about anomalies or artefacts?')},{key:'information',label:pick(ao.information,'You know what\'s going on around here?')},{key:'tips',label:pick(ao.tips,'What kind of advice can you give about the Zone?')}];
}
function simPickVanillaNpcLine(key,vanilla){
    const v=ensureVanillaDlg(vanilla||null);
    const pools=(VANILLA_DIALOG_PREVIEW&&VANILLA_DIALOG_PREVIEW.npc_responses)||{};
    const pick=(arr)=>Array.isArray(arr)&&arr.length?arr[Math.floor(Math.random()*arr.length)]:'';
    if(key==='hello'){const c=[v.hello1,v.hello2,v.hello3].filter(x=>String(x||'').trim());return c.length?c[Math.floor(Math.random()*c.length)]:pick(pools.hello);}
    if(key==='wounded'){return String(v.wounded||'').trim()||pick(pools.wounded);}
    return String(v[key]||'').trim()||pick(pools[key]);
}
function simNeverMind(){
    if(!dialogSimState)return;
    simPushHistory();
    dialogSimState.log.push(simLine('actor','Never mind.'));
    dialogSimState.exitFromNodeId=dialogSimState.nodeId||'__hub__';
    dialogSimState.mode='exit';dialogSimState.nodeId=null;
    renderDialogSimulator();
}
function renderDialogSimulator(){
    const logEl=document.getElementById('dialogSimLog');
    const optsEl=document.getElementById('dialogSimOpts');
    if(!logEl||!optsEl)return;
    if(!dialogSimState){optsEl.innerHTML='';logEl.innerHTML='';return;}
    logEl.innerHTML=dialogSimState.log.map(line=>{
        if(line.speaker==='system')return `<div class="sim-ln system"><span class="txt">${esc(line.text)}</span></div>`;
        const sp=line.speaker==='actor'?getSimActorName():getSimNpcName();
        return `<div class="sim-ln ${line.speaker==='actor'?'actor':'npc'}"><span class="spk">${esc(sp)}</span><span class="txt">${esc(line.text)}</span></div>`;
    }).join('');
    logEl.scrollTop=logEl.scrollHeight;
    if(dialogSimState.mode==='exit'){optsEl.innerHTML=`<button class="sim-opt" onclick="resetDialogSimulator()">1. Start Again</button>`;return;}
    const d=getCurTree();
    const container=getDlg();
    let html='';let lineNo=1;
    if(dialogSimState.mode==='main_menu'){
        const serviceOpts=getSpecServiceOptions();
        serviceOpts.forEach((svc,i)=>{
            html+=`<button class="sim-opt" onclick="simPickService(${i})">${lineNo++}. ${esc(svc.label)}</button>`;
        });
        const hubChoices=d.hubChoices||[];
        if(hubChoices.length){
            html+=`<button class="sim-opt" onclick="simGoToHub()">${lineNo++}. Anyone posting jobs around here?</button>`;
        }
        html+=`<button class="sim-opt" onclick="simNeverMind()">${lineNo++}. Never mind.</button>`;
    } else if(dialogSimState.mode==='hub'){
        const choices=d.hubChoices||[];
        choices.forEach((ch,ci)=>{
            html+=`<button class="sim-opt" onclick="simPickChoice('__hub__',${ci})">${lineNo++}. ${esc(ch.text||'...')}</button>`;
        });
        html+=`<button class="sim-opt" onclick="simReturnToMainMenu()">${lineNo++}. I have another question.</button>`;
        html+=`<button class="sim-opt" onclick="simNeverMind()">${lineNo++}. Never mind.</button>`;
    } else if(dialogSimState.mode==='node'){
        const fromId=dialogSimState.nodeId;
        const choices=(d.nodes[fromId]?.choices||[]);
        choices.forEach((ch,ci)=>{
            html+=`<button class="sim-opt" onclick="simPickChoice('${esc(fromId)}',${ci})">${lineNo++}. ${esc(ch.text||'...')}</button>`;
        });
        html+=`<button class="sim-opt" onclick="simBackToHub()">${lineNo++}. I have another question.</button>`;
        html+=`<button class="sim-opt" onclick="simNeverMind()">${lineNo++}. Never mind.</button>`;
    } else if(dialogSimState.mode==='vanilla_response'||dialogSimState.mode==='service_action'){
        html+=`<button class="sim-opt" onclick="simReturnToMainMenu()">${lineNo++}. I have another question.</button>`;
        html+=`<button class="sim-opt" onclick="simNeverMind()">${lineNo++}. Never mind.</button>`;
    }
    optsEl.innerHTML=html;
}

// ═══════════════════════════════════════════
// DYNAMIC NEWS — editor + in-game style preview
// ═══════════════════════════════════════════
var _newsPreviewTimes=[];
function refreshNewsFields(){
    const s=getD('settings');
    if(!s)return;
    const d=document.getElementById('f_newsOnDeath');
    const a=document.getElementById('f_newsOnArea');
    if(d)d.value=s.newsOnDeath||'';
    if(a)a.value=s.newsOnArea||'';
    const niSel=document.getElementById('f_newsIcon');
    if(niSel){
        niSel.innerHTML='<option value="">Auto (first community)</option>'+COMM.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('');
        niSel.value=s.newsIcon||'';
    }
}
function renderNewsPreview(){
    refreshNewsFields();
    const el=document.getElementById('newsPreviewArea');
    if(!el)return;
    if(curGrp===null&&editMode!=='solo'){el.innerHTML='<div class="info">Select a character to preview news.</div>';return;}
    const s=getD('settings');
    if(!s){el.innerHTML='<div class="info">No character data.</div>';return;}
    const ch=(editMode==='char')?groups[curGrp].chars[curChar]
            :(editMode==='solo'&&curSolo!==null)?soloChars[curSolo]
            :groups[curGrp].chars[0];
    const npcName=(ch&&ch.displayName&&String(ch.displayName).trim())||
                  (ch&&ch.archId)||'NPC';
    const location=_newsPreviewLocation(s);
    const faction=_newsPreviewFaction(s);
    const archId=(ch&&ch.archId)||'archetype';
    const rank='Experienced';
    const sub=t=>String(t||'').replace(/%name%/g,npcName).replace(/%location%/g,location)
        .replace(/%faction%/g,faction).replace(/%archetype%/g,archId).replace(/%rank%/g,rank);
    const deathLines=String(s.newsOnDeath||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const areaLines=String(s.newsOnArea||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const total=deathLines.length+areaLines.length;
    // Grow/shrink cached times array to match line count
    while(_newsPreviewTimes.length<total)_newsPreviewTimes.push(_newsPreviewTime());
    if(_newsPreviewTimes.length>total)_newsPreviewTimes.length=total;
    let html='';
    if(!total){
        html+='<div style="color:#555;font-size:12px;font-style:italic;padding:20px 0">No news templates defined. Use the fields above to add templates.</div>';
        el.innerHTML=html;return;
    }
    var idx=0;
    if(deathLines.length){
        html+='<div style="color:#5a6a4a;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin:8px 0 6px">On Death</div>';
        deathLines.forEach(function(line){
            html+=_newsPreviewCard(_newsPreviewTimes[idx++],npcName,sub(line));
        });
    }
    if(areaLines.length){
        html+='<div style="color:#5a6a4a;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin:8px 0 6px">On Area Enter</div>';
        areaLines.forEach(function(line){
            html+=_newsPreviewCard(_newsPreviewTimes[idx++],npcName,sub(line));
        });
    }
    el.innerHTML=html;
}
function _newsPreviewCard(time,name,text){
    return '<div class="np-notif">'
        +'<div class="np-notif-icon"></div>'
        +'<div class="np-notif-content">'
        +'<span class="np-notif-time">'+esc(time)+'</span> '
        +'<span class="np-notif-name">'+esc(name)+'</span>'
        +'<div class="np-notif-text">'+esc(text)+'</div>'
        +'</div>'
        +'</div>';
}
function _newsPreviewTime(){
    var h=Math.floor(Math.random()*24),m=Math.floor(Math.random()*60);
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function _newsPreviewFaction(s){
    if(s.commMode==='inc'&&Array.isArray(s.commVals)&&s.commVals.length)return s.commVals[0];
    return 'stalker';
}
function _newsPreviewLocation(s){
    if(s.locMode==='inc'&&Array.isArray(s.locVals)&&s.locVals.length){
        var pick=s.locVals[Math.floor(Math.random()*s.locVals.length)];
        var entry=LOCS.find(function(l){return l[0]===pick;});
        return entry?entry[1]:pick;
    }
    return 'Cordon';
}
