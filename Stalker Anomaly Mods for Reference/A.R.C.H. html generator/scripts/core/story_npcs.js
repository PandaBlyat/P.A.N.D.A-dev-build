// ═══════════════════════════════════════════
// STORY NPC — Vanilla Dialog Registry
// Maps each unique NPC to their vanilla actor_dialog entries.
// Source: References/Vanilla/configs/gameplay/character_desc_*.xml
// ═══════════════════════════════════════════

const STORY_NPC_DIALOGS = {
    // ── Cordon ──
    'esc_2_12_stalker_trader': [
        'dm_init_trader','sidorovich_questlines_about_dialog','drx_sl_esc_m_trader_game_start_dialog_1',
        'sidorovich_living_legend','sidorovich_living_legend_finish',
        'sidorovich_mortal_sin','sidorovich_mortal_sin_envoy','sidorovich_mortal_sin_report','sidorovich_mortal_sin_ambush','sidorovich_mortal_sin_zone_hero',
        'sidorovich_operation_afterglow','sidorovich_operation_afterglow_transmission_report',
        'dm_important_documents','drx_sl_cf_task_completed_dialog','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_esc_m_trader_meet_dialog','dm_broker_dialog','dm_ordered_task_dialog','dm_lifestyle',
        'buy_route','dm_bribe','drx_sl_change_faction_dialog','actor_break_dialog','devushka_3_quest'
    ],
    'esc_main_base_trader_mlr': [
        'dm_init_trader','buy_route','actor_break_dialog'
    ],
    'esc_3_16_military_trader': [
        'dm_init_trader','dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'guid_esc_mlr_military','guid_esc_mlr_military_vert','guid_esc_mlr_military_list',
        'dm_bribe','buy_route','actor_break_dialog'
    ],
    'esc_smart_terrain_5_7_loner_mechanic_stalker': [
        'dm_init_trader','dm_init_mechanic','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_esc_smart_terrain_5_7_loner_mechanic_stalker_meet_dialog','drx_sl_mechanic_task_dialog',
        'actor_break_dialog','dm_encrypted_pda','awr_tech_dialog_drink_1','dm_tech_repair'
    ],
    'army_south_mechan_mlr': [
        'dm_init_trader','dm_init_mechanic','army_south_mechan_mlr_st',
        'dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'dm_encrypted_pda','dm_tech_repair','awr_tech_dialog_drink_1','actor_break_dialog'
    ],

    // ── Garbage ──
    'hunter_gar_trader': [
        'dm_init_trader','hunter_trader_meet','dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'about_baraholka_hunter_trader','dm_lifestyle','actor_break_dialog'
    ],
    'baraholka_trader': [
        'dm_init_trader','dm_broker_dialog','baraholka_trader_talking','actor_break_dialog'
    ],
    'baraholka_trader_night': [
        'dm_init_trader','dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'dm_broker_dialog','actor_break_dialog'
    ],

    // ── Bar ──
    'bar_visitors_barman_stalker_trader': [
        'dm_init_batender','barkeep_living_legend','barkeep_100rads',
        'dm_ordered_task_dialog','dm_ordered_task_completed_dialog','dm_ordered_task_cancel_dialog',
        'dm_important_documents','debt_register','debt_pay_off',
        'buy_route','dm_broker_dialog','actor_break_dialog','devushka_4_help','devushka_help'
    ],
    'bar_visitors_stalker_mechanic': [
        'dm_init_trader','dm_init_mechanic','story_dolg_m',
        'drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_bar_visitors_stalker_mechanic_meet_dialog','drx_sl_mechanic_task_dialog',
        'dm_tech_repair','dm_encrypted_pda',
        'zat_b3_stalker_tech_drink_1','zat_b3_stalker_tech_drink_2','zat_b3_stalker_tech_drink_3',
        'awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'bar_dolg_medic': [
        'dm_init_medic','dm_medic_general','bar_dolg_medic_talking',
        'dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],

    // ── Agroprom ──
    'agr_smart_terrain_1_6_army_trader_stalker': [
        'dm_init_trader','guid_agr_mlr_military','guid_agr_mlr_military_vert','guid_agr_mlr_military_list',
        'buy_route','dm_broker_dialog','find_blackbox_mlr_reward_army','actor_break_dialog'
    ],
    'agr_smart_terrain_1_6_army_mechanic_stalker': [
        'dm_init_trader','dm_init_mechanic','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_agr_smart_terrain_1_6_army_mechanic_stalker_meet_dialog','drx_sl_mechanic_task_dialog',
        'dm_encrypted_pda','dm_tech_repair','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'agr_smart_terrain_1_6_army_medic_stalker': [
        'dm_init_medic','dm_medic_general','actor_break_dialog'
    ],
    'agr_1_6_medic_army_mlr': [
        'dm_init_medic','dm_medic_general','rogovets_about_himself_1_6_army_mlr',
        'dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],
    'agr_1_6_barman_army_mlr': [
        'dm_init_batender','barmen_about_himself_1_6_army_mlr','actor_break_dialog'
    ],

    // ── Dark Valley ──
    'val_smart_terrain_7_4_bandit_trader_stalker': [
        'dm_init_trader','bandit_trader_st','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_val_smart_terrain_7_4_bandit_trader_stalker_meet_dialog',
        'dm_ordered_task_dialog','buy_route','debt_register','debt_pay_off','actor_break_dialog'
    ],
    'val_smart_terrain_7_3_bandit_mechanic_stalker': [
        'dm_init_trader','dm_init_mechanic','bandit_mechanic_st','dm_ordered_task_completed_dialog',
        'dm_broker_dialog','drx_sl_mechanic_task_dialog',
        'dm_tech_repair','dm_encrypted_pda','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'bandit_main_base_medic_mlr': [
        'dm_init_medic','dm_medic_general','dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],

    // ── Army Warehouses ──
    'mil_smart_terrain_7_10_freedom_trader_stalker': [
        'dm_init_trader','dm_ordered_task_completed_dialog','dm_broker_dialog',
        'dm_ordered_task_dialog','buy_route','debt_register','debt_pay_off','actor_break_dialog'
    ],
    'mil_smart_terrain_7_7_freedom_mechanic_stalker': [
        'dm_init_trader','dm_init_mechanic','dm_ordered_task_completed_dialog',
        'dm_tech_repair','dm_broker_dialog','drx_sl_mechanic_task_dialog',
        'dm_encrypted_pda','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'mil_freedom_medic': [
        'dm_init_medic','dm_medic_general','dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],
    'mil_freedom_barman_mlr': [
        'dm_init_batender','actor_break_dialog'
    ],

    // ── Yantar ──
    'yan_stalker_sakharov': [
        'dm_init_trader','sakharov_questlines_about_dialog','drx_sl_yan_stalker_sakharov_game_start_dialog_1',
        'sakharov_living_legend','sakharov_living_legend_finish',
        'sakharov_mortal_sin','sakharov_mortal_sin_envoy','sakharov_mortal_sin_report','sakharov_mortal_sin_ambush','sakharov_mortal_sin_zone_hero',
        'sakharov_operation_afterglow','sakharov_operation_afterglow_transmission_report',
        'dm_important_documents','dm_lifestyle','drx_sl_cf_task_completed_dialog','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_yan_stalker_sakharov_meet_dialog',
        'yan_stalker_sakharov_about_brain_scorcher','yan_stalker_sakharov_bad_psi_helmet','yan_stalker_sakharov_good_psi_helmet','yan_stalker_sakharov_upgrade_psi_helmet',
        'dm_ordered_task_dialog','buy_route','drx_sl_change_faction_dialog','actor_break_dialog'
    ],
    'mechanic_army_yan_mlr': [
        'dm_init_trader','dm_init_mechanic','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'army_yan_mec_about_tool','drx_sl_mechanic_task_dialog',
        'dm_tech_repair','dm_encrypted_pda','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'yan_povar_army_mlr': [
        'dm_init_batender','meet_povar_army','barter_povar_army','remember_dyx_barter','actor_break_dialog'
    ],

    // ── Swamps ──
    'mar_smart_terrain_doc_doctor': [
        'doctor_living_legend','doctor_living_legend_strelok','actor_break_dialog'
    ],
    'mar_base_owl_stalker_trader': [
        'dm_init_trader','dm_ordered_task_completed_dialog','dm_broker_dialog','dm_ordered_task_dialog',
        'mar_smart_terrain_base_trader_background','buy_route','debt_register','debt_pay_off','actor_break_dialog'
    ],
    'mar_base_stalker_tech': [
        'dm_init_trader','dm_init_mechanic','dm_tech_repair','dm_ordered_task_completed_dialog',
        'drx_sl_mechanic_task_dialog','mar_smart_terrain_base_tech_background',
        'dm_encrypted_pda','marsh_stalker_tech_pragmatic_research','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'mar_base_stalker_barmen': [
        'dm_init_batender','story_b_cs','story_dog','about_dog_marsh_part_two',
        'drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog','drx_sl_mar_base_stalker_barmen_meet_dialog',
        'dm_ordered_task_dialog','mar_smart_terrain_base_barman_background','actor_break_dialog'
    ],
    'mar_smart_terrain_base_doctor': [
        'dm_init_medic','dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'dm_medic_general','marsh_stalker_medic_background','marsh_stalker_medic_about_people','marsh_stalker_medic_about_zone',
        'actor_break_dialog'
    ],

    // ── Dead City ──
    'cit_killers_merc_trader_stalker': [
        'dm_init_trader','dushman_questlines_about_dialog','drx_sl_cit_killers_merc_trader_stalker_game_start_dialog_1',
        'drx_isg_cit_killers_merc_trader_stalker_game_start_dialog_1','hb_dushman_isg_intel_dialog',
        'dushman_living_legend','dushman_living_legend_finish',
        'dushman_mortal_sin','dushman_mortal_sin_envoy','dushman_mortal_sin_report','dushman_mortal_sin_ambush','dushman_mortal_sin_zone_hero',
        'dushman_operation_afterglow','dushman_operation_afterglow_transmission_report',
        'drx_sl_cf_task_completed_dialog','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_cit_killers_merc_trader_stalker_meet_dialog','dm_broker_dialog','dm_important_documents',
        'buy_route','debt_register','debt_pay_off','dm_ordered_task_dialog','drx_sl_change_faction_dialog',
        'find_blackbox_mlr_reward_killer','actor_break_dialog'
    ],
    'cit_killers_merc_mechanic_stalker': [
        'dm_init_trader','dm_init_mechanic','drx_sl_task_completed_dialog','dm_ordered_task_completed_dialog',
        'drx_sl_cit_killers_merc_mechanic_stalker_meet_dialog','drx_sl_mechanic_task_dialog',
        'dm_tech_repair','dm_encrypted_pda','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'cit_killers_merc_medic_stalker': [
        'dm_init_medic','dm_medic_general','dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],
    'cit_killers_merc_barman_mlr': [
        'dm_init_batender','talk_to_aslan_on_main_base_merk','aslan_st_about_job','aslan_living_legend',
        'dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'talk_to_aslan_about_lottery','lottery_ds_aslan_mlr','dm_bribe','actor_break_dialog'
    ],

    // ── Zaton ──
    'zat_b30_owl_stalker_trader': [
        'dm_init_trader','dm_broker_dialog','owl_story','find_blackbox_mlr_reward_owl',
        'buy_route','debt_register','debt_pay_off','actor_break_dialog'
    ],
    'zat_a2_stalker_mechanic': [
        'dm_init_trader','dm_init_mechanic','dm_ordered_task_completed_dialog',
        'drx_sl_mechanic_task_dialog','dm_encrypted_pda','dm_tech_repair','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'zat_tech_mlr': [
        'dm_init_trader','dm_init_mechanic','zat_tech_mlr_st',
        'dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'dm_tech_repair','dm_encrypted_pda','awr_tech_dialog_drink_1','actor_break_dialog'
    ],
    'zat_b22_stalker_medic': [
        'dm_init_medic','dm_medic_general','dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],
    'zat_a2_stalker_barmen': [
        'dm_init_batender','drx_sl_task_completed_dialog','beard_living_legend','boroda_story',
        'dm_ordered_task_completed_dialog','drx_sl_zat_a2_stalker_barmen_meet_dialog',
        'dm_ordered_task_dialog','zat_a2_stalker_barmen_actor_info','actor_break_dialog','devushka_boroda_help'
    ],

    // ── Jupiter ──
    'jup_a6_freedom_trader_ashot': [
        'dm_init_trader','actor_break_dialog'
    ],
    'jup_b217_stalker_tech': [
        'dm_init_trader','dm_init_mechanic','dm_ordered_task_completed_dialog',
        'drx_sl_mechanic_task_dialog','dm_tech_repair','actor_break_dialog'
    ],
    'jup_a6_stalker_medik': [
        'dm_init_medic','dm_medic_general','dm_ordered_task_dialog','dm_ordered_task_completed_dialog','actor_break_dialog'
    ],
    'jup_a6_stalker_barmen': [
        'dm_init_batender','hawaiian_yanov','buy_route','actor_break_dialog'
    ],

    // ── Pripyat ──
    'trader_pri_a15_mlr': [
        'dm_init_trader','buy_route','actor_break_dialog'
    ],
    'pri_a16_mech_mlr': [
        'dm_init_trader','dm_init_mechanic','dm_ordered_task_dialog','dm_ordered_task_completed_dialog',
        'dm_tech_repair','actor_break_dialog'
    ],
    'pri_medic_stalker': [
        'dm_init_trader','jup_b19_freedom_yar_pripyat_healing','jup_b19_freedom_yar_break_dialog'
    ]
};

// ── Common vanilla dialogs (present on most NPCs by role) ──
// These are service dialogs that ARCH should NOT strip — they provide core gameplay.
const STORY_NPC_COMMON_DIALOGS = {
    trader:   ['dm_init_trader','buy_route','actor_break_dialog'],
    mechanic: ['dm_init_trader','dm_init_mechanic','dm_tech_repair','dm_encrypted_pda','awr_tech_dialog_drink_1','actor_break_dialog'],
    medic:    ['dm_init_medic','dm_medic_general','actor_break_dialog'],
    barman:   ['dm_init_batender','actor_break_dialog'],
    tasks:    ['dm_ordered_task_dialog','dm_ordered_task_completed_dialog'],
    broker:   ['dm_broker_dialog'],
    debt:     ['debt_register','debt_pay_off'],
    storyline:['drx_sl_task_completed_dialog','drx_sl_cf_task_completed_dialog','drx_sl_change_faction_dialog']
};

// Returns unique (non-common) dialogs for an NPC — the ones specific to that character
function getStoryNpcUniqueDialogs(npcId) {
    var all = STORY_NPC_DIALOGS[npcId];
    if (!all) return [];
    var common = new Set();
    Object.values(STORY_NPC_COMMON_DIALOGS).forEach(function(arr) {
        arr.forEach(function(d) { common.add(d); });
    });
    // Also skip drx_sl_*_meet_dialog and drx_sl_*_game_start_dialog (auto-generated)
    return all.filter(function(d) {
        if (common.has(d)) return false;
        if (d.indexOf('_meet_dialog') >= 0) return false;
        if (d.indexOf('_game_start_dialog') >= 0) return false;
        if (d.indexOf('drx_sl_mechanic_task_dialog') >= 0) return false;
        return true;
    });
}

// Vanilla service category definitions — maps category ID to detection dialog IDs
var STORY_NPC_SERVICE_CATEGORIES = [
    {id:'trade',    label:'Trade',          detect:['dm_init_trader']},
    {id:'repair',   label:'Repair/Upgrade', detect:['dm_init_mechanic','dm_tech_repair']},
    {id:'healing',  label:'Healing',        detect:['dm_init_medic','dm_medic_general']},
    {id:'barman',   label:'Food/Drink',     detect:['dm_init_batender']},
    {id:'tasks',    label:'Tasks',          detect:['dm_ordered_task_dialog']},
    {id:'broker',   label:'Broker',         detect:['dm_broker_dialog']},
    {id:'debt',     label:'Debt',           detect:['debt_register']},
    {id:'bribe',    label:'Bribe',          detect:['dm_bribe']}
];

// Returns which vanilla service categories this NPC has, based on their dialog list
function getStoryNpcServiceCategories(npcId) {
    var all = STORY_NPC_DIALOGS[npcId];
    if (!all) return [];
    var dlgSet = new Set(all);
    var result = [];
    STORY_NPC_SERVICE_CATEGORIES.forEach(function(cat) {
        var has = cat.detect.some(function(d) { return dlgSet.has(d); });
        if (has) result.push(cat);
    });
    return result;
}

// Vanilla dialog content for story NPCs — auto-extracted from References/Vanilla
// FILTERED: only simple top-level lore/flavor dialogs, no quest gates or script bindings
// DO NOT EDIT — regenerate with extract script
const STORY_NPC_VANILLA_DIALOG_DATA = {
 "army_south_mechan_mlr": {
  "army_south_mechan_mlr_st": {
   "phrases": [
    {
     "id": "0",
     "text": "I see you were looking over that old APC. What are you - a mechanic, a driver?",
     "next": [
      "1"
     ],
     "sid": "army_south_mechan_mlr_st_0"
    },
    {
     "id": "1",
     "text": "Oh, I'm the technician assigned to this checkpoint.",
     "next": [
      "2"
     ],
     "sid": "army_south_mechan_mlr_st_1"
    },
    {
     "id": "2",
     "text": "What should I call you?",
     "next": [
      "3"
     ],
     "sid": "army_south_mechan_mlr_st_2"
    },
    {
     "id": "3",
     "text": "Well, there's not much need for formality in my book. Given my work, my military rank feels more honourary than practical. In case of attack, you'd hardly find me coordinating troops, or duking it out with a rifle. My name's Sergey, but you can call me Seryoga.",
     "next": [
      "4"
     ],
     "sid": "army_south_mechan_mlr_st_3"
    },
    {
     "id": "4",
     "text": "Nice to meet you, Seryoga.",
     "next": [
      "5"
     ],
     "sid": "army_south_mechan_mlr_st_4"
    },
    {
     "id": "5",
     "text": "Likewise. If you need anything fixed up, just let me know.",
     "next": [
      "6"
     ],
     "sid": "army_south_mechan_mlr_st_5"
    },
    {
     "id": "6",
     "text": "What do you make of the current situation?",
     "next": [
      "7"
     ],
     "sid": "army_south_mechan_mlr_st_6"
    },
    {
     "id": "7",
     "text": "There's not much to say. There's a village full of illegals just a short walk from here, but Command refuses to order any action against it. Sometimes our men patrol the roads or roam the swamps but, generally, it's a hostile place for our soldiers. The number of criminals - these so-called 'stalkers' - skulking about between here and our forward base in Agroprom, let alone between here and Pripyat, is staggering.",
     "next": [
      "8"
     ],
     "sid": "army_south_mechan_mlr_st_7"
    },
    {
     "id": "8",
     "text": "Do these so-called criminals attack this outpost very often?",
     "next": [
      "9"
     ],
     "sid": "army_south_mechan_mlr_st_8"
    },
    {
     "id": "9",
     "text": "Nah, there'd be absolute hell to pay if this place was ever raided directly. I think even the dumbest stalker knows that, if they attack this place, the military presence will rapidly escalate and crackdown on them. We're like a sleeping bear - no one wants to poke us too hard.",
     "next": [
      "10"
     ],
     "sid": "army_south_mechan_mlr_st_9"
    },
    {
     "id": "10",
     "text": "I'll keep that in mind.",
     "give_info": "army_south_mechan_mlr_st_over",
     "sid": "army_south_mechan_mlr_st_10"
    }
   ],
   "dont_has_info": [
    "army_south_mechan_mlr_st_over"
   ]
  }
 },
 "hunter_gar_trader": {
  "hunter_trader_meet": {
   "phrases": [
    {
     "id": "0",
     "text": "Cosy place you have here.",
     "next": [
      "1"
     ],
     "sid": "hunter_trader_meet_0"
    },
    {
     "id": "1",
     "text": "Damn right it is! Welcome to the Train Hangar, repurposed by yours truly into a humble hunting lodge. It's a safe place to unwind... for the most part.",
     "next": [
      "2"
     ],
     "sid": "hunter_trader_meet_1"
    },
    {
     "id": "2",
     "text": "Tell me more about this lodge of yours.",
     "next": [
      "3"
     ],
     "sid": "hunter_trader_meet_2"
    },
    {
     "id": "3",
     "text": "Eh, simply put, this place is for hunters. Whether they're professional or amateur doesn't matter. I reward those who take on hunting jobs for me, I pay well for any mutant trophies you might turn in, and I'll sell you food and hunting equipment real cheap - unlike some other traders around here, the desire to share my passion with others comes first. Never cared much for money grubbers anyways.",
     "next": [
      "4"
     ],
     "sid": "hunter_trader_meet_3"
    },
    {
     "id": "4",
     "text": "Are there any other hunters around here, or just you?",
     "next": [
      "5"
     ],
     "sid": "hunter_trader_meet_4"
    },
    {
     "id": "5",
     "text": "Hunters from Rostok and Dark Valley tend to stop by here, though it's not always easy getting them to get along.\\n \\nBesides that, I had a few mates here with me. We were all hunting partners in the outside world, you know? Gonta, Trapper, Fox...all good people. We all got together down here to have a proper funeral for Fox, but sadly the other two couldn't stay - by the sounds of it, the stalkers up north really need them.",
     "next": [
      "6"
     ],
     "sid": "hunter_trader_meet_5"
    },
    {
     "id": "6",
     "text": "Maybe I'll go pay them a visit sometime.",
     "give_info": "hunter_trader_meet_info",
     "sid": "hunter_trader_meet_6"
    }
   ],
   "dont_has_info": [
    "hunter_trader_meet_info"
   ]
  }
 },
 "baraholka_trader": {
  "baraholka_trader_talking": {
   "phrases": [
    {
     "id": "0",
     "text": "What kind of place is this?",
     "next": [
      "1"
     ],
     "sid": "baraholka_trader_talking_0"
    },
    {
     "id": "1",
     "text": "This, fellow stalker, is the flea market. Lots of diggers and small-time traders pawn off old wares as they pass through here. In truth, most of it is pretty garbage, but on special nights we get some real gems coming through, so we make do. So, do you have anything you want to sell?",
     "next": [
      "2"
     ],
     "sid": "baraholka_trader_talking_1"
    },
    {
     "id": "2",
     "text": "What are your experiences with the other stalkers around here?",
     "next": [
      "3"
     ],
     "sid": "baraholka_trader_talking_2"
    },
    {
     "id": "3",
     "text": "What kind of question is that? This is the Garbage. All sorts of people come through these parts. Some are stalkers who want to be traders. Some of them even have some pretty nice stuff to sell. Others are bandits, mercs, even military. Sometimes we get along, sometimes there's a fight. That's why we have guards around.\\n \\nOthers are Duty. Now, don't get me wrong, Duty soldiers tend to be upright guys individually, but get enough of them into a group, and I swear they become more fanatical than even the Monolith.\\n \\nOverall, we have mixed, colourful experiences with the different groups around here. As long as they don't disrupt the little market we have here though, we'll get along just fine.",
     "give_info": "baraholka_trader_talk",
     "sid": "baraholka_trader_talking_3"
    }
   ],
   "dont_has_info": [
    "baraholka_trader_talk"
   ]
  }
 },
 "bar_visitors_barman_stalker_trader": {
  "barkeep_100rads": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about this place.",
     "next": [
      "1"
     ],
     "sid": "barkeep_100rads_0"
    },
    {
     "id": "1",
     "text": "Welcome to the 100 Rads bar, my little oasis in this slice of hell. This neighbourhood is among the safest in the Zone, thanks to Duty. You'll be safe too as long as you keep a cool head. Stalkers from all over travel here to eat, rest, talk, find information or seek work. So, what are you after? What can old Barkeep do for you today?",
     "sid": "barkeep_100rads_1"
    }
   ]
  }
 },
 "bar_visitors_stalker_mechanic": {
  "story_dolg_m": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about yourself.",
     "next": [
      "1"
     ],
     "sid": "story_dolg_m_0"
    },
    {
     "id": "1",
     "text": "Hm, yeah, alright. Why not?\\n \\nI used to be stationed at the Agroprom Research Institute, back before I got my promotion. Before that, before the Zone came into existence, I was a car mechanic. Duty noticed my skills as a handyman after I had been around for a while, so eventually they decided to assign me as the technician here. I prefer tinkering with heavy firearms and assault weapons...I hate working on snipers, especially NATO ones.",
     "next": [
      "2"
     ],
     "sid": "story_dolg_m_1"
    },
    {
     "id": "2",
     "text": "And what's that smell? Didn't think Duty allowed heavy drinking.",
     "next": [
      "3"
     ],
     "sid": "story_dolg_m_2"
    },
    {
     "id": "3",
     "text": "Man, it's hard getting by without a drink. Or a few. I wish I could've helped out at Yanov when the Monolith hit... but, then again, I probably wouldn't be alive if I wasn't ordered to stay put here. So many good men were lost defending that place...Huh, looks like we've gone way off topic. Anyway, don't be shy, now - show me your toys if you need 'em fixed.",
     "next": [
      "4"
     ],
     "sid": "story_dolg_m_3"
    },
    {
     "id": "4",
     "text": "I'll see if I have anything.",
     "give_info": "story_dolg_m",
     "sid": "story_dolg_m_4"
    }
   ],
   "dont_has_info": [
    "story_dolg_m"
   ]
  }
 },
 "bar_dolg_medic": {
  "bar_dolg_medic_talking": {
   "phrases": [
    {
     "id": "0",
     "text": "Who are you?",
     "next": [
      "1"
     ],
     "sid": "bar_dolg_medic_talking_0"
    },
    {
     "id": "1",
     "text": "I'm the local sawbones, although I used to just be a paramedic. Lieutenant Sostradov's the name, but the stalkers around here call me Aspirin. Yeah, really. I've gotten quite good at treating a wide range of illnesses and injuries over the years. I also act as the resident pharmacist - after all, you need some meds with you in the field if you hope to return alive for proper treatment.",
     "next": [
      "2"
     ],
     "sid": "bar_dolg_medic_talking_1"
    },
    {
     "id": "2",
     "text": "How did you come to be a medic for Duty?",
     "next": [
      "3"
     ],
     "sid": "bar_dolg_medic_talking_2"
    },
    {
     "id": "3",
     "text": "How does anyone come to be in Duty? The Zone takes something from you. And then it takes again, and then again. Until you have nothing left but the Zone itself. Medic or no, that's how a stalker comes to be in Duty.\\n \\nWe're the ones who lost everything to this hellhole, yet stuck around to keep others from suffering the same fate. Of course, most Dutyers choose to protect people by trying to kill the Zone. That's not me.\\n \\nI'm here to undo all the injuries it leaves on people. To make sure the stalkers of this town get to live another day when their friends drag their bloodied bodies through the streets from whatever fool expedition they went on.\\n \\nAs long as you get yourself back here alive, I'll make you feel good as new. I won't even overcharge you, unlike some other traders around here.",
     "next": [
      "4"
     ],
     "sid": "bar_dolg_medic_talking_3"
    },
    {
     "id": "4",
     "text": "Thanks, Aspirin.",
     "give_info": "medic_dolg_bar_talk",
     "sid": "bar_dolg_medic_talking_4"
    }
   ],
   "dont_has_info": [
    "medic_dolg_bar_talk"
   ]
  }
 },
 "agr_smart_terrain_1_6_army_trader_stalker": {
  "guid_agr_mlr_military": {
   "phrases": [
    {
     "id": "0",
     "text": "Can you organize a trip? There's somewhere I need to fly.",
     "next": [
      "1"
     ],
     "sid": "guid_agr_mlr_military_0"
    },
    {
     "id": "1",
     "text": "Yeah, I can take you to the Cordon and Yantar... Wait, who are you, even? I offer transport, but not for an ordinary soldier like you. Shoo.",
     "give_info": "guid_agr_mlr_military_give",
     "sid": "guid_agr_mlr_military_1"
    }
   ],
   "dont_has_info": [
    "guid_agr_mlr_military_give"
   ]
  }
 },
 "agr_1_6_medic_army_mlr": {
  "rogovets_about_himself_1_6_army_mlr": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about yourself.",
     "next": [
      "1"
     ],
     "sid": "rogovets_about_himself_1_6_army_mlr_0"
    },
    {
     "id": "1",
     "text": "I'm the medic attached to this base. I first arrived in the Zone on contract years ago. After some preparation, I got myself assigned to the prestigious Fairway Group. Sadly, Operation Fairway itself was a failure. We had little choice but to bunker down in Pripyat - well, those of us who were still alive, at least - until an investigator from the SSU arrived and helped in our evacuation.\\n \\nI'm glad to be rid of that place. Strange things happen all the time in that cursed city, and one of my oddest experiences entailed waking up in a locked refrigerator. To this day, I have no idea how I got there, or what I was doing beforehand. The other men teased me for it, but I remember the sweat, the lack of air, the veil over my eyes. Once more soldiers started encountering the so-called \"mythical\" Controllers, well, let's say the teasing stopped.",
     "next": [
      "2"
     ],
     "sid": "rogovets_about_himself_1_6_army_mlr_1"
    },
    {
     "id": "2",
     "text": "And then what happened? Why didn't you quit?",
     "next": [
      "3"
     ],
     "sid": "rogovets_about_himself_1_6_army_mlr_2"
    },
    {
     "id": "3",
     "text": "Oh, I did \"quit\" for a while. Or rather, I went on reserve. After my commanding officer got dismissed for Operation Fairway's failure, I got a bad taste in my mouth. I then left active service as soon as I could to advance my medical career instead. Still, there's something special about working on soldiers, and I feel I'd be abandoning them if I didn't return eventually. It's not the grunts' fault that some of the general staff are - eheh, er, ahem.\\n \\nAs I was saying, Colonel Kuznetsov's command style is certainly not the way my old commander, the former Colonel Kovalsky, would've done things. But I'm happy to be keeping the troops alive all the same. I would be happier if that SSU investigator - Colonel Degtyarev - took a more active leadership role here as well, but I suppose it's enough to know he's still out there, kicking around in the Zone somewhere. He's saved my life more times than I'd care to admit.",
     "next": [
      "4"
     ],
     "sid": "rogovets_about_himself_1_6_army_mlr_3"
    },
    {
     "id": "4",
     "text": "Understood. Thanks for sharing, but I must get back to business.",
     "give_info": "rogovets_about_himself_1_6_army_mlr1",
     "sid": "rogovets_about_himself_1_6_army_mlr_4"
    }
   ],
   "dont_has_info": [
    "rogovets_about_himself_1_6_army_mlr1"
   ]
  }
 },
 "agr_1_6_barman_army_mlr": {
  "barmen_about_himself_1_6_army_mlr": {
   "phrases": [
    {
     "id": "0",
     "text": "Who are you?",
     "next": [
      "1"
     ],
     "sid": "barmen_about_himself_1_6_army_mlr_0"
    },
    {
     "id": "1",
     "text": "Well, I'm the local barman - or a manager of provisions - whichever you prefer. The troops around here call me Commander. My first stint in the Zone was as a liquidator, cleaning up around the NPP after the accident of '86. I'm not exactly from here, but after the Soviet Union fell I decided to stay in the Zone on contract. I've got some experience on me, hah.",
     "next": [
      "2"
     ],
     "sid": "barmen_about_himself_1_6_army_mlr_1"
    },
    {
     "id": "2",
     "text": "What was it like, cleaning up after the first accident?",
     "next": [
      "3"
     ],
     "sid": "barmen_about_himself_1_6_army_mlr_2"
    },
    {
     "id": "3",
     "text": "Well, I was much younger back then - just an army draftee, you see? Not the half-centenarian you see today. I was lucky. Only ever got to hose down the dust off of empty villages and turn over the soil afterwards. Officers would measure the radiation, and I'd get sent in to clean it up. However, the liquidators near the power station ended up waist-deep in shit. Up there, even our technology died from the fallout, let alone the people. Imagine that.\\n \\nSo, they cleaned the roofs of graphite with freakin' shovels. But it had to be done, for the good of the state - whatever that means now. I used to think radiation was a strange thing -  how it curses some and spares others, like Dyatlov, who survived to end up in prison. But, compared to what's been happening since 2006, I don't know. There are certainly stranger things than radiation going on these days.",
     "give_info": "barmen_about_himself_1_6_army_mlr1",
     "sid": "barmen_about_himself_1_6_army_mlr_3"
    }
   ],
   "dont_has_info": [
    "barmen_about_himself_1_6_army_mlr1"
   ]
  }
 },
 "val_smart_terrain_7_4_bandit_trader_stalker": {
  "bandit_trader_st": {
   "phrases": [
    {
     "id": "0",
     "text": "Why is your nickname so lousy?",
     "next": [
      "1"
     ],
     "sid": "bandit_trader_st_0"
    },
    {
     "id": "1",
     "text": "Look who's talking! Goddamn greenhorns, trying to act all tough... You don't handle them, they can't even hold their own dicks straight when taking a piss. If you do, they act like lousy morons, to put it in your own words.",
     "next": [
      "2"
     ],
     "sid": "bandit_trader_st_1"
    },
    {
     "id": "2",
     "text": "Hey, easy - didn't mean anything by it. Just didn't know what to say.",
     "next": [
      "3"
     ],
     "sid": "bandit_trader_st_2"
    },
    {
     "id": "3",
     "text": "Alright, whatever... Apology accepted. Things ain't easy when you get old and your nerves are fucked.",
     "next": [
      "4"
     ],
     "sid": "bandit_trader_st_3"
    },
    {
     "id": "4",
     "text": "Understood. How did you get your name?",
     "next": [
      "5"
     ],
     "sid": "bandit_trader_st_4"
    },
    {
     "id": "5",
     "text": "I'll tell you, if only to put an end to your yapping. My story began under the Soviet Union, before the first time I ended up in prison. I wanted a good life... Did some trade hustle, and been caught for that one day. So after I did my time, I started making new connections and selling stolen stuff. Did that for three years before I, once again, ended up in jail. Got out, but the USSR was gone... You know what the most frustrating thing was?",
     "next": [
      "6"
     ],
     "sid": "bandit_trader_st_5"
    },
    {
     "id": "6",
     "text": "No. Never saw the Soviet Union at a reasonable age.",
     "next": [
      "7"
     ],
     "sid": "bandit_trader_st_6"
    },
    {
     "id": "7",
     "text": "First time I ended up in prison, it was \"business\"... or \"profiteering\", in old Soviet speech. Nowadays, anyone who's successful can end up behind bars. That place is where you feel your ass burning.",
     "next": [
      "8"
     ],
     "sid": "bandit_trader_st_7"
    },
    {
     "id": "8",
     "text": "[continue...]",
     "next": [
      "9"
     ],
     "sid": "bandit_trader_st_8"
    },
    {
     "id": "9",
     "text": "When I got out of my second stint, everything crashed down. No income at all, and there were loads of people around who were doing the same thing as I was. When the Zone came into existence, I figured I'd go see it for myself.",
     "next": [
      "10"
     ],
     "sid": "bandit_trader_st_9"
    },
    {
     "id": "10",
     "text": "[continue...]",
     "next": [
      "11"
     ],
     "sid": "bandit_trader_st_10"
    },
    {
     "id": "11",
     "text": "By the way, they call me Olivius because, like the tree I got my nickname from, you can hold me over the fire... leave me out to dry time and time again... I'll survive it. Heh, I'll survive it better than you for sure. I may already be greying, but I've been here long before Sultan arrived... odds are, I'll be here long after he leaves.",
     "next": [
      "12"
     ],
     "sid": "bandit_trader_st_11"
    },
    {
     "id": "12",
     "text": "Thanks for the history lesson. Sorry once again.",
     "give_info": "bandit_trader_st_over",
     "sid": "bandit_trader_st_12"
    }
   ],
   "dont_has_info": [
    "bandit_trader_st_over"
   ]
  }
 },
 "val_smart_terrain_7_3_bandit_mechanic_stalker": {
  "bandit_mechanic_st": {
   "phrases": [
    {
     "id": "0",
     "text": "Share your story, brother.",
     "next": [
      "1"
     ],
     "sid": "bandit_mechanic_st_0"
    },
    {
     "id": "1",
     "text": "You trying to get me prosecuted or something? Whatever, get comfortable.",
     "next": [
      "2"
     ],
     "sid": "bandit_mechanic_st_1"
    },
    {
     "id": "2",
     "text": "[continue...]",
     "next": [
      "3"
     ],
     "sid": "bandit_mechanic_st_2"
    },
    {
     "id": "3",
     "text": "There were times when my face was constantly on a roll of honor... I worked as a mechanical engineer at a plant and got recognized in my company as the best specialist in that profession. They awarded me prizes and certificates.",
     "next": [
      "4"
     ],
     "sid": "bandit_mechanic_st_3"
    },
    {
     "id": "4",
     "text": "And how did you lose it all? I guess you wanted to start chasing some tail?",
     "next": [
      "5"
     ],
     "sid": "bandit_mechanic_st_4"
    },
    {
     "id": "5",
     "text": "Heh, I do miss the private yoga classes with the girls, if you know what I mean! But nah, that's not what did me in.",
     "next": [
      "6"
     ],
     "sid": "bandit_mechanic_st_5"
    },
    {
     "id": "6",
     "text": "What? Did they start calling you Limpid because you suddenly went limp down under?",
     "next": [
      "7"
     ],
     "sid": "bandit_mechanic_st_6"
    },
    {
     "id": "7",
     "text": "Real fucking comedian, ain't ya? Anyway, after a long shift what I really wanted was to hit the bar with the guys. Had a few too many drinks one day... The boss caught us, and I got fired like some stupid loser.",
     "next": [
      "8"
     ],
     "sid": "bandit_mechanic_st_7"
    },
    {
     "id": "8",
     "text": "Life's a bitch.",
     "next": [
      "9"
     ],
     "sid": "bandit_mechanic_st_8"
    },
    {
     "id": "9",
     "text": "A bitch I doubt you've seen for real. Got a job as an ordinary locksmith and found a new friend by the name of Vitka. The new job barely paid zilch, but thankfully I earned enough to get myself a few rounds once in a while. At one time we got drunk and fucked around... Don't even remember why. Anyway, I stabbed him with a screwdriver - good thing that he didn't die right then and there. Spent a few years in maximum security, and my bitch wife sold everything and ran off. When I got released, I spent all my money on drinks and ended up in the slums... Got here when the Zone came about. Here, everyone's equal: we're all outcasts. I met up with the guys at the Garbage - they found me useful as a technician and let me stay there. Best time in my life... Tons of guns and vodka.",
     "next": [
      "10"
     ],
     "sid": "bandit_mechanic_st_9"
    },
    {
     "id": "10",
     "text": "This isn't the Garbage.",
     "next": [
      "11"
     ],
     "sid": "bandit_mechanic_st_10"
    },
    {
     "id": "11",
     "text": "Amazing observation! And all this time I thought you were blind! I haven't gotten to that part yet, dipstick. The Big-Ass Emission happened, and we hid like little girls.\\n \\nWhen that nightmare was over with, we had a meeting on where the fuck to go: the anomalies that cut off Rostok back then had suddenly cleared away, so we were getting a lot of pressure from Duty to the north, while some cooky priest was trying to flush us out from the south. To make matters worse, our boss at the time, Yoga, had just croaked, and the only one left with the guts to keep us together was our damn bartender.\\n \\nHe broke us up into small groups, had us take various paths to meet back up at this place - the Dark Valley. Then, of course, he died to some amnesiac gunslinger a few months later, leaving us to fend for ourselves for a few years... Olivius kept us ticking over during that time, but it wasn't until Sultan that we got our shit together again.",
     "next": [
      "12"
     ],
     "sid": "bandit_mechanic_st_11"
    },
    {
     "id": "12",
     "text": "That's quite a story.",
     "give_info": "bandit_mechanic_st_over",
     "sid": "bandit_mechanic_st_12"
    }
   ],
   "dont_has_info": [
    "bandit_mechanic_st_over"
   ]
  }
 },
 "yan_stalker_sakharov": {
  "yan_stalker_sakharov_about_brain_scorcher": {
   "phrases": [
    {
     "id": "0",
     "text": "What can you tell me about the Brain Scorcher?",
     "next": [
      "10"
     ],
     "sid": "yan_stalker_sakharov_player_query_brain_scorcher"
    },
    {
     "id": "10",
     "text": "Hmm, well...we still have much to learn, but I suppose it won't hurt to share what little we know with you. The Brain Scorcher seems to emit an invasive frequency that affects the mind of any who journey too close to Pripyat's center, the NPP or the wrong side of the Red Forest. The symptoms include migraines, hallucinations, tunnel vision, and without sounding unprofessional, zombification. If I had to give a scientific estimation, I'd identify the Brain Scorcher as a remote psy-transmitter, though I'd have to conduct more invasive research before fully settling on that conclusion.",
     "give_info": "yan_stalker_sakharov_actor_asked_brain_scorcher",
     "sid": "yan_stalker_sakharov_npc_query_brain_scorcher"
    }
   ],
   "dont_has_info": [
    "yan_stalker_sakharov_actor_asked_brain_scorcher",
    "bar_deactivate_radar_done"
   ]
  }
 },
 "mechanic_army_yan_mlr": {
  "army_yan_mec_about_tool": {
   "phrases": [
    {
     "id": "0",
     "text": "Hey. Who are you?",
     "next": [
      "1"
     ],
     "sid": "army_yan_mec_about_tool_0"
    },
    {
     "id": "1",
     "text": "I'm a transfer from the local military, callsign \"Peregrine\". I was studying as an engineer before my conscription. HQ eventually noticed my knack for fixing things and decided I'd be a lot more useful out here, helping to maintain scientific equipment. The head professor, Sakharov I think, clearly agreed. Come to think of it - he was even a little relieved.",
     "next": [
      "2"
     ],
     "sid": "army_yan_mec_about_tool_1"
    },
    {
     "id": "2",
     "text": "So you're the bunker's new technician? What has that been like so far?",
     "next": [
      "3"
     ],
     "sid": "army_yan_mec_about_tool_2"
    },
    {
     "id": "3",
     "text": "Eh, it beats being stuck at HQ, having an angry CO breathing down your neck all the time, or going on patrol with standing orders to shoot desperate folk in the face.\\n \\nBut, to be honest with you, it's still pretty shit. Thanks to the outstanding dedication of our Supply Corps, I need to argue until I'm blue in the face merely to maintain what we currently have. The esoteric equipment the Ecologists keep here isn't exactly easy to sustain with what's available, let alone upgrade or adapt to the Zone's ever-changing conditions.\\n \\nI tried to get the old receiver here repaired, but all it does is spout a bunch of gibberish. Our guys at the Army Warehouses kicked the bucket seven years ago, but this damn machine still thinks it can hear their voices.",
     "next": [
      "4"
     ],
     "sid": "army_yan_mec_about_tool_3"
    },
    {
     "id": "4",
     "text": "Best of luck to you, then.",
     "give_info": "army_yan_talk",
     "sid": "army_yan_mec_about_tool_4"
    }
   ],
   "dont_has_info": [
    "army_yan_talk"
   ]
  }
 },
 "mar_base_owl_stalker_trader": {
  "mar_smart_terrain_base_trader_background": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about yourself.",
     "next": [
      "1"
     ],
     "sid": "dm_dialog_character_history"
    },
    {
     "id": "1",
     "text": "Spore's the name. I took over this gig about a year ago. Came to the Zone looking for wealth like everybody does and ran into a stalker called Nimble. Found out we shared a lot of the same talents: both got a lot of outside contacts, good at trafficking goods in and out of the Zone, and selling info. So when the Monolith resurgence happened and business was driven south, we followed. Managed to land myself a nice job here after Nimble recommended me to Cold. He was a member of Clear Sky back in the day, y'know? 'Course, Nimble's gone back up to Zaton to help out at the Skadovsk, the madman, but he's left me with a nice little operation here. I now have access to an army-free smuggling route through the swamps, and Clear Sky gets first pick of everything  I get my hands on. Pay Nimble a visit if you ever find yourself north of the Barrier. Even now, he's probably still peddling only the rarest weapons and armour to his fellow stalkers. For the right price, he'll set you up with some of the best damn gear in the Zone.",
     "sid": "marsh_stalker_trader_background"
    }
   ]
  }
 },
 "mar_base_stalker_tech": {
  "mar_smart_terrain_base_tech_background": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about yourself.",
     "next": [
      "1"
     ],
     "sid": "dm_dialog_character_history"
    },
    {
     "id": "1",
     "text": "The name's Novikov, but some call me Grey. I'm the technician who keeps everything working, and the only person any good stalker goes to if their shooter starts jamming. Used to work here a long time ago until just before Cold took over. When everything went to shit, I looked for somewhere greener and got contracted by the scientists up near Jupiter. Was up there for a good few years, until one day, I heard that somehow these guys pulled through, and as soon as my contract was up, I headed back. They took me in without question; my skills with a workbench and my contacts within the scientists were sorely needed. I got us set up working with their guys so we could carry on with our old research. If you fancy the work, they're always looking for guides to the local anomalies. Talk to Spore about it if you're interested.",
     "sid": "marsh_stalker_tech_background"
    }
   ]
  },
  "marsh_stalker_tech_pragmatic_research": {
   "phrases": [
    {
     "id": "0",
     "text": "Clear Sky is big on research, right?",
     "next": [
      "1"
     ],
     "sid": "marsh_stalker_tech_pragmatic_research_0"
    },
    {
     "id": "1",
     "text": "We sure are. Like the Ecologists, we keep trying to understand the Zone better but we don't just observe. We prefer to use the knowledge we gain for practical applications. For example, shards of a Gravi artefact embedded in body armour significantly reduce its weight. The bloodsucker's coagulant can be implemented in a life support system that prevents blood loss during combat. And the resolving capacity of the Flesh's eye helped us develop advanced targeting systems. That's just some of the many ideas we've come up with.",
     "give_info": "pragmatic_research",
     "sid": "marsh_stalker_tech_pragmatic_research_1"
    }
   ],
   "dont_has_info": [
    "pragmatic_research"
   ]
  }
 },
 "mar_base_stalker_barmen": {
  "story_b_cs": {
   "phrases": [
    {
     "id": "0",
     "text": "What can you tell me about Cold?",
     "next": [
      "1"
     ],
     "sid": "story_b_cs_0"
    },
    {
     "id": "1",
     "text": "What can I say? He's earned quite a bit of respect as the current leader of our organization.",
     "next": [
      "2"
     ],
     "sid": "story_b_cs_1"
    },
    {
     "id": "2",
     "text": "How did he earn that respect?",
     "next": [
      "3"
     ],
     "sid": "story_b_cs_2"
    },
    {
     "id": "3",
     "text": "You see, there was some controversy regarding Lebedev, our former leader - who, by the way, I personally never met - and he didn't seem to take the opinions of the faction members into account during their crusade towards the CNPP. That mercenary certainly helped us out, but in the end, it just wasn't worth it. Those who remained at the base were unable to fight back against a resurgence made by the Renegades. The significance of our struggle in the swamps was reduced to zero... and the sacrifices on the way to the Chernobyl NPP, as well as the swamps, turned out to be in vain.",
     "next": [
      "4"
     ],
     "sid": "story_b_cs_3"
    },
    {
     "id": "4",
     "text": "It seems like the faction's resentment towards their leader at that time was justified.",
     "next": [
      "5"
     ],
     "sid": "story_b_cs_4"
    },
    {
     "id": "5",
     "text": "There's more to it... After our troops had returned, we had to start a long war to take everything back. We wouldn't be able to manage in day-to-day life without Cold. He received some help from unaffiliated stalkers and got in touch with people throughout the Garbage and the Cordon. Free stalkers helped us out, and having a charismatic leader certainly didn't hurt. Moreover, he's given an order to all fighters - without exceptions - not to leave here. We'll take any help, but we won't risk the lives of our guys.",
     "next": [
      "6"
     ],
     "sid": "story_b_cs_5"
    },
    {
     "id": "6",
     "text": "Whoever Lebedev was and what he did, you aren't the same faction you used to be.",
     "next": [
      "7"
     ],
     "sid": "story_b_cs_6"
    },
    {
     "id": "7",
     "text": "That's your opinion. Certainly has some value to it. Right now, we have no large-scale goals, except for maybe...er... Anyway, it's probably time we cut the storytelling and start the trading.",
     "next": [
      "8"
     ],
     "sid": "story_b_cs_7"
    },
    {
     "id": "8",
     "text": "Deal.",
     "give_info": "story_b_cs",
     "sid": "story_b_cs_8"
    }
   ],
   "dont_has_info": [
    "story_b_cs"
   ]
  },
  "story_dog": {
   "phrases": [
    {
     "id": "0",
     "text": "Whose pseudodog is that?",
     "next": [
      "1"
     ],
     "sid": "story_dog_0"
    },
    {
     "id": "1",
     "text": "That's Buddy, the Doctor's dog. Doctor asked Cold to keep him safe, as he's started getting a little old.",
     "next": [
      "2"
     ],
     "sid": "story_dog_1"
    },
    {
     "id": "2",
     "text": "Well, by the looks of it, you wouldn't say that he needs it.",
     "next": [
      "3"
     ],
     "sid": "story_dog_2"
    },
    {
     "id": "3",
     "text": "Looks can be deceiving sometimes. This pet is a kind-hearted creature. Now, can I tell you something interesting about this kind of dog?",
     "next": [
      "4"
     ],
     "sid": "story_dog_3"
    },
    {
     "id": "4",
     "text": "Go ahead.",
     "next": [
      "5"
     ],
     "sid": "story_dog_4"
    },
    {
     "id": "5",
     "text": "Pseudodogs don't actually descend from dogs at all, although they share the same ancient ancestor. They kind of originate from wolves - Duty learned that while researching them.",
     "next": [
      "6"
     ],
     "sid": "story_dog_5"
    },
    {
     "id": "6",
     "text": "And how did you come to know this?",
     "next": [
      "7"
     ],
     "sid": "story_dog_6"
    },
    {
     "id": "7",
     "text": "By virtue of my profession, I collect all sorts of stories. To the north, there's a place similar to our swamps called Zaton. I've heard there's an old crank that lives in the old barge, and apparently, he also has a pseudodog. Perhaps you can find out if it's true, if the distance doesn't bother you.",
     "next": [
      "8"
     ],
     "sid": "story_dog_7"
    },
    {
     "id": "8",
     "text": "It's only the entire length of the Zone. Maybe I'll pop over there sometime.",
     "give_info": "story_dog_inf",
     "sid": "story_dog_8"
    }
   ],
   "dont_has_info": [
    "story_dog_inf"
   ]
  },
  "mar_smart_terrain_base_barman_background": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about yourself.",
     "next": [
      "1"
     ],
     "sid": "dm_dialog_character_history"
    },
    {
     "id": "1",
     "text": "I'm the bartender. I serve drinks, food, and keep the radio playing. It's not an exciting job, but still preferable to being out in the field. Been working here for quite a few years now; got caught on the inside of the swamps when the emission hit, so I was pretty much stuck here. Headed south like most people tried to, but I was one of the few that didn't get picked off by bandits on the way. I searched out this base and joined up with Clear Sky. It was either that or die in a puddle somewhere. Spent the first few weeks as a grunt repelling the anarchists from our lookout posts and then got the job as the new bartender when Cold got promoted. Naturally, I accepted, as I'd rather be shooting drinks than bullets. But enough talk! How about a nice cold one?",
     "sid": "marsh_stalker_barman_background"
    }
   ]
  }
 },
 "mar_smart_terrain_base_doctor": {
  "marsh_stalker_medic_background": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about yourself.",
     "next": [
      "1"
     ],
     "sid": "marsh_stalker_medic_background_0"
    },
    {
     "id": "1",
     "text": "Well, I am Professor E.F. Kalancha. Alongside Lebedev and Suslov I was one of the founding members of Clear Sky. Unlike them, may they rest in peace, I stayed behind in the Hidden Base during their fateful raid on the Chernobyl NPP. I am the faction's head researcher. Most of the time I conduct experiments on artefacts, study mutant tissue samples and observe anomalies. Sometimes I cooperate with Novikov to find practical applications for the results of my work. Moreover, out of necessity I have also become the local medic. If you return injured from an excursion or, preferably, with some rare specimen in your bag, well, you know where to find me.",
     "sid": "marsh_stalker_medic_background_1"
    }
   ]
  },
  "marsh_stalker_medic_about_people": {
   "phrases": [
    {
     "id": "0",
     "text": "What do you think about stalkers?",
     "next": [
      "1"
     ],
     "sid": "marsh_stalker_medic_about_people_0"
    },
    {
     "id": "1",
     "text": "Many people think they understand what the Zone truly is. Sadly, they are all mistaken. Some think it is a manifestation of pure evil, others call it a miracle, while certain people can only think of all the riches they might obtain... They are all misguided by basic human prejudices. The Zone is an incomprehensible phenomenon when viewed through the prism of human perception. Far too early for us to even try. Both stalkers and the government act recklessly in their ignorance. We did as well, once, thinking our knowledge superior to everyone else's, and paid dearly for that.",
     "give_info": "kalancha_opinion_stalkers",
     "sid": "marsh_stalker_medic_about_people_1"
    }
   ],
   "dont_has_info": [
    "kalancha_opinion_stalkers"
   ]
  },
  "marsh_stalker_medic_about_zone": {
   "phrases": [
    {
     "id": "0",
     "text": "What do you know about the Zone?",
     "next": [
      "1"
     ],
     "sid": "marsh_stalker_medic_about_zone_0"
    },
    {
     "id": "1",
     "text": "Young man, we have been studying the Zone for several years now but remain none the wiser. I can tell you that the Zone is definitely not a natural phenomenon but rather the result of... a futile endeavour devised by some overly ambitious people. We are unable to reverse its effects. The Zone cannot be destroyed, nor will it disappear of its own accord. Furthermore, experience taught us that any attempt to curb or contain it will have catastrophic consequences. Presently we, Clear Sky, believe that there is only one way to reconcile man with the Zone: coexistence.",
     "next": [
      "2"
     ],
     "sid": "marsh_stalker_medic_about_zone_1"
    },
    {
     "id": "2",
     "text": "That would be easier without emissions ravaging the area every few days. Speaking of which, what is causing them in the first place?",
     "next": [
      "3"
     ],
     "sid": "marsh_stalker_medic_about_zone_2"
    },
    {
     "id": "3",
     "text": "How can I best explain? Let's put it like this: any complicated system in nature, and that includes the Zone, automatically seeks equilibrium in the absence of destabilizing external factors. That was the case here a few years ago - the Zone was stable and there were no significant deviations from the norm… and now? Like you have said, devastating emissions regularly sweep across the Zone. The system became unstable, distorted… a glitch, of sorts. The Zone is spewing out emission after emission and pumping itself full of energy with each one, so much so that the readings on my sensors oscillate with unbelievable speed! Unfortunately, Lebedev and Suslov were unable to reverse this trend permanently, in spite of their tragic sacrifice. The most important lesson in all this is that this \"glitch\" is not a product of natural causes either. This is all human handiwork.",
     "give_info": "kalancha_knowledge_zone",
     "sid": "marsh_stalker_medic_about_zone_3"
    }
   ],
   "dont_has_info": [
    "kalancha_knowledge_zone"
   ]
  }
 },
 "zat_b30_owl_stalker_trader": {
  "owl_story": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about this quiet harbor.",
     "next": [
      "1"
     ],
     "sid": "owl_story_0"
    },
    {
     "id": "1",
     "text": "And who the hell are you to demand information from me, eh? I'll just tell you what everyone else around here already knows. There was this strange stalker, turned out to be a major of the SSU. He was a good help, and he also dealt with quite a few dangers. It's only recently that everything went downhill... The Yantar psy-emitter and Brain Scorcher were turned on again. There are clearly activities going on at the Chernobyl NPP, and it's within reach. A squad of experienced stalkers went MIA, and after that another squad stumbled upon some Monolith near the sawmill, from what I heard. After that rumble, people left, and the mutants have been using that to their advantage, breeding unchecked. This is no place for rookies, I can tell you that.",
     "next": [
      "2"
     ],
     "sid": "owl_story_1"
    },
    {
     "id": "2",
     "text": "Yet I see not all is lost here. Is there anything else to keep in mind?",
     "next": [
      "3"
     ],
     "sid": "owl_story_2"
    },
    {
     "id": "3",
     "text": "Yes. I'm an information broker. You see, some hotshots, they come up here looking to exit the rat race and strike it rich. But up here, there's many dangers - cultists, mutants, zombies, you name it. It's very easy for a stalker to die in these marshes. So if you happen to, uh, 'find' any of them dead...I'll pay for their PDAs, no questions asked. Capisce?",
     "next": [
      "4"
     ],
     "sid": "owl_story_3"
    },
    {
     "id": "4",
     "text": "Yeah, I catch your drift.",
     "give_info": "owl_story_inf",
     "sid": "owl_story_4"
    }
   ],
   "dont_has_info": [
    "owl_story_inf"
   ]
  }
 },
 "zat_a2_stalker_barmen": {
  "boroda_story": {
   "phrases": [
    {
     "id": "0",
     "text": "You must be Beard.",
     "next": [
      "1"
     ],
     "sid": "boroda_story_0"
    },
    {
     "id": "1",
     "text": "That's right. I haven't seen you around before - welcome to the Skadovsk.",
     "next": [
      "2"
     ],
     "sid": "boroda_story_1"
    },
    {
     "id": "2",
     "text": "What can I do here?",
     "next": [
      "3"
     ],
     "sid": "boroda_story_2"
    },
    {
     "id": "3",
     "text": "Whatever you prefer doing. Ever since the departure of Sultan, the hunt for artefacts around here has been more of a breeze than ever. If you plan on going south in the direction of the substation workshops and the waste processing station, be careful. The Syndicate holds those territories, and they pose quite a threat. If you happen to find any artefacts, feel free to bring them here - I'll be more than happy to offer you a decent price. Stay safe around these parts, stalker.",
     "next": [
      "4"
     ],
     "sid": "boroda_story_3"
    },
    {
     "id": "4",
     "text": "Thank you.",
     "give_info": "boroda_story_inf",
     "sid": "boroda_story_4"
    }
   ],
   "dont_has_info": [
    "boroda_story_inf"
   ]
  },
  "zat_a2_stalker_barmen_actor_info": {
   "phrases": [
    {
     "id": "1114",
     "text": "What do you think about bandits?",
     "next": [
      "11141"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_1114"
    },
    {
     "id": "1113",
     "text": "How did you end up here?",
     "next": [
      "11131"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_1113"
    },
    {
     "id": "1112",
     "text": "What drove stalkers to the center of the Zone?",
     "next": [
      "11121"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_1112"
    },
    {
     "id": "11121",
     "text": "A funny question. Some were out to discover the next artefact goldmine. Some were driven here by the Oasis rumours. Others sought the Wish Granter. And then there are the base human desires: greed and curiosity... Everyone's got their reasons. I'm sure you have yours, too.",
     "next": [
      "11"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_11121"
    },
    {
     "id": "11131",
     "text": "I came here with Grouse after the Scorcher was disabled. But I'm sure that's not what you really wanna know, am I right? I deal mainly in artefacts. The outside is full of trinkets already, so valuable customers want the rare stuff. That's why I decided to set up a stalker camp, where real high-value articles can still be found. I mean, when a stalker comes back with his loot, what does he really need? A cold one in his hand and good ol' human contact, that's what. And that's what the Skadovsk is all about.",
     "next": [
      "11"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_11131"
    },
    {
     "id": "11141",
     "text": "Well, it's like this: I got nothing against 'em on board the Skadovsk, so long as they act decent. After all, you don't meet total douche bags all that often. Some of them are actually former stalkers. Who knows, one of them poor bastards might actually decide to give up the crook business before he catches a bullet... Life is full of surprises.",
     "next": [
      "11"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_11141"
    },
    {
     "id": "11111",
     "text": "Ask yourself that, pal. They step ashore from Skadovsk to explore the terrain and search for artefacts, shooting back at everything and everyone who comes rushing at them. They come back on Skadovsk to get drunk and talk trash... enjoy some R&R before the next raid... though, when an emission hits, it's quite a different scene. That's when we all sit tight and remember those who didn't make it to a cover in time...",
     "next": [
      "11"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_11111"
    },
    {
     "id": "11",
     "text": "",
     "next": [
      "111"
     ]
    },
    {
     "id": "111",
     "text": "",
     "next": [
      "1111",
      "1112",
      "1113",
      "1114",
      "1115"
     ]
    },
    {
     "id": "1",
     "text": "That's a broad topic. Try asking some specific questions and I'll do my best to answer them.",
     "next": [
      "11"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_1"
    },
    {
     "id": "1115",
     "text": "Nah, that's okay. Forget about it.",
     "next": [
      "11151"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_1115"
    },
    {
     "id": "11151",
     "text": "If you say so.",
     "sid": "zat_a2_stalker_barmen_actor_info_11151"
    },
    {
     "id": "1111",
     "text": "What do stalkers do here?",
     "next": [
      "11111"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_1111"
    },
    {
     "id": "0",
     "text": "Tell me what life is like here.",
     "next": [
      "1"
     ],
     "sid": "zat_a2_stalker_barmen_actor_info_0"
    }
   ],
   "dont_has_info": [
    "zat_b30_barmen_under_sultan"
   ]
  }
 },
 "jup_a6_stalker_barmen": {
  "hawaiian_yanov": {
   "phrases": [
    {
     "id": "0",
     "text": "Tell me about this place.",
     "next": [
      "1"
     ],
     "sid": "hawaiian_yanov_0"
    },
    {
     "id": "1",
     "text": "Welcome to Yanov Station, fellow stalker! Full of jolly people! Yes...full of them! Friends and companions that you can talk, drink and gamble with between trips through the Zone. Wanna buy something to help you out? Between Ashot and I, we've got you covered, mate. Better safe than sorry!",
     "sid": "hawaiian_yanov_1"
    }
   ]
  }
 }
};
