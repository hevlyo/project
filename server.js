// server.js - Main entry point
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const GameManager = require('./managers/GameManager');
const SocketManager = require('./managers/SocketManager');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, config.socketOptions);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize game manager
const gameManager = new GameManager(config.gameSettings);

// Initialize socket manager with IO and game manager
const socketManager = new SocketManager(io, gameManager);

// Start the socket handling
socketManager.initialize();

// Start the server
server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${config.PORT}`);
  console.log(`Game world size: ${config.gameSettings.WORLD_SIZE} x ${config.gameSettings.WORLD_SIZE}`);
  console.log(`Initial balls generated: ${config.gameSettings.BALL_COUNT}`);
});