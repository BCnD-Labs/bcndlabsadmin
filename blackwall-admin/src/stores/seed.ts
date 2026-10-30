/**
 * Version 1 of Blackwall seeded example records on first load. Version 2
 * starts empty, and the migration removes those examples by their fixed IDs
 * (records you created have random IDs and are kept).
 */
export const V1_EXAMPLE_IDS = new Set([
  "prj_website", "prj_blackwall", "prj_mikoshi", "prj_soulkiller",
  "tsk_1", "tsk_2", "tsk_3", "tsk_4", "tsk_5", "tsk_6", "tsk_7", "tsk_8", "tsk_9",
  "evt_1", "evt_2", "evt_3", "evt_4", "evt_5",
  "nte_1", "nte_2", "nte_3", "nte_4", "nte_5",
  "rep_website", "rep_blackwall",
  "drf_1", "drf_2", "drf_3",
])
