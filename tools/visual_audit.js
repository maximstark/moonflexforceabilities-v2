/* Capture representative live-game frames after the v2 concept forge. */
const { chromium } = require("C:/Users/Mercardib/pw-drive/node_modules/playwright");
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "..", "docs", "v2-captures");
const BASE = "http://127.0.0.1:8099";
fs.mkdirSync(OUT, { recursive: true });

async function snap(page, name) {
  await page.locator("#game").screenshot({ path: path.join(OUT, name + ".png") });
}

async function level(page, id) {
  await page.goto(`${BASE}/index.html?level=${id}`);
  await page.waitForTimeout(900);
  for (let i = 0; i < 12; i++) {
    const state = await page.evaluate(() => Game.state);
    if (state !== "card") break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(1000);
  await snap(page, "01-title");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await snap(page, "02-overworld");

  await level(page, 1);
  await snap(page, "03-dream-lake");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await snap(page, "04-pause");

  await level(page, 4);
  await snap(page, "05-candy-clouds");

  await level(page, 5);
  await page.evaluate(() => { players[0].x = 720; players[0].y = 120; World.updateCamera(); });
  await page.waitForTimeout(250);
  await snap(page, '05b-fever-swarm');

  await level(page, 6);
  await page.evaluate(() => {
    const boss = Bosses.units[0], player = players[0];
    player.x = boss.x - 120; player.y = boss.y; player.form = 'mecha';
    Bosses.activated = true; World.updateCamera();
  });
  await page.waitForTimeout(250);
  await snap(page, '05c-moonflex-finale');

  await level(page, 7);
  await page.evaluate(() => { players[0].x = 160; players[0].y = 560; World.updateCamera(); });
  await page.waitForTimeout(200);
  await snap(page, '05c-broken-ascent');

  await level(page, 8);
  await page.evaluate(() => {
    const boss = Bosses.units[0], player = players[0];
    player.x = boss.triggerX + 40; player.y = boss.dropY - 20;
    boss.y = boss.dropY; boss.state = "chase"; Bosses.activated = true;
    World.updateCamera();
  });
  await page.waitForTimeout(250);
  await snap(page, "06-bad-dreams");
  await page.evaluate(() => {
    const boss = Bosses.units[0];
    boss.phase = 2; boss.state = 'sweep'; boss.sweepDir = -1; boss.sweepTimer = 12;
  });
  await page.waitForTimeout(120);
  await snap(page, '06a-bad-dreams-sweep');

  await level(page, 9);
  await page.evaluate(() => { players[0].x = 480; World.updateCamera(); });
  await page.waitForTimeout(200);
  await snap(page, '06b-secret-cove');

  await level(page, 10);
  await page.evaluate(() => { players[0].x = 360; players[0].y = 375; World.updateCamera(); });
  await page.waitForTimeout(200);
  await snap(page, "07-nice-place");

  await level(page, 11);
  await page.evaluate(() => {
    const boss = Bosses.units[0], player = players[0];
    player.x = boss.x - 40; player.y = boss.y + 24;
    boss.state = 'planted'; boss.y = player.y - 12; Bosses.activated = true;
    World.updateCamera();
  });
  await page.waitForTimeout(250);
  await snap(page, '07b-long-way-up');

  await level(page, 12);
  await page.evaluate(() => {
    const boss = Bosses.units[0], player = players[0];
    player.x = boss.x - 70; player.y = boss.lowY + 40;
    boss.y = boss.lowY; boss.state = "dip"; Bosses.activated = true;
    World.updateCamera();
  });
  await page.waitForTimeout(250);
  await snap(page, "08-biggest-dream");

  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Captured 14 live frames in ${OUT}`);
})().catch(error => { console.error(error); process.exit(1); });
