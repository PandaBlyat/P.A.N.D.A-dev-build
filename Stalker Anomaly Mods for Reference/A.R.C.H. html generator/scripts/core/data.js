// ═══════════════════════════════════════════
// STABLE MODE — hides experimental features (tasks, bindings, interactive editor)
// Toggle: type ARCH.stableMode(false) in browser console to unlock
// ═══════════════════════════════════════════
var _archStableMode=(localStorage.getItem('arch_stable_mode')!=='false');
if(_archStableMode)document.documentElement.classList.add('stable-mode');
window.ARCH={stableMode:function(on){_archStableMode=(on!==false);localStorage.setItem('arch_stable_mode',on!==false?'true':'false');if(_archStableMode)document.documentElement.classList.add('stable-mode');else document.documentElement.classList.remove('stable-mode');location.reload();}};

// ═══════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════
const COMM=[['stalker','Loners'],['freedom','Freedom'],['dolg','Duty'],['ecolog','Ecologists'],['bandit','Bandits'],['killer','Mercenaries'],['army','Military'],['monolith','Monolith'],['csky','Clear Sky'],['renegade','Renegades'],['greh','Sin'],['isg','ISG']];
const LOCS=[['k00_marsh','Swamps'],['l01_escape','Cordon'],['l02_garbage','Garbage'],['l03_agroprom','Agroprom'],['k01_darkscape','Darkscape'],['l04_darkvalley','Dark Valley'],['l05_bar','Bar'],['l06_rostok','Wild Territory'],['l07_military','Army Warehouses'],['l08_yantar','Yantar'],['l09_deadcity','Dead City'],['l10_limansk','Limansk'],['l10_radar','Radar'],['l10_red_forest','Red Forest'],['l11_hospital','Hospital'],['l11_pripyat','Pripyat'],['l12_stancia','CNPP'],['l13_generators','Generators'],['jupiter','Jupiter'],['zaton','Zaton'],['pripyat','Pripyat Underground'],['labx8','Lab X-8'],['k02_trucks_cemetery','Truck Cemetery']];
const RANKS_D=[['novice','Novice'],['trainee','Trainee'],['experienced','Experienced'],['professional','Professional'],['veteran','Veteran'],['expert','Expert'],['master','Master'],['legend','Legend']];
const SMART_TERRAINS={'jupiter':["depo_terrain","jup_a10_smart_terrain","jup_a12","jup_a12_merc","jup_a6","jup_a9","jup_b1","jup_b19","jup_b200","jup_b200_tushkan_smart_terrain","jup_b202","jup_b203","jup_b204","jup_b205_smart_terrain","jup_b205_smart_terrain_tushkano","jup_b206","jup_b207","jup_b207_depot_attack","jup_b208","jup_b209","jup_b211","jup_b212","jup_b219","jup_b25","jup_b32","jup_b4","jup_b41","jup_b46","jup_b47","jup_b6_anom_2","jup_b8_smart_terrain","jup_sim_1","jup_sim_10","jup_sim_11","jup_sim_12","jup_sim_13","jup_sim_14","jup_sim_15","jup_sim_16","jup_sim_17","jup_sim_18","jup_sim_19","jup_sim_2","jup_sim_20","jup_sim_21","jup_sim_3","jup_sim_4","jup_sim_5","jup_sim_6","jup_sim_7","jup_sim_8","jup_sim_9"],'k00_marsh':["mar_smart_terrain_10_10","mar_smart_terrain_10_5","mar_smart_terrain_10_7","mar_smart_terrain_11_11","mar_smart_terrain_11_3","mar_smart_terrain_12_2","mar_smart_terrain_3_10","mar_smart_terrain_3_3","mar_smart_terrain_3_7","mar_smart_terrain_4_5","mar_smart_terrain_4_7","mar_smart_terrain_5_12","mar_smart_terrain_5_8","mar_smart_terrain_6_10","mar_smart_terrain_6_11","mar_smart_terrain_6_4","mar_smart_terrain_6_7","mar_smart_terrain_6_8","mar_smart_terrain_7_3","mar_smart_terrain_7_7","mar_smart_terrain_8_11","mar_smart_terrain_8_4","mar_smart_terrain_8_8","mar_smart_terrain_8_9","mar_smart_terrain_base","mar_smart_terrain_doc","mar_smart_terrain_doc_2"],'k01_darkscape':["dar_angar","dar_control_poltergeist","dar_military_scout","dar_poltergeist_ring","dar_poltergeist_tele","dar_poltergeist_tele_round","dar_smart_snork","ds2_domik_st","ds2_lager_st","ds2_st_dogs","ds2_st_hoofs","ds_boars_nest","ds_deb1","ds_grverfer2","ds_kem1","ds_kem2","ds_kem3","ds_ptr","ds_ptr2","ds_ptr3","ds_ptr4","katacomb_smart_terrain","zombie_smart_ds_mlr_1","zombie_smart_ds_mlr_2"],'k02_trucks_cemetery':["trc_sim_1","trc_sim_10","trc_sim_11","trc_sim_12","trc_sim_13","trc_sim_14","trc_sim_15","trc_sim_16","trc_sim_17","trc_sim_18","trc_sim_19","trc_sim_2","trc_sim_20","trc_sim_21","trc_sim_3","trc_sim_4","trc_sim_5","trc_sim_6","trc_sim_7","trc_sim_8","trc_sim_9"],'l01_escape':["esc_smart_terrain_1_11","esc_smart_terrain_2_12","esc_smart_terrain_2_14","esc_smart_terrain_3_16","esc_smart_terrain_3_7","esc_smart_terrain_4_11","esc_smart_terrain_4_13","esc_smart_terrain_4_9","esc_smart_terrain_5_12","esc_smart_terrain_5_2","esc_smart_terrain_5_4","esc_smart_terrain_5_6","esc_smart_terrain_5_7","esc_smart_terrain_5_9","esc_smart_terrain_6_6","esc_smart_terrain_6_8","esc_smart_terrain_7_11","esc_smart_terrain_8_10","esc_smart_terrain_8_9","esc_smart_terrain_9_10","esc_smart_terrain_9_7","mlr_terrain"],'l02_garbage':["gar_smart_terrain_1_5","gar_smart_terrain_1_7","gar_smart_terrain_2_4","gar_smart_terrain_3_5","gar_smart_terrain_3_7","gar_smart_terrain_4_2","gar_smart_terrain_4_5","gar_smart_terrain_5_2","gar_smart_terrain_5_4","gar_smart_terrain_5_5","gar_smart_terrain_5_6","gar_smart_terrain_5_8","gar_smart_terrain_6_1","gar_smart_terrain_6_3","gar_smart_terrain_6_6","gar_smart_terrain_6_7","gar_smart_terrain_7_4","gar_smart_terrain_8_3","gar_smart_terrain_8_5"],'l03_agroprom':["agr_smart_terrain_1_2","agr_smart_terrain_1_3","agr_smart_terrain_1_6","agr_smart_terrain_1_6_near_1","agr_smart_terrain_1_6_near_2","agr_smart_terrain_2_2","agr_smart_terrain_4_4","agr_smart_terrain_4_4_near_1","agr_smart_terrain_4_4_near_2","agr_smart_terrain_4_4_near_3","agr_smart_terrain_4_6","agr_smart_terrain_5_2","agr_smart_terrain_5_3","agr_smart_terrain_5_4","agr_smart_terrain_5_7","agr_smart_terrain_6_4","agr_smart_terrain_6_6","agr_smart_terrain_7_4","agr_smart_terrain_7_5","agr_u_bandits","agr_u_bloodsucker","agr_u_bloodsucker_2","agr_u_monsters","agr_u_soldiers"],'l04_darkvalley':["val_smart_terrain_1_2","val_smart_terrain_3_0","val_smart_terrain_4_0","val_smart_terrain_5_10","val_smart_terrain_5_7","val_smart_terrain_5_8","val_smart_terrain_6_4","val_smart_terrain_6_5","val_smart_terrain_7_11","val_smart_terrain_7_3","val_smart_terrain_7_4","val_smart_terrain_7_5","val_smart_terrain_7_8","val_smart_terrain_8_6","val_smart_terrain_8_7","val_smart_terrain_8_9","val_smart_terrain_9_10","val_smart_terrain_9_2","val_smart_terrain_9_4","val_smart_terrain_9_6"],'l05_bar':["bar_dolg_bunker","bar_dolg_general","bar_visitors","bar_zastava","bar_zastava_2","bar_zastava_dogs_lair","bar_zastava_dogs_lair_2"],'l06_rostok':["ros_smart_killers1","ros_smart_monster4","ros_smart_monster5","ros_smart_monster7","ros_smart_poltergeist2","ros_smart_snork1","ros_smart_stalker1","ros_smart_stalker_killers1"],'l07_military':["mil_smart_terrain_2_1","mil_smart_terrain_2_10","mil_smart_terrain_2_2","mil_smart_terrain_2_4","mil_smart_terrain_2_6","mil_smart_terrain_3_8","mil_smart_terrain_4_2","mil_smart_terrain_4_3","mil_smart_terrain_4_5","mil_smart_terrain_4_7","mil_smart_terrain_4_8","mil_smart_terrain_7_10","mil_smart_terrain_7_12","mil_smart_terrain_7_4","mil_smart_terrain_7_7","mil_smart_terrain_7_8","mil_smart_terrain_8_3"],'l08_yantar':["yan_smart_terrain_1_6","yan_smart_terrain_2_4","yan_smart_terrain_2_5","yan_smart_terrain_3_4","yan_smart_terrain_3_6","yan_smart_terrain_4_2","yan_smart_terrain_4_4","yan_smart_terrain_4_5","yan_smart_terrain_5_3","yan_smart_terrain_5_5","yan_smart_terrain_6_2","yan_smart_terrain_6_4","yan_smart_terrain_snork_u","yan_smart_terrain_zombi_spawn"],'l09_deadcity':["cit_bandits","cit_bandits_2","cit_kanaliz1","cit_kanaliz2","cit_killers","cit_killers_2","cit_killers_vs_bandits"],'l10_limansk':["lim_smart_terrain_1","lim_smart_terrain_10","lim_smart_terrain_3","lim_smart_terrain_4","lim_smart_terrain_5","lim_smart_terrain_6","lim_smart_terrain_7","lim_smart_terrain_8","lim_smart_terrain_9"],'l10_radar':["rad2_loner_0000","rad2_loner_0001","rad2_loner_0002","rad2_prip_teleport","rad2_rad_prip_road","rad_after_valley","rad_antenna_camper","rad_antenna_monolith","rad_antenna_patrol","rad_bloodsucker","rad_entrance","rad_freedom_vs_duty","rad_pseudodogs","rad_rusty_forest_center","rad_snork1","rad_snork2","rad_valley","rad_valley_dogs","rad_zombied1","rad_zombied2"],'l10_red_forest':["red_bridge_bandit_smart_skirmish","red_smart_terrain_3_1","red_smart_terrain_3_2","red_smart_terrain_3_3","red_smart_terrain_4_2","red_smart_terrain_4_3","red_smart_terrain_4_5","red_smart_terrain_5_5","red_smart_terrain_5_6","red_smart_terrain_6_3","red_smart_terrain_6_6","red_smart_terrain_bridge","red_smart_terrain_monsters","red_smart_terrain_monsters_2","red_smart_terrain_monsters_3"],'l11_pripyat':["bun2_st_bloodsucker","bun2_tushkano_lair","bun_krovosos_nest","hotel_poless_smart_alife","kbo_terrain","monolith_snipers_smart_1_mlr","pol_sim_1","pol_smart_terrain_1_1","pol_smart_terrain_1_2","pol_smart_terrain_1_3","pol_smart_terrain_2_1","pol_smart_terrain_2_2","pri_a15","pri_a16","pri_a17","pri_a18_smart_terrain","pri_a20","pri_a21_smart_terrain","pri_a22_smart_terrain","pri_a25_smart_terrain","pri_a28_arch","pri_a28_base","pri_a28_evac","pri_a28_heli","pri_a28_school","pri_a28_shop","pri_b301","pri_b302","pri_b303","pri_b304","pri_b304_monsters_smart_terrain","pri_b305_dogs","pri_b306","pri_b307","pri_b35_mercs","pri_b35_military","pri_b36_smart_terrain","pri_depot","pri_monolith","pri_sim_1","pri_sim_10","pri_sim_11","pri_sim_12","pri_sim_2","pri_sim_3","pri_sim_4","pri_sim_5","pri_sim_6","pri_sim_7","pri_sim_8","pri_sim_9","pri_smart_bloodsucker_lair1","pri_smart_controler_lair1","pri_smart_controler_lair2","pri_smart_giant_lair1","pri_smart_monolith_stalker2","pri_smart_monolith_stalker3","pri_smart_monolith_stalker4","pri_smart_monolith_stalker6","pri_smart_monster_lair1","pri_smart_neutral_stalker1","pri_smart_pseudodog_lair1","pri_smart_snork_lair1","pri_smart_snork_lair2","pri_smart_tushkano_lair1"],'l12_stancia':["aes2_monolith_camp1","aes2_monolith_camp2","aes2_monolith_camp3","aes2_monolith_camp4","aes2_monolith_snipers_1","aes2_monolith_snipers_2","aes2_monolith_snipers_3","aes2_monsters1","aes2_monsters2","aes_smart_terrain_monolit_blockpost","aes_smart_terrain_monolit_blockpost2","aes_smart_terrain_monolit_blockpost4","aes_smart_terrain_monsters1","aes_smart_terrain_monsters2","aes_smart_terrain_monsters3","aes_smart_terrain_monsters4","aes_smart_terran_soldier","aes_smart_terran_soldier2","sar_monolith_bloodsuckers","sar_monolith_general","sar_monolith_guard","sar_monolith_poltergeists","sar_monolith_sklad","sar_monolith_zombies"],'l13_generators':["gen_smart_terrain_cemetery","gen_smart_terrain_forest","gen_smart_terrain_junk","gen_smart_terrain_lab_entrance","gen_smart_terrain_lab_entrance_2","gen_smart_terrain_military","gen_smart_terrain_urod","warlab_common_consciousness_smart_terrain"],'labx8':["lx8_smart_terrain","x162_st_burer","x162_st_gigant","x162_st_poltergeist","x162_st_snork"],'pripyat':["pas_b400_canalisation","pas_b400_downstairs","pas_b400_elevator","pas_b400_fake","pas_b400_hall","pas_b400_track","pas_b400_tunnel","pas_b400_way"],'zaton':["zat_a1","zat_a23_smart_terrain","zat_b100","zat_b101","zat_b103_merc_smart","zat_b104_zombied","zat_b106_smart_terrain","zat_b12","zat_b14_smart_terrain","zat_b18","zat_b20_smart_terrain","zat_b28","zat_b33","zat_b38","zat_b38u","zat_b39","zat_b40_smart_terrain","zat_b42_smart_terrain","zat_b52","zat_b53","zat_b54","zat_b55","zat_b56","zat_b5_smart_terrain","zat_b7","zat_b7_stalker_raider","zat_medic_home_smart","zat_sim_1","zat_sim_10","zat_sim_11","zat_sim_12","zat_sim_13","zat_sim_14","zat_sim_15","zat_sim_16","zat_sim_17","zat_sim_18","zat_sim_19","zat_sim_2","zat_sim_20","zat_sim_21","zat_sim_22","zat_sim_23","zat_sim_24","zat_sim_25","zat_sim_26","zat_sim_27","zat_sim_28","zat_sim_29","zat_sim_3","zat_sim_30","zat_sim_4","zat_sim_5","zat_sim_6","zat_sim_7","zat_sim_8","zat_sim_9","zat_stalker_base_smart"]};

function _debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}
let _debouncedLint=()=>{};  // replaced after runTradeLoadoutLint is defined

const DEFAULT_SETTINGS={namePrefix:'',nameFullName:'',nameSuffix:'',commMode:'inc',commVals:[],commExcVals:[],locMode:'inc',locVals:[],locExcVals:[],rankMode:'inc',rankVals:[],rankExcVals:[],male:true,female:false,buyMod:'0.85',sellMod:'1.15',ltxPath:'',amount:'1',tier:'3',chance:'100',availableAfterDays:'0',respawn:true,dialogProfile:'',dialogPriority:'1',specialization:'',dialogIdsCsv:'',spawnInherit:'',spawnPrimary:'',spawnSecondary:'',spawnExtra:'',enabled:true,newsOnDeath:'',newsOnArea:'',newsIcon:'',stripCategories:[],dialogRemove:'',dialogAdd:'',tradePreset:'',goodwillMode:'',regularVisitThreshold:'',buyModPerTrust:'',sellModPerTrust:'',assignTo:'',mapSpot:'',smartTerrainInclude:'',smartTerrainExclude:'',goodwill:'',onDeathInfo:''};
// Default tab visibility for NEW archetypes — these tabs start hidden in the UI
// but are NOT exported as strip_dialog_categories unless the user edits a vanilla tree
const DEFAULT_STRIP_UI=['trade','tasks','info'];
const VANILLA_EDITABLE_CATS=['info'];
const STRIP_CATEGORIES=[
    {id:'trade',label:'Trade',desc:'dm_init_stalker_trade, dm_add_trade'},
    {id:'tasks',label:'Tasks',desc:'dm_ordered_task_dialog, dm_ordered_task_dialog2, etc.'},
    {id:'info',label:'Info',desc:'dm_encyclopedia_dialog, dm_storyline_dialog, dm_custom_story_dialog'},
    {id:'wounded',label:'Wounded',desc:'Wounded NPC greeting — what the NPC says when injured'}
];
function isVanillaCatEditable(catId){return VANILLA_EDITABLE_CATS.indexOf(catId)>=0;}
const DIALOG_ACTIONS=[
    {id:'',label:'— No Action —'},
    {id:'dialogs.npc_is_trader',label:'Open Trade Window',category:'trade',note:'npc:start_trade(db.actor)'},
    {id:'dialogs.npc_is_tech',label:'Open Repair/Upgrade UI',category:'repair',note:'npc:start_upgrade(db.actor)',spec:'technician'},
    {id:'dialogs.heal_actor_injury',label:'Heal Player Health',category:'medic',note:'Heals health, power, bleeding (costs 1850 RU)',spec:'medic'},
    {id:'dialogs.heal_actor_radiation',label:'Heal Player Radiation',category:'medic',note:'Removes radiation (costs 1480 RU)',spec:'medic'},
    {id:'dialogs.npc_give_task',label:'Give First Available Task',category:'tasks',note:'Gives top task from axr_task_manager stack'},
    {id:'dialogs.generate_available_tasks',label:'Generate Task List (call before Give)',category:'tasks',note:'Populates available_tasks for NPC'}
];
const VANILLA_DIALOG_DEFAULTS={
    trade:{
        opener:'Got anything to sell?',
        hub:'Alright.',
        hubChoices:[
            {text:'[Trade]',next:'__end__',action:'dialogs.npc_is_trader'}
        ],
        nodes:{}
    },
    tasks:{
        opener:'Got any work for me?',
        hub:'I know where someone hid a good stash. If you find a PDA in there bring it to me, I\'ll pay you for it. Anything else you find is yours.',
        hubChoices:[
            {text:'I\'ll do it.',next:'task_accept',action:'dialogs.npc_give_task'},
            {text:'Have anything else?',next:'task_none'},
            {text:'Never mind.',next:'__end__'}
        ],
        nodes:{
            task_accept:{npc:'Good! Talk to me again when it\'s done.',label:'Task Accepted',choices:[{text:'Thanks.',next:'__end__'}]},
            task_none:{npc:'Sorry, don\'t have anything.',label:'No More Tasks',choices:[{text:'Never mind.',next:'__end__'}]}
        }
    },
    info:{
        opener:'I want to ask you something.',
        hub:'About what?',
        hubChoices:[
            {text:'I\'m looking for work.',next:'info_work'},
            {text:'What can you tell me about anomalies or artefacts?',next:'info_anomalies'},
            {text:'You know what\'s going on around here?',next:'info_news'},
            {text:'How do you manage to stay alive here?',next:'info_survival'},
            {text:'Never mind.',next:'__end__'}
        ],
        nodes:{
            info_work:{npc:'Well, if the local traders don\'t have anything for you, maybe try the regular guys? Most of them need help with one thing or another.',label:'Work',choices:[{text:'I want to ask you something.',next:'__hub__'}]},
            info_anomalies:{npc:'You ever seen a Vortex, man? They\'re damned near invisible, but one foot too close, and they\'ll pull you in and splatter you all over the place.',label:'Anomalies',choices:[{text:'I want to ask you something.',next:'__hub__'}]},
            info_news:{npc:'I don\'t have any information.',label:'News',choices:[{text:'I want to ask you something.',next:'__hub__'}]},
            info_survival:{npc:'You can keep asking the same shit, but I got nothing more to say.',label:'Survival',choices:[{text:'I want to ask you something.',next:'__hub__'}]}
        }
    },
    wounded:{
        opener:'Help me...',
        hub:'I\'m hurt bad... got a medkit?',
        hubChoices:[
            {text:'Here, take this.',next:'__end__',precondition:'dialogs.actor_have_medkit',action:'dialogs.transfer_medkit'},
            {text:'Sorry, can\'t help.',next:'__end__',precondition:'dialogs.actor_hasnt_medkit'}
        ],
        nodes:{}
    },
    companion:{
        opener:'I could use some backup out here.',
        hub:'What do you need?',
        hubChoices:[
            {text:'Come with me.',next:'__end__',precondition:'dialogs.arch_can_recruit',action:'dialogs.arch_recruit_companion'},
            {text:'You can go now.',next:'__end__',precondition:'dialogs.arch_is_companion',action:'dialogs.arch_dismiss_companion'},
            {text:'Never mind.',next:'__end__'}
        ],
        nodes:{}
    }
};
const DEFAULT_TRADE={tradeParent:'',tradeCond:'0.5',tradeBuyExp:'1.0',tradeSellExp:'1.0',buyListRaw:'',sellListRaw:'',supplyListRaw:''};

// ═══════════════════════════════════════════
// STORY NPC — Role-specific vanilla dialog defaults
// ═══════════════════════════════════════════
// These replace the generic VANILLA_DIALOG_DEFAULTS when editing a story NPC.
// Keyed by the `block` field from STORY_NPCS.
const STORY_NPC_ROLE_DIALOGS={
    trader:{
        trade:{opener:'I want to buy some equipment. [Trade]',hub:'',hubChoices:[{text:'[Trade]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}},
        tasks:{opener:'Is there any work you want done?',hub:'',hubChoices:[],nodes:{}},
        info:{opener:'You have connections right? Can you help me settle things with some people?',hub:'',hubChoices:[],nodes:{}},
        wounded:{opener:'Help me...',hub:'',hubChoices:[],nodes:{}}
    },
    tech:{
        trade:{opener:'My equipment needs some tweaking. [Repair/Upgrade]',hub:'',hubChoices:[{text:'[Repair/Upgrade]',next:'__end__',action:'dialogs.npc_is_tech'}],nodes:{}},
        tasks:{opener:'Is there any work you want done?',hub:'',hubChoices:[],nodes:{}},
        info:{opener:'I want to buy some equipment. [Trade]',hub:'',hubChoices:[{text:'[Trade]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}},
        wounded:{opener:'Help me...',hub:'',hubChoices:[],nodes:{}}
    },
    medic:{
        trade:{opener:'I want to buy medical supplies. [Trade]',hub:'',hubChoices:[{text:'[Trade]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}},
        tasks:{opener:'Is there any work you want done?',hub:'',hubChoices:[],nodes:{}},
        info:{opener:'I need medical attention.',hub:'',hubChoices:[{text:'[Heal Health]',next:'__end__',action:'dialogs.heal_actor_injury'},{text:'[Remove Radiation]',next:'__end__',action:'dialogs.heal_actor_radiation'}],nodes:{}},
        wounded:{opener:'Help me...',hub:'',hubChoices:[],nodes:{}}
    },
    barman:{
        trade:{opener:'What you got to sell? [Trade]',hub:'',hubChoices:[{text:'[Trade]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}},
        tasks:{opener:'Is there any work you want done?',hub:'',hubChoices:[],nodes:{}},
        info:{opener:'You have connections right? Can you help me settle things with some people?',hub:'',hubChoices:[],nodes:{}},
        wounded:{opener:'Help me...',hub:'',hubChoices:[],nodes:{}}
    }
};

// Default tree content for vanilla service categories shown on story NPCs.
// Text from References/Vanilla/configs/text/eng/st_dialogs.xml — real vanilla strings.
// NPC responses use variant _1 (script_text picks randomly at runtime).
const STORY_NPC_SERVICE_TREES={
    trade:{
        _default:{opener:'I want to buy some equipment. [Trade]',hub:'Sure thing.',hubChoices:[{text:'[Opens trade window]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}},
        medic:  {opener:'I want to buy medical supplies. [Trade]',hub:'I\'m low on supplies but here\'s what I have.',hubChoices:[{text:'[Opens trade window]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}},
        barman: {opener:'What you got to sell? [Trade]',hub:'Food, drinks, a smoke... what do you want?',hubChoices:[{text:'[Opens trade window]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}}
    },
    repair:{
        _default:{opener:'My equipment needs some tweaking. [Repair/Upgrade]',hub:'I see, show me the equipment... And your money as well.',hubChoices:[{text:'[Opens repair/upgrade]',next:'__end__',action:'dialogs.npc_is_tech'}],nodes:{}}
    },
    healing:{
        _default:{opener:'I need medical assistance.',hub:'I can treat all your injuries for 1,850 RU. I have a special serum that will put you back on your feet in no time. Unless you\'re irradiated - that, the serum cannot fix. Still, I could flush all that glowing shit out of you with another treatment for 1,480 RU. So, what have you decided?',hubChoices:[
            {text:'Heal my wounds. [1,850 RU]',next:'n1',action:'dialogs.heal_actor_injury'},
            {text:'Get the radiation out of me. [1,480 RU]',next:'n1',action:'dialogs.heal_actor_radiation'},
            {text:'Fuck it, I need to be in a good shape. [3,350 RU]',next:'n1',action:'dialogs.heal_actor_injury_radiation'},
            {text:'You know what, Doc? Fix yourself!',next:'n2'}
        ],nodes:{n1:{npc:'Here you go, stay safe next time.',choices:[{text:'Thanks.',next:'__hub__'}]},n2:{npc:'Up to you.',choices:[{text:'...',next:'__hub__'}]}}}
    },
    barman:{
        _default:{opener:'What you got to sell? [Trade]',hub:'Food, drinks, a smoke... what do you want?',hubChoices:[{text:'[Opens trade window]',next:'__end__',action:'dialogs.npc_is_trader'}],nodes:{}}
    },
    tasks:{
        _default:{opener:'Got any work for me?',hub:'(Dynamic — engine generates task offer/accept/decline)',hubChoices:[],nodes:{}}
    },
    broker:{
        _default:{opener:'I found some old documents, are you interested?',hub:'(Dynamic — engine generates artifact/document broker dialog)',hubChoices:[],nodes:{}}
    },
    debt:{
        _default:{opener:'I need to settle a debt.',hub:'(Dynamic — engine handles debt registration and payment)',hubChoices:[],nodes:{}}
    },
    bribe:{
        _default:{opener:'You have connections right? Can you help me settle things with some people?',hub:'Maybe. Who did you piss off?',hubChoices:[
            {text:'[Faction bribe options shown dynamically]',next:'__end__'}
        ],nodes:{}}
    }
};

// ═══════════════════════════════════════════
// STORY NPC INDEX — vanilla NPCs targetable via assign_to
// ═══════════════════════════════════════════
// Only the 47 NPCs hardcoded in arch_story_npcs.script — matched exactly
const STORY_NPCS=[
    // Cordon — Traders
    {id:'esc_2_12_stalker_trader',name:'Sidorovich',role:'Trader',loc:'Cordon',block:'trader'},
    {id:'esc_main_base_trader_mlr',name:'Loris',role:'Trader',loc:'Cordon',block:'trader'},
    {id:'esc_3_16_military_trader',name:'Military Trader',role:'Trader',loc:'Cordon',block:'trader'},
    // Cordon — Tech
    {id:'esc_smart_terrain_5_7_loner_mechanic_stalker',name:'Xenotech',role:'Mechanic',loc:'Cordon',block:'tech'},
    {id:'army_south_mechan_mlr',name:'Military Mechanic',role:'Mechanic',loc:'Cordon',block:'tech'},
    // Garbage — Traders
    {id:'hunter_gar_trader',name:'Butcher',role:'Trader',loc:'Garbage',block:'trader'},
    {id:'baraholka_trader',name:'Flea Market Trader',role:'Trader',loc:'Garbage',block:'trader'},
    {id:'baraholka_trader_night',name:'Night Trader',role:'Trader',loc:'Garbage',block:'trader'},
    // Bar
    {id:'bar_visitors_barman_stalker_trader',name:'Barkeeper',role:'Trader',loc:'Bar',block:'trader'},
    {id:'bar_visitors_stalker_mechanic',name:'Mangun',role:'Mechanic',loc:'Bar',block:'tech'},
    {id:'bar_dolg_medic',name:'Duty Medic',role:'Medic',loc:'Bar',block:'medic'},
    // Agroprom
    {id:'agr_smart_terrain_1_6_army_trader_stalker',name:'Military Trader',role:'Trader',loc:'Agroprom',block:'trader'},
    {id:'agr_smart_terrain_1_6_army_mechanic_stalker',name:'Military Mechanic',role:'Mechanic',loc:'Agroprom',block:'tech'},
    {id:'agr_smart_terrain_1_6_army_medic_stalker',name:'Military Medic',role:'Medic',loc:'Agroprom',block:'medic'},
    {id:'agr_1_6_medic_army_mlr',name:'Military Medic (alt)',role:'Medic',loc:'Agroprom',block:'medic'},
    {id:'agr_1_6_barman_army_mlr',name:'Military Barkeeper',role:'Barkeeper',loc:'Agroprom',block:'barman'},
    // Dark Valley
    {id:'val_smart_terrain_7_4_bandit_trader_stalker',name:'Bandit Trader',role:'Trader',loc:'Dark Valley',block:'trader'},
    {id:'val_smart_terrain_7_3_bandit_mechanic_stalker',name:'Bandit Mechanic',role:'Mechanic',loc:'Dark Valley',block:'tech'},
    {id:'bandit_main_base_medic_mlr',name:'Bandit Medic',role:'Medic',loc:'Dark Valley',block:'medic'},
    // Army Warehouses
    {id:'mil_smart_terrain_7_10_freedom_trader_stalker',name:'Freedom Trader',role:'Trader',loc:'Army Warehouses',block:'trader'},
    {id:'mil_smart_terrain_7_7_freedom_mechanic_stalker',name:'Freedom Mechanic',role:'Mechanic',loc:'Army Warehouses',block:'tech'},
    {id:'mil_freedom_medic',name:'Freedom Medic',role:'Medic',loc:'Army Warehouses',block:'medic'},
    {id:'mil_freedom_barman_mlr',name:'Freedom Barkeeper',role:'Barkeeper',loc:'Army Warehouses',block:'barman'},
    // Yantar
    {id:'yan_stalker_sakharov',name:'Sakharov',role:'Scientist/Trader',loc:'Yantar',block:'trader'},
    {id:'mechanic_army_yan_mlr',name:'Mechanic',role:'Mechanic',loc:'Yantar',block:'tech'},
    {id:'yan_povar_army_mlr',name:'Cook',role:'Cook/Barkeeper',loc:'Yantar',block:'barman'},
    // Great Swamp
    {id:'mar_smart_terrain_doc_doctor',name:'Doctor',role:'Trader',loc:'Swamps',block:'trader'},
    {id:'mar_base_owl_stalker_trader',name:'Owl',role:'Trader',loc:'Swamps',block:'trader'},
    {id:'mar_base_stalker_tech',name:'Technician',role:'Mechanic',loc:'Swamps',block:'tech'},
    {id:'mar_base_stalker_barmen',name:'Barkeeper',role:'Barkeeper',loc:'Swamps',block:'barman'},
    {id:'mar_smart_terrain_base_doctor',name:'CS Base Doctor',role:'Medic',loc:'Swamps',block:'medic'},
    // Dead City
    {id:'cit_killers_merc_trader_stalker',name:'Dushman',role:'Trader',loc:'Dead City',block:'trader'},
    {id:'cit_killers_merc_mechanic_stalker',name:'Hog',role:'Mechanic',loc:'Dead City',block:'tech'},
    {id:'cit_killers_merc_medic_stalker',name:'Surgeon',role:'Medic',loc:'Dead City',block:'medic'},
    {id:'cit_killers_merc_barman_mlr',name:'Aslan',role:'Barkeeper',loc:'Dead City',block:'barman'},
    // Zaton
    {id:'zat_b30_owl_stalker_trader',name:'Owl',role:'Trader',loc:'Zaton',block:'trader'},
    {id:'zat_a2_stalker_mechanic',name:'Mechanic',role:'Mechanic',loc:'Zaton',block:'tech'},
    {id:'zat_tech_mlr',name:'Technician',role:'Mechanic',loc:'Zaton',block:'tech'},
    {id:'zat_b22_stalker_medic',name:'Medic',role:'Medic',loc:'Zaton',block:'medic'},
    {id:'zat_a2_stalker_barmen',name:'Barkeeper',role:'Barkeeper',loc:'Zaton',block:'barman'},
    // Jupiter
    {id:'jup_a6_freedom_trader_ashot',name:'Ashot',role:'Trader',loc:'Jupiter',block:'trader'},
    {id:'jup_b217_stalker_tech',name:'Technician',role:'Mechanic',loc:'Jupiter',block:'tech'},
    {id:'jup_a6_stalker_medik',name:'Medic',role:'Medic',loc:'Jupiter',block:'medic'},
    {id:'jup_a6_stalker_barmen',name:'Barkeeper',role:'Barkeeper',loc:'Jupiter',block:'barman'},
    // Pripyat
    {id:'trader_pri_a15_mlr',name:'Trader',role:'Trader',loc:'Pripyat',block:'trader'},
    {id:'pri_a16_mech_mlr',name:'Mechanic',role:'Mechanic',loc:'Pripyat',block:'tech'},
    {id:'pri_medic_stalker',name:'Medic',role:'Medic',loc:'Pripyat',block:'medic'},
];
const STORY_NPC_LOOKUP={};
STORY_NPCS.forEach(function(n){STORY_NPC_LOOKUP[n.id]=n;});
const DEFAULT_DLG={dialogs:[{id:'dlg_1',label:'Dialog 1',opener:'I want to ask you something.',hub:'',hubChoices:[],nodes:{},layout:{}}],vanilla:{hello1:'',hello2:'',hello3:'',job:'',anomalies:'',information:'',tips:'',wounded:''},graph:{view:'tree'}};
const ITEM_CATALOG=Array.isArray(window.VANILLA_ITEM_CATALOG)
    ? window.VANILLA_ITEM_CATALOG
    : (Array.isArray(window.VANILLA_ITEM_SECTIONS)
        ? window.VANILLA_ITEM_SECTIONS.map(v=>({id:String(v||''),name:String(v||''),cat:'misc'}))
        : []);
const VANILLA_DIALOG_PREVIEW=window.ARCH_VANILLA_DIALOG_PREVIEW||{
    actor_options:{job:[],anomalies:[],information:[],tips:[]},
    npc_responses:{hello:[],job:[],anomalies:[],information:[],tips:[],wounded:[]}
};
const ITEM_LOOKUP_BY_ID={};
const ITEM_LOOKUP_BY_NAME={};
const ITEM_LOOKUP_BY_DISPLAY={};
ITEM_CATALOG.forEach(it=>{
    const id=String((it&&it.id)||'').trim();
    if(!id)return;
    const name=String((it&&it.name)||id).trim()||id;
    const key=id.toLowerCase();
    if(!ITEM_LOOKUP_BY_ID[key]){
        ITEM_LOOKUP_BY_ID[key]={id,name,cat:String((it&&it.cat)||'misc')};
    }
    const nk=name.toLowerCase();
    if(!ITEM_LOOKUP_BY_NAME[nk])ITEM_LOOKUP_BY_NAME[nk]=[];
    ITEM_LOOKUP_BY_NAME[nk].push({id,name,cat:String((it&&it.cat)||'misc')});
    const display=`${name} [${id}]`.toLowerCase();
    ITEM_LOOKUP_BY_DISPLAY[display]=id;
});

// ═══════════════════════════════════════════
// BINDING GUIDE — descriptions for the binding picker
// ═══════════════════════════════════════════
// Each entry: { desc, validIn:['precondition','action','scriptText'], usage }
// Dynamic per-pool/per-task bindings are matched by pattern prefix.
const BINDING_GUIDE={
    // ── Task Flow — Conditions ──
    'arch_has_task_pool':{
        desc:'The NPC has at least one job to offer the player. The pool automatically picks the best task based on weight and availability.',
        validIn:['precondition'],keywords:'offer job available work task',
        usage:'Add this to an NPC line like "I\'ve got a job for you" so it only shows when there\'s actually work available. If all tasks are done or on cooldown, this line won\'t appear.'
    },
    'arch_no_task_pool':{
        desc:'The NPC has nothing to offer right now — all tasks are done, on cooldown, or unavailable.',
        validIn:['precondition'],keywords:'empty exhausted nothing done cooldown',
        usage:'Add this to a line like "I don\'t have anything for you right now" so it only shows when the NPC truly has no work.'
    },
    'arch_has_active_task':{
        desc:'The player is currently working on a task from this NPC (accepted it but hasn\'t turned it in yet).',
        validIn:['precondition'],keywords:'active busy working ongoing accepted current',
        usage:'Add this to a line like "How\'s that job going?" so it only appears while the player has an active task. Use with "Player has the required items" to show the turn-in option.'
    },
    'arch_task_ready':{
        desc:'The player has all the items needed to complete their active task. For fetch tasks, this means the right items are in the player\'s inventory.',
        validIn:['precondition'],keywords:'ready items inventory complete turnin turn in',
        usage:'Add this to the player\'s "I have what you wanted" choice so it only appears when the player can actually turn in. Always used inside a branch that already checks "Player is working on a task".'
    },
    'arch_task_has_offer':{
        desc:'Same as "NPC has work available" — kept for compatibility with older packs.',
        validIn:['precondition'],keywords:'offer available legacy',
        usage:'Use "NPC has work available" instead — they do the same thing.'
    },
    // ── Task Flow — Actions ──
    'arch_task_accept':{
        desc:'The player agrees to do the job. This adds the task to the PDA, shows a map marker, and starts tracking progress.',
        validIn:['action'],keywords:'accept agree yes take do job',
        usage:'Add this to the player\'s "I\'ll do it" or "Sure, I\'ll help" choice. The system automatically picks which task to assign based on the pool\'s weight rotation.'
    },
    'arch_task_decline':{
        desc:'The player says no. The task stays in the pool and can be offered again next time they talk to this NPC.',
        validIn:['action'],keywords:'decline refuse reject no pass maybe later',
        usage:'Add this to the player\'s "Not interested" or "Maybe later" choice.'
    },
    'arch_task_try_complete':{
        desc:'Checks if the player can turn in the task and takes the required items from their inventory. IMPORTANT: Always pair this with "Give player their reward" on the same NPC line.',
        validIn:['action'],keywords:'complete finish turnin turn in check items submit',
        usage:'Add both "Turn in the task" AND "Give player their reward" to the same NPC response line. Then add "Show success or failure" as the auto-generated text. These three always go together.'
    },
    'arch_task_deliver_rewards':{
        desc:'Gives the player their money and item rewards. Only works right after a successful turn-in check — if the player didn\'t have the items, nothing happens.',
        validIn:['action'],keywords:'reward pay money items give prize',
        usage:'Always put this on the same NPC line as "Turn in the task". Never on a separate branch — they must fire together.'
    },
    'arch_delivery_try_complete':{
        desc:'Completes a delivery, talk-to, or collect task at the RECEIVING NPC (not the NPC who gave the task). If the original receiver died, any NPC with the same type works.',
        validIn:['action'],keywords:'delivery deliver package receive target complete',
        usage:'Add this to the receiving NPC\'s dialog — the NPC the player is delivering TO. Pair with "Player has a delivery for this NPC" as a condition on the dialog.'
    },
    // ── Task Flow — Auto Text ──
    'arch_text_task_offer_summary':{
        desc:'The NPC describes what the task needs, like "Bring me 3 medkits" or "Deliver this package to the Bar". Generated automatically from the task settings.',
        validIn:['scriptText'],keywords:'offer summary description what need items auto',
        usage:'Add this as auto-generated text on the NPC\'s task offer line. The player reads this to decide if they want the job. Don\'t write custom text on the same line — the auto-text replaces it.'
    },
    'arch_text_task_offer_details':{
        desc:'A longer version of the task description including exact item counts, target location, and reward breakdown.',
        validIn:['scriptText'],keywords:'details verbose info items reward location full',
        usage:'Add this to a "Tell me more" response if you want the player to get full details before accepting.'
    },
    'arch_text_task_active_summary':{
        desc:'Reminds the player what they need to do for their current task — what items to find, where to go, how many they still need.',
        validIn:['scriptText'],keywords:'active reminder progress status what do forgot',
        usage:'Add this to a "What was I supposed to do?" line for players who forgot their objective.'
    },
    'arch_text_task_result':{
        desc:'Shows whether the turn-in succeeded or failed. On success: "Good work, here\'s your 5000 RU." On failure: "You don\'t have what I need yet."',
        validIn:['scriptText'],keywords:'result outcome success fail reward complete',
        usage:'Add this as auto-generated text on the same NPC line that has "Turn in the task" and "Give player their reward". The three always go together.'
    },
    'arch_text_pool_open':{
        desc:'An opening line for when the NPC has work available. Uses the pool\'s custom prompt text if you set one in the Tasks tab.',
        validIn:['scriptText'],keywords:'open prompt greeting intro work available',
        usage:'Add this to the NPC\'s introduction line before showing task offers.'
    },
    'arch_delivery_result_text':{
        desc:'Shows the result when the player delivers/talks/collects at the target NPC. Like task_result but for the receiving end.',
        validIn:['scriptText'],keywords:'delivery result target receive complete',
        usage:'Add this to the receiving NPC\'s response line, alongside the delivery completion action.'
    },
    // ── Personality ──
    'arch_text_personality_npc_prompt':{
        desc:'The NPC offers a task using their unique personality voice instead of generic text.',
        validIn:['scriptText'],keywords:'personality voice tone character npc offer',
        usage:'Use instead of the standard task summary when you want the NPC to sound unique. Set up personality in the Tasks tab.'
    },
    'arch_text_personality_accept':{
        desc:'The NPC reacts to the player accepting, in their unique voice.',
        validIn:['scriptText'],keywords:'personality accept agree voice character',
        usage:'Add to the NPC\'s response after the player accepts.'
    },
    'arch_text_personality_decline':{
        desc:'The NPC reacts to the player declining — could be disappointed, threatening, or indifferent depending on personality.',
        validIn:['scriptText'],keywords:'personality decline refuse voice character',
        usage:'Add to the NPC\'s response after the player says no.'
    },
    'arch_text_personality_turnin_actor':{
        desc:'What the player says when turning in, flavored by the NPC\'s personality.',
        validIn:['scriptText'],keywords:'personality turnin actor player voice',
        usage:'Use on the player\'s turn-in choice instead of writing static text.'
    },
    'arch_text_personality_turnin_npc':{
        desc:'The NPC reacts to a successful turn-in in character — grateful, gruff, suspicious, etc.',
        validIn:['scriptText'],keywords:'personality turnin npc reaction voice character',
        usage:'Add to the NPC\'s response after successful completion.'
    },
    // ── Per-task actions ──
    'arch_accept_':{
        desc:'The player accepts a SPECIFIC named task. Use this when you want to offer a particular task in a story dialog, not a random one from the pool.',
        validIn:['action'],keywords:'accept specific named story narrative task',
        usage:'Add this to the player\'s "I\'ll do it" choice in a hand-crafted dialog where you know exactly which task you\'re offering.'
    },
    'arch_cancel_':{
        desc:'The player abandons a specific task. It goes back to the pool and can be offered again later.',
        validIn:['action'],keywords:'cancel abandon quit give up specific task',
        usage:'Add to an "I can\'t do this anymore" player choice.'
    },
    'arch_fetch_complete_':{
        desc:'Turns in a specific fetch task. Checks the player\'s inventory and takes the required items.',
        validIn:['action'],keywords:'complete finish fetch turnin specific task',
        usage:'Add to the NPC\'s turn-in line along with "Give player their reward".'
    },
    'arch_delivery_complete_':{
        desc:'Completes a specific delivery task at the target NPC.',
        validIn:['action'],keywords:'complete finish delivery deliver specific task',
        usage:'Add to the receiving NPC\'s dialog.'
    },
    'arch_talk_complete_':{
        desc:'Marks a talk-to task as done. Just reaching this dialog line completes the task — the conversation itself is the objective.',
        validIn:['action'],keywords:'complete finish talk met spoke specific task',
        usage:'Add to any line in the target NPC\'s dialog. The player completes the task just by getting to this point in the conversation.'
    },
    'arch_collect_pickup_':{
        desc:'The player picks up items from this NPC for a collect task.',
        validIn:['action'],keywords:'collect pickup gather items take receive',
        usage:'Add to a "Hand over the goods" choice.'
    },
    // ── Per-task conditions ──
    'arch_is_task_done(':{
        desc:'The player has finished this task before. Stays true forever — even across saves. Perfect for unlocking follow-up content.',
        validIn:['precondition'],keywords:'done completed finished before prerequisite unlock gate chain',
        usage:'Add to a line that should only appear after the player finished a previous task. Great for story chains: "Now that you\'ve done X, let me tell you about Y..."'
    },
    'arch_is_task_not_done(':{
        desc:'The player has NOT finished this task yet.',
        validIn:['precondition'],keywords:'not done incomplete unfinished before',
        usage:'Add to content that should disappear after a task is done.'
    },
    'arch_is_task_active(':{
        desc:'The player is currently working on this specific task (accepted but not turned in).',
        validIn:['precondition'],keywords:'active current busy working on specific',
        usage:'Add to task-specific dialog that only makes sense while the player is on that job.'
    },
    'arch_is_task_ready_for(':{
        desc:'The player can turn in this specific task right now (has all required items).',
        validIn:['precondition'],keywords:'ready items turnin complete can specific',
        usage:'Add to the turn-in choice so it only appears when the player has what they need.'
    },
    'arch_can_offer_task(':{
        desc:'This specific task is available to offer — not active, not on cooldown, prerequisites met.',
        validIn:['precondition'],keywords:'available offer can give unlocked ready specific',
        usage:'Add to a specific task offer line. For story chains, combine with "Player finished X" to create sequenced content.'
    },
    'arch_text_task_offer_details_by_id(':{
        desc:'Shows the full details (items, location, reward) for a specific named task.',
        validIn:['scriptText'],keywords:'details description offer specific task info',
        usage:'Add as auto-text on a "Tell me more about this job" line for a specific task.'
    },
    // ── Who Is This NPC ──
    'arch_is_delivery_target':{
        desc:'The player has a delivery, talk-to, or collect task targeting this NPC. If the original target died, any NPC of the same type matches.',
        validIn:['precondition'],keywords:'delivery target package receive collect talk destination',
        usage:'Add as a condition on the ENTIRE dialog (not just one line) so the delivery conversation only appears when talking to the right NPC.'
    },
    'arch_is_':{
        desc:'This NPC has a specific archetype. Use to make a dialog only appear for one particular NPC type.',
        validIn:['precondition'],keywords:'identity archetype type specific npc is',
        usage:'Add as a condition on the entire dialog to restrict it to NPCs with this archetype.'
    },
    // ── Player History ──
    'arch_is_first_visit':{
        desc:'This is the very first time the player is talking to this NPC. After the conversation ends, this will never be true again.',
        validIn:['precondition'],keywords:'first visit new never met before introduction hello',
        usage:'Add to a unique first-meeting introduction like "First time here? Let me explain how things work." Pair with "Player has been here before" on an alternative greeting.'
    },
    'arch_is_returning':{
        desc:'The player has talked to this NPC before. Always true after the first conversation.',
        validIn:['precondition'],keywords:'returning visited before again repeat come back',
        usage:'Add to a returning greeting like "Back again? What do you need?" Pair with "First time meeting" for a two-branch greeting.'
    },
    'arch_is_regular':{
        desc:'The player has visited this NPC many times (5+ by default, configurable in Settings). A sign of loyalty.',
        validIn:['precondition'],keywords:'regular frequent loyal many visits trusted veteran',
        usage:'Add to special content for loyal visitors: exclusive tasks, discounts, or personal conversations.'
    },
    // ── Job Menu ──
    'arch_task_is_cat_picker':{
        desc:'This NPC has multiple types of jobs (multiple task pools) and the player needs to choose which type.',
        validIn:['precondition'],keywords:'category picker multiple pools choose type menu',
        usage:'Add to a "What kind of work?" menu that lets the player pick between different job types.'
    },
    'arch_task_not_cat_picker':{
        desc:'The NPC only has one type of job — skip the selection menu and go straight to offers.',
        validIn:['precondition'],keywords:'single pool no picker skip one type',
        usage:'Add to skip the category menu when there\'s only one pool.'
    },
    'arch_task_cat_has_':{
        desc:'Job type slot N exists and has available work.',
        validIn:['precondition'],keywords:'category slot exists available picker menu',
        usage:'Add to each job type choice to hide it when that category has no work.'
    },
    'arch_text_task_cat_':{
        desc:'Shows the name of job type slot N (e.g. "Hunting Jobs", "Delivery Work").',
        validIn:['scriptText'],keywords:'category name label text picker menu',
        usage:'Add as the text on each job type choice button.'
    },
    'arch_task_cat_select_':{
        desc:'The player picks job type N. After this, all task bindings operate on that pool.',
        validIn:['action'],keywords:'select choose pick category slot type',
        usage:'Add to each job type choice. After selection, show the normal task offer/accept flow.'
    },
    // ── Intel ──
    'arch_informant_find_stalker':{
        desc:'The NPC scans for stalkers nearby and finds the closest one. Only works if the NPC has the informant specialization.',
        validIn:['precondition'],keywords:'informant find locate stalker person nearby scan intel',
        usage:'Add to a "Seen anyone around here?" branch. If a stalker is found, the line appears and the result is ready to show.'
    },
    'arch_informant_find_mutant':{
        desc:'The NPC scans for mutants nearby. Same as stalker scanning but for creatures.',
        validIn:['precondition'],keywords:'informant find locate mutant creature nearby scan intel',
        usage:'Add to a "Any creatures nearby?" branch.'
    },
    'arch_text_informant_result':{
        desc:'Shows what the NPC found — creature/stalker name, distance, and compass direction.',
        validIn:['scriptText'],keywords:'informant result location distance direction found scan',
        usage:'Add as auto-text on the NPC\'s response after the scan condition passes.'
    },
    // ── Other ──
    'arch_delivery_deliver_rewards':{
        desc:'Gives rewards for a completed delivery, talk-to, or collect task. For regular fetch tasks, use "Give player their reward" instead.',
        validIn:['action'],keywords:'reward pay money delivery talk collect target',
        usage:'Pair with the completion action on the receiving NPC\'s response line.'
    },
    'arch_restore_start_dialog':{
        desc:'Returns the NPC to their normal greeting after a one-time intro dialog. Without this, the intro would play every time.',
        validIn:['action'],keywords:'restore reset greeting normal intro one-time first meeting',
        usage:'Add to the last line of an intro dialog so the NPC goes back to normal conversation next time.'
    },
    // ── Services ──
    'npc_is_trader':{
        desc:'Opens the buy/sell trade window with this NPC.',
        validIn:['action'],keywords:'trade buy sell shop items window open',
        usage:'Add to a "[Trade]" player choice.'
    },
    'npc_is_tech':{
        desc:'Opens the repair and upgrade screen. The NPC needs the technician specialization.',
        validIn:['action'],keywords:'repair upgrade fix weapon armor tech mechanic',
        usage:'Add to a "[Repair/Upgrade]" player choice.'
    },
    'heal_actor_injury':{
        desc:'Heals the player\'s health, power, and bleeding. Costs 1,850 RU (taken automatically).',
        validIn:['action'],keywords:'heal health injury wound bleed medic doctor patch',
        usage:'Add to a "Patch me up" or "Heal my wounds" player choice.'
    },
    'heal_actor_radiation':{
        desc:'Removes the player\'s radiation. Costs 1,480 RU (taken automatically).',
        validIn:['action'],keywords:'radiation rad remove clean anti-rad treatment medic',
        usage:'Add to a "Remove radiation" player choice.'
    },
    'npc_give_task':{
        desc:'Gives the player a task from the vanilla (base game) task system. This is NOT an ARCH task — it uses the game\'s built-in task manager.',
        validIn:['action'],keywords:'vanilla task give assign base game standard',
        usage:'Add to an "I\'ll do it" choice. Make sure "Populate vanilla tasks" runs on an earlier line first.'
    },
    'generate_available_tasks':{
        desc:'Loads available vanilla tasks for this NPC. Must run BEFORE "Give vanilla task" or there will be nothing to give.',
        validIn:['action'],keywords:'vanilla task generate populate load available list',
        usage:'Add to the line that opens the task conversation, before the accept option.'
    },
    // ── Utility ──
    'arch_has_money':{
        desc:'Checks if the player has at least the specified amount of rubles. Use arch_has_money(5000) to check for 5000 RU.',
        validIn:['precondition'],keywords:'money rubles cash afford pay check price cost',
        usage:'Add to a choice that costs money so it only appears if the player can afford it. Put the amount in parentheses: arch_has_money(5000).'
    },
    'arch_pay_money':{
        desc:'Takes the specified amount of rubles from the player. Use arch_pay_money(5000) to charge 5000 RU. The money goes to the NPC.',
        validIn:['action'],keywords:'pay money cost fee bribe charge rubles take',
        usage:'Add to the player\'s choice that triggers a payment. Pair with "Player has enough money" as a condition to prevent charging broke players.'
    },
    'arch_make_enemy':{
        desc:'Makes this NPC and their entire squad permanently hostile to the player. Sets goodwill to -5000. There\'s no undo — the NPC will attack on sight.',
        validIn:['action'],keywords:'enemy hostile attack aggro angry fight betray war',
        usage:'Add to a confrontation choice like "Then we have nothing to talk about" or a betrayal moment. The NPC will attack immediately after dialog ends.'
    },
    'arch_can_recruit':{
        desc:'Checks if this NPC can be recruited as a companion. Returns false if they\'re already in the player\'s squad.',
        validIn:['precondition'],keywords:'recruit companion follow join squad hire available',
        usage:'Add as a condition on a "Come with me" dialog choice so it only appears when the NPC can actually be recruited.'
    },
    'arch_is_companion':{
        desc:'True if this NPC is currently a companion in the player\'s squad.',
        validIn:['precondition'],keywords:'companion following squad member party',
        usage:'Show companion-specific options like "Wait here" or "Leave my squad" only when the NPC is already following.'
    },
    'arch_recruit_companion':{
        desc:'Adds this NPC to the player\'s companion squad. They will follow the player and obey companion commands.',
        validIn:['action'],keywords:'recruit companion follow join squad hire come with me',
        usage:'Add to a "Come with me" or "Join my squad" dialog choice. Pair with "NPC can be recruited" as a condition.'
    },
    'arch_dismiss_companion':{
        desc:'Removes this NPC from the player\'s companion squad. They return to their normal behavior.',
        validIn:['action'],keywords:'dismiss leave squad remove companion goodbye release',
        usage:'Add to a "You can go now" or "Leave my squad" dialog choice. Pair with "NPC is a companion" as a condition.'
    },
    'arch_transfer_task':{
        desc:'Moves a task\'s giver to this NPC. Use when the original task giver died and you want another NPC to take over. arch_transfer_task(task_id) transfers the specified task.',
        validIn:['action'],keywords:'transfer task move giver death reassign successor inherit',
        usage:'Add to a dialog on the replacement NPC. Typically paired with a condition that checks if the original giver is dead.'
    },
    'arch_text':{
        desc:'Shows text from a string table ID with placeholder substitution. Supports %name% (NPC name), %location% (current level), %faction% (NPC community). Use arch_text(st_my_string_id).',
        validIn:['scriptText'],keywords:'text string placeholder dynamic custom name location faction template',
        usage:'Add as auto-text when you want dynamic text that includes the NPC\'s name or location. Define the string in your text XML with placeholders, then reference it here.'
    },
    // ── Vanilla bindings ──
    'actor_stalker':{desc:'Player\'s current faction is Loner.',validIn:['precondition'],keywords:'faction loner stalker player community',
        usage:'Add to dialog lines that should only appear for Loner players. Works with disguises — checks current appearance, not "true" faction.'},
    'actor_not_stalker':{desc:'Player is NOT a Loner.',validIn:['precondition'],keywords:'not loner stalker faction',usage:'Hide Loner-specific content from other factions.'},
    'npc_stalker':{desc:'This NPC belongs to the Loner faction.',validIn:['precondition'],keywords:'npc faction loner stalker community',usage:'Add to lines that should only appear when talking to a Loner NPC.'},
    'is_actor_healthy':{desc:'Player has full health and no radiation.',validIn:['precondition'],keywords:'healthy full health ok fine',
        usage:'Add to a line like "You look well" or to hide healing options when the player doesn\'t need them.'},
    'is_actor_not_healthy':{desc:'Player is injured, irradiated, or both.',validIn:['precondition'],keywords:'hurt injured sick not healthy wounded',
        usage:'Add to a line like "You don\'t look so good" or to show healing options.'},
    'is_actor_injured':{desc:'Player\'s health is below normal (wounded, bleeding, or low power).',validIn:['precondition'],keywords:'injured wounded hurt bleeding low health',usage:'Gate the "heal wounds" medic option.'},
    'is_actor_irradiated':{desc:'Player has radiation sickness.',validIn:['precondition'],keywords:'radiation irradiated glowing sick rad',usage:'Gate the "remove radiation" medic option.'},
    'heal_actor_injury_radiation':{desc:'Heals ALL player injuries AND removes radiation. Costs 3,350 RU total.',validIn:['action'],keywords:'heal all health radiation both full treatment',
        usage:'Add to a "Fix everything" medic choice. More expensive but one-stop healing.'},
    'is_actor_noob':{desc:'Player\'s rank is low (Novice/Trainee). Based on total experience points.',validIn:['precondition'],keywords:'noob rookie newbie low rank beginner',
        usage:'NPCs can be condescending: "You look green, kid." Or offer tutorial-style dialog.'},
    'is_actor_trustworthy':{desc:'Player has decent rank — NPCs will share more information.',validIn:['precondition'],keywords:'trustworthy rank respect decent',
        usage:'Unlock mid-tier content: "You\'ve been around long enough to know..."'},
    'is_actor_experienced':{desc:'Player has high rank — veteran stalker.',validIn:['precondition'],keywords:'experienced veteran high rank skilled',
        usage:'Unlock exclusive content: "Not many survive this long in the Zone..."'},
    'is_wounded':{desc:'The NPC is currently wounded (low health). Used for wounded dialog system.',validIn:['precondition'],keywords:'wounded hurt injured npc bleeding',
        usage:'Show wounded-specific dialog. Usually handled by the vanilla wounded system automatically.'},
    'is_not_wounded':{desc:'The NPC is not wounded.',validIn:['precondition'],keywords:'not wounded healthy ok npc fine',usage:'Hide wounded dialog when NPC is fine.'},
    'is_friend':{desc:'NPC has positive goodwill toward the player (considers them friendly).',validIn:['precondition'],keywords:'friend friendly ally goodwill positive like',
        usage:'Unlock friendly-only content: "Since you\'re a friend, I\'ll tell you something..."'},
    'is_not_friend':{desc:'NPC does not consider the player a friend (neutral or hostile goodwill).',validIn:['precondition'],keywords:'not friend neutral hostile cold stranger',
        usage:'Show guarded dialog: "I don\'t know you well enough for that."'},
    'actor_have_medkit':{desc:'Player has at least one medkit in inventory.',validIn:['precondition'],keywords:'medkit medicine heal item have inventory',
        usage:'Gate a "give medkit to wounded NPC" choice.'},
    'actor_have_bandage':{desc:'Player has at least one bandage.',validIn:['precondition'],keywords:'bandage wound item have inventory',usage:'Gate bandage-giving dialog.'},
    'has_2000_money':{desc:'Player has at least 2,000 rubles.',validIn:['precondition'],keywords:'money rubles 2000 afford cash',usage:'Gate a vanilla purchase or bribe option.'},
    'transfer_medkit':{desc:'Takes the best medkit from the player and heals the wounded NPC. Used in wounded dialog.',validIn:['action'],keywords:'medkit give transfer heal npc wounded help',
        usage:'Add to a "Here, take this medkit" choice when talking to a wounded NPC.'},
    'is_surge_running':{desc:'An emission (blowout) is currently happening.',validIn:['precondition'],keywords:'surge emission blowout happening active danger',
        usage:'Show emission-specific dialog: "We need to find cover!" or lock certain actions during emissions.'},
    'is_surge_not_running':{desc:'No emission is happening — skies are calm.',validIn:['precondition'],keywords:'surge not running calm safe clear weather',usage:'Normal dialog that shouldn\'t appear during emergencies.'},
    'break_dialog':{desc:'Immediately ends the conversation. The dialog window closes.',validIn:['action'],keywords:'break end close exit conversation stop leave',
        usage:'Add to an "I\'m done talking" choice or after a hostile confrontation. The NPC resumes normal behavior.'},
    'disable_talk_self':{desc:'Prevents THIS NPC from initiating conversation with the player again. The player can still talk to them.',validIn:['action'],keywords:'disable talk silent mute npc stop conversation',
        usage:'Add after a "get lost" type exchange. The NPC won\'t approach the player for small talk anymore.'}
};

// Match a binding ID to its guide entry (handles dynamic per-task/pool suffixes)
function getBindingGuide(id){
    if(!id)return null;
    const short=id.replace('dialogs.','');
    // Exact match first
    if(BINDING_GUIDE[short])return BINDING_GUIDE[short];
    // Pattern prefix match (per-task actions like arch_accept_taskid, per-task preconditions like arch_is_task_done(taskid))
    const prefixes=['arch_accept_','arch_cancel_','arch_fetch_complete_','arch_delivery_complete_','arch_talk_complete_','arch_collect_pickup_',
        'arch_is_task_done(','arch_is_task_not_done(','arch_is_task_active(','arch_is_task_ready_for(','arch_can_offer_task(',
        'arch_text_task_offer_details_by_id(',
        'arch_task_cat_has_','arch_text_task_cat_','arch_task_cat_select_',
        'arch_has_task_pool_','arch_no_task_pool_','arch_has_active_task_','arch_task_ready_','arch_task_has_offer_',
        'arch_task_accept_','arch_task_decline_','arch_task_try_complete_','arch_task_deliver_rewards_','arch_delivery_try_complete_',
        'arch_text_task_offer_summary_','arch_text_task_offer_details_','arch_text_task_active_summary_','arch_text_task_result_','arch_text_pool_open_','arch_delivery_result_text_',
        'arch_text_personality_npc_prompt_','arch_text_personality_accept_','arch_text_personality_decline_','arch_text_personality_turnin_actor_','arch_text_personality_turnin_npc_',
        'arch_is_'];
    for(var i=0;i<prefixes.length;i++){
        if(short.indexOf(prefixes[i])===0&&BINDING_GUIDE[prefixes[i]])return BINDING_GUIDE[prefixes[i]];
    }
    return null;
}

let groups=[];
let soloChars=[]; // standalone characters not belonging to any group
let savedCategories=[]; // global item categories: [{name, items:['section1','section2',...]}]
let editMode=null; // 'group'|'char'
let curGrp=null;   // index
let curChar=null;   // index within group
let curSolo=null; // index in soloChars when editMode==='solo'
let curDlgTreeIdx=0;
let selectedBranchPath='';
let _mainTabActive=true;
let _introTabActive=false;
let curVanillaServiceIdx=null; // null = not on vanilla service tab, number = index into d.vanillaServices
let _companionAllActive=false; // true = showing companion All graph
let curCompanionDlgIdx=null;   // null = not on companion tab, number = index into dlg.companionDialogs

// ═══════════════════════════════════════════
// CORE UTILITIES
// ═══════════════════════════════════════════
// Deep clone
function dc(o){return JSON.parse(JSON.stringify(o));}

function mkDefaults(){var d={settings:dc(DEFAULT_SETTINGS),trade:dc(DEFAULT_TRADE),dlg:dc(DEFAULT_DLG)};d.settings.stripCategories=dc(DEFAULT_STRIP_UI);return d;}

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// Sanitize text for X-Ray engine (Windows-1251). Replaces non-ASCII chars that cause garbled text in-game.
function sanitizeGameText(s){
    if(!s)return'';
    return String(s)
        .replace(/[\u2018\u2019\u201A]/g,"'")    // smart single quotes → ASCII
        .replace(/[\u201C\u201D\u201E]/g,'"')    // smart double quotes → ASCII
        .replace(/\u2026/g,'...')                 // ellipsis → three dots
        .replace(/[\u2013\u2014]/g,'-')           // en/em dash → hyphen
        .replace(/\u2015/g,'-')                   // horizontal bar → hyphen
        .replace(/[\u2010\u2011\u2012]/g,'-')     // other dashes → hyphen
        .replace(/\u00A0/g,' ')                   // non-breaking space → space
        .replace(/\u200B/g,'')                    // zero-width space → remove
        .replace(/\u00AB/g,'<<').replace(/\u00BB/g,'>>') // guillemets
        .replace(/\u2022/g,'*')                   // bullet → asterisk
        .replace(/\u00D7/g,'x')                   // multiplication sign → x
        .replace(/[\u2190-\u21FF]/g,'->')         // arrows → text arrow
        .replace(/[^\x00-\x7F]/g,'')             // strip any remaining non-ASCII
        .replace(/\r?\n/g,'\\n');                 // real line breaks → \n for engine
}

function buildMS(id,items,rankMode){
    const c=document.getElementById(id);
    const isLoc=(id==='filterLoc');
    items.forEach(([v,l])=>{
        const d=document.createElement('div');d.className='mi';
        const label=rankMode?l:`${l} (${v})`;
        var stBtn=isLoc&&typeof SMART_TERRAINS!=='undefined'&&SMART_TERRAINS[v]
            ?`<button class="btn b2 bs" style="padding:0 4px;font-size:9px;margin-left:3px;line-height:14px;opacity:0.6" onclick="event.stopPropagation();openSmartTerrainPicker('${v}')" title="Pick smart terrains in ${l}">ST</button>`
            :'';
        d.innerHTML=`<input type="checkbox" value="${v}" onchange="saveFilter('${id}')"><label style="cursor:pointer">${label}</label>${stBtn}`;
        c.appendChild(d);
    });
}
function titleCaseWords(str){
    return String(str||'')
        .split(/\s+/)
        .filter(Boolean)
        .map(w=>w.charAt(0).toUpperCase()+w.slice(1))
        .join(' ');
}
function clampNumber(v,min,max,fallback){
    const n=Number(v);
    if(!Number.isFinite(n))return fallback;
    if(n<min)return min;
    if(n>max)return max;
    return n;
}
let _zoomLevel=1;
const _globalZoomSteps=[1,1.1,1.2,1.3,1.5,1.75,2];
function adjustZoom(delta){
    let idx=_globalZoomSteps.findIndex(s=>Math.abs(s-_zoomLevel)<0.01);
    if(idx<0)idx=0;
    idx=Math.max(0,Math.min(_globalZoomSteps.length-1,idx+(delta>0?1:-1)));
    _setGlobalZoom(_globalZoomSteps[idx]);
}
function _setGlobalZoom(val){
    _zoomLevel=val;
    document.getElementById('appRoot').style.zoom=_zoomLevel;
    const lbl=document.getElementById('globalZoomLabel');
    if(lbl)lbl.textContent=Math.round(_zoomLevel*100)+'%';
    _closeGlobalZoomDropdown();
}
function toggleGlobalZoomDropdown(el){
    var existing=document.getElementById('globalZoomDrop');
    if(existing){_closeGlobalZoomDropdown();return;}
    var dd=document.createElement('div');
    dd.id='globalZoomDrop';
    dd.className='global-zoom-dropdown';
    _globalZoomSteps.forEach(function(z){
        var b=document.createElement('button');
        b.textContent=Math.round(z*100)+'%';
        if(Math.abs(z-_zoomLevel)<0.01)b.className='active';
        b.onclick=function(e){e.stopPropagation();_setGlobalZoom(z);};
        dd.appendChild(b);
    });
    el.style.position='relative';
    el.appendChild(dd);
    document.removeEventListener('click',_closeGlobalZoomDropdown);
    setTimeout(function(){document.addEventListener('click',_closeGlobalZoomDropdown);},0);
}
function _closeGlobalZoomDropdown(){
    var d=document.getElementById('globalZoomDrop');
    if(d)d.remove();
    document.removeEventListener('click',_closeGlobalZoomDropdown);
}
function setStatus(msg,type){
    const el=document.getElementById('statusStrip');
    if(!el)return;
    el.classList.remove('ok','warn','err');
    if(type==='ok')el.classList.add('ok');
    else if(type==='warn')el.classList.add('warn');
    else if(type==='err')el.classList.add('err');
    el.textContent=String(msg||'Ready.');
}
function classifyItemSection(sec){
    const s=String(sec||'').toLowerCase();
    if(!s)return 'misc';
    if(s.indexOf('ammo_')===0)return 'ammo';
    if(s.indexOf('wpn_')===0)return 'weapon';
    if(s.indexOf('af_')===0)return 'artifact';
    if(s.indexOf('prt_')===0)return 'parts';
    if(s.indexOf('detector_')===0||s.indexOf('device_')===0||s==='binoc'||s==='wpn_binoc')return 'device';
    if(s.indexOf('_outfit')>0||s.indexOf('helm_')===0||s.indexOf('exo')>=0||s.indexOf('armor')>=0)return 'armor';
    if(s.indexOf('medkit')===0||s.indexOf('bandage')===0||s.indexOf('drug_')===0||s.indexOf('cigarette')===0||s.indexOf('vodka')===0||s.indexOf('water')>=0||s.indexOf('food')>=0||s.indexOf('bread')>=0||s.indexOf('energy_drink')===0)return 'consumable';
    return 'misc';
}
function buildItemListByCategory(cat){
    const all=ITEM_CATALOG.map(it=>{
        const id=String((it&&it.id)||'').trim();
        if(!id)return null;
        const name=String((it&&it.name)||id).trim();
        const c=String((it&&it.cat)||classifyItemSection(id)).trim()||'misc';
        return {id,name,cat:c};
    }).filter(Boolean);
    if(!cat||cat==='all')return all;
    return all.filter(v=>v.cat===cat);
}
function resolveItemSection(raw){
    const txt=String(raw||'').trim();
    if(!txt)return '';
    const byId=ITEM_LOOKUP_BY_ID[txt.toLowerCase()];
    if(byId)return byId.id;
    const byDisplay=ITEM_LOOKUP_BY_DISPLAY[txt.toLowerCase()];
    if(byDisplay)return byDisplay;
    const m=txt.match(/\[([^\]]+)\]\s*$/);
    if(m){
        const cand=String(m[1]||'').trim();
        const hit=ITEM_LOOKUP_BY_ID[cand.toLowerCase()];
        if(hit)return hit.id;
    }
    const byName=ITEM_LOOKUP_BY_NAME[txt.toLowerCase()];
    if(byName&&byName.length===1)return byName[0].id;
    return txt;
}

// ═══════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════
function showTip(e,t,b){e.stopPropagation();e.preventDefault();const p=document.getElementById('tipPop');document.getElementById('tipT').textContent=t;document.getElementById('tipB').innerHTML=b.replace(/\n/g,'<br>');p.classList.add('show');const r=e.target.getBoundingClientRect();let top=r.bottom+8,left=r.left;if(left+380>window.innerWidth)left=window.innerWidth-400;if(left<10)left=10;if(top+300>window.innerHeight)top=r.top-310;p.style.top=top+'px';p.style.left=left+'px';}
function closeTip(){document.getElementById('tipPop').classList.remove('show');}
