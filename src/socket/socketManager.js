const config = require('../config/gameConfig');
const GameState = require('../models/GameState');
const { getRandomColor } = require('../utils/colorUtils');

class SocketManager {
  constructor(io) {
    this.io = io;
    this.gameState = new GameState();
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);
      
      this.handlePlayerJoin(socket);
      this.handlePlayerMovement(socket);
      this.handleBallCollection(socket);
      this.handlePlayerDisconnect(socket);
    });
  }

  handlePlayerJoin(socket) {
    socket.on('joinGame', (playerData) => {
      if (!this.validatePlayerData(playerData)) {
        socket.emit('error', { message: 'Invalid player data' });
        return;
      }

      const startX = (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE;
      const startZ = (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE;
      
      // Check if the player already exists in the game state
      const existingPlayer = this.gameState.players[socket.id];
      const existingColor = existingPlayer ? existingPlayer.color : null;
      
      const playerInfo = {
        nickname: playerData.nickname.trim() || `Player-${socket.id.substr(0, 4)}`,
        position: { x: startX, y: 0, z: startZ },
        color: existingColor || getRandomColor()
      };

      this.gameState.addPlayer(socket.id, playerInfo);
      
      socket.emit('worldInfo', {
        worldSize: config.WORLD_SIZE,
        ballCount: config.BALL_COUNT
      });
      
      socket.emit('playerInfo', this.gameState.players[socket.id]);
      socket.emit('currentPlayers', this.gameState.players);
      socket.emit('newBalls', this.gameState.getUncollectedBalls());
      
      socket.broadcast.emit('newPlayer', this.gameState.players[socket.id]);
      this.io.emit('playerCount', Object.keys(this.gameState.players).length);
    });
  }

  handlePlayerMovement(socket) {
    socket.on('playerMovement', (movementData) => {
      if (!this.validateMovementData(movementData)) {
        socket.emit('error', { message: 'Invalid movement data' });
        return;
      }

      if (this.gameState.players[socket.id]) {
        this.gameState.players[socket.id].position = movementData.position;
        this.gameState.players[socket.id].lastUpdate = Date.now();
        
        socket.broadcast.emit('playerMoved', {
          id: socket.id,
          position: this.gameState.players[socket.id].position
        });
      }
    });
  }

  handleBallCollection(socket) {
    socket.on('collectBall', (data) => {
      if (!this.validateBallData(data)) {
        socket.emit('error', { message: 'Invalid ball data' });
        return;
      }

      const ball = this.gameState.balls.find(b => b.id === data.ballId && !b.collected);
      
      if (!ball) {
        socket.emit('error', { message: 'Ball not found or already collected' });
        return;
      }

      if (this.isPlayerInRange(socket.id, ball)) {
        ball.collected = true;
        
        this.gameState.updatePlayerScore(socket.id, ball.value);
        
        this.io.emit('gameState', {
          players: this.gameState.players,
          balls: this.gameState.balls
        });
        
        const scores = {};
        Object.keys(this.gameState.players).forEach(pid => {
          scores[pid] = this.gameState.players[pid].score;
        });
        this.io.emit('updateScores', scores);
        
        setTimeout(() => {
          const newBall = this.gameState.createNewBall();
          this.io.emit('newBalls', [newBall]);
        }, config.RESPAWN_DELAY);
      }
    });
  }

  handlePlayerDisconnect(socket) {
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      
      if (this.gameState.players[socket.id]) {
        this.gameState.removePlayer(socket.id);
        socket.broadcast.emit('playerDisconnected', socket.id);
        this.io.emit('playerCount', Object.keys(this.gameState.players).length);
      }
    });
  }

  validatePlayerData(playerData) {
    return playerData && 
           typeof playerData.nickname === 'string' && 
           playerData.nickname.trim().length <= 20;
  }

  validateMovementData(movementData) {
    return movementData && 
           movementData.position &&
           typeof movementData.position.x === 'number' &&
           typeof movementData.position.y === 'number' &&
           typeof movementData.position.z === 'number' &&
           Math.abs(movementData.position.x) <= config.WORLD_SIZE * 1.2 &&
           Math.abs(movementData.position.z) <= config.WORLD_SIZE * 1.2;
  }

  validateBallData(data) {
    return data && data.ballId;
  }

  isPlayerInRange(playerId, ball) {
    const playerPos = this.gameState.players[playerId].position;
    const ballPos = ball.position;
    const distance = Math.sqrt(
      Math.pow(playerPos.x - ballPos.x, 2) + 
      Math.pow(playerPos.z - ballPos.z, 2)
    );
    return distance <= 5;
  }
}

module.exports = SocketManager; 