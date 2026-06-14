"use strict";
/* =====================================================================
 *  TUNING — every feel number in the game, in one place.
 *  Units: px/frame (fixed 60 Hz), frames, or counts.
 *  The movement block is the sacred part — it shipped in the slice and
 *  it is the soul of the game. Touch with reverence.
 * ===================================================================== */
const TUNING = {
  // --- display ---
  SCALE: 3, VIEW_W: 384, VIEW_H: 240,

  // --- player body ---
  PLAYER_W: 18, PLAYER_H: 26,
  HURTBOX_INSET: 3, STOMP_MARGIN: 3, STOMP_GRACE: 6,

  // --- ground movement (the sacred block) ---
  GROUND_ACCEL: 0.22, GROUND_DECEL: 0.30, TURN_ACCEL: 0.50, MAX_RUN_SPEED: 2.0,
  AIR_ACCEL: 0.14, AIR_DECEL: 0.03,
  GRAVITY_RISE: 0.30, GRAVITY_FALL: 0.44,
  JUMP_VEL: 5.8, JUMP_CUT_MULT: 0.38,
  APEX_SPEED: 0.7, APEX_GRAVITY_MULT: 0.5, MAX_FALL_SPEED: 6.5,
  COYOTE_FRAMES: 6, JUMP_BUFFER_FRAMES: 7, CORNER_CORRECTION_PX: 3,
  STOMP_BOUNCE: 3.2, STOMP_BOUNCE_HELD: 4.9,

  // --- swan glide flaps (GDD 4.3: a few flaps of lift, not free flight) ---
  FLAPS_MAX: 2, FLAP_VEL: 3.4, FLAP_MIN_INTERVAL: 9,

  // --- water ---
  WATER_GRAVITY: 0.07, WATER_MAX_FALL: 1.3,
  WATER_ACCEL_SWAN: 0.10, WATER_ACCEL_MERMAID: 0.18, WATER_DRAG: 0.05,
  WATER_MAX_SPEED_SWAN: 1.3, WATER_MAX_SPEED_MERMAID: 2.3,
  SWIM_STROKE_SWAN: 2.5, SWIM_STROKE_MERMAID: 3.2, SWIM_STROKE_COOLDOWN: 8,
  WATER_EXIT_BOOST: 4.6, WATER_EXIT_ZONE: 14, WATER_ENTRY_DAMP: 0.35,

  // --- health & damage ---
  MAX_HEARTS: 3, IFRAMES: 90, KNOCKBACK_X: 2.4, KNOCKBACK_Y: 3.0,

  // --- happiness ---
  HAPPINESS_MAX: 100, TREAT_REFILL: 45,
  PANIC_PLAYER_MULT: 0.5, PANIC_ENEMY_MULT: 1.5,

  // --- costumes & powers ---
  GOOSE_JUMP_MULT: 1.18,           // giant goose feet: higher jump...
  GOOSE_TURN_MULT: 0.7,            // ...slower grip, per the GDD
  POUND_FALL: 9, POUND_RADIUS: 56, POUND_STUN: 90,
  LASER_COOLDOWN: 26, LASER_RANGE_TILES: 9,
  SPOON_COOLDOWN: 22, SPOON_RANGE: 26, SPOON_ARC_FRAMES: 12,
  KIRBY_EXTRA_FLAPS: 1,
  FIRE_COOLDOWN: 20, FIREBALL_VX: 3.4, FIREBALL_BOUNCE: 3.0,
  PINK_COOLDOWN: 240, PINK_RADIUS: 64,
  NUT_COOLDOWN: 8, NUT_VX: 4.2,
  SHED_HOP: 3.2, DROP_GRACE: 60,   // shed costume regrab grace
  MOON_TREX_FRAMES: 700, MOONFLEX_FRAMES: 480, MOONFLEX_SPEED: 1.4,

  // --- mecha swan (the finale power fantasy) ---
  MECHA_W: 34, MECHA_H: 50, MECHA_HEARTS: 5,
  MECHA_SPEED: 2.6, MECHA_THRUST: 0.42, MECHA_MAX_RISE: 3.2,
  MECHA_LASER_COOLDOWN: 14, MECHA_LASER_DMG: 2,

  // --- enemies ---
  ENEMY_GRAVITY: 0.32, ENEMY_MAX_FALL: 6,
  FROG_RANGE: 150, FROG_HOP_INTERVAL: 75, FROG_WINDUP: 22, FROG_HOP_VX: 1.6, FROG_HOP_VY: 3.6,
  ROACH_SPEED: 1.1, DINO_SPEED: 0.45, DINO_HP: 2, ENEMY_HIT_IFRAMES: 30,
  GATOR_RANGE: 56, GATOR_REVEAL: 26, GATOR_LUNGE: 2.6, GATOR_HP: 2, GATOR_REST: 80,
  FISH_SPEED: 0.7, MUSH_DMG_HAPPY: 12,
  WISP_SPEED: 1.15, WISP_RANGE: 200,   // dream-wisp: floaty homing flyer
  STINK_RADIUS: 26, STINK_LIFE: 320, STINK_DRAIN: 0.5,

  // --- bosses ---
  BOSS_IFRAMES: 75, BOSS_HURT_FLASH: 35,
  GRUMPIS_HP: 3, GRUMPIS_WINDUP: 55, GRUMPIS_LUNGE_VX: 3.2, GRUMPIS_LUNGE_VY: 4.2, GRUMPIS_RECOVER: 75,
  TWIN_HP: 2, TWIN_ENRAGE: 1.4,
  PAPA_HP: 6, PAPA_SURFACE: 170, PAPA_DIVE: 90, PAPA_SWAT_VX: 2.2,
  FAMILY_PAPA_HP: 4,
  HOG_HP: 6, HOG_WINDUP: 50, HOG_VOLLEY: 3, HOG_LUNGE_VX: 3.0, HOG_RECOVER: 80,
  HOGF_HP: 14, HOGF_VOLLEY: 5,
  MUSH_VX: 2.2, MUSH_VY: 4.5,
  BOSS_ACTIVATE_DIST: 280, BOSS_DEATH_FRAMES: 80,

  // --- scoring ---
  POINTS_POPCORN: 50, POINTS_STOMP: 100, POINTS_BOSS: 5000,
  POINTS_BABY: 5000, POINTS_RESCUE: 8000, POINTS_FINALE: 10000000,
  NAME_MAX_LEN: 8,

  // --- progression ---
  WORLD_COUNT: 6,                  // number of worlds; finale = the last one

  // --- camera & juice ---
  CAM_LERP: 0.12, CAM_LOOKAHEAD: 24, SHAKE_FRAMES: 6,
  HITSTOP_STOMP: 3, HITSTOP_BOSS: 6,

  // --- co-op ---
  COOP_TETHER: 320,                // max px between players before camera clamps the rear one
};
const T = TUNING;
const TS = 16;
