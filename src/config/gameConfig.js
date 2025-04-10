module.exports = {
  // Configurações do mundo
  WORLD_SIZE: 50,
  BALL_COUNT: 15,
  
  // Tipos de bolas
  BALL_TYPES: {
    NORMAL: { value: 10, color: 0xFFFFFF },
    GOLDEN: { value: 30, color: 0xFFD700 },
    SPEED: { value: 5, color: 0x00FF00 }
  },
  
  // Tempos e delays
  RESPAWN_DELAY: 3000,
  
  // Configurações do servidor
  PORT: process.env.PORT || 25565,
  
  // Configurações do Socket.IO
  SOCKET_CONFIG: {
    pingInterval: 2000,
    pingTimeout: 5000,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  },

  // Habilidades dos jogadores
  ABILITIES: {
    DASH: {
      cost: 50,
      cooldown: 5000,
      duration: 1000
    },
    MAGNET: {
      cost: 100,
      cooldown: 10000,
      duration: 5000
    },
    SHOCKWAVE: {
      cost: 75,
      cooldown: 8000,
      duration: 2000
    }
  }
}; 