import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:25565';
const outDir = '/home/hevlyo/pegabola3000/output/web-game/sprint-pvp/verify';
fs.mkdirSync(outDir, { recursive: true });

const errors = [];

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    if (details) error.details = details;
    throw error;
  }
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function getRuntime(page) {
  return page.evaluate(() => {
    const app = window.__pegaBolaApp;
    return {
      localPlayerId: app.localPlayerId,
      players: [...app.players.values()].map((player) => ({
        id: player.id,
        nickname: player.nickname,
        score: player.score,
        sizeMultiplier: player.sizeMultiplier,
        invulnerableUntil: player.invulnerableUntil || 0,
        speedBoostUntil: player.speedBoostUntil || 0,
        x: Number(player.position.x.toFixed(2)),
        z: Number(player.position.z.toFixed(2)),
      })),
      balls: [...app.balls.values()]
        .filter((ball) => !ball.hidden)
        .map((ball) => ({
          id: ball.id,
          type: ball.type,
          value: ball.value,
          x: Number(ball.position.x.toFixed(2)),
          z: Number(ball.position.z.toFixed(2)),
        })),
      killfeed: [...document.querySelectorAll('#killfeed .killfeed-entry')].map((entry) => ({
        text: entry.textContent.trim(),
        tone: entry.dataset.tone || '',
      })),
      statusChip: (() => {
        const entry = document.getElementById('status-chip');
        if (!entry || entry.hidden) return null;
        return {
          text: entry.textContent.trim(),
          tone: entry.dataset.tone || '',
        };
      })(),
    };
  });
}

async function join(page, nickname) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#nickname-input', nickname);
  await page.click('#play-button');
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await page.evaluate(() => {
      if (typeof window.render_game_to_text !== 'function') return null;
      try {
        return JSON.parse(window.render_game_to_text());
      } catch {
        return null;
      }
    });
    if (state?.mode === 'playing' && state.localPlayer?.nickname === nickname) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Join timed out for ${nickname}`);
}

async function waitForPlayerCount(page, expected) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await getState(page);
    if (state.playerCount === expected) return state;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for playerCount=${expected}`);
}

async function teleportLocal(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const app = window.__pegaBolaApp;
    const player = app.players.get(app.localPlayerId);
    player.position.set(x, 0, z);
    player.targetPosition.set(x, 0, z);
    player.velocity.set(0, 0, 0);
    app.syncScene();
    app.scene.render();
    app.socket.emit('playerMovement', {
      position: { x, y: 0, z },
    });
  }, { x, z });
  await page.waitForTimeout(160);
}

async function collectBall(page, ballId) {
  await page.evaluate((id) => {
    window.__pegaBolaApp.socket.emit('collectBall', { ballId: id });
  }, ballId);
  await page.waitForTimeout(220);
}

async function collectNearestBall(page, type) {
  const runtime = await getRuntime(page);
  const local = runtime.players.find((player) => player.id === runtime.localPlayerId);
  assert(local, 'Local player missing while collecting ball');
  const candidates = runtime.balls
    .filter((ball) => !type || ball.type === type)
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.x - local.x, left.z - local.z);
      const rightDistance = Math.hypot(right.x - local.x, right.z - local.z);
      return leftDistance - rightDistance;
    });
  assert(candidates.length > 0, `No visible ${type || 'ball'} found`);
  const target = candidates[0];
  await page.evaluate(() => {
    const app = window.__pegaBolaApp;
    app.__testOriginalCheckBallCollisions = app.checkBallCollisions;
    app.checkBallCollisions = () => {};
  });
  try {
    await teleportLocal(page, target.x, target.z);
    await page.waitForTimeout(320);
    await collectBall(page, target.id);
  } finally {
    await page.evaluate(() => {
      const app = window.__pegaBolaApp;
      if (app.__testOriginalCheckBallCollisions) {
        app.checkBallCollisions = app.__testOriginalCheckBallCollisions;
        delete app.__testOriginalCheckBallCollisions;
      }
    });
  }
  return target;
}

async function measureForwardDistance(page, durationMs) {
  return page.evaluate(async (duration) => {
    const app = window.__pegaBolaApp;
    const player = app.players.get(app.localPlayerId);
    const start = { x: player.position.x, z: player.position.z };
    app.keys.forward = true;
    await window.advanceTime(duration);
    app.keys.forward = false;
    await window.advanceTime(50);
    return {
      start,
      end: { x: player.position.x, z: player.position.z },
      distance: Number(Math.hypot(player.position.x - start.x, player.position.z - start.z).toFixed(3)),
    };
  }, durationMs);
}


async function collectSpeedBallReliable(page) {
  const runtime = await getRuntime(page);
  const local = runtime.players.find((player) => player.id === runtime.localPlayerId);
  assert(local, 'Local player missing while collecting SPEED ball');
  const target = runtime.balls
    .filter((ball) => ball.type === 'SPEED')
    .sort((left, right) => {
      const leftDistance = Math.hypot(left.x - local.x, left.z - local.z);
      const rightDistance = Math.hypot(right.x - local.x, right.z - local.z);
      return leftDistance - rightDistance;
    })[0];
  assert(target, 'No visible SPEED ball found');

  await page.evaluate(({ x, z, ballId }) => {
    const app = window.__pegaBolaApp;
    app.__testOriginalCheckBallCollisions = app.checkBallCollisions;
    app.checkBallCollisions = () => {};
    const player = app.players.get(app.localPlayerId);
    player.position.set(x, 0, z);
    player.targetPosition.set(x, 0, z);
    player.velocity.set(0, 0, 0);
    app.syncScene();
    app.scene.render();
    app.socket.emit('playerMovement', { position: { x, y: 0, z } });
    setTimeout(() => {
      app.socket.emit('collectBall', { ballId });
    }, 300);
  }, { x: target.x, z: target.z, ballId: target.id });

  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const app = window.__pegaBolaApp;
    if (app.__testOriginalCheckBallCollisions) {
      app.checkBallCollisions = app.__testOriginalCheckBallCollisions;
      delete app.__testOriginalCheckBallCollisions;
    }
  });

  return target;
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const pageBig = await context.newPage();
const pageSmall = await context.newPage();

for (const page of [pageBig, pageSmall]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', text: String(err) });
  });
}

try {
  await join(pageBig, 'Big');
  await join(pageSmall, 'Small');
  await waitForPlayerCount(pageBig, 2);
  await waitForPlayerCount(pageSmall, 2);

  const initialBig = await getState(pageBig);
  const initialSmall = await getState(pageSmall);

  const smallOnBig = (await getRuntime(pageBig)).players.find((player) => player.nickname === 'Small');
  assert(smallOnBig, 'Small missing from Big runtime after join');
  await teleportLocal(pageBig, smallOnBig.x, smallOnBig.z);
  await pageBig.waitForTimeout(200);

  const afterNoConsumeBig = await getState(pageBig);
  const afterNoConsumeSmall = await getState(pageSmall);
  assert(afterNoConsumeBig.localPlayer.score === 0, 'Equal-size collision should not increase Big score', { afterNoConsumeBig });
  assert(afterNoConsumeSmall.localPlayer.score === 0, 'Equal-size collision should not affect Small score', { afterNoConsumeSmall });

  await collectNearestBall(pageBig, 'GOLDEN');
  const afterGolden = await getState(pageBig);
  assert(afterGolden.localPlayer.score >= 30, 'Big should gain at least 30 score after GOLDEN collect', { afterGolden });

  const smallBeforeConsume = (await getRuntime(pageBig)).players.find((player) => player.nickname === 'Small');
  await teleportLocal(pageBig, smallBeforeConsume.x, smallBeforeConsume.z);
  await pageBig.waitForTimeout(250);

  const afterConsumeBig = await getState(pageBig);
  const afterConsumeSmall = await getState(pageSmall);
  const consumeRuntimeBig = await getRuntime(pageBig);
  const consumeRuntimeSmall = await getRuntime(pageSmall);
  assert(afterConsumeBig.localPlayer.score >= 30, 'Big should still have score after consuming Small', { afterConsumeBig });
  assert(afterConsumeSmall.localPlayer.invulnerableUntil, 'Small should respawn with invulnerability', { afterConsumeSmall });
  assert(consumeRuntimeBig.killfeed.some((entry) => entry.text.includes('Big engoliu Small')), 'Killfeed should announce consumption for Big', { consumeRuntimeBig });
  assert(consumeRuntimeSmall.statusChip?.text?.includes('Protegido'), 'Small HUD should show protection after respawn', { consumeRuntimeSmall });

  const bigScoreBeforeBlocked = afterConsumeBig.localPlayer.score;
  const protectedSmall = (await getRuntime(pageBig)).players.find((player) => player.nickname === 'Small');
  await teleportLocal(pageBig, protectedSmall.x, protectedSmall.z);
  await pageBig.waitForTimeout(200);

  const afterBlockedBig = await getState(pageBig);
  const afterBlockedSmall = await getState(pageSmall);
  assert(afterBlockedBig.localPlayer.score === bigScoreBeforeBlocked, 'Protected Small should not be consumed again immediately', { afterBlockedBig, afterBlockedSmall });
  assert(afterBlockedSmall.localPlayer.invulnerableUntil, 'Small protection should still be active during blocked consume', { afterBlockedSmall });

  await collectNearestBall(pageBig);
  const bigAfterExtra = await getState(pageBig);
  assert(bigAfterExtra.localPlayer.score > bigScoreBeforeBlocked, 'Big should keep growing before the second consume', { bigAfterExtra, bigScoreBeforeBlocked });

  await collectNearestBall(pageSmall, 'SPEED');
  const smallWithScore = await getState(pageSmall);
  assert(smallWithScore.localPlayer.score > 0, 'Small should be able to score while protected', { smallWithScore });

  await pageBig.waitForTimeout(2300);
  const vulnerableSmall = (await getRuntime(pageBig)).players.find((player) => player.nickname === 'Small');
  await teleportLocal(pageBig, vulnerableSmall.x, vulnerableSmall.z);
  await pageBig.waitForTimeout(250);

  const afterSecondConsumeBig = await getState(pageBig);
  const afterSecondConsumeSmall = await getState(pageSmall);
  const secondConsumeRuntimeSmall = await getRuntime(pageSmall);
  assert(afterSecondConsumeBig.localPlayer.score > bigAfterExtra.localPlayer.score, 'Big should gain Small score after protection ends', { afterSecondConsumeBig, bigAfterExtra, smallWithScore });
  assert(afterSecondConsumeSmall.localPlayer.invulnerableUntil, 'Small should receive a fresh invulnerability window after second respawn', { afterSecondConsumeSmall });
  assert(secondConsumeRuntimeSmall.statusChip?.text?.includes('Protegido'), 'Small HUD should show protection after the second respawn too', { secondConsumeRuntimeSmall, afterSecondConsumeSmall });

  await pageBig.waitForTimeout(180);
  await pageSmall.waitForTimeout(180);
  await pageBig.screenshot({ path: path.join(outDir, 'big-after-pvp.png') });
  await pageSmall.screenshot({ path: path.join(outDir, 'small-after-respawn.png') });

  await context.close();

  const baselineContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pageBaseline = await baselineContext.newPage();
  pageBaseline.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
    }
  });
  pageBaseline.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', text: String(err) });
  });
  await join(pageBaseline, 'TurboBase');
  await waitForPlayerCount(pageBaseline, 1);
  await pageBaseline.waitForTimeout(1200);
  const baselineMove = await measureForwardDistance(pageBaseline, 500);
  await baselineContext.close();

  const speedContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pageSpeed = await speedContext.newPage();
  pageSpeed.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
    }
  });
  pageSpeed.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', text: String(err) });
  });

  await join(pageSpeed, 'Turbo');
  await waitForPlayerCount(pageSpeed, 1);
  await pageSpeed.waitForTimeout(1200);
  await collectSpeedBallReliable(pageSpeed);
  const afterSpeedPickup = await getState(pageSpeed);
  const speedRuntime = await getRuntime(pageSpeed);
  assert(afterSpeedPickup.localPlayer.speedBoostUntil, 'SPEED pickup should expose active boost in render_game_to_text', { afterSpeedPickup });
  assert(speedRuntime.statusChip?.text?.includes('Turbo'), 'HUD should show turbo chip during SPEED buff', { speedRuntime });
  await pageSpeed.waitForTimeout(180);
  await pageSpeed.screenshot({ path: path.join(outDir, 'speed-after-pickup.png') });

  const boostedMove = await measureForwardDistance(pageSpeed, 500);
  assert(boostedMove.distance > baselineMove.distance * 1.2, 'Boosted movement should be meaningfully faster than baseline', { baselineMove, boostedMove });

  await pageSpeed.waitForTimeout(4200);
  const afterSpeedExpire = await getState(pageSpeed);
  assert(afterSpeedExpire.localPlayer.speedBoostUntil === null, 'SPEED boost should expire after 4 seconds', { afterSpeedExpire });
  await speedContext.close();

  const result = {
    initialBig,
    initialSmall,
    afterNoConsumeBig,
    afterNoConsumeSmall,
    afterGolden,
    afterConsumeBig,
    afterConsumeSmall,
    afterBlockedBig,
    afterBlockedSmall,
    smallWithScore,
    afterSecondConsumeBig,
    afterSecondConsumeSmall,
    baselineMove,
    afterSpeedPickup,
    boostedMove,
    afterSpeedExpire,
    consoleErrors: errors,
  };

  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
  if (errors.length) {
    fs.writeFileSync(path.join(outDir, 'errors.json'), JSON.stringify(errors, null, 2));
    throw new Error(`Console errors detected: ${errors[0].text}`);
  }
} finally {
  await browser.close();
}
