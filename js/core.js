"use strict";
/* =====================================================================
 *  CORE — canvas, input (two players), assets, save data, helpers
 * ===================================================================== */
const canvas = document.getElementById("game");
canvas.width = T.VIEW_W * T.SCALE;
canvas.height = T.VIEW_H * T.SCALE;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

/* ---------------- input ----------------
 * Solo: arrows AND wasd both drive P1 (plus space/shift/e/x). Hold C to RUN.
 * Co-op: P1 keeps WASD+Space+E/X|F, hold C/Q to run; P2 takes the arrows with
 * RShift jump, RCtrl action, / transform, . run.  P2 joins on RShift.
 */
const K1 = {  // P1 (always)
  KeyA:"left", KeyD:"right", KeyW:"jump", KeyS:"down",
  Space:"jump", KeyE:"transform", ShiftLeft:"transform",
  KeyX:"action", KeyF:"action", KeyC:"run", KeyQ:"run",
};
const K1_SOLO = {  // arrows also drive P1 when no P2
  ArrowLeft:"left", ArrowRight:"right", ArrowUp:"jump", ArrowDown:"down",
};
const K2 = {  // P2 (when joined)
  ArrowLeft:"left", ArrowRight:"right", ArrowUp:"jump", ArrowDown:"down",
  ShiftRight:"jump", ControlRight:"action", Slash:"transform", Period:"run",
};
const KMENU = {  // ui layer (always live)
  ArrowLeft:"left", ArrowRight:"right", ArrowUp:"up", ArrowDown:"down",
  Enter:"confirm", Escape:"pause", Backspace:"rub", KeyM:"mute",
  KeyW:"up", KeyS:"down", KeyA:"left", KeyD:"right", Space:"confirm",
};
const PREVENT = new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space",
                         "Backspace","Slash","Period","Enter"]);

const pads = [ { held:{}, pressed:new Set() }, { held:{}, pressed:new Set() } ];
const menuPad = { held:{}, pressed:new Set() };
let coop = false;
let wantJoin = false;       // RShift pressed while solo

window.addEventListener("keydown", e => {
  if (PREVENT.has(e.code)) e.preventDefault();
  AudioSys.init();
  if (e.repeat) return;
  if (e.code === "ShiftRight" && !coop) wantJoin = true;
  const a1 = K1[e.code] || (!coop && K1_SOLO[e.code]);
  if (a1) { pads[0].held[a1] = true; pads[0].pressed.add(a1); }
  if (coop) { const a2 = K2[e.code]; if (a2) { pads[1].held[a2] = true; pads[1].pressed.add(a2); } }
  const m = KMENU[e.code]; if (m) { menuPad.held[m] = true; menuPad.pressed.add(m); }
});
window.addEventListener("keyup", e => {
  const a1 = K1[e.code] || K1_SOLO[e.code];
  if (a1) pads[0].held[a1] = false;
  const a2 = K2[e.code]; if (a2) pads[1].held[a2] = false;
  const m = KMENU[e.code]; if (m) menuPad.held[m] = false;
});
function clearPressed() {
  pads[0].pressed.clear(); pads[1].pressed.clear(); menuPad.pressed.clear();
  wantJoin = false;
}
// when co-op turns on, release arrow-held P1 movement so P2 takes over clean
function setCoop(on) {
  coop = on;
  if (on) { pads[0].held.left = false; pads[0].held.right = false; }
}

/* ---------------- assets ---------------- */
let sheets = null;
async function loadAssets() {
  const manifest = await (await fetch("assets/manifest.json")).json();
  sheets = {};
  await Promise.all(Object.entries(manifest).map(([name, m]) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      sheets[name] = { img, frame_w: m.frame_w, frame_h: m.frame_h, frames: m.frames,
                       index: Object.fromEntries(m.frames.map((f, i) => [f, i])) };
      res();
    };
    img.onerror = () => rej(new Error("failed: " + m.file));
    img.src = m.file;
  })));
  // tile name -> [sheet, frame] across the three atlases
  TILE_LOOKUP = {};
  for (const sh of ["tiles", "tiles2", "hub"])
    for (const f of sheets[sh].frames) TILE_LOOKUP[f] = sh;
}
let TILE_LOOKUP = null;

function drawFrame(name, frame, x, y, flip = false, flipV = false) {
  const s = sheets[name], i = s.index[frame];
  x = Math.round(x); y = Math.round(y);
  if (!flip && !flipV) {
    ctx.drawImage(s.img, i * s.frame_w, 0, s.frame_w, s.frame_h, x, y, s.frame_w, s.frame_h);
    return;
  }
  ctx.save();
  ctx.translate(x + (flip ? s.frame_w : 0), y + (flipV ? s.frame_h : 0));
  ctx.scale(flip ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(s.img, i * s.frame_w, 0, s.frame_w, s.frame_h, 0, 0, s.frame_w, s.frame_h);
  ctx.restore();
}
function drawStretched(name, frame, x, y, w, h) {
  const s = sheets[name], i = s.index[frame];
  ctx.drawImage(s.img, i * s.frame_w, 0, s.frame_w, s.frame_h, Math.round(x), Math.round(y), w, h);
}

/* ---------------- save data ---------------- */
const SAVE_KEY = "mffa_save_v1";
let save = { unlocked: 1, babies: Array(T.WORLD_COUNT - 1).fill(false), highScores: [], best: 0 };
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.unlocked) save = s; }
  catch (e) { /* fresh start */ }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode: in-memory only */ }
}
function eraseSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  save = { unlocked: 1, babies: Array(T.WORLD_COUNT - 1).fill(false), highScores: [], best: 0 };
}

/* ---------------- helpers ---------------- */
const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => (ax-bx)*(ax-bx) + (ay-by)*(ay-by);
