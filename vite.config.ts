import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { Server } from 'socket.io';
import { setupSocketServer } from './server/socketHandler';

function socketPlugin(): Plugin {
  return {
    name: 'vite-plugin-socket-io',
    configureServer(server) {
      if (server.httpServer) {
        const io = new Server(server.httpServer, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
          },
        });
        setupSocketServer(io);
        console.log('🎮 Socket.io server attached to Vite HTTP server on port 3000');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), socketPlugin()],
  server: {
    port: 3000,
    host: true,
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.png', '**/*.jpg'],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
