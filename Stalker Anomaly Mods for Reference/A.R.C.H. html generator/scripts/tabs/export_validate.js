// EXPORT VALIDATOR — in-browser structural checks
// ═══════════════════════════════════════════

function validateExportFiles(files){
    var issues=[];
    function add(sev,file,msg){issues.push({sev:sev,file:file,msg:msg});}

    // Classify files
    var archLtx=null, dialogXml=null, stringFiles=[], taskLtx=null;
    files.forEach(function(f){
        var name=f.path.split('/').pop().toLowerCase();
        if(name.startsWith('arch_pack_')&&name.endsWith('.ltx'))archLtx=f;
        else if(name.startsWith('dialogs_arch')&&name.endsWith('.xml'))dialogXml=f;
        else if(name.startsWith('st_arch')&&name.endsWith('.xml'))stringFiles.push(f);
        else if(name.startsWith('tm_arch')&&name.endsWith('.ltx'))taskLtx=f;
    });

    // ── Parse LTX ──
    function parseLtx(text){
        var sections={},cur=null;
        text.split('\n').forEach(function(raw){
            var line=raw.split(';')[0].trim();
            if(!line)return;
            var m=line.match(/^\[([^\]]+)\]/);
            if(m){cur=m[1].trim();sections[cur]=sections[cur]||{};return;}
            m=line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)/);
            if(m&&cur)sections[cur][m[1].trim()]=m[2].trim();
        });
        return sections;
    }

    // ── Parse XML string IDs ──
    function parseStringIds(xmlText){
        var ids=new Set();
        var re=/<string\s+id="([^"]+)"/g, m;
        while((m=re.exec(xmlText)))ids.add(m[1]);
        return ids;
    }

    // ── Parse dialog phrase structure (extended for binding chain checks) ──
    function parseDialogs(xmlText){
        var dialogs=[];
        var dRe=/<dialog\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/dialog>/g, dm;
        while((dm=dRe.exec(xmlText))){
            var did=dm[1], body=dm[2];
            // Dialog-level preconditions/info
            var dlgPreconds=[], dlgHasInfo=[], dlgDontHasInfo=[];
            // Extract dialog-level elements (before <phrase_list>)
            var plIdx=body.indexOf('<phrase_list');
            var dlgHead=plIdx>=0?body.substring(0,plIdx):body;
            var _dpm;
            var _dpRe=/<precondition>([^<]+)<\/precondition>/g;
            while((_dpm=_dpRe.exec(dlgHead)))dlgPreconds.push(_dpm[1].trim());
            var _dhRe=/<has_info>([^<]+)<\/has_info>/g;
            while((_dpm=_dhRe.exec(dlgHead)))dlgHasInfo.push(_dpm[1].trim());
            var _ddhRe=/<dont_has_info>([^<]+)<\/dont_has_info>/g;
            while((_dpm=_ddhRe.exec(dlgHead)))dlgDontHasInfo.push(_dpm[1].trim());

            var phrases={};
            var pRe=/<phrase\s+id="(\d+)"[^>]*>([\s\S]*?)<\/phrase>/g, pm;
            while((pm=pRe.exec(body))){
                var pid=parseInt(pm[1]);
                var pBody=pm[2];
                var hasText=/<text>/.test(pBody);
                var hasScriptText=/<script_text>/.test(pBody);
                var nexts=[], preconds=[], actions=[], hasInfo=[], dontHasInfo=[], giveInfo=[];
                var nRe=/<next>(\d+)<\/next>/g, nm;
                while((nm=nRe.exec(pBody)))nexts.push(parseInt(nm[1]));
                var aRe=/<action>([^<]+)<\/action>/g, am;
                while((am=aRe.exec(pBody)))actions.push(am[1].trim());
                var prRe=/<precondition>([^<]+)<\/precondition>/g, prm;
                while((prm=prRe.exec(pBody)))preconds.push(prm[1].trim());
                var hiRe=/<has_info>([^<]+)<\/has_info>/g, him;
                while((him=hiRe.exec(pBody)))hasInfo.push(him[1].trim());
                var dhiRe=/<dont_has_info>([^<]+)<\/dont_has_info>/g, dhim;
                while((dhim=dhiRe.exec(pBody)))dontHasInfo.push(dhim[1].trim());
                var giRe=/<give_info>([^<]+)<\/give_info>/g, gim;
                while((gim=giRe.exec(pBody)))giveInfo.push(gim[1].trim());
                var textSid='';
                var tRe=/<text>([^<]+)<\/text>/;
                var tm2=tRe.exec(pBody);
                if(tm2)textSid=tm2[1].trim();
                phrases[pid]={hasText:hasText,hasScriptText:hasScriptText,nexts:nexts,textSid:textSid,
                    actions:actions,preconds:preconds,hasInfo:hasInfo,dontHasInfo:dontHasInfo,giveInfo:giveInfo};
            }
            dialogs.push({id:did,phrases:phrases,preconds:dlgPreconds,hasInfo:dlgHasInfo,dontHasInfo:dlgDontHasInfo});
        }
        return dialogs;
    }

    // ── Validate arch LTX ──
    if(archLtx){
        var secs=parseLtx(archLtx.data);
        var meta=secs['arch_pack_meta'];
        if(!meta)add('CRITICAL',archLtx.path,'Missing [arch_pack_meta] section');
        else{
            if(!meta.pack_id)add('ERROR',archLtx.path,'[arch_pack_meta] missing pack_id');
        }

        var runtimePack=secs['arch_runtime_pack'];
        var declaredIds=runtimePack&&runtimePack.archetype_ids?runtimePack.archetype_ids.split(',').map(function(s){return s.trim();}).filter(Boolean):[];

        // Check each archetype section
        Object.keys(secs).forEach(function(sec){
            if(!sec.startsWith('arch_runtime_')||sec==='arch_runtime_pack')return;
            if(sec.startsWith('arch_global_block_'))return;
            var f=secs[sec];
            var aid=sec.replace('arch_runtime_','');

            // Placeholder leak
            var dids=f.dialog_ids||'';
            if(dids.indexOf('__DIALOG_IDS_')>=0)add('CRITICAL',archLtx.path,'['+sec+'] dialog_ids has unresolved placeholder: '+dids.substring(0,80));

            // Amount/tier/calendar
            if(f.amount){var n=parseInt(f.amount);if(isNaN(n)||n<1)add('ERROR',archLtx.path,'['+sec+'] amount='+f.amount+' (must be >= 1)');}
            if(f.tier){var t=parseInt(f.tier);if(!isNaN(t)&&(t<1||t>5))add('WARNING',archLtx.path,'['+sec+'] tier='+t+' (expected 1-5)');}
            if(f.available_after_days){var aad=parseInt(f.available_after_days);if(isNaN(aad)||aad<0)add('WARNING',archLtx.path,'['+sec+'] available_after_days='+f.available_after_days+' (must be >= 0)');}

            // Buy/sell range
            if(f.buy){var bv=parseFloat(f.buy);if(!isNaN(bv)&&bv<=0)add('ERROR',archLtx.path,'['+sec+'] buy='+f.buy+' (must be > 0)');}
            if(f.sell){var sv=parseFloat(f.sell);if(!isNaN(sv)&&sv<=0)add('ERROR',archLtx.path,'['+sec+'] sell='+f.sell+' (must be > 0)');}

            // Trade preset validation
            var knownPresets=['generic','scavenger','scientist','field_medic','quartermaster','gunsmith','artifact_broker','role_scavenger'];
            if(f.trade_preset&&knownPresets.indexOf(f.trade_preset.toLowerCase())<0)
                add('WARNING',archLtx.path,'['+sec+'] trade_preset="'+f.trade_preset+'" — unknown preset (known: '+knownPresets.join(', ')+')');

            // No ltx and no trade_preset = will get generic fallback
            if(!f.ltx&&!f.trade_preset)add('INFO',archLtx.path,'['+sec+'] has no ltx or trade_preset — will use generic trade profile');

            // Global block cross-ref
            if(f.global_block&&!secs['arch_global_block_'+f.global_block])add('ERROR',archLtx.path,'['+sec+'] global_block="'+f.global_block+'" but no [arch_global_block_'+f.global_block+'] section');

            // Community validation
            var knownFactions=['stalker','dolg','freedom','csky','ecolog','army','bandit','monolith','killer','renegade','greh','isg','zombied'];
            if(f.community_include){f.community_include.split(',').forEach(function(c){c=c.trim();if(c&&knownFactions.indexOf(c)<0)add('WARNING',archLtx.path,'['+sec+'] community_include has unknown faction "'+c+'"');});}

            // Location validation
            var knownLevels=['k00_marsh','l01_escape','l02_garbage','l03_agroprom','k01_darkscape','l04_darkvalley','l05_bar','l06_rostok','l07_military','l08_yantar','l09_deadcity','l10_limansk','l10_radar','l10_red_forest','l11_hospital','l11_pripyat','l12_stancia','l12_stancia_2','l13_generators','zaton','jupiter','pripyat','k02_trucks_cemetery'];
            if(f.location_include){f.location_include.split(',').forEach(function(l){l=l.trim();if(l&&knownLevels.indexOf(l)<0)add('WARNING',archLtx.path,'['+sec+'] location_include has unknown level "'+l+'"');});}

            // Cross-ref
            if(declaredIds.length&&declaredIds.indexOf(aid)<0)add('WARNING',archLtx.path,'['+sec+'] exists but not in archetype_ids');
        });

        // Check task sections
        Object.keys(secs).forEach(function(sec){
            if(!sec.startsWith('arch_task_')||sec.startsWith('arch_task_pool_'))return;
            var f=secs[sec];
            var kind=f.kind||f.type||'fetch';
            if(kind==='fetch'&&!f.item_section&&!f.items&&!f.item_category)
                add('ERROR',archLtx.path,'['+sec+'] fetch task has no item_section, items, or item_category');
            if(kind==='delivery'&&!f.deliver_item)
                add('ERROR',archLtx.path,'['+sec+'] delivery task missing deliver_item');
            if(kind==='delivery'&&!f.deliver_to_archetype)
                add('ERROR',archLtx.path,'['+sec+'] delivery task missing deliver_to_archetype');
            if(kind==='talk'&&!f.talk_to_archetype&&!f.talk_to_giver)
                add('ERROR',archLtx.path,'['+sec+'] talk task missing talk_to_archetype');
            if(kind==='collect'&&!f.collect_item&&!f.collect_items)
                add('ERROR',archLtx.path,'['+sec+'] collect task missing collect_item');
        });

        // Pool→task cross-ref + pool_tag validation
        var knownPoolTags=['default','pool_1','pool_2','pool_3','pool_4','pool_5','pool_6','pool_7','pool_8','pool_9','pool_10','slot_1','slot_2','slot_3','slot_4','slot_5','slot_6','slot_7','slot_8','slot_9','slot_10','slot_11','slot_12','slot_13','slot_14','slot_15','slot_16','slot_17','slot_18','slot_19','slot_20'];
        Object.keys(secs).forEach(function(sec){
            if(!sec.startsWith('arch_task_pool_'))return;
            var f=secs[sec];
            // Validate pool_tag against runtime's hardcoded binding list
            var tag=(f.pool_tag||'default').trim();
            if(tag!=='default'&&knownPoolTags.indexOf(tag)<0)
                add('ERROR',archLtx.path,'['+sec+'] pool_tag="'+tag+'" — not a registered runtime pool tag. Known tags: pool_1..10, slot_1..20, or any custom tag registered by a pack');
            if(f.task_ids){
                f.task_ids.split(',').forEach(function(tid){
                    tid=tid.trim();
                    if(tid&&!secs['arch_task_'+tid])add('ERROR',archLtx.path,'['+sec+'] task_ids references "'+tid+'" but no [arch_task_'+tid+'] section');
                });
            }
        });

        // ── Uniqueness checks ──
        var seenArchIds={};
        declaredIds.forEach(function(aid){
            if(seenArchIds[aid])add('ERROR',archLtx.path,'Duplicate archetype ID "'+aid+'" in archetype_ids');
            seenArchIds[aid]=true;
        });
        var seenTaskIds={};
        Object.keys(secs).forEach(function(sec){
            if(!sec.startsWith('arch_task_')||sec.startsWith('arch_task_pool_'))return;
            var tid=sec.replace('arch_task_','');
            if(seenTaskIds[tid])add('ERROR',archLtx.path,'Duplicate task ID "'+tid+'" across pools — later definition silently overwrites');
            seenTaskIds[tid]=true;
        });

        // ── Section name format ──
        Object.keys(secs).forEach(function(sec){
            if(/\s/.test(sec))add('CRITICAL',archLtx.path,'Section name ['+sec+'] contains whitespace');
            if(/[^a-zA-Z0-9_]/.test(sec))add('WARNING',archLtx.path,'Section name ['+sec+'] contains special characters');
        });

        // ── Task cross-references ──
        var allTaskIds=Object.keys(seenTaskIds);
        Object.keys(secs).forEach(function(sec){
            if(!sec.startsWith('arch_task_')||sec.startsWith('arch_task_pool_'))return;
            var f=secs[sec];
            var kind=f.kind||f.type||'fetch';
            var knownKinds=['fetch','delivery','talk','collect'];
            if(knownKinds.indexOf(kind)<0)add('ERROR',archLtx.path,'['+sec+'] kind="'+kind+'" — unknown (expected: '+knownKinds.join(', ')+')');
            if(f.on_complete_task&&!seenTaskIds[f.on_complete_task])add('WARNING',archLtx.path,'['+sec+'] on_complete_task="'+f.on_complete_task+'" — task not found in this pack');
            if(f.requires_task_done&&!seenTaskIds[f.requires_task_done])add('WARNING',archLtx.path,'['+sec+'] requires_task_done="'+f.requires_task_done+'" — task not found in this pack');
            if(kind==='delivery'&&f.deliver_to_archetype&&declaredIds.indexOf(f.deliver_to_archetype)<0)
                add('INFO',archLtx.path,'['+sec+'] deliver_to_archetype="'+f.deliver_to_archetype+'" — not in this pack (must exist in another pack or as story NPC)');
            if(kind==='talk'&&f.talk_to_archetype&&declaredIds.indexOf(f.talk_to_archetype)<0)
                add('INFO',archLtx.path,'['+sec+'] talk_to_archetype="'+f.talk_to_archetype+'" — not in this pack');
            if(kind==='collect'&&f.collect_from_archetype&&declaredIds.indexOf(f.collect_from_archetype)<0)
                add('INFO',archLtx.path,'['+sec+'] collect_from_archetype="'+f.collect_from_archetype+'" — not in this pack');
            if(f.reward_items){
                f.reward_items.split(',').forEach(function(entry){
                    entry=entry.trim();if(!entry)return;
                    if(!/^\w+:\d+$/.test(entry)&&!/^\w+$/.test(entry))
                        add('WARNING',archLtx.path,'['+sec+'] reward_items entry "'+entry+'" — expected format: section:amount or section');
                });
            }
        });

        // ── Pool with tasks but no matching dialog tree ──
        // (checked later in binding section)
    }

    // ── Validate dialog XML ──
    var allDialogIds=new Set();
    var allStringRefs=new Set();
    if(dialogXml){
        var dialogs=parseDialogs(dialogXml.data);
        dialogs.forEach(function(d){
            allDialogIds.add(d.id);
            var pids=Object.keys(d.phrases).map(Number);
            if(pids.indexOf(0)<0)add('CRITICAL',dialogXml.path,'Dialog "'+d.id+'": missing phrase id=0');

            Object.keys(d.phrases).forEach(function(pidStr){
                var pid=parseInt(pidStr);
                var ph=d.phrases[pid];
                if(!ph.hasText&&!ph.hasScriptText)add('CRITICAL',dialogXml.path,'Dialog "'+d.id+'" phrase '+pid+': no <text> or <script_text>');
                ph.nexts.forEach(function(nxt){
                    if(!d.phrases.hasOwnProperty(nxt))add('CRITICAL',dialogXml.path,'Dialog "'+d.id+'" phrase '+pid+': <next>'+nxt+'</next> references non-existent phrase');
                });
                if(ph.textSid&&ph.textSid!=='dm_universal_actor_exit')allStringRefs.add(ph.textSid);
            });

            // Orphan check
            var reachable=new Set();
            var queue=[0];
            while(queue.length){
                var cur=queue.pop();
                if(reachable.has(cur))continue;
                reachable.add(cur);
                var p=d.phrases[cur];
                if(p)p.nexts.forEach(function(n){queue.push(n);});
            }
            var orphans=pids.filter(function(p){return !reachable.has(p);});
            if(orphans.length)add('WARNING',dialogXml.path,'Dialog "'+d.id+'": '+orphans.length+' orphaned phrase(s): '+orphans.join(', '));
        });
    }

    // ── Validate strings ──
    var allDefinedSids=new Set();
    stringFiles.forEach(function(f){
        // Only check eng files (rus is a copy)
        if(f.path.indexOf('/eng/')<0)return;
        var sids=parseStringIds(f.data);
        sids.forEach(function(s){
            allDefinedSids.add(s);
            // String ID format check
            if(/\s/.test(s))add('ERROR',f.path.split('/').pop(),'String ID "'+s+'" contains whitespace — will break in-game');
            if(/[^a-zA-Z0-9_]/.test(s))add('WARNING',f.path.split('/').pop(),'String ID "'+s+'" contains special characters');
        });
        // Check for non-ASCII characters that survived sanitization
        var nonAscii=f.data.match(/[^\x00-\x7F]/g);
        if(nonAscii){
            var unique=[...new Set(nonAscii)].slice(0,5).map(function(c){return'U+'+c.charCodeAt(0).toString(16).toUpperCase();});
            add('WARNING',f.path.split('/').pop(),'Contains '+nonAscii.length+' non-ASCII character(s): '+unique.join(', ')+' — may display as garbled text in-game');
        }
        // XML well-formedness (basic check)
        if(f.data.indexOf('<string_table')<0)add('CRITICAL',f.path.split('/').pop(),'Missing <string_table> root element — invalid XML');
        var openTags=(f.data.match(/<string\s/g)||[]).length;
        var closeTags=(f.data.match(/<\/string>/g)||[]).length;
        if(openTags!==closeTags)add('ERROR',f.path.split('/').pop(),'Mismatched <string> tags: '+openTags+' opening vs '+closeTags+' closing');
    });
    // XML well-formedness for dialog XML
    if(dialogXml){
        if(dialogXml.data.indexOf('<game_dialogs')<0)add('CRITICAL',dialogXml.path,'Missing <game_dialogs> root element — invalid XML');
        var dOpen=(dialogXml.data.match(/<dialog\s/g)||[]).length;
        var dClose=(dialogXml.data.match(/<\/dialog>/g)||[]).length;
        if(dOpen!==dClose)add('ERROR',dialogXml.path,'Mismatched <dialog> tags: '+dOpen+' opening vs '+dClose+' closing');
        var pOpen=(dialogXml.data.match(/<phrase\s/g)||[]).length;
        var pClose=(dialogXml.data.match(/<\/phrase>/g)||[]).length;
        if(pOpen!==pClose)add('ERROR',dialogXml.path,'Mismatched <phrase> tags: '+pOpen+' opening vs '+pClose+' closing');
    }
    // Cross-ref: dialog text SIDs must exist in string tables
    allStringRefs.forEach(function(sid){
        if(!allDefinedSids.has(sid))add('ERROR','strings','String "'+sid+'" referenced by dialog but not defined in string XML');
    });

    // ── Cross-validate dialog_id references ──
    if(archLtx){
        var secs2=parseLtx(archLtx.data);
        var seenDialogIds={};
        Object.keys(secs2).forEach(function(sec){
            if(!sec.startsWith('arch_runtime_')||sec==='arch_runtime_pack')return;
            if(sec.startsWith('arch_global_block_'))return;
            var f=secs2[sec];
            if(f.dialog_id&&!allDialogIds.has(f.dialog_id))add('CRITICAL',archLtx.path,'['+sec+'] dialog_id="'+f.dialog_id+'" not found in dialog XML');
            if(f.dialog_ids&&f.dialog_ids.indexOf('__DIALOG_IDS_')<0){
                f.dialog_ids.split(',').forEach(function(did){
                    did=did.trim();
                    if(did&&!allDialogIds.has(did))add('ERROR',archLtx.path,'['+sec+'] dialog_ids references "'+did+'" not found in dialog XML');
                    // Duplicate dialog ID across archetypes
                    if(did){
                        if(seenDialogIds[did]&&seenDialogIds[did]!==sec)add('ERROR',archLtx.path,'Dialog "'+did+'" used by both ['+seenDialogIds[did]+'] and ['+sec+']');
                        seenDialogIds[did]=sec;
                    }
                });
            }
            // B10: intro_dialog ref
            if(f.intro_dialog&&!allDialogIds.has(f.intro_dialog))add('ERROR',archLtx.path,'['+sec+'] intro_dialog="'+f.intro_dialog+'" not found in dialog XML');
            // Intro dialog should give intro_done_info
            if(f.intro_dialog&&f.intro_done_info&&dialogXml){
                var introD=parseDialogs(dialogXml.data).find(function(d){return d.id===f.intro_dialog;});
                if(introD){
                    var givesInfo=false;
                    Object.keys(introD.phrases).forEach(function(pidStr){
                        var ph=introD.phrases[parseInt(pidStr)];
                        if(ph.giveInfo.indexOf(f.intro_done_info)>=0)givesInfo=true;
                    });
                    if(!givesInfo)add('WARNING',archLtx.path,'['+sec+'] intro_dialog="'+f.intro_dialog+'" never gives intro_done_info="'+f.intro_done_info+'" — intro will repeat every talk');
                }
            }
        });
    }

    // ═══ BINDING CHAIN CHECKS (B1-B14) ═══
    if(archLtx&&dialogXml){
        var bSecs=parseLtx(archLtx.data);
        var bDialogs=parseDialogs(dialogXml.data);

        // Build task/pool indexes
        var bTasks={};
        var bPools={};  // pool_id -> {archetype_id, pool_tag, task_ids}
        var tagToPools={};  // pool_tag -> [pool]
        Object.keys(bSecs).forEach(function(sec){
            if(sec.startsWith('arch_task_pool_')){
                var poolId=sec.replace('arch_task_pool_','');
                var f=bSecs[sec];
                var tids=(f.task_ids||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
                var pool={archetype_id:f.archetype_id||'',pool_tag:f.pool_tag||'default',task_ids:tids};
                bPools[poolId]=pool;
                tagToPools[pool.pool_tag]=tagToPools[pool.pool_tag]||[];
                tagToPools[pool.pool_tag].push(pool);
            }
            if(sec.startsWith('arch_task_')&&!sec.startsWith('arch_task_pool_')){
                var tid=sec.replace('arch_task_','');
                bTasks[tid]=bSecs[sec];
                bTasks[tid]._id=tid;
            }
        });

        var bArchetypes={};
        Object.keys(bSecs).forEach(function(sec){
            if(sec.startsWith('arch_runtime_')&&sec!=='arch_runtime_pack'&&!sec.startsWith('arch_global_block_'))
                bArchetypes[sec.replace('arch_runtime_','')]=bSecs[sec];
        });

        // Collect all actions and preconditions from dialogs
        var tasksWithAccept={};
        var tasksWithCollect={};
        var tasksWithDelivery={};
        var slotsWithTryComplete={};

        bDialogs.forEach(function(d){
            Object.keys(d.phrases).forEach(function(pidStr){
                var ph=d.phrases[parseInt(pidStr)];
                var loc=d.id+' ph:'+pidStr;

                ph.actions.forEach(function(action){
                    var m;
                    // B1: arch_accept_<task_id>
                    m=action.match(/^dialogs\.arch_accept_(\w+)$/);
                    if(m){
                        tasksWithAccept[m[1]]=true;
                        if(!bTasks[m[1]])add('ERROR','bindings','['+loc+'] arch_accept_'+m[1]+' — task not found in LTX');
                    }
                    // B2: arch_collect_pickup_<task_id>
                    m=action.match(/^dialogs\.arch_collect_pickup_(\w+)$/);
                    if(m){
                        tasksWithCollect[m[1]]=true;
                        if(!bTasks[m[1]])add('ERROR','bindings','['+loc+'] arch_collect_pickup_'+m[1]+' — task not found');
                        else if((bTasks[m[1]].kind||'fetch')!=='collect')add('ERROR','bindings','['+loc+'] arch_collect_pickup_'+m[1]+' — task kind is "'+bTasks[m[1]].kind+'", expected "collect"');
                    }
                    // B3: arch_delivery_complete_<task_id>
                    m=action.match(/^dialogs\.arch_delivery_complete_(\w+)$/);
                    if(m){
                        tasksWithDelivery[m[1]]=true;
                        if(!bTasks[m[1]])add('ERROR','bindings','['+loc+'] arch_delivery_complete_'+m[1]+' — task not found');
                        else if((bTasks[m[1]].kind||'fetch')!=='delivery')add('ERROR','bindings','['+loc+'] arch_delivery_complete_'+m[1]+' — task kind is "'+bTasks[m[1]].kind+'", expected "delivery"');
                    }
                    // B4: arch_cancel_<task_id>
                    m=action.match(/^dialogs\.arch_cancel_(\w+)$/);
                    if(m&&!bTasks[m[1]])add('WARNING','bindings','['+loc+'] arch_cancel_'+m[1]+' — task not found');
                    // B9: arch_task_try_complete_<slot>
                    m=action.match(/^dialogs\.arch_task_try_complete_(\w+)$/);
                    if(m){
                        slotsWithTryComplete[m[1]]=true;
                        if(!tagToPools[m[1]])add('ERROR','bindings','['+loc+'] arch_task_try_complete_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                    }
                    // B9: arch_task_deliver_rewards_<slot>
                    m=action.match(/^dialogs\.arch_task_deliver_rewards_(\w+)$/);
                    if(m&&!tagToPools[m[1]])add('ERROR','bindings','['+loc+'] arch_task_deliver_rewards_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                    // B9: arch_task_accept_<slot>
                    m=action.match(/^dialogs\.arch_task_accept_(\w+)$/);
                    if(m&&!tagToPools[m[1]])add('WARNING','bindings','['+loc+'] arch_task_accept_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                    // B9: arch_task_decline_<slot>
                    m=action.match(/^dialogs\.arch_task_decline_(\w+)$/);
                    if(m&&!tagToPools[m[1]])add('WARNING','bindings','['+loc+'] arch_task_decline_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                });

                ph.preconds.forEach(function(precond){
                    var m;
                    // B5: arch_task_ready_<slot>
                    m=precond.match(/^dialogs\.arch_task_ready_(\w+)$/);
                    if(m&&!tagToPools[m[1]])add('ERROR','bindings','['+loc+'] arch_task_ready_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                    // B6: arch_is_task_active(<task_id>)
                    m=precond.match(/^dialogs\.arch_is_task_active\((\w+)\)$/);
                    if(m&&!bTasks[m[1]])add('WARNING','bindings','['+loc+'] arch_is_task_active('+m[1]+') — task not found');
                    // B6: arch_is_task_done(<task_id>)
                    m=precond.match(/^dialogs\.arch_is_task_done\((\w+)\)$/);
                    if(m&&!bTasks[m[1]])add('WARNING','bindings','['+loc+'] arch_is_task_done('+m[1]+') — task not found');
                    // B6: arch_can_offer_task(<task_id>)
                    m=precond.match(/^dialogs\.arch_can_offer_task\((\w+)\)$/);
                    if(m&&!bTasks[m[1]])add('WARNING','bindings','['+loc+'] arch_can_offer_task('+m[1]+') — task not found');
                    // B7: arch_has_task_pool_<slot>
                    m=precond.match(/^dialogs\.arch_has_task_pool_(\w+)$/);
                    if(m&&!tagToPools[m[1]])add('ERROR','bindings','['+loc+'] arch_has_task_pool_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                    // B7: arch_has_active_task_<slot>
                    m=precond.match(/^dialogs\.arch_has_active_task_(\w+)$/);
                    if(m&&!tagToPools[m[1]])add('ERROR','bindings','['+loc+'] arch_has_active_task_'+m[1]+' — no pool with pool_tag="'+m[1]+'"');
                    // B8: arch_is_<archetype>
                    m=precond.match(/^dialogs\.arch_is_(\w+)$/);
                    if(m){
                        var cand=m[1];
                        if(cand.indexOf('task_')!==0&&cand!=='delivery_target'&&cand!=='first_visit'&&cand!=='returning'&&cand!=='regular'){
                            if(!bArchetypes[cand])add('INFO','bindings','['+loc+'] arch_is_'+cand+' — archetype not in this pack');
                        }
                    }
                });
            });
        });

        // B13: Flow completeness — delivery tasks must have delivery_complete, collect must have collect_pickup
        Object.keys(bTasks).forEach(function(tid){
            var kind=bTasks[tid].kind||'fetch';
            if(kind==='delivery'&&!tasksWithDelivery[tid])
                add('ERROR','bindings','Task "'+tid+'" (delivery) has no arch_delivery_complete_'+tid+' action in any dialog — delivery can never complete');
            if(kind==='collect'&&!tasksWithCollect[tid])
                add('ERROR','bindings','Task "'+tid+'" (collect) has no arch_collect_pickup_'+tid+' action in any dialog — items can never be picked up');
        });

        // B15: Accept without turnin / turnin without accept (pool-tag level)
        var slotsWithAccept={};
        bDialogs.forEach(function(d){
            Object.keys(d.phrases).forEach(function(pidStr){
                d.phrases[parseInt(pidStr)].actions.forEach(function(a){
                    var m=a.match(/^dialogs\.arch_task_accept_(\w+)$/);
                    if(m)slotsWithAccept[m[1]]=true;
                });
            });
        });
        Object.keys(slotsWithAccept).forEach(function(tag){
            if(!slotsWithTryComplete[tag])add('WARNING','bindings','Pool "'+tag+'" has arch_task_accept but no arch_task_try_complete — accepted tasks cannot be turned in');
        });
        Object.keys(slotsWithTryComplete).forEach(function(tag){
            if(!slotsWithAccept[tag])add('WARNING','bindings','Pool "'+tag+'" has arch_task_try_complete but no arch_task_accept — tasks cannot be accepted');
        });

        // B16: Leaf phrases (no next, no action) that silently dead-end
        bDialogs.forEach(function(d){
            Object.keys(d.phrases).forEach(function(pidStr){
                var pid=parseInt(pidStr);
                var ph=d.phrases[pid];
                if(pid===0)return; // phrase 0 is NPC opener, always has next
                if(!ph.nexts.length&&!ph.actions.length&&ph.hasText&&!ph.hasScriptText){
                    add('INFO','dialog','Dialog "'+d.id+'" phrase '+pid+': leaf node (no <next>, no <action>) — dialog ends silently here');
                }
            });
        });

        // B17: Pool has tasks but zero dialog bindings reference its pool_tag
        Object.keys(tagToPools).forEach(function(tag){
            if(tag==='default')return;
            var hasBinding=false;
            bDialogs.forEach(function(d){
                Object.keys(d.phrases).forEach(function(pidStr){
                    var ph=d.phrases[parseInt(pidStr)];
                    ph.preconds.concat(ph.actions).forEach(function(s){
                        if(s.indexOf('_'+tag)>=0)hasBinding=true;
                    });
                });
            });
            if(!hasBinding){
                var totalTasks=0;
                tagToPools[tag].forEach(function(p){totalTasks+=p.task_ids.length;});
                if(totalTasks>0)add('WARNING','bindings','Pool tag "'+tag+'" has '+totalTasks+' task(s) but no dialog references it — tasks will never be offered');
            }
        });

        // B14: Info portion consistency
        var infoGiven={}, infoChecked={};
        bDialogs.forEach(function(d){
            d.hasInfo.forEach(function(i){infoChecked[i]=true;});
            d.dontHasInfo.forEach(function(i){infoChecked[i]=true;});
            Object.keys(d.phrases).forEach(function(pidStr){
                var ph=d.phrases[parseInt(pidStr)];
                ph.giveInfo.forEach(function(i){infoGiven[i]=true;});
                ph.hasInfo.forEach(function(i){infoChecked[i]=true;});
                ph.dontHasInfo.forEach(function(i){infoChecked[i]=true;});
            });
        });
        // Also count infos from LTX (intro_done_info, on_death_info)
        Object.keys(bArchetypes).forEach(function(aid){
            var a=bArchetypes[aid];
            if(a.intro_done_info)infoGiven[a.intro_done_info]=true;
            if(a.on_death_info)infoGiven[a.on_death_info]=true;
        });
        Object.keys(infoChecked).forEach(function(info){
            if(!infoGiven[info]){
                // Skip vanilla/engine info portions
                if(/^(npc_|bar_|story_|actor_|sim_|esc_|agr_|val_|mil_)/.test(info))return;
                add('WARNING','bindings','Info portion "'+info+'" is checked (has_info/dont_has_info) but never given (give_info) in this pack');
            }
        });
    }

    return issues;
}

function renderValidationResults(issues,container){
    if(!issues.length){
        container.innerHTML='<div style="color:#4caf50;font-size:13px;padding:10px 14px;background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.3);border-radius:4px;margin-bottom:12px">&#10003; Export validation passed — no issues found.</div>';
        return;
    }
    var bySev={CRITICAL:[],ERROR:[],WARNING:[],INFO:[]};
    issues.forEach(function(i){(bySev[i.sev]||(bySev.INFO=bySev.INFO||[])).push(i);});
    var sevColors={CRITICAL:'#e05050',ERROR:'#ffb74d',WARNING:'#888',INFO:'#82b1ff'};
    var html='<div style="background:#1e1e1e;border:1px solid #444;border-radius:4px;padding:12px 14px;margin-bottom:12px">';
    html+='<div style="font-size:13px;font-weight:bold;color:#ccc;margin-bottom:8px">Export Validation</div>';
    ['CRITICAL','ERROR','WARNING','INFO'].forEach(function(sev){
        var items=bySev[sev];
        if(!items||!items.length)return;
        var color=sevColors[sev];
        html+='<div style="margin-bottom:6px"><span style="color:'+color+';font-weight:bold;font-size:11px">'+sev+' ('+items.length+')</span></div>';
        items.forEach(function(i){
            var fname=i.file.split('/').pop();
            html+='<div style="color:'+color+';font-size:11px;padding:2px 0 2px 12px">'+esc(fname)+': '+esc(i.msg)+'</div>';
        });
    });
    var c=issues.filter(function(i){return i.sev==='CRITICAL';}).length;
    var e=issues.filter(function(i){return i.sev==='ERROR';}).length;
    html+='<div style="margin-top:8px;font-size:12px;color:#999">'+issues.length+' issue(s)';
    if(c)html+=' — <span style="color:#e05050">'+c+' critical</span>';
    if(e)html+=' — <span style="color:#ffb74d">'+e+' error</span>';
    html+='</div></div>';
    container.innerHTML=html;
}

