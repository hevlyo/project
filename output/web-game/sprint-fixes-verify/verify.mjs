import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('output/web-game/sprint-fixes-verify');
fs.mkdirSync(outDir, { recursive: true });

async function joinPage(browser, nickname) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
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
  await page.fill('#nickname-input', nickname);
  await page.click('#play-button');
  await page.waitForFunction(() => Boolean(window.__pegaBolaApp?.localPlayerId));
  await page.evaluate(async () => {
    for (let frame = 0; frame < 120; frame += 1) {
      await window.advanceTime(1000 / 60);
    }
  });

  return { context, page, errors };
}

async function collectUntilScore(page, minScore) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await page.evaluate(() => {
      const app = window.__pegaBolaApp;
      const player = app.players.get(app.localPlayerId);
      const nearestBall = [...app.balls.values()]
        .filter((ball) => !ball.hidden)
        .sort((a, b) => player.position.distanceTo(a.position) - player.position.distanceTo(b.position))[0];

      return {
        score: player.score,
        ball: nearestBall ? {
          id: nearestBall.id,
          x: nearestBall.position.x,
          z: nearestBall.position.z,
        } : null,
      };
    });

    if (status.score >= minScore) {
      return status.score;
    }

    if (!status.ball) {
      throw new Error('No ball available during score setup');
    }

    await page.evaluate(async (ball) => {
      const app = window.__pegaBolaApp;
      const player = app.players.get(app.localPlayerId);
      player.position.set(ball.x, 0, ball.z);
      player.targetPosition.set(ball.x, 0, ball.z);
      app.socket.emit('playerMovement', { position: { x: ball.x, y: 0, z: ball.z } });
      await new Promise((resolve) => setTimeout(resolve, 120));
      app.socket.emit('collectBall', { ballId: ball.id });
    }, status.ball);

    await page.waitForFunction((previousScore) => {
      const app = window.__pegaBolaApp;
      return app.players.get(app.localPlayerId).score > previousScore;
    }, status.score);

    await page.waitForTimeout(100);
  }

  return page.evaluate(() => window.__pegaBolaApp.players.get(window.__pegaBolaApp.localPlayerId).score);
}

const browser = await chromium.launch({ headless: true });
const playerA = await joinPage(browser, 'Pequeno');
const playerB = await joinPage(browser, 'Grandao');

const contextMenu = await playerA.page.evaluate(() => {
  const app = window.__pegaBolaApp;
  app.keys.forward = true;
  const canvas = document.querySelector('canvas');
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
  });
  canvas.dispatchEvent(event);

  return {
    prevented: event.defaultPrevented,
    keys: { ...app.keys },
  };
});

const scoreAStart = await collectUntilScore(playerA.page, 10);
const scoreBStart = await collectUntilScore(playerB.page, 60);

const beforeConsume = await playerA.page.evaluate(() => {
  const app = window.__pegaBolaApp;
  const local = app.players.get(app.localPlayerId);
  const other = [...app.players.values()].find((player) => player.id !== app.localPlayerId);

  return {
    local: {
      score: local.score,
      x: Number(local.position.x.toFixed(3)),
      z: Number(local.position.z.toFixed(3)),
    },
    other: {
      id: other.id,
      score: other.score,
      x: Number(other.position.x.toFixed(3)),
      z: Number(other.position.z.toFixed(3)),
    },
  };
});

await playerA.page.evaluate((target) => {
  const app = window.__pegaBolaApp;
  const local = app.players.get(app.localPlayerId);
  local.position.set(target.x, 0, target.z);
  local.targetPosition.set(target.x, 0, target.z);
  app.socket.emit('playerMovement', { position: { x: target.x, y: 0, z: target.z } });
}, beforeConsume.other);

await playerA.page.waitForFunction(() => {
  const app = window.__pegaBolaApp;
  const local = app.players.get(app.localPlayerId);
  return local.score === 0 && local.invulnerableUntil > Date.now();
});

const afterConsume = await playerA.page.evaluate(() => {
  const app = window.__pegaBolaApp;
  const local = app.players.get(app.localPlayerId);
  return {
    score: local.score,
    invulnerable: local.invulnerableUntil > Date.now(),
    x: Number(local.position.x.toFixed(3)),
    z: Number(local.position.z.toFixed(3)),
    message: document.getElementById('message-toast')?.textContent || '',
  };
});

const winnerAfterConsume = await playerB.page.evaluate(() => {
  const app = window.__pegaBolaApp;
  const local = app.players.get(app.localPlayerId);
  return {
    score: local.score,
    x: Number(local.position.x.toFixed(3)),
    z: Number(local.position.z.toFixed(3)),
  };
});

const border = await playerA.page.evaluate(async () => {
  const app = window.__pegaBolaApp;
  const player = app.players.get(app.localPlayerId);
  const limit = app.worldSize - (0.52 * player.sizeMultiplier) - 0.7;

  player.position.set(limit - 0.2, 0, limit - 0.2);
  player.targetPosition.copy(player.position);
  app.keys.right = true;
  app.keys.backward = true;
  await window.advanceTime(1000);
  app.keys.right = false;
  app.keys.backward = false;

  return {
    worldSize: app.worldSize,
    limit: Number(limit.toFixed(3)),
    x: Number(player.position.x.toFixed(3)),
    z: Number(player.position.z.toFixed(3)),
    inside: Math.abs(player.position.x) <= limit && Math.abs(player.position.z) <= limit,
  };
});

const pickupCleanup = await playerA.page.evaluate(async () => {
  const app = window.__pegaBolaApp;
  const player = app.players.get(app.localPlayerId);
  const previousScore = player.score;
  const nearestBall = [...app.balls.values()]
    .filter((ball) => !ball.hidden)
    .sort((a, b) => player.position.distanceTo(a.position) - player.position.distanceTo(b.position))[0];

  player.position.copy(nearestBall.position);
  player.targetPosition.copy(nearestBall.position);
  app.socket.emit('playerMovement', {
    position: {
      x: nearestBall.position.x,
      y: 0,
      z: nearestBall.position.z,
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  app.socket.emit('collectBall', { ballId: nearestBall.id });

  await new Promise((resolve) => setTimeout(resolve, 160));
  await window.advanceTime(1400);

  return {
    score: player.score,
    scoreIncreased: player.score > previousScore,
    pickupBursts: app.scene.pickupBursts.length,
  };
});

await playerA.page.screenshot({ path: path.join(outDir, 'player-a-after-respawn.png') });

const cleanup = await playerB.page.evaluate(() => {
  const app = window.__pegaBolaApp;
  app.destroy();
  return {
    globalRemoved: typeof window.__pegaBolaApp === 'undefined',
    sceneDisposed: app.scene.scene === null,
    socketCleared: app.socket === null,
    canvasCount: document.querySelectorAll('canvas').length,
  };
});

const result = {
  contextMenu,
  scoresBeforeConsume: {
    playerA: scoreAStart,
    playerB: scoreBStart,
  },
  beforeConsume,
  afterConsume,
  winnerAfterConsume,
  border,
  pickupCleanup,
  cleanup,
  errors: {
    playerA: playerA.errors,
    playerB: playerB.errors,
  },
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
await playerA.context.close();
await playerB.context.close();
await browser.close();

console.log(JSON.stringify(result, null, 2));
