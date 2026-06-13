"use strict";
/* =====================================================================
 *  UI — HUD, title, pause, treasure chooser, name store, story cards,
 *  the ending, credits, and the iris transition.
 * ===================================================================== */
const UI = (() => {

  /* ---------------- HUD ---------------- */
  function drawHUD() {
    const p1 = players[0];
    for (let i = 0; i < p1.maxHearts; i++)
      drawFrame("hud", i < p1.hearts ? "heart_full" : "heart_empty", 6 + i * 15, 5);
    // happiness
    const panic = Game.happiness <= 0;
    if (!panic || (Game.frame >> 3) % 2) drawFrame("hud", "happy_smiley", 6, 22);
    const segs = Math.min(10, Math.ceil(Game.happiness / 10));
    for (let i = 0; i < segs; i++) drawFrame("hud", "happy_seg", 24 + i * 8, 22);
    if (panic) {
      ctx.fillStyle = (Game.frame >> 3) % 2 ? "#ff7a7a" : "#ffd1d1";
      ctx.font = "8px monospace"; ctx.fillText("PANIC!", 26, 33);
    }
    // score / stars / babies
    ctx.font = "8px monospace"; ctx.fillStyle = "#fff6d8";
    drawFrame("hud", "popcorn", T.VIEW_W - 70, 5);
    ctx.fillText(String(Game.score).padStart(8, "0"), T.VIEW_W - 52, 16);
    drawFrame("hud", "star", T.VIEW_W - 70, 22);
    ctx.fillText("x" + Game.stars, T.VIEW_W - 52, 33);
    drawFrame("items", "baby_icon", T.VIEW_W - 70, 39);
    ctx.fillText("x" + (Game.babiesThisLevel + save.babies.filter(b => b).length), T.VIEW_W - 52, 50);
    // P2 mini
    if (coop && players[1]) {
      drawFrame("items", "charm_icon", T.VIEW_W - 110, 5);
      ctx.fillStyle = "#ffb0c8";
      ctx.fillText("x" + Math.max(0, players[1].hearts), T.VIEW_W - 94, 16);
    }
    // costume stack (top-right under counters)
    const ICON = { goosefeet: ["items","pickup_goosefeet"], laser: ["items","pickup_laser"],
                   kirby: ["items","icon_kirby"], spoon: ["items","pickup_spoon"] };
    p1.stack.forEach((c, i) => { const s = ICON[c]; if (s) drawFrame(s[0], s[1], 6 + i * 14, 38); });
    if (p1.power) drawFrame("items", "icon_" + p1.power, 6 + p1.stack.length * 14 + 4, 38);
    // moon timer
    if (p1.moonTimer > 0) {
      drawFrame("items", "moon", 6, 54);
      ctx.fillStyle = "#fdf3c0";
      ctx.fillRect(24, 58, Math.round(40 * p1.moonTimer / (p1.character === "swan" ? T.MOONFLEX_FRAMES : T.MOON_TREX_FRAMES)), 4);
    }
    // the invisible phone: visible ONLY while transform is held (the joke, made UI law)
    if (pads[0].held.transform || (coop && pads[1] && pads[1].held.transform)) {
      drawFrame("items", "phone", T.VIEW_W / 2 - 8, 30);
      ctx.font = "7px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#d8c8f0";
      ctx.fillText("the unvisible button", T.VIEW_W / 2, 56);
      ctx.fillText(players[0].inWater ? "(press again in water: transform!)" : "(works in water)", T.VIEW_W / 2, 66);
      ctx.textAlign = "left";
    }
    drawBossBar();
    // level name toast
    if (Game.toast > 0) {
      ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = Game.toast > 30 ? "#ffe48a" : "rgba(255,228,138," + Game.toast / 30 + ")";
      ctx.fillText(level.name, T.VIEW_W / 2, 80);
      if (level.world === 0 && save.unlocked > 1) {     // back in the hub with progress
        ctx.font = "8px monospace";
        ctx.fillStyle = Game.toast > 30 ? "#9fe8a0" : "rgba(159,232,160," + Game.toast / 30 + ")";
        ctx.fillText("FLOOR " + save.unlocked + " IS OPEN — RIDE THE ELEVATOR UP", T.VIEW_W / 2, 94);
      }
      ctx.textAlign = "left";
    }
  }
  function drawBossBar() {
    const info = Bosses.barInfo();
    if (!info) return;
    const w = 160, x = T.VIEW_W / 2 - w / 2, y = 8;
    ctx.fillStyle = "rgba(20,12,24,0.8)"; ctx.fillRect(x - 2, y - 2, w + 4, 12);
    const segW = (w - (info.max - 1)) / info.max;
    for (let i = 0; i < info.max; i++) {
      ctx.fillStyle = i < info.cur ? "#ee3f7e" : "#4a2440";
      ctx.fillRect(Math.round(x + i * (segW + 1)), y, Math.ceil(segW), 8);
    }
    ctx.font = "7px monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ffc6dd"; ctx.fillText(info.name, T.VIEW_W / 2, y + 18);
    ctx.textAlign = "left";
  }

  /* ---------------- title ---------------- */
  function drawTitle() {
    drawStretched("sky_lake", "g", 0, 0, T.VIEW_W, T.VIEW_H);
    const off = Math.floor(Game.frame * 0.2) % 192;
    for (let x = -off; x < T.VIEW_W; x += 192) drawFrame("par_lake", "s", x, T.VIEW_H - 110);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(30,16,40,0.45)"; ctx.fillRect(0, 26, T.VIEW_W, 74);
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 17px monospace";
    ctx.fillText("MOONFLEX", T.VIEW_W / 2, 50);
    ctx.fillText("FORCE ABILITIES", T.VIEW_W / 2, 68);
    ctx.font = "8px monospace"; ctx.fillStyle = "#ffd9f0";
    ctx.fillText("a dream made by Josie, age 4", T.VIEW_W / 2, 82);
    ctx.fillText("(now with 100% more everything)", T.VIEW_W / 2, 92);
    // the cast paddles by
    const wob = Math.sin(Game.frame / 24) * 3;
    drawFrame("swan", (Game.frame >> 4) % 2 ? "walk1" : "idle", T.VIEW_W / 2 - 46, 112 + wob);
    drawFrame("charmgirl", (Game.frame >> 4) % 2 ? "walk2" : "idle", T.VIEW_W / 2 + 14, 118 - wob);
    ctx.fillStyle = "#fff6d8"; ctx.font = "9px monospace";
    ctx.fillText("MOVE  WASD / ARROWS", T.VIEW_W / 2, 154);
    ctx.fillText("JUMP  SPACE   ·   tap jump in the air to FLAP", T.VIEW_W / 2, 166);
    ctx.fillText("X  ACTION        SHIFT/E  THE PHONE", T.VIEW_W / 2, 178);
    ctx.fillStyle = "#ffd9f0";
    ctx.fillText("AT HOME:  X up  ·  ↓ down  ·  ↓ at a door to dive in", T.VIEW_W / 2, 190);
    ctx.fillStyle = "#ffb0c8";
    ctx.fillText("RIGHT-SHIFT: CHARMGIRL JOINS     ·     M  MUTE", T.VIEW_W / 2, 202);
    if ((Game.frame >> 4) % 2) {
      ctx.fillStyle = "#ffe48a"; ctx.font = "11px monospace";
      ctx.fillText("PRESS ENTER", T.VIEW_W / 2, 220);
    }
    if (save.highScores.length) {
      ctx.font = "8px monospace"; ctx.fillStyle = "#e8d8f8";
      const h = save.highScores[0];
      ctx.fillText("BEST DREAMER: " + h.name + "  " + h.score, T.VIEW_W / 2, 234);
    }
    ctx.textAlign = "left";
  }

  /* ---------------- pause ---------------- */
  const PAUSE_OPTS = ["KEEP DREAMING", "RESTART THIS DREAM", "WORLD MAP", "MUTE MUSIC", "ERASE ALL DREAMS"];
  function drawPause() {
    ctx.fillStyle = "rgba(12,10,20,0.6)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("PAUSED", T.VIEW_W / 2, 70);
    ctx.font = "9px monospace";
    PAUSE_OPTS.forEach((o, i) => {
      const sel = i === Game.pauseIdx;
      let label = o;
      if (i === 3 && AudioSys.muted) label = "UNMUTE MUSIC";
      if (i === 4 && Game.confirmErase) label = "REALLY ERASE? — CONFIRM";
      ctx.fillStyle = i === 4 ? (sel ? "#ff9a9a" : "#c08a9a") : (sel ? "#ffe48a" : "#b9b2d8");
      ctx.fillText((sel ? "> " : "") + label, T.VIEW_W / 2, 100 + i * 16);
    });
    ctx.textAlign = "left";
  }

  /* ---------------- treasure chooser ---------------- */
  const POWERS = [
    ["fire", "FIRE", "shoot fireballs (X)"],
    ["pink", "PINK", "a pink burst clears the room (X)"],
    ["tree", "TREE", "hold DOWN: root + shoot nuts (X)"],
    ["kirby", "KIRBY COSTUME", "one more flap, very round"],
  ];
  function drawChooser() {
    ctx.fillStyle = "rgba(12,10,20,0.75)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 11px monospace";
    ctx.fillText("THE TREASURE BOX OPENS...", T.VIEW_W / 2, 48);
    ctx.font = "8px monospace"; ctx.fillStyle = "#b9b2d8";
    ctx.fillText("choose a power (this is how you beat that beast)", T.VIEW_W / 2, 62);
    POWERS.forEach((pw, i) => {
      const x = T.VIEW_W / 2 - 132 + i * 68, y = 92;
      const sel = i === Game.chooserIdx;
      ctx.fillStyle = sel ? "#3a2a50" : "#241a34";
      ctx.fillRect(x, y, 60, 64);
      if (sel) { ctx.strokeStyle = "#ffe48a"; ctx.strokeRect(x + 0.5, y + 0.5, 59, 63); }
      drawFrame("items", "icon_" + pw[0], x + 22, y + 8);
      ctx.fillStyle = sel ? "#ffe48a" : "#cabce0"; ctx.font = "7px monospace";
      ctx.fillText(pw[1], x + 30, y + 38);
      if (sel) {
        ctx.fillStyle = "#fff6d8"; ctx.font = "8px monospace";
        ctx.fillText(pw[2], T.VIEW_W / 2, 176);
      }
    });
    ctx.fillStyle = "#b9b2d8"; ctx.font = "8px monospace";
    ctx.fillText("ARROWS + ENTER", T.VIEW_W / 2, 196);
    ctx.textAlign = "left";
  }
  function updateChooser() {
    if (menuPad.pressed.has("left")) Game.chooserIdx = (Game.chooserIdx + 3) % 4;
    if (menuPad.pressed.has("right")) Game.chooserIdx = (Game.chooserIdx + 1) % 4;
    if (menuPad.pressed.has("confirm")) {
      const pw = POWERS[Game.chooserIdx][0];
      const p = Game.chooserFor || players[0];
      if (pw === "kirby") wearCostume(p, "kirby");
      else { p.power = pw; AudioSys.sfx("transform"); World.addFloater(p.x, p.y - 10, pw.toUpperCase() + "!"); }
      Game.state = "play";
    }
  }

  /* ---------------- the name store ---------------- */
  const STORE_GRID = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").concat(["RUB", "END"]);
  const STORE_COLS = 7;
  let store = null;
  function openStore() {
    store = { wallet: Game.score, name: "", cursor: 0, cost: level ? level.letterCost : 100 };
    Game.state = "store";
    AudioSys.playSong("store");
  }
  function updateStore() {
    const s = store;
    if (menuPad.pressed.has("left"))  s.cursor = (s.cursor + STORE_GRID.length - 1) % STORE_GRID.length;
    if (menuPad.pressed.has("right")) s.cursor = (s.cursor + 1) % STORE_GRID.length;
    if (menuPad.pressed.has("up"))    s.cursor = (s.cursor + STORE_GRID.length - STORE_COLS) % STORE_GRID.length;
    if (menuPad.pressed.has("down"))  s.cursor = (s.cursor + STORE_COLS) % STORE_GRID.length;
    if (menuPad.pressed.has("rub")) rub();
    if (menuPad.pressed.has("confirm")) {
      const pick = STORE_GRID[s.cursor];
      if (pick === "END") finalize();
      else if (pick === "RUB") rub();
      else if (s.name.length < T.NAME_MAX_LEN) {
        if (s.wallet >= s.cost) { s.wallet -= s.cost; s.name += pick; AudioSys.sfx("letter"); }
        else finalize();                            // out of points: truncated forever
      }
    }
  }
  function rub() {
    if (store.name.length) { store.name = store.name.slice(0, -1); store.wallet += store.cost; AudioSys.sfx("refund"); }
  }
  function finalize() {
    const name = store.name.length ? store.name : "SWAN";
    Game.score = store.wallet;                       // what you spent is gone. them's the rules
    save.highScores.push({ name, score: store.wallet, world: Game.levelId });
    save.highScores.sort((a, b) => b.score - a.score);
    save.highScores.length = Math.min(save.highScores.length, 8);
    save.best = Math.max(save.best, store.wallet);
    writeSave();
    AudioSys.sfx("win");
    Game.afterStore();
  }
  function drawStore() {
    drawStretched(level ? level.sky : "sky_hub", "g", 0, 0, T.VIEW_W, T.VIEW_H);
    ctx.fillStyle = "rgba(12,10,20,0.7)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    const s = store;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("SPELL YOUR NAME", T.VIEW_W / 2, 28);
    ctx.font = "8px monospace"; ctx.fillStyle = "#b9b2d8";
    ctx.fillText("EACH LETTER COSTS " + s.cost.toLocaleString() + " PTS — WHAT'S LEFT IS YOUR SCORE", T.VIEW_W / 2, 42);
    ctx.fillStyle = "#fff6d8"; ctx.font = "12px monospace";
    ctx.fillText(s.name + (s.name.length < T.NAME_MAX_LEN ? "_" : ""), T.VIEW_W / 2, 64);
    ctx.font = "9px monospace";
    ctx.fillStyle = s.wallet >= s.cost ? "#9fe8a0" : "#ff7a7a";
    ctx.fillText("WALLET: " + s.wallet.toLocaleString(), T.VIEW_W / 2, 80);
    if (s.wallet < s.cost)
      ctx.fillText("OUT OF POINTS — ANY LETTER ENDS IT", T.VIEW_W / 2, 92);
    const gx0 = T.VIEW_W / 2 - (STORE_COLS * 22) / 2 + 11;
    for (let i = 0; i < STORE_GRID.length; i++) {
      const col = i % STORE_COLS, row = Math.floor(i / STORE_COLS);
      const x = gx0 + col * 22, y = 114 + row * 17;
      if (i === s.cursor) { ctx.fillStyle = "#ffe48a"; ctx.fillRect(x - 10, y - 10, 20, 13); }
      ctx.fillStyle = i === s.cursor ? "#16131f" : "#fff6d8";
      ctx.font = STORE_GRID[i].length > 1 ? "7px monospace" : "10px monospace";
      ctx.fillText(STORE_GRID[i], x, y);
    }
    ctx.fillStyle = "#b9b2d8"; ctx.font = "8px monospace";
    ctx.fillText("ARROWS MOVE  ENTER BUY  BACKSPACE REFUND", T.VIEW_W / 2, 198);
    ctx.textAlign = "left";
  }

  /* ---------------- story cards ---------------- */
  function drawCard() {
    ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.textAlign = "center"; ctx.font = "9px monospace";
    const lines = Game.card || [];
    lines.forEach((ln, i) => {
      ctx.fillStyle = i === 0 ? "#ffe48a" : "#e8e0f4";
      ctx.fillText(ln, T.VIEW_W / 2, 86 + i * 16);
    });
    if ((Game.frame >> 4) % 2) {
      ctx.fillStyle = "#b9b2d8"; ctx.font = "8px monospace";
      ctx.fillText("ENTER", T.VIEW_W / 2, 200);
    }
    ctx.textAlign = "left";
  }

  /* ---------------- ending & credits ---------------- */
  function drawEnding() {
    const t = Game.stateTimer;
    drawStretched("sky_lake", "g", 0, 0, T.VIEW_W, T.VIEW_H);
    for (let x = 0; x < T.VIEW_W; x += 192) drawFrame("par_lake", "s", x, T.VIEW_H - 110);
    ctx.fillStyle = "rgba(86,134,219,0.30)";
    ctx.fillRect(0, 190, T.VIEW_W, 50);
    // momma sea turtle and her babies, calm after the storm
    drawFrame("turtles", (Game.frame >> 5) % 2 ? "calm2" : "calm1", T.VIEW_W / 2 - 48, 160);
    // the rescued babies bob on the water
    for (let i = 0; i < 5; i++) {
      const bx = 40 + i * 64 + Math.sin((Game.frame + i * 30) / 30) * 4;
      drawFrame("babyswan", (Game.frame >> 4) % 2 ? "bob2" : "bob1", bx, 176 + Math.sin((Game.frame + i * 50) / 22) * 2);
    }
    drawFrame("items", "beads", T.VIEW_W / 2 - 8, 60 + Math.sin(Game.frame / 20) * 3);
    ctx.textAlign = "center";
    if (t > 60) { ctx.fillStyle = "#ffe48a"; ctx.font = "bold 11px monospace";
      ctx.fillText("THE BABIES ARE SAFE.", T.VIEW_W / 2, 96); }
    if (t > 150) { ctx.fillStyle = "#fff6d8"; ctx.font = "9px monospace";
      ctx.fillText("the big hog dog is very sorry.", T.VIEW_W / 2, 112); }
    if (t > 240) { ctx.fillStyle = "#ffd9f0";
      ctx.fillText("the lake is quiet. the turtles came back.", T.VIEW_W / 2, 128); }
    if (t > 330 && (Game.frame >> 4) % 2) {
      ctx.fillStyle = "#ffe48a"; ctx.fillText("ENTER", T.VIEW_W / 2, 210);
    }
    ctx.textAlign = "left";
  }
  const CREDITS = [
    "MOONFLEXFORCEABILITIES", "",
    "designed by JOSIE, age 4", "",
    "structured by DAD",
    "pixels, code & little bad songs by CLAUDE", "",
    "starring:",
    "THE SWAN  ·  CHARMGIRL", "THE MERMAID  ·  THE MECHA SWAN",
    "the grumpis scrumption family", "(they have a family too)",
    "the big hog dog (we hate him)", "the cat face who was an alligator", "",
    "no babies were stolen permanently", "",
    "thank you for dreaming"
  ];
  function drawCredits() {
    ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    const scroll = Game.stateTimer * 0.4;
    ctx.textAlign = "center";
    CREDITS.forEach((ln, i) => {
      const y = T.VIEW_H + i * 18 - scroll;
      if (y < -10 || y > T.VIEW_H + 10) return;
      ctx.fillStyle = i === 0 ? "#ffe48a" : "#e8e0f4";
      ctx.font = i === 0 ? "bold 12px monospace" : "9px monospace";
      ctx.fillText(ln, T.VIEW_W / 2, y);
    });
    ctx.textAlign = "left";
  }

  /* ---------------- clear tally ---------------- */
  function drawClear() {
    ctx.fillStyle = "rgba(12,10,20,0.55)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.textAlign = "center";
    drawFrame("hud", "trophy", T.VIEW_W / 2 - 8, 64);
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("DREAM CLEAR!", T.VIEW_W / 2, 102);
    ctx.font = "9px monospace"; ctx.fillStyle = "#fff6d8";
    ctx.fillText("SCORE " + Game.score.toLocaleString(), T.VIEW_W / 2, 122);
    if (Game.babiesThisLevel > 0) {
      ctx.fillStyle = "#ffd9f0";
      ctx.fillText("BABY SWANS RESCUED: " + Game.babiesThisLevel, T.VIEW_W / 2, 138);
    }
    ctx.textAlign = "left";
  }

  /* ---------------- scores & iris ---------------- */
  function drawScores() {
    ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.textAlign = "center";
    drawFrame("items", "beads", T.VIEW_W / 2 - 8, 24);
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("HALL OF DREAMERS", T.VIEW_W / 2, 60);
    ctx.font = "9px monospace";
    save.highScores.slice(0, 8).forEach((h, i) => {
      ctx.fillStyle = i === 0 ? "#fff6d8" : "#b9b2d8";
      ctx.fillText((i + 1) + ". " + h.name.padEnd(8, ".") + "  " + String(h.score).padStart(9, "0"),
                   T.VIEW_W / 2, 82 + i * 14);
    });
    if ((Game.frame >> 4) % 2) {
      ctx.fillStyle = "#ffe48a";
      ctx.fillText("ENTER: TITLE", T.VIEW_W / 2, 214);
    }
    ctx.textAlign = "left";
  }
  function drawIris() {
    if (Game.iris <= 0) return;
    const p = players[0];
    const cx = p ? p.x + p.w / 2 - World.camX : T.VIEW_W / 2;
    const cy = p ? p.y + p.h / 2 - World.camY : T.VIEW_H / 2;
    const r = Game.iris * 4.4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.arc(cx, cy, Math.max(0, 440 - r), 0, Math.PI * 2, true);
    ctx.fillStyle = "#16131f"; ctx.fill("evenodd");
    ctx.restore();
  }

  return { drawHUD, drawTitle, drawPause, drawChooser, updateChooser,
           openStore, updateStore, drawStore, drawCard, drawEnding, drawCredits,
           drawClear, drawScores, drawIris, PAUSE_OPTS };
})();
