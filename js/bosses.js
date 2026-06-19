"use strict";
/* =====================================================================
 *  BOSSES — the Grumpis Scrumption family, and the Big Hog Dog.
 *  grumpis: the slice boss.  twins: two at once, enrage on a death.
 *  papa: surfaces in the lake between lilypads, spits stink.
 *  family: papa + two juniors, all at once.
 *  hogdog: L5 — beaten, he GRABS THE BABIES and flees. We hate him.
 *  hogdog_final: L6 — versus the Giant Mecha Swan. Power fantasy.
 * ===================================================================== */
const Bosses = (() => {
  let units = [], kind = null, activated = false, fledTimer = 0;
  let arenaName = "";

  function spawn(spec) {
    units = []; kind = spec ? spec.type : null; activated = false; fledTimer = 0;
    if (!spec) return;
    if (kind === "grumpis") {
      units.push(grumpis(spec.x, spec.y, T.GRUMPIS_HP)); arenaName = "GRUMPIS SCRUMPTION";
    } else if (kind === "twins") {
      units.push(grumpis(spec.x - 70, spec.y, T.TWIN_HP, 40));
      units.push(grumpis(spec.x + 70, spec.y, T.TWIN_HP, 0));
      arenaName = "THE GRUMPIS TWINS";
    } else if (kind === "papa") {
      units.push(papa(spec.x, spec.y)); arenaName = "PAPA GRUMPIS";
    } else if (kind === "family") {
      const pa = papa(spec.x, spec.y); pa.hp = pa.maxHp = T.FAMILY_PAPA_HP; pa.onLand = true;
      units.push(pa);
      units.push(grumpis(spec.x - 110, spec.y + 32, T.TWIN_HP, 30));
      units.push(grumpis(spec.x + 110, spec.y + 32, T.TWIN_HP, 60));
      arenaName = "THE WHOLE GRUMPIS FAMILY";
    } else if (kind === "hogdog" || kind === "hogdog_final") {
      units.push(hog(spec.x, spec.y, kind === "hogdog_final"));
      arenaName = kind === "hogdog" ? "THE BIG HOG DOG" : "THE BIG HOG DOG (WE STILL HATE HIM)";
    } else if (kind === "badcode") {
      units.push(badcode(spec.x, spec.y, spec));
      arenaName = "THE BAD DREAMS";
    } else if (kind === "giant") {
      units.push(giant(spec.x, spec.y, spec));
      arenaName = spec.name || "THE BIG GUY UPSTAIRS";
    } else if (kind === "colossus") {
      units.push(colossus(spec.x, spec.y, spec));
      arenaName = spec.name || "THE BIG GUY IS FURIOUS";
    } else if (kind === "bigguy") {
      units.push(bigguy(spec.x, spec.y, spec));
      arenaName = spec.name || "THE WHOLE BIG GUY";
    }
  }
  // a level's boss spec may oversize it (spec.size), buff it (spec.hp), rewrite its
  // words (spec.dialogue), and arm a half-health sphere sweep (spec.sweep).
  const badcode = (x, y, spec = {}) => {
    const sz = spec.size || 44;
    return {
      sub: "badcode", sheet: "boss_badcode", x, y: y - 240, w: sz, h: sz,
      hp: spec.hp || T.BADCODE_HP, maxHp: spec.hp || T.BADCODE_HP, state: "sleep", timer: 0,
      iframes: 0, hurtFlash: 0, facing: -1, vx: 0, vy: 0, dropY: y, triggerX: x + 60,
      animTimer: 0, rage: 1, dialogue: spec.dialogue || null,
      sweep: !!spec.sweep, phase: 1, sweepDir: 1, sweepTimer: 0 };
  };
  // THE GIANT IN THE CLOUDS — we only ever see his feet. 3 toy-pokes and he leaves
  // in a huff. The (x,y) is the top-left of the hittable feet band on the cloud floor.
  const giant = (x, y, spec = {}) => ({
    sub: "giant", x, y: y - 54, w: spec.size || 156, h: 54,   // spec.y is the floor; lift so the feet rest on it
    hp: spec.hp || T.GIANT_HP, maxHp: spec.hp || T.GIANT_HP,
    state: "sleep", timer: 0, iframes: 0, hurtFlash: 0, facing: -1, vx: 0, vy: 0,
    animTimer: 0, rage: 1, dialogue: spec.dialogue || null,
    liftFoot: 0, lift: 0, retreat: 0 });
  // THE FINALE (world 12): the WHOLE giant at last. His huge face leans down from
  // the top — the only weakpoint, and only while it's "dip"ped low. Meanwhile a foot
  // stomps your column. x,y = the head's AABB; y starts at its high (taunting) rest.
  const bigguy = (x, y, spec = {}) => ({
    sub: "bigguy", x, y, w: spec.size || 88, h: 72,
    hp: spec.hp || T.BIGGUY_HP, maxHp: spec.hp || T.BIGGUY_HP,
    state: "intro", timer: 40, iframes: 0, hurtFlash: 0, facing: -1, animTimer: 0,
    rage: 1, phase: 1, dialogue: spec.dialogue || null,
    highY: y, lowY: y + (spec.dip || T.BIGGUY_DIP_DIST),
    floorPx: spec.floor || (gridH - 2) * TS,
    fState: "idle", fTimer: 80, fX: x, fY: -T.BIGGUY_FOOT_H });
  // THE REMATCH (world 11): a single furious foot that hovers above you and
  // SLAMS down your column, over and over. Invulnerable mid-air — you can only
  // hurt it in the brief beat it's planted. x,y = the foot's current AABB.
  const colossus = (x, y, spec = {}) => ({
    sub: "colossus", x, y, w: spec.footW || 56, h: 40,
    hp: spec.hp || T.COLOSSUS_HP, maxHp: spec.hp || T.COLOSSUS_HP,
    state: "hover", timer: T.COLOSSUS_HOVER_T, iframes: 0, hurtFlash: 0, facing: -1,
    vx: 0, vy: 0, animTimer: 0, rage: 1, dialogue: spec.dialogue || null,
    footX: x, slamX: x });
  const grumpis = (x, y, hp, phase = 0) => ({
    sub: "grumpis", sheet: "boss_grumpis", x, y, w: 52, h: 48, vx: 0, vy: 0,
    hp, maxHp: hp, state: "windup", timer: T.GRUMPIS_WINDUP + phase, iframes: 0,
    hurtFlash: 0, facing: -1, grounded: false, hitWall: false, animTimer: 0, rage: 1 });
  const papa = (x, y) => ({
    sub: "papa", sheet: "boss_papa", x, y, w: 80, h: 64, vx: 0, vy: 0,
    hp: T.PAPA_HP, maxHp: T.PAPA_HP, state: "submerged", timer: 90, iframes: 0,
    hurtFlash: 0, facing: -1, grounded: false, hitWall: false, animTimer: 0,
    homeY: y, onLand: false, rage: 1 });
  const hog = (x, y, final) => ({
    sub: "hog", sheet: "boss_hogdog", x, y, w: 72, h: 70, vx: 0, vy: 0,
    hp: final ? T.HOGF_HP : T.HOG_HP, maxHp: final ? T.HOGF_HP : T.HOG_HP,
    state: "windup", timer: T.HOG_WINDUP, iframes: 0, hurtFlash: 0, facing: -1,
    grounded: false, hitWall: false, animTimer: 0, final, fleeing: false, rage: 1 });

  function update() {
    if (!units.length) { if (fledTimer > 0 && --fledTimer === 0) World.onBossesCleared(true); return; }
    const pl = nearestPlayer(units[0].x, units[0].y);
    if (!activated && pl &&
        (kind === "badcode" ? pl.x > units[0].triggerX
                            : kind === "colossus" ? true
                            : Math.abs(pl.x - units[0].x) < T.BOSS_ACTIVATE_DIST)) {
      activated = true;
      AudioSys.sfx("roar");
      AudioSys.playSong(kind === "hogdog" || kind === "hogdog_final" ? "hogdog" : "boss");
      Game.shake = 6;
    }
    if (!activated) return;
    const mult = enemyMult();
    for (const b of units) {
      b.animTimer++;
      if (b.iframes > 0) b.iframes--;
      if (b.hurtFlash > 0) b.hurtFlash--;
      if (b.sub === "grumpis") updateGrumpis(b, mult);
      else if (b.sub === "papa") updatePapa(b, mult);
      else if (b.sub === "hog") updateHog(b, mult);
      else if (b.sub === "badcode") updateBadcode(b, mult);
      else if (b.sub === "giant") updateGiant(b, mult);
      else if (b.sub === "colossus") updateColossus(b, mult);
      else if (b.sub === "bigguy") updateBigguy(b, mult);
      if (b.state !== "dying" && !b.fleeing) bossContact(b);
    }
    units = units.filter(b => b.state !== "gone");
    if (!units.length && fledTimer === 0) World.onBossesCleared(false);
  }

  function updateGrumpis(b, mult) {
    const pl = nearestPlayer(b.x, b.y); const m = mult * b.rage;
    if (b.state === "dying") { if (--b.timer <= 0) dieOff(b); return; }
    if (b.state === "windup") {
      if (pl) b.facing = pl.x > b.x ? 1 : -1;
      if (--b.timer <= 0) {
        b.state = "lunge";
        b.vx = b.facing * T.GRUMPIS_LUNGE_VX * m; b.vy = -T.GRUMPIS_LUNGE_VY;
      }
    } else if (b.state === "lunge") {
      if (b.grounded && b.vy >= 0) {
        b.state = "recover"; b.timer = Math.round(T.GRUMPIS_RECOVER / m); b.vx = 0;
        Game.shake = T.SHAKE_FRAMES;
      }
    } else if (b.state === "recover") {
      if (--b.timer <= 0) { b.state = "windup"; b.timer = T.GRUMPIS_WINDUP; }
    }
    b.vy = Math.min(b.vy + T.ENEMY_GRAVITY, T.ENEMY_MAX_FALL);
    moveAndCollide(b);
  }

  function updatePapa(b, mult) {
    const pl = nearestPlayer(b.x, b.y);
    if (b.state === "dying") { if (--b.timer <= 0) dieOff(b); return; }
    if (b.onLand) {                                   // family-reunion papa: stays put, lobs stink
      if (b.state === "submerged") { b.state = "windup"; b.timer = 80; }
      if (b.state === "windup") {
        if (pl) b.facing = pl.x > b.x ? 1 : -1;
        if (--b.timer <= 0) { b.state = "spit"; b.timer = 30; }
      } else if (b.state === "spit") {
        if (b.timer === 15) for (let i = -1; i <= 1; i++)
          spawnStink(b.x + b.w / 2 + i * 60 + (pl ? Math.sign(pl.x - b.x) * 30 : 0), b.y + 20);
        if (--b.timer <= 0) { b.state = "windup"; b.timer = Math.round(110 / mult); }
      }
      b.vy = Math.min(b.vy + T.ENEMY_GRAVITY, T.ENEMY_MAX_FALL);
      moveAndCollide(b);
      return;
    }
    // lake papa: submerge -> rise at a new spot -> spit or swat -> sink
    if (b.state === "submerged") {
      b.y = Math.min(b.y + 2, b.homeY + 70);          // hide under the surface
      if (--b.timer <= 0) {
        const px = pl ? pl.x : b.x;
        b.x = clamp(px - b.w / 2 + (Math.random() * 160 - 80), level.goalX - 420, level.goalX - 60);
        b.state = "rising"; b.timer = 40;
        World.burstAt(b.x + b.w / 2, b.homeY + 10, "splash", 6); AudioSys.sfx("splash");
      }
    } else if (b.state === "rising") {
      b.y = Math.max(b.y - 3, b.homeY);
      if (b.y <= b.homeY && --b.timer <= 0) {
        b.state = Math.random() < 0.5 ? "spit" : "swat"; b.timer = b.state === "spit" ? 36 : 50;
        if (pl) b.facing = pl.x > b.x ? 1 : -1;
      }
    } else if (b.state === "spit") {
      if (b.timer === 18) {
        for (let i = 0; i < 3; i++)
          spawnStink(b.x + b.w / 2 + (i - 1) * 64, b.homeY - 14);
        AudioSys.sfx("roar");
      }
      if (--b.timer <= 0) { b.state = "vulnerable"; b.timer = 110; }
    } else if (b.state === "swat") {
      if (b.timer === 25) { b.vx = b.facing * T.PAPA_SWAT_VX * mult; }
      b.x += b.vx; b.vx *= 0.94;
      if (--b.timer <= 0) { b.state = "vulnerable"; b.timer = 110; b.vx = 0; }
    } else if (b.state === "vulnerable") {
      if (--b.timer <= 0) {
        b.state = "submerged"; b.timer = Math.round(T.PAPA_DIVE / mult);
        World.burstAt(b.x + b.w / 2, b.homeY + 10, "splash", 6);
      }
    }
  }

  function updateHog(b, mult) {
    const pl = nearestPlayer(b.x, b.y);
    if (b.state === "dying") { if (--b.timer <= 0) dieOff(b); return; }
    if (b.fleeing) {                                  // he has the babies. after him!
      b.vx = b.facing * 4;
      b.x += b.vx;
      if (b.animTimer % 8 === 0) World.burstAt(b.x + b.w / 2, b.y + b.h, "poof", 1);
      if (--b.timer <= 0) { b.state = "gone"; fledTimer = 30; }
      return;
    }
    const m = mult * b.rage;
    if (b.state === "windup") {
      if (pl) b.facing = pl.x > b.x ? 1 : -1;
      if (--b.timer <= 0) { b.state = "volley"; b.timer = 46; b.thrown = 0; }
    } else if (b.state === "volley") {
      const n = b.final ? T.HOGF_VOLLEY : T.HOG_VOLLEY;
      if (b.timer % 12 === 0 && b.thrown < n) {
        b.thrown++;
        const tx = pl ? pl.x : b.x - 100;
        const dx = tx - b.x, vx = clamp(dx / 60, -T.MUSH_VX * 1.6, T.MUSH_VX * 1.6) + (Math.random() - 0.5);
        spawnProjectile("mushroom", b.x + b.w / 2, b.y + 6, vx, -T.MUSH_VY, "enemy", 1);
        AudioSys.sfx("nut");
      }
      if (--b.timer <= 0) { b.state = "lunge"; b.vx = b.facing * T.HOG_LUNGE_VX * m; b.vy = -3.4; }
    } else if (b.state === "lunge") {
      if (b.grounded && b.vy >= 0) {
        b.state = "recover"; b.timer = Math.round(T.HOG_RECOVER / m); b.vx = 0;
        Game.shake = T.SHAKE_FRAMES + 2;
        if (b.final) for (const p of players)                     // shockwave on the finale
          if (!p.dead && p.grounded) { p.vy = -2; p.grounded = false; }
      }
    } else if (b.state === "recover") {
      if (--b.timer <= 0) { b.state = "windup"; b.timer = Math.round(T.HOG_WINDUP / m); }
    }
    b.vy = Math.min(b.vy + T.ENEMY_GRAVITY, T.ENEMY_MAX_FALL);
    moveAndCollide(b);
  }

  function updateBadcode(b, mult) {
    const pl = nearestPlayer(b.x, b.y);
    if (b.state === "sleep") b.state = "drop";              // first activated frame
    if (b.state === "dying") { if (--b.timer <= 0) dieOff(b); return; }
    if (b.state === "drop") {
      b.y += 7; Game.shake = 6;                             // VIBRATE THE WHOLE CONSOLE
      if (b.y >= b.dropY) {
        b.y = b.dropY; b.state = "speak"; b.timer = 6; Game.shake = 14;
        AudioSys.sfx("roar");
        Game.queueCard(b.dialogue ||
          ['"I AM THE BAD DREAMS."', "", '"GIVE ME YOUR... BABIES."']);
      }
      return;
    }
    if (b.state === "speak") { b.vx = b.vy = 0; if (--b.timer <= 0) b.state = "chase"; return; }
    // at half health a sweep-armed dream collapses into a sphere and changes the rules
    if (b.sweep && b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2; b.state = "morph"; b.timer = 28; b.vx = b.vy = 0;
      Game.shake = 14; AudioSys.sfx("roar");
    }
    if (b.state === "morph") {
      b.vx = b.vy = 0;                                      // a held, shuddering beat
      if (--b.timer <= 0) { b.state = "sweep"; b.sweepTimer = 0; b.sweepDir = pl && pl.x < b.x ? -1 : 1; }
      return;
    }
    if (b.state === "sweep") {                              // a sphere carving wide passes across you
      b.sweepTimer++;
      const sp = T.BADCODE_SPEED * mult * 1.7;
      b.vx = b.sweepDir * sp;
      b.vy = Math.sin(b.sweepTimer / 9) * sp * 0.7;
      if (pl) {                                             // ride the wave toward the player's height
        b.vy += clamp((pl.y + pl.h / 2) - (b.y + b.h / 2), -1, 1) * 0.6;
        const past = b.sweepDir > 0 ? b.x > pl.x + 240 : b.x + b.w < pl.x - 240;
        if (past) b.sweepDir *= -1;                         // overshoot, then sweep back
      }
      b.facing = b.sweepDir;
      b.x += b.vx; b.y += b.vy;
      return;
    }
    if (pl) {                                               // chase: relentless, a touch slower than the swan
      const dx = (pl.x + pl.w / 2) - (b.x + b.w / 2), dy = (pl.y + pl.h / 2) - (b.y + b.h / 2);
      const dd = Math.hypot(dx, dy) || 1, sp = T.BADCODE_SPEED * mult;
      b.vx = dx / dd * sp; b.vy = dy / dd * sp; b.facing = dx < 0 ? -1 : 1;
    }
    b.x += b.vx; b.y += b.vy;                               // floats — no gravity, no tiles
  }

  function updateBigFoot(b, r) {                          // a deadly stomp at the player's column
    if (b.fState === "idle") {
      const pl = nearestPlayer(b.x + b.w / 2, b.floorPx);
      if (--b.fTimer <= 0 && pl) { b.fState = "wind"; b.fTimer = T.BIGGUY_FOOT_WIND; b.fX = pl.x + pl.w / 2; }
    } else if (b.fState === "wind") {
      if (--b.fTimer <= 0) { b.fState = "slam"; b.fY = -T.BIGGUY_FOOT_H; }
    } else if (b.fState === "slam") {
      b.fY += T.BIGGUY_FOOT_V * r;
      const fb = { x: b.fX - T.BIGGUY_FOOT_W / 2, y: b.fY, w: T.BIGGUY_FOOT_W, h: T.BIGGUY_FOOT_H };
      for (const p of players) if (!p.dead && overlaps(fb, hurtbox(p))) hurtPlayer(p, b.fX);
      if (b.fY + T.BIGGUY_FOOT_H >= b.floorPx) {
        b.fState = "recover"; b.fTimer = 16; Game.shake = 10; AudioSys.sfx("pound");
        World.burstAt(b.fX, b.floorPx, "poof", 7);
      }
    } else if (b.fState === "recover") {
      if (--b.fTimer <= 0) { b.fState = "idle"; b.fTimer = Math.round(T.BIGGUY_FOOT_GAP / r); }
    }
  }
  function updateBigguy(b, mult) {
    if (b.state === "intro") {
      Game.queueCard(b.dialogue ||
        ["AT LAST — the WHOLE big guy.", "", "you can finally see his face.", "(sunglasses. obviously.)"]);
      b.state = "taunt"; b.timer = T.BIGGUY_TAUNT; return;
    }
    if (b.state === "dying") { b.y -= 3; b.hurtFlash = 0; if (--b.timer <= 0) dieOff(b); return; }
    if (b.phase === 1 && b.hp <= b.maxHp / 2) { b.phase = 2; Game.shake = 14; AudioSys.sfx("roar"); }
    b.rage = b.phase === 2 ? 1.5 : 1;
    const r = b.rage * mult;
    // the head: taunt high (armored) -> dip low (the weakpoint) -> rise
    if (b.state === "taunt") {
      b.y += clamp(b.highY - b.y, -8, 8);
      if (--b.timer <= 0) { b.state = "dip"; b.timer = Math.round(T.BIGGUY_DIP / b.rage); }
    } else if (b.state === "dip") {
      b.y += clamp(b.lowY - b.y, -6 * r, 6 * r);
      if (--b.timer <= 0) b.state = "rise";
    } else if (b.state === "rise") {
      b.y += clamp(b.highY - b.y, -8, 8);
      if (Math.abs(b.y - b.highY) < 2) { b.state = "taunt"; b.timer = Math.round(T.BIGGUY_TAUNT / b.rage); }
    }
    updateBigFoot(b, r);
  }

  function updateColossus(b, mult) {
    if (b.state === "dying") { b.y -= 6; if (--b.timer <= 0) dieOff(b); return; }
    const pl = nearestPlayer(b.x + b.w / 2, b.y);
    if (!pl) return;
    b.rage = 1 + (1 - b.hp / b.maxHp) * 0.9;            // it gets MERCILESS as it takes damage
    const r = b.rage * mult;
    const cx = pl.x + pl.w / 2;
    if (b.state !== "slam" && b.state !== "planted")    // track the player except mid-commit
      b.footX += clamp(cx - b.footX, -T.COLOSSUS_TRACK * r, T.COLOSSUS_TRACK * r);
    const hoverY = pl.y - T.COLOSSUS_HOVER;
    if (b.state === "hover") {
      b.x = b.footX - b.w / 2; b.y = hoverY;
      if (--b.timer <= 0) { b.state = "slam"; b.slamX = b.footX; b.targetY = pl.y + pl.h - b.h + 8; }
    } else if (b.state === "slam") {
      b.x = b.slamX - b.w / 2;
      b.y += T.COLOSSUS_SLAM_V * r;
      if (b.y >= b.targetY) {                            // IMPACT
        b.y = b.targetY; b.state = "planted"; b.timer = Math.round(T.COLOSSUS_PLANT / b.rage);
        Game.shake = 14; AudioSys.sfx("pound");
        World.burstAt(b.x + b.w / 2, b.y + b.h, "poof", 8);
        Combat.poundShocks.push({ x: b.x + b.w / 2, y: b.y + b.h, life: 6 });
      }
    } else if (b.state === "planted") {                  // the one window you can hit it
      b.x = b.slamX - b.w / 2;
      if (--b.timer <= 0) b.state = "lift";
    } else if (b.state === "lift") {
      b.x = b.footX - b.w / 2;
      b.y -= T.COLOSSUS_LIFT_V;
      if (b.y <= hoverY) { b.y = hoverY; b.state = "hover"; b.timer = Math.round(T.COLOSSUS_HOVER_T / b.rage); }
    }
  }

  function updateGiant(b, mult) {
    const pl = nearestPlayer(b.x + b.w / 2, b.y);
    if (b.state === "sleep") {                          // first activated frame: the sun goes out
      b.state = "reveal"; b.timer = 70; Game.shake = 8;
      Game.queueCard(b.dialogue ||
        ["something BLOTS OUT THE SUN.", "", "it is... a foot?", "a REALLY, REALLY BIG foot."]);
      return;
    }
    if (b.state === "reveal") { if (--b.timer <= 0) { b.state = "idle"; b.timer = T.GIANT_STOMP_GAP; } return; }
    if (b.state === "dying") { b.retreat += 4; if (--b.timer <= 0) dieOff(b); return; }   // he LEAVES (rises away)
    if (b.state === "idle") {
      if (--b.timer <= 0) {                             // raise a foot over wherever you're standing
        b.state = "windup"; b.timer = T.GIANT_WINDUP;
        b.liftFoot = pl && pl.x > b.x + b.w / 2 ? 1 : 0;
      }
    } else if (b.state === "windup") {
      b.lift = Math.min(b.lift + 2.2, 62);             // slow, hugely telegraphed
      if (--b.timer <= 0) b.state = "stomp";
    } else if (b.state === "stomp") {
      if (b.lift > 0) {
        b.lift = Math.max(b.lift - 15, 0);             // SLAM
        if (b.lift === 0) {                            // impact (resolves once)
          Game.shake = 12; AudioSys.sfx("pound");
          const fx = b.x + (b.liftFoot ? b.w * 0.72 : b.w * 0.28);
          World.burstAt(fx, b.y + b.h, "poof", 6);
          for (const p of players)                     // only catches you if you stood right under it
            if (!p.dead && p.grounded && Math.abs((p.x + p.w / 2) - fx) < 30) hurtPlayer(p, fx);
          b.timer = 16;
        }
      } else if (--b.timer <= 0) { b.state = "recover"; b.timer = T.GIANT_RECOVER; }
    } else if (b.state === "recover") {
      if (--b.timer <= 0) { b.state = "idle"; b.timer = T.GIANT_STOMP_GAP; }
    }
  }

  function bossContact(b) {
    if (b.sub === "papa" && !b.onLand && (b.state === "submerged" || b.state === "rising")) return;
    if (b.sub === "colossus") {                          // the foot: deadly mid-air, safe (and hittable) when planted
      const fb = { x: b.x, y: b.y, w: b.w, h: b.h };
      for (const p of players) {
        if (p.dead) continue;
        const k = classifyContact(p, fb);
        if (!k) continue;
        if (b.state === "planted") {
          if ((k === "stomp" || k === "moon") && b.iframes <= 0) {
            damageBoss(b, p.pounding || p.form === "trex" || p.form === "mecha" ? 3 : 1);
            if (k === "stomp") bouncePlayer(p);
            Game.hitstop = T.HITSTOP_BOSS;
          }
        } else {
          hurtPlayer(p, b.x + b.w / 2);                  // a slamming foot does not negotiate
        }
      }
      return;
    }
    if (b.sub === "bigguy") {                             // the FACE is the only weakpoint, only when dipped
      if (b.state !== "dip") return;                      // (high up, it's out of reach anyway)
      const fb = { x: b.x, y: b.y, w: b.w, h: b.h };
      for (const p of players) {
        if (p.dead) continue;
        const k = classifyContact(p, fb);
        if ((k === "stomp" || k === "moon") && b.iframes <= 0) {
          damageBoss(b, p.pounding || p.form === "trex" || p.form === "mecha" ? 3 : 1);
          if (k === "stomp") bouncePlayer(p);
          Game.hitstop = T.HITSTOP_BOSS;
        }   // bonking his face does not hurt YOU — only the foot does
      }
      return;
    }
    const box = { x: b.x, y: b.y, w: b.w, h: b.h };
    for (const p of players) {
      if (p.dead) continue;
      const kind2 = classifyContact(p, box);
      if (!kind2) continue;
      if ((kind2 === "stomp" || kind2 === "moon") && b.iframes <= 0) {
        damageBoss(b, p.pounding || p.form === "trex" || p.form === "mecha" ? 3 : 1);
        if (kind2 === "stomp") bouncePlayer(p);
        Game.hitstop = T.HITSTOP_BOSS;
      } else if (kind2 === "hurt" && b.sub !== "giant") {   // the giant's feet are just standing there
        hurtPlayer(p, b.x + b.w / 2);
      }
    }
  }

  function damageBoss(b, dmg) {
    if (b.iframes > 0 || b.state === "dying" || b.fleeing) return false;
    if (b.sub === "colossus" && b.state !== "planted") return false;   // the foot is armored in mid-air
    if (b.sub === "bigguy" && b.state !== "dip") return false;          // the face is armored unless dipped low
    b.hp -= dmg;
    b.iframes = (b.sub === "badcode" || b.sub === "giant") ? 18 : T.BOSS_IFRAMES; b.hurtFlash = T.BOSS_HURT_FLASH;
    AudioSys.sfx("bossHurt");
    World.addFloater(b.x + b.w / 2, b.y - 8, b.sub === "giant" ? "STUB!" : "SCRUMPTIONED!");
    if (b.hp <= 0) {
      if (b.sub === "giant") {                         // 3 toy-pokes and the colossus storms off
        b.state = "dying"; b.timer = T.BOSS_DEATH_FRAMES + 50; b.vx = 0; b.hurtFlash = 0; b.lift = 0;
        Game.queueCard(['"YOU... YOU STUBBED MY BEST TOE!"', '"WITH YOUR... TOYS?!"', "",
                        '"I HAVE NEVER BEEN SO INSULTED IN A DREAM."',
                        '"i am LEAVING. and i am TELLING."']);
        AudioSys.sfx("roar");
      } else if (b.sub === "colossus") {               // the furious foot, finally beaten
        b.state = "dying"; b.timer = T.BOSS_DEATH_FRAMES + 50; b.vx = 0; b.hurtFlash = 0;
        Game.queueCard(['"AAGH! MY OTHER BEST TOE!"', "",
                        '"fine. FINE. you win this dream, swan."',
                        '"...i am keeping the sandals, though."']);
        AudioSys.sfx("roar");
      } else if (b.sub === "bigguy") {                  // THE FINALE: the whole big guy topples
        b.state = "dying"; b.timer = T.BOSS_DEATH_FRAMES + 60; b.vx = 0; b.hurtFlash = 0; b.fState = "idle";
        Game.queueCard(['the BIG GUY topples back into the clouds.', "",
                        '"...okay. OKAY. you really are", " the best dreamer there ever was."',
                        "", '"...nice toys, kid."']);
        AudioSys.sfx("roar");
      } else if (b.sub === "hog" && !b.final) {        // L5: he flees WITH THE BABIES
        b.fleeing = true; b.timer = 90; b.facing = 1; b.hurtFlash = 0;
        Game.queueCard(["\"HRMPH! NYEH HEH HEH!\"",
                        "THE BIG HOG DOG GRABBED THE BABY SWANS",
                        "AND RAN INTO THE DEEPEST DREAM.",
                        "", "WE HATE HIM. AFTER HIM!!"]);
        AudioSys.sfx("roar");
      } else {
        b.state = "dying"; b.timer = T.BOSS_DEATH_FRAMES; b.vx = 0;
        AudioSys.sfx("bossDie");
        // a twin dying enrages the survivor
        for (const o of units) if (o !== b && o.state !== "dying") o.rage = T.TWIN_ENRAGE;
      }
    }
    return true;
  }
  function dieOff(b) {
    b.state = "gone";
    Game.score += T.POINTS_BOSS;
    World.addFloater(b.x + b.w / 2, b.y, "+" + T.POINTS_BOSS);
    World.burstAt(b.x + b.w / 2, b.y + b.h / 2, "spark", 10);
  }

  function hitByBox(box, dmg) {
    if (dmg <= 0) return false;
    for (const b of units) {
      if (b.state === "dying" || b.fleeing) continue;
      if (b.sub === "papa" && !b.onLand && (b.state === "submerged" || b.state === "rising")) continue;
      if (overlaps(box, { x: b.x, y: b.y, w: b.w, h: b.h })) return damageBoss(b, dmg);
    }
    return false;
  }

  function drawBadSphere(x, y, w, h, t, hurt) {            // phase 2: a tight orb of tangled dream-code
    const cx = x + w / 2, cy = y + h / 2, r = w / 2;
    ctx.fillStyle = hurt ? "#8a2a4a" : "#1c1430";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hurt ? "#aa3a5a" : "#2a1f44";
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.fill();
    const span = Math.max(1, (r * 0.55) | 0);
    for (let i = 0; i < 26; i++) {                          // code orbiting the core
      const a = (i / 26) * Math.PI * 2 + t * 0.06, rr = r * 0.4 + ((i * 53 + t * 4) % span);
      const gx = Math.round(cx + Math.cos(a) * rr), gy = Math.round(cy + Math.sin(a) * rr);
      ctx.fillStyle = (i % 3 === 0) ? "#54ffd0" : (i % 3 === 1) ? "#ff5a8c" : "#9a7aff";
      if (((t + i) >> 1) % 2) ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.fillStyle = "#ff3a4a"; ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 3, 6, 6);   // one furious eye
    ctx.fillStyle = "#ffd0d0"; ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 2, 2);
    ctx.strokeStyle = "#0a0814"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  function drawBadcode(b, camX, camY) {
    const x = Math.round(b.x - camX), y = Math.round(b.y - camY), w = b.w, h = b.h, t = b.animTimer;
    const hurt = b.hurtFlash > 0;
    if (b.phase === 2) { drawBadSphere(x, y, w, h, t, hurt); return; }
    ctx.fillStyle = hurt ? "#8a2a4a" : "#1c1430"; ctx.fillRect(x + 2, y + 4, w - 4, h - 6);
    ctx.fillStyle = hurt ? "#aa3a5a" : "#2a1f44"; ctx.fillRect(x, y + 8, w, h - 14); ctx.fillRect(x + 6, y, w - 12, h);
    for (let i = 0; i < 28; i++) {                          // flickering tangled "code"
      const gx = x + ((i * 37 + t * 3) % w), gy = y + ((i * 53 + t * 5) % h);
      ctx.fillStyle = (i % 3 === 0) ? "#54ffd0" : (i % 3 === 1) ? "#ff5a8c" : "#9a7aff";
      if (((t + i) >> 1) % 2) ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.fillStyle = "#ff3a4a"; ctx.fillRect(x + 12, y + 16, 4, 4); ctx.fillRect(x + w - 16, y + 16, 4, 4);  // eyes
    ctx.fillStyle = "#ffd0d0"; ctx.fillRect(x + 13, y + 17, 1, 1); ctx.fillRect(x + w - 15, y + 17, 1, 1);
    ctx.strokeStyle = "#0a0814"; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  function drawGiant(b, camX, camY) {
    const rise = b.retreat || 0;
    const x0 = Math.round(b.x - camX);
    const floorY = Math.round(b.y + b.h - camY - rise);
    const hurt = b.hurtFlash > 0;
    const skin = hurt ? "#ffb0a0" : "#f3c39a", skinDk = hurt ? "#e0907c" : "#d29b6e";
    const footW = b.w * 0.36;
    const feet = [
      { cx: x0 + b.w * 0.28, up: b.liftFoot === 0 ? b.lift : 0 },
      { cx: x0 + b.w * 0.72, up: b.liftFoot === 1 ? b.lift : 0 },
    ];
    // the looming shadow of a raised foot (the "terrifying" telegraph)
    if (b.lift > 0 && b.state !== "dying") {
      const f = feet[b.liftFoot];
      ctx.fillStyle = "rgba(10,8,16,0.32)";
      ctx.beginPath(); ctx.ellipse(f.cx, floorY + 2, footW * 0.62, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // colossal legs, rising off the top of the screen
    for (const f of feet) {
      const legX = Math.round(f.cx - footW * 0.34), legW = Math.round(footW * 0.68);
      const topOfFoot = floorY - 18 - f.up;
      ctx.fillStyle = skin; ctx.fillRect(legX, -120, legW, topOfFoot + 120);
      ctx.fillStyle = skinDk; ctx.fillRect(legX, topOfFoot - 6, legW, 6);   // ankle shade
    }
    // feet: cork Birkenstocks, leather straps, and very large toes
    for (const f of feet) {
      const fx = Math.round(f.cx - footW / 2), fw = Math.round(footW), fy = floorY - 14 - f.up;
      ctx.fillStyle = "#caa46a"; ctx.fillRect(fx - 2, floorY - 6 - f.up, fw + 4, 7);   // cork sole
      ctx.fillStyle = "#9c7b46"; ctx.fillRect(fx - 2, floorY + 1 - f.up, fw + 4, 2);   // rubber base
      ctx.fillStyle = skin; ctx.fillRect(fx, fy, fw, 12);                              // top of foot
      ctx.fillStyle = "#5a3b22";                                                       // two leather straps
      ctx.fillRect(fx + 4, fy + 1, fw - 8, 3); ctx.fillRect(fx + 7, fy + 5, fw - 14, 3);
      ctx.fillStyle = skin;                                                            // 5 toes at the front (left)
      for (let t = 0; t < 5; t++) {
        const r = (5 - t) * 0.9;
        ctx.beginPath(); ctx.arc(fx, fy + 2 + t * 2.1, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#f7d9c0"; ctx.beginPath(); ctx.arc(fx - 2, fy + 2, 1.4, 0, Math.PI * 2); ctx.fill();  // the BEST toe's nail
    }
  }
  function drawColossus(b, camX, camY) {
    const x = Math.round(b.x - camX), y = Math.round(b.y - camY), w = b.w, h = b.h;
    const hurt = b.hurtFlash > 0;
    const skin = hurt ? "#ffb0a0" : "#f3c39a", skinDk = hurt ? "#e0907c" : "#d29b6e";
    if (b.state === "hover") {                            // a pulsing danger lane telegraphs the slam
      ctx.fillStyle = ((b.animTimer >> 2) % 2) ? "rgba(255,70,70,0.18)" : "rgba(255,70,70,0.08)";
      ctx.fillRect(x + 3, y + h, w - 6, 360);
    }
    const legX = Math.round(x + w * 0.16), legW = Math.round(w * 0.68);
    ctx.fillStyle = skin; ctx.fillRect(legX, -160, legW, y + 8 + 160);   // leg up off the top
    ctx.fillStyle = skinDk; ctx.fillRect(legX, y - 2, legW, 4);
    ctx.fillStyle = skin; ctx.fillRect(x, y, w, h - 6);                  // foot
    ctx.fillStyle = "#5a3b22";                                          // straps
    ctx.fillRect(x + 4, y + 3, w - 8, 3); ctx.fillRect(x + 7, y + 8, w - 14, 3);
    ctx.fillStyle = "#caa46a"; ctx.fillRect(x - 2, y + h - 7, w + 4, 7);   // cork sole (bottom — it stomps)
    ctx.fillStyle = "#9c7b46"; ctx.fillRect(x - 2, y + h - 2, w + 4, 2);
    ctx.fillStyle = skin;                                               // toes along the bottom front
    for (let t = 0; t < 5; t++) { const r = (5 - t) * 0.8; ctx.beginPath(); ctx.arc(x + 3 + t * 2.4, y + h - 6, r, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawBigLeg(x, yTop, w, yBot, skin) {           // a leg + sandal coming straight down
    ctx.fillStyle = skin; ctx.fillRect(x, yTop, w, yBot - yTop - 8);
    ctx.fillStyle = "#caa46a"; ctx.fillRect(x - 3, yBot - 9, w + 6, 7);     // cork sole
    ctx.fillStyle = "#9c7b46"; ctx.fillRect(x - 3, yBot - 3, w + 6, 2);
    ctx.fillStyle = "#5a3b22"; ctx.fillRect(x + 3, yBot - 18, w - 6, 3);    // a strap
    ctx.fillStyle = skin;                                                   // toes peeking at the bottom front
    for (let t = 0; t < 4; t++) { const r = (4 - t) * 0.9; ctx.beginPath(); ctx.arc(x + 2 + t * 2.4, yBot - 7, r, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawBigFace(b, camX, camY) {
    const x = Math.round(b.x - camX), y = Math.round(b.y - camY), w = b.w, h = b.h;
    const hurt = b.hurtFlash > 0, dipped = b.state === "dip";
    const skin = hurt ? "#ffb0a0" : "#f3c39a", dk = hurt ? "#e0907c" : "#c98f5e";
    ctx.fillStyle = dk; ctx.fillRect(x - 4, y + 28, 6, 18); ctx.fillRect(x + w - 2, y + 28, 6, 18);  // ears
    ctx.fillStyle = skin; ctx.fillRect(x + 6, y, w - 12, h); ctx.fillRect(x, y + 10, w, h - 22);     // head
    ctx.fillStyle = "#5a4632"; ctx.fillRect(x + 6, y - 6, w - 12, 10);                                // hair tuft
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + i * 12, y - 9, 4, 4);
    ctx.fillStyle = "#15121c";                                                                         // BIG sunglasses
    ctx.fillRect(x + 10, y + 24, w - 20, 15);
    ctx.fillStyle = dk; ctx.fillRect(x + (w >> 1) - 3, y + 28, 6, 5);                                  // bridge
    ctx.fillStyle = "#3a3550"; ctx.fillRect(x + 14, y + 27, 8, 3); ctx.fillRect(x + w - 30, y + 27, 8, 3);  // glints
    if (dipped) {                                                                                      // a furious open snarl + teeth
      ctx.fillStyle = "#3a1820"; ctx.fillRect(x + 22, y + h - 24, w - 44, 15);
      ctx.fillStyle = "#fff6e8"; for (let i = 0; i < 5; i++) ctx.fillRect(x + 25 + i * ((w - 50) / 5), y + h - 24, 4, 4);
    } else {
      ctx.fillStyle = "#7a3a2a"; ctx.fillRect(x + 24, y + h - 16, w - 48, 4);                          // a flat angry line
    }
    for (let i = 0; i < 14; i++) { ctx.fillStyle = "#b98a5e";                                          // stubble
      ctx.fillRect(x + 16 + (i * 13) % (w - 28), y + h - 12 + ((i * 7) % 8), 1, 1); }
  }
  function draw(camX, camY) {
    for (const b of units) {
      if (b.state === "gone") continue;
      if (b.sub === "giant") { drawGiant(b, camX, camY); continue; }
      if (b.sub === "colossus") { drawColossus(b, camX, camY); continue; }
      if (b.sub === "bigguy") {
        const skin = b.hurtFlash > 0 ? "#ffb0a0" : "#f3c39a";
        if (b.fState === "wind") {                        // telegraph the stomp column
          const fx = Math.round(b.fX - camX);
          ctx.fillStyle = ((b.animTimer >> 2) % 2) ? "rgba(255,70,70,0.18)" : "rgba(255,70,70,0.08)";
          ctx.fillRect(fx - T.BIGGUY_FOOT_W / 2, 0, T.BIGGUY_FOOT_W, T.VIEW_H);
        } else if (b.fState === "slam" || b.fState === "recover") {
          drawBigLeg(Math.round(b.fX - T.BIGGUY_FOOT_W / 2 - camX), -160,
                     T.BIGGUY_FOOT_W, Math.round(b.fY + T.BIGGUY_FOOT_H - camY), skin);
        }
        drawBigFace(b, camX, camY);
        continue;
      }
      if (b.iframes > 0 && b.hurtFlash <= 0 && (b.iframes >> 2) % 2 === 0) continue;
      if (b.state === "dying" && (b.animTimer >> 2) % 2 === 0) continue;
      if (b.sub === "badcode") { drawBadcode(b, camX, camY); continue; }
      const s = sheets[b.sheet];
      let frame = "idle";
      if (b.hurtFlash > 0 || b.state === "dying") frame = "hurt";
      else if (b.state === "lunge" || b.state === "spit" || b.state === "swat" ||
               b.state === "volley") frame = "attack";
      let dx = b.x + b.w / 2 - s.frame_w / 2 - camX;
      let dy = b.y + b.h - s.frame_h - camY;
      if (b.state === "windup" || b.state === "rising") dx += ((b.animTimer >> 2) % 2) * 2 - 1;
      drawFrame(b.sheet, frame, dx, dy, b.facing > 0);
    }
  }

  function barInfo() {
    if (!units.length || !activated) return null;
    let cur = 0, max = 0;
    for (const b of units) { cur += Math.max(0, b.hp); max += b.maxHp; }
    return { cur, max, name: arenaName };
  }
  const any = () => units.length > 0;

  return { spawn, update, draw, hitByBox, barInfo, any,
           get activated() { return activated; },
           get units() { return units; } };   // exposed for the headless harness
})();
