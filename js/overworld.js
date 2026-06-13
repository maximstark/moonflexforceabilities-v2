"use strict";
/* =====================================================================
 *  OVERWORLD — a Super Mario World-style map level-select (v1).
 *  Replaces the tall-house hub for navigation: walk the swan token L/R
 *  along *unlocked* paths and press to dive into a world. The tall house
 *  becomes the Trophy Room, reached from the HOME node.
 *  Draws with primitives over the hub sky — no new art needed for v1.
 * ===================================================================== */
const Overworld = (() => {
  const NODES = [
    { id: "home", x: 34,  y: 190, label: "HOME · TROPHY ROOM" },
    { id: 1, x: 92,  y: 158, label: "1   THE DREAM LAKE" },
    { id: 2, x: 142, y: 190, label: "2   MOONLIGHT LAKE" },
    { id: 3, x: 196, y: 150, label: "3   THE DEEP" },
    { id: 4, x: 250, y: 186, label: "4   CANDY CLOUDS" },
    { id: 5, x: 302, y: 140, label: "5   THE FEVER SWARM" },
    { id: 6, x: 350, y: 172, label: "6   THE BIG HOG DOG" },
  ];
  let idx = 1, tx = NODES[1].x, ty = NODES[1].y;
  let moving = false, from = 1, to = 1, mt = 0, fr = 0;

  const lvl = n => (n.id === "home" ? 0 : n.id);               // home is always reachable
  const nodeOpen = i => NODES[i].id === "home" || NODES[i].id <= save.unlocked;
  // path i links node i and i+1; open once the higher world on it is unlocked
  const pathOpen = i => Math.max(lvl(NODES[i]), lvl(NODES[i + 1])) <= save.unlocked;

  function enter(nodeId) {
    let i = NODES.findIndex(n => n.id === nodeId);
    if (i < 0) i = 1;
    idx = i; tx = NODES[i].x; ty = NODES[i].y; moving = false;
  }
  function step(dir) {
    const j = idx + dir;
    if (j < 0 || j >= NODES.length) return;
    if (!pathOpen(Math.min(idx, j))) { AudioSys.sfx("refund"); return; }
    from = idx; to = j; mt = 0; moving = true; AudioSys.sfx("jump");
  }

  function update() {
    fr++;
    if (moving) {
      mt = Math.min(1, mt + 0.1);
      const a = NODES[from], b = NODES[to];
      tx = a.x + (b.x - a.x) * mt; ty = a.y + (b.y - a.y) * mt;
      if (mt >= 1) { moving = false; idx = to; }
      return;
    }
    if (menuPad.pressed.has("left") || menuPad.pressed.has("up")) step(-1);
    else if (menuPad.pressed.has("right") || menuPad.pressed.has("down")) step(1);
    else if (menuPad.pressed.has("confirm")) {
      const n = NODES[idx];
      AudioSys.sfx("door");
      if (n.id === "home") Game.state = "trophy";
      else Game.enterLevel(n.id);
    }
  }
  function updateTrophy() {
    fr++;
    if (menuPad.pressed.has("confirm") || menuPad.pressed.has("pause")) Game.state = "map";
  }

  /* ---------------- draw ---------------- */
  function draw() {
    drawStretched("sky_hub", "g", 0, 0, T.VIEW_W, T.VIEW_H);
    if (sheets["par_hub"]) for (let x = 0; x < T.VIEW_W; x += 192) drawFrame("par_hub", "s", x, T.VIEW_H - 90);
    for (let i = 0; i < NODES.length - 1; i++) drawPath(NODES[i], NODES[i + 1], pathOpen(i));
    for (let i = 0; i < NODES.length; i++) drawNode(NODES[i], nodeOpen(i), i === idx);
    const bob = Math.sin(fr / 8) * 1.5;
    drawFrame("swan", moving ? ((fr >> 3) % 2 ? "walk2" : "walk1") : "idle",
              Math.round(tx - 20), Math.round(ty - 32 + bob), to < from);
    // banner
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(20,14,30,0.55)"; ctx.fillRect(0, 3, T.VIEW_W, 27);
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 11px monospace";
    ctx.fillText("CHOOSE YOUR DREAM", T.VIEW_W / 2, 15);
    ctx.font = "8px monospace"; ctx.fillStyle = "#fff6d8";
    ctx.fillText(NODES[idx].label, T.VIEW_W / 2, 27);
    if ((fr >> 4) % 2) {
      ctx.fillStyle = "#9fe8a0"; ctx.font = "8px monospace";
      ctx.fillText("← →  WALK      X / ENTER  GO IN", T.VIEW_W / 2, T.VIEW_H - 8);
    }
    ctx.textAlign = "left";
  }
  function drawPath(a, b, open) {
    for (let k = 1; k < 10; k++) {
      const x = a.x + (b.x - a.x) * k / 10, y = a.y + (b.y - a.y) * k / 10;
      ctx.fillStyle = open ? "#e8c878" : "#4a4458";
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }
  function drawNode(n, open, cur) {
    const x = n.x, y = n.y;
    if (cur) {
      ctx.strokeStyle = "#ffe48a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 9 + Math.sin(fr / 6), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "#241a30"; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = open ? (n.id === "home" ? "#9ad0ff" : n.id === 6 ? "#ff7ab0" : "#ffd96a") : "#5a5470";
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#241a30";
    ctx.fillText(n.id === "home" ? "H" : open ? String(n.id) : "×", x, y + 2);
    ctx.textAlign = "left";
  }
  function drawTrophy() {
    drawStretched("sky_hub", "g", 0, 0, T.VIEW_W, T.VIEW_H);
    ctx.fillStyle = "rgba(12,10,20,0.62)"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe48a"; ctx.font = "bold 13px monospace";
    ctx.fillText("THE TROPHY ROOM", T.VIEW_W / 2, 34);
    ctx.font = "8px monospace"; ctx.fillStyle = "#b9b2d8";
    ctx.fillText("(the room is always neat)", T.VIEW_W / 2, 48);
    const babies = save.babies.filter(b => b).length;
    drawFrame("babyswan", (fr >> 4) % 2 ? "bob2" : "bob1", T.VIEW_W / 2 - 78, 64);
    ctx.fillStyle = "#fff6d8"; ctx.font = "9px monospace";
    ctx.fillText("BABY SWANS RESCUED:  " + babies + " / 5", T.VIEW_W / 2, 74);
    if (save.unlocked >= 6) {
      drawFrame("items", "beads", T.VIEW_W / 2 - 8, 90);
      ctx.fillStyle = "#ffd96a"; ctx.fillText("THE GOLD MEDAL  —  you did it!", T.VIEW_W / 2, 116);
    } else {
      ctx.fillStyle = "#7a7490"; ctx.fillText("the gold medal waits at the end...", T.VIEW_W / 2, 108);
    }
    ctx.fillStyle = "#e8d8f8"; ctx.font = "8px monospace";
    ctx.fillText("BEST: " + (save.best || 0).toLocaleString(), T.VIEW_W / 2, 132);
    (save.highScores || []).slice(0, 5).forEach((h, i) =>
      ctx.fillText((i + 1) + ". " + h.name + "   " + h.score, T.VIEW_W / 2, 148 + i * 12));
    if ((fr >> 4) % 2) { ctx.fillStyle = "#ffe48a"; ctx.fillText("ENTER / X  —  BACK TO THE MAP", T.VIEW_W / 2, T.VIEW_H - 10); }
    ctx.textAlign = "left";
  }

  return { enter, update, updateTrophy, draw, drawTrophy };
})();
