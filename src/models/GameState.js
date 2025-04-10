const config = require('../config/gameConfig');

class GameState {
  constructor() {
    this.players = {};
    this.balls = [];
    this.topScore = 0;
    this.topScorePlayer = null;
    this.generateBalls();
  }

  generateBalls() {
    console.log('Generating new set of balls...');
    this.balls.length = 0;
    
    for (let i = 0; i < config.BALL_COUNT; i++) {
      this.balls.push({
        id: `ball-${Date.now()}-${i}`,
        position: {
          x: (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE,
          y: 0.5,
          z: (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE
        },
        collected: false,
        value: config.BALL_TYPES.NORMAL.value
      });
    }
  }

  createNewBall() {
    console.log('Creating a new ball');
    const types = Object.keys(config.BALL_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const ballData = config.BALL_TYPES[type];
    
    const newBall = {
      id: `ball-${Date.now()}`,
      position: {
        x: (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE,
        y: 0.5,
        z: (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE
      },
      collected: false,
      type: type,
      value: ballData.value,
      color: ballData.color
    };
    
    this.balls.push(newBall);
    return newBall;
  }

  getUncollectedBalls() {
    return this.balls.filter(ball => !ball.collected);
  }

  addPlayer(socketId, playerData) {
    this.players[socketId] = {
      id: socketId,
      nickname: playerData.nickname,
      position: playerData.position,
      color: playerData.color,
      score: 0,
      lastUpdate: Date.now()
    };
  }

  removePlayer(socketId) {
    delete this.players[socketId];
  }

  updatePlayerScore(socketId, points) {
    if (this.players[socketId]) {
      this.players[socketId].score += points;
      
      if (this.players[socketId].score > this.topScore) {
        this.topScore = this.players[socketId].score;
        this.topScorePlayer = socketId;
      }
    }
  }

  getGameState() {
    return {
      players: this.players,
      balls: this.getUncollectedBalls(),
      topScore: this.topScore,
      topScorePlayer: this.topScorePlayer
    };
  }
}

module.exports = GameState; 