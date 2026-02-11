import http from 'http';
import app from './app.js';
import dotenv from 'dotenv';
import { initSocket } from './services/socketService.js';
import obsService from './services/obsService.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Auto-connect to all configured OBS instances
    await obsService.initializeAllConnections();
});
