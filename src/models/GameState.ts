import { ArenaPhysics } from './ArenaPhysics';
import type {
  BallState,
  GameConfig,
  PlayerState,
  SerializedBall,
  SerializedPlayer,
  Vector3,
} from './contracts';

class GameState {
  config: GameConfig;
  players: Record<string, PlayerState>;
  balls: Record<string, BallState>;
  topScore: number;
  topScorePlayer: string | null;
  ballSequence: number;
  socketToPlayerId: Map<string, string>;
  playerReconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  arenaPhysics: ArenaPhysics;
  isNightMode: boolean = false;

  constructor(config: GameConfig) {
    this.config = config;
    this.players = {};
    this.balls = {};
    this.topScore = 0;
    this.topScorePlayer = null;
    this.ballSequence = 0;
    this.socketToPlayerId = new Map();
    this.playerReconnectTimers = new Map();
    this.arenaPhysics = new ArenaPhysics(config);

    this.generateInitialBalls();
  }

  sanitizeNickname(input: unknown): string {
    if (typeof input !== 'string') return '';

    const cleaned = input
      .trim()
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, this.config.PLAYER_NAME_MAX_LENGTH);

    if (cleaned.length >= this.config.PLAYER_NAME_MIN_LENGTH) {
      return cleaned;
    }

    return '';
  }

  getWorldInfo(): { worldSize: number; ballCount: number; isNightMode: boolean; } {
    return {
      worldSize: this.config.WORLD_SIZE,
      ballCount: this.getTargetBallCount(),
      isNightMode: this.isNightMode,
    };
  }

  getPlayerCount(): number {
    return this.getConnectedPlayers().length;
  }

  getScoreMap(): Record<string, number> {
    this.refreshAllTimedStates();
    return Object.fromEntries(
      this.getConnectedPlayers().map((player) => [player.id, player.score]),
    );
  }

  getPlayersSnapshot(): Record<string, SerializedPlayer> {
    this.refreshAllTimedStates();
    return Object.fromEntries(
      this.getConnectedPlayers().map((player) => [player.id, this.serializePlayer(player)]),
    );
  }

  getActiveBalls(): SerializedBall[] {
    return Object.values(this.balls).map((ball) => this.serializeBall(ball));
  }

  getPlayer(socketId: string): PlayerState | null {
    const playerId = this.resolvePlayerId(socketId);
    if (!playerId) return null;
    return this.players[playerId] || null;
  }

  getConnectedPlayers(): PlayerState[] {
    return Object.values(this.players).filter((player) => player.connected !== false);
  }

  resolvePlayerId(socketId: string): string | null {
    return this.socketToPlayerId.get(socketId) || null;
  }

  makePlayerId(requestedId: unknown): string {
    if (
      typeof requestedId === 'string'
      && requestedId.length >= 8
      && requestedId.length <= 80
    ) {
      return requestedId;
    }

    return `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  cancelPendingRemoval(playerId: string): void {
    const timer = this.playerReconnectTimers.get(playerId);
    if (!timer) return;

    clearTimeout(timer);
    this.playerReconnectTimers.delete(playerId);
  }

  schedulePlayerRemoval(playerId: string): void {
    this.cancelPendingRemoval(playerId);

    const timer = setTimeout(() => {
      this.expireDisconnectedPlayer(playerId);
    }, this.config.PLAYER_RECONNECT_GRACE_MS);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    this.playerReconnectTimers.set(playerId, timer);
  }

  expireDisconnectedPlayer(playerId: string): SerializedPlayer | null {
    const player = this.players[playerId];
    if (!player || player.connected !== false) {
      this.playerReconnectTimers.delete(playerId);
      return null;
    }

    delete this.players[playerId];
    this.playerReconnectTimers.delete(playerId);
    if (player.socketId) {
      this.socketToPlayerId.delete(player.socketId);
    }
    this.recalculateTopScore();

    return this.serializePlayer(player);
  }

  getTargetBallCount(): number {
    const playerCount = this.getConnectedPlayers().length;
    const target = this.config.MIN_BALL_COUNT + (playerCount * this.config.BALLS_PER_PLAYER);
    return Math.min(target, this.config.MAX_BALL_COUNT);
  }

  generateInitialBalls(): void {
    this.balls = {};
    const target = this.getTargetBallCount();
    for (let i = 0; i < target; i += 1) {
      const ball = this.createBall();
      this.balls[ball.id] = ball;
    }
  }

  createBall(): BallState {
    const r = Math.random();
    let typeName = 'NORMAL';

    if (this.isNightMode && r < 0.02) {
      typeName = 'DAY_MODE';
    } else if (!this.isNightMode && r < 0.01) {
      typeName = 'NIGHT_MODE';
    } else {
      const nonModeTypes = Object.keys(this.config.BALL_TYPES).filter((k) => k !== 'DAY_MODE' && k !== 'NIGHT_MODE' && k !== 'INFINITY_DASHES');
      if (Math.random() < this.config.INFINITY_DASHES_CHANCE) {
        typeName = 'INFINITY_DASHES';
      } else {
        typeName = nonModeTypes[Math.floor(Math.random() * nonModeTypes.length)];
      }
    }

    const type = this.config.BALL_TYPES[typeName];
    const position = this.getRandomArenaPosition(
      this.config.BALL_CLEARANCE,
      this.config.BALL_EDGE_MARGIN,
    );

    this.ballSequence += 1;

    return {
      id: `ball-${this.ballSequence}-${Date.now()}`,
      type: typeName,
      value: type.value,
      color: type.color,
      position: {
        x: position.x,
        y: 0,
        z: position.z,
      },
    };
  }

  maintainBallCount(): { spawned: SerializedBall[]; despawned: string[] } {
    const target = this.getTargetBallCount();
    const currentBalls = Object.keys(this.balls);
    const result = { spawned: [] as SerializedBall[], despawned: [] as string[] };

    if (currentBalls.length < target) {
      for (let i = currentBalls.length; i < target; i += 1) {
        const ball = this.createBall();
        this.balls[ball.id] = ball;
        result.spawned.push(this.serializeBall(ball));
      }
    } else if (currentBalls.length > target) {
      const toDespawn = currentBalls.length - target;
      for (let i = 0; i < toDespawn; i += 1) {
        const ballId = currentBalls[i];
        delete this.balls[ballId];
        result.despawned.push(ballId);
      }
    }

    return result;
  }

  respawnBall(): SerializedBall | null {
    if (Object.keys(this.balls).length >= this.getTargetBallCount()) {
      return null;
    }
    const ball = this.createBall();
    this.balls[ball.id] = ball;
    return this.serializeBall(ball);
  }

  joinPlayer(socketId: string, nickname: unknown, requestedPlayerId: unknown): { player?: SerializedPlayer; error?: string } {
    const sanitizedNickname = this.sanitizeNickname(nickname);
    if (!sanitizedNickname) {
      return { error: 'Invalid nickname' };
    }

    const playerId = this.makePlayerId(requestedPlayerId);
    let player = this.players[playerId];
    if (!player) {
      player = this.createPlayer(playerId, sanitizedNickname, socketId);
      this.players[playerId] = player;
    } else {
      if (player.socketId && player.socketId !== socketId) {
        this.socketToPlayerId.delete(player.socketId);
      }
      this.cancelPendingRemoval(playerId);
      player.nickname = sanitizedNickname;
      player.socketId = socketId;
      player.connected = true;
      player.lastUpdate = Date.now();
    }

    this.socketToPlayerId.set(socketId, player.id);

    return { player: this.serializePlayer(player) };
  }

  createPlayer(playerId: string, nickname: string, socketId: string): PlayerState {
    const spawn = this.getSpawnPosition();

    return {
      id: playerId,
      nickname,
      socketId,
      connected: true,
      color: this.getPlayerColor(),
      position: {
        x: spawn.x,
        y: 0,
        z: spawn.z,
      },
      score: 0,
      invulnerableUntil: 0,
      speedBoostUntil: 0,
      dashCooldownUntil: 0,
      dashUnlimitedUntil: 0,
      lastUpdate: Date.now(),
    };
  }

  activateDash(socketId: string, now = Date.now()): { player?: SerializedPlayer; dashCooldownUntil?: number; error?: string } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: 'Player not found' };
    }

    this.refreshPlayerTimedState(player, now);
    const cooldownUntil = player.dashCooldownUntil || 0;
    const dashUnlimitedUntil = player.dashUnlimitedUntil || 0;
    if (cooldownUntil > now && dashUnlimitedUntil <= now) {
      return {
        error: 'Dash on cooldown',
        dashCooldownUntil: cooldownUntil,
      };
    }

    player.dashCooldownUntil = now + this.config.DASH_COOLDOWN_MS;
    player.invulnerableUntil = Math.max(
      player.invulnerableUntil || 0,
      now + this.config.DASH_INVULNERABLE_MS,
    );
    player.lastUpdate = now;

    return {
      player: this.serializePlayer(player, now),
      dashCooldownUntil: player.dashCooldownUntil,
    };
  }

  updatePlayerPosition(socketId: string, nextPosition: Vector3 | null | undefined): {
    player?: SerializedPlayer;
    corrected?: boolean;
    error?: string;
  } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: 'Player not found' };
    }

    if (
      !nextPosition
      || typeof nextPosition.x !== 'number'
      || typeof nextPosition.y !== 'number'
      || typeof nextPosition.z !== 'number'
      || Number.isNaN(nextPosition.x)
      || Number.isNaN(nextPosition.y)
      || Number.isNaN(nextPosition.z)
    ) {
      return { error: 'Invalid movement data' };
    }

    const now = Date.now();
    this.refreshAllTimedStates(now);

    const currentArenaPosition = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
    };
    const nextArenaPosition = {
      x: nextPosition.x,
      y: 0,
      z: nextPosition.z,
    };
    const correctedByArena = this.resolveArenaSlide(currentArenaPosition, nextArenaPosition, this.getPlayerRadius(player));
    const correctedByPosts = this.resolvePostCollisions(currentArenaPosition, nextArenaPosition, this.getPlayerRadius(player));
    player.position = nextArenaPosition;
    player.lastUpdate = now;

    const corrected = this.resolvePlayerPush(player.id);
    return { player: this.serializePlayer(player, now), corrected: corrected || correctedByArena || correctedByPosts };
  }

  collectBall(socketId: string, ballId: string): {
    ball?: SerializedBall;
    awardedValue?: number;
    scaledValue?: number;
    player?: SerializedPlayer;
    scores?: Record<string, number>;
    topScore?: number;
    topScorePlayer?: string | null;
    error?: string;
  } {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { error: 'Player not found' };
    }

    if (!ballId || typeof ballId !== 'string') {
      return { error: 'Invalid ball data' };
    }

    const ball = this.balls[ballId];
    if (!ball) {
      return { error: 'Ball not found' };
    }

    const dx = player.position.x - ball.position.x;
    const dz = player.position.z - ball.position.z;
    const distance = Math.sqrt((dx * dx) + (dz * dz));
    if (distance > this.config.MAX_COLLECTION_DISTANCE) {
      return { error: 'Ball too far to collect' };
    }

    const now = Date.now();
    this.refreshPlayerTimedState(player, now);

    delete this.balls[ballId];

    const scoreBefore = player.score;
    // Usar valor escalado baseado no score relativo do jogador
    const scaledValue = this.getScaledBallValue(ball.value, player.score);
    player.score += scaledValue;
    const awardedValue = player.score - scoreBefore;
    if (ball.type === 'SPEED') {
      player.speedBoostUntil = now + this.config.SPEED_BOOST_DURATION_MS;
    } else if (ball.type === 'INFINITY_DASHES') {
      player.dashUnlimitedUntil = now + this.config.INFINITY_DASHES_DURATION_MS;
    } else if (ball.type === 'NIGHT_MODE') {
      this.isNightMode = true;
    } else if (ball.type === 'DAY_MODE') {
      this.isNightMode = false;
    }
    
    player.lastUpdate = now;

    this.recalculateTopScore();

    // Retornar o valor escalado para informar ao cliente
    // (será sobrescrito no return statement abaixo)

    return {
      ball: this.serializeBall(ball),
      awardedValue,
      scaledValue: scaledValue,
      player: this.serializePlayer(player, now),
      scores: this.getScoreMap(),
      topScore: this.topScore,
      topScorePlayer: this.topScorePlayer,
    };
  }

  removePlayer(socketId: string): SerializedPlayer | null {
    const playerId = this.resolvePlayerId(socketId);
    if (!playerId) {
      return null;
    }

    const player = this.players[playerId];
    if (!player) {
      return null;
    }

    this.socketToPlayerId.delete(socketId);
    if (player.socketId === socketId) {
      player.socketId = null;
    }
    player.connected = false;
    player.disconnectedAt = Date.now();
    player.lastUpdate = Date.now();
    this.schedulePlayerRemoval(playerId);

    return this.serializePlayer(player);
  }

  serializePlayer(player: PlayerState, now = Date.now()): SerializedPlayer {
    this.refreshPlayerTimedState(player, now);
    return {
      id: player.id,
      nickname: player.nickname,
      color: player.color,
      score: player.score,
      sizeMultiplier: this.getPlayerScale(player.score),
      invulnerableUntil: player.invulnerableUntil || 0,
      speedBoostUntil: player.speedBoostUntil || 0,
      dashCooldownUntil: player.dashCooldownUntil || 0,
      dashUnlimitedUntil: player.dashUnlimitedUntil || 0,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
    };
  }

  serializeBall(ball: BallState): SerializedBall {
    return {
      id: ball.id,
      type: ball.type,
      value: ball.value,
      color: ball.color,
      position: {
        x: ball.position.x,
        y: ball.position.y,
        z: ball.position.z,
      },
    };
  }

  getPlayerScale(score: number): number {
    const ballsCollected = score / this.config.DEFAULT_BALL_VALUE;
    return Math.min(
      1 + (ballsCollected * this.config.SIZE_INCREASE_PER_BALL),
      this.config.MAX_SIZE_MULTIPLIER,
    );
  }

  getPlayerRadius(player: PlayerState): number {
    return this.config.PLAYER_BASE_RADIUS * this.getPlayerScale(player.score);
  }

  refreshAllTimedStates(now = Date.now()): void {
    Object.values(this.players).forEach((player) => {
      this.refreshPlayerTimedState(player, now);
    });
  }

  refreshPlayerTimedState(player: PlayerState | null | undefined, now = Date.now()): void {
    if (!player) return;

    if (player.invulnerableUntil && player.invulnerableUntil <= now) {
      player.invulnerableUntil = 0;
    }

    if (player.speedBoostUntil && player.speedBoostUntil <= now) {
      player.speedBoostUntil = 0;
    }

    if (player.dashUnlimitedUntil && player.dashUnlimitedUntil <= now) {
      player.dashUnlimitedUntil = 0;
    }
  }

  isInvulnerable(player: PlayerState | null | undefined, now = Date.now()): boolean {
    this.refreshPlayerTimedState(player, now);
    return (player?.invulnerableUntil || 0) > now;
  }

  respawnPlayer(playerId: string, now = Date.now()): PlayerState | null {
    const player = this.players[playerId];
    if (!player) return null;

    const spawn = this.getSpawnPosition(playerId);
    player.position = {
      x: spawn.x,
      y: 0,
      z: spawn.z,
    };
    player.score = 0;
    player.speedBoostUntil = 0;
    player.invulnerableUntil = now + this.config.PLAYER_RESPAWN_INVULNERABLE_MS;
    player.dashCooldownUntil = now;
    player.dashUnlimitedUntil = 0;
    player.lastUpdate = now;

    return player;
  }

  resolvePlayerPush(movedPlayerId: string): boolean {
    const movedPlayer = this.players[movedPlayerId];
    if (!movedPlayer) return false;

    let corrected = false;
    const movedRadius = this.getPlayerRadius(movedPlayer);

    Object.values(this.players).forEach((otherPlayer) => {
      if (otherPlayer.id === movedPlayerId) return;

      const otherRadius = this.getPlayerRadius(otherPlayer);
      const minDistance = movedRadius + otherRadius + this.config.PLAYER_COLLISION_PADDING;
      let dx = movedPlayer.position.x - otherPlayer.position.x;
      let dz = movedPlayer.position.z - otherPlayer.position.z;
      let distance = Math.sqrt((dx * dx) + (dz * dz));

      if (distance >= minDistance) {
        return;
      }

      if (distance < 0.0001) {
        dx = movedPlayer.id > otherPlayer.id ? 1 : -1;
        dz = 0;
        distance = 1;
      }

      const overlap = minDistance - distance;
      movedPlayer.position.x += (dx / distance) * overlap;
      movedPlayer.position.z += (dz / distance) * overlap;
      this.clampPositionToArena(movedPlayer.position, movedRadius);
      corrected = true;
    });

    return corrected;
  }

  recalculateTopScore(): void {
    let topScore = 0;
    let topScorePlayer = null;

    this.getConnectedPlayers().forEach((player) => {
      if (player.score > topScore) {
        topScore = player.score;
        topScorePlayer = player.id;
      }
    });

    this.topScore = topScore;
    this.topScorePlayer = topScorePlayer;
  }

  // Calcula o valor escalado de uma bola para um jogador específico
  // Quanto menor o score relativo, maior o valor da bola (permite comeback)
  getScaledBallValue(baseValue: number, playerScore: number): number {
    const connectedPlayers = this.getConnectedPlayers().length;
    const maxScore = this.topScore || 0;
    const safeScore = Math.max(0, playerScore || 0);

    // Primeira coleta pode manter valor base; a partir dai, escala sempre.
    if (maxScore === 0 && safeScore === 0) {
      return baseValue;
    }

    // Crescimento perceptivel em solo e tambem em multiplayer conforme score sobe.
    const progressionBonus = Math.min(
      1.1,
      0.12 + (safeScore / (this.config.DEFAULT_BALL_VALUE * 25)),
    );

    // Bonus de comeback para quem esta atras do lider.
    const comebackBonus = maxScore > 0
      ? Math.max(0, (maxScore - safeScore) / Math.max(1, maxScore)) * 1.2
      : 0;

    const multiplier = connectedPlayers <= 1
      ? 1 + progressionBonus
      : 1 + progressionBonus + comebackBonus;

    const scaled = Math.ceil(baseValue * multiplier);
    return Math.max(baseValue + 1, scaled);
  }

  getRandomArenaPosition(clearance: number, edgeMargin = 6): { x: number; z: number } {
    const takenPositions = [
      ...Object.values(this.players).map((player) => player.position),
      ...Object.values(this.balls).map((ball) => ball.position),
    ];
    const limit = this.config.WORLD_SIZE - edgeMargin;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * limit;
      const candidate = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      };

      const valid = takenPositions.every((position) => {
        const dx = position.x - candidate.x;
        const dz = position.z - candidate.z;
        return Math.sqrt((dx * dx) + (dz * dz)) >= clearance;
      });

      if (valid) {
        return candidate;
      }
    }

    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackRadius = Math.sqrt(Math.random()) * limit;
    return {
      x: Math.cos(fallbackAngle) * fallbackRadius,
      z: Math.sin(fallbackAngle) * fallbackRadius,
    };
  }

  getSpawnPosition(excludedPlayerId: string | null = null): { x: number; z: number } {
    const near = Math.round(this.config.WORLD_SIZE * 0.28);
    const far = Math.round(this.config.WORLD_SIZE * 0.38);
    const slots = [
      { x: -near, z: -near },
      { x: near, z: -near },
      { x: -near, z: near },
      { x: near, z: near },
      { x: 0, z: -far },
      { x: 0, z: far },
      { x: -far, z: 0 },
      { x: far, z: 0 },
      { x: 0, z: 0 },
    ];

    const occupied = Object.values(this.players)
      .filter((player) => player.id !== excludedPlayerId)
      .map((player) => player.position);
    let bestSlot = slots[0];
    let bestDistance = -1;

    slots.forEach((slot) => {
      const nearestDistanceToPlayer = occupied.length
        ? Math.min(
            ...occupied.map((position) => {
              const dx = position.x - slot.x;
              const dz = position.z - slot.z;
              return Math.sqrt((dx * dx) + (dz * dz));
            }),
          )
        : Number.POSITIVE_INFINITY;
        
      const nearestDistanceToObstacle = Math.min(
        ...this.arenaPhysics.getArenaObstacleCircles().map((obs) => {
          const dx = obs.x - slot.x;
          const dz = obs.z - slot.z;
          return Math.sqrt((dx * dx) + (dz * dz)) - obs.radius;
        })
      );
      
      const nearestDistance = Math.min(nearestDistanceToPlayer, nearestDistanceToObstacle);

      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestSlot = slot;
      }
    });

    return bestSlot;
  }

  getPlayerColor(): number {
    const palette = this.config.PLAYER_COLORS;
    return palette[Math.floor(Math.random() * palette.length)];
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  getArenaLimit(radius = 0): number {
    return this.arenaPhysics.getArenaLimit(radius);
  }

  clampPositionToArena(position: Vector3, radius = 0, skin = this.config.ARENA_EDGE_SKIN || 0): Vector3 {
    return this.arenaPhysics.clampPositionToArena(position, radius, skin);
  }

  resolveArenaSlide(previousPosition: Vector3, nextPosition: Vector3, radius = 0): boolean {
    return this.arenaPhysics.resolveArenaSlide(previousPosition, nextPosition, radius);
  }

  getArenaPosts(): Array<{ x: number; z: number }> {
    return this.arenaPhysics.getArenaPosts();
  }

  resolveObstacleSlide(
    previousPosition: Vector3,
    nextPosition: Vector3,
    moverRadius: number,
    obstaclePosition: { x: number; z: number },
    obstacleRadius: number,
    skin = 0,
  ): boolean {
    return this.arenaPhysics.resolveObstacleSlide(
      previousPosition,
      nextPosition,
      moverRadius,
      obstaclePosition,
      obstacleRadius,
      skin,
    );
  }

  resolvePostCollisions(previousPosition: Vector3, nextPosition: Vector3, radius = 0): boolean {
    return this.arenaPhysics.resolvePostCollisions(previousPosition, nextPosition, radius);
  }

  isInsideArena(position: Vector3, radius = 0): boolean {
    return this.arenaPhysics.isInsideArena(position, radius);
  }
}

export default GameState;
