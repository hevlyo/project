import { describe, expect, it } from 'vitest';
import gameConfig from '../config/gameConfig';
import GameState from './GameState';

function setupTwoPlayers() {
  const state = new GameState(gameConfig);
  const joinA = state.joinPlayer('socket-a', 'Alpha', 'player-a');
  const joinB = state.joinPlayer('socket-b', 'Bravo', 'player-b');

  const aId = joinA.player.id;
  const bId = joinB.player.id;
  const playerA = state.players[aId];
  const playerB = state.players[bId];

  // Make player A reliably bigger than player B for consume checks.
  playerA.score = 60;
  playerB.score = 10;

  // Keep both close enough for contact-based consume validation.
  playerA.position = { x: 0, y: 0, z: 0 };
  playerB.position = { x: 0.3, y: 0, z: 0 };

  return { state, playerA, playerB, aId, bId };
}

describe('GameState consume intent rules', () => {
  it('does not consume on overlap without explicit intent', () => {
    const { state, aId } = setupTwoPlayers();

    const consumed = state.resolvePlayerConsumption(aId, Date.now());

    expect(consumed).toBeNull();
  });

  it('consumes when consume intent is triggered explicitly', () => {
    const { state, playerA, playerB } = setupTwoPlayers();
    const now = Date.now();

    const result = state.triggerConsumeIntent(playerA.socketId, now);

    expect(result.consumed).toBeTruthy();
    expect(result.consumed.winner.id).toBe(playerA.id);
    expect(result.consumed.loser.id).toBe(playerB.id);
    expect(state.players[playerB.id].score).toBe(0);
  });

  it('grants consume intent during dash window', () => {
    const { state, playerA } = setupTwoPlayers();
    const now = Date.now();

    const dash = state.activateDash(playerA.socketId, now);
    expect(dash.error).toBeUndefined();
    expect(state.players[playerA.id].consumeIntentUntil).toBeGreaterThan(now);
    expect(state.hasConsumeIntent(state.players[playerA.id], now + 1)).toBe(true);
  });

  it('expires consume intent after window timeout', () => {
    const { state, playerA } = setupTwoPlayers();
    const now = Date.now();

    state.triggerConsumeIntent(playerA.socketId, now);

    expect(state.hasConsumeIntent(playerA, now + 1)).toBe(true);
    expect(
      state.hasConsumeIntent(
        playerA,
        now + gameConfig.CONSUME_INTENT_WINDOW_MS + 1,
      ),
    ).toBe(false);
  });

  it('does not consume invulnerable target even with intent', () => {
    const { state, playerA, playerB } = setupTwoPlayers();
    const now = Date.now();

    playerB.invulnerableUntil = now + 2000;
    const result = state.triggerConsumeIntent(playerA.socketId, now);

    expect(result.consumed).toBeUndefined();
  });

  it('corrects movement when player attempts to leave arena boundary', () => {
    const state = new GameState(gameConfig);
    const join = state.joinPlayer('socket-edge', 'Edge', 'player-edge');
    const player = state.players[join.player.id];
    const radius = state.getPlayerRadius(player);
    const limit = state.getArenaLimit(radius) - gameConfig.ARENA_EDGE_SKIN;

    player.position = { x: limit - 0.5, y: 0, z: 0 };
    const result = state.updatePlayerPosition(player.socketId, {
      x: limit + 4,
      y: 0,
      z: 0,
    });

    const current = state.players[player.id].position;
    const distanceSq = (current.x * current.x) + (current.z * current.z);

    expect(result.error).toBeUndefined();
    expect(result.corrected).toBe(true);
    expect(distanceSq).toBeLessThanOrEqual((limit * limit) + 0.01);
  });

  it('scales ball value beyond fixed base in solo progression', () => {
    const state = new GameState(gameConfig);
    const join = state.joinPlayer('socket-solo', 'Solo', 'player-solo');
    const solo = state.players[join.player.id];

    const baseNormal = gameConfig.BALL_TYPES.NORMAL.value;
    expect(state.getScaledBallValue(baseNormal, 0)).toBe(baseNormal);

    solo.score = 10;
    state.recalculateTopScore();

    const boosted = state.getScaledBallValue(baseNormal, solo.score);
    expect(boosted).toBeGreaterThan(baseNormal);
  });

  it('grants stronger value to trailing player in comeback scenario', () => {
    const { state, playerA, playerB } = setupTwoPlayers();

    // A lidera, B esta atras e deve receber valor maior na mesma bola.
    playerA.score = 120;
    playerB.score = 20;
    state.recalculateTopScore();

    const base = gameConfig.BALL_TYPES.SPEED.value;
    const leaderValue = state.getScaledBallValue(base, playerA.score);
    const trailingValue = state.getScaledBallValue(base, playerB.score);

    expect(trailingValue).toBeGreaterThan(leaderValue);
    expect(trailingValue).toBeGreaterThan(base);
  });

  it('returns awardedValue equal to real score delta on collect', () => {
    const state = new GameState(gameConfig);
    const join = state.joinPlayer('socket-delta', 'Delta', 'player-delta');
    const player = state.players[join.player.id];

    player.score = 40;
    state.recalculateTopScore();

    const ballId = Object.keys(state.balls)[0];
    const ball = state.balls[ballId];
    player.position.x = ball.position.x;
    player.position.z = ball.position.z;

    const scoreBefore = player.score;
    const result = state.collectBall('socket-delta', ballId);
    const scoreAfter = result.player.score;

    expect(result.awardedValue).toBe(scoreAfter - scoreBefore);
    expect(result.awardedValue).toBeGreaterThan(0);
  });
});
