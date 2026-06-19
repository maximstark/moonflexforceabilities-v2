// Full-game headless scenarios. Appended after the game modules by run.js.
// Reflects the CURRENT engine: title -> overworld map -> world; powers STACK
// in p.powers[]; the name store returns to the MAP; the ending/credits are
// gated behind level.finale (world 12, THE BIGGEST DREAM, sets it — so the
// finale path is exercised on the real final world).
let passCount = 0, failCount = 0;
function check(label, cond, detail = "") {
  if (cond) { passCount++; console.log("  PASS  " + label); }
  else { failCount++; console.log("  FAIL  " + label + (detail ? "  [" + detail + "]" : "")); }
}
const tick = () => new Promise(r => setImmediate(r));
function step(n = 1) { for (let i = 0; i < n; i++) { update(); render(); } }
async function waitState(st, max = 600) {
  for (let i = 0; i < max; i++) { if (Game.state === st) return true; update(); await tick(); }
  return false;
}
function press(pad, a) { pad.pressed.add(a); pad.held[a] = true; }
function tap(pad, a) { pad.pressed.add(a); }
function releaseAll() {
  for (const k of Object.keys(pads[0].held)) pads[0].held[k] = false;
  for (const k of Object.keys(menuPad.held)) menuPad.held[k] = false;
  if (pads[1]) for (const k of Object.keys(pads[1].held)) pads[1].held[k] = false;
}
const P = () => players[0];
function groundY(p) { return p.y + p.h; }
// enter a world directly, dismissing any scripted story cards (L7/L8 have them)
async function gotoLevel(id) {
  await Game.enterLevel(id); step(2);
  for (let g = 0; g < 24 && Game.state === "card"; g++) { tap(menuPad, "confirm"); step(2); }
}
async function stompUnit(b, maxTries = 40) {
  for (let t = 0; t < maxTries && b.hp > 0; t++) {
    const p = P();
    p.x = b.x + b.w / 2 - p.w / 2; p.y = b.y - p.h - 12; p.vx = 0; p.vy = 2;
    p.iframes = 0; p.dead = false; p.hearts = p.maxHearts;
    for (let i = 0; i < 30; i++) { step(); if (b.iframes > 0 || b.hp <= 0) break; }
    while (b.iframes > 0 && b.hp > 0) { P().y = b.y - 90; P().vy = 0; step(); }
  }
  return b.hp <= 0;
}

async function main() {
  /* ============ boot & title ============ */
  await Game.boot();
  check("boot reaches title", Game.state === "title");
  check("all sheets loaded (incl. forge2)", Object.keys(sheets).length >= 37, Object.keys(sheets).length);

  /* ============ overworld map: title -> map -> world ============ */
  tap(menuPad, "confirm"); update();
  check("title opens the overworld map", Game.state === "map", Game.state);
  // the token starts on node 1 (THE DREAM LAKE); a locked path refuses
  save.unlocked = 1;
  tap(menuPad, "right"); update();
  check("locked path refuses (still on the map)", Game.state === "map");
  // confirm on the current node dives into world 1
  tap(menuPad, "confirm");
  check("map enters THE DREAM LAKE", await waitState("play", 900) && Game.levelId === 1,
        Game.state + "/" + Game.levelId);

  /* ============ the sacred movement regression (in L1) ============ */
  step(60);
  const baseY = groundY(P());
  check("L1 spawn ground intact (192)", P().grounded && baseY === 192, baseY);
  let minY = 999;
  press(pads[0], "jump");
  for (let i = 0; i < 50; i++) { step(); minY = Math.min(minY, P().y); }
  const fullJump = baseY - (minY + P().h);
  check("full jump height preserved (50-70px)", fullJump >= 50 && fullJump <= 70, fullJump);
  releaseAll(); step(60);
  minY = 999;
  tap(pads[0], "jump"); pads[0].held.jump = true; step(1); pads[0].held.jump = false;
  for (let i = 0; i < 50; i++) { step(); minY = Math.min(minY, P().y); }
  const tapJump = baseY - (minY + P().h);
  check("tap jump still a hop (<60% of full)", tapJump > 4 && tapJump < fullJump * 0.6, tapJump);
  step(40);
  // buffered jump near the ground still wins over the new flap
  P().x = 96; P().y = 120; P().vy = 0; P().flaps = 0;
  let buffered = false, jumped = false;
  for (let i = 0; i < 90; i++) {
    if (!buffered && P().vy > 0 && groundY(P()) > 178) { press(pads[0], "jump"); buffered = true; }
    step();
    if (buffered && P().vy < -4) { jumped = true; break; }
  }
  check("jump buffering survives the flap feature", jumped, "vy=" + P().vy.toFixed(2));
  releaseAll(); step(40);
  // flaps: two extra mid-air boosts high above ground
  P().x = 60; P().y = 160; P().vy = 0; step(2);
  press(pads[0], "jump"); step(12); releaseAll();
  const before = P().flaps;
  tap(pads[0], "jump"); step(2);
  check("mid-air flap fires when high up", P().flaps === before + 1, P().flaps);
  releaseAll(); step(80);

  /* ============ run/dash (SMW-style): hold C to go faster, release eases back ============ */
  releaseAll(); P().powers = []; P().lvl = {}; P().stack = [];
  P().x = 48; P().y = 160; P().vx = 0; P().vy = 0; step(8);     // settle on flat ground
  const topVx = f => { let m = 0; for (let i = 0; i < f; i++) { step(); m = Math.max(m, Math.abs(P().vx)); } return m; };
  press(pads[0], "right");
  const walkTop = topVx(25);
  check("walk tops out at the base cap", Math.abs(walkTop - T.MAX_RUN_SPEED) < 0.06, walkTop.toFixed(2));
  press(pads[0], "run");
  const runTop = topVx(25);
  check("holding run is ~25% faster", Math.abs(runTop - T.MAX_RUN_SPEED * T.RUN_SPEED_MULT) < 0.07, runTop.toFixed(2));
  pads[0].held.run = false;                                     // release run, keep walking
  step(1); const eased = Math.abs(P().vx);
  check("releasing run keeps momentum (no instant drop)", eased > T.MAX_RUN_SPEED && eased < runTop, eased.toFixed(2));
  let drained = false;
  for (let i = 0; i < 60; i++) { step(); if (Math.abs(Math.abs(P().vx) - T.MAX_RUN_SPEED) < 0.05) { drained = true; break; } }
  check("then eases smoothly back to the walk cap", drained, P().vx.toFixed(2));
  releaseAll(); step(20);

  /* ============ L1: lilypads are one-way, water works ============ */
  P().x = 57 * 16 + 2; P().y = 150; P().vy = 0;
  let landed = false;
  for (let i = 0; i < 60; i++) { step(); if (P().grounded) { landed = true; break; } }
  check("lilypad catches you from above (one-way)", landed && Math.abs(groundY(P()) - 192) < 2, groundY(P()));
  press(pads[0], "down"); tap(pads[0], "jump"); step(26); releaseAll();
  check("down+jump drops through the lilypad into the lake", P().inWater);
  tap(pads[0], "transform"); step(2);
  check("mermaid toggle still works", P().form === "mermaid");
  step(20);

  /* ============ L1 boss: Grumpis Jr -> clear -> store -> MAP ============ */
  P().x = 1500; P().y = 160; P().vy = 0; P().form = "swan"; step(8);
  check("grumpis activates", Bosses.activated);
  const g1 = Bosses.units[0];
  check("grumpis dies to stomps", await stompUnit(g1));
  let trophy = null;
  for (let i = 0; i < 200 && !trophy; i++) { step(); trophy = World.pickups.find(pk => pk.type === "trophy"); }
  check("trophy spawns at the goal", !!trophy);
  P().x = trophy.x; P().y = trophy.y - 4; P().vx = 0; P().vy = 0; P().iframes = 0; step(3);
  check("trophy triggers DREAM CLEAR", Game.state === "clear");
  check("clear unlocks floor 2", save.unlocked >= 2);
  while (Game.state === "clear") step();
  check("clear leads to the name store", Game.state === "store");
  tap(menuPad, "confirm"); step(2);                     // buy 'A' (cursor at 0)
  for (let i = 0; i < 27; i++) { tap(menuPad, "right"); step(1); }   // 0 -> 27 = END
  tap(menuPad, "confirm"); step(2);
  check("store completes back to the overworld map", await waitState("map", 900), Game.state);
  check("high score recorded", save.highScores.length >= 1);

  /* ============ the tall house (dormant hub: elevator + doors) ============ */
  await gotoLevel("hub"); step(30);
  check("hub: player stands on a floor", P().grounded, "y=" + P().y);
  check("hub does not drain happiness", Game.happiness === T.HAPPINESS_MAX);
  const stops = level.elevator.stops;
  P().x = level.elevator.x + 6; P().y = stops[0] - P().h; P().vy = 0; step(3);
  tap(pads[0], "action"); step(2);
  let rode = false;
  for (let i = 0; i < 600; i++) { step(); if (Math.abs(groundY(P()) - stops[1]) < 3) { rode = true; break; } }
  check("elevator carries you up a floor", rode, "feetY=" + groundY(P()) + " want " + stops[1]);
  const locked = level.doors.find(d => d.level > save.unlocked);
  if (locked) {
    P().x = locked.x; P().y = locked.y - P().h + 14; P().vy = 0; step(5);
    tap(pads[0], "down"); step(3);
    check("a locked door refuses entry", Game.levelId === "hub");
  } else check("a locked door refuses entry", true);
  const opened = level.doors.find(d => d.level <= save.unlocked);
  P().x = opened.x; P().y = opened.y; P().vy = 0; step(5);
  tap(pads[0], "down"); update();
  check("an open door dives into its world",
        await waitState("play", 900) && Game.levelId === opened.level, Game.levelId);

  /* ============ L2: goose feet, pound, tree rescue, twins ============ */
  await gotoLevel(2); step(20);
  check("L2 loads moonlight lake", level.name === "MOONLIGHT LAKE");
  const gf = World.pickups.find(pk => pk.type === "pickup_goosefeet");
  P().x = gf.x; P().y = gf.y; P().vy = 0; step(3);
  check("goose feet worn from pickup", has(P(), "goosefeet"));
  const moon = World.pickups.find(pk => pk.type === "moon");
  P().x = moon.x; P().y = moon.y; P().vy = 0; step(3);
  check("moon grants MOONFLEX to the swan", P().moonTimer > 0);
  const scoreBeforeRescue = Game.score;
  let firesOut = 0;
  for (const [c, r] of [[77, 4], [80, 4], [83, 4]]) {
    P().x = c * 16 + 2; P().y = r * 16 - P().h - 10; P().vx = 0; P().vy = 2; P().iframes = 200;
    for (let i = 0; i < 40; i++) { step(); if (grid[r][c] === -1) { firesOut++; break; } }
  }
  check("all three tree fires stomped out", firesOut === 3, firesOut);
  check("rescue pays the bonus", Game.score >= scoreBeforeRescue + T.POINTS_RESCUE);
  const baby = World.pickups.find(pk => pk.type === "babyswan");
  P().x = baby.x; P().y = baby.y; P().vy = 0; step(3);
  check("baby swan rescued (carried)", P().carrying === 1);
  // the shed button was retired; costumes now auto-absorb a hit instead
  P().moonTimer = 0; P().iframes = 0; P().hearts = P().maxHearts;
  const heartsBefore = P().hearts;
  hurtPlayer(P(), P().x + 50); step(3);
  check("a hit is absorbed by the costume, not a heart",
        !has(P(), "goosefeet") && P().hearts === heartsBefore &&
        World.pickups.some(pk => pk.type === "pickup_goosefeet" && !pk.taken && pk.grace > 0));
  P().x = 1950; P().y = 150; P().vy = 0; step(10);
  const twins = Bosses.units;
  check("the twins are two grumpises", twins.length === 2);
  await stompUnit(twins[0]);
  const survivor = Bosses.units.find(b => b.hp > 0);
  check("surviving twin enrages", survivor && survivor.rage > 1);
  check("second twin falls", await stompUnit(survivor));
  step(120);
  check("twins clear spawns trophy", World.pickups.some(pk => pk.type === "trophy"));

  /* ============ L3: the deep — alligator gag, chest powers, papa ============ */
  await gotoLevel(3); step(10);
  const gator = enemies.find(e => e.type === "alligator");
  P().x = gator.x - 30; P().y = gator.y; P().vx = 0; P().vy = 0; step(4);
  check("cat face reveals itself: AGH (alligator!)", gator.state !== "idle", gator.state);
  Game.stars = 3;
  const chest = World.pickups.find(pk => pk.type === "chest");
  P().x = chest.x; P().y = chest.y - 10; P().vy = 0; P().inWater = true; step(4);
  check("3 stars open the treasure box", Game.state === "chooser");
  tap(menuPad, "confirm"); step(2);                      // pick FIRE (chooser idx 0)
  check("fire power chosen (stacks in p.powers)", P().powers.includes("fire") && Game.state === "play");
  tap(pads[0], "action"); step(2);
  check("fireball flies", projectiles.some(pr => pr.kind === "fireball"));
  P().x = 2200; P().y = 60; P().vy = 0; step(12);
  const papa = Bosses.units[0];
  check("papa grumpis stirs the deep", Bosses.activated && papa.sub === "papa");
  let surfaced = false;
  for (let i = 0; i < 900; i++) { step(); if (papa.state === "vulnerable" || papa.state === "spit" || papa.state === "swat") { surfaced = true; break; } }
  check("papa surfaces between the lilypads", surfaced, papa.state);
  let papaDead = false;
  for (let t = 0; t < 30 && !papaDead; t++) {
    while (!"vulnerable spit swat".includes(papa.state) && papa.state !== "dying") step();
    if (papa.state === "dying") break;
    await stompUnit(papa, 3);
    papaDead = papa.hp <= 0;
  }
  check("papa grumpis defeated", papaDead || papa.state === "dying");

  /* ============ L4: springs, mush vault, the family ============ */
  await gotoLevel(4); step(10);
  P().x = 13 * 16 + 2; P().y = 9 * 16 - P().h - 30; P().vx = 0; P().vy = 0;
  let sprung = false;
  for (let i = 0; i < 80; i++) { step(); if (P().vy < -7) { sprung = true; break; } }
  check("springs launch hard", sprung, "vy=" + P().vy.toFixed(1));
  wearCostume(P(), "goosefeet");
  P().x = 60 * 16 + 1; P().y = 16; P().vx = 0; P().vy = 0; step(2);
  tap(pads[0], "down"); step(1);
  check("ground pound engages midair", P().pounding);
  let broke = false;
  for (let i = 0; i < 90; i++) { step(); if (grid[6][60] === -1) { broke = true; break; } }
  check("pound smashes the mush blocks", broke);
  P().x = 2150; P().y = 120; P().vy = 0; step(12);
  check("family reunion: three bosses", Bosses.units.length === 3, Bosses.units.length);
  let famOK = true;
  for (const b of [...Bosses.units]) {
    if (b.sub === "papa") {
      for (let i = 0; i < 200 && !"windup spit".includes(b.state); i++) step();
      famOK = await stompUnit(b, 60) && famOK;
    } else famOK = await stompUnit(b, 60) && famOK;
  }
  check("the whole grumpis family goes home", famOK);

  /* ============ L5: swarm, spoon deflect, the hog dog flees ============ */
  await gotoLevel(5); step(10);
  check("the fever swarm is dense (30+ enemies)", enemies.length >= 30, enemies.length);
  // separation regression: a big swarm must never collapse into one stack.
  // A real collapse overlaps EVERY frame; transient crossings come and go, so
  // we sample over time and take the minimum (robust against snapshot phase).
  const overlapPairs = () => {
    const sw = enemies.filter(e => e.alive && e.deadTimer <= 0);
    let n = 0;
    for (let i = 0; i < sw.length; i++) for (let j = i + 1; j < sw.length; j++)
      if (Math.abs(sw[i].x - sw[j].x) < 6 && Math.abs(sw[i].y - sw[j].y) < 6) n++;
    return n;
  };
  let minStacked = Infinity;
  for (let s = 0; s < 6; s++) {
    for (let i = 0; i < 60; i++) { P().x = 600; P().y = 150; P().vx = 0; P().vy = 0; P().iframes = 9999; step(); }
    minStacked = Math.min(minStacked, overlapPairs());
  }
  check("the swarm spreads out (no stacking)", minStacked <= 1, "min overlapping pairs over time = " + minStacked);
  wearCostume(P(), "spoon");
  P().x = 400; P().y = 100; P().vx = 0; P().vy = 0; P().iframes = 9999;
  spawnProjectile("mushroom", P().x + 30, P().y + 4, -1.5, 0, "enemy", 1);
  press(pads[0], "right"); tap(pads[0], "action"); step(3); releaseAll();
  check("the giant spoon deflects mushrooms", projectiles.some(pr => pr.kind === "mushroom" && pr.side === "player"));
  P().x = 2480; P().y = 140; P().vy = 0; P().iframes = 0; step(12);
  const hog = Bosses.units[0];
  check("the BIG HOG DOG appears", Bosses.activated && hog.sub === "hog");
  await stompUnit(hog, 60);
  check("beaten, he grabs the babies and flees", hog.fleeing === true || Game.cardQueue.length > 0 || Game.state === "card");
  await waitState("card", 300);
  check("the steal cutscene plays", Game.state === "card");
  tap(menuPad, "confirm"); step(2);
  let trophy5 = null;
  for (let i = 0; i < 400 && !trophy5; i++) { step(); trophy5 = World.pickups.find(pk => pk.type === "trophy"); }
  check("the chase goal appears", !!trophy5);

  /* ============ L6: MECHA SWAN — fly, smash, laser; clears to a trophy ============ */
  await gotoLevel(6); step(10);
  check("you are the GIANT MECHA SWAN", P().form === "mecha" && P().maxHearts === T.MECHA_HEARTS);
  const yTop = P().y; press(pads[0], "jump"); step(30);
  check("the mecha flies", P().y < yTop - 20, (yTop - P().y).toFixed(0));
  releaseAll();
  P().x = 19 * 16; P().y = 10 * 16; P().vx = 2; step(20);
  check("mecha smashes mush walls by existing", grid[10][20] === -1);
  P().x = 2700; P().y = 120; P().vy = 0; step(12);
  const hogf = Bosses.units[0];
  check("final hog dog awaits (14 hp)", hogf && hogf.maxHp === T.HOGF_HP);
  let lasered = 0;
  for (let i = 0; i < 1200 && hogf.hp > 0; i++) {
    P().x = hogf.x - 120; P().y = hogf.y + 10; P().vy = 0; P().iframes = 9999; P().facing = 1;
    if (P().atkCD <= 0) { tap(pads[0], "action"); lasered++; }
    step();
  }
  check("laser eyes carve him down (power fantasy)", hogf.hp <= 0, "hp=" + hogf.hp + " shots=" + lasered);
  let trophy6 = null;
  for (let i = 0; i < 400 && !trophy6; i++) { step(); trophy6 = World.pickups.find(pk => pk.type === "trophy"); }
  check("L6 (not the finale) clears to a trophy, not beads", !!trophy6 &&
        !World.pickups.some(pk => pk.type === "beads"));
  P().x = trophy6.x; P().y = trophy6.y - 4; P().vx = 0; P().vy = 0; P().iframes = 0; step(3);
  check("L6 trophy triggers clear", Game.state === "clear");

  /* ============ L7: THE BROKEN ASCENT — on foot, bossless summit ============ */
  await gotoLevel(7); step(10);
  check("L7 THE BROKEN ASCENT loads", level.name === "THE BROKEN ASCENT");
  check("L7 is bossless", !Bosses.any());
  check("the babies-back boost applies (+30% happy)",
        level.startHappy === 130 && Game.happiness > 120, Game.happiness);
  check("bossless summit auto-spawns a trophy at the goal",
        World.pickups.some(pk => pk.type === "trophy"));

  /* ============ L8: THE LONG FALL — the bad dreams chase + power stacking ============ */
  await gotoLevel(8); step(10);
  check("L8 THE LONG FALL loads", level.name === "THE LONG FALL");
  const bad = Bosses.units[0];
  check("THE BAD DREAMS boss is present", bad && bad.sub === "badcode");
  // regression: flies must not drift/sink off-screen before you reach them
  const fliesAtLoad = enemies.filter(e => e.type === "fly").length;
  check("L8 spawns flies", fliesAtLoad >= 1, fliesAtLoad);
  for (let i = 0; i < 360; i++) { P().x = 48; P().y = 112; P().vx = 0; P().vy = 0; P().iframes = 9999; step(); }
  check("flies stay airborne until you reach them (don't sink)",
        enemies.filter(e => e.type === "fly" && e.alive).length === fliesAtLoad,
        enemies.filter(e => e.type === "fly" && e.alive).length + "/" + fliesAtLoad);
  P().x = 600; P().y = 120; P().iframes = 9999; step(6);
  check("the bad dreams wakes once you pass it", Bosses.activated);
  // power stacking: a 2nd of the same power makes a mirrored pair (lvl 2).
  // powers persist across worlds by design, so clear them to isolate the test.
  P().powers = []; P().lvl = {};
  const chests8 = World.pickups.filter(pk => pk.type === "chest");
  Game.stars = 3;
  P().x = chests8[0].x; P().y = chests8[0].y - 10; P().vy = 0; P().iframes = 9999; step(4);
  check("L8 chest opens the chooser", Game.state === "chooser");
  tap(menuPad, "confirm"); step(2);                      // fire
  check("first pick adds the power (lvl 1)", P().powers.includes("fire") && (P().lvl.fire || 0) === 1);
  Game.stars = 3;
  P().x = chests8[1].x; P().y = chests8[1].y - 10; P().vy = 0; P().iframes = 9999; step(4);
  check("a second chest reopens the chooser", Game.state === "chooser");
  tap(menuPad, "confirm"); step(2);                      // fire again -> mirrored pair
  check("same power again stacks to a mirrored pair (lvl 2)", (P().lvl.fire || 0) === 2, P().lvl.fire);

  /* ============ L9: SECRET COVE — the level-configured Bad Dreams ============ */
  await gotoLevel(9); step(10);
  check("L9 SECRET COVE loads", level.name === "Secret Cove" && level.world === 9, level.name);
  const cove = Bosses.units[0];
  check("the cove's bad dreams is bigger & tougher (64px / 65hp)",
        cove && cove.sub === "badcode" && cove.w === 64 && cove.maxHp === 65,
        cove ? cove.w + "/" + cove.maxHp : "no boss");
  check("the cove's bad dreams is sweep-armed", !!(cove && cove.sweep));

  /* ============ L10: THE NICE PLACE — the four new toys + the giant ============ */
  await gotoLevel(10); step(10);
  check("L10 THE NICE PLACE loads", level.name === "THE NICE PLACE" && level.world === 10, level.name);
  check("L10 has its friendly NPC cast", World.npcs.length === 6, World.npcs.length);
  // the four new toys appear in chests only from world 10 (the chooser gains a third row)
  P().powers = []; P().lvl = {}; P().bubble = 0; P().stack = [];
  const chests10 = World.pickups.filter(pk => pk.type === "chest");
  check("L10 is generous with chests", chests10.length >= 4, chests10.length);
  // BUBBLEGUM: stack three chests into a 3-heart buffer (it isn't an action power)
  function openChest(k) {
    Game.stars = 3;
    P().x = chests10[k].x; P().y = chests10[k].y - 10; P().vy = 0; P().iframes = 9999; step(4);
  }
  openChest(0); check("L10 chest opens the chooser", Game.state === "chooser");
  Game.chooserIdx = 8; tap(menuPad, "confirm"); step(2);            // bubble = first world-10 toy
  openChest(1); Game.chooserIdx = 8; tap(menuPad, "confirm"); step(2);
  openChest(2); Game.chooserIdx = 8; tap(menuPad, "confirm"); step(2);
  check("bubblegum stacks to a 3-heart buffer (not an action power)",
        P().bubble === 3 && !P().powers.includes("bubble"), "bubble=" + P().bubble);
  const hb = hurtbox(P());
  check("the bubble becomes the hitbox (bigger & round)", hb.w > P().w && hb.h > P().h, hb.w + "x" + hb.h);
  const hearts0 = P().hearts;
  P().iframes = 0; hurtPlayer(P(), P().x + 40); step(2);
  check("a hit pops one bubble, sparing a heart", P().bubble === 2 && P().hearts === hearts0);
  // STICKY HAND: an action power that snaps out
  openChest(3); Game.chooserIdx = 9; tap(menuPad, "confirm"); step(2);
  check("sticky hand is an action power", P().powers.includes("sticky"));
  P().iframes = 9999; P().stickyCD = 0; tap(pads[0], "action"); step(2);
  check("the sticky hand snaps out", Combat.stickyHands.length >= 1);
  // MERMAID SHELL: a lobbed-arc projectile
  openChest(4); Game.chooserIdx = 10; tap(menuPad, "confirm"); step(2);
  P().shellCD = 0; tap(pads[0], "action"); step(2);
  check("the mermaid shell lobs an arc", projectiles.some(pr => pr.kind === "shell"));
  // EGG-A-RANG: an orbiting boomerang
  openChest(5); Game.chooserIdx = 11; tap(menuPad, "confirm"); step(2);
  P().eggCD = 0; tap(pads[0], "action"); step(2);
  check("the egg-a-rang orbits", Combat.eggs.length >= 1);
  // THE BIG GUY UPSTAIRS — looks terrifying, dies in three
  const big = Bosses.units[0];
  check("the giant boss is present (we only see his feet)",
        big && big.sub === "giant" && big.maxHp === T.GIANT_HP, big ? big.sub : "none");
  for (let i = 0; i < 12; i++) { P().x = 1650; P().y = 90; P().vx = 0; P().vy = 0; P().iframes = 9999; step(); if (Game.state === "card") { tap(menuPad, "confirm"); step(); } }
  check("the giant reveals once you cross the gate", Bosses.activated);
  let stubs = 0;
  for (let i = 0; i < 500 && big.hp > 0; i++) {
    if (Game.state === "card") { tap(menuPad, "confirm"); step(); continue; }
    P().x = 1650; P().y = 90; P().iframes = 9999;
    if (big.iframes <= 0) { Bosses.hitByBox({ x: big.x, y: big.y, w: big.w, h: big.h }, 1); stubs++; }
    step();
  }
  check("three toy-pokes fell the giant", big.hp <= 0 && stubs === T.GIANT_HP, "stubs=" + stubs + " hp=" + big.hp);
  let trophy10 = null;
  for (let i = 0; i < 500 && !trophy10; i++) { if (Game.state === "card") tap(menuPad, "confirm"); step(); trophy10 = World.pickups.find(pk => pk.type === "trophy"); }
  check("the giant storms off and the world clears (trophy)", !!trophy10);

  /* ============ L11: THE LONG WAY UP — the furious slamming foot ============ */
  await gotoLevel(11); step(10);
  check("L11 THE LONG WAY UP loads (tall)", level.name === "THE LONG WAY UP" && level.grid.length >= 60,
        level.name + "/" + level.grid.length);
  check("L11 is thick with bugs (30+ flyers)",
        enemies.filter(e => e.type === "fly" || e.type === "wisp").length >= 30,
        enemies.filter(e => e.type === "fly" || e.type === "wisp").length);
  const foot = Bosses.units[0];
  check("the colossus foot looms", foot && foot.sub === "colossus", foot ? foot.sub : "none");
  for (let i = 0; i < 5; i++) { P().x = 3 * 16; P().y = 58 * 16; P().iframes = 9999; step(); }
  check("the foot wakes at once (the rematch is on)", Bosses.activated);
  // armored in mid-air — only hittable in the brief beat it's planted
  foot.state = "hover"; foot.iframes = 0; const hp0 = foot.hp;
  Bosses.hitByBox({ x: foot.x, y: foot.y, w: foot.w, h: foot.h }, 3);
  check("the foot shrugs off hits while airborne", foot.hp === hp0, foot.hp + "/" + hp0);
  foot.state = "planted"; foot.iframes = 0;
  Bosses.hitByBox({ x: foot.x, y: foot.y, w: foot.w, h: foot.h }, 3);
  check("a PLANTED foot can be hit", foot.hp < hp0, foot.hp + "/" + hp0);
  let safety = 0;
  while (foot.hp > 0 && safety++ < 60) { foot.state = "planted"; foot.iframes = 0; Bosses.hitByBox({ x: foot.x, y: foot.y, w: foot.w, h: foot.h }, 3); }
  check("the furious foot can (barely) be beaten", foot.hp <= 0, foot.hp);
  let trophy11 = null;
  for (let i = 0; i < 500 && !trophy11; i++) { if (Game.state === "card") tap(menuPad, "confirm"); P().x = 14 * 16; P().y = 6 * 16; P().iframes = 9999; step(); trophy11 = World.pickups.find(pk => pk.type === "trophy"); }
  check("beating the foot clears the climb (summit trophy)", !!trophy11);

  /* ============ L12: THE BIGGEST DREAM — the whole big guy (the finale boss) ============ */
  await gotoLevel(12); step(10);
  check("L12 THE BIGGEST DREAM loads (the finale)",
        level.name === "THE BIGGEST DREAM" && level.world === 12 && level.finale === true, level.name);
  const guy = Bosses.units[0];
  check("the WHOLE big guy is here", guy && guy.sub === "bigguy", guy ? guy.sub : "none");
  Game.stars = 0;                                        // don't trip a chest open while we drive the fight
  for (let i = 0; i < 6; i++) { P().x = 5 * 16; P().y = 26 * 16; P().iframes = 9999; step(); if (Game.state === "card") tap(menuPad, "confirm"); }
  check("the big guy wakes for the finale", Bosses.activated);
  guy.state = "taunt"; guy.iframes = 0; const ghp0 = guy.hp;
  Bosses.hitByBox({ x: guy.x, y: guy.y, w: guy.w, h: guy.h }, 3);
  check("his face is armored while taunting up high", guy.hp === ghp0, guy.hp + "/" + ghp0);
  guy.state = "dip"; guy.iframes = 0;
  Bosses.hitByBox({ x: guy.x, y: guy.y, w: guy.w, h: guy.h }, 3);
  check("his DIPPED face can be hit", guy.hp < ghp0, guy.hp + "/" + ghp0);
  let gs = 0;
  while (guy.hp > 0 && gs++ < 80) { guy.state = "dip"; guy.iframes = 0; Bosses.hitByBox({ x: guy.x, y: guy.y, w: guy.w, h: guy.h }, 3); }
  check("the big guy can be defeated", guy.hp <= 0);
  let beads12 = null;
  for (let i = 0; i < 500 && !beads12; i++) { if (Game.state === "card") tap(menuPad, "confirm"); P().x = 5 * 16; P().y = 26 * 16; P().iframes = 9999; step(); beads12 = World.pickups.find(pk => pk.type === "beads"); }
  check("beating the finale boss drops the GOLD BEADS (not a plain trophy)", !!beads12);

  /* ============ level data integrity: rectangular grids, in-range tiles ============ */
  // (a jagged row makes grid[y][x] undefined -> drawTiles crashes once it scrolls on-screen)
  for (let i = 1; i <= T.WORLD_COUNT; i++) {
    const L = await (await fetch("levels/level" + i + ".json")).json();
    const w0 = L.grid[0].length;
    check("level" + i + " grid is rectangular",
          L.grid.every(r => r.length === w0), [...new Set(L.grid.map(r => r.length))].join(","));
    let oob = 0;
    for (const row of L.grid) for (const t of row) if (t >= 0 && L.tileNames[t] == null) oob++;
    check("level" + i + " tiles all within tileNames", oob === 0, oob + " out-of-range");
  }

  /* ============ the finale path (gated code: beads -> ending -> credits -> scores) ============ */
  await gotoLevel(12); Bosses.spawn(); step(5);          // L12 IS the finale (finale:true); clear the boss, then drop the beads
  level.finale = true;
  World.spawnTrophy("beads");
  const beads = World.pickups.find(pk => pk.type === "beads");
  check("finale: the gold beads appear", !!beads);
  const scorePre = Game.score;
  P().x = beads.x; P().y = beads.y - 6; P().vx = 0; P().vy = 0; P().iframes = 0; step(4);
  check("beads pay TEN MILLION points", Game.score >= scorePre + T.POINTS_FINALE);
  check("the ending begins (turtles)", Game.state === "ending");
  step(340); tap(menuPad, "confirm"); step(2);
  check("credits roll", Game.state === "credits");
  tap(menuPad, "confirm"); step(2);
  check("final store opens", Game.state === "store");
  tap(menuPad, "confirm"); step(1);
  for (let i = 0; i < 27; i++) { tap(menuPad, "right"); step(1); }
  tap(menuPad, "confirm"); step(2);
  check("final world records into the hall of dreamers", Game.state === "scores" && save.highScores.length >= 2,
        Game.state);
  tap(menuPad, "confirm"); step(2);
  check("back to title; the dream can begin again", Game.state === "title");

  /* ============ co-op ============ */
  await gotoLevel(1); step(5);
  joinP2(); step(2);
  check("charmgirl drops in", coop && players.length === 2 && players[1].character === "charmgirl");
  grantMoon(players[1]); step(2);
  check("moonlight makes her a T-REX", players[1].form === "trex");
  players[1].moonTimer = 1; step(2);
  check("the moon sets; small again", players[1].form === "charmgirl");
  players[0].hearts = 1; players[0].iframes = 0; players[0].stack = []; players[0].bubble = 0;
  hurtPlayer(players[0], players[0].x + 50); step(2);
  check("P1 down but P2 keeps the dream alive", players[0].dead && Game.state === "play");
  let revived = false;
  for (let i = 0; i < 200; i++) { step(); if (!players[0].dead) { revived = true; break; } }
  check("fallen player respawns beside the buddy", revived);

  /* ====== the bad dreams, configured by a level: bigger / tougher / half-health sweep ====== */
  releaseAll();
  Bosses.spawn({ type: "badcode", x: 600, y: 200, hp: 65, size: 64, sweep: true,
                 dialogue: ['"DROWNED."', "", '"STILL."'] });
  let bc = Bosses.units[0];
  check("badcode honors spec size", bc.w === 64 && bc.h === 64, bc.w + "x" + bc.h);
  check("badcode honors spec hp", bc.maxHp === 65 && bc.hp === 65, bc.hp + "/" + bc.maxHp);
  for (let i = 0; i < 120 && bc.state !== "chase"; i++) {            // activate -> drop -> (dialogue card) -> chase
    P().x = 700; P().y = 200; P().iframes = 9999;
    if (Game.state === "card") tap(menuPad, "confirm");
    step();
  }
  check("badcode wakes and chases (phase 1)",
        Bosses.activated && bc.phase === 1 && bc.state === "chase", bc.state + "/p" + bc.phase);
  bc.hp = bc.maxHp / 2 - 1;                                          // shove it past half health
  for (let i = 0; i < 50 && bc.state !== "sweep"; i++) { P().x = 700; P().y = 200; P().iframes = 9999; step(); }
  check("at half health it becomes a sweeping sphere (phase 2)",
        bc.phase === 2 && bc.state === "sweep", bc.state + "/p" + bc.phase);
  const sx0 = bc.x;
  for (let i = 0; i < 20; i++) { P().x = 700; P().y = 200; P().iframes = 9999; step(); }
  check("the sphere actually sweeps (carries across)", Math.abs(bc.x - sx0) > 1, (bc.x - sx0).toFixed(1));
  // a plain badcode (no level overrides) keeps the classic size, hp, and behavior
  Bosses.spawn({ type: "badcode", x: 600, y: 200 });
  bc = Bosses.units[0];
  check("plain badcode stays 44px / default hp / no sweep",
        bc.w === 44 && bc.maxHp === T.BADCODE_HP && !bc.sweep);

  console.log("\n" + passCount + " passed, " + failCount + " failed");
  process.exit(failCount ? 1 : 0);
}
main().catch(e => { console.error("HARNESS CRASH:", e); process.exit(2); });
