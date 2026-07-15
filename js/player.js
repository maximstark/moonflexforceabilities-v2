"use strict";
/* =====================================================================
 *  PLAYER — swan (P1) & charmgirl (P2), forms, costume stack, powers.
 *  Forms: swan | mermaid (water toggle) | trex (charmgirl + moon) |
 *         mecha (the finale). Costumes stack & shed (GDD 5.2).
 * ===================================================================== */
const SPRING_VEL = 8.2;
let players = [];                 // [p1] or [p1,p2]

function makePlayer(idx, character) {
  const mh = T.MAX_HEARTS * (save.gentle ? T.GENTLE_HEART_MULT : 1);   // GENTLE DREAMS doubles up
  return {
    idx, character,               // "swan" | "charmgirl"
    x: 0, y: 0, w: T.PLAYER_W, h: T.PLAYER_H,
    vx: 0, vy: 0, grounded: false, hitWall: false, bounced: false, standTile: null,
    coyote: 0, jumpBuffer: 0, jumping: false, facing: 1,
    form: character === "charmgirl" ? "charmgirl" : "swan",
    inWater: false, strokeCD: 0,
    flaps: 0, flapCD: 0,
    hearts: mh, maxHearts: mh,
    iframes: 0, dead: false, deadTimer: 0,
    stack: [],                    // worn costumes, bottom->top: goosefeet|laser|kirby|spoon
    powers: [],                   // treasure powers held — they STACK and persist: fire|pink|tree|mace|sticky|shell|egg
    lvl: {}, maceAngle: 0, maceAngle2: 0,   // ability level (mirrored pair / stack count) + the two mace spin angles
    bubble: 0, eggAngle: 0,       // bubblegum buffer hearts (0..3); egg-a-rang orbit phase
    pounding: false, rooted: false, dropThrough: 0,
    atkCD: 0, spoonTimer: 0, pinkCD: 0, fireCD: 0, nutCD: 0, stickyCD: 0, shellCD: 0, eggCD: 0,
    moonTimer: 0,                 // trex (charmgirl) / moonflex (swan)
    carrying: 0,                  // baby swans in tow
    lastSafeX: 0, lastSafeY: 0,
    animTimer: 0, squash: 0,      // squash/stretch juice
    prevBottom: 0,
  };
}
function has(p, costume) { return p.stack.includes(costume); }
function speedMultFor(p) {
  let m = Game.happiness <= 0 ? T.PANIC_PLAYER_MULT : 1;
  if (p.moonTimer > 0) m *= p.character === "swan" ? T.MOONFLEX_SPEED : 1.2;
  m *= (level.speedMult || 1);                        // per-level zoom (e.g. babies-back boost)
  return m;
}

/* ---------------- per-frame update ---------------- */
function updatePlayer(p) {
  const pad = pads[p.idx];
  if (p.dead) { updateDeadPlayer(p); return; }
  p.prevBottom = p.y + p.h;
  p.wasGrounded = p.grounded;
  p.animTimer++;
  if (p.atkCD > 0) p.atkCD--;
  if (p.pinkCD > 0) p.pinkCD--;
  if (p.fireCD > 0) p.fireCD--;
  if (p.nutCD > 0) p.nutCD--;
  if (p.stickyCD > 0) p.stickyCD--;
  if (p.shellCD > 0) p.shellCD--;
  if (p.eggCD > 0) p.eggCD--;
  if (p.spoonTimer > 0) p.spoonTimer--;
  if (p.iframes > 0) p.iframes--;
  if (p.dropThrough > 0) p.dropThrough--;
  if (p.moonTimer > 0 && --p.moonTimer === 0) endMoon(p);
  if (p.squash !== 0) p.squash *= 0.82;
  if (p.powers.includes("mace")) {
    p.maceAngle = (p.maceAngle || 0) - T.MACE_SPEED;                       // CCW mace
    if (p.lvl.mace >= 2) p.maceAngle2 = (p.maceAngle2 || 0) + T.MACE_SPEED;   // a second, CW mace
  }
  p.eggAngle += T.EGG_SPEED;            // egg-a-rang orbit phase (advances even when none are out — harmless)

  if (p.form === "mecha") { updateMecha(p, pad); return; }

  const dir = (pad.held.left ? -1 : 0) + (pad.held.right ? 1 : 0);
  if (dir !== 0 && !p.rooted) p.facing = dir;

  // water state
  const wasInWater = p.inWater;
  const waterRect = pointInWater(p.x + p.w / 2, p.y + p.h / 2);
  p.inWater = !!waterRect;
  if (p.inWater && !wasInWater) {
    p.vy *= T.WATER_ENTRY_DAMP;
    World.burstAt(p.x + p.w / 2, p.y, "splash", 3); AudioSys.sfx("splash");
  }
  if (!p.inWater && wasInWater) World.burstAt(p.x + p.w / 2, p.y + p.h, "splash", 2);
  if (!p.inWater && p.form === "mermaid") p.form = "swan";

  if (p.inWater) updateSwim(p, pad, dir, waterRect);
  else updateLand(p, pad, dir);

  p.fallV = p.vy;                    // remembered for landing juice (the mover zeroes vy)
  moveAndCollide(p, { corner: true, oneway: true, dropThrough: p.dropThrough > 0 });
  afterMove(p, pad);
}

function updateLand(p, pad, dir) {
  const mult = speedMultFor(p);
  const running = !!pad.held.run;                  // SMW-style dash: hold to go faster
  const walkMax = T.MAX_RUN_SPEED * mult;
  const max = running ? walkMax * T.RUN_SPEED_MULT : walkMax;
  const turnMult = has(p, "goosefeet") ? T.GOOSE_TURN_MULT : 1;

  if (p.rooted) {                                  // tree power: planted
    p.vx = 0;
    if (!pad.held.down || !p.grounded) p.rooted = false;
  } else if (dir !== 0) {
    if (Math.abs(p.vx) <= max) {                   // accelerate toward the cap
      let a = p.grounded ? (running ? T.RUN_ACCEL : T.GROUND_ACCEL) : T.AIR_ACCEL;
      if (p.grounded && p.vx !== 0 && Math.sign(p.vx) !== dir) a = T.TURN_ACCEL * turnMult;
      p.vx += dir * a;
      if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * max;     // don't overshoot the cap
    } else {                                        // over the cap (let go of run, or a buff faded):
      const ease = (!running && Math.abs(p.vx) > walkMax) ? T.RUN_EASE : T.GROUND_DECEL;
      p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - ease);   // ease down, keep momentum
    }
    if (running && p.grounded && Math.abs(p.vx) > walkMax + 0.1 && p.animTimer % 6 === 0)
      World.burstAt(p.x + p.w / 2, p.y + p.h, "poof", 1);           // dash dust
  } else {
    const d = p.grounded ? T.GROUND_DECEL : T.AIR_DECEL;
    p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), d);
  }

  // coyote + buffer (sacred)
  p.coyote = p.grounded ? T.COYOTE_FRAMES : Math.max(0, p.coyote - 1);
  if (pad.pressed.has("jump")) p.jumpBuffer = T.JUMP_BUFFER_FRAMES;
  else if (p.jumpBuffer > 0) p.jumpBuffer--;

  if (p.grounded) { p.flaps = 0; p.pounding = false; }

  // drop through one-way platforms: down + jump
  if (p.grounded && pad.held.down && p.jumpBuffer > 0 && p.standTile &&
      p.standTile.t >= 0 && ONEWAY.has(p.standTile.t)) {
    p.dropThrough = 8; p.jumpBuffer = 0; p.y += 2;
  } else if (p.jumpBuffer > 0 && p.coyote > 0) {
    const jv = T.JUMP_VEL * (has(p, "goosefeet") ? T.GOOSE_JUMP_MULT : 1);
    p.vy = -jv; p.jumping = true; p.jumpBuffer = 0; p.coyote = 0;
    p.squash = -0.25; AudioSys.sfx("jump");
    World.burstAt(p.x + p.w / 2, p.y + p.h, "poof", 1);
  } else if (p.jumpBuffer === T.JUMP_BUFFER_FRAMES && !p.grounded && p.coyote === 0 &&
             !p.pounding && !groundWithin(p, 14)) {
    // air flap glide (swan thing; kirby cap adds one).
    // groundWithin guard: near the floor the press stays buffered for the
    // landing jump instead — protects the slice's jump-buffer feel.
    const maxFlaps = T.FLAPS_MAX + (p.lvl.kirby || 0) * T.KIRBY_EXTRA_FLAPS;
    if (p.flaps < maxFlaps && p.flapCD <= 0) {
      p.flaps++; p.flapCD = T.FLAP_MIN_INTERVAL;
      p.vy = Math.min(p.vy, -T.FLAP_VEL);
      p.jumpBuffer = 0; AudioSys.sfx("flap");
      World.burstAt(p.x + p.w / 2, p.y + p.h - 4, "feather", 2);
    }
  }
  if (p.flapCD > 0) p.flapCD--;

  if (p.jumping && !pad.held.jump && p.vy < 0) { p.vy *= T.JUMP_CUT_MULT; p.jumping = false; }

  // ground pound (giant goose feet)
  if (!p.grounded && !p.pounding && has(p, "goosefeet") && pad.pressed.has("down")) {
    p.pounding = true; p.vx = 0; p.vy = T.POUND_FALL * 0.4;
  }
  if (p.pounding) {
    p.vy = Math.min(p.vy + 0.8, T.POUND_FALL);
  } else {
    let g = p.vy < 0 ? T.GRAVITY_RISE : T.GRAVITY_FALL;
    if (!p.grounded && Math.abs(p.vy) < T.APEX_SPEED) g *= T.APEX_GRAVITY_MULT;
    p.vy = Math.min(p.vy + g, T.MAX_FALL_SPEED);
  }

  // actions
  if (pad.pressed.has("action")) doAttack(p, pad);
  if (p.rooted && p.powers.includes("tree") && pad.held.action && p.nutCD <= 0) shootNut(p);
  // plant roots
  if (p.powers.includes("tree") && p.grounded && pad.held.down && !p.rooted) {
    p.rooted = true; World.burstAt(p.x + p.w / 2, p.y + p.h, "poof", 2);
  }
}

function updateSwim(p, pad, dir, waterRect) {
  if (pad.pressed.has("transform") && p.character === "swan") {
    p.form = p.form === "swan" ? "mermaid" : "swan";
    AudioSys.sfx("transform");
    World.addFloater(p.x + p.w / 2, p.y - 6, p.form === "mermaid" ? "MERMAID!" : "SWAN!");
    World.burstAt(p.x + p.w / 2, p.y + p.h / 2, "spark", 5);
  }
  const mer = p.form === "mermaid";
  const accel = mer ? T.WATER_ACCEL_MERMAID : T.WATER_ACCEL_SWAN;
  const max = (mer ? T.WATER_MAX_SPEED_MERMAID : T.WATER_MAX_SPEED_SWAN) * speedMultFor(p);
  if (dir !== 0) p.vx += dir * accel;
  else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), T.WATER_DRAG);
  p.vx = clamp(p.vx, -max, max);

  if (p.strokeCD > 0) p.strokeCD--;
  if (pad.pressed.has("jump") && p.strokeCD <= 0) {
    const nearSurface = (p.y + p.h / 2) - waterRect.y < T.WATER_EXIT_ZONE;
    if (nearSurface) p.vy = -T.WATER_EXIT_BOOST;
    else {
      const stroke = mer ? T.SWIM_STROKE_MERMAID : T.SWIM_STROKE_SWAN;
      p.vy = Math.min(p.vy, -stroke * speedMultFor(p));
      if (Math.random() < 0.7) World.burstAt(p.x + p.w / 2, p.y + p.h / 2, "bubble", 1);
    }
    p.strokeCD = T.SWIM_STROKE_COOLDOWN;
  }
  // gentle dive with down
  if (pad.held.down) p.vy = Math.min(p.vy + 0.06, T.WATER_MAX_FALL * 1.4);
  p.vy = Math.min(p.vy + T.WATER_GRAVITY, T.WATER_MAX_FALL);
  p.coyote = 0; p.jumpBuffer = 0; p.jumping = false; p.flaps = 0; p.pounding = false;
  if (pad.pressed.has("action")) doAttack(p, pad);
}

function updateMecha(p, pad) {
  const dir = (pad.held.left ? -1 : 0) + (pad.held.right ? 1 : 0);
  if (dir !== 0) p.facing = dir;
  const max = T.MECHA_SPEED;
  if (dir !== 0) p.vx = clamp(p.vx + dir * 0.3, -max, max);
  else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 0.2);
  if (pad.held.jump) {
    p.vy = Math.max(p.vy - T.MECHA_THRUST, -T.MECHA_MAX_RISE);
    if (p.animTimer % 5 === 0) World.burstAt(p.x + p.w / 2, p.y + p.h, "spark", 1);
  }
  p.vy = Math.min(p.vy + 0.3, 5.5);
  p.fallV = p.vy;
  moveAndCollide(p, { corner: true, oneway: true });
  // a giant mecha swan does not go around mushroom masonry
  breakBlocksInRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
  if (pad.pressed.has("action") || (pad.held.action && p.atkCD <= 0)) doAttack(p, pad);
  afterMove(p, pad);
}


function afterMove(p, pad) {
  if (p.bounced) {                                  // spring tiles
    p.vy = -SPRING_VEL; p.grounded = false; p.jumping = false;
    p.squash = -0.35; AudioSys.sfx("spring");
    World.burstAt(p.x + p.w / 2, p.y + p.h, "poof", 3);
  }
  if (p.grounded && p.pounding) landPound(p);
  else if (p.grounded && !p.wasGrounded && p.fallV > 2.2) {   // landing: dust + a little squat
    p.squash = Math.max(p.squash, Math.min(0.4, p.fallV * 0.06));
    World.burstAt(p.x + p.w / 2, p.y + p.h, "poof", p.fallV > 5 ? 4 : 2);
    if (p.fallV >= T.MAX_FALL_SPEED - 0.5) Game.shake = Math.max(Game.shake, 2);
  }
  // speed ghosts while dashing past the walk cap (or moonflexed)
  const ghosting = Math.abs(p.vx) > T.MAX_RUN_SPEED * speedMultFor(p) + 0.1 ||
                   (p.moonTimer > 0 && p.character === "swan");
  if (ghosting && p.animTimer % 3 === 0)
    (p.trail = p.trail || []).push({ x: p.x, y: p.y, facing: p.facing, t: 12 });
  if (p.trail && p.trail.length) {
    for (const g of p.trail) g.t--;
    p.trail = p.trail.filter(g => g.t > 0);
  }
  if (p.grounded && !p.inWater) { p.lastSafeX = p.x; p.lastSafeY = p.y; }
  // fire tiles: stomp out from above, burn from the side
  if (p.standTile && fireAt(p.standTile.tx, p.standTile.ty)) {
    extinguishAt(p.standTile.tx, p.standTile.ty);
    p.vy = -3; p.grounded = false;
  } else {
    const tx0 = Math.floor(p.x / TS), tx1 = Math.floor((p.x + p.w - 1) / TS);
    const ty0 = Math.floor(p.y / TS), ty1 = Math.floor((p.y + p.h - 1) / TS);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        if (fireAt(tx, ty)) hurtPlayer(p, tx * TS + 8);
  }
  // fell out of the dream
  if (p.y > gridH * TS + 48) {
    p.hearts--;
    AudioSys.sfx("hurt");
    buzz(80);
    if (typeof Shell !== "undefined") Shell.jostle();
    if (p.hearts <= 0) killPlayer(p);
    else { p.x = p.lastSafeX; p.y = p.lastSafeY; p.vx = 0; p.vy = 0; p.iframes = T.IFRAMES; }
  }
}

/* ---------------- attacks ---------------- */
function doAttack(p, pad) {
  let acted = false;
  if (has(p, "spoon") && p.spoonTimer <= 0) {       // THE GIANT SPOON
    p.spoonTimer = T.SPOON_ARC_FRAMES;
    spoonSwing(p); acted = true;
  }
  if (p.form === "mecha" && p.atkCD <= 0) {
    fireLaser(p, T.MECHA_LASER_DMG); p.atkCD = T.MECHA_LASER_COOLDOWN; acted = true;
  } else if (has(p, "laser") && p.atkCD <= 0) {     // LASER BEAM EYES
    fireLaser(p, 1); if (p.lvl.laser >= 2) fireLaser(p, 1, -p.facing); p.atkCD = T.LASER_COOLDOWN; acted = true;
  }
  if (p.powers.includes("fire") && p.fireCD <= 0) {
    spawnProjectile("fireball", p.x + p.w / 2, p.y + 6, p.facing * T.FIREBALL_VX, -1.5, "player", 1);
    if (p.lvl.fire >= 2)                                  // a second fireball out the back
      spawnProjectile("fireball", p.x + p.w / 2, p.y + 6, -p.facing * T.FIREBALL_VX, -1.5, "player", 1);
    p.fireCD = T.FIRE_COOLDOWN; AudioSys.sfx("fire"); acted = true;
  }
  if (p.powers.includes("pink") && p.pinkCD <= 0) {        // the pink burst
    p.pinkCD = T.PINK_COOLDOWN; pinkBurst(p); acted = true;
  }
  if (p.powers.includes("tree") && p.nutCD <= 0) { shootNut(p); acted = true; }   // X throws a nut; rooting rapid-fires
  if (p.powers.includes("sticky") && p.stickyCD <= 0) { shootSticky(p); acted = true; }
  if (p.powers.includes("shell") && p.shellCD <= 0) { shootShell(p); acted = true; }
  if (p.powers.includes("egg") && p.eggCD <= 0) { throwEgg(p); acted = true; }
  return acted;
}
// THE STICKY HAND — snaps out at 45 degrees and yanks back fast; stacks fan it out.
function shootSticky(p) {
  p.stickyCD = T.STICKY_COOLDOWN;
  const n = p.lvl.sticky || 1;
  const angs = [-Math.PI / 4];                          // 1: up-forward 45 degrees
  if (n >= 2) angs.push(Math.PI / 4);                   // 2: + down-forward 45 degrees
  if (n >= 3) angs.push(0);                             // 3: + straight ahead
  for (const a of angs)
    Combat.stickyHands.push({ owner: p, facing: p.facing, ang: a, len: 0, phase: "out", t: 0,
                              hit: new Set() });
  AudioSys.sfx("spoon");
}
// THE MERMAID SHELL — lobbed up a 60-degree arc; stacks add close-clustered shells.
function shootShell(p) {
  p.shellCD = T.SHELL_COOLDOWN;
  const n = p.lvl.shell || 1;
  const base = Math.PI / 3;                             // 60 degrees above the horizon
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * T.SHELL_SPREAD;
    spawnProjectile("shell", p.x + p.w / 2 - 8, p.y + 4,
                    p.facing * Math.cos(a) * T.SHELL_SPEED, -Math.sin(a) * T.SHELL_SPEED, "player", T.SHELL_DMG);
  }
  AudioSys.sfx("splash");
}
// THE EGG-A-RANG — a fried egg loops once around you and comes home.
function throwEgg(p) {
  p.eggCD = T.EGG_COOLDOWN;
  const n = p.lvl.egg || 1;
  for (let i = 0; i < n; i++)
    Combat.eggs.push({ owner: p, off: i * Math.PI, t: 0, life: T.EGG_LIFE, hit: new Set() });
  AudioSys.sfx("pink");
}
function fireLaser(p, dmg, dir) {
  AudioSys.sfx("laser");
  const aim = pads[p.idx].held.up ? -0.35 : pads[p.idx].held.down ? 0.35 : 0;
  Combat.laserShots.push({ x: p.x + p.w / 2, y: p.y + (p.form === "mecha" ? 8 : 6),
                           dir: dir || p.facing, aim, dmg, life: 8, owner: p });
}
function spoonSwing(p) {
  AudioSys.sfx("spoon");
  Combat.spoonSwings.push({ owner: p, life: T.SPOON_ARC_FRAMES, both: (p.lvl.spoon || 0) >= 2 });
}
function pinkBurst(p) {
  AudioSys.sfx("pink");
  Combat.pinkBursts.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, life: 18 });
  World.burstAt(p.x + p.w / 2, p.y + p.h / 2, "ring", 6);
  Game.shake = 4;
}
function shootNut(p) {
  spawnProjectile("nut", p.x + p.w / 2, p.y + 4, p.facing * T.NUT_VX, -0.6, "player", 1);
  if ((p.lvl.tree || 0) >= 2)                            // a second nut, lobbed at ~30 degrees
    spawnProjectile("nut", p.x + p.w / 2, p.y + 4, p.facing * T.NUT_VX * 0.87, -T.NUT_VX * 0.5, "player", 1);
  p.nutCD = T.NUT_COOLDOWN; AudioSys.sfx("nut");
}
function landPound(p) {
  p.pounding = false;
  p.squash = 0.45;
  Game.shake = T.SHAKE_FRAMES; Game.hitstop = T.HITSTOP_STOMP;
  AudioSys.sfx("pound");
  breakBlocksInRect(p.x - 4, p.y + p.h, p.w + 8, 10);
  World.burstAt(p.x + p.w / 2, p.y + p.h, "poof", 6);
  Combat.poundShocks.push({ x: p.x + p.w / 2, y: p.y + p.h, life: 6 });
}

/* ---------------- costumes ---------------- */
function wearCostume(p, costume) {
  if (!has(p, costume)) p.stack.push(costume);
  p.lvl[costume] = Math.min(2, (p.lvl[costume] || 0) + 1);     // a 2nd of the same = mirrored pair
  AudioSys.sfx("transform");
  World.addFloater(p.x + p.w / 2, p.y - 8,
    { goosefeet: "GIANT GOOSE FEET!", laser: "LASER EYES!", kirby: "KIRBY CAP!", spoon: "THE SPOON!" }[costume] || costume);
}
function shedCostume(p) {
  if (!p.stack.length) return;
  const costume = p.stack.pop();                    // jump out of the topmost layer
  p.vy = -T.SHED_HOP; p.jumping = false;
  AudioSys.sfx("shed");
  World.dropCostume(costume, p.x + p.w / 2 - 8, p.y - 4);
  World.burstAt(p.x + p.w / 2, p.y + p.h / 2, "poof", 3);
}
function endMoon(p) {
  if (p.character === "charmgirl") {
    p.form = "charmgirl"; p.w = T.PLAYER_W; p.h = T.PLAYER_H;
    World.addFloater(p.x, p.y - 8, "the moon set...");
  }
}
function grantMoon(p) {
  AudioSys.sfx("moonflex");
  if (p.character === "charmgirl") {
    p.form = "trex"; p.moonTimer = T.MOON_TREX_FRAMES;
    const cx = p.x + p.w / 2, by = p.y + p.h;
    p.w = 36; p.h = 40; p.x = cx - p.w / 2; p.y = by - p.h;
    World.addFloater(p.x, p.y - 10, "T-REX TIME!");
  } else {
    p.moonTimer = T.MOONFLEX_FRAMES;
    World.addFloater(p.x, p.y - 10, "MOONFLEX!!");
  }
  Game.shake = 5;
}

/* ---------------- damage / death ---------------- */
function hurtPlayer(p, fromX) {
  if (p.iframes > 0 || p.dead || Game.state !== "play") return;
  if (p.moonTimer > 0 && p.character === "swan") return;      // moonflex: untouchable
  let soaked = false;                                          // shield/costume ate it (lighter buzz)
  if (p.bubble > 0) {                                          // the bubblegum shield pops first (outermost)
    p.bubble--; soaked = true;
    World.burstAt(p.x + p.w / 2, p.y + p.h / 2, "ring", 6);
    World.addFloater(p.x + p.w / 2, p.y - 8, "POP!");
    AudioSys.sfx("bubble");
  } else if (p.stack.length) {                                 // costumes absorb the hit
    const costume = p.stack.pop(); soaked = true;
    World.dropCostume(costume, p.x + p.w / 2 - 8, p.y - 4);
  } else {
    p.hearts--;
  }
  buzz(soaked ? 30 : 80);                                      // the hit reaches your hands
  if (typeof Shell !== "undefined") Shell.jostle();            // ...and the whole cabinet
  p.iframes = T.IFRAMES;
  p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * T.KNOCKBACK_X;
  p.vy = -T.KNOCKBACK_Y;
  p.rooted = false; p.pounding = false;
  Game.hitstop = Math.max(Game.hitstop, 3);
  Game.shake = Math.max(Game.shake, 3);
  AudioSys.sfx("hurt");
  World.burstAt(p.x + p.w / 2, p.y, "feather", 4);
  World.burstAt(p.x + p.w / 2, p.y + p.h / 2, "ring", 1);
  if (p.hearts <= 0) killPlayer(p);
}
function killPlayer(p) {
  p.dead = true; p.deadTimer = 70; p.vy = -4.5; p.vx = 0;
  const others = players.filter(q => !q.dead);
  if (others.length === 0) { Game.state = "dying"; Game.stateTimer = 80; }
}
function updateDeadPlayer(p) {
  p.vy = Math.min(p.vy + T.GRAVITY_FALL, T.MAX_FALL_SPEED);
  p.y += p.vy;
  if (Game.state === "play" && --p.deadTimer <= 0 && players.some(q => !q.dead)) {
    // co-op mercy respawn beside the living player
    const buddy = players.find(q => !q.dead);
    p.dead = false; p.hearts = 2; p.iframes = T.IFRAMES;
    p.x = buddy.x; p.y = buddy.y - 24; p.vx = 0; p.vy = 0;
  }
}

/* ---------------- hitboxes ---------------- */
function bubbleR(p) { return T.BUBBLE_R + (p.bubble - 1) * 3; }   // grows a touch per stacked bubble
function hurtbox(p) {
  if (p.bubble > 0) {                            // the bubble IS the hitbox now — a bigger, rounder target
    const r = bubbleR(p), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
  }
  const i = T.HURTBOX_INSET;
  return { x: p.x + i, y: p.y + i, w: p.w - 2 * i, h: p.h - 2 * i };
}
function stompbox(p) {
  const m = T.STOMP_MARGIN;
  return { x: p.x - m, y: p.y, w: p.w + 2 * m, h: p.h };
}
function classifyContact(p, b) {
  if (p.dead) return null;
  if (overlaps(stompbox(p), b) && (p.vy > 0.5 || p.pounding) &&
      p.prevBottom <= b.y + T.STOMP_GRACE) return "stomp";
  if (p.moonTimer > 0 && overlaps(stompbox(p), b)) return "moon";   // star-power touch
  if (p.form === "trex" && overlaps(stompbox(p), b)) return "moon";
  if (overlaps(hurtbox(p), b)) return "hurt";
  return null;
}
function bouncePlayer(p) {
  const held = pads[p.idx].held.jump;
  p.vy = -(held ? T.STOMP_BOUNCE_HELD : T.STOMP_BOUNCE) * (p.pounding ? 1.3 : 1);
  p.jumping = !!held;
  p.pounding = false; p.flaps = 0;
}

/* ---------------- drawing ---------------- */
function drawPlayer(p, camX, camY) {
  if (p.dead && Game.state !== "play" && Game.state !== "dying") return;
  if (!p.dead && p.iframes > 0 && (p.iframes >> 2) % 2 === 0) return;
  let sheet, frame;
  const moving = Math.abs(p.vx) > 0.15;
  if (p.form === "mecha") {
    sheet = "mecha";
    frame = !p.grounded ? ((p.animTimer >> 3) % 2 ? "fly2" : "fly1")
          : moving ? ((p.animTimer >> 3) % 2 ? "walk2" : "walk1") : "idle";
  } else if (p.form === "trex") {
    sheet = "trex";
    frame = p.moonTimer > T.MOON_TREX_FRAMES - 30 ? "roar"
          : (p.animTimer >> 4) % 2 ? "walk2" : "walk1";
  } else if (p.form === "charmgirl") {
    sheet = "charmgirl";
    frame = !p.grounded ? "jump" : moving ? ((p.animTimer >> 3) % 2 ? "walk2" : "walk1") : "idle";
  } else if (p.inWater) {
    sheet = p.form === "mermaid" ? "mermaid" : "swan";
    const swimming = moving || Math.abs(p.vy) > 0.3;
    frame = p.form === "mermaid" && !swimming ? "idle"
          : (p.animTimer >> 3) % 2 ? "swim2" : "swim1";
  } else {
    sheet = "swan";
    if (!p.grounded) frame = "jump";
    else if (moving) frame = ["walk1", "walk2", "walk3", "walk4"][(p.animTimer >> 2) % 4];
    else frame = p.animTimer % 180 < 7 ? "blink" : "idle";
  }
  const s = sheets[sheet];
  const anchor = s.anchor || [s.draw_w / 2, s.draw_h];
  const dx = p.x + p.w / 2 - (p.facing < 0 ? s.draw_w - anchor[0] : anchor[0]) - camX;
  const dy = p.y + p.h - anchor[1] - camY;
  const flip = p.facing < 0;

  // speed ghosts fade out behind a dashing swan
  if (p.trail && p.trail.length) {
    for (const g of p.trail) {
      ctx.globalAlpha = 0.08 + 0.14 * (g.t / 12);
      const ga = g.facing < 0 ? s.draw_w - anchor[0] : anchor[0];
      drawFrame(sheet, frame, g.x + p.w / 2 - ga - camX,
                g.y + p.h - anchor[1] - camY, g.facing < 0);
    }
    ctx.globalAlpha = 1;
  }

  // squash & stretch around the feet
  if (Math.abs(p.squash) > 0.02) {
    ctx.save();
    ctx.translate(Math.round(dx + s.draw_w / 2), Math.round(p.y + p.h - camY));
    ctx.scale(1 + p.squash * 0.6, 1 - p.squash);
    drawSheetCentered(s, frame, flip);
    ctx.restore();
  } else {
    drawFrame(sheet, frame, dx, dy, flip);
  }
  // moonflex shimmer
  if (p.moonTimer > 0 && p.character === "swan" && p.animTimer % 4 === 0)
    World.burstAt(p.x + Math.random() * p.w, p.y + Math.random() * p.h, "moonspark", 1);

  // worn costume overlays (the visible stack)
  const cx = p.x + p.w / 2 - camX, footY = p.y + p.h - camY;
  const head = s.attachments.head || [anchor[0], Math.max(4, anchor[1] - s.draw_h + 4)];
  const headX = dx + (flip ? s.draw_w - head[0] : head[0]);
  const headY = dy + head[1];
  if (has(p, "goosefeet")) drawFrame("gear", "goosefeet", cx - 14, footY - 24, flip);
  if (has(p, "laser") && p.form !== "mecha") drawFrame("gear", "visor", headX - 14, headY - 8, flip);
  if (has(p, "kirby")) drawFrame("gear", "kirbycap", headX - 14, headY - 20, flip);
  if (has(p, "spoon")) {
    const swing = p.spoonTimer > T.SPOON_ARC_FRAMES / 2;
    drawFrame("gear", swing ? "spoon_down" : "spoon_up",
              cx + (flip ? -26 : -2), footY - 30, flip);
  }
  // bubblegum shield: a vibrant pink bubble wrapping the body (one ring per stack)
  if (p.bubble > 0) {
    const bcx = p.x + p.w / 2 - camX, bcy = p.y + p.h / 2 - camY;
    const wob = Math.sin(p.animTimer / 12) * 0.8;
    for (let i = 0; i < p.bubble; i++) {
      const r = bubbleR(p) - i * 3 + wob;
      ctx.beginPath(); ctx.arc(bcx, bcy, r, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? "rgba(255,120,200,0.18)" : "rgba(255,150,215,0.10)"; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,110,195,0.85)"; ctx.stroke();
    }
    const r = bubbleR(p) + wob;                 // a little glint
    ctx.fillStyle = "rgba(255,245,255,0.85)";
    ctx.beginPath(); ctx.arc(bcx - r * 0.42, bcy - r * 0.42, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // carried babies bob behind
  for (let i = 0; i < p.carrying; i++) {
    const bx = p.x - p.facing * (14 + i * 12) - camX;
    const by = p.y + Math.sin((p.animTimer + i * 20) / 9) * 3 - camY;
    drawFrame("babyswan", (p.animTimer >> 4 + i) % 2 ? "bob2" : "bob1", bx, by, flip);
  }
}
function drawSheetCentered(s, frame, flip) {
  const i = s.index[frame];
  ctx.save();
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(s.img, i * s.frame_w, 0, s.frame_w, s.frame_h,
                -s.draw_w / 2, -s.draw_h, s.draw_w, s.draw_h);
  ctx.restore();
}
