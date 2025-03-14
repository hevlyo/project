const express = require('express');
const path = require('path');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  pingInterval: 2000, // Check connection every 2 seconds
  pingTimeout: 5000,  // Consider disconnected after 5 seconds of no response
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST"]
  }
});

// Constants and configuration
const WORLD_SIZE = 50; // Size of the game world
const BALL_COUNT = 15; // Number of balls in the world
const BALL_TYPES = {
  NORMAL: { value: 10, color: 0xFFFFFF },
  GOLDEN: { value: 30, color: 0xFFD700 },
  SPEED: { value: 5, color: 0x00FF00 }
};
const RESPAWN_DELAY = 3000; // Time in ms before a new ball spawns after collection
const PORT = process.env.PORT || 25565;

// Initialize game state
const players = {};
const balls = [];

// Generate initial balls
generateBalls();

// Function to generate balls with random positions
function generateBalls() {
  console.log('Generating new set of balls...');
  // Clear existing balls
  balls.length = 0;
  
  // Generate new balls
  for (let i = 0; i < BALL_COUNT; i++) {
    balls.push({
      id: `ball-${Date.now()}-${i}`,
      position: {
        x: (Math.random() * WORLD_SIZE * 2) - WORLD_SIZE,
        y: 0.5, // Slightly above the ground
        z: (Math.random() * WORLD_SIZE * 2) - WORLD_SIZE
      },
      collected: false,
      value: BALL_TYPES.NORMAL.value
    });
  }
}

// Function to create a single new ball
function createNewBall() {
  console.log('Creating a new ball');
  const types = Object.keys(BALL_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const ballData = BALL_TYPES[type];
  
  const newBall = {
    id: `ball-${Date.now()}`,
    position: {
      x: (Math.random() * WORLD_SIZE * 2) - WORLD_SIZE,
      y: 0.5,
      z: (Math.random() * WORLD_SIZE * 2) - WORLD_SIZE
    },
    collected: false,
    type: type,
    value: ballData.value,
    color: ballData.color
  };
  balls.push(newBall);
  io.emit('newBalls', [newBall]);
  return newBall;
}

// Function to get uncollected balls
function getUncollectedBalls() {
  return balls.filter(ball => !ball.collected);
}

// Function to broadcast the current game state
function broadcastGameState() {
  io.emit('gameState', {
    players: players,
    balls: getUncollectedBalls(),
    topScore: topScore,
    topScorePlayer: topScorePlayer ? topScorePlayer : null
  });
}

// Generate a random color for player
function getRandomColor() {
  // Generate vibrant, distinguishable colors
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 100, 50);
}

// Convert HSL to Hex (for more vibrant, distinguishable colors)
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return parseInt(`${f(0)}${f(8)}${f(4)}`, 16);
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Keep track of all connected players
let topScore = 0;
let topScorePlayer = null;

// Rate limiting settings
const RATE_LIMITS = {
  movement: { points: 60, duration: 1 }, // 60 updates per second
  collection: { points: 10, duration: 1 }, // 10 collections per second
};

// Rate limiter implementation
function createRateLimiter(points, duration) {
  const tokens = new Map();
  
  return (socketId) => {
    const now = Date.now();
    let token = tokens.get(socketId) || { points: points, last: now };
    
    // Restore points based on time passed
    const timePassed = now - token.last;
    token.points += (timePassed / 1000) * (points / duration);
    token.points = Math.min(points, token.points);
    token.last = now;
    
    if (token.points >= 1) {
      token.points -= 1;
      tokens.set(socketId, token);
      return true;
    }
    return false;
  };
}

const movementLimiter = createRateLimiter(RATE_LIMITS.movement.points, RATE_LIMITS.movement.duration);
const collectionLimiter = createRateLimiter(RATE_LIMITS.collection.points, RATE_LIMITS.collection.duration);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Handle player join with nickname
  socket.on('joinGame', (playerData) => {
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
    
    // Generate random starting position for new player
    const startX = (Math.random() * WORLD_SIZE * 2) - WORLD_SIZE;
    const startZ = (Math.random() * WORLD_SIZE * 2) - WORLD_SIZE;
    
    // Create new player object
    players[socket.id] = {
      id: socket.id,
      nickname: nickname,
      position: { x: startX, y: 0, z: startZ },
      color: getRandomColor(),
      score: 0,
      lastUpdate: Date.now()
    };
    
    console.log(`Player ${nickname} (${socket.id}) joined the game`);
    
    // Send world info to player
    socket.emit('worldInfo', {
      worldSize: WORLD_SIZE,
      ballCount: BALL_COUNT
    });
    
    // Send player their own info
    socket.emit('playerInfo', players[socket.id]);
    
    // Send existing players to the new player
    socket.emit('currentPlayers', players);
    
    // Send existing balls to the new player
    const activeBalls = balls.filter(ball => !ball.collected);
    socket.emit('newBalls', activeBalls);
    
    // Notify all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);
    
    // Update player count for all clients
    io.emit('playerCount', Object.keys(players).length);
  });
  
  // Handle player movement
  socket.on('playerMovement', (movementData) => {
    if (!movementLimiter(socket.id)) {
      return;
    }
    
    if (!players[socket.id]) {
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
    
    // Validate position bounds
    const maxBound = WORLD_SIZE * 1.2; // Allow slight buffer
    if (Math.abs(movementData.position.x) > maxBound || 
        Math.abs(movementData.position.z) > maxBound) {
      socket.emit('error', { message: 'Position out of bounds' });
      return;
    }
    
    if (players[socket.id]) {
      // Update player position
      players[socket.id].position = movementData.position;
      players[socket.id].lastUpdate = Date.now();
      
      // Broadcast updated player position
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: players[socket.id].position
      });
    }
  });
  
  // Handle ball collection
  socket.on('collectBall', (data) => {
    if (!collectionLimiter(socket.id)) {
      return;
    }
    
    if (!players[socket.id]) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    if (!data || !data.ballId) {
      socket.emit('error', { message: 'Invalid ball data' });
      return;
    }

    const ballId = data.ballId;
    const ball = balls.find(b => b.id === ballId && !b.collected);
    
    if (!ball) {
      socket.emit('error', { message: 'Ball not found or already collected' });
      return;
    }

    // Validate distance between player and ball
    const playerPos = players[socket.id].position;
    const ballPos = ball.position;
    const distance = Math.sqrt(
      Math.pow(playerPos.x - ballPos.x, 2) + 
      Math.pow(playerPos.z - ballPos.z, 2)
    );
    
    if (distance > 5) { // Maximum collection distance
      socket.emit('error', { message: 'Ball too far to collect' });
      return;
    }
    
    if (ball) {
      console.log(`Player ${players[socket.id]?.nickname || socket.id} collected ball ${ballId}`);
      
      // Mark the ball as collected
      ball.collected = true;
      
      // Update player score
      if (players[socket.id]) {
        players[socket.id].score += ball.value;
        
        // Check if this is a new top score
        if (players[socket.id].score > topScore) {
          topScore = players[socket.id].score;
          topScorePlayer = socket.id;
        }
      }
      
      // Broadcast ball collection
      io.emit('ballCollected', {
        ballId: ballId,
        playerId: socket.id,
        value: ball.value
      });
      
      // Broadcast updated scores
      const scores = {};
      Object.keys(players).forEach(pid => {
        scores[pid] = players[pid].score;
      });
      io.emit('updateScores', scores);
      
      // Spawn a new ball after delay
      setTimeout(() => {
        createNewBall();
      }, RESPAWN_DELAY);
    }
  });
  
  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Remove this player
    if (players[socket.id]) {
      delete players[socket.id];
      
      // Broadcast player disconnect to all other players
      socket.broadcast.emit('playerDisconnected', socket.id);
      
      // Update player count
      io.emit('playerCount', Object.keys(players).length);
    }
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Game world size: ${WORLD_SIZE} x ${WORLD_SIZE}`);
  console.log(`Initial balls generated: ${BALL_COUNT}`);
});
