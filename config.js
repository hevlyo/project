// config.js - Configuration settings
const PORT = process.env.PORT || 25565;

// Game configuration
const gameSettings = {
  WORLD_SIZE: 50,
  BALL_COUNT: 15,
  BALL_TYPES: {
    NORMAL: { value: 10, color: 0xFFFFFF },
    GOLDEN: { value: 30, color: 0xFFD700 },
    SPEED: { value: 5, color: 0x00FF00 }
  },
  RESPAWN_DELAY: 3000,
  MAX_COLLECTION_DISTANCE: 5
};

// Rate limiting settings
const rateLimits = {
  movement: { points: 60, duration: 1 }, // 60 updates per second
  collection: { points: 10, duration: 1 } // 10 collections per second
};

// Socket.IO configuration
const socketOptions = {
  pingInterval: 2000, // Check connection every 2 seconds
  pingTimeout: 5000,  // Consider disconnected after 5 seconds of no response
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST"]
  }
};

module.exports = {
  PORT,
  gameSettings,
  rateLimits,
  socketOptions
};