const config = require('../config/gameConfig');
const GameState = require('../models/GameState');

class SocketManager {
  constructor(io, gameState = new GameState(config)) {
    if (!io || typeof io.on !== 'function') {
      throw new TypeError('SocketManager requires a Socket.IO server instance');
    }

    this.io = io;
    this.gameState = gameState;
    this.lastMovementAt = new Map();
    this.lastCollectionAt = new Map();
    this.initialized = false;
    this.consumptionInterval = null;
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
      socket.on('disconnect', () => this.handlePlayerDisconnect(socket));
    });

    this.consumptionInterval = setInterval(() => {
      this.checkAllPlayerConsumption();
    }, 500);
  }

  checkAllPlayerConsumption() {
    const now = Date.now();
    const consumed = this.gameState.checkPassiveConsumption(now);
    if (consumed) {
      this.io.emit('playerConsumed', {
        winner: consumed.winner,
        loser: consumed.loser,
        transferredScore: consumed.transferredScore,
        consumedPosition: consumed.consumedPosition,
      });
      this.io.emit('updateScores', this.gameState.getScoreMap());
    }
  }

  destroy() {
    if (this.consumptionInterval) {
      clearInterval(this.consumptionInterval);
      this.consumptionInterval = null;
    }
  }

  handleJoinGame(socket, playerData) {
    const result = this.gameState.joinPlayer(
      socket.id,
      playerData?.nickname,
      playerData?.sessionId,
    );
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    socket.emit('worldInfo', this.gameState.getWorldInfo());
    socket.emit('playerInfo', result.player);
    socket.emit('currentPlayers', this.gameState.getPlayersSnapshot());
    socket.emit('newBalls', this.gameState.getActiveBalls());

    socket.broadcast.emit('newPlayer', result.player);
    this.io.emit('playerCount', this.gameState.getPlayerCount());
    this.io.emit('updateScores', this.gameState.getScoreMap());
  }

  handlePlayerMovement(socket, movementData) {
    const now = Date.now();
    const last = this.lastMovementAt.get(socket.id) || 0;
    if (now - last < config.MOVEMENT_THROTTLE_MS) return;
    this.lastMovementAt.set(socket.id, now);

    const result = this.gameState.updatePlayerPosition(socket.id, movementData?.position);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    if (result.consumed) {
      this.io.emit('playerConsumed', {
        winner: result.consumed.winner,
        loser: result.consumed.loser,
        transferredScore: result.consumed.transferredScore,
        consumedPosition: result.consumed.consumedPosition,
      });
      this.io.emit('updateScores', result.scores);
      socket.emit('playerState', {
        ...result.player,
        syncMode: 'consumed',
      });
      return;
    }

    socket.broadcast.emit('playerMoved', {
      id: result.player.id,
      position: result.player.position,
    });

    if (result.corrected) {
      socket.emit('playerState', {
        ...result.player,
        syncMode: 'corrected',
      });
    }
  }

  handleBallCollection(socket, data) {
    const now = Date.now();
    const last = this.lastCollectionAt.get(socket.id) || 0;
    if (now - last < config.COLLECTION_THROTTLE_MS) return;
    this.lastCollectionAt.set(socket.id, now);

    const result = this.gameState.collectBall(socket.id, data?.ballId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    this.io.emit('ballCollected', {
      ballId: result.ball.id,
      playerId: result.player.id,
      value: result.ball.value,
      color: result.ball.color,
      type: result.ball.type,
      position: result.ball.position,
    });
    this.io.emit('updateScores', result.scores);
    this.io.emit('playerState', {
      ...result.player,
      syncMode: 'score',
    });

    setTimeout(() => {
      const newBall = this.gameState.respawnBall();
      this.io.emit('newBalls', [newBall]);
    }, config.RESPAWN_DELAY);
  }

  handlePlayerDisconnect(socket) {
    const removedPlayer = this.gameState.removePlayer(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
    if (!removedPlayer) return;

    this.lastMovementAt.delete(socket.id);
    this.lastCollectionAt.delete(socket.id);

    socket.broadcast.emit('playerDisconnected', removedPlayer.id);
    this.io.emit('playerCount', this.gameState.getPlayerCount());
    this.io.emit('updateScores', this.gameState.getScoreMap());
  }
}

module.exports = SocketManager;
