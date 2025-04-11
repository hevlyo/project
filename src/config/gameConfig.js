module.exports = {
  // Configurações do mundo
  WORLD_SIZE: 100,
  BALL_COUNT: 20,
  
  // Tipos de bolas
  BALL_TYPES: {
    NORMAL: {
      value: 10,
      color: 0xFFFFFF
    },
    GOLDEN: {
      value: 50,
      color: 0xFFD700
    }
  },
  
  // Tempos e delays
  RESPAWN_DELAY: 5000,
  
  // Configurações do servidor
  PORT: process.env.PORT || 25565,
  
  // Configurações do Socket.IO
  SOCKET_CONFIG: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  }
}; 