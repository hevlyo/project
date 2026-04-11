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
      updatePlayerPosition: vi.fn().mockReturnValue({
        player: { id: 'a', position: { x: 0, y: 0, z: 0 } },
      }),
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
