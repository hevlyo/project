import { describe, expect, it, vi } from 'vitest';
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

  // Keep distinct scores for scaling checks.
  playerA.score = 60;
  playerB.score = 10;

  // Keep both close for push/collision validation when needed.
  playerA.position = { x: 0, y: 0, z: 0 };
  playerB.position = { x: 0.3, y: 0, z: 0 };

  return { state, playerA, playerB, aId, bId };
}

describe('GameState core rules', () => {
  it('applies dash invulnerability window', () => {
    const { state, playerA } = setupTwoPlayers();
    const now = Date.now();

    const dash = state.activateDash(playerA.socketId, now);
    expect(dash.error).toBeUndefined();
    expect(state.players[playerA.id].invulnerableUntil).toBeGreaterThan(now);
    expect(state.isInvulnerable(state.players[playerA.id], now + 1)).toBe(true);
  });

  it('grants five seconds of unlimited dash after collecting INFINITY_DASHES', () => {
    const state = new GameState(gameConfig);
    const join = state.joinPlayer('socket-dash', 'Dash', 'player-dash');
    const player = state.players[join.player.id];
    const now = Date.now();

    state.balls = {
      'ball-double-dash': {
        id: 'ball-double-dash',
        type: 'INFINITY_DASHES',
        value: gameConfig.BALL_TYPES.INFINITY_DASHES.value,
        color: gameConfig.BALL_TYPES.INFINITY_DASHES.color,
        position: { x: player.position.x, y: 0, z: player.position.z },
      },
    };

    const collected = state.collectBall(player.socketId, 'ball-double-dash');
    if (!collected.player) {
      throw new Error('Expected collected player data');
    }
    expect(collected.player.dashUnlimitedUntil).toBeGreaterThanOrEqual(now + gameConfig.INFINITY_DASHES_DURATION_MS - 1);

    const firstDash = state.activateDash(player.socketId, now);
    const secondDash = state.activateDash(player.socketId, now + 100);

    expect(firstDash.error).toBeUndefined();
    expect(secondDash.error).toBeUndefined();
  });

  it('spawns INFINITY_DASHES only below the 10 percent threshold', () => {
    const state = new GameState(gameConfig);
    const positionSpy = vi.spyOn(state, 'getRandomArenaPosition').mockReturnValue({ x: 0, z: 0 });
    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.5)
      .mockImplementationOnce(() => 0.09);

    try {
      const ball = state.createBall();
      expect(ball.type).toBe('INFINITY_DASHES');
    } finally {
      positionSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });

  it('keeps non infinity dashes rolls above the 10 percent threshold', () => {
    const state = new GameState(gameConfig);
    const positionSpy = vi.spyOn(state, 'getRandomArenaPosition').mockReturnValue({ x: 0, z: 0 });
    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.5)
      .mockImplementationOnce(() => 0.11);

    try {
      const ball = state.createBall();
      expect(ball.type).not.toBe('INFINITY_DASHES');
    } finally {
      positionSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });

  it('does not apply movement correction for overlapping players without movement', () => {
    const { state, playerA } = setupTwoPlayers();
    const before = { ...playerA.position };

    const result = state.updatePlayerPosition(playerA.socketId, before);

    expect(result.error).toBeUndefined();
    expect(result.player).toBeDefined();
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

  it('keeps player spawn away from arena obstacles', () => {
    const state = new GameState(gameConfig);
    state.players = {};
    state.balls = {};

    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 1)
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 0);

    try {
      const spawn = state.getSpawnPosition();
      const obstacles = state.arenaPhysics.getArenaObstacleCircles();

      obstacles.forEach((obstacle) => {
        const dx = spawn.x - obstacle.x;
        const dz = spawn.z - obstacle.z;
        const distance = Math.hypot(dx, dz);
        expect(distance).toBeGreaterThanOrEqual(obstacle.radius + gameConfig.PLAYER_SPAWN_CLEARANCE - 0.0001);
      });
    } finally {
      randomSpy.mockRestore();
    }
  });
});
