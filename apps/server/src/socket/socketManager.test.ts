import { afterEach, describe, expect, it, vi } from 'vitest';
import SocketManager from './socketManager';

function createMockSocket(id = 'socket-1') {
  return {
    id,
    emit: vi.fn(),
    on: vi.fn(),
    broadcast: {
      emit: vi.fn(),
    },
  };
}

function createMockIo() {
  return {
    on: vi.fn(),
    emit: vi.fn(),
  };
}

function combatMocks() {
  return {
    getActiveProjectiles: vi.fn().mockReturnValue([]),
    fireballAttack: vi.fn().mockReturnValue({ error: 'Player not found' }),
    advanceCombat: vi.fn().mockReturnValue({ spawned: [], destroyed: [], hits: [] }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SocketManager', () => {
  it('throws when io instance is invalid', () => {
    expect(() => new SocketManager({} as never)).toThrow('SocketManager requires a Socket.IO server instance');
  });

  it('registers socket handlers on connection', () => {
    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn().mockReturnValue({ player: { id: 'player-1', position: { x: 0, y: 0, z: 0 } } }),
      maintainBallCount: vi.fn().mockReturnValue({ spawned: [], despawned: [] }),
      getWorldInfo: vi.fn().mockReturnValue({ worldSize: 100, ballCount: 10, isNightMode: false }),
      getPlayersSnapshot: vi.fn().mockReturnValue({}),
      getActiveBalls: vi.fn().mockReturnValue([]),
      getPlayerCount: vi.fn().mockReturnValue(0),
      getScoreMap: vi.fn().mockReturnValue({}),
      updatePlayerPosition: vi.fn().mockReturnValue({
        player: { id: 'player-1', position: { x: 0, y: 0, z: 0 } },
      }),
      collectBall: vi.fn().mockReturnValue({ error: 'Ball not found' }),
      respawnBall: vi.fn().mockReturnValue(null),
      activateDash: vi.fn().mockReturnValue({ error: 'Dash on cooldown' }),
      getPlayer: vi.fn().mockReturnValue(null),
      serializePlayer: vi.fn().mockReturnValue({
        id: 'player-1',
        nickname: 'Alpha',
        color: 1,
        score: 0,
        sizeMultiplier: 1,
        invulnerableUntil: 0,
        speedBoostUntil: 0,
        dashCooldownUntil: 0,
        dashUnlimitedUntil: 0,
        position: { x: 0, y: 0, z: 0 },
      }),
      removePlayer: vi.fn().mockReturnValue(null),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const onConnection = io.on.mock.calls[0][1] as (socket: ReturnType<typeof createMockSocket>) => void;
    const socket = createMockSocket('sock-connection');

    onConnection(socket);

    expect(socket.on).toHaveBeenCalledWith('joinGame', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('playerMovement', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('collectBall', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('playerAttack', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('playerDash', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));

    const joinHandler = socket.on.mock.calls.find((call) => call[0] === 'joinGame')?.[1] as ((payload: unknown) => void);
    const movementHandler = socket.on.mock.calls.find((call) => call[0] === 'playerMovement')?.[1] as ((payload: unknown) => void);
    const collectHandler = socket.on.mock.calls.find((call) => call[0] === 'collectBall')?.[1] as ((payload: unknown) => void);
    const dashHandler = socket.on.mock.calls.find((call) => call[0] === 'playerDash')?.[1] as (() => void);
    const disconnectHandler = socket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1] as (() => void);

    joinHandler({ nickname: 'Alpha', sessionId: 'player-1' });
    movementHandler({ position: { x: 0, y: 0, z: 0 } });
    collectHandler({ ballId: 'ball-1' });
    dashHandler();
    disconnectHandler();

    manager.initialize();
    expect(io.on).toHaveBeenCalledTimes(1);
    manager.destroy();
  });

  it('broadcasts fireball spawn and combat impact', () => {
    const io = createMockIo();
    const playerState = {
      id: 'player-1',
      nickname: 'Alpha',
      color: 1,
      score: 0,
      sizeMultiplier: 1,
      health: 100,
      maxHealth: 100,
      invulnerableUntil: 0,
      speedBoostUntil: 0,
      dashCooldownUntil: 0,
      dashUnlimitedUntil: 0,
      attackCooldownUntil: 900,
      position: { x: 0, y: 0, z: 0 },
    };
    const projectile = {
      id: 'projectile-1',
      ownerId: 'player-1',
      position: { x: 1, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      speed: 38,
      radius: 1.15,
      damage: 25,
      color: 1,
      createdAt: 1000,
      expiresAt: 2800,
    };
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getActiveProjectiles: vi.fn().mockReturnValue([]),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn().mockReturnValue({ 'player-1': 0 }),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      fireballAttack: vi.fn().mockReturnValue({ projectile, player: playerState }),
      advanceCombat: vi.fn().mockReturnValue({
        spawned: [],
        destroyed: ['projectile-1'],
        hits: [{ projectile, player: playerState, damage: 25, wasFatal: true }],
      }),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-attack');

    manager.handlePlayerAttack(socket, { direction: { x: 1, y: 0, z: 0 } });
    manager.handleCombatTick();

    expect(io.emit).toHaveBeenCalledWith('projectileSpawned', projectile);
    expect(io.emit).toHaveBeenCalledWith('projectileDestroyed', { projectileId: 'projectile-1' });
    expect(io.emit).toHaveBeenCalledWith('fireballImpact', expect.objectContaining({
      projectileId: 'projectile-1',
      playerId: 'player-1',
      damage: 25,
      wasFatal: true,
    }));
    expect(io.emit).toHaveBeenCalledWith('playerState', expect.objectContaining({ syncMode: 'attack' }));
    expect(io.emit).toHaveBeenCalledWith('playerState', expect.objectContaining({ syncMode: 'respawn' }));
    expect(io.emit).toHaveBeenCalledWith('updateScores', expect.any(Object));
    manager.destroy();
  });

  it('does not emit spawned balls when maintenance result is empty', () => {
    const io = createMockIo();
    const player = { id: 'player-1', nickname: 'Alpha', position: { x: 0, y: 0, z: 0 } };
    const gameState = {
      joinPlayer: vi.fn().mockReturnValue({ player }),
      maintainBallCount: vi.fn().mockReturnValue({ spawned: [], despawned: [] }),
      getWorldInfo: vi.fn().mockReturnValue({ worldSize: 100, ballCount: 10, isNightMode: false }),
      getPlayersSnapshot: vi.fn().mockReturnValue({ 'player-1': player }),
      getActiveBalls: vi.fn().mockReturnValue([]),
      getPlayerCount: vi.fn().mockReturnValue(1),
      getScoreMap: vi.fn().mockReturnValue({ 'player-1': 10 }),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-join-no-spawn');

    manager.handleJoinGame(socket, { nickname: 'Alpha', sessionId: 'player-1' });

    expect(io.emit).not.toHaveBeenCalledWith('newBalls', expect.anything());
    manager.destroy();
  });

  it('emits full initial state when join succeeds', () => {
    const io = createMockIo();
    const player = { id: 'player-1', nickname: 'Alpha', position: { x: 0, y: 0, z: 0 } };
    const gameState = {
      joinPlayer: vi.fn().mockReturnValue({ player }),
      maintainBallCount: vi.fn().mockReturnValue({ spawned: [{ id: 'spawned-ball' }], despawned: [] }),
      getWorldInfo: vi.fn().mockReturnValue({ worldSize: 100, ballCount: 10, isNightMode: false }),
      getPlayersSnapshot: vi.fn().mockReturnValue({ 'player-1': player }),
      getActiveBalls: vi.fn().mockReturnValue([{ id: 'active-ball' }]),
      getPlayerCount: vi.fn().mockReturnValue(1),
      getScoreMap: vi.fn().mockReturnValue({ 'player-1': 10 }),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-join-success');

    manager.handleJoinGame(socket, { nickname: 'Alpha', sessionId: 'player-1' });

    expect(io.emit).toHaveBeenCalledWith('newBalls', [{ id: 'spawned-ball' }]);
    expect(socket.emit).toHaveBeenCalledWith('worldInfo', { worldSize: 100, ballCount: 10, isNightMode: false });
    expect(socket.broadcast.emit).toHaveBeenCalledWith('newPlayer', player);
    expect(io.emit).toHaveBeenCalledWith('playerCount', 1);
    expect(io.emit).toHaveBeenCalledWith('updateScores', { 'player-1': 10 });
    manager.destroy();
  });

  it('emits error when join data is invalid', () => {
    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn().mockReturnValue({ error: 'Invalid nickname' }),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-join');

    manager.handleJoinGame(socket, { nickname: '' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid nickname' });
    manager.destroy();
  });

  it('broadcasts player movement when movement is accepted', () => {
    const io = createMockIo();

    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn().mockReturnValue({
        player: { id: 'a', position: { x: 0, y: 0, z: 0 } },
      }),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-move');

    manager.handlePlayerMovement(socket, {
      position: { x: 1, y: 0, z: 1 },
    });

    expect(socket.broadcast.emit).toHaveBeenCalledWith('playerMoved', {
      id: 'a',
      position: { x: 0, y: 0, z: 0 },
    });
    manager.destroy();
  });

  it('throttles movement updates and emits corrected state when needed', () => {
    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn().mockReturnValue({
        player: { id: 'a', position: { x: 1, y: 0, z: 1 } },
        corrected: true,
      }),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-throttle');

    manager.handlePlayerMovement(socket, { position: { x: 1, y: 0, z: 1 } });
    manager.handlePlayerMovement(socket, { position: { x: 2, y: 0, z: 2 } });

    expect(gameState.updatePlayerPosition).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('playerState', expect.objectContaining({ syncMode: 'corrected' }));

    nowSpy.mockRestore();
    manager.destroy();
  });

  it('emits error when movement update fails', () => {
    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn().mockReturnValue({ error: 'Invalid movement data' }),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-move-error');

    manager.handlePlayerMovement(socket, {
      position: { x: 1, y: 0, z: 1 },
    });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid movement data' });
    manager.destroy();
  });

  it('emits ballCollected and respawns ball after collection', () => {
    vi.useFakeTimers();

    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn().mockReturnValue({
        ball: {
          id: 'ball-1',
          color: 0xffffff,
          type: 'NORMAL',
          position: { x: 1, y: 0, z: 1 },
        },
        player: {
          id: 'player-1',
          sizeMultiplier: 1.2,
        },
        awardedValue: 15,
        scores: { 'player-1': 15 },
      }),
      respawnBall: vi.fn().mockReturnValue({ id: 'ball-2' }),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-collect');

    manager.handleBallCollection(socket, { ballId: 'ball-1' });

    expect(io.emit).toHaveBeenCalledWith('ballCollected', expect.objectContaining({
      ballId: 'ball-1',
      playerId: 'player-1',
      value: 15,
    }));

    vi.advanceTimersByTime(3000);

    expect(io.emit).toHaveBeenCalledWith('newBalls', [{ id: 'ball-2' }]);

    manager.destroy();
    vi.useRealTimers();
  });

  it('handles collection throttle, error and null respawn branch', () => {
    vi.useFakeTimers();

    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn().mockReturnValueOnce({ error: 'Ball not found' }).mockReturnValueOnce({
        ball: {
          id: 'ball-1',
          color: 0xffffff,
          type: 'NORMAL',
          position: { x: 1, y: 0, z: 1 },
        },
        player: {
          id: 'player-1',
          sizeMultiplier: 1.2,
        },
        awardedValue: 10,
        scores: { 'player-1': 10 },
      }),
      respawnBall: vi.fn().mockReturnValue(null),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(2000);
    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-collect-branches');

    manager.handleBallCollection(socket, { ballId: 'missing' });
    manager.handleBallCollection(socket, { ballId: 'ignored-throttle' });

    nowSpy.mockReturnValue(2200);
    manager.handleBallCollection(socket, { ballId: 'ball-1' });

    vi.advanceTimersByTime(3000);

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Ball not found' });
    expect(gameState.collectBall).toHaveBeenCalledTimes(2);
    expect(io.emit).not.toHaveBeenCalledWith('newBalls', expect.anything());

    nowSpy.mockRestore();
    manager.destroy();
    vi.useRealTimers();
  });

  it('emits dash sync and dash cooldown sync branches', () => {
    const io = createMockIo();
    const playerState = {
      id: 'player-1',
      nickname: 'Alpha',
      color: 1,
      score: 0,
      sizeMultiplier: 1,
      invulnerableUntil: 0,
      speedBoostUntil: 0,
      dashCooldownUntil: 1700,
      dashUnlimitedUntil: 0,
      position: { x: 0, y: 0, z: 0 },
    };
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn(),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn(),
      getScoreMap: vi.fn(),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn()
        .mockReturnValueOnce({ player: playerState })
        .mockReturnValueOnce({ error: 'Dash on cooldown', dashCooldownUntil: 1700 })
        .mockReturnValueOnce({ error: 'Dash on cooldown', dashCooldownUntil: 1700 })
        .mockReturnValueOnce({ error: 'Generic dash error' }),
      getPlayer: vi.fn().mockReturnValueOnce(playerState).mockReturnValueOnce(null),
      serializePlayer: vi.fn().mockReturnValue(playerState),
      removePlayer: vi.fn(),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-dash');

    manager.handlePlayerDash(socket);
    manager.handlePlayerDash(socket);
    manager.handlePlayerDash(socket);
    manager.handlePlayerDash(socket);

    expect(io.emit).toHaveBeenCalledWith('playerState', expect.objectContaining({ syncMode: 'dash' }));
    expect(socket.emit).toHaveBeenCalledWith('playerState', expect.objectContaining({ syncMode: 'dash-cooldown' }));
    manager.destroy();
  });

  it('handles disconnect branches and remove balls emission', () => {
    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn(),
      maintainBallCount: vi.fn()
        .mockReturnValueOnce({ spawned: [], despawned: ['old-ball'] })
        .mockReturnValueOnce({ spawned: [], despawned: [] }),
      getWorldInfo: vi.fn(),
      getPlayersSnapshot: vi.fn(),
      getActiveBalls: vi.fn(),
      getPlayerCount: vi.fn().mockReturnValue(0),
      getScoreMap: vi.fn().mockReturnValue({}),
      updatePlayerPosition: vi.fn(),
      collectBall: vi.fn(),
      respawnBall: vi.fn(),
      activateDash: vi.fn(),
      getPlayer: vi.fn(),
      serializePlayer: vi.fn(),
      removePlayer: vi.fn().mockReturnValueOnce({ id: 'player-1' }).mockReturnValueOnce(null).mockReturnValueOnce({ id: 'player-1' }),
      ...combatMocks(),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-disconnect');

    manager.lastMovementAt.set(socket.id, 1000);
    manager.lastCollectionAt.set(socket.id, 1000);

    manager.handlePlayerDisconnect(socket);
    manager.handlePlayerDisconnect(socket);
    manager.handlePlayerDisconnect(socket);

    expect(socket.broadcast.emit).toHaveBeenCalledWith('playerDisconnected', 'player-1');
    expect(io.emit).toHaveBeenCalledWith('removeBalls', ['old-ball']);
    expect(manager.lastMovementAt.has(socket.id)).toBe(false);
    expect(manager.lastCollectionAt.has(socket.id)).toBe(false);
    manager.destroy();
  });
});
