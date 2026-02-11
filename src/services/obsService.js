import OBSWebSocket from 'obs-websocket-js';

class OBSConnection {
    constructor(userId, config, io) {
        this.userId = userId;
        this.obs = new OBSWebSocket();
        this.isConnected = false;
        this.config = config;
        this.io = io;
        this.retryTimeout = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.obs.on('ConnectionOpened', () => {
            console.log(`OBS Socket opened for user ${this.userId}`);
        });

        this.obs.on('Identified', () => {
            console.log(`OBS Identified for user ${this.userId}`);
            this.isConnected = true;
            this.broadcastStatus(true);
        });

        this.obs.on('ConnectionClosed', (error) => {
            console.log(`OBS Connection Closed for user ${this.userId}${error ? ': ' + error.message : ''}`);
            this.isConnected = false;
            this.broadcastStatus(false);
            this.scheduleReconnect();
        });

        // Forward common events to the user's room
        const eventsToForward = [
            'StreamStateChanged',
            'RecordStateChanged',
            'ReplayBufferStateChanged',
            'SceneItemVisibilityChanged',
            'CurrentProgramSceneChanged'
        ];

        eventsToForward.forEach(eventName => {
            this.obs.on(eventName, (data) => {
                if (this.io) {
                    this.io.to(`user_${this.userId}`).emit('obs_event', { event: eventName, data });
                }
            });
        });
    }

    broadcastStatus(connected) {
        if (this.io) {
            this.io.to(`user_${this.userId}`).emit('obs_status', { connected });
        }
    }

    async connect() {
        if (this.isConnected) return;

        const { ip, port, password } = this.config;
        if (!ip || !port) {
            console.error(`Missing OBS config for user ${this.userId}`);
            return;
        }

        // Clean IP: remove username prefix AND any existing protocol (http://, https://, ws://, wss://)
        let cleanIp = ip.includes('@') ? ip.split('@')[1] : ip;
        cleanIp = cleanIp.replace(/^(https?:\/\/|wss?:\/\/)/, '');

        // Remove trailing slashes
        cleanIp = cleanIp.replace(/\/$/, '');

        const protocol = (port === '443' || port === 443) ? 'wss' : 'ws';
        const url = `${protocol}://${cleanIp}${port ? ':' + port : ''}`;

        console.log(`[RELAY] Intentando conectar nube a ${url} (ID: ${this.userId}) ...`);

        try {
            await this.obs.connect(url, password);
        } catch (error) {
            console.error(`[RELAY] Error de conexión para ${this.userId}:`, error.message);
            this.isConnected = false;
            this.broadcastStatus(false);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = setTimeout(() => this.connect(), 10000);
    }

    async sendCommand(requestType, requestData = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to OBS');
        }
        return await this.obs.call(requestType, requestData);
    }

    disconnect() {
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        if (this.isConnected) {
            this.obs.disconnect();
        }
    }

    // Update config and reconnect if changed
    updateConfig(newConfig) {
        const isDifferent = JSON.stringify(this.config) !== JSON.stringify(newConfig);
        if (isDifferent) {
            console.log(`Config changed for user ${this.userId}, reconnecting...`);
            this.config = newConfig;
            this.disconnect();
            this.connect();
        }
    }
}

class OBSManager {
    constructor() {
        this.connections = new Map(); // userId -> OBSConnection
        this.io = null;
    }

    setIo(io) {
        this.io = io;
    }

    async getOrCreateConnection(userId, config) {
        if (this.connections.has(userId)) {
            const conn = this.connections.get(userId);
            conn.updateConfig(config);
            return conn;
        }

        const newConn = new OBSConnection(userId, config, this.io);
        this.connections.set(userId, newConn);
        await newConn.connect();
        return newConn;
    }

    getConnection(userId) {
        return this.connections.get(userId);
    }

    removeConnection(userId) {
        const conn = this.connections.get(userId);
        if (conn) {
            conn.disconnect();
            this.connections.delete(userId);
        }
    }

    async initializeAllConnections() {
        try {
            const { default: userRepository } = await import('../repositories/userRepository.js');
            const users = await userRepository.findAll();
            console.log(`[RELAY] Inicializando conexiones para ${users.length} usuarios...`);

            for (const user of users) {
                if (user.obsConfig && user.obsConfig.ip) {
                    await this.getOrCreateConnection(user.id, user.obsConfig);
                }
            }
        } catch (error) {
            console.error('[RELAY] Error inicializando conexiones masivas:', error.message);
        }
    }
}

const obsManager = new OBSManager();
export default obsManager;
