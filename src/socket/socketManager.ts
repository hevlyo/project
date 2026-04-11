import config from '../config/gameConfig';
import GameState from '../models/GameState';
import type { SerializedPlayer } from '../models/contracts';

interface SocketLike {
  id: string;
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  broadcast: {
    emit(event: string, payload: unknown): void;
  };
}

interface IoLike {
  on(event: 'connection', handler: (socket: SocketLike) => void): void;
  emit(event: string, payload: unknown): void;
}

class SocketManager {
  io: IoLike;
  gameState;
  lastMovementAt: Map<string, number>;
  lastCollectionAt: Map<string, number>;
  initialized: boolean;

  constructor(io: IoLike, gameState = new GameState(config)) {
    if (!io || typeof io.on !== 'function') {
      throw new TypeError('SocketManager requires a Socket.IO server instance');
    }

    this.io = io;
    this.gameState = gameState;
    this.lastMovementAt = new Map();
    this.lastCollectionAt = new Map();
    this.initialized = false;
    this.initialize();
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);

      socket.on('joinGame', (playerData) => this.handleJoinGame(socket, playerData));
      socket.on('playerMovement', (movementData) => this.handlePlayerMovement(socket, movementData));
      socket.on('collectBall', (data) => this.handleBallCollection(socket, data));
      socket.on('playerDash', () => this.handlePlayerDash(socket));
      socket.on('disconnect', () => this.handlePlayerDisconnect(socket));
    });
  }

  emitScores() {
    this.io.emit('updateScores', this.gameState.getScoreMap());
  }

  emitError(targetSocket: SocketLike, message: string) {
    targetSocket.emit('error', { message });
  }

  emitPlayerState(targetSocket: SocketLike, player: SerializedPlayer, syncMode: string) {
    targetSocket.emit('playerState', {
      ...player,
      syncMode,
    });
  }

  destroy() {
    // no-op for now
  }

  handleJoinGame(socket: SocketLike, playerData: { nickname?: unknown; sessionId?: unknown } | undefined) {
    const result = this.gameState.joinPlayer(
      socket.id,
      playerData?.nickname,
      playerData?.sessionId,
    );
    if (result.error) {
      this.emitError(socket, result.error);
      return;
    }

    const maintenance = this.gameState.maintainBallCount();
    if (maintenance.spawned.length > 0) {
      this.io.emit('newBalls', maintenance.spawned);
    }

    socket.emit('worldInfo', this.gameState.getWorldInfo());
    socket.emit('playerInfo', result.player);
    socket.emit('currentPlayers', this.gameState.getPlayersSnapshot());
    socket.emit('newBalls', this.gameState.getActiveBalls());

    socket.broadcast.emit('newPlayer', result.player);
    this.io.emit('playerCount', this.gameState.getPlayerCount());
    this.emitScores();
  }

  handlePlayerMovement(socket: SocketLike, movementData: { position?: { x: number; y: number; z: number } } | undefined) {
    const now = Date.now();
    const last = this.lastMovementAt.get(socket.id) || 0;
    if (now - last < config.MOVEMENT_THROTTLE_MS) return;
    this.lastMovementAt.set(socket.id, now);

    const result = this.gameState.updatePlayerPosition(socket.id, movementData?.position);
    if (result.error) {
      this.emitError(socket, result.error);
      return;
    }

    socket.broadcast.emit('playerMoved', {
      id: result.player.id,
      position: result.player.position,
    });

    if (result.corrected) {
      this.emitPlayerState(socket, result.player, 'corrected');
    }
  }

  handleBallCollection(socket: SocketLike, data: { ballId?: string } | undefined) {
    const now = Date.now();
    const last = this.lastCollectionAt.get(socket.id) || 0;
    if (now - last < config.COLLECTION_THROTTLE_MS) return;
    this.lastCollectionAt.set(socket.id, now);

    const result = this.gameState.collectBall(socket.id, data?.ballId);
    if (result.error) {
      this.emitError(socket, result.error);
      return;
    }

    this.io.emit('ballCollected', {
      ballId: result.ball.id,
      playerId: result.player.id,
      value: result.awardedValue,
      color: result.ball.color,
      type: result.ball.type,
      position: result.ball.position,
      sizeMultiplier: result.player.sizeMultiplier,
    });
    this.io.emit('updateScores', result.scores);
    this.io.emit('playerState', {
      ...result.player,
      syncMode: 'score',
    });

    setTimeout(() => {
      const newBall = this.gameState.respawnBall();
      if (newBall) {
        this.io.emit('newBalls', [newBall]);
      }
    }, config.RESPAWN_DELAY);
  }

  handlePlayerDash(socket: SocketLike) {
    const result = this.gameState.activateDash(socket.id);
    if (result.error) {
      if (result.dashCooldownUntil) {
        const player = this.gameState.getPlayer(socket.id);
        if (!player) return;
        this.emitPlayerState(socket, this.gameState.serializePlayer(player, Date.now()), 'dash-cooldown');
      }
      return;
    }

    this.io.emit('playerState', {
      ...result.player,
      syncMode: 'dash',
    });
  }

  handlePlayerDisconnect(socket: SocketLike) {
    const removedPlayer = this.gameState.removePlayer(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
    if (!removedPlayer) return;

    this.lastMovementAt.delete(socket.id);
    this.lastCollectionAt.delete(socket.id);

    socket.broadcast.emit('playerDisconnected', removedPlayer.id);
    this.io.emit('playerCount', this.gameState.getPlayerCount());
    this.emitScores();

    const maintenance = this.gameState.maintainBallCount();
    if (maintenance.despawned.length > 0) {
      this.io.emit('removeBalls', maintenance.despawned);
    }
  }
}

export default SocketManager;
