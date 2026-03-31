// ═══════════════════════════════════════════
// INFO FLAGS — named boolean flags for quest/story state
// ═══════════════════════════════════════════

// Get the flags array for the current character
function getFlags(){
    var d=getDlg();if(!d)return[];
    if(!Array.isArray(d.flags))d.flags=[];
    return d.flags;
}

// Generate a safe flag ID from display name
function _flagId(name,packSlug){
    var slug=(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    if(!slug)slug='flag_'+(Date.now()%10000);
    var prefix='arch_';
    if(packSlug)prefix+=(packSlug+'_');
    return prefix+slug;
}

// Get pack slug from current context
function _flagPackSlug(){
    if(typeof getCurArchId==='function'){
        var id=getCurArchId();
        if(id)return id.replace(/[^a-z0-9_]/gi,'_').toLowerCase();
    }
    return '';
}

// Add a new flag
function addFlag(name){
    var flags=getFlags();
    var displayName=(name||'').trim();
    if(!displayName){
        displayName='Flag '+(flags.length+1);
    }
    var id=_flagId(displayName,_flagPackSlug());
    // Ensure unique ID
    var existing={};flags.forEach(function(f){existing[f.id]=true;});
    if(existing[id]){var n=2;while(existing[id+'_'+n])n++;id=id+'_'+n;}
    flags.push({name:displayName,id:id});
    autoSave();
    renderFlags();
    return id;
}

// Remove a flag by index
function removeFlag(idx){
    var flags=getFlags();
    if(idx<0||idx>=flags.length)return;
    var removed=flags[idx];
    if(!confirm('Delete flag "'+removed.name+'" ('+removed.id+')?\n\nThis won\'t remove references from dialog nodes — those will show as orphaned.'))return;
    flags.splice(idx,1);
    autoSave();
    renderFlags();
}

// Rename a flag (updates ID too)
function renameFlag(idx,newName){
    var flags=getFlags();
    if(idx<0||idx>=flags.length)return;
    var f=flags[idx];
    f.name=(newName||'').trim()||f.name;
    // Don't change ID after creation — it's referenced in dialog nodes
    autoSave();
    renderFlags();
}

// Collect all info portion strings used across all dialog trees
function collectUsedInfoPortions(){
    var d=getDlg();if(!d)return{given:new Set(),checked:new Set()};
    var given=new Set();
    var checked=new Set();

    function scanTree(tree){
        if(!tree)return;
        // Hub level
        if(tree.hubHasInfo)checked.add(tree.hubHasInfo);
        if(tree.hubDontHasInfo)checked.add(tree.hubDontHasInfo);
        if(tree.hubGiveInfo)given.add(tree.hubGiveInfo);
        // Nodes
        var nodes=tree.nodes||{};
        Object.keys(nodes).forEach(function(nid){
            var n=nodes[nid];
            if(n.hasInfo)checked.add(n.hasInfo);
            if(n.dontHasInfo)checked.add(n.dontHasInfo);
            if(n.giveInfo)given.add(n.giveInfo);
            (n.choices||[]).forEach(function(ch){
                if(ch.hasInfo)checked.add(ch.hasInfo);
                if(ch.dontHasInfo)checked.add(ch.dontHasInfo);
                if(ch.giveInfo)given.add(ch.giveInfo);
            });
        });
        // Hub choices
        (tree.hubChoices||[]).forEach(function(ch){
            if(ch.hasInfo)checked.add(ch.hasInfo);
            if(ch.dontHasInfo)checked.add(ch.dontHasInfo);
            if(ch.giveInfo)given.add(ch.giveInfo);
        });
    }

    // Scan all dialog trees
    (d.dialogs||[]).forEach(scanTree);
    if(d.introDialog)scanTree(d.introDialog);
    // Pool trees
    var allPools=[...(Array.isArray(d.taskPools)?d.taskPools:[]),...(Array.isArray(d.customPools)?d.customPools:[])];
    allPools.forEach(function(pool){
        if(pool.dialogTrees)(pool.dialogTrees||[]).forEach(scanTree);
        if(pool.dialogTree)scanTree(pool.dialogTree);
    });
    // Vanilla service trees
    (d.vanillaServices||[]).forEach(scanTree);

    // LTX fields
    var s=d.settings||{};
    if(s.introDoneInfo)given.add(s.introDoneInfo);
    if(s.onDeathInfo)given.add(s.onDeathInfo);

    return{given:given,checked:checked};
}

// Build a flag picker dropdown HTML
function flagPickerHtml(field,currentVal,onchangeExpr){
    var flags=getFlags();
    var usage=collectUsedInfoPortions();
    var allUsed=new Set([...usage.given,...usage.checked]);

    var h='<select class="task-input flag-picker" onchange="'+onchangeExpr+'">';
    h+='<option value=""'+(!(currentVal)?' selected':'')+'>-- none --</option>';

    // Show defined flags first
    if(flags.length){
        h+='<optgroup label="Pack Flags">';
        flags.forEach(function(f){
            h+='<option value="'+esc(f.id)+'"'+(currentVal===f.id?' selected':'')+'>'+esc(f.name)+' ('+esc(f.id)+')</option>';
        });
        h+='</optgroup>';
    }

    // Show any orphaned/manual IDs that are used in dialogs but not in the flags list
    var flagIds=new Set(flags.map(function(f){return f.id;}));
    var orphaned=[];
    allUsed.forEach(function(id){
        if(!flagIds.has(id))orphaned.push(id);
    });
    if(orphaned.length){
        h+='<optgroup label="Unlisted (typed manually)">';
        orphaned.sort().forEach(function(id){
            h+='<option value="'+esc(id)+'"'+(currentVal===id?' selected':'')+'>'+esc(id)+'</option>';
        });
        h+='</optgroup>';
    }

    // If current value isn't in either list, show it
    if(currentVal&&!flagIds.has(currentVal)&&!allUsed.has(currentVal)){
        h+='<option value="'+esc(currentVal)+'" selected>'+esc(currentVal)+' (custom)</option>';
    }

    h+='</select>';

    // Add quick-create button
    h+='<button class="btn b2 bs" style="padding:2px 8px;font-size:10px;margin-left:4px" onclick="var n=prompt(\'New flag name:\');if(n){var id=addFlag(n);'+onchangeExpr.replace('this.value','id')+'}" title="Create new flag">+</button>';

    return h;
}

// Render the flags management panel
function renderFlags(){
    var el=document.getElementById('flagsPanel');
    if(!el)return;
    var flags=getFlags();
    var usage=collectUsedInfoPortions();
    var allUsed=new Set([...usage.given,...usage.checked]);

    var h='<div style="margin-bottom:8px;font-size:11px;color:#888">Flags are named checkpoints for your story. Create them here, then pick them in dialog nodes.</div>';

    if(!flags.length){
        h+='<div style="color:#666;font-size:11px;padding:8px 0">No flags yet. Create one to track quest progress.</div>';
    }

    flags.forEach(function(f,i){
        var isGiven=usage.given.has(f.id);
        var isChecked=usage.checked.has(f.id);
        var statusDots='';
        if(isGiven)statusDots+='<span style="color:#4caf50" title="Given by a dialog node">●</span> ';
        if(isChecked)statusDots+='<span style="color:#42a5f5" title="Checked by a dialog node">●</span> ';
        if(!isGiven&&!isChecked)statusDots+='<span style="color:#666" title="Not used in any dialog yet">○</span> ';

        h+='<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:#1e1e1e;border:1px solid #333;border-radius:3px;margin-bottom:3px">';
        h+=statusDots;
        h+='<input class="task-input" style="flex:1;font-size:11px" value="'+esc(f.name)+'" onchange="renameFlag('+i+',this.value)">';
        h+='<code style="color:#888;font-size:9px;white-space:nowrap">'+esc(f.id)+'</code>';
        h+='<button class="chip-del" onclick="removeFlag('+i+')" title="Delete flag" style="font-size:12px">&times;</button>';
        h+='</div>';
    });

    // Orphaned info portions (used in dialogs but not in flags list)
    var flagIds=new Set(flags.map(function(f){return f.id;}));
    var orphaned=[];
    allUsed.forEach(function(id){if(!flagIds.has(id))orphaned.push(id);});
    if(orphaned.length){
        h+='<div style="margin-top:10px;font-size:10px;color:#ff8c00">Unlisted info portions found in dialogs:</div>';
        orphaned.sort().forEach(function(id){
            h+='<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;background:#2a2000;border:1px solid #553300;border-radius:3px;margin-bottom:2px">';
            h+='<code style="color:#ffb74d;font-size:10px;flex:1">'+esc(id)+'</code>';
            h+='<button class="btn b2 bs" style="padding:1px 8px;font-size:9px" onclick="var flags=getFlags();flags.push({name:\''+esc(id.replace(/^arch_\w+_/,'').replace(/_/g,' '))+'\',id:\''+esc(id)+'\'});autoSave();renderFlags()">Add to list</button>';
            h+='</div>';
        });
    }

    h+='<div style="margin-top:8px"><button class="btn b2" onclick="addFlag(prompt(\'Flag name (e.g. Quest Started, Met Doctor):\'))" style="font-size:11px;padding:4px 12px">+ New Flag</button></div>';

    // Legend
    h+='<div style="margin-top:10px;font-size:10px;color:#666"><span style="color:#4caf50">●</span> given &nbsp; <span style="color:#42a5f5">●</span> checked &nbsp; <span style="color:#666">○</span> unused</div>';

    el.innerHTML=h;
}
