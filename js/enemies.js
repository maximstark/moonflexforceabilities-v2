"use strict";
/* =====================================================================
 *  ENEMIES & COMBAT — frogs, roaches, dinos, the cat-face alligator,
 *  fish, projectiles (fireball/nut/mushroom), stink clouds, and the
 *  transient attack volumes (lasers, spoon arcs, pink bursts, pounds).
 * ===================================================================== */
let enemies = [], projectiles = [], stinkClouds = [];
const Combat = { laserShots: [], spoonSwings: [], pinkBursts: [], poundShocks: [] };

const ENEMY_DEFS = {
  frog:      { w: 20, h: 16, sheet: "frog",      hp: 1, score: 100 },
  cockroach: { w: 24, h: 12, sheet: "cockroach", hp: 1, score: 100 },
  dino:      { w: 26, h: 24, sheet: "dino",      hp: T.DINO_HP, score: 200 },
  alligator: { w: 40, h: 22, sheet: "alligator", hp: T.GATOR_HP, score: 300 },
  fish:      { w: 12, h: 8,  sheet: "fish",      hp: 1, score: 50, gentle: true },
  wisp:      { w: 14, h: 14, sheet: "wisp",      hp: 1, score: 150 },
  fly:       { w: 18, h: 13, sheet: "fly",       hp: 2, score: 250 },
};

const FLOATERS = new Set(["fish", "alligator", "wisp", "fly"]);   // no-gravity movers

function makeEnemy(spec) {
  const d = ENEMY_DEFS[spec.type];
  return { type: spec.type, w: d.w, h: d.h, hp: d.hp, score: d.score, gentle: !!d.gentle,
           x: spec.x, y: spec.y, vx: 0, vy: 0, dir: -1, baseY: spec.y,
           grounded: false, hitWall: false, state: "idle", timer: T.FROG_HOP_INTERVAL,
           iframes: 0, stun: 0, deadTimer: 0, alive: true, animTimer: 0, revealed: false };
}

function enemyMult() { return Game.happiness <= 0 ? T.PANIC_ENEMY_MULT : 1; }
function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const p of players) {
    if (p.dead) continue;
    const d = dist2(x, y, p.x + p.w / 2, p.y + p.h / 2);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/* ---------------- per-type updates ---------------- */
function updateEnemies() {
  const mult = enemyMult();
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.deadTimer > 0) { if (--e.deadTimer <= 0) e.alive = false; continue; }
    e.animTimer++;
    if (e.iframes > 0) e.iframes--;
    if (e.stun > 0) { e.stun--; e.vx = 0; }
    else updateEnemyBrain(e, mult);

    if (e.type === "fish" || e.type === "alligator" || e.type === "wisp" || e.type === "fly") {  // floaters: no gravity
      e.x += e.vx; e.y += e.vy;
    } else {
      e.vy = Math.min(e.vy + T.ENEMY_GRAVITY, T.ENEMY_MAX_FALL);
      moveAndCollide(e);
    }
    if (e.y > gridH * TS + 64) { e.alive = false; continue; }
    contactPlayers(e);
  }
  separateEnemies();
  enemies = enemies.filter(e => e.alive || e.deadTimer > 0);
}

/* Soft body-separation so a crowd never collapses into one stack. Without it,
 * identical-speed walkers phase-lock when they snap to the same wall, and
 * homing flyers/frogs all pile onto the player. We nudge overlapping pairs
 * apart along the shallowest axis (X for anything touching the ground, so we
 * never lift a walker off its floor; 2D only for floater-vs-floater clouds). */
function separateEnemies() {
  const n = enemies.length;
  for (let i = 0; i < n; i++) {
    const a = enemies[i];
    if (!a.alive || a.deadTimer > 0) continue;
    for (let j = i + 1; j < n; j++) {
      const b = enemies[j];
      if (!b.alive || b.deadTimer > 0) continue;
      const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
      const dy = (a.y + a.h / 2) - (b.y + b.h / 2);
      const ox = (a.w + b.w) / 2 - Math.abs(dx);
      const oy = (a.h + b.h) / 2 - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;                 // not overlapping
      const bothFloat = FLOATERS.has(a.type) && FLOATERS.has(b.type);
      const cap = bothFloat ? 1.6 : 1;           // homers converge fast — push them harder
      if (bothFloat && oy < ox) {
        const s = dy === 0 ? ((i + j) & 1 ? 1 : -1) : Math.sign(dy);
        const p = Math.min(oy / 2, cap);
        a.y += s * p; b.y -= s * p;
      } else {
        const s = dx === 0 ? ((i + j) & 1 ? 1 : -1) : Math.sign(dx);
        const p = Math.min(ox / 2, cap);
        a.x += s * p; b.x -= s * p;
      }
    }
  }
}

function updateEnemyBrain(e, mult) {
  const pl = nearestPlayer(e.x + e.w / 2, e.y + e.h / 2);
  if (e.type === "frog") {
    const dist = pl ? Math.abs((pl.x + pl.w / 2) - (e.x + e.w / 2)) : 1e9;
    if (e.state === "idle") {
      e.vx = 0;
      if (dist < T.FROG_RANGE && --e.timer <= 0) {
        e.state = "windup"; e.timer = T.FROG_WINDUP;
        e.dir = pl && pl.x > e.x ? 1 : -1;
      }
    } else if (e.state === "windup") {
      if (--e.timer <= 0) {
        e.state = "air"; e.vx = e.dir * T.FROG_HOP_VX * mult; e.vy = -T.FROG_HOP_VY;
      }
    } else if (e.state === "air" && e.grounded) {
      e.state = "idle"; e.timer = Math.round(T.FROG_HOP_INTERVAL / mult); e.vx = 0;
    }
  } else if (e.type === "cockroach" || e.type === "dino") {
    const speed = (e.type === "cockroach" ? T.ROACH_SPEED : T.DINO_SPEED) * mult;
    e.vx = e.dir * speed;
    if (e.grounded) {
      const aheadX = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      const ftx = Math.floor(aheadX / TS), fty = Math.floor((e.y + e.h + 2) / TS);
      if (e.hitWall || (!isSolid(ftx, fty) && !isOneway(ftx, fty))) e.dir *= -1;
    }
  } else if (e.type === "fish") {
    e.vx = e.dir * T.FISH_SPEED * mult;
    e.vy = Math.sin(e.animTimer / 14) * 0.35;
    if (!pointInWater(e.x + (e.dir > 0 ? e.w + 8 : -8), e.y + e.h / 2)) e.dir *= -1;
  } else if (e.type === "alligator") {
    /* the cat face that is ACTUALLY an alligator */
    if (e.state === "idle") {                       // floats, looking adorable
      e.vx = 0; e.vy = Math.sin(e.animTimer / 18) * 0.2;
      const d = pl ? Math.sqrt(dist2(pl.x + pl.w/2, pl.y + pl.h/2, e.x + e.w/2, e.y + e.h/2)) : 1e9;
      if (d < T.GATOR_RANGE && pl && pl.inWater) {
        e.state = "reveal"; e.timer = T.GATOR_REVEAL; e.revealed = true;
        e.dir = pl.x > e.x ? 1 : -1;
        AudioSys.sfx("agh");
        World.addFloater(e.x + e.w / 2, e.y - 10, "AGH!!");
        Game.shake = 4;
      }
    } else if (e.state === "reveal") {
      if (--e.timer <= 0) {
        e.state = "chomp"; e.timer = 50;
        const p2 = nearestPlayer(e.x, e.y);
        if (p2) {
          const dx = (p2.x + p2.w/2) - (e.x + e.w/2), dy = (p2.y + p2.h/2) - (e.y + e.h/2);
          const m = Math.max(1, Math.hypot(dx, dy));
          e.vx = dx / m * T.GATOR_LUNGE * enemyMult(); e.vy = dy / m * T.GATOR_LUNGE * enemyMult();
        }
      }
    } else if (e.state === "chomp") {
      e.vx *= 0.97; e.vy *= 0.97;
      if (!pointInWater(e.x + e.w / 2, e.y + e.h / 2)) { e.vy += 0.2; }   // flop back down
      if (--e.timer <= 0) { e.state = "rest"; e.timer = T.GATOR_REST; }
    } else if (e.state === "rest") {
      e.vx *= 0.9; e.vy = Math.sin(e.animTimer / 18) * 0.2;
      if (--e.timer <= 0) { e.state = "idle"; e.revealed = false; }
    }
  } else if (e.type === "wisp") {
    e.vy = Math.sin(e.animTimer / 16) * 0.4;             // idle drift/bob
    if (pl) {
      const dx = (pl.x + pl.w / 2) - (e.x + e.w / 2);
      const dy = (pl.y + pl.h / 2) - (e.y + e.h / 2);
      const dd = Math.hypot(dx, dy) || 1;
      if (dd < T.WISP_RANGE) { e.vx += dx / dd * 0.05 * mult; e.vy += dy / dd * 0.05 * mult; }
      else e.vx *= 0.95;
    }
    e.vx = clamp(e.vx, -T.WISP_SPEED * mult, T.WISP_SPEED * mult);
    e.vy = clamp(e.vy, -T.WISP_SPEED * mult, T.WISP_SPEED * mult);
    e.dir = e.vx < 0 ? -1 : 1;
  } else if (e.type === "fly") {
    let homing = false;
    if (pl) {
      const dx = (pl.x + pl.w / 2) - (e.x + e.w / 2);
      const dy = (pl.y + pl.h / 2) - (e.y + e.h / 2);
      const dd = Math.hypot(dx, dy) || 1;
      if (dd < T.FLY_RANGE) { e.vx += dx / dd * 0.22 * mult; e.vy += dy / dd * 0.22 * mult; homing = true; }
    }
    // out of range: bleed off velocity so the jitter can't accumulate into a
    // steady drift (sin() summed has a DC bias) and sink the fly off-screen
    if (!homing) { e.vx *= 0.9; e.vy *= 0.9; }
    e.vy += Math.sin(e.animTimer / 5) * 0.25;             // jittery menace
    const sp = T.FLY_SPEED * mult;
    e.vx = clamp(e.vx, -sp, sp); e.vy = clamp(e.vy, -sp, sp);
    e.dir = e.vx < 0 ? -1 : 1;
  }
}

function contactPlayers(e) {
  const box = { x: e.x, y: e.y, w: e.w, h: e.h };
  for (const p of players) {
    if (p.dead) continue;
    const kind = classifyContact(p, box);
    if (!kind) continue;
    if ((kind === "stomp" || kind === "moon") && e.iframes <= 0) {
      damageEnemy(e, p.pounding || kind === "moon" ? 2 : 1, p);
      if (kind === "stomp") bouncePlayer(p);
      Game.hitstop = T.HITSTOP_STOMP;
    } else if (kind === "hurt" && !e.gentle && e.deadTimer <= 0 && e.stun <= 0 &&
               !(e.type === "alligator" && !e.revealed)) {
      hurtPlayer(p, e.x + e.w / 2);
    }
  }
}

function damageEnemy(e, dmg, byPlayer) {
  if (!e.alive || e.deadTimer > 0 || e.iframes > 0) return;
  e.hp -= dmg;
  AudioSys.sfx("stomp");
  if (e.hp <= 0) {
    e.deadTimer = 18; e.vx = 0; e.vy = 0;
    Game.score += e.score;
    World.addFloater(e.x + e.w / 2, e.y - 4, "+" + e.score);
    World.burstAt(e.x + e.w / 2, e.y + e.h / 2, "poof", 4);
  } else {
    e.iframes = T.ENEMY_HIT_IFRAMES;
    World.addFloater(e.x + e.w / 2, e.y - 4, "BONK");
  }
}

/* ---------------- projectiles ---------------- */
function spawnProjectile(kind, x, y, vx, vy, side, dmg) {
  projectiles.push({ kind, x, y, vx, vy, side, dmg, life: 240, animTimer: 0 });
}
function updateProjectiles() {
  for (const pr of projectiles) {
    pr.animTimer++; pr.life--;
    pr.x += pr.vx;
    if (pr.kind === "fireball") {
      pr.vy = Math.min(pr.vy + 0.25, 5); pr.y += pr.vy;
      const tx = Math.floor((pr.x + 8) / TS), ty = Math.floor((pr.y + 14) / TS);
      if (pr.vy > 0 && isSolid(tx, ty)) { pr.y = ty * TS - 16; pr.vy = -T.FIREBALL_BOUNCE; }
      if (isSolid(Math.floor((pr.x + (pr.vx > 0 ? 14 : 2)) / TS), Math.floor((pr.y + 8) / TS))) pr.life = 0;
    } else if (pr.kind === "mushroom") {
      pr.vy = Math.min(pr.vy + 0.18, 5); pr.y += pr.vy;
      if (pr.vy > 0 && isSolid(Math.floor((pr.x + 8) / TS), Math.floor((pr.y + 14) / TS))) {
        pr.life = 0;
        World.burstAt(pr.x + 8, pr.y + 8, "poof", 2);
      }
    } else {                                          // nut: straight-ish
      pr.vy += 0.04; pr.y += pr.vy;
      if (rectHitsSolid(pr.x + 4, pr.y + 4, 8, 8)) pr.life = 0;
    }
    if (pr.life <= 0) continue;
    const box = { x: pr.x + 3, y: pr.y + 3, w: 10, h: 10 };
    if (pr.side === "player") {
      for (const e of enemies) {
        if (!e.alive || e.deadTimer > 0) continue;
        if (overlaps(box, e)) { damageEnemy(e, pr.dmg); pr.life = 0; break; }
      }
      if (pr.life > 0) Bosses.hitByBox(box, pr.dmg) && (pr.life = 0);
    } else {
      for (const p of players) {
        if (p.dead) continue;
        if (overlaps(box, hurtbox(p))) {
          if (pr.kind === "mushroom") {
            Game.happiness = Math.max(0, Game.happiness - T.MUSH_DMG_HAPPY);   // yucky
            World.addFloater(p.x, p.y - 8, "YUCK!");
          }
          hurtPlayer(p, pr.x);
          pr.life = 0; break;
        }
      }
    }
  }
  projectiles = projectiles.filter(pr => pr.life > 0);
}

/* ---------------- stink clouds (Papa's area denial) ---------------- */
function spawnStink(x, y) { stinkClouds.push({ x, y, life: T.STINK_LIFE, animTimer: 0 }); }
function updateStink() {
  for (const s of stinkClouds) {
    s.life--; s.animTimer++;
    s.y += Math.sin(s.animTimer / 20) * 0.15;
    for (const p of players) {
      if (p.dead) continue;
      if (dist2(p.x + p.w/2, p.y + p.h/2, s.x, s.y) < T.STINK_RADIUS * T.STINK_RADIUS) {
        Game.happiness = Math.max(0, Game.happiness - T.STINK_DRAIN);
        p.vx *= 0.92;                                  // it is hard to be brave in the stink
      }
    }
  }
  stinkClouds = stinkClouds.filter(s => s.life > 0);
}

/* ---------------- transient attack volumes ---------------- */
function updateCombat() {
  // laser rays: instant, drawn for a few frames
  for (const sh of Combat.laserShots) {
    if (sh.life === 8) {                               // resolve on first frame
      let x = sh.x, y = sh.y;
      sh.tiles = [];
      for (let i = 0; i < T.LASER_RANGE_TILES * 2; i++) {
        x += sh.dir * 8; y += sh.aim * 8;
        if (rectHitsSolid(x - 2, y - 2, 4, 4)) break;
        sh.tiles.push([x, y]);
        const box = { x: x - 5, y: y - 5, w: 10, h: 10 };
        let hit = false;
        for (const e of enemies) {
          if (e.alive && e.deadTimer <= 0 && overlaps(box, e)) { damageEnemy(e, sh.dmg); hit = true; break; }
        }
        if (!hit && Bosses.hitByBox(box, sh.dmg)) hit = true;
        if (hit) break;
      }
    }
    sh.life--;
  }
  Combat.laserShots = Combat.laserShots.filter(s => s.life > 0);

  // spoon arcs: short melee box; also deflects mushrooms back
  for (const sw of Combat.spoonSwings) {
    const p = sw.owner;
    const box = sw.both
      ? { x: p.x - T.SPOON_RANGE, y: p.y - 6, w: p.w + 2 * T.SPOON_RANGE, h: p.h + 10 }
      : { x: p.facing > 0 ? p.x + p.w : p.x - T.SPOON_RANGE, y: p.y - 6, w: T.SPOON_RANGE, h: p.h + 10 };
    for (const e of enemies)
      if (e.alive && e.deadTimer <= 0 && e.iframes <= 0 && overlaps(box, e)) damageEnemy(e, 1, p);
    Bosses.hitByBox(box, 1);
    for (const pr of projectiles) {
      if (pr.side === "enemy" && overlaps(box, { x: pr.x, y: pr.y, w: 16, h: 16 })) {
        pr.side = "player"; pr.vx = p.facing * 4; pr.vy = -2; pr.dmg = 2;   // RETURN TO SENDER
        World.addFloater(pr.x, pr.y - 6, "DEFLECT!");
        AudioSys.sfx("spoon");
      }
    }
    sw.life--;
  }
  Combat.spoonSwings = Combat.spoonSwings.filter(s => s.life > 0);

  // pink bursts: radial clear
  for (const pb of Combat.pinkBursts) {
    const r = (18 - pb.life) * 8 + T.PINK_RADIUS * 0.3;
    for (const e of enemies) {
      if (e.alive && e.deadTimer <= 0 &&
          dist2(e.x + e.w/2, e.y + e.h/2, pb.x, pb.y) < r * r) damageEnemy(e, 2);
    }
    for (const pr of projectiles)
      if (pr.side === "enemy" && dist2(pr.x, pr.y, pb.x, pb.y) < r * r) pr.life = 0;
    Bosses.hitByBox({ x: pb.x - r, y: pb.y - r, w: r * 2, h: r * 2 }, pb.life === 18 ? 1 : 0);
    pb.life--;
  }
  Combat.pinkBursts = Combat.pinkBursts.filter(s => s.life > 0);

  // ground-pound shockwaves: stun nearby walkers
  for (const ps of Combat.poundShocks) {
    for (const e of enemies) {
      if (e.alive && e.deadTimer <= 0 && e.grounded &&
          dist2(e.x + e.w/2, e.y + e.h/2, ps.x, ps.y) < T.POUND_RADIUS * T.POUND_RADIUS) {
        e.stun = T.POUND_STUN;
        World.addFloater(e.x + e.w / 2, e.y - 6, "*dizzy*");
      }
    }
    ps.life--;
  }
  Combat.poundShocks = Combat.poundShocks.filter(s => s.life > 0);

  // spin-mace: a slow orbiting WMD (gives no defense — you stay exposed)
  for (const p of players) {
    if (p.dead || !p.powers.includes("mace")) continue;
    const angs = [p.maceAngle || 0];
    if ((p.lvl.mace || 0) >= 2) angs.push(p.maceAngle2 || 0);
    for (const ang of angs) {
      const hx = p.x + p.w / 2 + Math.cos(ang) * T.MACE_RADIUS;
      const hy = p.y + p.h / 2 + Math.sin(ang) * T.MACE_RADIUS;
      const box = { x: hx - 8, y: hy - 8, w: 16, h: 16 };
      for (const e of enemies)
        if (e.alive && e.deadTimer <= 0 && e.iframes <= 0 && overlaps(box, e)) damageEnemy(e, T.MACE_DMG, p);
      Bosses.hitByBox(box, T.MACE_DMG);
    }
  }
}

/* ---------------- drawing ---------------- */
function drawEnemies(camX, camY) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = ENEMY_DEFS[e.type], s = sheets[d.sheet];
    const dx = e.x + e.w / 2 - s.frame_w / 2 - camX;
    const dy = e.y + e.h - s.frame_h - camY;
    if (e.iframes > 0 && (e.iframes >> 2) % 2 === 0) continue;
    if (e.deadTimer > 0) {
      ctx.save();
      ctx.translate(Math.round(dx), Math.round(e.y + e.h - camY));
      ctx.scale(1, 0.4);
      ctx.drawImage(s.img, s.index[s.frames[0]] * s.frame_w, 0, s.frame_w, s.frame_h,
                    0, -s.frame_h, s.frame_w, s.frame_h);
      ctx.restore();
      continue;
    }
    drawFrame(d.sheet, enemyFrame(e), dx, dy, e.dir > 0);
    if (e.stun > 0 && (e.animTimer >> 3) % 2)
      drawFrame("fx", "spark1", dx + s.frame_w / 2 - 8, dy - 10);
  }
}
function enemyFrame(e) {
  if (e.type === "frog") return e.state === "air" ? "hop" : "idle";
  if (e.type === "cockroach") return (e.animTimer >> 3) % 2 ? "scuttle2" : "scuttle1";
  if (e.type === "dino") return (e.animTimer >> 4) % 2 ? "walk2" : "walk1";
  if (e.type === "fish") return (e.animTimer >> 3) % 2 ? "swim2" : "swim1";
  if (e.type === "alligator")
    return e.state === "idle" ? "catface" : e.state === "reveal" ? "reveal" : "chomp";
  if (e.type === "wisp") return (e.animTimer >> 3) % 2 ? "bob2" : "bob1";
  if (e.type === "fly") return (e.animTimer >> 2) % 2 ? "buzz2" : "buzz1";
  return "idle";
}
function drawProjectiles(camX, camY) {
  for (const pr of projectiles) {
    const f = pr.kind === "fireball" ? ((pr.animTimer >> 2) % 2 ? "fireball2" : "fireball1")
            : pr.kind === "mushroom" ? "mushroom" : "nut";
    drawFrame("fx", f, pr.x - camX, pr.y - camY, pr.vx < 0);
  }
  for (const s of stinkClouds) {
    if ((s.animTimer >> 3) % 4 !== 3)
      drawFrame("fx", "stink", s.x - 8 - camX, s.y - 8 - camY);
    drawFrame("fx", "stink", s.x - 14 - camX, s.y - 2 - camY);
  }
  for (const sh of Combat.laserShots) {
    if (!sh.tiles) continue;
    for (const [x, y] of sh.tiles) drawFrame("fx", "beam", x - 8 - camX, y - 8 - camY);
    const last = sh.tiles[sh.tiles.length - 1];
    if (last) drawFrame("fx", "beamtip", last[0] - 8 - camX, last[1] - 8 - camY);
  }
  for (const pb of Combat.pinkBursts) {
    const r = (18 - pb.life) * 8;
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4 + pb.life * 0.1;
      drawFrame("fx", pb.life % 2 ? "ring1" : "ring2",
                pb.x + Math.cos(ang) * r - 8 - camX, pb.y + Math.sin(ang) * r - 8 - camY);
    }
  }
  // spin-mace: chain of dots out to a spiked ball
  for (const p of players) {
    if (p.dead || !p.powers.includes("mace")) continue;
    const ccx = p.x + p.w / 2 - camX, ccy = p.y + p.h / 2 - camY;
    const angs = [p.maceAngle || 0];
    if ((p.lvl.mace || 0) >= 2) angs.push(p.maceAngle2 || 0);
    for (const ang of angs) {
      const hx = ccx + Math.cos(ang) * T.MACE_RADIUS;
      const hy = ccy + Math.sin(ang) * T.MACE_RADIUS;
      ctx.fillStyle = "#9a93b0";
      for (let i = 1; i <= 4; i++) ctx.fillRect(Math.round(ccx + (hx - ccx) * i / 5) - 1, Math.round(ccy + (hy - ccy) * i / 5) - 1, 2, 2);
      ctx.fillStyle = "#2a2438";
      for (let a = 0; a < 8; a++) { const A = a * Math.PI / 4; ctx.fillRect(Math.round(hx + Math.cos(A) * 6) - 1, Math.round(hy + Math.sin(A) * 6) - 1, 2, 2); }
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fillStyle = "#4a4458"; ctx.fill();
      ctx.beginPath(); ctx.arc(hx - 1, hy - 1, 2, 0, Math.PI * 2); ctx.fillStyle = "#8a84a0"; ctx.fill();
    }
  }
}
