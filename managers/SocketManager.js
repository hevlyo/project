// managers/SocketManager.js - Socket.IO event handling
const RateLimiter = require('../utils/RateLimiter');
const config = require('../config');

class SocketManager {
  constructor(io, gameManager) {
    this.io = io;
    this.gameManager = gameManager;
    
    // Create rate limiters
    this.movementLimiter = new RateLimiter(
      config.rateLimits.movement.points, 
      config.rateLimits.movement.duration
    );
    
    this.collectionLimiter = new RateLimiter(
      config.rateLimits.collection.points, 
      config.rateLimits.collection.duration
    );
  }
  
  /**
   * Initialize socket event listeners
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);
      
      // Handle player join with nickname
      socket.on('joinGame', (playerData) => this.handleJoinGame(socket, playerData));
      
      // Handle player movement
      socket.on('playerMovement', (movementData) => this.handlePlayerMovement(socket, movementData));
      
      // Handle ball collection
      socket.on('collectBall', (data) => this.handleBallCollection(socket, data));
      
      // Handle player disconnect
      socket.on('disconnect', () => this.handlePlayerDisconnect(socket));
    });
  }
  
  /**
   * Handle a player joining the game
   * @param {Socket} socket - Socket.IO socket instance
   * @param {Object} playerData - Player data including nickname
   */
  handleJoinGame(socket, playerData) {
    // Validate nickname
    if (!playerData || typeof playerData.nickname !== 'string') {
      socket.emit('error', { message: 'Invalid nickname' });
      return;
    }
    
    const nickname = playerData.nickname.trim() || `Player-${socket.id.substr(0, 4)}`;
    if (nickname.length > 15) {
      socket.emit('error', { message: 'Nickname too long' });
      return;
    }
    
    // Add player to game
    const player = this.gameManager.addPlayer(socket.id, nickname);
    console.log(`Player ${nickname} (${socket.id}) joined the game`);
    
    // Send world info to player
    socket.emit('worldInfo', {
      worldSize: config.gameSettings.WORLD_SIZE,
      ballCount: config.gameSettings.BALL_COUNT
    });
    
    // Send player their own info
    socket.emit('playerInfo', player);
    
    // Send existing players to the new player
    socket.emit('currentPlayers', this.gameManager.players);
    
    // Send existing balls to the new player
    const activeBalls = this.gameManager.getUncollectedBalls();
    socket.emit('newBalls', activeBalls);
    
    // Notify all other players of the new player
    socket.broadcast.emit('newPlayer', player);
    
    // Update player count for all clients
    this.io.emit('playerCount', this.gameManager.getPlayerCount());
  }
  
  /**
   * Handle player movement
   * @param {Socket} socket - Socket.IO socket instance
   * @param {Object} movementData - Movement data
   */
  handlePlayerMovement(socket, movementData) {
    if (!this.movementLimiter.tryConsume(socket.id)) {
      return;
    }
    
    if (!this.gameManager.players[socket.id]) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    // Validate position data
    if (!movementData || !movementData.position || 
        typeof movementData.position.x !== 'number' || 
        typeof movementData.position.y !== 'number' ||
        typeof movementData.position.z !== 'number') {
      socket.emit('error', { message: 'Invalid movement data' });
      return;
    }
    
    // Update player position
    const updated = this.gameManager.updatePlayerPosition(socket.id, movementData.position);
    
    if (updated) {
      // Broadcast updated player position
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: this.gameManager.players[socket.id].position
      });
    } else {
      socket.emit('error', { message: 'Position out of bounds' });
    }
  }
  
  /**
   * Handle ball collection
   * @param {Socket} socket - Socket.IO socket instance
   * @param {Object} data - Ball collection data
   */
  handleBallCollection(socket, data) {
    if (!this.collectionLimiter.tryConsume(socket.id)) {
      return;
    }
    
    if (!this.gameManager.players[socket.id]) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    if (!data || !data.ballId) {
      socket.emit('error', { message: 'Invalid ball data' });
      return;
    }

    const result = this.gameManager.collectBall(socket.id, data.ballId);
    
    if (result) {
      console.log(`Player ${this.gameManager.players[socket.id]?.nickname || socket.id} collected ball ${data.ballId}`);
      
      // Broadcast ball collection
      this.io.emit('ballCollected', result);
      
      // Broadcast updated scores
      this.io.emit('updateScores', this.gameManager.getAllScores());
      
      // Spawn a new ball after delay
      setTimeout(() => {
        const newBall = this.gameManager.createNewBall();
        this.io.emit('newBalls', [newBall]);
      }, config.gameSettings.RESPAWN_DELAY);
    } else {
      socket.emit('error', { message: 'Ball too far to collect' });
    }
  }
  
  /**
   * Handle player disconnect
   * @param {Socket} socket - Socket.IO socket instance
   */
  handlePlayerDisconnect(socket) {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Remove this player
    this.gameManager.removePlayer(socket.id);
    
    // Broadcast player disconnect to all other players
    socket.broadcast.emit('playerDisconnected', socket.id);
    
    // Update player count
    this.io.emit('playerCount', this.gameManager.getPlayerCount());
  }
  
  /**
   * Broadcast current game state to all clients
   */
  broadcastGameState() {
    this.io.emit('gameState', this.gameManager.getGameState());
  }
}

module.exports = SocketManager;