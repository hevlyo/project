module.exports = {
  // World Config
  WORLD_SIZE: 100,
  BALL_COUNT: 20,

  BALL_TYPES: {
    NORMAL: {
      value: 10,
      color: 0xffffff,
    },
    GOLDEN: {
      value: 50,
      color: 0xffd700,
    },
  },

  // Player Config
  RESPAWN_DELAY: 5000,

  // Server Config
  PORT: process.env.PORT || 25565,

  // Socket Config
  SOCKET_CONFIG: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  },
}; 