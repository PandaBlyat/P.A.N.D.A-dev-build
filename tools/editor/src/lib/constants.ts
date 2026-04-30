// P.A.N.D.A. Conversation Editor — Constants
// Factions, ranks, levels, smart terrains, placeholders

import type { FactionId } from './types';
import { SMART_TERRAIN_CATALOG } from './generated/smart-terrain-catalog';
import { STASH_CATALOG } from './generated/stash-catalog';

export const FACTION_IDS: FactionId[] = [
  'stalker', 'dolg', 'freedom', 'csky', 'ecolog',
  'killer', 'army', 'bandit', 'monolith', 'zombied',
  'isg', 'renegade', 'greh',
];

/** Faction aliases accepted by the Lua engine's normalize_faction */
export const FACTION_ALIASES: Record<string, FactionId> = {
  loner: 'stalker', stalker: 'stalker',
  duty: 'dolg', dolg: 'dolg',
  freedom: 'freedom',
  csky: 'csky', clear_sky: 'csky',
  ecolog: 'ecolog', scientist: 'ecolog',
  mercenary: 'killer', killer: 'killer',
  military: 'army', army: 'army',
  bandit: 'bandit',
  monolith: 'monolith',
  zombie: 'zombied', zombied: 'zombied',
  isg: 'isg',
  renegade: 'renegade',
  greh: 'greh',
};

export const RANKS = [
  'novice', 'trainee', 'experienced', 'professional',
  'veteran', 'expert', 'master', 'legend',
] as const;

export const RANK_ORDER: Record<string, number> = {
  novice: 1, trainee: 2, experienced: 3, professional: 4,
  veteran: 5, expert: 6, master: 7, legend: 8,
};

export const MUTANT_TYPES = [
  'random', 'bloodsucker', 'boar', 'burer', 'chimera',
  'controller', 'dog', 'flesh', 'fracture', 'giant',
  'poltergeist', 'pseudodog', 'pseudogiant', 'psy_dog',
  'snork', 'tushkano', 'cat', 'lurker',
] as const;

export const WEATHER_TYPES = [
  'w_clear1', 'w_clear2', 'w_cloudy1', 'w_cloudy2_dark',
  'w_rain1', 'w_rain2', 'w_rain3', 'w_storm1', 'w_storm2',
  'w_foggy1', 'w_foggy2', 'w_partly1', 'w_partly2',
] as const;

export const WEATHER_DISPLAY_NAMES: Record<string, string> = {
  w_clear1: 'Clear', w_clear2: 'Clear (variant)',
  w_cloudy1: 'Cloudy', w_cloudy2_dark: 'Cloudy Dark',
  w_rain1: 'Light Rain', w_rain2: 'Rain', w_rain3: 'Heavy Rain',
  w_storm1: 'Storm', w_storm2: 'Heavy Storm',
  w_foggy1: 'Foggy', w_foggy2: 'Dense Fog',
  w_partly1: 'Partly Cloudy', w_partly2: 'Partly Cloudy (variant)',
};

export const WEATHER_DISPLAY_NAMES_RU: Record<string, string> = {
  w_clear1: 'Ясно', w_clear2: 'Ясно (вариант)',
  w_cloudy1: 'Облачно', w_cloudy2_dark: 'Тёмные облака',
  w_rain1: 'Лёгкий дождь', w_rain2: 'Дождь', w_rain3: 'Сильный дождь',
  w_storm1: 'Шторм', w_storm2: 'Сильный шторм',
  w_foggy1: 'Туман', w_foggy2: 'Густой туман',
  w_partly1: 'Переменная облачность', w_partly2: 'Переменная облачность (вариант)',
};

export const COMPANION_STATES = [
  'follow', 'wait', 'patrol', 'attack', 'stealth', 'ignore_combat',
] as const;

export const COMPANION_STATE_DISPLAY_NAMES: Record<string, string> = {
  follow: 'Follow Player',
  wait: 'Wait in Place',
  patrol: 'Patrol Area',
  attack: 'Attack Mode',
  stealth: 'Stealth Mode',
  ignore_combat: 'Ignore Combat',
};

export const COMPANION_STATE_DISPLAY_NAMES_RU: Record<string, string> = {
  follow: 'Следовать за игроком',
  wait: 'Стоять на месте',
  patrol: 'Патрулировать',
  attack: 'Режим атаки',
  stealth: 'Режим скрытности',
  ignore_combat: 'Игнорировать бой',
};

export const INDOOR_LEVELS = [
  'agroprom_underground', 'jupiter_underground', 'labx8',
  'labx18', 'labx16', 'labx10', 'fake_start',
] as const;

export const MONTH_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

export const MONTH_NAMES_RU: Record<number, string> = {
  1: 'Январь', 2: 'Февраль', 3: 'Март', 4: 'Апрель',
  5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Август',
  9: 'Сентябрь', 10: 'Октябрь', 11: 'Ноябрь', 12: 'Декабрь',
};

export const RANK_DISPLAY_NAMES: Record<string, string> = {
  novice: 'Novice', trainee: 'Trainee', experienced: 'Experienced',
  professional: 'Professional', veteran: 'Veteran', expert: 'Expert',
  master: 'Master', legend: 'Legend',
};

export const RANK_DISPLAY_NAMES_RU: Record<string, string> = {
  novice: 'Новичок', trainee: 'Стажёр', experienced: 'Опытный',
  professional: 'Профессионал', veteran: 'Ветеран', expert: 'Эксперт',
  master: 'Мастер', legend: 'Легенда',
};

export type DynamicPlaceholderCategory =
  | 'Identity'
  | 'Faction / reputation'
  | 'World / location'
  | 'Time / weather'
  | 'Player stats'
  | 'Progress / counters';

export type DynamicPlaceholder = {
  key: string;
  description: string;
  category: DynamicPlaceholderCategory;
  kind?: 'smart_terrain_picker';
};

export const DYNAMIC_PLACEHOLDERS: readonly DynamicPlaceholder[] = [
  { key: '$player_name', description: 'Player character name', category: 'Identity' },
  { key: '$npc_name', description: 'NPC character name', category: 'Identity' },
  { key: '$player_rank', description: 'Player rank name', category: 'Identity' },
  { key: '$npc_rank', description: 'NPC rank name', category: 'Identity' },
  { key: '$player_rank_name', description: 'Player rank as display name (e.g. Experienced)', category: 'Identity' },
  { key: '$npc_rank_name', description: 'NPC rank as display name (e.g. Veteran)', category: 'Identity' },
  { key: '$player_faction', description: 'Player faction (translated)', category: 'Faction / reputation' },
  { key: '$npc_faction', description: 'NPC faction (translated)', category: 'Faction / reputation' },
  { key: '$player_reputation', description: 'Player reputation value', category: 'Faction / reputation' },
  { key: '$relationship_score', description: 'NPC relationship score with player (-1000 to 1000)', category: 'Faction / reputation' },
  { key: '$current_level', description: 'Current map name (translated)', category: 'World / location' },
  { key: '%smart_terrain%', description: 'Choose a level-aware smart terrain text placeholder, command-key placeholder, or exact smart terrain id', category: 'World / location', kind: 'smart_terrain_picker' },
  { key: '$time_of_day', description: 'morning/afternoon/evening/night', category: 'Time / weather' },
  { key: '$game_hour', description: 'Current time (HH:MM)', category: 'Time / weather' },
  { key: '$weather', description: 'Current weather type identifier', category: 'Time / weather' },
  { key: '$player_health', description: 'Player health percentage (0-100)', category: 'Player stats' },
  { key: '$player_satiety', description: 'Player satiety/hunger percentage (0-100)', category: 'Player stats' },
  { key: '$player_radiation', description: 'Player radiation level (0-100)', category: 'Player stats' },
  { key: '$player_money', description: 'Player money (RU)', category: 'Player stats' },
  { key: '$total_weight', description: 'Player carried weight in kg', category: 'Player stats' },
  { key: '$companion_count', description: 'Active companion count', category: 'Progress / counters' },
  { key: '$stalker_kills', description: 'Total stalker kills count', category: 'Progress / counters' },
  { key: '$mutant_kills', description: 'Total mutant kills count', category: 'Progress / counters' },
  { key: '$game_days', description: 'Days survived in the Zone', category: 'Progress / counters' },
  { key: '$game_day_number', description: 'Current in-game day number', category: 'Progress / counters' },
] as const;

/** Smart terrain lists by level, extracted from SMART_TERRAIN_LEVEL_LISTS in pda_interactive_conv.script */
export const SMART_TERRAIN_LEVELS: Record<string, string[]> = {
  cordon: [
    'st_esc_smart_terrain_4_13_name', 'st_esc_smart_terrain_2_14_name',
    'st_esc_smart_terrain_4_11_name', 'st_esc_smart_terrain_1_11_name',
    'st_esc_smart_terrain_5_12_name', 'st_esc_smart_terrain_5_9_name',
    'st_esc_smart_terrain_4_9_name', 'st_esc_smart_terrain_6_8_name',
    'st_esc_smart_terrain_8_10_name', 'st_esc_smart_terrain_8_9_name',
    'st_esc_smart_terrain_9_7_name', 'st_esc_smart_terrain_6_6_name',
    'st_esc_smart_terrain_5_7_name', 'st_esc_smart_terrain_3_7_name',
    'st_esc_smart_terrain_5_6_name', 'st_esc_smart_terrain_5_4_name',
    'st_esc_smart_terrain_5_2_name', 'st_esc_smart_terrain_9_10_name',
  ],
  darkscape: [
    'st_ds_ptr4_name', 'st_ds2_lager_st_name', 'st_ds2_st_dogs_name',
    'st_ds_grverfer2_name', 'st_ds_ptr2_name', 'st_ds_deb1_name',
    'st_ds_kem2_name', 'st_ds2_domik_st_name', 'st_ds_boars_nest_name',
    'st_ds2_st_hoofs_name', 'st_ds_ptr_name', 'st_ds_ptr3_name',
    'st_ds_kem3_name', 'st_ds_kem1_name',
  ],
  swamp: [
    'st_mar_smart_terrain_5_12_name', 'st_mar_smart_terrain_6_11_name',
    'st_mar_smart_terrain_8_11_name', 'st_mar_smart_terrain_11_11_name',
    'st_mar_smart_terrain_10_10_name', 'st_mar_smart_terrain_8_9_name',
    'st_mar_smart_terrain_6_10_name', 'st_mar_smart_terrain_3_10_name',
    'st_mar_smart_terrain_doc_2_name', 'st_mar_smart_terrain_5_8_name',
    'st_mar_smart_terrain_6_8_name', 'st_mar_smart_terrain_8_8_name',
    'st_mar_smart_terrain_10_7_name', 'st_mar_smart_terrain_3_7_name',
    'st_mar_smart_terrain_4_7_name', 'st_mar_smart_terrain_6_7_name',
    'st_mar_smart_terrain_7_7_name', 'st_mar_smart_terrain_10_5_name',
    'st_mar_smart_terrain_8_4_name', 'st_mar_smart_terrain_6_4_name',
    'st_mar_smart_terrain_4_5_name', 'st_mar_smart_terrain_3_3_name',
    'st_mar_smart_terrain_doc_name', 'st_mar_smart_terrain_12_2_name',
    'st_mar_smart_terrain_11_3_name', 'st_mar_smart_terrain_7_3_name',
  ],
  garbage: [
    'st_gar_smart_terrain_3_7_name', 'st_gar_smart_terrain_6_7_name',
    'st_gar_smart_terrain_5_6_name', 'st_gar_smart_terrain_6_6_name',
    'st_gar_smart_terrain_1_7_name', 'st_gar_smart_terrain_3_5_name',
    'st_gar_smart_terrain_2_4_name', 'st_gar_smart_terrain_1_5_name',
    'st_gar_smart_terrain_4_5_name', 'st_gar_smart_terrain_5_5_name',
    'st_gar_smart_terrain_7_4_name', 'st_gar_smart_terrain_6_1_name',
    'st_gar_smart_terrain_5_2_name', 'st_gar_smart_terrain_4_2_name',
    'st_gar_smart_terrain_5_4_name', 'st_gar_smart_terrain_8_3_name',
    'st_gar_smart_terrain_8_5_name', 'st_gar_smart_terrain_5_8_name',
  ],
  agroprom: [
    'st_agr_smart_terrain_6_4_name', 'st_agr_smart_terrain_5_3_name',
    'st_agr_smart_terrain_5_2_name', 'st_agr_smart_terrain_2_2_name',
    'st_agr_smart_terrain_1_2_name', 'st_agr_smart_terrain_1_3_name',
    'st_agr_smart_terrain_4_6_name', 'st_agr_smart_terrain_5_7_name',
    'st_agr_smart_terrain_7_5_name', 'st_agr_smart_terrain_4_4_name',
    'st_agr_smart_terrain_4_4_near_3_name', 'st_agr_smart_terrain_4_4_2_name',
    'st_agr_smart_terrain_4_4_near_1_name', 'st_agr_smart_terrain_7_4_name',
    'st_agr_smart_terrain_5_4_name', 'st_agr_smart_terrain_6_6_name',
  ],
  dark_valley: [
    'st_val_smart_terrain_7_4_name', 'st_val_smart_terrain_7_3_name',
    'st_val_smart_terrain_9_4_name', 'st_val_smart_terrain_7_5_name',
    'st_val_smart_terrain_8_6_name', 'st_val_smart_terrain_9_2_name',
    'st_val_smart_terrain_6_4_name', 'st_val_smart_terrain_6_5_name',
    'st_val_smart_terrain_8_7_name', 'st_val_smart_terrain_7_8_name',
    'st_val_smart_terrain_8_9_name', 'st_val_smart_terrain_1_2_name',
    'st_val_smart_terrain_9_6_name', 'st_val_smart_terrain_9_10_name',
    'st_val_smart_terrain_4_0_name', 'st_val_smart_terrain_5_10_name',
    'st_val_smart_terrain_3_0_name', 'st_val_smart_terrain_7_11_name',
    'st_val_smart_terrain_5_8_name', 'st_val_smart_terrain_5_7_name',
  ],
  yantar: [
    'st_yan_smart_terrain_3_6_name', 'st_yan_smart_terrain_4_5_name',
    'st_yan_smart_terrain_2_5_name', 'st_yan_smart_terrain_1_6_name',
    'st_yan_smart_terrain_3_4_name', 'st_yan_smart_terrain_zombi_spawn_name',
    'st_yan_smart_terrain_2_4_name', 'st_yan_smart_terrain_5_5_name',
    'st_yan_smart_terrain_4_4_name', 'st_yan_smart_terrain_5_3_name',
    'st_yan_smart_terrain_6_2_name', 'st_yan_smart_terrain_4_2_name',
    'st_yan_smart_terrain_snork_u_name',
  ],
  wild_territory: [
    'st_ros_smart_stalker_killers1_name', 'st_ros_smart_monster7_name',
    'st_ros_smart_snork1_name', 'st_ros_smart_killers1_name',
    'st_ros_smart_stalker1_name', 'st_ros_smart_poltergeist2_name',
    'st_ros_smart_monster5_name', 'st_ros_smart_monster4_name',
  ],
  rostok: [
    'st_bar_zastava_2_name', 'st_bar_zastava_dogs_lair_2_name',
    'st_bar_zastava_name', 'st_bar_zastava_dogs_lair_name',
  ],
  truck_cemetery: [
    'st_trc_sim_20_name', 'st_trc_sim_17_name', 'st_trc_sim_7_name',
    'st_trc_sim_21_name', 'st_trc_sim_4_name', 'st_trc_sim_18_name',
    'st_trc_sim_1_name', 'st_trc_sim_2_name', 'st_trc_sim_3_name',
    'st_trc_sim_12_name', 'st_trc_sim_10_name', 'st_trc_sim_11_name',
    'st_trc_sim_14_name', 'st_trc_sim_15_name', 'st_trc_sim_6_name',
    'st_trc_sim_19_name', 'st_trc_sim_5_name', 'st_trc_sim_16_name',
    'st_trc_sim_9_name', 'st_trc_sim_13_name', 'st_trc_sim_8_name',
  ],
  dead_city: [
    'st_cit_bandits_2_name', 'st_cit_kanaliz1_name',
    'st_cit_bandits_name', 'st_cit_killers_name',
    'st_cit_killers_vs_bandits_name', 'st_cit_killers_2_name',
    'st_cit_kanaliz2_name', 'st_zombie_smart_ds_mlr_1_name',
    'st_zombie_smart_ds_mlr_2_name',
  ],
  army_warehouses: [
    'st_mil_smart_terrain_7_4_name', 'st_mil_smart_terrain_8_3_name',
    'st_mil_smart_terrain_2_10_name', 'st_mil_smart_terrain_4_3_name',
    'st_mil_smart_terrain_4_2_name', 'st_mil_smart_terrain_2_2_name',
    'st_mil_smart_terrain_2_4_name', 'st_mil_smart_terrain_2_1_name',
    'st_mil_smart_terrain_2_6_name', 'st_mil_smart_terrain_3_8_name',
    'st_mil_smart_terrain_4_8_name', 'st_mil_smart_terrain_4_7_name',
    'st_mil_smart_terrain_7_10_name', 'st_mil_smart_terrain_4_5_name',
  ],
  radar: [
    'st_rad_entrance_name', 'st_rad_valley_name',
    'st_rad_after_valley_name', 'st_rad2_loner_0001_name',
    'st_rad_snork1_name', 'st_rad_zombied1_name',
    'st_rad_snork2_name', 'st_rad_pseudodogs_name',
    'st_rad_bloodsucker_name', 'st_rad_zombied2_name',
    'st_rad_antenna_camper_name', 'st_rad2_loner_0002_name',
    'st_rad2_loner_0000_name', 'st_rad_prip_road_name',
    'st_rad_rusty_forest_center_name', 'st_rad_freedom_vs_duty_name',
    'st_rad2_rad_prip_road_name',
  ],
  red_forest: [
    'st_red_smart_terrain_6_3_name', 'st_red_smart_terrain_monsters_name',
    'st_red_smart_terrain_monsters_2_name', 'st_red_smart_terrain_6_6_name',
    'st_red_smart_terrain_bridge_name', 'st_red_smart_terrain_5_5_name',
    'st_red_smart_terrain_5_6_name', 'st_red_smart_terrain_monsters_3_name',
    'st_red_smart_terrain_4_5_name', 'st_red_smart_terrain_4_3_name',
    'st_red_smart_terrain_3_3_name', 'st_red_smart_terrain_4_2_name',
    'st_red_smart_terrain_3_1_name', 'st_red_smart_terrain_3_2_name',
    'st_red_bridge_bandit_smart_skirmish_name',
  ],
  limansk: [
    'st_lim_smart_terrain_1_name', 'st_lim_smart_terrain_3_name',
    'st_lim_smart_terrain_4_name', 'st_lim_smart_terrain_5_name',
    'st_lim_smart_terrain_6_name', 'st_lim_smart_terrain_7_name',
    'st_lim_smart_terrain_8_name', 'st_lim_smart_terrain_9_name',
    'st_lim_smart_terrain_10_name',
  ],
  pripyat: [
    'st_pri_smart_neutral_stalker1_name', 'st_pri_smart_monolith_stalker2_name',
    'st_pri_smart_monster_lair1_name', 'st_pri_smart_monolith_stalker3_name',
    'st_pri_smart_controler_lair1_name', 'st_pri_smart_monolith_stalker4_name',
    'st_pri_depot_name', 'st_pri_smart_controler_lair2_name',
    'st_pri_smart_snork_lair2_name', 'st_pri_smart_tushkano_lair1_name',
    'st_pri_smart_snork_lair1_name', 'st_pri_smart_monolith_stalker6_name',
    'st_pri_smart_pseudodog_lair1_name', 'st_pri_smart_giant_lair1_name',
    'st_pri_smart_bloodsucker_lair1_name', 'st_hotel_poless_smart_alife_name',
    'st_monolith_snipers_smart_1_mlr_name',
  ],
  generators: [
    'st_gen_smart_terrain_cemetery_name', 'st_gen_smart_terrain_junk_name',
    'st_gen_smart_terrain_lab_entrance_2_name', 'st_gen_smart_terrain_lab_entrance_name',
    'st_gen_smart_terrain_forest_name', 'st_gen_smart_terrain_urod_name',
    'st_gen_smart_terrain_military_name',
  ],
  outskirts: [
    'st_pri_b36_smart_terrain_name', 'st_pri_sim_2_name',
    'st_pri_a28_heli_name', 'st_pri_sim_1_name', 'st_pri_b303_name',
    'st_pri_a28_evac_name', 'st_pri_b302_name', 'st_pri_sim_6_name',
    'st_pri_b301_name', 'st_pri_a28_school_name', 'st_pri_b306_name',
    'st_pri_sim_10_name', 'st_pri_sim_12_name', 'st_pri_a16_name',
    'st_pri_a28_base_name', 'st_pri_b35_military_name', 'st_pri_sim_5_name',
    'st_pri_a28_shop_name', 'st_pri_a28_arch_name', 'st_pri_a22_smart_terrain_name',
    'st_pri_sim_3_name', 'st_pri_b307_name', 'st_pri_sim_7_name',
    'st_pri_sim_9_name', 'st_pri_a21_smart_terrain_name', 'st_pri_sim_11_name',
    'st_pri_a18_smart_terrain_name', 'st_pri_sim_4_name',
    'st_kbo_terrain_name', 'st_pri_a16_mlr_copy_name',
  ],
  jupiter: [
    'st_jup_a12_name', 'st_jup_sim_10_name', 'st_jup_a12_merc_name',
    'st_jup_sim__name', 'st_jup_b203_name', 'st_jup_b212_name',
    'st_jup_b32_name', 'st_jup_sim_1_name', 'st_jup_b205_smart_terrain_name',
    'st_jup_sim_16_name', 'st_jup_sim_9_name', 'st_jup_b19_name',
    'st_jup_b6_anom_2_name', 'st_jup_b1_name', 'st_jup_b46_name',
    'st_jup_sim_21_name', 'st_jup_sim_8_name', 'st_jup_sim_14_name',
    'st_jup_b202_name', 'st_jup_b211_name', 'st_jup_sim_20_name',
    'st_jup_b200_name', 'st_jup_b200_tushkan_smart_terrain_name',
    'st_jup_sim_7_name', 'st_jup_b25_name', 'st_jup_b207_name',
    'st_jup_b207_depot_attack_name', 'st_jup_sim_15_name',
    'st_jup_b206_name', 'st_jup_a10_smart_terrain_name',
    'st_jup_sim_6_name', 'st_jup_b209_name', 'st_jup_sim_5_name',
    'st_jup_sim_4_name', 'st_jup_b204_name', 'st_jup_sim_11_name',
    'st_jup_sim_12_name', 'st_jup_sim_18_name', 'st_jup_sim_17_name',
    'st_jup_a9_name', 'st_jup_b47_name', 'st_jup_sim_19_name',
    'st_jup_b8_smart_terrain_name', 'st_jup_b219_name', 'st_jup_b4_name',
    'st_jup_sim_3_name', 'st_jup_sim_13_name', 'st_jup_sim_2_name',
    'st_jup_b208_name',
  ],
  south_cnpp: [
    'st_aes_smart_terrain_monolit_blockpost4_name',
    'st_aes_smart_terrain_monolit_blockpost2_name',
    'st_aes_smart_terrain_monolit_blockpost_name',
    'st_aes_smart_terrain_soldier2_name',
    'st_aes_smart_terrain_monsters1_name',
    'st_aes_smart_terrain_monsters2_name',
    'st_aes_smart_terrain_monsters3_name',
    'st_aes_smart_terran_soldier_name',
    'st_aes_smart_terrain_monsters4_name',
  ],
  north_cnpp: [
    'st_aes2_monolith_snipers_2_name', 'st_aes2_monolith_snipers_1_name',
    'st_aes2_monolith_camp1_name', 'st_aes2_monolith_camp2_name',
    'st_aes2_monsters2_name', 'st_aes2_monolith_camp3_name',
    'st_aes2_monsters1_name', 'st_aes2_monolith_snipers_3_name',
    'st_aes2_monolith_camp4_name',
  ],
  zaton: [
    'st_zat_b40_smart_terrain_name', 'st_zat_sim_10_name',
    'st_zat_sim_14_name', 'st_zat_b12_name', 'st_zat_sim_11_name',
    'st_zat_b54_name', 'st_zat_sim_24_name', 'st_zat_b5_smart_terrain_name',
    'st_zat_sim_28_name', 'st_zat_sim_16_name', 'st_zat_b14_smart_terrain_name',
    'st_zat_sim_18_name', 'st_zat_sim_1_name', 'st_zat_b53_name',
    'st_zat_sim_29_name', 'st_zat_a1_name', 'st_zat_sim_15_name',
    'st_zat_b42_smart_terrain_name', 'st_zat_sim_2_name', 'st_zat_sim_30_name',
    'st_zat_sim_3_name', 'st_zat_sim_19_name', 'st_zat_sim_4_name',
    'st_zat_b104_zombied_name', 'st_zat_sim_5_name', 'st_zat_b101_name',
    'st_zat_sim_6_name', 'st_zat_b38_name', 'st_zat_sim_7_name',
    'st_zat_sim_8_name', 'st_zat_sim_26_name', 'st_zat_b39_name',
    'st_zat_sim_25_name', 'st_zat_sim_13_name', 'st_zat_b33_name',
    'st_zat_b55_name', 'st_zat_b100_name', 'st_zat_a23_smart_terrain_name',
    'st_zat_sim_9_name', 'st_zat_b103_merc_smart_name', 'st_zat_b56_name',
    'st_zat_sim_20_name', 'st_zat_b20_smart_terrain_name', 'st_zat_b28_name',
    'st_zat_b106_smart_terrain_name', 'st_zat_sim_17_name',
    'st_zat_sim_21_name', 'st_zat_sim_27_name', 'st_zat_b7_name',
    'st_zat_sim_23_name', 'st_zat_b18_name', 'st_zat_b52_name',
    'st_zat_sim_12_name', 'st_zat_sim_22_name',
  ],
  meadow: [
    'st_pol_sim_1_name', 'st_pol_smart_terrain_1_1_name',
    'st_pol_smart_terrain_1_2_name', 'st_pol_smart_terrain_1_3_name',
    'st_pol_smart_terrain_2_1_name', 'st_pol_smart_terrain_2_2_name',
  ],
};

export type SmartTerrainOption = {
  id: string;
  description: string;
  level: string;
};

export const SMART_TERRAIN_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  SMART_TERRAIN_CATALOG.map((entry) => [entry.id, entry.description]),
);

export const ALL_SMART_TERRAIN_IDS = SMART_TERRAIN_CATALOG.map((entry) => entry.id);

export const SMART_TERRAIN_OPTIONS_BY_LEVEL: Record<string, SmartTerrainOption[]> = Object.fromEntries(
  Object.entries(SMART_TERRAIN_LEVELS).map(([level, ids]) => [level, ids.map((id) => ({
    id,
    level,
    description: SMART_TERRAIN_DESCRIPTIONS[id] || id,
  }))]),
);

const levelById = new Map<string, string>();
for (const [level, ids] of Object.entries(SMART_TERRAIN_LEVELS)) {
  for (const id of ids) levelById.set(id, level);
}

export const SMART_TERRAIN_OPTIONS_ALL: SmartTerrainOption[] = SMART_TERRAIN_CATALOG.map((entry) => ({
  id: entry.id,
  description: entry.description || entry.id,
  level: levelById.get(entry.id) || 'other',
}));

// ─── Stash catalog ───────────────────────────────────────────────────────────

export type StashOption = {
  id: string;
  name: string;
  description: string;
  level: string;
};

export const STASH_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  STASH_CATALOG.map((e) => [e.id, e.name]),
);

export const ALL_STASH_IDS = new Set(STASH_CATALOG.map((e) => e.id));

export const STASH_OPTIONS_ALL: StashOption[] = STASH_CATALOG.map((e) => ({
  id: e.id,
  name: e.name,
  description: e.description,
  level: e.level,
}));

export const STASH_LEVELS_WITH_ENTRIES: string[] = [
  ...new Set(STASH_CATALOG.map((e) => e.level)),
].sort();

// ─── Level display names ──────────────────────────────────────────────────────

export const LEVEL_DISPLAY_NAMES: Record<string, string> = {
  cordon: 'Cordon',
  darkscape: 'Darkscape',
  swamp: 'Great Swamp',
  garbage: 'Garbage',
  agroprom: 'Agroprom',
  dark_valley: 'Dark Valley',
  yantar: 'Yantar',
  wild_territory: 'Wild Territory',
  rostok: 'Rostok',
  truck_cemetery: 'Truck Cemetery',
  dead_city: 'Dead City',
  army_warehouses: 'Army Warehouses',
  radar: 'Radar',
  red_forest: 'Red Forest',
  limansk: 'Limansk',
  pripyat: 'Pripyat',
  generators: 'Generators',
  outskirts: 'Outskirts',
  jupiter: 'Jupiter',
  south_cnpp: 'South CNPP',
  north_cnpp: 'North CNPP',
  zaton: 'Zaton',
  meadow: 'Meadow',
};

export const LEVEL_DISPLAY_NAMES_RU: Record<string, string> = {
  cordon: 'Кордон',
  darkscape: 'Тёмная долина (Darkscape)',
  swamp: 'Болото',
  garbage: 'Свалка',
  agroprom: 'Агропром',
  dark_valley: 'Темнолесье',
  yantar: 'Янтарь',
  wild_territory: 'Дикая территория',
  rostok: 'Росток',
  truck_cemetery: 'Кладбище техники',
  dead_city: 'Мёртвый город',
  army_warehouses: 'Армейские склады',
  radar: 'Радар',
  red_forest: 'Рыжий лес',
  limansk: 'Лиманск',
  pripyat: 'Припять',
  generators: 'Генераторы',
  outskirts: 'Окраины',
  jupiter: 'Юпитер',
  south_cnpp: 'ЧАЭС (юг)',
  north_cnpp: 'ЧАЭС (север)',
  zaton: 'Затон',
  meadow: 'Луг',
};

/** System strings that are not conversation entries — preserved during import/export */
export const SYSTEM_STRING_IDS = [
  'st_pda_ic_header_prefix',
  'st_pda_ic_header_prompt',
  'st_pda_ic_outcome_sender',
  'st_pda_ic_outcome_task_given',
  'st_pda_ic_outcome_task_unavailable',
  'st_pda_ic_location_watch_added',
  'st_pda_ic_location_reached',
  'st_pda_ic_outcome_money_gain',
  'st_pda_ic_outcome_money_loss',
  'st_pda_ic_outcome_rep_gain',
  'st_pda_ic_outcome_rep_loss',
  'st_pda_ic_outcome_gw_gain',
  'st_pda_ic_outcome_gw_loss',
  'st_pda_ic_outcome_item_gain',
  'st_pda_ic_outcome_stash',
  'st_pda_ic_outcome_stash_attachment_file',
  'st_pda_ic_outcome_no_money',
  'st_pda_ic_outcome_hostile_warn',
  'st_pda_ic_outcome_hostile_arrive',
  'st_pda_ic_outcome_friendly_warn',
  'st_pda_ic_outcome_friendly_arrive',
  'st_pda_ic_outcome_companion_arrive',
  'st_pda_ic_outcome_mutant_warn',
  'st_pda_ic_outcome_mutant_arrive',
  'st_pda_ic_outcome_courier_warn',
  'st_pda_ic_pda_closed_warning',
  'st_pda_ic_outcome_npc_teleport_smart',
  'st_pda_ic_outcome_npc_teleport_player',
  'st_pda_ic_outcome_recruit_success',
  'st_pda_ic_outcome_recruit_limit',
  'st_pda_ic_location_marker_hint',
  'st_pda_ic_job_success',
  'st_pda_ic_job_fail',
];
