import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import obsManager from './obsService.js';
import userService from './userService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // Provide io instance to obsManager for broadcasting
    obsManager.setIo(io);

    // Authentication Middleware
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        const actualToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

        try {
            const decoded = jwt.verify(actualToken, JWT_SECRET);
            const user = await userService.getUserById(decoded.id);
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            if (user.isSuspended) {
                return next(new Error('Authentication error: User account suspended'));
            }
            socket.user = user;
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid or expired token'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.user.id;
        console.log(`Socket connected: ${socket.id} for User: ${userId}`);

        // 1. Join a private room for this user
        // This ensures that even if they have multiple tabs open, 
        // they are all in the same "logical" websocket channel.
        socket.join(`user_${userId}`);

        // 2. Initialize OBS connection for this specific user if not already running
        // If it exists, it will just update the config if it changed.
        const obsConn = await obsManager.getOrCreateConnection(userId, socket.user.obsConfig);

        // 3. Immediately send current status to the NEWLY connected socket
        socket.emit('obs_status', { connected: obsConn.isConnected });

        // 4. Handle commands from the client
        socket.on('obs_command', async (data, callback) => {
            try {
                const { requestType, requestData } = data;

                const currentConn = obsManager.getConnection(userId);
                if (!currentConn) throw new Error('OBS Connection instance not found');

                const response = await currentConn.sendCommand(requestType, requestData);
                if (callback) callback({ success: true, data: response });
            } catch (error) {
                console.error(`Socket command error [User ${userId}]: ${error.message}`);
                if (callback) callback({ success: false, error: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            // Note: We don't remove the OBS connection because other tabs might be open,
            // or we might want to keep the OBS connection alive even when the web UI is closed.
        });
    });

    return io;
};
