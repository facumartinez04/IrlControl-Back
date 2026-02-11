import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initSocket } from './services/socketService.js';
import obsService from './services/obsService.js';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Auto-connect to all configured OBS instances
    await obsService.initializeAllConnections();
});
