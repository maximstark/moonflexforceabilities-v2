"use strict";
/* =====================================================================
 *  WORLD — level lifecycle, pickups, doors & elevator, camera,
 *  particles, floaters, parallax + tile rendering, level events.
 * ===================================================================== */
const World = (() => {
  let pickups = [], floaters = [], particles = [], npcs = [];
  let doors = [], elevator = null;
  let trophySpawned = false, firesLeft = 0, rescueArmed = false;
  let camX = 0, camY = 0;
  let levelCache = {};
  const LATE_WORLD_ART = {
    7: ["sky_ascent", "par_ascent"], 8: ["sky_fall", "par_fall"],
    9: ["sky_cove", "par_cove"], 10: ["sky_nice", "par_nice"],
    11: ["sky_longup", "par_longup"], 12: ["sky_dream", "par_dream"],
  };

  /* ---------------- loading ---------------- */
  async function loadLevel(id) {
    const file = id === "hub" ? "levels/hub.json" : `levels/level${id}.json`;
    if (!levelCache[file]) levelCache[file] = await (await fetch(file)).json();
    // deep-clone the pristine copy: the grid is mutated in play (fires, blocks)
    level = JSON.parse(JSON.stringify(levelCache[file]));
    // Worlds 7-12 originally reused placeholder skies. The approved v2 library
    // gives each late dream its own sky and two-tier parallax identity.
    if (LATE_WORLD_ART[level.world]) [level.sky, level.par] = LATE_WORLD_ART[level.world];
    grid = level.grid; gridH = grid.length; gridW = grid[0].length;
    buildTileSets();
    if (Game.checkpoint && Game.checkpoint.levelId !== id) Game.checkpoint = null;
    resetWorld(id);
  }

  function resetWorld(id) {
    pickups = []; floaters = []; particles = []; npcs = [];
    enemies.length = 0; projectiles.length = 0; stinkClouds.length = 0;
    Combat.laserShots.length = 0; Combat.spoonSwings.length = 0;
    Combat.pinkBursts.length = 0; Combat.poundShocks.length = 0;
    Combat.stickyHands.length = 0; Combat.eggs.length = 0;
    trophySpawned = false;
    Game.levelId = id;
    Game.happiness = level.startHappy != null ? level.startHappy : T.HAPPINESS_MAX;
    Game.babiesThisLevel = 0;

    for (const e of level.enemies) enemies.push(makeEnemy(e));
    for (const pk of level.pickups)
      pickups.push({ ...pk, taken: false, seed: pickups.length * 1.7, grace: 0 });
    npcs = (level.npcs || []).map(n => ({ ...n }));         // adorable, harmless, full of compliments
    doors = (level.doors || []).map(d => ({ ...d }));
    elevator = level.elevator
      ? { x: level.elevator.x, y: level.elevator.stops[0], stops: level.elevator.stops,
          target: 0, moving: false, w: 24, h: 6 }
      : null;
    Bosses.spawn(level.boss);
    if (!level.boss && id !== "hub") spawnTrophy("trophy");   // bossless level: reach the goal
    // checkpoint flag (the long dreams): plant it on its ledge
    const cpDef = typeof CHECKPOINTS !== "undefined" && CHECKPOINTS[id];
    if (cpDef) {
      let fy = cpDef.ty;
      while (fy < gridH && !(isSolid(cpDef.tx, fy) || isOneway(cpDef.tx, fy))) fy++;
      const claimed = Game.checkpoint && Game.checkpoint.levelId === id;
      pickups.push({ type: claimed ? "flag_up" : "flag", x: cpDef.tx * TS, y: fy * TS - 20,
                     taken: false, seed: 3.3, grace: 0 });
    }
    // GENTLE DREAMS: the dream leaves warm hearts near its treasures
    // (engine-injected like the flag — the level JSONs never carry them)
    if (save.gentle) {
      const spots = [];
      for (const pk of pickups) {
        if (pk.type === "chest") spots.push({ x: pk.x + 22, y: pk.y - 2 });
        if (pk.type === "flag" || pk.type === "flag_up") spots.push({ x: pk.x + 18, y: pk.y + 4 });
      }
      for (const s of spots)
        pickups.push({ type: "heart", x: s.x, y: s.y, taken: false, seed: pickups.length * 1.7, grace: 0 });
    }
    firesLeft = 0;
    for (const row of grid) for (const t of row)
      if (t >= 0 && level.tileNames[t] === "fire1") firesLeft++;
    rescueArmed = firesLeft > 0;

    // players (a claimed checkpoint wins over the level spawn)
    const cp = Game.checkpoint && Game.checkpoint.levelId === id ? Game.checkpoint : null;
    for (const p of players) {
      const i = players.indexOf(p);
      p.x = (cp ? cp.x : level.spawn.x) + i * 20;
      p.y = cp ? cp.gy - p.h : level.spawn.y;
      p.vx = 0; p.vy = 0; p.dead = false; p.trail = [];
      p.lastSafeX = p.x; p.lastSafeY = p.y;
      p.carrying = 0; p.rooted = false; p.pounding = false; p.moonTimer = 0;
      const hm = save.gentle ? T.GENTLE_HEART_MULT : 1;   // GENTLE DREAMS: twice the hearts
      if (level.forceForm === "mecha") {
        p.form = "mecha"; p.w = T.MECHA_W; p.h = T.MECHA_H;
        p.hearts = p.maxHearts = T.MECHA_HEARTS * hm;
        p.stack = [];
      } else {
        p.form = p.character === "charmgirl" ? "charmgirl" : "swan";
        p.w = T.PLAYER_W; p.h = T.PLAYER_H;
        p.hearts = p.maxHearts = T.MAX_HEARTS * hm;
      }
    }
    camX = clamp((cp ? cp.x : level.spawn.x) - T.VIEW_W / 2, 0, Math.max(0, gridW * TS - T.VIEW_W));
    camY = clamp((cp ? cp.gy : level.spawn.y) - T.VIEW_H / 2, 0, Math.max(0, gridH * TS - T.VIEW_H));
    AudioSys.playSong(level.music);
  }

  /* ---------------- pickups ---------------- */
  const PICKUP_SPRITE = {
    popcorn: ["hud","popcorn"], star: ["hud","star"], treat: ["hud","treat"],
    trophy: ["hud","trophy"], moon: ["items","moon"], beads: ["items","beads"],
    pickup_goosefeet: ["items","pickup_goosefeet"], pickup_laser: ["items","pickup_laser"],
    pickup_kirby: ["items","icon_kirby"], pickup_spoon: ["items","pickup_spoon"],
    pickup_mermaid: ["items","pickup_mermaid"],
    chest: ["tiles2","chest_closed"], chest_open: ["tiles2","chest_open"],
    babyswan: ["babyswan","bob1"],
  };
  function dropCostume(costume, x, y) {
    pickups.push({ type: "pickup_" + costume, x, y, taken: false,
                   seed: Math.random() * 9, grace: T.DROP_GRACE });
  }
  // GENTLE DREAMS: beaten baddies sometimes leave a little love behind
  function dropHeart(x, y) {
    pickups.push({ type: "heart", x, y, taken: false, seed: Math.random() * 9, grace: 12 });
  }
  function spawnTrophy(kind) {
    if (trophySpawned) return;
    trophySpawned = true;
    const tx = Math.floor(level.goalX / TS);
    let ty = 0;
    while (ty < gridH && !isSolid(tx, ty)) ty++;
    pickups.push({ type: kind, x: level.goalX - 8, y: ty * TS - 20, taken: false, seed: 0, grace: 0 });
    addFloater(level.goalX, ty * TS - 30, kind === "beads" ? "THE GOLD MEDAL!" : "GO!");
  }

  function updatePickups() {
    for (const pk of pickups) {
      if (pk.taken) continue;
      if (pk.grace > 0) { pk.grace--; continue; }
      const bob = Math.sin((Game.frame + pk.seed * 37) / 18) * 2;
      const box = { x: pk.x, y: pk.y + bob, w: 16, h: 16 };
      for (const p of players) {
        if (p.dead || !overlaps({ x: p.x, y: p.y, w: p.w, h: p.h }, box)) continue;
        if (collectPickup(pk, p)) break;
      }
    }
  }
  function collectPickup(pk, p) {
    const t = pk.type;
    if (t === "flag") {                       // raise the checkpoint flag
      pk.type = "flag_up";
      Game.checkpoint = { levelId: Game.levelId, x: pk.x, gy: pk.y + 20 };
      addFloater(pk.x + 8, pk.y - 8, "CHECKPOINT!");
      AudioSys.sfx("checkpoint");
      burstAt(pk.x + 8, pk.y + 4, "spark", 5);
      return false;
    }
    if (t === "flag_up") return false;
    if (t === "heart") {                      // GENTLE DREAMS: one warm heart back
      if (p.hearts >= p.maxHearts) return false;   // it waits until you need it
      p.hearts++;
      pk.taken = true;
      addFloater(pk.x + 8, pk.y - 6, "A WARM HEART!");
      AudioSys.sfx("treat");
      burstAt(pk.x + 8, pk.y + 6, "spark", 4);
      return true;
    }
    if (t === "chest") {
      if (Game.stars >= 3) {
        pk.type = "chest_open";
        Game.stars -= 3;
        World.burstAt(pk.x + 8, pk.y + 4, "spark", 6);
        Game.state = "chooser"; Game.chooserIdx = 0; Game.chooserFor = p;
        AudioSys.sfx("star");
      } else if (Game.frame % 30 === 0) {
        addFloater(pk.x + 8, pk.y - 8, "NEEDS 3 STARS");
      }
      return false;
    }
    pk.taken = true;
    if (t === "popcorn") { Game.score += T.POINTS_POPCORN; addFloater(pk.x+8, pk.y-4, "+"+T.POINTS_POPCORN); AudioSys.sfx("popcorn"); }
    else if (t === "star") { Game.stars++; addFloater(pk.x+8, pk.y-4, "STAR!"); AudioSys.sfx("star"); burstAt(pk.x+8, pk.y+8, "spark", 4); }
    else if (t === "treat") { Game.happiness = Math.min(T.HAPPINESS_MAX, Game.happiness + T.TREAT_REFILL); addFloater(pk.x+8, pk.y-4, "YUM!"); AudioSys.sfx("treat"); }
    else if (t === "moon") { grantMoon(p); burstAt(pk.x+8, pk.y+8, "moonspark", 8); }
    else if (t === "babyswan") {
      p.carrying++; Game.babiesThisLevel++;
      addFloater(pk.x+8, pk.y-8, "BABY SWAN!"); AudioSys.sfx("baby");
      if (pk.rescue && firesLeft > 0) addFloater(pk.x+8, pk.y+8, "(so brave, so warm)");
    }
    else if (t.startsWith("pickup_")) {
      const costume = t.slice(7);
      if (costume === "mermaid") { p.form = "mermaid"; AudioSys.sfx("transform"); }
      else wearCostume(p, costume);
    }
    else if (t === "trophy") { levelClear(); }
    else if (t === "beads") { finaleClear(); }
    return true;
  }

  /* ---------------- level events ---------------- */
  function onFirePutOut() {
    firesLeft--;
    addFloater(players[0].x, players[0].y - 12, firesLeft > 0 ? firesLeft + " FIRES LEFT!" : "FIRE'S OUT!");
    if (firesLeft === 0 && rescueArmed) {
      Game.score += T.POINTS_RESCUE;
      Game.happiness = T.HAPPINESS_MAX;
      addFloater(players[0].x, players[0].y - 24, "RESCUE! +" + T.POINTS_RESCUE);
      AudioSys.sfx("win");
    }
  }
  function onBossesCleared(fled) {
    if (level.finale) spawnTrophy("beads");
    else spawnTrophy("trophy");
    if (!fled) AudioSys.playSong(level.music);
  }
  function levelClear() {
    Game.checkpoint = null;
    AudioSys.sfx("win");
    for (const p of players) if (p.carrying) {
      Game.score += p.carrying * T.POINTS_BABY;
      addFloater(p.x, p.y - 10, "BABIES SAFE! +" + p.carrying * T.POINTS_BABY);
    }
    if (Game.babiesThisLevel > 0 && Game.levelId >= 1 && Game.levelId <= T.WORLD_COUNT - 1)
      save.babies[Game.levelId - 1] = true;
    if (typeof Game.levelId === "number") {
      save.unlocked = Math.max(save.unlocked, Math.min(T.WORLD_COUNT, Game.levelId + 1));
      writeSave();
    }
    Game.state = "clear"; Game.stateTimer = 130;
  }
  function finaleClear() {
    Game.checkpoint = null;
    Game.score += T.POINTS_FINALE;
    AudioSys.sfx("tenmil");
    Game.shake = 10;
    addFloater(players[0].x, players[0].y - 16, "+10,000,000!!!");
    save.unlocked = T.WORLD_COUNT; writeSave();
    Game.state = "ending"; Game.stateTimer = 0;
    AudioSys.playSong("ending");
  }

  /* ---------------- doors & elevator (the hub) ---------------- */
  // which stop is this height standing at? (-1 if none)
  function stopAt(e, feet) {
    for (let i = 0; i < e.stops.length; i++)
      if (Math.abs(feet - e.stops[i]) <= 3) return i;
    return -1;
  }
  function updateHubBits() {
    if (elevator) {
      const e = elevator;
      const bandL = e.x - 6, bandR = e.x + e.w + 6;   // ride/call zone around the shaft
      if (e.moving) {
        const ty = e.stops[e.target];
        e.y += clamp(ty - e.y, -2.6, 2.6);
        if (Math.abs(e.y - ty) < 1) { e.y = ty; e.moving = false; AudioSys.sfx("ding"); }
      }
      for (const p of players) {
        if (p.dead) continue;
        const pad = pads[p.idx];
        const feet = p.y + p.h;
        if (!(p.x + p.w > bandL && p.x < bandR)) continue;   // not in the shaft column

        // riding the car
        if (feet >= e.y - 3 && feet <= e.y + 8) {
          p.y = e.y - p.h; p.vy = Math.min(p.vy, 0); p.grounded = true;
          if (!e.moving) {
            if (pad.pressed.has("action") && e.target < e.stops.length - 1) {
              e.target++; e.moving = true; AudioSys.sfx("door");
            } else if (pad.pressed.has("down") && e.target > 0) {
              e.target--; e.moving = true; AudioSys.sfx("door");
            }
          }
          continue;
        }

        // an empty shaft is never a pit: catch a faller on the floor below
        if (!p.grounded && p.vy > 0) {
          const prevFeet = feet - p.vy;
          for (const s of e.stops)
            if (Math.abs(s - e.y) > 1 && prevFeet <= s + 1 && feet >= s) {
              p.y = s - p.h; p.vy = 0; p.grounded = true;
              break;
            }
        }

        // standing at a landing: press action to summon the car here
        if (p.grounded) {
          const here = stopAt(e, p.y + p.h);
          if (here >= 0 && Math.abs(e.stops[here] - e.y) > 1 && pad.pressed.has("action")) {
            e.target = here; e.moving = true; AudioSys.sfx("door");
          }
        }
      }
    }
    for (const d of doors) {
      for (const p of players) {
        if (p.dead || !p.grounded) continue;
        const near = Math.abs((p.x + p.w / 2) - (d.x + 8)) < 12 &&
                     Math.abs((p.y + p.h) - (d.y + 16)) < 20;
        if (near && pads[p.idx].pressed.has("down")) {
          if (d.level <= save.unlocked) {
            AudioSys.sfx("door");
            Game.enterLevel(d.level);
          } else {
            addFloater(d.x + 8, d.y - 8, "LOCKED — CLEAR FLOOR " + (d.level - 1));
            AudioSys.sfx("refund");
          }
        }
      }
    }
  }

  /* ---------------- particles & floaters ---------------- */
  const PARTS = {
    feather: { frames: ["feather"], grav: 0.04, life: 50, vy: -0.5, spread: 1.2 },
    splash:  { frames: ["splash1","splash2"], grav: 0.12, life: 26, vy: -1.6, spread: 1.4 },
    spark:   { frames: ["spark1","spark2"], grav: 0, life: 24, vy: -0.3, spread: 1.6 },
    poof:    { frames: ["poof1","poof2"], grav: -0.01, life: 22, vy: -0.4, spread: 1.2 },
    bubble:  { frames: ["bubble"], grav: -0.05, life: 60, vy: -0.4, spread: 0.4 },
    moonspark:{ frames: ["moonspark"], grav: 0, life: 30, vy: -0.6, spread: 0.8 },
    ring:    { frames: ["ring1","ring2"], grav: 0, life: 16, vy: 0, spread: 2.2 },
    ember:   { frames: ["spark1"], grav: -0.03, life: 30, vy: -0.8, spread: 0.6 },
    confetti:{ rect: ["#ff6ea8","#7ee0ff","#ffe48a","#b5f78e","#d8a6ff"], grav: 0.08, life: 38, vy: -1.6, spread: 2.2 },
  };
  function burstAt(x, y, type, n) {
    const def = PARTS[type];
    if (!def || particles.length > 220) return;
    for (let i = 0; i < n; i++)
      particles.push({ type, x, y, vx: (Math.random() - 0.5) * 2 * def.spread,
                       vy: def.vy + (Math.random() - 0.5), life: def.life + Math.random() * 10, t: 0,
                       col: def.rect ? def.rect[(Math.random() * def.rect.length) | 0] : null });
  }
  function addFloater(x, y, text) { floaters.push({ x, y, text, timer: 50 }); }
  function updateFx() {
    for (const f of floaters) { f.timer--; f.y -= 0.5; }
    floaters = floaters.filter(f => f.timer > 0);
    for (const pt of particles) {
      const def = PARTS[pt.type];
      pt.t++; pt.life--; pt.x += pt.vx; pt.y += pt.vy; pt.vy += def.grav;
    }
    particles = particles.filter(p => p.life > 0);
  }

  /* ---------------- camera ---------------- */
  function updateCamera() {
    const alive = players.filter(p => !p.dead);
    if (!alive.length) return;
    let fx = 0, fy = 0;
    for (const p of alive) { fx += p.x + p.w / 2 + p.facing * T.CAM_LOOKAHEAD / alive.length; fy += p.y + p.h / 2; }
    fx /= alive.length; fy /= alive.length;
    camX += (fx - T.VIEW_W / 2 - camX) * T.CAM_LERP;
    camY += (fy - T.VIEW_H / 2 - camY) * T.CAM_LERP;
    camX = clamp(camX, 0, Math.max(0, gridW * TS - T.VIEW_W));
    camY = clamp(camY, 0, Math.max(0, gridH * TS - T.VIEW_H));
  }

  /* ---------------- rendering ---------------- */
  const ANIM_TILES = { water_surf1: "water_surf2", fire1: "fire2", seaweed1: "seaweed2" };
  function draw() {
    let cx = Math.round(camX), cy = Math.round(camY);
    if (Game.shake > 0) {
      cx += Math.round((Math.random() - 0.5) * 4);
      cy += Math.round((Math.random() - 0.5) * 3);
    }
    // sky + parallax (far ridge and ambient drift live in Atmo)
    drawStretched(level.sky, "g", 0, 0, T.VIEW_W, T.VIEW_H);
    Atmo.drawSkyGrade();
    Atmo.drawFar(cx, cy);
    const strip = sheets[level.par];
    if (strip) {
      const off = Math.floor(cx * 0.35) % 192;
      const py = T.VIEW_H - 110 - Math.round(cy * 0.2);
      for (let x = -off; x < T.VIEW_W; x += 192) drawFrame(level.par, "s", x, py);
    }
    Atmo.drawBack(cx, cy);
    drawTiles(cx, cy);
    drawWaterTint(cx, cy);
    drawHubBits(cx, cy);
    drawPickups(cx, cy);
    drawNpcs(cx, cy);
    drawEnemies(cx, cy);
    Bosses.draw(cx, cy);
    for (const p of players) drawPlayer(p, cx, cy);
    drawProjectiles(cx, cy);
    drawParticles(cx, cy);
    Atmo.drawFront(cx, cy);
    Atmo.drawGrade();
    drawFloaters(cx, cy);
    drawHubPrompts(cx, cy);
    return { cx, cy };
  }
  function drawTiles(cx, cy) {
    const x0 = Math.max(0, Math.floor(cx / TS));
    const x1 = Math.min(gridW - 1, Math.floor((cx + T.VIEW_W) / TS));
    const y0 = Math.max(0, Math.floor(cy / TS));
    const y1 = Math.min(gridH - 1, Math.floor((cy + T.VIEW_H) / TS));
    const alt = (Game.frame >> 4) % 2 === 1;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = grid[ty][tx];
        if (t < 0) continue;
        let name = level.tileNames[t];
        if (alt && ANIM_TILES[name]) name = ANIM_TILES[name];
        const sx = tx * TS - cx, sy = ty * TS - cy;
        drawFrame(TILE_LOOKUP[name], name, sx, sy);
        decorateTile(name, tx, ty, Math.round(sx), Math.round(sy));
        if (name.startsWith("fire") && Math.random() < 0.05)
          burstAt(tx * TS + 8, ty * TS, "ember", 1);
      }
    }
  }
  // deterministic per-tile accents: tufts, flowers, sprinkles, dew, glow.
  // seeded by the tile coordinate so the meadow never flickers
  function decorateTile(name, tx, ty, sx, sy) {
    const h = (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 100;
    if (name === "grass_top") {
      if (h >= 36 || tileAt(tx, ty - 1) !== -1) return;
      if (h < 24) {                                   // a tuft
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(sx + (h % 11) + 2, sy - 2, 1, 2);
        ctx.fillRect(sx + (h % 11) + 4, sy - 3, 1, 3);
      } else {                                        // a little flower
        const fx = sx + (h % 9) + 3;
        ctx.fillStyle = "#3e8e41"; ctx.fillRect(fx, sy - 3, 1, 3);
        ctx.fillStyle = ["#ff9ecb", "#ffe48a", "#fff6f0"][h % 3];
        ctx.fillRect(fx - 1, sy - 5, 3, 2); ctx.fillRect(fx, sy - 6, 1, 1);
      }
    } else if (name === "night_grass") {
      if (h < 20 && tileAt(tx, ty - 1) === -1) {      // silver tuft
        ctx.fillStyle = "#7f9bd0";
        ctx.fillRect(sx + (h % 11) + 2, sy - 2, 1, 2);
      } else if (h >= 90) {                           // moonlit dew, blinking
        const tw = 0.4 + 0.6 * Math.abs(Math.sin((Game.frame + h * 7) / 26));
        ctx.fillStyle = `rgba(220,235,255,${tw})`;
        ctx.fillRect(sx + (h % 13) + 1, sy + 1, 1, 1);
      }
    } else if (name === "candy_top") {
      if (h < 30) {                                   // stray sprinkles
        ctx.fillStyle = ["#ff6ea8", "#7ee0ff", "#b5f78e"][h % 3];
        ctx.fillRect(sx + (h % 12) + 2, sy + 2 + (h % 3), 1, 1);
      }
    } else if (name === "cloud_top") {
      if (h < 22) {                                   // sunlit wisp
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(sx + (h % 10) + 2, sy + 2, 3, 1);
      }
    } else if (name === "rock_top") {
      if (h < 14 && tileAt(tx, ty - 1) === -1) {      // a pebble
        ctx.fillStyle = "#6a6478";
        ctx.fillRect(sx + (h % 12) + 2, sy - 1, 2, 1);
      }
    } else if (name === "fire1" || name === "fire2") {  // warm breathing glow
      const a = 0.08 + 0.05 * Math.sin((Game.frame + h) / 6);
      ctx.fillStyle = `rgba(255,140,40,${a})`;
      ctx.beginPath(); ctx.arc(sx + 8, sy + 6, 13, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawWaterTint(cx, cy) {
    for (const r of waterRects) {
      const x = Math.round(r.x - cx), y = Math.round(r.y - cy);
      if (x > T.VIEW_W || y > T.VIEW_H || x + r.w < 0 || y + r.h < 0) continue;
      ctx.fillStyle = "rgba(86,134,219,0.28)";
      ctx.fillRect(x, y, r.w, r.h);
      if (r.h > 48) {                                 // the deep gets deeper
        ctx.fillStyle = "rgba(24,48,120,0.16)";
        ctx.fillRect(x, y + (r.h >> 1), r.w, r.h - (r.h >> 1));
      }
      // a living surface: wobbling highlight dashes (clipped to the view)
      ctx.fillStyle = "rgba(214,238,255,0.5)";
      const s0 = Math.max(0, -x), s1 = Math.min(r.w, T.VIEW_W - x);
      for (let sx = s0; sx < s1; sx += 6) {
        const wy = Math.sin((Game.frame + (r.x + sx) * 0.8) / 13) * 1.5;
        ctx.fillRect(x + sx, y + Math.round(wy), 4, 1);
      }
    }
  }
  function drawHubBits(cx, cy) {
    if (elevator) {
      const e = elevator;
      // shut doors at every floor; the doorway is open only where the car waits
      for (const s of e.stops)
        if (Math.abs(s - e.y) > 1) drawFrame("elevator", "closed", e.x - cx,
                                             s - sheets.elevator.anchor[1] - cy);
      drawFrame("elevator", e.moving ? "closed" : "open", e.x - cx,
                e.y - sheets.elevator.anchor[1] - cy);
      // beacon: the next floor is UP the shaft (you respawn at the bottom)
      const p = players[0];
      const nearLift = p && !p.dead && p.x + p.w > e.x - 6 && p.x < e.x + e.w + 6;
      if (save.unlocked > 1 && !nearLift) {
        const by = Math.sin(Game.frame / 10) * 2;
        ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ffe48a";
        ctx.fillText("↑ FL." + save.unlocked, e.x + e.w / 2 - cx, e.y - 34 - cy + by);
        ctx.textAlign = "left";
      }
    }
    for (const d of doors) {
      const locked = d.level > save.unlocked;
      if (locked) drawBars(d.x - cx, d.y - cy);
      ctx.font = "7px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = locked ? "#8a7a9a" : "#ffe48a";
      ctx.fillText("FL." + d.level, d.x + 8 - cx, d.y - 4 - cy);
      if (d.level === save.unlocked) {                 // newest open floor: go here
        const by = Math.sin(Game.frame / 9) * 2;
        ctx.fillStyle = "#9fe8a0";
        ctx.fillText("▼", d.x + 8 - cx, d.y - 12 - cy + by);
      }
      ctx.textAlign = "left";
    }
  }
  // iron bars + a little padlock over a locked doorway
  function drawBars(sx, sy) {
    sx = Math.round(sx); sy = Math.round(sy);
    ctx.fillStyle = "rgba(16,11,24,0.55)"; ctx.fillRect(sx, sy, 16, 16);
    const vb = [2, 6, 10, 13], hb = [4, 10];
    ctx.fillStyle = "#2a2038";
    for (const bx of vb) ctx.fillRect(sx + bx, sy + 1, 2, 15);
    for (const by of hb) ctx.fillRect(sx + 1, sy + by, 15, 2);
    ctx.fillStyle = "#aeb0c8";
    for (const bx of vb) ctx.fillRect(sx + bx, sy + 1, 1, 15);
    for (const by of hb) ctx.fillRect(sx + 1, sy + by, 15, 1);
    ctx.fillStyle = "#241a30"; ctx.fillRect(sx + 5, sy + 6, 6, 6);
    ctx.fillStyle = "#ffd96a"; ctx.fillRect(sx + 6, sy + 7, 4, 4);
    ctx.fillStyle = "#241a30"; ctx.fillRect(sx + 7, sy + 9, 2, 2);
  }
  // contextual hints, drawn on top of the cast so the player never hides them
  function drawHubPrompts(cx, cy) {
    const p = players[0];
    if (!p || p.dead) return;
    const feet = p.y + p.h;
    if (elevator) {
      const e = elevator;
      const inBand = p.x + p.w > e.x - 6 && p.x < e.x + e.w + 6;
      const onCar = inBand && feet >= e.y - 3 && feet <= e.y + 8;
      if (onCar && !e.moving) {
        const up = e.target < e.stops.length - 1, dn = e.target > 0;
        const msg = (up ? "X/B ▲" : "") + (up && dn ? "   " : "") + (dn ? "↓ ▼" : "");
        if (msg) drawPrompt(msg, e.x + e.w / 2, e.y - 30, cx, cy);
      } else if (inBand && p.grounded && !e.moving) {
        drawPrompt("X/B  CALL", e.x + e.w / 2, e.y - 30, cx, cy);
      }
    }
    if (p.grounded) for (const d of doors) {
      const near = Math.abs((p.x + p.w / 2) - (d.x + 8)) < 12 &&
                   Math.abs(feet - (d.y + 16)) < 20;
      if (near) drawPrompt(d.level > save.unlocked ? "LOCKED" : "↓ DIVE IN", d.x + 8, d.y - 18, cx, cy);
    }
  }
  function drawPrompt(text, wx, wy, cx, cy) {
    ctx.font = "7px monospace"; ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 8;
    const x = Math.round(wx - cx), y = Math.round(wy - cy + Math.sin(Game.frame / 12));
    ctx.fillStyle = "rgba(20,12,28,0.82)"; ctx.fillRect(x - w / 2, y - 9, w, 11);
    ctx.fillStyle = "#ffe48a"; ctx.fillText(text, x, y - 1);
    ctx.textAlign = "left";
  }
  // the friendly cast of world 10: standees that compliment you as you pass
  function drawNpcs(cx, cy) {
    for (let ni = 0; ni < npcs.length; ni++) {
      const n = npcs[ni];
      const useV2 = sheets.nice_npcs && level && level.world === 10;
      const sheet = useV2 ? "nice_npcs" : n.sheet;
      const frame = useV2 ? "npc" + (ni + 1) : n.frame;
      const s = sheets[sheet];
      if (!s) continue;
      const bob = Math.sin((Game.frame + n.x) / 16) * 1.5;
      drawFrame(sheet, frame, n.x - s.draw_w / 2 - cx, n.y - s.draw_h - cy + bob);
      let near = false;
      for (const p of players)
        if (!p.dead && Math.abs((p.x + p.w / 2) - n.x) < 44 && Math.abs((p.y + p.h) - n.y) < 64) near = true;
      if (near && n.line) {
        ctx.font = "7px monospace"; ctx.textAlign = "center";
        const w = ctx.measureText(n.line).width + 8;
        const sx = Math.round(n.x - cx), sy = Math.round(n.y - s.draw_h - 6 - cy + bob);
        ctx.fillStyle = "rgba(20,12,28,0.82)"; ctx.fillRect(sx - w / 2, sy - 9, w, 11);
        ctx.fillStyle = "#fff6d8"; ctx.fillText(n.line, sx, sy - 1);
        ctx.textAlign = "left";
      }
    }
  }
  // the checkpoint flag has no sprite sheet — a little pole and pennant
  function drawFlag(pk, cx, cy) {
    const x = Math.round(pk.x + 6 - cx), gy = Math.round(pk.y + 20 - cy);
    const up = pk.type === "flag_up";
    drawFrameSized("hud", "checkpoint", x - 8, gy - 24, 16, 16);
    ctx.fillStyle = "#5a4a6a"; ctx.fillRect(x - 2, gy - 2, 6, 2);      // base
    ctx.fillStyle = "#8a7a9a"; ctx.fillRect(x, gy - 18, 1, 17);        // pole
    const flap = Math.sin(Game.frame / 8 + pk.x) > 0 ? 1 : 0;
    ctx.fillStyle = up ? "#ffd96a" : "#9a8ab0";
    ctx.fillRect(x + 1, gy - 18, 6, 4);
    ctx.fillRect(x + 7, gy - 17 - flap, 3, 2);
    if (up) {
      ctx.fillStyle = "#fff6d8"; ctx.fillRect(x + 2, gy - 17, 1, 1);
      if ((Game.frame >> 4) % 3 === 0) drawFrame("fx", "spark1", x - 6, gy - 32);
    }
  }
  // the gentle heart has no sprite sheet either — warm, round, softly aglow
  function drawHeart(pk, cx, cy) {
    const bob = Math.sin((Game.frame + pk.seed * 37) / 18) * 2;
    drawFrame("items", "heart", Math.round(pk.x - cx), Math.round(pk.y + bob - cy));
  }
  function drawPickups(cx, cy) {
    for (const pk of pickups) {
      if (pk.taken) continue;
      if (pk.type === "flag" || pk.type === "flag_up") { drawFlag(pk, cx, cy); continue; }
      if (pk.type === "heart") {
        if (!(pk.grace > 0 && (pk.grace >> 2) % 2)) drawHeart(pk, cx, cy);
        continue;
      }
      const bob = Math.sin((Game.frame + pk.seed * 37) / 18) * 2;
      const spr = PICKUP_SPRITE[pk.type];
      if (!spr) continue;
      if (pk.type === "babyswan")
        drawFrame("babyswan", (Game.frame >> 4) % 2 ? "bob2" : "bob1", pk.x - cx, pk.y + bob - cy);
      else drawFrame(spr[0], spr[1], pk.x - cx, pk.y + bob - cy);
      if (pk.grace > 0 && (pk.grace >> 2) % 2) continue;
    }
  }
  function drawParticles(cx, cy) {
    for (const pt of particles) {
      const def = PARTS[pt.type];
      if (pt.life < 8 && pt.life % 2 === 0) continue;
      if (def.rect) {                          // confetti: little colored squares
        ctx.fillStyle = pt.col;
        ctx.fillRect(Math.round(pt.x - cx) - 1, Math.round(pt.y - cy) - 1, 2, 2);
        continue;
      }
      const f = def.frames[(pt.t >> 3) % def.frames.length];
      drawFrame("fx", f, pt.x - 8 - cx, pt.y - 8 - cy);
    }
  }
  function drawFloaters(cx, cy) {
    ctx.font = "8px monospace"; ctx.textAlign = "center";
    for (const f of floaters) {
      ctx.fillStyle = f.timer > 15 ? "#fff6d8" : "rgba(255,246,216,0.5)";
      ctx.fillText(f.text, Math.round(f.x - cx), Math.round(f.y - cy));
    }
    ctx.textAlign = "left";
  }

  return { loadLevel, resetWorld, updatePickups, updateHubBits, updateFx, updateCamera,
           draw, burstAt, addFloater, dropCostume, dropHeart, spawnTrophy, onFirePutOut,
           onBossesCleared, levelClear,
           get camX() { return camX; }, get camY() { return camY; },
           get pickups() { return pickups; }, get npcs() { return npcs; } };
})();
