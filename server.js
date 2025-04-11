const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./src/config/gameConfig');
const SocketManager = require('./src/socket/socketManager');

// Express server setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, config.SOCKET_CONFIG);

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO middleware
new SocketManager(io);

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${config.PORT}`);
  console.log(`Game world size: ${config.WORLD_SIZE} x ${config.WORLD_SIZE}`);
  console.log(`Initial balls generated: ${config.BALL_COUNT}`);
});
