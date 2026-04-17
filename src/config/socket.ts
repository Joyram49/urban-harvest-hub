import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

let io: SocketIOServer | null = null;

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // Join user-specific room (requires auth token - to be implemented)
    socket.on('join:room', (roomId: string) => {
      socket.join(roomId);
      logger.debug(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on('leave:room', (roomId: string) => {
      socket.leave(roomId);
      logger.debug(`Socket ${socket.id} left room: ${roomId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} – ${reason}`);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initializeSocket() first.');
  }
  return io;
}

// Emit helpers
export const socketEmit = {
  toUser: (userId: string, event: string, data: unknown) => {
    getIO().to(`user:${userId}`).emit(event, data);
  },
  toRoom: (room: string, event: string, data: unknown) => {
    getIO().to(room).emit(event, data);
  },
  broadcast: (event: string, data: unknown) => {
    getIO().emit(event, data);
  },
};
