"use strict";
/* =====================================================================
 *  UI — HUD, title, pause, treasure chooser, name store, story cards,
 *  the ending, credits, and the iris transition.
 * ===================================================================== */
const UI = (() => {

  /* ---------------- shared bits ---------------- */
  // NES-bootleg dialog panel: dark fill, gold frame, corner studs
  function drawPanel(x, y, w, h) {
    ctx.fillStyle = "rgba(16,10,26,0.90)"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe48a"; ctx.lineWidth = 1;
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    ctx.fillStyle = "#ffe48a";
    for (const [px, py] of [[x+1,y+1],[x+w-3,y+1],[x+1,y+h-3],[x+w-3,y+h-3]])
      ctx.fillRect(px, py, 2, 2);
  }
  const h01 = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ---------------- HUD ---------------- */
  let dispScore = 0;                 // the shown score chases the real one
  function drawHUD() {
    const p1 = players[0];
    if (dispScore < Game.score)
      dispScore = Math.min(Game.score, dispScore + Math.max(1, Math.ceil((Game.score - dispScore) * 0.12)));
    else if (dispScore > Game.score) dispScore = Game.score;   // new run: snap down
    for (let i = 0; i < p1.maxHearts; i++) {
      const beat = p1.hearts === 1 && i === 0 ? Math.round(Math.abs(Math.sin(Game.frame / 6)) * 2) : 0;
      drawFrame("hud", i < p1.hearts ? "heart_full" : "heart_empty", 6 + i * 15, 5 - beat);
    }
    for (let i = 0; i < p1.bubble; i++)             // bubblegum buffer hearts, in vibrant pink
      drawBubbleHeart(6 + (p1.maxHearts + i) * 15, 5);
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
    ctx.fillStyle = dispScore < Game.score ? "#ffe48a" : "#fff6d8";   // gold while counting up
    ctx.fillText(String(dispScore).padStart(8, "0"), T.VIEW_W - 52, 16);
    ctx.fillStyle = "#fff6d8";
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
    let ppx = 6 + p1.stack.length * 14 + 4;
    for (const pw of p1.powers) {
      drawPowerIcon(pw, ppx + 8, 46);
      if ((p1.lvl[pw] || 1) >= 2) {                 // a tiny stack badge: x2 / x3
        ctx.font = "6px monospace"; ctx.fillStyle = "#ffe48a"; ctx.textAlign = "left";
        ctx.fillText("x" + p1.lvl[pw], ppx + 11, 54);
      }
      ppx += 14;
    }
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
    // level-name ribbon: slides in, holds, fades out
    if (Game.toast > 0) {
      const slide = Math.min(1, (120 - Game.toast) / 12 + 0.001);
      const fade = Game.toast > 30 ? 1 : Game.toast / 30;
      const y = Math.round(62 - (1 - slide) * 24);
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(16,10,26,0.78)"; ctx.fillRect(0, y, T.VIEW_W, 34);
      ctx.fillStyle = "#ffe48a";
      ctx.fillRect(0, y, T.VIEW_W, 1); ctx.fillRect(0, y + 33, T.VIEW_W, 1);
      ctx.textAlign = "center";
      ctx.font = "7px monospace"; ctx.fillStyle = "#ffd9f0";
      ctx.fillText(typeof Game.levelId === "number" ? "· DREAM " + Game.levelId + " ·" : "· HOME ·",
                   T.VIEW_W / 2, y + 11);
      ctx.font = "bold 12px monospace"; ctx.fillStyle = "#ffe48a";
      ctx.fillText(level.name, T.VIEW_W / 2, y + 25);
      if (level.world === 0 && save.unlocked > 1) {     // back in the hub with progress
        ctx.font = "8px monospace"; ctx.fillStyle = "#9fe8a0";
        ctx.fillText("FLOOR " + save.unlocked + " IS OPEN — RIDE THE ELEVATOR UP", T.VIEW_W / 2, y + 44);
      }
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
  }
  function drawBossBar() {
    const info = Bosses.barInfo();
    if (!info) return;
    const w = 160, x = T.VIEW_W / 2 - w / 2, y = 8;
    drawFrameSized("hud", "boss_frame", x - 8, y - 5, w + 16, 20);
    const fill = Math.round((w - 12) * info.cur / Math.max(1, info.max));
    if (fill > 0) drawFrameSized("hud", "boss_fill", x + 6, y + 1, fill, 6);
    ctx.font = "7px monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ffc6dd"; ctx.fillText(info.name, T.VIEW_W / 2, y + 18);
    ctx.textAlign = "left";
  }

  /* ---------------- title ---------------- */
  function drawTitle() {
    drawStretched("sky_lake", "g", 0, 0, T.VIEW_W, T.VIEW_H);
    // early stars over the lake
    for (let i = 0; i < 20; i++) {
      const tw = Math.abs(Math.sin(Game.frame / 26 + i * 1.7));
      ctx.fillStyle = `rgba(255,246,216,${0.12 + 0.5 * tw})`;
      ctx.fillRect(Math.round(h01(i) * T.VIEW_W), Math.round(h01(i + 41) * 88), 1, 1);
    }
    // two shorelines drifting at different speeds
    const off2 = Math.floor(Game.frame * 0.08) % 192;
    ctx.globalAlpha = 0.45;
    for (let x = -off2 - 96; x < T.VIEW_W; x += 192) drawFrame("par_lake", "s", x, T.VIEW_H - 136);
    ctx.globalAlpha = 1;
    const off = Math.floor(Game.frame * 0.2) % 192;
    for (let x = -off; x < T.VIEW_W; x += 192) drawFrame("par_lake", "s", x, T.VIEW_H - 110);
    ctx.textAlign = "center";
    drawNineSlice('ui_panels', 'title', 8, 17, T.VIEW_W - 16, 91);
    // the logo bobs, letter by letter, with a plum shadow
    ctx.font = "bold 17px monospace";
    const cw = ctx.measureText("M").width;
    const wave = (s, y) => {
      const x0 = T.VIEW_W / 2 - (s.length - 1) * cw / 2;
      for (let i = 0; i < s.length; i++) {
        const wy = Math.sin(Game.frame / 11 + i * 0.7) * 1.6;
        ctx.fillStyle = "#3a1f4a"; ctx.fillText(s[i], x0 + i * cw + 1, y + wy + 2);
        ctx.fillStyle = "#ffe48a"; ctx.fillText(s[i], x0 + i * cw, y + wy);
      }
    };
    wave("MOONFLEX", 50); wave("FORCE ABILITIES", 68);
    if ((Game.frame >> 3) % 5 < 2)      // a passing glint on the frame
      drawFrame("fx", (Game.frame >> 3) % 2 ? "spark1" : "spark2",
                (Game.frame >> 3) % 4 < 2 ? 18 : T.VIEW_W - 34, 28);
    ctx.font = "8px monospace"; ctx.fillStyle = "#ffd9f0";
    ctx.fillText("a dream made by Josie, age 4", T.VIEW_W / 2, 82);
    ctx.fillText("(now with 100% more everything)", T.VIEW_W / 2, 92);
    // the cast paddles by, doubled faintly in the lake
    const wob = Math.sin(Game.frame / 24) * 3;
    const swanF = (Game.frame >> 4) % 2 ? "walk1" : "idle";
    const charmF = (Game.frame >> 4) % 2 ? "walk2" : "idle";
    ctx.globalAlpha = 0.16;
    drawFrameSized("swan", swanF, T.VIEW_W / 2 - 46, 112 + wob + 36, 40, 36, false, true);
    drawFrame("charmgirl", charmF, T.VIEW_W / 2 + 14, 118 - wob + sheets.charmgirl.frame_h, false, true);
    ctx.globalAlpha = 1;
    drawFrameSized("swan", swanF, T.VIEW_W / 2 - 46, 112 + wob, 40, 36);
    drawFrame("charmgirl", charmF, T.VIEW_W / 2 + 14, 118 - wob);
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
    // the little dreamers' badge, up in the quiet corner above the panel
    if (save.gentle) {
      ctx.font = "8px monospace";
      const tw = ctx.measureText("GENTLE DREAMS").width;
      drawBubbleHeart(T.VIEW_W - 8 - tw - 18, 3);
      ctx.textAlign = "right"; ctx.fillStyle = "#ffb0c8";
      ctx.fillText("GENTLE DREAMS", T.VIEW_W - 8, 13);
      ctx.textAlign = "center";
    }
    ctx.textAlign = "left";
  }

  /* ---------------- pause ---------------- */
  const PAUSE_OPTS = ["KEEP DREAMING", "RESTART THIS DREAM", "WORLD MAP", "GENTLE DREAMS", "MUTE MUSIC", "ERASE ALL DREAMS"];
  function drawPause() {
    ctx.fillStyle = "rgba(12,10,20,0.6)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    drawNineSlice('ui_panels', Game.confirmErase ? 'confirm' : 'pause',
                   T.VIEW_W / 2 - 116, 40, 232, 168);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("PAUSED", T.VIEW_W / 2, 70);
    ctx.font = "9px monospace";
    const bounce = Math.round(Math.sin(Game.frame / 8) * 1.5);
    PAUSE_OPTS.forEach((o, i) => {
      const sel = i === Game.pauseIdx;
      let label = o;
      if (i === 3) label = "GENTLE DREAMS " + (save.gentle ? "· ON ·" : "· OFF ·");
      if (i === 4 && AudioSys.muted) label = "UNMUTE MUSIC";
      if (i === 5 && Game.confirmErase) label = "REALLY ERASE? — CONFIRM";
      ctx.fillStyle = i === 5 ? (sel ? "#ff9a9a" : "#c08a9a")
                    : i === 3 && save.gentle ? (sel ? "#ffd9f0" : "#d8a0bc")
                    : (sel ? "#ffe48a" : "#b9b2d8");
      ctx.fillText(label, T.VIEW_W / 2, 92 + i * 16);
      if (sel) {
        ctx.textAlign = "left";
        ctx.fillText("▶", T.VIEW_W / 2 - 92 + bounce, 92 + i * 16);
        ctx.textAlign = "center";
      }
    });
    ctx.textAlign = "left";
  }

  /* ---------------- treasure chooser ---------------- */
  // 4th entry = the world a power first appears in a chest (default 1). The
  // bubblegum/sticky/shell/egg toys unlock at world 10 — the Vampire-Survivors turn.
  const POWERS = [
    ["fire",      "FIRE",         "X: shoot fireballs"],
    ["pink",      "PINK BURST",   "X: clear the room"],
    ["tree",      "TREE NUTS",    "X: throw nuts (hold DOWN to plant)"],
    ["mace",      "SPIN MACE",    "a slow orbiting WMD — no defense"],
    ["laser",     "LASER EYES",   "X: a piercing beam (aim with up/down)"],
    ["spoon",     "GIANT SPOON",  "X: melee swat; deflects mushrooms"],
    ["goosefeet", "GOOSE FEET",   "higher jump; down in mid-air = ground pound"],
    ["kirby",     "KIRBY CAP",    "one extra flap, very round"],
    ["bubble",    "BUBBLEGUM",    "a pink shield — buffer hearts (stack to 3)", 10],
    ["sticky",    "STICKY HAND",  "X: a grabby 45-degree snap (stack to 3)", 10],
    ["shell",     "MERMAID SHELL","X: lob shells up a 60-degree arc (stack to 3)", 10],
    ["egg",       "EGG-A-RANG",   "X: a fried egg loops around you", 10],
  ];
  const STACK_MAX = { bubble: 3, sticky: 3, shell: 3 };   // these climb past the usual mirrored pair
  const COSTUME_PICKS = { kirby: 1, laser: 1, spoon: 1, goosefeet: 1 };
  const PICK_ICON = {
    fire: ["items","icon_fire"], pink: ["items","icon_pink"], tree: ["items","icon_tree"],
    laser: ["items","pickup_laser"], spoon: ["items","pickup_spoon"],
    goosefeet: ["items","pickup_goosefeet"], kirby: ["items","icon_kirby"],
    mace: ["items","mace"], bubble: ["items","bubble"], sticky: ["items","sticky"],
    shell: ["items","shell"], egg: ["items","egg"],
  };
  function visiblePowers() {
    const w = typeof Game.levelId === "number" ? Game.levelId : 1;
    return POWERS.filter(pw => (pw[3] || 1) <= w);
  }
  function drawMaceIcon(cx, cy) {
    ctx.fillStyle = "#9a93b0";
    for (let i = 1; i <= 3; i++) ctx.fillRect(cx - 7 + i * 2, cy + 5 - i * 2, 2, 2);     // chain
    ctx.fillStyle = "#2a2438";
    for (let a = 0; a < 8; a++) { const A = a * Math.PI / 4; ctx.fillRect(Math.round(cx + Math.cos(A) * 6) - 1, Math.round(cy + Math.sin(A) * 6) - 1, 2, 2); }
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = "#4a4458"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 2, 0, Math.PI * 2); ctx.fillStyle = "#8a84a0"; ctx.fill();
  }
  // procedural icons for the toys that have no sprite sheet (centered on cx,cy)
  function drawBubbleIcon(cx, cy) {
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,120,200,0.30)"; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = "#ff5fb0"; ctx.stroke();
    ctx.fillStyle = "#fff0fb"; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  function drawStickyIcon(cx, cy) {
    ctx.strokeStyle = "#ff7ec0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 5, cy + 5); ctx.lineTo(cx + 3, cy - 3); ctx.stroke();
    ctx.fillStyle = "#ff5fb0"; ctx.beginPath(); ctx.arc(cx + 4, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
  }
  function drawShellIcon(cx, cy) {
    ctx.fillStyle = "#ffe7d2"; ctx.beginPath(); ctx.arc(cx, cy + 3, 6, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#d98fb0"; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx, cy + 3); ctx.lineTo(cx + i * 2.4, cy - 3); ctx.stroke(); }
  }
  function drawEggIcon(cx, cy) {
    ctx.fillStyle = "#fff8ef"; ctx.beginPath(); ctx.ellipse(cx, cy, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffba2e"; ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  function drawBubbleHeart(x, y) {                          // a vibrant-pink buffer heart for the HUD
    const cx = x + 7, cy = y + 6;
    ctx.fillStyle = "#ff3ea5";
    ctx.beginPath(); ctx.arc(cx - 3, cy - 1, 3, 0, Math.PI * 2); ctx.arc(cx + 3, cy - 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,205,238,0.95)"; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 1, 0, Math.PI * 2); ctx.fill();
  }
  function drawPowerIcon(pw, cx, cy) {                      // dispatch: (cx,cy) is the icon CENTER
    const ic = PICK_ICON[pw]; if (ic) drawFrame(ic[0], ic[1], cx - 8, cy - 8);
  }
  function drawChooser() {
    ctx.fillStyle = "rgba(12,10,20,0.80)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.globalAlpha = 0.92;
    drawNineSlice('ui_panels', 'chooser', 8, 30, T.VIEW_W - 16, T.VIEW_H - 40);
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 11px monospace";
    ctx.fillText("THE TREASURE BOX OPENS...", T.VIEW_W / 2, 20);
    ctx.font = "8px monospace"; ctx.fillStyle = "#b9b2d8";
    ctx.fillText("pick an ability — they STACK, so grab everything", T.VIEW_W / 2, 32);
    const vis = visiblePowers();
    if (Game.chooserIdx >= vis.length) Game.chooserIdx = 0;
    const cols = 4, rows = Math.ceil(vis.length / cols);
    const bw = 80, gap = 6, pitch = bw + gap;
    const startX = (T.VIEW_W - (cols * pitch - gap)) / 2;
    const top = 40, rowH = rows <= 2 ? 56 : 44, bh = rows <= 2 ? 48 : 38;
    vis.forEach((pw, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = startX + col * pitch, y = top + row * rowH, cx = x + bw / 2;
      const sel = i === Game.chooserIdx;
      ctx.fillStyle = sel ? "#3a2a50" : "#241a34"; ctx.fillRect(x, y, bw, bh);
      if (sel) { ctx.strokeStyle = "#ffe48a"; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1); }
      drawPowerIcon(pw[0], cx, y + 15);
      ctx.fillStyle = sel ? "#ffe48a" : "#cabce0"; ctx.font = "7px monospace";
      ctx.fillText(pw[1], cx, y + bh - 5);
    });
    const descY = top + rows * rowH + 8;
    ctx.fillStyle = "#fff6d8"; ctx.font = "8px monospace";
    ctx.fillText(vis[Game.chooserIdx][2], T.VIEW_W / 2, descY);
    ctx.fillStyle = "#b9b2d8";
    ctx.fillText("ARROWS + ENTER", T.VIEW_W / 2, descY + 14);
    ctx.textAlign = "left";
  }
  function updateChooser() {
    const vis = visiblePowers();
    const n = vis.length;
    if (Game.chooserIdx >= n) Game.chooserIdx = 0;
    if (menuPad.pressed.has("left"))  { Game.chooserIdx = (Game.chooserIdx + n - 1) % n; AudioSys.sfx("menu"); }
    if (menuPad.pressed.has("right")) { Game.chooserIdx = (Game.chooserIdx + 1) % n; AudioSys.sfx("menu"); }
    if (menuPad.pressed.has("up") || menuPad.pressed.has("down")) { Game.chooserIdx = (Game.chooserIdx + 4) % n; AudioSys.sfx("menu"); }
    if (menuPad.pressed.has("confirm")) {
      const pw = vis[Game.chooserIdx][0];
      const p = Game.chooserFor || players[0];
      if (pw === "bubble") {                                     // the shield isn't an action power — it's buffer hearts
        p.bubble = Math.min(T.BUBBLE_MAX, p.bubble + 1);
        AudioSys.sfx("bubble");
        World.addFloater(p.x, p.y - 10, "BUBBLEGUM x" + p.bubble + "!");
      } else if (COSTUME_PICKS[pw]) {
        wearCostume(p, pw);                                      // costumes stack in p.stack
      } else {
        if (!p.powers.includes(pw)) p.powers.push(pw);          // powers stack in p.powers
        p.lvl[pw] = Math.min(STACK_MAX[pw] || 2, (p.lvl[pw] || 0) + 1);
        AudioSys.sfx("transform");
        World.addFloater(p.x, p.y - 10, (p.lvl[pw] >= 2 ? "x" + p.lvl[pw] + " " : "") + pw.toUpperCase() + "!");
      }
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
    ctx.globalAlpha = 0.82;
    drawNineSlice('ui_panels', 'store', 12, 14, T.VIEW_W - 24, T.VIEW_H - 24);
    ctx.globalAlpha = 1;
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
  // typewriter reveal: shown-character budget grows with stateTimer.
  // first ENTER completes the line; the next ENTER turns the page (main.js).
  function cardTotalChars() { return (Game.card || []).join("").length; }
  function cardDone() { return Math.floor(Game.stateTimer * 1.4) >= cardTotalChars(); }
  function cardRevealFrames() { return Math.ceil(cardTotalChars() / 1.4); }
  function drawCard() {
    ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    // faint drifting motes so the dark screen still dreams
    for (let i = 0; i < 10; i++) {
      const tw = Math.abs(Math.sin(Game.frame / 30 + i * 2.3));
      ctx.fillStyle = `rgba(216,200,240,${0.06 + tw * 0.10})`;
      ctx.fillRect(Math.round(h01(i + 7) * T.VIEW_W),
                   Math.round((h01(i + 91) * T.VIEW_H + Game.frame * 0.1) % T.VIEW_H), 1, 1);
    }
    const lines = Game.card || [];
    const ph = Math.max(90, lines.length * 16 + 52);
    drawNineSlice('ui_panels', 'story', 18, T.VIEW_H / 2 - ph / 2 - 8, T.VIEW_W - 36, ph + 16);
    ctx.textAlign = "center"; ctx.font = "9px monospace";
    let budget = Math.floor(Game.stateTimer * 1.4);
    const y0 = T.VIEW_H / 2 - ph / 2 + 30;
    lines.forEach((ln, i) => {
      const shown = budget > 0 ? ln.slice(0, budget) : "";
      budget -= ln.length;
      ctx.fillStyle = i === 0 ? "#ffe48a" : "#e8e0f4";
      ctx.fillText(shown, T.VIEW_W / 2, y0 + i * 16);
    });
    if (cardDone() && (Game.frame >> 4) % 2) {
      ctx.fillStyle = "#b9b2d8"; ctx.font = "8px monospace";
      ctx.fillText("ENTER ▸", T.VIEW_W / 2, T.VIEW_H / 2 + ph / 2 - 12);
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
    // the quiet sky celebrates
    for (let i = 0; i < 14; i++) {
      const tw = Math.abs(Math.sin(Game.frame / 22 + i * 2.3));
      ctx.fillStyle = `rgba(255,246,216,${0.1 + tw * 0.45})`;
      ctx.fillRect(Math.round(h01(i + 29) * T.VIEW_W),
                   Math.round((h01(i + 63) * 150 + Game.frame * 0.06) % 150), 1, 1);
    }
    drawFrame("items", "beads", T.VIEW_W / 2 - 8, 60 + Math.sin(Game.frame / 20) * 3);
    ctx.textAlign = "center";
    if (t > 60) { ctx.fillStyle = "#ffe48a"; ctx.font = "bold 11px monospace";
      ctx.fillText("THE BABIES ARE SAFE.", T.VIEW_W / 2, 96); }
    if (t > 150) { ctx.fillStyle = "#fff6d8"; ctx.font = "9px monospace";
      ctx.fillText("every big bad dream is over now.", T.VIEW_W / 2, 112); }
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
    "the big hog dog (we hate him)", "the cat face who was an alligator",
    "the big guy upstairs (nice sandals)", "",
    "no babies were stolen permanently", "",
    "thank you for dreaming"
  ];
  function drawCredits() {
    ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.globalAlpha = 0.72;
    drawNineSlice('ui_panels', 'credits', T.VIEW_W / 2 - 108, 8, 216, T.VIEW_H - 16);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {                    // the night sky applauds
      const tw = Math.abs(Math.sin(Game.frame / 24 + i * 2.1));
      ctx.fillStyle = `rgba(232,224,255,${0.08 + tw * 0.25})`;
      ctx.fillRect(Math.round(h01(i + 13) * T.VIEW_W), Math.round(h01(i + 77) * T.VIEW_H), 1, 1);
    }
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
    drawNineSlice('ui_panels', 'clear', T.VIEW_W / 2 - 102, 38, 204, 126);
    ctx.textAlign = "center";
    const hop = Math.round(Math.abs(Math.sin(Game.frame / 12)) * -3);
    drawFrame("hud", "trophy", T.VIEW_W / 2 - 8, 60 + hop);
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("DREAM CLEAR!", T.VIEW_W / 2, 98);
    ctx.font = "9px monospace";
    ctx.fillStyle = dispScore < Game.score ? "#ffe48a" : "#fff6d8";
    ctx.fillText("SCORE " + dispScore.toLocaleString(), T.VIEW_W / 2, 118);
    if (Game.babiesThisLevel > 0) {
      ctx.fillStyle = "#ffd9f0";
      ctx.fillText("BABY SWANS RESCUED: " + Game.babiesThisLevel, T.VIEW_W / 2, 134);
    }
    ctx.textAlign = "left";
  }

  /* ---------------- scores & iris ---------------- */
  function drawScores() {
    ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.globalAlpha = 0.68;
    drawNineSlice('ui_panels', 'credits', T.VIEW_W / 2 - 110, 8, 220, T.VIEW_H - 16);
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    drawFrame("items", "beads", T.VIEW_W / 2 - 8, 24);
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 12px monospace";
    ctx.fillText("HALL OF DREAMERS", T.VIEW_W / 2, 60);
    ctx.font = "9px monospace";
    const medal = ["#ffd96a", "#cfd4e8", "#e0a35f"];
    save.highScores.slice(0, 8).forEach((h, i) => {
      ctx.fillStyle = medal[i] || "#b9b2d8";
      ctx.fillText((i + 1) + ". " + h.name.padEnd(8, ".") + "  " + String(h.score).padStart(9, "0"),
                   T.VIEW_W / 2, 82 + i * 14);
      if (i === 0 && (Game.frame >> 4) % 2)
        drawFrame("fx", "spark1", T.VIEW_W / 2 - 92, 74);
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
           openStore, updateStore, drawStore, drawCard, cardDone, cardRevealFrames, drawEnding, drawCredits,
           drawClear, drawScores, drawIris, PAUSE_OPTS };
})();
