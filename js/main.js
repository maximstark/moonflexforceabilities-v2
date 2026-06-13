"use strict";
/* =====================================================================
 *  MAIN — game state machine + fixed 60 Hz loop.
 *  States: loading title play pause chooser card clear store dying
 *          ending credits scores
 *  ("play" covers the hub too — the house is just a calm level.)
 * ===================================================================== */
const Game = {
  state: "loading", stateTimer: 0, frame: 0,
  levelId: null, score: 0, stars: 0, happiness: 100, babiesThisLevel: 0,
  shake: 0, hitstop: 0, toast: 0, iris: 0,
  pauseIdx: 0, chooserIdx: 0, chooserFor: null, confirmErase: false,
  card: null, cardQueue: [],
  pendingLevel: null,

  queueCard(lines) { this.cardQueue.push(lines); },

  async boot() {
    loadSave();
    await Promise.all([loadAssets(), World.loadLevel("hub")]);  // warm the cache
    // dev hook: index.html?level=3 (or ?level=hub) drops straight into a world
    const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
    const want = params && params.get("level");
    if (want) {
      save.unlocked = 6;
      this.newRun();
      if (want === "map") {
        this.toMap(1);
      } else {
        await this.enterLevel(want === "hub" ? "hub" : parseInt(want));
        this.iris = 0; this.toast = 0;        // dev drop-in: no wipe, no toast
      }
    } else {
      this.state = "title";
    }
  },
  newRun() {
    this.score = 0; this.stars = 0;
    players = [makePlayer(0, "swan")];
    if (coop) players.push(makePlayer(1, "charmgirl"));
  },
  async enterLevel(id) {
    this.iris = 100;
    this.state = "loading";
    await World.loadLevel(id);
    this.state = "play";
    this.toast = 120;
    this.iris = 100;                       // iris back in
  },
  afterStore() {
    if (this.levelId === 6) this.state = "scores";
    else this.toMap(this.levelId);
  },
  toMap(nodeId) {
    Overworld.enter(nodeId == null ? 1 : nodeId);
    this.state = "map"; this.iris = 0; this.toast = 0;
  },
};

function joinP2() {
  if (coop) return;
  setCoop(true);
  const p2 = makePlayer(1, "charmgirl");
  const p1 = players[0];
  p2.x = p1.x; p2.y = p1.y - 20; p2.lastSafeX = p1.x; p2.lastSafeY = p1.y;
  players.push(p2);
  if (Game.state === "play") {
    World.addFloater(p2.x, p2.y - 10, "CHARMGIRL!!");
    AudioSys.sfx("transform");
  }
}

/* ---------------- update ---------------- */
function update() {
  Game.frame++;
  if (Game.toast > 0) Game.toast--;
  if (Game.iris > 0) Game.iris -= 4;
  if (menuPad.pressed.has("mute")) AudioSys.toggleMute();
  if (wantJoin && (Game.state === "play" || Game.state === "title")) joinP2();

  switch (Game.state) {
    case "title":
      if (menuPad.pressed.has("confirm")) {
        Game.newRun();
        Game.toMap(1);
      }
      break;

    case "map":
      Overworld.update();
      break;

    case "trophy":
      Overworld.updateTrophy();
      break;

    case "play": {
      if (Game.hitstop > 0) { Game.hitstop--; break; }   // frozen frames on big hits
      if (menuPad.pressed.has("pause")) { Game.state = "pause"; Game.pauseIdx = 0; break; }
      for (const p of players) updatePlayer(p);
      updateEnemies();
      Bosses.update();
      updateProjectiles();
      updateStink();
      updateCombat();
      World.updatePickups();
      World.updateHubBits();
      World.updateFx();
      World.updateCamera();
      if (Game.shake > 0) Game.shake--;
      Game.happiness = Math.max(0, Game.happiness - (level.happinessDrain || 0));
      if (Game.cardQueue.length) { Game.card = Game.cardQueue.shift(); Game.state = "card"; Game.stateTimer = 0; }
      break;
    }

    case "pause": {
      const nopts = UI.PAUSE_OPTS.length;
      if (menuPad.pressed.has("up")) { Game.pauseIdx = (Game.pauseIdx + nopts - 1) % nopts; Game.confirmErase = false; }
      if (menuPad.pressed.has("down")) { Game.pauseIdx = (Game.pauseIdx + 1) % nopts; Game.confirmErase = false; }
      if (menuPad.pressed.has("pause")) { Game.state = "play"; Game.confirmErase = false; }
      if (menuPad.pressed.has("confirm")) {
        if (Game.pauseIdx === 0) Game.state = "play";
        else if (Game.pauseIdx === 1) { World.resetWorld(Game.levelId); Game.state = "play"; }
        else if (Game.pauseIdx === 2) Game.toMap(Game.levelId);
        else if (Game.pauseIdx === 3) AudioSys.toggleMute();
        else if (Game.pauseIdx === 4) {
          if (Game.confirmErase) { eraseSave(); Game.confirmErase = false; Game.state = "title"; AudioSys.playSong("title"); }
          else Game.confirmErase = true;
        }
      }
      break;
    }

    case "chooser":
      UI.updateChooser();
      break;

    case "card":
      Game.stateTimer++;
      if (menuPad.pressed.has("confirm") || Game.stateTimer > 420) {
        Game.card = null;
        Game.state = "play";
      }
      break;

    case "dying":
      for (const p of players) if (p.dead) updateDeadPlayer(p);
      if (--Game.stateTimer <= 0) {
        World.resetWorld(Game.levelId);    // defeated enemies stay defeated? no — fresh dream
        Game.state = "play";
        Game.toast = 60;
      }
      break;

    case "clear":
      World.updateFx();
      if (--Game.stateTimer <= 0) UI.openStore();
      break;

    case "store":
      UI.updateStore();
      break;

    case "ending":
      Game.stateTimer++;
      if (Game.stateTimer > 330 && menuPad.pressed.has("confirm")) {
        Game.state = "credits"; Game.stateTimer = 0;
      }
      break;

    case "credits":
      Game.stateTimer++;
      if (Game.stateTimer > 1100 || menuPad.pressed.has("confirm")) UI.openStore();
      break;

    case "scores":
      if (menuPad.pressed.has("confirm")) {
        Game.state = "title";
        AudioSys.playSong("title");
      }
      break;
  }
  clearPressed();
}

/* ---------------- render ---------------- */
function render() {
  ctx.setTransform(T.SCALE, 0, 0, T.SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#16131f"; ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H);

  switch (Game.state) {
    case "loading":
      ctx.fillStyle = "#fff6d8"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      ctx.fillText("DREAMING...", T.VIEW_W / 2, T.VIEW_H / 2); ctx.textAlign = "left";
      break;
    case "title": Game.frame % 1 === 0 && UI.drawTitle(); break;
    case "store": UI.drawStore(); break;
    case "card": UI.drawCard(); break;
    case "ending": UI.drawEnding(); break;
    case "credits": UI.drawCredits(); break;
    case "scores": UI.drawScores(); break;
    case "map": Overworld.draw(); break;
    case "trophy": Overworld.drawTrophy(); break;
    default: {                              // play / pause / chooser / dying / clear
      World.draw();
      UI.drawHUD();
      if (Game.state === "pause") UI.drawPause();
      if (Game.state === "chooser") UI.drawChooser();
      if (Game.state === "clear") UI.drawClear();
    }
  }
  UI.drawIris();
}

/* ---------------- the loop ---------------- */
const STEP = 1000 / 60;
let acc = 0, last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP) {
    if (Game.state !== "loading") update();
    acc -= STEP;
  }
  render();
}

Game.boot().then(() => {
  AudioSys.playSong("title");
}).catch(err => {
  console.error(err);
  document.title = "load failed: " + err.message;
});
requestAnimationFrame(loop);
