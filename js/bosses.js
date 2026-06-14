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
      units.push(badcode(spec.x, spec.y));
      arenaName = "THE BAD DREAMS";
    }
  }
  const badcode = (x, y) => ({
    sub: "badcode", sheet: "boss_badcode", x, y: y - 240, w: 44, h: 44,
    hp: T.BADCODE_HP, maxHp: T.BADCODE_HP, state: "sleep", timer: 0, iframes: 0,
    hurtFlash: 0, facing: -1, vx: 0, vy: 0, dropY: y, triggerX: x + 60, animTimer: 0, rage: 1 });
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
        Game.queueCard(['"I AM THE BAD DREAMS."', "", '"GIVE ME YOUR... BABIES."']);
      }
      return;
    }
    if (b.state === "speak") { b.vx = b.vy = 0; if (--b.timer <= 0) b.state = "chase"; return; }
    if (pl) {                                               // chase: relentless, a touch slower than the swan
      const dx = (pl.x + pl.w / 2) - (b.x + b.w / 2), dy = (pl.y + pl.h / 2) - (b.y + b.h / 2);
      const dd = Math.hypot(dx, dy) || 1, sp = T.BADCODE_SPEED * mult;
      b.vx = dx / dd * sp; b.vy = dy / dd * sp; b.facing = dx < 0 ? -1 : 1;
    }
    b.x += b.vx; b.y += b.vy;                               // floats — no gravity, no tiles
  }

  function bossContact(b) {
    if (b.sub === "papa" && !b.onLand && (b.state === "submerged" || b.state === "rising")) return;
    const box = { x: b.x, y: b.y, w: b.w, h: b.h };
    for (const p of players) {
      if (p.dead) continue;
      const kind2 = classifyContact(p, box);
      if (!kind2) continue;
      if ((kind2 === "stomp" || kind2 === "moon") && b.iframes <= 0) {
        damageBoss(b, p.pounding || p.form === "trex" || p.form === "mecha" ? 3 : 1);
        if (kind2 === "stomp") bouncePlayer(p);
        Game.hitstop = T.HITSTOP_BOSS;
      } else if (kind2 === "hurt") {
        hurtPlayer(p, b.x + b.w / 2);
      }
    }
  }

  function damageBoss(b, dmg) {
    if (b.iframes > 0 || b.state === "dying" || b.fleeing) return false;
    b.hp -= dmg;
    b.iframes = b.sub === "badcode" ? 18 : T.BOSS_IFRAMES; b.hurtFlash = T.BOSS_HURT_FLASH;
    AudioSys.sfx("bossHurt");
    World.addFloater(b.x + b.w / 2, b.y - 8, "SCRUMPTIONED!");
    if (b.hp <= 0) {
      if (b.sub === "hog" && !b.final) {              // L5: he flees WITH THE BABIES
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

  function drawBadcode(b, camX, camY) {
    const x = Math.round(b.x - camX), y = Math.round(b.y - camY), w = b.w, h = b.h, t = b.animTimer;
    const hurt = b.hurtFlash > 0;
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
  function draw(camX, camY) {
    for (const b of units) {
      if (b.state === "gone") continue;
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
