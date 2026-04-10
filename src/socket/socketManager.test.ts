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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SocketManager', () => {
  it('emits error when join data is invalid', () => {
    const io = createMockIo();
    const gameState = {
      joinPlayer: vi.fn().mockReturnValue({ error: 'Invalid nickname' }),
      checkPassiveConsumption: vi.fn().mockReturnValue(null),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-join');

    manager.handleJoinGame(socket, { nickname: '' });

    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid nickname' });
    manager.destroy();
  });

  it('emits consumption and scores when movement triggers consume', () => {
    const io = createMockIo();
    const consumed = {
      winner: { id: 'a' },
      loser: { id: 'b' },
      transferredScore: 10,
      consumedPosition: { x: 0, y: 0, z: 0 },
    };

    const gameState = {
      updatePlayerPosition: vi.fn().mockReturnValue({
        player: { id: 'a', position: { x: 0, y: 0, z: 0 } },
        consumed,
      }),
      getScoreMap: vi.fn().mockReturnValue({ a: 10, b: 0 }),
      checkPassiveConsumption: vi.fn().mockReturnValue(null),
    };

    const manager = new SocketManager(io, gameState as never);
    const socket = createMockSocket('sock-move');

    manager.handlePlayerMovement(socket, {
      position: { x: 1, y: 0, z: 1 },
    });

    expect(io.emit).toHaveBeenCalledWith('playerConsumed', {
      winner: consumed.winner,
      loser: consumed.loser,
      transferredScore: consumed.transferredScore,
      consumedPosition: consumed.consumedPosition,
    });
    expect(io.emit).toHaveBeenCalledWith('updateScores', { a: 10, b: 0 });
    expect(socket.emit).toHaveBeenCalledWith('playerState', expect.objectContaining({ syncMode: 'consumed' }));
    manager.destroy();
  });

  it('emits ballCollected and respawns ball after collection', () => {
    vi.useFakeTimers();

    const io = createMockIo();
    const gameState = {
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
      checkPassiveConsumption: vi.fn().mockReturnValue(null),
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
});
