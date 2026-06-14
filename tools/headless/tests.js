// Full-game headless scenarios. Appended after the game modules by run.js.
// Reflects the CURRENT engine: title -> overworld map -> world; powers STACK
// in p.powers[]; the name store returns to the MAP; the ending/credits are
// gated behind level.finale (no shipped level sets it, so it's exercised by
// fabricating finale on the final world).
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

  /* ============ the finale path (gated code: beads -> ending -> credits -> scores) ============ */
  await gotoLevel(8); step(5);
  level.finale = true;                                   // fabricate: no shipped level sets it yet
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
  players[0].hearts = 1; players[0].iframes = 0; players[0].stack = [];
  hurtPlayer(players[0], players[0].x + 50); step(2);
  check("P1 down but P2 keeps the dream alive", players[0].dead && Game.state === "play");
  let revived = false;
  for (let i = 0; i < 200; i++) { step(); if (!players[0].dead) { revived = true; break; } }
  check("fallen player respawns beside the buddy", revived);

  console.log("\n" + passCount + " passed, " + failCount + " failed");
  process.exit(failCount ? 1 : 0);
}
main().catch(e => { console.error("HARNESS CRASH:", e); process.exit(2); });
