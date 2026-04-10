import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('output/web-game/collect-smoothing-verify');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(msg.text());
  }
});
page.on('pageerror', (error) => {
  errors.push(String(error));
});

await page.goto('http://127.0.0.1:25565', { waitUntil: 'domcontentloaded' });
await page.click('#play-button');
await page.waitForFunction(() => Boolean(window.__pegaBolaApp?.localPlayerId));
await page.evaluate(async () => {
  for (let frame = 0; frame < 120; frame += 1) {
    await window.advanceTime(1000 / 60);
  }
});

const setup = await page.evaluate(() => {
  const app = window.__pegaBolaApp;
  const player = app.players.get(app.localPlayerId);
  app.keys.forward = true;
  player.velocity.set(0, 0, 0.19);

  return {
    beforeScore: player.score,
    beforeVelocity: Number(player.velocity.length().toFixed(3)),
    beforeX: Number(player.position.x.toFixed(3)),
    beforeZ: Number(player.position.z.toFixed(3)),
    cameraDistance: Number(app.scene.camera.position.distanceTo(player.position).toFixed(3)),
    cameraBoomDistance: Number(app.scene.cameraCurrentDistance.toFixed(3)),
  };
});

await page.evaluate(() => {
  const app = window.__pegaBolaApp;
  const player = app.players.get(app.localPlayerId);
  app.handleBallCollected({
    ballId: 'probe-ball',
    playerId: app.localPlayerId,
    value: 10,
    color: player.color,
    position: { x: player.position.x, y: 0, z: player.position.z },
  });
  app.handlePlayerState({
    id: player.id,
    nickname: player.nickname,
    color: player.color,
    score: player.score + 10,
    position: {
      x: player.position.x,
      y: 0,
      z: player.position.z,
    },
    invulnerableUntil: player.invulnerableUntil || 0,
    speedBoostUntil: player.speedBoostUntil || 0,
    syncMode: 'score',
  });
});

const samples = [];
for (let frame = 0; frame < 16; frame += 1) {
  await page.evaluate(() => window.advanceTime(1000 / 60));
  samples.push(await page.evaluate((sampleFrame) => {
    const app = window.__pegaBolaApp;
    const player = app.players.get(app.localPlayerId);
    return {
      frame: sampleFrame,
      score: player.score,
      velocity: Number(player.velocity.length().toFixed(3)),
      x: Number(player.position.x.toFixed(3)),
      z: Number(player.position.z.toFixed(3)),
      moving: player.velocity.lengthSq() > 0.0002,
      cameraDistance: Number(app.scene.camera.position.distanceTo(player.position).toFixed(3)),
      cameraBoomDistance: Number(app.scene.cameraCurrentDistance.toFixed(3)),
      pickupBoostTarget: Number(app.scene.cameraPickupDistanceBoostTarget.toFixed(3)),
      pickupBoostCurrent: Number(app.scene.cameraPickupDistanceBoost.toFixed(3)),
    };
  }, frame + 1));
}

await page.evaluate(() => {
  const app = window.__pegaBolaApp;
  app.keys.forward = false;
});

await page.screenshot({ path: path.join(outDir, 'after-score-sync.png') });

const result = { setup, samples, errors };
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));

await browser.close();
console.log(JSON.stringify(result, null, 2));
