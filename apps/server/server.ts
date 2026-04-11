import express from 'express';
import type { Express } from 'express-serve-static-core';
import fs from 'fs';
import path from 'path';
import http, { type Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import config from './src/config/gameConfig';
import SocketManager from './src/socket/socketManager';

function createHttpServer(): { app: Express; server: HttpServer; io: SocketIOServer } {
  const app = express() as unknown as Express;
  const server = http.createServer(app);
  const io = new SocketIOServer(server, config.SOCKET_CONFIG);
  const gameDistPath = path.resolve(__dirname, '..', '..', 'game', 'dist');
  const staticRoot = fs.existsSync(gameDistPath)
    ? gameDistPath
    : path.resolve(process.cwd(), 'apps', 'game', 'dist');

  app.use(express.static(staticRoot));
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
