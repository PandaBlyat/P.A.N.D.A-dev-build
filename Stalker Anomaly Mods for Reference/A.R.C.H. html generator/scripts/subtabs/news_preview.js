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
