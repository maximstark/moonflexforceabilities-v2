"use strict";
/* =====================================================================
 *  SHELL — the NEMTENBO handheld. On-screen buttons feed the very same
 *  input buses as the keyboard (core.js pads + menuPad), so touch and
 *  click play identically. Multi-touch works: each button captures its
 *  own pointer, so "move + jump" is two fingers, no conflict.
 * ===================================================================== */
(() => {
  // button -> { pad: gameplay action, menu: ui action }
  const MAP = {
    up:    { pad: "jump",   menu: "up" },
    down:  { pad: "down",   menu: "down" },
    left:  { pad: "left",   menu: "left" },
    right: { pad: "right",  menu: "right" },
    a:     { pad: "jump",   menu: "confirm" },   // A = jump / OK
    b:     { pad: "action", menu: "rub" },       // B = X-action / delete-in-store
    select:{ pad: "transform" },                 // the invisible phone
    run:   { pad: "run" },                        // hold to dash (SMW-style)
    mute:  { menu: "mute" },
    // START is contextual (handled in press/release)
  };

  function press(btn) {
    AudioSys.init();                             // first gesture unlocks WebAudio
    if (btn === "start") {                        // pause while playing, else confirm
      const m = (Game.state === "play" || Game.state === "pause") ? "pause" : "confirm";
      menuPad.held[m] = true; menuPad.pressed.add(m);
      return;
    }
    const m = MAP[btn]; if (!m) return;
    if (m.pad)  { pads[0].held[m.pad]  = true; pads[0].pressed.add(m.pad); }
    if (m.menu) { menuPad.held[m.menu] = true; menuPad.pressed.add(m.menu); }
  }
  function release(btn) {
    if (btn === "start") { menuPad.held.pause = false; menuPad.held.confirm = false; return; }
    const m = MAP[btn]; if (!m) return;
    if (m.pad)  pads[0].held[m.pad]  = false;
    if (m.menu) menuPad.held[m.menu] = false;
  }

  document.querySelectorAll("[data-btn]").forEach(el => {
    const btn = el.dataset.btn;
    const down = e => {
      e.preventDefault();
      el.classList.add("on");
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      press(btn);
    };
    const up = e => { e.preventDefault(); el.classList.remove("on"); release(btn); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("contextmenu", e => e.preventDefault());
  });

  // the D-pad behaves like a thumb-stick: press anywhere in the cross and drag.
  // Direction is the offset from the pad's centre (8-way), held while held — so
  // you can press-and-slide between directions instead of stabbing tiny buttons.
  (function () {
    const dpad = document.getElementById("dpad");
    if (!dpad) return;
    const DIRS = ["left", "right", "up", "down"];
    let stick = null;                            // { id, cx, cy, dz, on:Set }
    const mark = (d, on) => { const el = dpad.querySelector("." + d); if (el) el.classList.toggle("on", on); };
    function apply(want) {
      for (const d of DIRS) {
        const has = stick.on.has(d);
        if (want.has(d) && !has) { press(d); stick.on.add(d); mark(d, true); }
        else if (!want.has(d) && has) { release(d); stick.on.delete(d); mark(d, false); }
      }
    }
    function read(e) {
      const dx = e.clientX - stick.cx, dy = e.clientY - stick.cy, dz = stick.dz, w = new Set();
      if (dx < -dz) w.add("left"); else if (dx > dz) w.add("right");
      if (dy < -dz) w.add("up");   else if (dy > dz) w.add("down");
      apply(w);
    }
    const end = () => { if (stick) { apply(new Set()); stick = null; } };
    dpad.addEventListener("pointerdown", e => {
      e.preventDefault(); AudioSys.init();
      const r = dpad.getBoundingClientRect();
      stick = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2,
                dz: r.width * 0.16, on: new Set() };
      try { dpad.setPointerCapture(e.pointerId); } catch (_) {}
      read(e);
    });
    dpad.addEventListener("pointermove", e => { if (stick && e.pointerId === stick.id) read(e); });
    dpad.addEventListener("pointerup", end);
    dpad.addEventListener("pointercancel", end);
    dpad.addEventListener("lostpointercapture", end);
    dpad.addEventListener("contextmenu", e => e.preventDefault());
  })();

  // scale the whole handheld to fill the viewport (height- or width-bound,
  // whichever is tighter) keeping a small buffer, re-fit on resize/rotate
  function fitToScreen() {
    const c = document.getElementById("cabinet");
    if (!c) return;
    const buffer = 0.97;                         // small margin around the edges
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const foot = document.getElementById("kbd"); // leave room for the footer hint
    const reserve = (foot && getComputedStyle(foot).display !== "none") ? foot.offsetHeight + 14 : 0;
    const availH = vh - reserve;
    const s = Math.min(vw * buffer / c.offsetWidth, availH * buffer / c.offsetHeight);
    c.style.top = reserve ? (availH / 2) + "px" : "50%";
    c.style.transform = "translate(-50%,-50%) scale(" + s + ")";
  }
  // the hint under the handheld is for keyboards — pointless on touch, so hide
  // it there (which also frees the reserved space back to the screen)
  (function () {
    const k = document.getElementById("kbd");
    if (!k) return;
    if (matchMedia("(pointer:fine)").matches)
      k.textContent = "keyboard: WASD / arrows · space · X · shift · hold C to run — or use the buttons";
    else k.style.display = "none";
  })();
  window.addEventListener("resize", fitToScreen);
  window.addEventListener("orientationchange", fitToScreen);
  fitToScreen();
  requestAnimationFrame(fitToScreen);           // after first paint
  setTimeout(fitToScreen, 250);                 // after late layout settles

  // belt-and-suspenders against mobile zoom/scroll gestures
  ["gesturestart", "gesturechange", "dblclick"].forEach(ev =>
    document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
})();
