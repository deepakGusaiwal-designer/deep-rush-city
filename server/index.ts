import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupSocketServer } from './socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupSocketServer(io);

// Health check endpoint for Render monitoring
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', game: 'Deep Rush City', onlinePlayers: io.engine.clientsCount, time: Date.now() });
});

// Serve built frontend assets in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Express 5 compatible SPA fallback
app.use((_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Deep Rush City Multiplayer Server listening on http://0.0.0.0:${PORT}`);
});
