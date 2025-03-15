// managers/GameManager.js - Game state and logic
const Utils = require('../utils/Utils');

class GameManager {
  constructor(settings) {
    this.settings = settings;
    this.players = {};
    this.balls = [];
    this.topScore = 0;
    this.topScorePlayer = null;
    
    // Generate initial balls
    this.generateBalls();
  }
  
  /**
   * Generate initial set of balls
   */
  generateBalls() {
    console.log('Generating new set of balls...');
    this.balls = [];
    
    for (let i = 0; i < this.settings.BALL_COUNT; i++) {
      this.balls.push({
        id: `ball-${Date.now()}-${i}`,
        position: {
          x: (Math.random() * this.settings.WORLD_SIZE * 2) - this.settings.WORLD_SIZE,
          y: 0.5, // Slightly above the ground
          z: (Math.random() * this.settings.WORLD_SIZE * 2) - this.settings.WORLD_SIZE
        },
        collected: false,
        value: this.settings.BALL_TYPES.NORMAL.value
      });
    }
  }
  
  /**
   * Create a single new ball
   * @returns {Object} - The new ball object
   */
  createNewBall() {
    console.log('Creating a new ball');
    const types = Object.keys(this.settings.BALL_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const ballData = this.settings.BALL_TYPES[type];
    
    const newBall = {
      id: `ball-${Date.now()}`,
      position: {
        x: (Math.random() * this.settings.WORLD_SIZE * 2) - this.settings.WORLD_SIZE,
        y: 0.5,
        z: (Math.random() * this.settings.WORLD_SIZE * 2) - this.settings.WORLD_SIZE
      },
      collected: false,
      type: type,
      value: ballData.value,
      color: ballData.color
    };
    
    this.balls.push(newBall);
    return newBall;
  }
  
  /**
   * Get only the uncollected balls
   * @returns {Array} - Array of uncollected balls
   */
  getUncollectedBalls() {
    return this.balls.filter(ball => !ball.collected);
  }
  
  /**
   * Get current game state
   * @returns {Object} - Current game state
   */
  getGameState() {
    return {
      players: this.players,
      balls: this.getUncollectedBalls(),
      topScore: this.topScore,
      topScorePlayer: this.topScorePlayer ? this.topScorePlayer : null
    };
  }
  
  /**
   * Add a new player to the game
   * @param {string} id - Player's socket ID
   * @param {string} nickname - Player's nickname
   * @returns {Object} - Player object
   */
  addPlayer(id, nickname) {
    const startX = (Math.random() * this.settings.WORLD_SIZE * 2) - this.settings.WORLD_SIZE;
    const startZ = (Math.random() * this.settings.WORLD_SIZE * 2) - this.settings.WORLD_SIZE;
    
    this.players[id] = {
      id,
      nickname,
      position: { x: startX, y: 0, z: startZ },
      color: Utils.getRandomColor(),
      score: 0,
      lastUpdate: Date.now()
    };
    
    return this.players[id];
  }
  
  /**
   * Update a player's position
   * @param {string} playerId - Player's socket ID
   * @param {Object} position - New position
   * @returns {boolean} - Whether the update was successful
   */
  updatePlayerPosition(playerId, position) {
    if (!this.players[playerId]) return false;
    
    // Validate position bounds
    const maxBound = this.settings.WORLD_SIZE * 1.2; // Allow slight buffer
    if (Math.abs(position.x) > maxBound || Math.abs(position.z) > maxBound) {
      return false;
    }
    
    this.players[playerId].position = position;
    this.players[playerId].lastUpdate = Date.now();
    return true;
  }
  
  /**
   * Remove a player from the game
   * @param {string} playerId - Player's socket ID
   */
  removePlayer(playerId) {
    if (this.players[playerId]) {
      delete this.players[playerId];
    }
  }
  
  /**
   * Validate ball collection
   * @param {string} playerId - Player's socket ID
   * @param {string} ballId - Ball ID
   * @returns {boolean} - Whether the collection is valid
   */
  validateBallCollection(playerId, ballId) {
    const player = this.players[playerId];
    const ball = this.balls.find(b => b.id === ballId && !b.collected);
    
    if (!player || !ball) return false;
    
    // Calculate distance between player and ball
    const distance = Math.sqrt(
      Math.pow(player.position.x - ball.position.x, 2) + 
      Math.pow(player.position.z - ball.position.z, 2)
    );
    
    // Check if player is within collection distance
    return distance <= this.settings.MAX_COLLECTION_DISTANCE;
  }
  
  /**
   * Process a ball collection
   * @param {string} playerId - Player's socket ID
   * @param {string} ballId - Ball ID
   * @returns {Object|null} - Ball and player info if collection successful, null otherwise
   */
  collectBall(playerId, ballId) {
    if (!this.validateBallCollection(playerId, ballId)) {
      return null;
    }
    
    const ball = this.balls.find(b => b.id === ballId);
    if (!ball) return null;
    
    // Mark the ball as collected
    ball.collected = true;
    
    // Update player score
    this.players[playerId].score += ball.value;
    
    // Check if this is a new top score
    if (this.players[playerId].score > this.topScore) {
      this.topScore = this.players[playerId].score;
      this.topScorePlayer = playerId;
    }
    
    return {
      ballId,
      playerId,
      value: ball.value
    };
  }
  
  /**
   * Get all player scores
   * @returns {Object} - Player scores by ID
   */
  getAllScores() {
    const scores = {};
    Object.keys(this.players).forEach(pid => {
      scores[pid] = this.players[pid].score;
    });
    return scores;
  }
  
  /**
   * Get the count of connected players
   * @returns {number} - Player count
   */
  getPlayerCount() {
    return Object.keys(this.players).length;
  }
}

module.exports = GameManager;