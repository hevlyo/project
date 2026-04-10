import express from 'express';
import type { Express } from 'express-serve-static-core';
import path from 'path';
import http, { type Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import config from './src/config/gameConfig';
import SocketManager from './src/socket/socketManager';

function createHttpServer(): { app: Express; server: HttpServer; io: SocketIOServer } {
  const app = express() as unknown as Express;
  const server = http.createServer(app);
  const io = new SocketIOServer(server, config.SOCKET_CONFIG);

  app.use(express.static(path.join(__dirname, '..', 'public')));
  new SocketManager(io);

  return { app, server, io };
}

function startServer(): void {
  const { server } = createHttpServer();

  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${config.PORT}`);
    console.log(`Game world size: ${config.WORLD_SIZE} x ${config.WORLD_SIZE}`);
    console.log(`Ball range: ${config.MIN_BALL_COUNT}–${config.MAX_BALL_COUNT} (${config.BALLS_PER_PLAYER} per player)`);
  });
}

startServer();
