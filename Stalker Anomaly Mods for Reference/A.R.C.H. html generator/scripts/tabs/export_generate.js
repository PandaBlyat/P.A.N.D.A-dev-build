// ═══════════════════════════════════════════
// EXPORT — GENERATE ALL CHARACTERS
// ═══════════════════════════════════════════
function xmlStr(sid,txt){return`<string id="${sid}">\n\t<text>${esc(sanitizeGameText(txt))}</text>\n</string>\n`;}

function _isVanillaTreeEdited(catId,tree,assignTo){
    // Check against role-specific defaults for story NPCs, generic defaults otherwise
    var def=VANILLA_DIALOG_DEFAULTS[catId];
    if(assignTo&&typeof STORY_NPC_LOOKUP!=='undefined'&&typeof STORY_NPC_ROLE_DIALOGS!=='undefined'){
        var npc=STORY_NPC_LOOKUP[assignTo];
        if(npc&&npc.block&&STORY_NPC_ROLE_DIALOGS[npc.block]&&STORY_NPC_ROLE_DIALOGS[npc.block][catId])
            def=STORY_NPC_ROLE_DIALOGS[npc.block][catId];
    }
    if(!def)return true; // unknown category = treat as edited
    // Compare serialized trees (ignoring layout)
    const norm=t=>JSON.stringify({opener:t.opener||'',hub:t.hub||'',hubChoices:(t.hubChoices||[]).map(c=>({text:c.text||'',next:c.next||'',action:c.action||'',precondition:c.precondition||''})),nodes:Object.fromEntries(Object.entries(t.nodes||{}).map(([k,v])=>[k,{npc:v.npc||'',choices:(v.choices||[]).map(c=>({text:c.text||'',next:c.next||'',action:c.action||'',precondition:c.precondition||''}))}]))});
    return norm(tree)!==norm(def);
}

function collectStripWarnings(s,dlgData){
    const warnings=[];
    const stripped=Array.isArray(s.stripCategories)?s.stripCategories:[];
    if(!stripped.length)return warnings;
    // Check if any custom dialog has a trade action wired up
    const allTrees=(dlgData.dialogs||[]).concat(Object.values((dlgData.vanillaDialogs)||{})).concat(dlgData.companionDialogs||[]);
    const hasAction=actionId=>allTrees.some(t=>{
        const check=choices=>(choices||[]).some(c=>c.action===actionId);
        if(check(t.hubChoices))return true;
        return Object.values(t.nodes||{}).some(n=>check(n.choices));
    });
    if(stripped.includes('trade')&&!hasAction('dialogs.npc_is_trader'))
        warnings.push('Trade stripped but no replacement trade action found. NPC will have no trade option.');
    if(stripped.includes('tasks'))
        warnings.push('Tasks stripped. Vanilla task dialogs will be hidden. ARCH custom tasks still work if configured.');
    return warnings;
}

function getEffective(gi,ci){
    // Merge group defaults + char overrides for a specific character
    const g=groups[gi],ch=g.chars[ci],r={};
    ['settings','trade','dlg'].forEach(tab=>{
        r[tab]=ch.ov[tab]?dc(ch.ov[tab]):dc(g.defaults[tab]);
    });
    r.archId=ch.archId;r.displayName=ch.displayName;
    return r;
}

function buildDialogPayload(id,d,preconditionArchId,extraDialogMeta){
    // Flat node model → Anomaly phrase_list XML (V5-compatible tree serialization)
    // We intentionally unroll the graph into per-path phrase pairs instead of
    // reusing shared node phrases / a shared "ret" phrase. The V5 QA packs that
    // are stable in-game use this style, and compact DAG serializations have
    // produced runtime phrase registry failures in live testing.
    // Use original dialog ID if imported, otherwise generate
    const mainDialogId=d._sourceDialogId||`arch_${id}_dialog`;
    const opener=String(d.opener||'').trim()||'I want to ask you something.';
    const hub=String(d.hub||'').trim()||'What do you want to know?';
    const nodes=d.nodes||{};
    let hubChoices=d.hubChoices||[];
    const EXIT_ID=99;
    let nextPid=2; // 0=opener, 1=hub, 99=exit

    // Use original string IDs if available from import
    const _os=d._origSids||{};
    const _isIntroDialog=!!d.introGreeting;

    var _hubPhIdx=_isIntroDialog?2:1;
    var phrases;
    if(_isIntroDialog){
        // ── INTRO: 3-tier (NPC greeting → actor response → NPC hub with choices) ──
        const _greetSid=_os.introGreeting||`st_dlg_${id}_greeting`;
        const _actorSid=_os.opener||`st_dlg_${id}_opener`;
        const _hubSid=_os.hub||`dm_dlg_${id}_hub`;
        const greetingText=String(d.introGreeting||'').trim()||'...';

        // Phrase 0: NPC greeting (depth 0)
        const _greetPh={id:0, sid:_greetSid, nx:[1], txt:greetingText};
        if(d.openerAction)_greetPh.action=d.openerAction;
        if(d.openerPrecondition)_greetPh.precondition=d.openerPrecondition;

        // Phrase 1: Actor response (depth 1) — give_info here for intro done tracking
        const _actorPh={id:1, sid:_actorSid, nx:[2], txt:opener};
        if(d._introActorGiveInfo)_actorPh.giveInfo=d._introActorGiveInfo;

        // Phrase 2: NPC hub/offer (depth 2, with give_info + choices branch from here)
        nextPid=3; // hub choices start at 3
        const _hubPh={id:2, sid:_hubSid, nx:[], txt:hub};
        if(d.hubAction)_hubPh.action=d.hubAction;
        if(d.hubPrecondition)_hubPh.precondition=d.hubPrecondition;
        if(d.hubScriptText)_hubPh.scriptText=d.hubScriptText;
        if(d.hubHasInfo)_hubPh.hasInfo=d.hubHasInfo;
        if(d.hubDontHasInfo)_hubPh.dontHasInfo=d.hubDontHasInfo;
        if(d.hubGiveInfo)_hubPh.giveInfo=d.hubGiveInfo;

        phrases=[_greetPh, _actorPh, _hubPh];
        // Hub choices attach to phrase 2 (the NPC hub)
        hubChoices.forEach(ch=>addChoicePath(ch,phrases[2].nx,new Set()));
        if(!phrases[2].nx.length)phrases[2].nx.push(EXIT_ID);
    } else {
        // ── REGULAR: 2-tier (actor opener → NPC hub with choices) ──
        const _openerSid=_os.opener||`st_dlg_${id}_opener`;
        const _hubSid=_os.hub||`dm_dlg_${id}_hub`;

        const _openerPh={id:0, sid:_openerSid, nx:[1], txt:opener};
        if(d.openerAction)_openerPh.action=d.openerAction;
        if(d.openerPrecondition)_openerPh.precondition=d.openerPrecondition;
        if(d.openerScriptText)_openerPh.scriptText=d.openerScriptText;

        const _hubPh={id:1, sid:_hubSid, nx:[], txt:hub};
        if(d.hubAction)_hubPh.action=d.hubAction;
        if(d.hubPrecondition)_hubPh.precondition=d.hubPrecondition;
        if(d.hubScriptText)_hubPh.scriptText=d.hubScriptText;
        if(d.hubHasInfo)_hubPh.hasInfo=d.hubHasInfo;
        if(d.hubDontHasInfo)_hubPh.dontHasInfo=d.hubDontHasInfo;
        if(d.hubGiveInfo)_hubPh.giveInfo=d.hubGiveInfo;

        phrases=[_openerPh, _hubPh];

        // ── Direct-action detection ──
        // If ALL hub choices go to __end__ and the first has an action, this is a
        // vanilla-style service dialog (trade, repair, heal). The hub phrase should
        // carry the action directly — no extra choice phrases needed.
        // Vanilla pattern: actor opener → NPC response (action fires, dialog ends)
        const _allEnd=hubChoices.length>0&&hubChoices.every(function(c){return!c.next||c.next==='__end__';});
        const _firstAction=hubChoices.length>0&&hubChoices[0].action;
        if(_allEnd&&_firstAction&&!Object.keys(nodes).length){
            // Direct-action dialog: hub carries the action, dialog ends after NPC speaks
            _hubPh.action=hubChoices[0].action;
            if(hubChoices[0].precondition)_hubPh.precondition=hubChoices[0].precondition;
            if(hubChoices[0].giveInfo)_hubPh.giveInfo=hubChoices[0].giveInfo;
            // If there are multiple choices with different preconditions (accept/refuse pattern),
            // export as branched NPC responses from the opener
            if(hubChoices.length>1){
                hubChoices.slice(1).forEach(function(ch){
                    if(!ch.action&&!ch.precondition)return; // skip plain "never mind"
                    const brId=nextPid++;
                    const brPh={id:brId, sid:`dm_dlg_${id}_${brId}`, nx:[], txt:String(ch.text||hub)};
                    if(ch.action)brPh.action=ch.action;
                    if(ch.precondition)brPh.precondition=ch.precondition;
                    phrases.push(brPh);
                    _openerPh.nx.push(brId);
                });
            }
            // Skip normal hub choice processing below
            hubChoices=[];
        }

        // Hub variations — additional gated NPC responses branching from opener
        if(Array.isArray(d.hubVariations)&&d.hubVariations.length){
            d.hubVariations.forEach(function(v){
                const vo=typeof v==='object'&&v?v:{text:String(v||'')};
                const vId=nextPid++;
                const vSid=`dm_dlg_${id}_${vId}`;
                const vPh={id:vId, sid:vSid, nx:[], txt:String(vo.text||hub)};
                if(vo.hasInfo)vPh.hasInfo=vo.hasInfo;
                if(vo.dontHasInfo)vPh.dontHasInfo=vo.dontHasInfo;
                if(vo.giveInfo)vPh.giveInfo=vo.giveInfo;
                if(vo.action)vPh.action=vo.action;
                if(vo.precondition)vPh.precondition=vo.precondition;
                phrases.push(vPh);
                _openerPh.nx.push(vId);
            });
        }
    }
    function addRetPhrase(){
        const rId=nextPid++;
        phrases.push({id:rId, sid:`st_dlg_${id}_ret`, nx:[_hubPhIdx], txt:'I have another question.'});
        return rId;
    }

    function addChoicePath(choice,parentNx,trail){
        const target=choice&&choice.next;
        const playerText=String((choice&&choice.text)||'').trim()||'...';
        const choiceAction=(choice&&choice.action)||'';

        if(target==='__end__'||!target){
            const hasMeta=choiceAction||choice.hasInfo||choice.dontHasInfo||choice.giveInfo||choice.disableInfo||choice.precondition;
            if(hasMeta){
                const aId=nextPid++;
                const ph={id:aId, sid:`st_dlg_${id}_${aId}`, nx:[], txt:playerText};
                if(choiceAction)ph.action=choiceAction;
                if(choice.hasInfo)ph.hasInfo=choice.hasInfo;
                if(choice.dontHasInfo)ph.dontHasInfo=choice.dontHasInfo;
                if(choice.giveInfo)ph.giveInfo=choice.giveInfo;
                if(choice.disableInfo)ph.disableInfo=choice.disableInfo;
                if(choice.precondition)ph.precondition=choice.precondition;
                phrases.push(ph);
                parentNx.push(aId);
            } else {
                parentNx.push(EXIT_ID);
            }
            return;
        }
        if(target==='__hub__'){
            const hasMeta=choiceAction||choice.precondition||choice.hasInfo||choice.dontHasInfo||choice.giveInfo||choice.disableInfo;
            const hasCustomText=playerText!=='...'&&playerText!=='I have another question.';
            if(hasMeta||hasCustomText){
                // Choice has bindings or custom text — create a dedicated phrase
                const aId=nextPid++;
                const ph={id:aId, sid:`st_dlg_${id}_${aId}`, nx:[_hubPhIdx], txt:playerText};
                if(choiceAction)ph.action=choiceAction;
                if(choice.precondition)ph.precondition=choice.precondition;
                if(choice.hasInfo)ph.hasInfo=choice.hasInfo;
                if(choice.dontHasInfo)ph.dontHasInfo=choice.dontHasInfo;
                if(choice.giveInfo)ph.giveInfo=choice.giveInfo;
                if(choice.disableInfo)ph.disableInfo=choice.disableInfo;
                phrases.push(ph);
                parentNx.push(aId);
            } else {
                parentNx.push(addRetPhrase());
            }
            return;
        }

        const node=nodes[target];
        if(!node){
            parentNx.push(EXIT_ID);
            return;
        }

        const pId=nextPid++;
        const nId=nextPid++;
        const npcText=String(node.npc||'').trim()||'...';
        // Use original string ID if available from import
        const _nos=(d._nodeOrigSids||{})[target];
        const npcSid=(_nos&&_nos.npc)?_nos.npc:`dm_dlg_${id}_${nId}`;
        const npcPhrase={id:nId, sid:npcSid, nx:[], txt:npcText};

        const playerPhrase={id:pId, sid:`st_dlg_${id}_${pId}`, nx:[nId], txt:playerText, action:choiceAction||undefined};
        // Info portions on the player choice
        if(choice.hasInfo)playerPhrase.hasInfo=choice.hasInfo;
        if(choice.dontHasInfo)playerPhrase.dontHasInfo=choice.dontHasInfo;
        if(choice.giveInfo)playerPhrase.giveInfo=choice.giveInfo;
        if(choice.disableInfo)playerPhrase.disableInfo=choice.disableInfo;
        if(choice.precondition)playerPhrase.precondition=choice.precondition;
        // Info portions + bindings on the NPC node
        if(node.hasInfo)npcPhrase.hasInfo=node.hasInfo;
        if(node.dontHasInfo)npcPhrase.dontHasInfo=node.dontHasInfo;
        if(node.giveInfo)npcPhrase.giveInfo=node.giveInfo;
        if(node.scriptText)npcPhrase.scriptText=node.scriptText;
        if(node.precondition)npcPhrase.precondition=node.precondition;
        if(node.action)npcPhrase.action=node.action;
        phrases.push(playerPhrase);
        phrases.push(npcPhrase);
        parentNx.push(pId);

        // NPC variations — emit as additional gated NPC phrases branching from same player phrase
        if(Array.isArray(node.npcVariations)&&node.npcVariations.length){
            node.npcVariations.forEach(function(v,vi){
                const vo=typeof v==='object'&&v?v:{text:String(v||'')};
                const vId=nextPid++;
                const vSid=`dm_dlg_${id}_${vId}`;
                const vPh={id:vId, sid:vSid, nx:[], txt:String(vo.text||npcText)};
                if(vo.hasInfo)vPh.hasInfo=vo.hasInfo;
                if(vo.dontHasInfo)vPh.dontHasInfo=vo.dontHasInfo;
                if(vo.giveInfo)vPh.giveInfo=vo.giveInfo;
                if(vo.action)vPh.action=vo.action;
                if(vo.precondition)vPh.precondition=vo.precondition;
                phrases.push(vPh);
                playerPhrase.nx.push(vId);
            });
        }

        // Avoid infinite recursion on cyclic custom graphs. We still emit the
        // selected NPC response, then return to the hub.
        if(trail.has(target)){
            npcPhrase.nx.push(addRetPhrase());
            return;
        }

        const nextTrail=new Set(trail);
        nextTrail.add(target);

        const nodeChoices=Array.isArray(node.choices)?node.choices:[];
        if(!nodeChoices.length){
            npcPhrase.nx.push(addRetPhrase());
            return;
        }

        let childNodeCount=0;
        nodeChoices.forEach(ch=>{
            const nx=ch&&ch.next;
            if(nx==='__end__'||!nx){
                // Check for metadata (actions, giveInfo, etc.) — emit as dedicated phrase if present
                const _ca=(ch&&ch.action)||'';
                const _hasMeta=_ca||ch.hasInfo||ch.dontHasInfo||ch.giveInfo||ch.disableInfo||ch.precondition;
                if(_hasMeta){
                    addChoicePath(ch,npcPhrase.nx,nextTrail);
                } else {
                    if(!npcPhrase.nx.includes(EXIT_ID))npcPhrase.nx.push(EXIT_ID);
                }
                return;
            }
            if(nx==='__hub__'){
                const _ca2=(ch&&ch.action)||'';
                const _hasMeta2=_ca2||ch.hasInfo||ch.dontHasInfo||ch.giveInfo||ch.disableInfo||ch.precondition;
                const _chText2=String((ch&&ch.text)||'').trim();
                const _hasCustom2=_chText2&&_chText2!=='I have another question.';
                if(_hasMeta2||_hasCustom2){
                    addChoicePath(ch,npcPhrase.nx,nextTrail);
                } else {
                    npcPhrase.nx.push(addRetPhrase());
                }
                return;
            }
            if(!nodes[nx]){
                if(!npcPhrase.nx.includes(EXIT_ID))npcPhrase.nx.push(EXIT_ID);
                return;
            }
            childNodeCount++;
            addChoicePath(ch,npcPhrase.nx,nextTrail);
        });

        // V5-like behavior: when a node branches to multiple child nodes, keep
        // an explicit exit option from that NPC phrase. Linear continuations do not.
        if(childNodeCount>1 && !npcPhrase.nx.includes(EXIT_ID)){
            npcPhrase.nx.push(EXIT_ID);
        }

        if(!npcPhrase.nx.length){
            npcPhrase.nx.push(addRetPhrase());
        }
    }

    if(!_isIntroDialog){
        // Regular: hub choices from phrases[1]
        hubChoices.forEach(ch=>addChoicePath(ch,phrases[1].nx,new Set()));
        const _hubHasAction=!!(d.hubAction||phrases[1].action);
        if(hubChoices.length>0){
            // Hub has branch choices — always include exit so player can leave without picking
            if(!phrases[1].nx.includes(EXIT_ID))phrases[1].nx.push(EXIT_ID);
        } else if(!phrases[1].nx.length&&!_hubHasAction){
            // No choices and no action — push exit as fallback
            phrases[1].nx.push(EXIT_ID);
        }
    }
    // Intro: hub choices already attached to phrases[2] above

    phrases.push({id:EXIT_ID, sid:'dm_universal_actor_exit', nx:[]});

    // XML assembly
    const phraseSorted=phrases.slice().sort((a,b)=>a.id-b.id);
    const archPrecondId=sanitizeLuaId(preconditionArchId||id,id);
    const _edm=extraDialogMeta||{};
    let dialogXml=`    <dialog id="${mainDialogId}">\n        <precondition>dialogs.arch_is_${archPrecondId}</precondition>\n`;
    // Additional dialog-level preconditions (preserved from import)
    if(Array.isArray(_edm.preconditions))_edm.preconditions.forEach(p=>{dialogXml+=`        <precondition>${p}</precondition>\n`;});
    if(_edm.dontHasInfo){
        const _dhis=Array.isArray(_edm.dontHasInfo)?_edm.dontHasInfo:[_edm.dontHasInfo];
        _dhis.forEach(v=>{dialogXml+=`        <dont_has_info>${v}</dont_has_info>\n`;});
    }
    if(_edm.hasInfo){
        const _his=Array.isArray(_edm.hasInfo)?_edm.hasInfo:[_edm.hasInfo];
        _his.forEach(v=>{dialogXml+=`        <has_info>${v}</has_info>\n`;});
    }
    dialogXml+=`        <phrase_list>\n`;
    phraseSorted.forEach(ph=>{
        dialogXml+=`            <phrase id="${ph.id}">\n`;
        if(ph.hasInfo)String(ph.hasInfo).split(';').forEach(v=>{if(v.trim())dialogXml+=`                <has_info>${v.trim()}</has_info>\n`;});
        if(ph.dontHasInfo)String(ph.dontHasInfo).split(';').forEach(v=>{if(v.trim())dialogXml+=`                <dont_has_info>${v.trim()}</dont_has_info>\n`;});
        if(ph.precondition)dialogXml+=`                <precondition>${ph.precondition}</precondition>\n`;
        if(ph.scriptText)dialogXml+=`                <script_text>${ph.scriptText}</script_text>\n`;
        else dialogXml+=`                <text>${ph.sid}</text>\n`;
        if(ph.action){
            const actions=Array.isArray(ph.action)?ph.action:String(ph.action).split(';').map(s=>s.trim()).filter(Boolean);
            actions.forEach(a=>{dialogXml+=`                <action>${a}</action>\n`;});
        }
        if(ph.giveInfo)String(ph.giveInfo).split(';').forEach(v=>{if(v.trim())dialogXml+=`                <give_info>${v.trim()}</give_info>\n`;});
        if(ph.disableInfo)String(ph.disableInfo).split(';').forEach(v=>{if(v.trim())dialogXml+=`                <disable_info>${v.trim()}</disable_info>\n`;});
        ph.nx.forEach(n=>{dialogXml+=`                <next>${n}</next>\n`;});
        dialogXml+='            </phrase>\n';
    });
    dialogXml+='        </phrase_list>\n    </dialog>\n';

    let textXml='';
    const _emittedSids=new Set();
    phraseSorted.forEach(ph=>{
        if(ph.sid==='dm_universal_actor_exit')return;
        if(_emittedSids.has(ph.sid))return;
        _emittedSids.add(ph.sid);
        textXml+=xmlStr(ph.sid,ph.txt||'...');
    });

    return {mainDialogId,dialogXml,textXml};
}

function buildVanillaTopicPayload(id,d){
    const v=ensureVanillaDlg((d&&d.vanilla)||null);
    const out=[];
    const push=(sid,txt)=>{
        const val=String(txt||'').trim();
        if(val)out.push(xmlStr(sid,val));
    };
    // Hello and wounded are now exported via DM LTX + openerNpc / wounded tree
    // Only job/anomalies/info/tips remain here
    push(`dm_job_arch_${id}_1`,v.job);
    push(`dm_anomalies_arch_${id}_1`,v.anomalies);
    push(`dm_information_arch_${id}_1`,v.information);
    push(`dm_tips_arch_${id}_1`,v.tips);
    return out.join('');
}
// charList: optional array of {gi, ci} or {solo:true, si}. If null = all groups+solo.
function buildExportArtifacts(charList){
    const files=[];
    const blocks=[];
    const archetypeLtxIds=[];
    let archetypeLtxSections='';
    let dialogsXml='';
    let stringsXml='';
    let stringsVanillaXml='';
    let dmLtxEntries='';
    const _packEmittedSids=new Set(); // pack-level string dedup
    const _dedupStrings=function(xml){
        return xml.replace(/<string id="([^"]+)">[^]*?<\/string>\n?/g,function(m,sid){
            if(_packEmittedSids.has(sid))return '';
            _packEmittedSids.add(sid);
            return m;
        });
    };
    const tradeFiles=[];
    const taskPoolSections=[];
    const storyNpcDialogIds=[];
    const usedIds=new Set();

    // Build flat list of chars to include
    const targets=charList||[
        ...groups.flatMap((g,gi)=>g.chars.map((_,ci)=>({gi,ci}))),
        ...soloChars.map((_,si)=>({solo:true,si}))
    ];

    // Detect groups with non-default settings → emit as global blocks
    const globalBlockMap={}; // gi → {blockId, settings}
    let globalBlockLtx='';
    const globalBlockIds=[];
    const seenGi=new Set();
    targets.forEach(t=>{if(!t.solo&&!seenGi.has(t.gi)){seenGi.add(t.gi);}});
    seenGi.forEach(gi=>{
        const g=groups[gi];if(!g||!g.chars)return;
        const ds=g.defaults?.settings;if(!ds)return;
        const def=DEFAULT_SETTINGS;
        // Check if group has any non-default setting worth emitting
        const diffs=[];
        if(String(ds.enabled)!==String(def.enabled))diffs.push('enabled');
        if(String(ds.tier)!==String(def.tier))diffs.push('tier');
        if(String(ds.chance)!==String(def.chance))diffs.push('chance');
        if(String(ds.amount)!==String(def.amount))diffs.push('amount');
        if(String(ds.respawn)!==String(def.respawn))diffs.push('respawn');
        if(String(ds.buyMod)!==String(def.buyMod))diffs.push('buy');
        if(String(ds.sellMod)!==String(def.sellMod))diffs.push('sell');
        if(!diffs.length)return;
        const blockId=sanitizeLuaId(g.name,'block_'+gi);
        globalBlockMap[gi]={blockId,settings:ds};
        globalBlockIds.push(blockId);
        globalBlockLtx+=`[arch_global_block_${blockId}]\n`;
        globalBlockLtx+=`enabled = ${ds.enabled!==false}\n`;
        if(String(ds.tier)!==String(def.tier))globalBlockLtx+=`tier = ${Math.max(1,Math.min(5,Number(ds.tier||3)||3))}\n`;
        if(String(ds.chance)!==String(def.chance))globalBlockLtx+=`chance = ${Math.max(1,Number(ds.chance||100)||100)}\n`;
        if(String(ds.amount)!==String(def.amount))globalBlockLtx+=`amount = ${Math.max(1,Number(ds.amount||1)||1)}\n`;
        if(String(ds.respawn)!==String(def.respawn))globalBlockLtx+=`respawn = ${ds.respawn!==false}\n`;
        if(String(ds.buyMod)!==String(def.buyMod))globalBlockLtx+=`buy = ${Number(ds.buyMod||0.85)}\n`;
        if(String(ds.sellMod)!==String(def.sellMod))globalBlockLtx+=`sell = ${Number(ds.sellMod||1.15)}\n`;
        globalBlockLtx+='\n';
    });

    targets.forEach(t=>{
        let ch,gi,ci,e;
        if(t.solo){
            ch=soloChars[t.si];if(!ch)return;
            gi=-1;ci=t.si;
            // Solo chars have their own defaults, no group inheritance
            e={settings:Object.assign({},dc(DEFAULT_SETTINGS),ch.defaults?.settings||{},ch.ov?.settings||{}),
               trade:Object.assign({},dc(DEFAULT_TRADE),ch.defaults?.trade||{},ch.ov?.trade||{}),
               dlg:Object.assign({},dc(DEFAULT_DLG),ch.defaults?.dlg||{},ch.ov?.dlg||{})};
        } else {
            gi=t.gi;ci=t.ci;
            ch=groups[gi]?.chars[ci];if(!ch)return;
            e=getEffective(gi,ci);
        }
        const s=e.settings;
        let id=sanitizeLuaId(ch.archId,`arch_${gi+1}_${ci+1}`);
        if(usedIds.has(id)){let n=2;while(usedIds.has(`${id}_${n}`))n++;id=`${id}_${n}`;}
        usedIds.add(id);
        const dlgData=e.dlg||{};
        const _allTrees=dlgData.dialogs||[{opener:dlgData.opener||'',hub:dlgData.hub||'',hubChoices:dlgData.hubChoices||[],nodes:dlgData.nodes||{},layout:dlgData.layout||{}}];
            // Filter out empty dialog trees (no opener, no hub, no nodes, no choices)
            const trees=_allTrees.filter(function(t){
                return String(t.opener||'').trim()||String(t.hub||'').trim()||(t.hubChoices&&t.hubChoices.length)||(t.nodes&&Object.keys(t.nodes).length);
            });
            if(!trees.length)trees.push(_allTrees[0]||{opener:'',hub:'',hubChoices:[],nodes:{},layout:{}});
            const _introDoneInfo=String(dlgData.introDoneInfo||s.introDoneInfo||'').trim()||`${id}_met`;
            // A "main" dialog has no task_ready or delivery_target preconditions
            const _isNonMainDialog=function(t){
                const dp=t._dialogPreconditions||[];
                const dhi=t._dialogHasInfo||[];
                // Non-main if it has task_ready or delivery_target preconditions,
                // or has_info gates OTHER than the intro_done_info (which is expected on main)
                var hasNonIntroDhi=dhi.filter(function(h){return h!==_introDoneInfo;});
                return dp.some(function(p){return p.indexOf('task_ready')>=0||p.indexOf('delivery_target')>=0;})
                    ||hasNonIntroDhi.length>0;
            };
            // dialog_id should only be emitted if the dialog has real user content
            // (not just default opener/hub with no choices or nodes)
            function _hasRealContent(t){
                if(t.hubChoices&&t.hubChoices.length)return true;
                if(t.nodes&&Object.keys(t.nodes).length)return true;
                var op=String(t.opener||'').trim();
                var hu=String(t.hub||'').trim();
                // If opener/hub differ from defaults, that's user content
                if(op&&op!=='I want to ask you something.'&&op!=='I want to ask you something')return true;
                if(hu&&hu!=='What do you want to know?'&&hu!=='')return true;
                return false;
            }
            const _hasMainDialog=trees.some(function(t){return !_isNonMainDialog(t)&&_hasRealContent(t);});
            const allDlgIds=[];
            trees.forEach((tree,ti)=>{
                // Skip dialog generation for trees with no real content
                if(!_hasRealContent(tree)&&!_isNonMainDialog(tree))return;
                const treeId=ti===0?id:`${id}_dlg${ti+1}`;
                // Build dialog-level metadata from intro gating + preserved import data
                const _treeMeta={};
                if(ti===0&&dlgData.introDialog)_treeMeta.hasInfo=_introDoneInfo;
                // Merge preserved dialog-level gates from import
                if(Array.isArray(tree._dialogPreconditions)&&tree._dialogPreconditions.length)
                    _treeMeta.preconditions=((_treeMeta.preconditions)||[]).concat(tree._dialogPreconditions);
                if(Array.isArray(tree._dialogHasInfo)&&tree._dialogHasInfo.length)
                    _treeMeta.hasInfo=(_treeMeta.hasInfo?[].concat(_treeMeta.hasInfo):[] ).concat(tree._dialogHasInfo);
                if(Array.isArray(tree._dialogDontHasInfo)&&tree._dialogDontHasInfo.length)
                    _treeMeta.dontHasInfo=(tree._dialogDontHasInfo);
                const _hasTreeMeta=Object.keys(_treeMeta).length>0;
                const p=buildDialogPayload(treeId,tree,id,_hasTreeMeta?_treeMeta:undefined);
                allDlgIds.push(p.mainDialogId);
                dialogsXml+=p.dialogXml;
                stringsXml+=_dedupStrings(p.textXml);
            });
            // Export custom pool dialog trees (if they have content)
            (dlgData.customPools||[]).forEach(pool=>{
                const poolTrees=Array.isArray(pool.dialogTrees)?pool.dialogTrees:(pool.dialogTree?[pool.dialogTree]:[]);
                poolTrees.forEach((tree,ti)=>{
                    if(!tree)return;
                    const hasContent=String(tree.hub||'').trim()||(Array.isArray(tree.hubChoices)&&tree.hubChoices.length)||(tree.nodes&&Object.keys(tree.nodes||{}).length);
                    if(!hasContent)return;
                    const tag=String(pool.tag||'custom').trim();
                    const treeId=ti===0?`${id}_pool_${tag}`:`${id}_pool_${tag}_${ti+1}`;
                    const p=buildDialogPayload(treeId,tree,id);
                    allDlgIds.push(p.mainDialogId);
                    dialogsXml+=p.dialogXml;
                    stringsXml+=_dedupStrings(p.textXml);
                });
            });
            const mainDialogId=allDlgIds[0];
            const specializationDialogIds=getSpecializationDialogIds(s.specialization);
            const extras=parseCsvIds(s.dialogIdsCsv||'').filter(v=>!allDlgIds.includes(v));

            const tr=e.trade||{};
            const buyRows=parseTradeLines(tr.buyListRaw,'buy');
            const sellRows=parseTradeLines(tr.sellListRaw,'sell');
            const supplyRows=parseTradeLines(tr.supplyListRaw,'supply');
            const hasCustomTrade=(buyRows.length||sellRows.length||supplyRows.length);
            const ltx=s.ltxPath||(hasCustomTrade?`items\\\\trade\\\\arch_trade_${id}.ltx`:'');
            let effectiveDialogProfile=String(s.dialogProfile||'').trim();
            if(!effectiveDialogProfile&&s.commMode==='inc'&&Array.isArray(s.commVals)&&s.commVals.length===1){
                effectiveDialogProfile=String(s.commVals[0]||'').trim();
            }

            const sp=parseSpawnLines(s.spawnPrimary,'primary');
            const ss=parseSpawnLines(s.spawnSecondary,'secondary');
            const se=parseSpawnLines(s.spawnExtra,'extra');

            const _isStoryNpc=!!(String(s.assignTo||'').trim()&&typeof STORY_NPC_LOOKUP!=='undefined'&&STORY_NPC_LOOKUP[String(s.assignTo||'').trim()]);
            // Story NPCs: archetype is hardcoded in arch_story_npcs.script — do NOT emit [arch_runtime_*]
            if(!_isStoryNpc){
            archetypeLtxIds.push(id);
            archetypeLtxSections+=`[arch_runtime_${id}]\n`;
            {
                // Regular archetype — full filter/trade/spawn export
                const _gb=(!t.solo&&globalBlockMap[gi])||null;
                const _gbs=_gb?_gb.settings:null;
                const _skipIfBlock=(field,val)=>_gbs&&String(_gbs[field])===String(val);
                if(_gb)archetypeLtxSections+=`global_block = ${_gb.blockId}\n`;
                if(s.enabled===false&&!_skipIfBlock('enabled',false))archetypeLtxSections+=`enabled = false\n`;
                if(s.commMode==='inc'&&s.commVals.length)archetypeLtxSections+=`community_include = ${s.commVals.join(', ')}\n`;
                else if(s.commMode==='exc'&&s.commVals.length)archetypeLtxSections+=`community_exclude = ${s.commVals.join(', ')}\n`;
                if(Array.isArray(s.commExcVals)&&s.commExcVals.length&&s.commMode==='inc')archetypeLtxSections+=`community_exclude = ${s.commExcVals.join(', ')}\n`;
                if(s.locMode==='inc'&&s.locVals.length)archetypeLtxSections+=`location_include = ${s.locVals.join(', ')}\n`;
                else if(s.locMode==='exc'&&s.locVals.length)archetypeLtxSections+=`location_exclude = ${s.locVals.join(', ')}\n`;
                if(Array.isArray(s.locExcVals)&&s.locExcVals.length&&s.locMode==='inc')archetypeLtxSections+=`location_exclude = ${s.locExcVals.join(', ')}\n`;
                if(s.rankMode==='inc'&&s.rankVals.length)archetypeLtxSections+=`rank_include = ${s.rankVals.join(', ')}\n`;
                else if(s.rankMode==='exc'&&s.rankVals.length)archetypeLtxSections+=`rank_exclude = ${s.rankVals.join(', ')}\n`;
                if(Array.isArray(s.rankExcVals)&&s.rankExcVals.length&&s.rankMode==='inc')archetypeLtxSections+=`rank_exclude = ${s.rankExcVals.join(', ')}\n`;
                if(s.male===false)archetypeLtxSections+='male = false\n';
                if(s.female===false)archetypeLtxSections+='female = false\n';
                if(ltx)archetypeLtxSections+=`ltx = ${ltx.replace(/\\\\/g,'\\')}\n`;
                if(s.buyMod&&Number(s.buyMod)!==0.85&&!_skipIfBlock('buyMod',s.buyMod))archetypeLtxSections+=`buy = ${Number(s.buyMod)}\n`;
                if(s.sellMod&&Number(s.sellMod)!==1.15&&!_skipIfBlock('sellMod',s.sellMod))archetypeLtxSections+=`sell = ${Number(s.sellMod)}\n`;
                var _amountVal=Math.max(1,Number(s.amount||1)||1);
                if(_amountVal!==1&&!_skipIfBlock('amount',s.amount))archetypeLtxSections+=`amount = ${_amountVal}\n`;
                if(s.respawn===false)archetypeLtxSections+=`respawn = false\n`;
                if(!_skipIfBlock('tier',s.tier))archetypeLtxSections+=`tier = ${Math.max(1,Math.min(5,Number(s.tier||3)||3))}\n`;
                if(!_skipIfBlock('chance',s.chance))archetypeLtxSections+=`chance = ${Math.max(1,Number(s.chance||100)||100)}\n`;
                if(s.availableAfterDays&&Number(s.availableAfterDays)>0)archetypeLtxSections+=`available_after_days = ${Number(s.availableAfterDays)}\n`;
                if(s.tradePreset)archetypeLtxSections+=`trade_preset = ${String(s.tradePreset).trim()}\n`;
            }
            if(s.mapSpot)archetypeLtxSections+=`map_spot = ${String(s.mapSpot).trim()}\n`;
            if(s.goodwill&&Number(s.goodwill))archetypeLtxSections+=`goodwill = ${Number(s.goodwill)}\n`;
            if(s.smartTerrainInclude)archetypeLtxSections+=`smart_terrain_include = ${String(s.smartTerrainInclude).split(',').map(t=>t.trim()).filter(Boolean).join(', ')}\n`;
            if(s.smartTerrainExclude)archetypeLtxSections+=`smart_terrain_exclude = ${String(s.smartTerrainExclude).split(',').map(t=>t.trim()).filter(Boolean).join(', ')}\n`;
            if(s.regularVisitThreshold)archetypeLtxSections+=`regular_visit_threshold = ${String(s.regularVisitThreshold).trim()}\n`;
            function _quoteName(v){const t=String(v).replace(/\r?\n/g,' ').trim();return t.includes(' ')?'"'+t+'"':t;}
            if(s.namePrefix){archetypeLtxSections+=`name_format_type = prefix\nname_format_text = ${_quoteName(s.namePrefix)}\n`;}
            else if(s.nameFullName){archetypeLtxSections+=`name_format_type = replace\nname_format_text = ${_quoteName(s.nameFullName)}\n`;}
            else if(s.nameSuffix){archetypeLtxSections+=`name_format_type = suffix\nname_format_text = ${_quoteName(s.nameSuffix)}\n`;}
            if(_hasMainDialog)archetypeLtxSections+=`dialog_id = ${mainDialogId}\n`;
            const _dialogIdsPlaceholder=`__DIALOG_IDS_${id}__`;
            archetypeLtxSections+=`dialog_ids = ${_dialogIdsPlaceholder}\n`;
            // Dialog priority from opener row order (position in openerOrder, 1-based)
            if(Array.isArray(dlgData.openerOrder)&&dlgData.openerOrder.length>1){
                const _opIdx=dlgData.openerOrder.findIndex(o=>o.type==='dialog'&&String(o.key)==='0');
                if(_opIdx>0)archetypeLtxSections+=`dialog_priority = ${_opIdx+1}\n`;
            }
            const specList=parseSpecializations(s.specialization);
            if(specList.length)archetypeLtxSections+=`specialization = ${specList.join(', ')}\n`;
            const _spawnClean=arr=>arr.map(v=>{const s=String(v);return s.replace(/:0:0:100$/,'');});
            if(sp.length)archetypeLtxSections+=`spawn_primary = ${_spawnClean(sp).join(', ')}\n`;
            if(ss.length)archetypeLtxSections+=`spawn_secondary = ${_spawnClean(ss).join(', ')}\n`;
            if(se.length)archetypeLtxSections+=`spawn_extra = ${se.map(function(v){return String(v).replace(/:100$/,'');}).join(', ')}\n`;
            // Vanilla category tree export — edited trees become custom dialogs
            const vanillaDlgs=(dlgData.vanillaDialogs)||{};
            var _userStrip=Array.isArray(s.stripCategories)?s.stripCategories.filter(Boolean):[];
            var _editedVanillaCats=[];
            Object.entries(vanillaDlgs).forEach(([catId,tree])=>{
                if(!tree||!_isVanillaTreeEdited(catId,tree,s.assignTo))return;
                // Wounded is handled entirely by DM hello entry with wounded=true (line ~685)
                // Don't export wounded as a standalone dialog — it breaks NPC interaction
                if(catId==='wounded')return;
                _editedVanillaCats.push(catId);
                const vanillaTreeId=`${id}_vanilla_${catId}`;
                const p=buildDialogPayload(vanillaTreeId,tree,id);
                allDlgIds.push(p.mainDialogId);
                dialogsXml+=p.dialogXml;
                stringsXml+=_dedupStrings(p.textXml);
                if(!_userStrip.includes(catId))_userStrip.push(catId);
            });
            // Companion dialog export — auto-gated with arch_is_companion precondition
            const compDialogs=dlgData.companionDialogs||[];
            compDialogs.forEach((tree,ci)=>{
                if(!tree||(!String(tree.opener||'').trim()&&!String(tree.hub||'').trim()&&!Object.keys(tree.nodes||{}).length))return;
                const compTreeId=`${id}_companion_${ci+1}`;
                const compMeta={preconditions:['dialogs.arch_is_companion']};
                const cp=buildDialogPayload(compTreeId,tree,id,compMeta);
                allDlgIds.push(cp.mainDialogId);
                dialogsXml+=cp.dialogXml;
                stringsXml+=_dedupStrings(cp.textXml);
            });
            var _isDefaultStrip=_userStrip.length===DEFAULT_STRIP_UI.length&&_userStrip.every(function(c){return DEFAULT_STRIP_UI.indexOf(c)>=0;});
            var _hasEditedVanilla=_editedVanillaCats.length>0;
            if(_userStrip.length&&(!_isDefaultStrip||_hasEditedVanilla))archetypeLtxSections+=`strip_dialog_categories = ${_userStrip.join(', ')}\n`;
            // Dynamic news
            const _nJoin=t=>String(t||'').split('\n').map(l=>l.trim()).filter(Boolean).join('; ');
            const nDeath=_nJoin(s.newsOnDeath),nArea=_nJoin(s.newsOnArea);
            if(nDeath)archetypeLtxSections+=`news_on_death = ${nDeath}\n`;
            if(nArea)archetypeLtxSections+=`news_on_area = ${nArea}\n`;
            if(s.newsIcon)archetypeLtxSections+=`news_icon = ${s.newsIcon}\n`;
            // Intro dialog export — with first-meet gating
            const _introTree=dlgData.introDialog;
            if(_introTree&&(String(_introTree.opener||'').trim()||String(_introTree.hub||'').trim()||(Object.keys(_introTree.nodes||{}).length))){
                const introTreeId=`${id}_intro`;
                const introTreeCopy=dc(_introTree);
                if(!introTreeCopy._introGiveInfoInjected){
                    introTreeCopy._introActorGiveInfo=_introDoneInfo;
                    introTreeCopy._introGiveInfoInjected=true;
                }
                const introP=buildDialogPayload(introTreeId,introTreeCopy,id,{dontHasInfo:_introDoneInfo});
                allDlgIds.push(introP.mainDialogId);
                dialogsXml+=introP.dialogXml;
                stringsXml+=_dedupStrings(introP.textXml);
                archetypeLtxSections+=`intro_dialog = ${introP.mainDialogId}\n`;
                archetypeLtxSections+=`intro_done_info = ${_introDoneInfo}\n`;
            }
            if(s.onDeathInfo)archetypeLtxSections+=`on_death_info = ${String(s.onDeathInfo).trim()}\n`;
            // Replace dialog_ids placeholder
            const _finalDialogIds=uniqueList(allDlgIds.concat(specializationDialogIds,extras));
            archetypeLtxSections=archetypeLtxSections.replace(_dialogIdsPlaceholder,_finalDialogIds.join(', '));
            archetypeLtxSections+='\n';
            } // end if(!_isStoryNpc) — regular archetype LTX block

            // For story NPCs, collect custom dialog IDs for [arch_pack_meta] dialog_ids
            if(_isStoryNpc){
                allDlgIds.forEach(function(d){if(d.indexOf('arch_')===0&&storyNpcDialogIds.indexOf(d)<0)storyNpcDialogIds.push(d);});
            }

            stringsVanillaXml+=buildVanillaTopicPayload(id,dlgData);

            // Build mod_dialog_manager entries for vanilla topic text
            var _dmV=ensureVanillaDlg((dlgData&&dlgData.vanilla)||null);
            var _dmComm=(s.commMode==='inc'&&Array.isArray(s.commVals)&&s.commVals.length===1)?s.commVals[0]:'stalker';
            if(_isStoryNpc)_dmComm='stalker';
            function _dmEntry(sid,cat,extra){
                dmLtxEntries+=`@[${sid}]\ncategory = ${cat}\nnpc_community = ${_dmComm}\nactor_community = all\nlevel = all\nnpc_rank = all\nactor_rank = all\nimportant = true\n${extra||''}condition = {=is_arch(${id})} true, false\n\n`;
            }
            // Hello greeting — from the All view opener NPC text, fallback to imported vanilla hello
            var _helloText=String(dlgData.openerNpc||'').trim();
            if(!_helloText)_helloText=String(_dmV.hello1||'').trim();
            if(_helloText){
                _dmEntry(`dm_hello_arch_${id}_1`,'hello');
                if(!_packEmittedSids.has(`dm_hello_arch_${id}_1`)){
                    _packEmittedSids.add(`dm_hello_arch_${id}_1`);
                    stringsVanillaXml+=xmlStr(`dm_hello_arch_${id}_1`,_helloText);
                }
            }
            // Wounded greeting — only export if user edited it from the default
            var _woundedTree=dlgData.vanillaDialogs&&dlgData.vanillaDialogs.wounded;
            var _woundedText=_woundedTree?String(_woundedTree.hub||'').trim():'';
            if(!_woundedText)_woundedText=String(_dmV.wounded||'').trim(); // fallback to old field
            var _woundedDefault=(VANILLA_DIALOG_DEFAULTS.wounded&&VANILLA_DIALOG_DEFAULTS.wounded.hub)||'';
            if(_woundedText&&_woundedText!==_woundedDefault){
                _dmEntry(`dm_hello_arch_${id}_wounded`,'hello','wounded = true\n');
                if(!_packEmittedSids.has(`dm_hello_arch_${id}_wounded`)){
                    _packEmittedSids.add(`dm_hello_arch_${id}_wounded`);
                    stringsVanillaXml+=xmlStr(`dm_hello_arch_${id}_wounded`,_woundedText);
                }
            }
            // Job/anomalies/info/tips — from old vanilla fields
            if(String(_dmV.job||'').trim())_dmEntry(`dm_job_arch_${id}_1`,'job');
            if(String(_dmV.anomalies||'').trim())_dmEntry(`dm_anomalies_arch_${id}_1`,'anomalies');
            if(String(_dmV.information||'').trim())_dmEntry(`dm_information_arch_${id}_1`,'information');
            if(String(_dmV.tips||'').trim())_dmEntry(`dm_tips_arch_${id}_1`,'tips');

            // Collect task pools for export (supports multi-pool and legacy flat tasks)
            const _rawPools=Array.isArray(dlgData.taskPools)&&dlgData.taskPools.length
                ?dlgData.taskPools
                :(Array.isArray(dlgData.tasks)&&dlgData.tasks.length
                    ?[{tag:'default',enabled:true,cooldownHours:0,dialogOpenText:'',dialogNpcPrompt:'',tasks:dlgData.tasks}]
                    :[]);
            // Filter out incomplete tasks (missing required kind-specific fields)
            function _isTaskComplete(t){
                const kind=t.type||'fetch';
                if(kind==='delivery')return !!String(t.deliverItem||t.target||'').trim();
                if(kind==='talk')return !!(String(t.talkToArchetype||'').trim()||t.talkToGiver);
                if(kind==='collect')return !!String(t.collectItem||t.collectFromArchetype||'').trim();
                // Fetch: always export — validator catches missing item_section after
                return true;
            }
            _rawPools.forEach(pool=>{
                const _tasks=(Array.isArray(pool.tasks)?pool.tasks:[]).filter(_isTaskComplete);
                if(!_tasks.length)return;
                const tag=String(pool.tag||'default').trim();
                const poolId=`${id}_${tag}`;
                const taskIds=_tasks.map(t=>String(t.id||'').trim()).filter(Boolean);
                if(!taskIds.length)_tasks.forEach((t,ti)=>{const tid=`${id}_${tag}_task_${ti+1}`;t.id=tid;taskIds.push(tid);});
                taskPoolSections.push({poolId,archId:id,tag,pool,taskIds,tasks:_tasks});
            });
            // Custom pools — pool_tag only, no dialog_open_text/dialog_npc_prompt
            (dlgData.customPools||[]).forEach(pool=>{
                const _tasks=(Array.isArray(pool.tasks)?pool.tasks:[]).filter(_isTaskComplete);
                if(!_tasks.length)return;
                const tag=String(pool.tag||'custom').trim();
                const poolId=`${id}_${tag}`;
                const taskIds=_tasks.map(t=>String(t.id||'').trim()).filter(Boolean);
                if(!taskIds.length)_tasks.forEach((t,ti)=>{const tid=`${id}_${tag}_task_${ti+1}`;t.id=tid;taskIds.push(tid);});
                taskPoolSections.push({poolId,archId:id,tag,pool,taskIds,tasks:_tasks});
            });

            if(buyRows.length||sellRows.length||supplyRows.length){
                let ltxC=`[trader]\nbuy_condition = ${id}_buy\nsell_condition = ${id}_sell\n`;
                const gwFaction=(s.commMode==='inc'&&Array.isArray(s.commVals)&&s.commVals.length===1)?s.commVals[0]:'stalker';
                const supplyMap={};
                supplyRows.forEach(r=>{const key=`${r.tier}|${r.gw}`;if(!supplyMap[key])supplyMap[key]={tier:r.tier,gw:r.gw,items:[]};supplyMap[key].items.push(r);});
                const tiers=Object.keys(supplyMap).map(k=>supplyMap[k]);
                if(tiers.length)ltxC+=`buy_supplies = ${tiers.map(t=>(+t.gw>0?`{=actor_goodwill_ge(${gwFaction}:${t.gw})} ${t.tier}`:t.tier)).join(', ')}\n`;
                ltxC+=`buy_item_condition_factor = ${tr.tradeCond||0.5}\nbuy_item_exponent = ${tr.tradeBuyExp||1}\nsell_item_exponent = ${tr.tradeSellExp||1}\n\n`;
                const secParent=(typeof TRADE_PRESETS!=='undefined'&&TRADE_PRESETS[tr.tradeParent])?TRADE_PRESETS[tr.tradeParent].parent:(tr.tradeParent||'');
                ltxC+=`[${id}_buy]${secParent?':'+secParent:''}\n`;buyRows.forEach(i=>{if(i.sec)ltxC+=`${i.sec} = ${i.base}, ${i.mult}\n`;});
                ltxC+=`\n[${id}_sell]${secParent?':'+secParent:''}\n`;sellRows.forEach(i=>{if(i.sec)ltxC+=`${i.sec} = ${i.base}, ${i.mult}\n`;});ltxC+='\n';
                const supplyMap2={};
                supplyRows.forEach(r=>{const key=r.tier;if(!supplyMap2[key])supplyMap2[key]=[];supplyMap2[key].push(r);});
                Object.entries(supplyMap2).forEach(([tier,rows])=>{ltxC+=`[${tier}]\n`;rows.forEach(r=>{if(r.sec)ltxC+=`${r.sec} = ${r.qty}, ${r.prob}\n`;});ltxC+='\n';});
                tradeFiles.push({id,code:ltxC});
            }
        }); // end targets.forEach

    // ── Slug from included archetype IDs ──
    const allIds=[];
    targets.forEach(t=>{
        const ch=t.solo?soloChars[t.si]:groups[t.gi]?.chars[t.ci];
        const id=ch&&sanitizeLuaId(ch.archId,'arch');if(id)allIds.push(id);
    });
    const slug=allIds.length?allIds.slice(0,3).join('_')+(allIds.length>3?'_etc':''):'pack_'+Date.now().toString(36);

    // Remake export mode (v15):
    // emit unique filenames per pack (slugged) so multiple creations can coexist.
    // Generated script registers a thin creation-pack manifest through the remake
    // framework API (register_creation_pack), which owns timing/queue behavior.
    const archetypesLtxFile=`arch_pack_${slug}.ltx`;
    const dialogsXmlFile=`dialogs_arch_${slug}.xml`;
    const strBranchFile=`st_arch_${slug}_branches.xml`;
    const strTopicsFile=`st_arch_${slug}_topic_strings.xml`;
    const packId=`arch_pack_${slug}`;

    // Build task pool LTX sections
    let taskLtxSections='';
    const taskPoolIds=[];
    taskPoolSections.forEach(pool=>{
        taskPoolIds.push(pool.poolId);
        taskLtxSections+=`[arch_task_pool_${pool.poolId}]\n`;
        taskLtxSections+=`archetype_id = ${pool.archId}\n`;
        taskLtxSections+=`enabled = ${pool.pool.enabled===false?'false':'true'}\n`;
        if(pool.tag&&pool.tag!=='default')taskLtxSections+=`pool_tag = ${pool.tag}\n`;
        taskLtxSections+=`cooldown_hours = ${Number(pool.pool.cooldownHours)||0}\n`;
        const _openText=String(pool.pool.dialogOpenText||'').trim();
        const _npcPrompt=String(pool.pool.dialogNpcPrompt||'').trim();
        if(_openText)taskLtxSections+=`dialog_open_text = ${_openText}\n`;
        if(_npcPrompt)taskLtxSections+=`dialog_npc_prompt = ${_npcPrompt}\n`;
        const _pa=String(pool.pool.personalityAccept||'').trim();
        const _pd=String(pool.pool.personalityDecline||'').trim();
        const _pta=String(pool.pool.personalityTurninActor||'').trim();
        const _ptn=String(pool.pool.personalityTurninNpc||'').trim();
        if(_pa)taskLtxSections+=`personality_accept = ${_pa}\n`;
        if(_pd)taskLtxSections+=`personality_decline = ${_pd}\n`;
        if(_pta)taskLtxSections+=`personality_turnin_actor = ${_pta}\n`;
        if(_ptn)taskLtxSections+=`personality_turnin_npc = ${_ptn}\n`;
        taskLtxSections+=`task_ids = ${pool.taskIds.join(', ')}\n\n`;
        pool.tasks.forEach(t=>{
            const tid=String(t.id||'').trim();
            if(!tid)return;
            const _rawKind=t.type||'fetch';
            const kind=(_rawKind==='single'||_rawKind==='category'||_rawKind==='shopping')?'fetch':_rawKind;
            taskLtxSections+=`[arch_task_${tid}]\n`;
            taskLtxSections+=`kind = ${kind}\n`;
            if(t.textPrefix)taskLtxSections+=`text_prefix = ${String(t.textPrefix).trim()}\n`;

            // Kind-specific fields
            if(kind==='delivery'){
                if(t.deliverItem||t.target)taskLtxSections+=`deliver_item = ${String(t.deliverItem||t.target||'').trim()}\n`;
                taskLtxSections+=`deliver_amount = ${Math.max(1,Number(t.deliverAmount)||1)}\n`;
                var _dta=String(t.deliverToArchetype||'').trim().toLowerCase();
                if(_dta&&_dta!=='any'&&_dta!=='all')taskLtxSections+=`deliver_to_archetype = ${_dta}\n`;
                if(t.deliverToCommunity)taskLtxSections+=`deliver_to_community = ${String(t.deliverToCommunity).trim()}\n`;
                if(t.deliverToLocation)taskLtxSections+=`deliver_to_location = ${String(t.deliverToLocation).trim()}\n`;
            } else if(kind==='talk'){
                if(t.talkToGiver)taskLtxSections+=`talk_to_giver = true\n`;
                else if(t.talkToArchetype){var _tta=String(t.talkToArchetype).trim().toLowerCase();if(_tta&&_tta!=='any'&&_tta!=='all')taskLtxSections+=`talk_to_archetype = ${_tta}\n`;}
            } else if(kind==='collect'){
                var _cfa=String(t.collectFromArchetype||'').trim().toLowerCase();
                if(_cfa&&_cfa!=='any'&&_cfa!=='all')taskLtxSections+=`collect_from_archetype = ${_cfa}\n`;
                if(t.collectFromCommunity)taskLtxSections+=`collect_from_community = ${String(t.collectFromCommunity).trim()}\n`;
                if(t.collectFromRank)taskLtxSections+=`collect_from_rank = ${String(t.collectFromRank).trim()}\n`;
                if(t.collectFromLocation)taskLtxSections+=`collect_from_location = ${String(t.collectFromLocation).trim()}\n`;
                if(t.collectItem||t.target)taskLtxSections+=`collect_item = ${String(t.collectItem||t.target||'').trim()}\n`;
                taskLtxSections+=`collect_amount = ${Math.max(1,Number(t.collectAmount)||1)}\n`;
            } else {
                // Fetch
                const fm=t.fetchMode||'single';
                if(fm==='shopping'&&t.shoppingItems){
                    const items=String(t.shoppingItems).split(/[\n,]/).map(s=>s.trim()).filter(Boolean).join(', ');
                    taskLtxSections+=`items = ${items}\n`;
                } else if(fm==='category'&&t.itemCategory){
                    taskLtxSections+=`item_category = ${t.itemCategory}\n`;
                    if(t.categoryMode)taskLtxSections+=`category_mode = ${t.categoryMode}\n`;
                } else if(t.target){
                    taskLtxSections+=`item_section = ${t.target}\n`;
                }
                if(fm!=='shopping'){
                    taskLtxSections+=`amount = ${Math.max(1,Number(t.count)||1)}\n`;
                }
            }

            // Common fields
            if(t.onCompleteTask)taskLtxSections+=`on_complete_task = ${String(t.onCompleteTask).trim()}\n`;
            if(t.onCompleteInfo)taskLtxSections+=`on_complete_info = ${String(t.onCompleteInfo).trim()}\n`;
            if(t.onTargetDeath)taskLtxSections+=`on_target_death = ${String(t.onTargetDeath).trim()}\n`;
            if(t.onGiverDeath)taskLtxSections+=`on_giver_death = ${String(t.onGiverDeath).trim()}\n`;
            if(t.onGiverDeathTransferTo)taskLtxSections+=`on_giver_death_transfer_to = ${String(t.onGiverDeathTransferTo).trim()}\n`;
            if(t.onDeathTask)taskLtxSections+=`on_death_task = ${String(t.onDeathTask).trim()}\n`;
            if(t.onDeathInfoTask)taskLtxSections+=`on_death_info = ${String(t.onDeathInfoTask).trim()}\n`;
            if(t.onFailInfo)taskLtxSections+=`on_fail_info = ${String(t.onFailInfo).trim()}\n`;
            if(t.requiresItem)taskLtxSections+=`requires_item = ${String(t.requiresItem).trim()}\n`;
            if(t.requiresTime)taskLtxSections+=`requires_time = ${String(t.requiresTime).trim()}\n`;
            if(t.requiresPoolUnlock)taskLtxSections+=`requires_pool_unlock = ${String(t.requiresPoolUnlock).trim()}\n`;
            if(t.requiresTaskDoneByNpc)taskLtxSections+=`requires_task_done_by_npc = ${String(t.requiresTaskDoneByNpc).trim()}\n`;
            if(t.rewardMultiplier)taskLtxSections+=`reward_multiplier = ${String(t.rewardMultiplier).trim()}\n`;
            if(t.rewardCap)taskLtxSections+=`reward_cap = ${String(t.rewardCap).trim()}\n`;
            if(t.conditions)taskLtxSections+=`conditions = ${String(t.conditions).trim()}\n`;
            taskLtxSections+=`weight = ${Number(t.weight)>=0?Number(t.weight):1}\n`;
            if(t.pdaPriority!==undefined&&t.pdaPriority!==5)taskLtxSections+=`pda_priority = ${Number(t.pdaPriority)||5}\n`;
            taskLtxSections+=`repeatable = ${t.repeatable!==false}\n`;
            if(t.oncePerActor)taskLtxSections+=`once_per_actor = true\n`;
            if(Number(t.cooldownHours)>0)taskLtxSections+=`cooldown_hours = ${Number(t.cooldownHours)}\n`;
            if(t.usePdaTask)taskLtxSections+=`use_pda_task = true\npda_task_id = ${t.pdaTaskId||tid}\n`;
            if(t.pdaIcon)taskLtxSections+=`pda_icon = ${t.pdaIcon}\n`;
            taskLtxSections+=`reward_money = ${Number(t.moneyReward)||0}\n`;
            if(t.rewardItems)taskLtxSections+=`reward_items = ${String(t.rewardItems).trim()}\n`;
            if(Number(t.rewardGoodwill))taskLtxSections+=`reward_goodwill = ${Number(t.rewardGoodwill)}\n`;
            if(t.rewardGoodwillCommunity)taskLtxSections+=`reward_goodwill_community = ${String(t.rewardGoodwillCommunity).trim()}\n`;
            if(Number(t.rewardBuyMod))taskLtxSections+=`reward_buy_modifier = ${Number(t.rewardBuyMod)}\n`;
            if(Number(t.rewardSellMod))taskLtxSections+=`reward_sell_modifier = ${Number(t.rewardSellMod)}\n`;
            if(!t.textPrefix&&t.openingDialogue)taskLtxSections+=`summary_text = ${String(t.openingDialogue).replace(/\r?\n/g,'\\n')}\n`;
            if(!t.textPrefix&&t.desc)taskLtxSections+=`details_text = ${String(t.desc).replace(/\r?\n/g,'\\n')}\n`;
            if(t.acceptedText)taskLtxSections+=`accepted_text = ${String(t.acceptedText).replace(/\r?\n/g,'\\n')}\n`;
            if(t.completedText)taskLtxSections+=`completed_text = ${String(t.completedText).replace(/\r?\n/g,'\\n')}\n`;
            if(t.minRank)taskLtxSections+=`min_rank = ${t.minRank}\n`;
            if(t.maxRank)taskLtxSections+=`max_rank = ${t.maxRank}\n`;
            if(Number(t.requiresTrust)>0)taskLtxSections+=`requires_trust = ${Number(t.requiresTrust)}\n`;
            if(t.requiresTaskDone)taskLtxSections+=`requires_task_done = ${String(t.requiresTaskDone).trim()}\n`;
            if(t.requiresInfo)taskLtxSections+=`requires_info = ${String(t.requiresInfo).trim()}\n`;
            if(Number(t.requiresMinGoodwill)>0)taskLtxSections+=`requires_min_goodwill = ${Number(t.requiresMinGoodwill)}\n`;
            taskLtxSections+='\n';
        });
    });

    // Add PDA task text strings (from text_prefix)
    taskPoolSections.forEach(pool=>{
        pool.tasks.forEach(t=>{
            if(!t.textPrefix)return;
            var sumSid=t._pdaSummarySid||('dm_'+t.textPrefix+'_summary');
            var detSid=t._pdaDetailsSid||('dm_'+t.textPrefix+'_details');
            var sumText=t.openingDialogue||'';
            var detText=t.desc||'';
            if(sumText&&!_packEmittedSids.has(sumSid)){_packEmittedSids.add(sumSid);stringsXml+=xmlStr(sumSid,sumText);}
            if(detText&&!_packEmittedSids.has(detSid)){_packEmittedSids.add(detSid);stringsXml+=xmlStr(detSid,detText);}
        });
    });

    // Build fetch category LTX (arch_fetch_categories.ltx)
    // Collect categories referenced by any task in this pack
    let categoryLtx='';
    const _cats=typeof savedCategories!=='undefined'?savedCategories:[];
    if(_cats.length){
        const usedCatNames=new Set();
        taskPoolSections.forEach(pool=>{
            (pool.pool.tasks||[]).forEach(t=>{
                if(t.fetchMode==='category'&&t.itemCategory)usedCatNames.add(t.itemCategory);
            });
        });
        if(usedCatNames.size){
            categoryLtx+=`; Fetch categories for pack: ${slug}\n`;
            categoryLtx+='@[arch_fetch_category_index]\n';
            usedCatNames.forEach(name=>{categoryLtx+=`${name} =\n`;});
            categoryLtx+='\n';
            usedCatNames.forEach(name=>{
                const cat=_cats.find(c=>c.name===name);
                if(cat&&cat.items&&cat.items.length){
                    categoryLtx+=`[${name}]\nitems = ${cat.items.join(', ')}\n\n`;
                }
            });
        }
    }

    // Build pack meta + full LTX
    let packMetaLtx=`[arch_pack_meta]\npack_id = ${packId}\nschema_version = 1\n`;
    if(dialogsXml.trim())packMetaLtx+=`dialog_xml = misc\\${dialogsXmlFile}\n`;
    if(stringsXml.trim())packMetaLtx+=`text_eng = text\\eng\\${strBranchFile}\n`;
    if(storyNpcDialogIds.length)packMetaLtx+=`dialog_ids = ${storyNpcDialogIds.join(', ')}\n`;
    if(taskPoolIds.length)packMetaLtx+=`task_pool_ids = ${taskPoolIds.join(', ')}\n`;
    if(globalBlockIds.length)packMetaLtx+=`global_block_ids = ${globalBlockIds.join(', ')}\n`;
    packMetaLtx+='\n';
    const archetypesLtx=`${packMetaLtx}${globalBlockLtx}[arch_runtime_pack]\narchetype_ids = ${archetypeLtxIds.join(', ')}\n\n${archetypeLtxSections}${taskLtxSections}`;

    const dialogsBranchesXml=`<?xml version="1.0" encoding="utf-8"?>\n<game_dialogs>\n${dialogsXml}</game_dialogs>\n`;
    const stringsBranchesXml=`<?xml version="1.0" encoding="utf-8"?>\n<string_table>\n\n${stringsXml}</string_table>\n`;
    const stringsTopicXml=`<?xml version="1.0" encoding="utf-8"?>\n<string_table>\n\n${stringsVanillaXml}</string_table>\n`;

    blocks.push({title:archetypesLtxFile,code:archetypesLtx,file:`gamedata/configs/misc/${archetypesLtxFile}`});
    blocks.push({title:dialogsXmlFile,code:dialogsBranchesXml,file:`gamedata/configs/misc/${dialogsXmlFile}`});
    blocks.push({title:`${strBranchFile} (eng)`,code:stringsBranchesXml,file:`gamedata/configs/text/eng/${strBranchFile}`});
    blocks.push({title:`${strBranchFile} (rus)`,code:stringsBranchesXml,file:`gamedata/configs/text/rus/${strBranchFile}`});
    blocks.push({title:`${strTopicsFile} (eng)`,code:stringsTopicXml,file:`gamedata/configs/text/eng/${strTopicsFile}`});
    blocks.push({title:`${strTopicsFile} (rus)`,code:stringsTopicXml,file:`gamedata/configs/text/rus/${strTopicsFile}`});

    tradeFiles.forEach(tf=>blocks.push({title:`Trade: ${tf.id}`,code:tf.code,file:`gamedata/configs/items/trade/arch_trade_${tf.id}.ltx`}));

    if(categoryLtx.trim()){
        const catFile='arch_fetch_categories.ltx';
        blocks.push({title:`Fetch Categories (${catFile})`,code:categoryLtx,file:`gamedata/configs/misc/${catFile}`});
        files.push({path:`gamedata/configs/misc/${catFile}`,data:categoryLtx});
    }

    // Dialog Manager LTX (hello/job/anomalies/info/tips registration)
    const dmLtxFile=`mod_dialog_manager_arch_${slug}.ltx`;
    if(dmLtxEntries.trim()){
        blocks.push({title:dmLtxFile,code:dmLtxEntries,file:`gamedata/configs/misc/${dmLtxFile}`});
    }

    files.push({path:`gamedata/configs/misc/${archetypesLtxFile}`,data:archetypesLtx});
    files.push({path:`gamedata/configs/misc/${dialogsXmlFile}`,data:dialogsBranchesXml});
    files.push({path:`gamedata/configs/text/eng/${strBranchFile}`,data:stringsBranchesXml});
    files.push({path:`gamedata/configs/text/rus/${strBranchFile}`,data:stringsBranchesXml});
    files.push({path:`gamedata/configs/text/eng/${strTopicsFile}`,data:stringsTopicXml});
    files.push({path:`gamedata/configs/text/rus/${strTopicsFile}`,data:stringsTopicXml});
    if(dmLtxEntries.trim())files.push({path:`gamedata/configs/misc/${dmLtxFile}`,data:dmLtxEntries});
    tradeFiles.forEach(tf=>files.push({path:`gamedata/configs/items/trade/arch_trade_${tf.id}.ltx`,data:tf.code}));
    files.push({path:'README.txt',data:`A.R.C.H. Archetype Package\nSlug: ${slug}\nPack ID: ${packId}\nGenerated by A.R.C.H. Generator v15\n\nINSTALLATION:\n1. Copy the gamedata/ folder into your Anomaly mod directory or MO2 mod.\n2. Ensure A.R.C.H. framework is installed (arch_pack_loader auto-discovers packs).\n3. Start the game.\n\nFILES:\n- gamedata/configs/misc/${archetypesLtxFile}\n- gamedata/configs/misc/${dialogsXmlFile}\n- gamedata/configs/text/eng/${strBranchFile}\n- gamedata/configs/text/rus/${strBranchFile}\n- gamedata/configs/text/eng/${strTopicsFile}\n- gamedata/configs/text/rus/${strTopicsFile}\n- gamedata/configs/items/trade/arch_trade_*.ltx (if trade configured)\n`});

    return {blocks,files};
}