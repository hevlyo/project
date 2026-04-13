import type {
 SerializedBall, SerializedPlayer, SerializedProjectile, Vector3
} from '@pegabola/shared';
import config from '../config/gameConfig';
import GameState from '../models/GameState';

type SocketLike = {
  id: string;
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  broadcast: {
    emit(event: string, payload: unknown): void;
  };
}

type IoLike = {
  on(event: 'connection', handler: (socket: SocketLike) => void): void;
  emit(event: string, payload: unknown): void;
}

type JoinPlayerResult = {
  player?: SerializedPlayer;
  error?: string;
}

type UpdatePlayerPositionResult = {
  player?: SerializedPlayer;
  corrected?: boolean;
  error?: string;
}

type CollectBallResult = {
  ball?: SerializedBall;
  awardedValue?: number;
  player?: SerializedPlayer;
  scores?: Record<string, number>;
  error?: string;
}

type FireballAttackResult = {
  projectile?: SerializedProjectile;
  player?: SerializedPlayer;
  error?: string;
}

type CombatTickResult = {
  spawned: SerializedProjectile[];
  destroyed: string[];
  hits: Array<{
    projectile: SerializedProjectile;
    player: SerializedPlayer;
    damage: number;
    wasFatal: boolean;
  }>;
}

type GameStatePort = {
  joinPlayer(socketId: string, nickname: unknown, sessionId: unknown): JoinPlayerResult;
  maintainBallCount(): { spawned: SerializedBall[]; despawned: string[] };
  getWorldInfo(): { worldSize: number; ballCount: number; isNightMode: boolean };
  getPlayersSnapshot(): Record<string, SerializedPlayer>;
  getActiveBalls(): SerializedBall[];
  getActiveProjectiles(): SerializedProjectile[];
  getPlayerCount(): number;
  getScoreMap(): Record<string, number>;
  updatePlayerPosition(socketId: string, nextPosition: Vector3 | undefined): UpdatePlayerPositionResult;
  collectBall(socketId: string, ballId?: string): CollectBallResult;
  respawnBall(): SerializedBall | undefined;
  fireballAttack(socketId: string, direction: Vector3 | undefined): FireballAttackResult;
  advanceCombat(now?: number): CombatTickResult;
  activateDash(socketId: string): { player?: SerializedPlayer; dashCooldownUntil?: number; error?: string };
  getPlayer(socketId: string): ReturnType<GameState['getPlayer']>;
  serializePlayer(player: NonNullable<ReturnType<GameState['getPlayer']>>, now?: number): SerializedPlayer;
  removePlayer(socketId: string): SerializedPlayer | undefined;
}

class SocketManager {
  io: IoLike;
  gameState: GameStatePort;
  lastMovementAt: Map<string, number>;
  lastCollectionAt: Map<string, number>;
  combatTimer: ReturnType<typeof setInterval> | undefined;
  initialized: boolean;

  constructor(io: IoLike, gameState: GameStatePort = new GameState(config)) {
    if (!io || typeof io.on !== 'function') {
      throw new TypeError('SocketManager requires a Socket.IO server instance');
    }

    this.io = io;
    this.gameState = gameState;
    this.lastMovementAt = new Map();
    this.lastCollectionAt = new Map();
    this.combatTimer = null;
    this.initialized = false;
    this.initialize();
  }

  initialize() {
    if (this.initialized) {
return;
}

    this.initialized = true;

    this.io.on('connection', socket => {
      console.log(`Player connected: ${socket.id}`);

      socket.on('joinGame', playerData => {
 this.handleJoinGame(socket, playerData);
});
      socket.on('playerMovement', movementData => {
 this.handlePlayerMovement(socket, movementData);
});
      socket.on('collectBall', data => {
 this.handleBallCollection(socket, data);
});
      socket.on('playerAttack', data => {
 this.handlePlayerAttack(socket, data);
});
      socket.on('playerDash', () => {
 this.handlePlayerDash(socket);
});
      socket.on('disconnect', () => {
 this.handlePlayerDisconnect(socket);
});
    });

    this.combatTimer = globalThis.setInterval(() => {
      this.handleCombatTick();
    }, 50);
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
    if (this.combatTimer) {
      globalThis.clearInterval(this.combatTimer);
      this.combatTimer = null;
    }
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
    socket.emit('currentProjectiles', this.gameState.getActiveProjectiles());

    socket.broadcast.emit('newPlayer', result.player);
    this.io.emit('playerCount', this.gameState.getPlayerCount());
    this.emitScores();
  }

  handlePlayerMovement(socket: SocketLike, movementData: { position?: { x: number; y: number; z: number } } | undefined) {
    const now = Date.now();
    const last = this.lastMovementAt.get(socket.id) || 0;
    if (now - last < config.MOVEMENT_THROTTLE_MS) {
return;
}

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
    if (now - last < config.COLLECTION_THROTTLE_MS) {
return;
}

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

  handlePlayerAttack(socket: SocketLike, data: { direction?: Vector3 } | undefined) {
    const result = this.gameState.fireballAttack(socket.id, data?.direction);
    if (result.error) {
      if (result.player) {
        this.emitPlayerState(socket, result.player, 'attack-cooldown');
      } else {
        this.emitError(socket, result.error);
      }

      return;
    }

    if (result.projectile) {
      this.io.emit('projectileSpawned', result.projectile);
    }

    if (result.player) {
      this.io.emit('playerState', {
        ...result.player,
        syncMode: 'attack',
      });
    }
  }

  handleCombatTick() {
    const result = this.gameState.advanceCombat(Date.now());
    let hasFatalHit = false;

    for (const projectileId of result.destroyed) {
      this.io.emit('projectileDestroyed', { projectileId });
    }

    for (const hit of result.hits) {
      this.io.emit('fireballImpact', {
        projectileId: hit.projectile.id,
        playerId: hit.player.id,
        position: hit.projectile.position,
        color: hit.projectile.color,
        damage: hit.damage,
        wasFatal: hit.wasFatal,
      });
      this.io.emit('playerState', {
        ...hit.player,
        syncMode: hit.wasFatal ? 'respawn' : 'damage',
      });

      if (hit.wasFatal) {
        hasFatalHit = true;
      }
    }

    if (hasFatalHit) {
      this.emitScores();
    }
  }

  handlePlayerDash(socket: SocketLike) {
    const result = this.gameState.activateDash(socket.id);
    if (result.error) {
      if (result.dashCooldownUntil) {
        const player = this.gameState.getPlayer(socket.id);
        if (!player) {
return;
}

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
    if (!removedPlayer) {
return;
}

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
