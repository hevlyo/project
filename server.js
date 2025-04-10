/**
 * @fileoverview Ponto de entrada do servidor do jogo Pega Bola 3000
 * @module server
 */

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./src/config/gameConfig');
const SocketManager = require('./src/socket/socketManager');

/**
 * Inicialização do servidor Express
 * @type {Express}
 */
const app = express();

/**
 * Criação do servidor HTTP
 * @type {http.Server}
 */
const server = http.createServer(app);

/**
 * Inicialização do Socket.IO com configurações personalizadas
 * @type {Server}
 */
const io = new Server(server, config.SOCKET_CONFIG);

// Configuração do servidor para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Inicialização do gerenciador de sockets
new SocketManager(io);

/**
 * Inicia o servidor na porta configurada
 * @param {number} config.PORT - Porta do servidor
 * @param {string} '0.0.0.0' - Host do servidor
 * @param {Function} callback - Função de callback executada quando o servidor inicia
 */
server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${config.PORT}`);
  console.log(`Game world size: ${config.WORLD_SIZE} x ${config.WORLD_SIZE}`);
  console.log(`Initial balls generated: ${config.BALL_COUNT}`);
});
