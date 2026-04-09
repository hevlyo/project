class GameState {
  constructor(config) {
    this.config = config;
    this.players = {};
    this.balls = {};
    this.topScore = 0;
    this.topScorePlayer = null;
    this.ballSequence = 0;
    this.socketToPlayerId = new Map();
    this.playerReconnectTimers = new Map();

    this.generateInitialBalls();
  }

  sanitizeNickname(input) {
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

  getWorldInfo() {
    return {
      worldSize: this.config.WORLD_SIZE,
      ballCount: this.config.BALL_COUNT,
    };
  }

  getPlayerCount() {
    return this.getConnectedPlayers().length;
  }

  getScoreMap() {
    this.refreshAllTimedStates();
    return Object.fromEntries(
      this.getConnectedPlayers().map((player) => [player.id, player.score]),
    );
  }

  getPlayersSnapshot() {
    this.refreshAllTimedStates();
    return Object.fromEntries(
      this.getConnectedPlayers().map((player) => [player.id, this.serializePlayer(player)]),
    );
  }

  getActiveBalls() {
    return Object.values(this.balls).map((ball) => this.serializeBall(ball));
  }

  getPlayer(socketId) {
    const playerId = this.resolvePlayerId(socketId);
    if (!playerId) return null;
    return this.players[playerId] || null;
  }

  getConnectedPlayers() {
    return Object.values(this.players).filter((player) => player.connected !== false);
  }

  resolvePlayerId(socketId) {
    return this.socketToPlayerId.get(socketId) || null;
  }

  makePlayerId(requestedId) {
    if (
      typeof requestedId === 'string'
      && requestedId.length >= 8
      && requestedId.length <= 80
    ) {
      return requestedId;
    }

    return `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  cancelPendingRemoval(playerId) {
    const timer = this.playerReconnectTimers.get(playerId);
    if (!timer) return;

    clearTimeout(timer);
    this.playerReconnectTimers.delete(playerId);
  }

  schedulePlayerRemoval(playerId) {
    this.cancelPendingRemoval(playerId);

    const timer = setTimeout(() => {
      this.expireDisconnectedPlayer(playerId);
    }, this.config.PLAYER_RECONNECT_GRACE_MS);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    this.playerReconnectTimers.set(playerId, timer);
  }

  expireDisconnectedPlayer(playerId) {
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

  generateInitialBalls() {
    this.balls = {};
    for (let i = 0; i < this.config.BALL_COUNT; i += 1) {
      const ball = this.createBall();
      this.balls[ball.id] = ball;
    }
  }

  createBall() {
    const typeNames = Object.keys(this.config.BALL_TYPES);
    const typeName = typeNames[Math.floor(Math.random() * typeNames.length)];
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

  respawnBall() {
    const ball = this.createBall();
    this.balls[ball.id] = ball;
    return this.serializeBall(ball);
  }

  joinPlayer(socketId, nickname, requestedPlayerId) {
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

  createPlayer(playerId, nickname, socketId) {
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
      lastUpdate: Date.now(),
    };
  }

  updatePlayerPosition(socketId, nextPosition) {
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

    player.position = {
      x: this.clamp(nextPosition.x, -this.config.WORLD_SIZE, this.config.WORLD_SIZE),
      y: 0,
      z: this.clamp(nextPosition.z, -this.config.WORLD_SIZE, this.config.WORLD_SIZE),
    };
    player.lastUpdate = now;

    const consumed = this.resolvePlayerConsumption(player.id, now);
    if (consumed) {
      return {
        player: this.serializePlayer(this.players[player.id], now),
        consumed,
        scores: this.getScoreMap(),
      };
    }

    const corrected = this.resolvePlayerPush(player.id);
    return { player: this.serializePlayer(player, now), corrected };
  }

  collectBall(socketId, ballId) {
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

    player.score += ball.value;
    if (ball.type === 'SPEED') {
      player.speedBoostUntil = now + this.config.SPEED_BOOST_DURATION_MS;
    }
    player.lastUpdate = now;

    this.recalculateTopScore();

    return {
      ball: this.serializeBall(ball),
      player: this.serializePlayer(player, now),
      scores: this.getScoreMap(),
      topScore: this.topScore,
      topScorePlayer: this.topScorePlayer,
    };
  }

  removePlayer(socketId) {
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

  serializePlayer(player, now = Date.now()) {
    this.refreshPlayerTimedState(player, now);
    return {
      id: player.id,
      nickname: player.nickname,
      color: player.color,
      score: player.score,
      sizeMultiplier: this.getPlayerScale(player.score),
      invulnerableUntil: player.invulnerableUntil || 0,
      speedBoostUntil: player.speedBoostUntil || 0,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
    };
  }

  serializeBall(ball) {
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

  getPlayerScale(score) {
    const ballsCollected = score / this.config.DEFAULT_BALL_VALUE;
    return Math.min(
      1 + (ballsCollected * this.config.SIZE_INCREASE_PER_BALL),
      this.config.MAX_SIZE_MULTIPLIER,
    );
  }

  getPlayerRadius(player) {
    return this.config.PLAYER_BASE_RADIUS * this.getPlayerScale(player.score);
  }

  refreshAllTimedStates(now = Date.now()) {
    Object.values(this.players).forEach((player) => {
      this.refreshPlayerTimedState(player, now);
    });
  }

  refreshPlayerTimedState(player, now = Date.now()) {
    if (!player) return;

    if (player.invulnerableUntil && player.invulnerableUntil <= now) {
      player.invulnerableUntil = 0;
    }

    if (player.speedBoostUntil && player.speedBoostUntil <= now) {
      player.speedBoostUntil = 0;
    }
  }

  isInvulnerable(player, now = Date.now()) {
    this.refreshPlayerTimedState(player, now);
    return (player?.invulnerableUntil || 0) > now;
  }

  resolvePlayerConsumption(movedPlayerId, now = Date.now()) {
    const movedPlayer = this.players[movedPlayerId];
    if (!movedPlayer) return null;

    const candidates = [];

    Object.values(this.players).forEach((otherPlayer) => {
      if (otherPlayer.id === movedPlayerId) return;

      if (this.isInvulnerable(movedPlayer, now) || this.isInvulnerable(otherPlayer, now)) {
        return;
      }

      const movedRadius = this.getPlayerRadius(movedPlayer);
      const otherRadius = this.getPlayerRadius(otherPlayer);
      const dx = movedPlayer.position.x - otherPlayer.position.x;
      const dz = movedPlayer.position.z - otherPlayer.position.z;
      const distance = Math.sqrt((dx * dx) + (dz * dz));

      if (
        movedRadius >= (otherRadius * this.config.PLAYER_CONSUME_SIZE_RATIO)
        && distance <= movedRadius
      ) {
        candidates.push({
          winnerId: movedPlayer.id,
          loserId: otherPlayer.id,
          winnerRadius: movedRadius,
          distance,
        });
        return;
      }

      if (
        otherRadius >= (movedRadius * this.config.PLAYER_CONSUME_SIZE_RATIO)
        && distance <= otherRadius
      ) {
        candidates.push({
          winnerId: otherPlayer.id,
          loserId: movedPlayer.id,
          winnerRadius: otherRadius,
          distance,
        });
      }
    });

    if (!candidates.length) {
      return null;
    }

    candidates.sort((left, right) => {
      if (right.winnerRadius !== left.winnerRadius) {
        return right.winnerRadius - left.winnerRadius;
      }
      return left.distance - right.distance;
    });

    const selected = candidates[0];
    return this.consumePlayer(selected.winnerId, selected.loserId, now);
  }

  consumePlayer(winnerId, loserId, now = Date.now()) {
    const winner = this.players[winnerId];
    const loser = this.players[loserId];
    if (!winner || !loser) return null;

    const consumedPosition = {
      x: loser.position.x,
      y: loser.position.y,
      z: loser.position.z,
    };
    const transferredScore = Math.round(loser.score * this.config.PLAYER_SCORE_TRANSFER_RATIO);

    winner.score += transferredScore;
    winner.lastUpdate = now;

    this.respawnPlayer(loserId, now);
    this.recalculateTopScore();

    return {
      winner: this.serializePlayer(winner, now),
      loser: this.serializePlayer(this.players[loserId], now),
      transferredScore,
      consumedPosition,
    };
  }

  respawnPlayer(playerId, now = Date.now()) {
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
    player.lastUpdate = now;

    return player;
  }

  resolvePlayerPush(movedPlayerId) {
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
      movedPlayer.position.x = this.clamp(
        movedPlayer.position.x,
        -this.config.WORLD_SIZE,
        this.config.WORLD_SIZE,
      );
      movedPlayer.position.z = this.clamp(
        movedPlayer.position.z,
        -this.config.WORLD_SIZE,
        this.config.WORLD_SIZE,
      );
      corrected = true;
    });

    return corrected;
  }

  recalculateTopScore() {
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

  getRandomArenaPosition(clearance, edgeMargin = 6) {
    const takenPositions = [
      ...Object.values(this.players).map((player) => player.position),
      ...Object.values(this.balls).map((ball) => ball.position),
    ];
    const limit = this.config.WORLD_SIZE - edgeMargin;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = {
        x: (Math.random() * (limit * 2)) - limit,
        z: (Math.random() * (limit * 2)) - limit,
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

    return {
      x: (Math.random() * (limit * 2)) - limit,
      z: (Math.random() * (limit * 2)) - limit,
    };
  }

  getSpawnPosition(excludedPlayerId = null) {
    const slots = [
      { x: -14, z: -14 },
      { x: 14, z: -14 },
      { x: -14, z: 14 },
      { x: 14, z: 14 },
      { x: 0, z: -18 },
      { x: 0, z: 18 },
      { x: -18, z: 0 },
      { x: 18, z: 0 },
      { x: 0, z: 0 },
    ];

    const occupied = Object.values(this.players)
      .filter((player) => player.id !== excludedPlayerId)
      .map((player) => player.position);
    let bestSlot = slots[0];
    let bestDistance = -1;

    slots.forEach((slot) => {
      const nearestDistance = occupied.length
        ? Math.min(
            ...occupied.map((position) => {
              const dx = position.x - slot.x;
              const dz = position.z - slot.z;
              return Math.sqrt((dx * dx) + (dz * dz));
            }),
          )
        : Number.POSITIVE_INFINITY;

      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestSlot = slot;
      }
    });

    return bestSlot;
  }

  getPlayerColor() {
    const palette = this.config.PLAYER_COLORS;
    return palette[Math.floor(Math.random() * palette.length)];
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}

module.exports = GameState;
