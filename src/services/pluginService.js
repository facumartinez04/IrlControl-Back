import WebSocket from 'ws';

class PluginConnection {
    constructor(userId, config, io) {
        this.userId = userId;
        this.ws = null;
        this.isConnected = false;
        this.config = config;
        this.io = io;
        this.retryTimeout = null;
        this.port = 4456; // Puerto fijo para el plugin
    }

    setupEventListeners() {
        // En ws nativo los listeners se agregan en connect() o después de crear la instancia
    }

    broadcastStatus(connected) {
        if (this.io) {
            this.io.to(`user_${this.userId}`).emit('plugin_status', { connected });
        }
    }

    async connect() {
        // Evitar múltiples conexiones si ya está conectado o conectando
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) return;

        // Si hay una conexión previa en estado extraño, cerrarla
        if (this.ws) {
            try {
                this.ws.terminate();
            } catch (e) { /* ignore */ }
            this.ws = null;
        }

        const { ip } = this.config;
        if (!ip) {
            console.error(`Missing Plugin config IP for user ${this.userId}`);
            return;
        }

        // Clean IP: remove username prefix AND any existing protocol (http://, https://, ws://, wss://)
        let cleanIp = ip.includes('@') ? ip.split('@')[1] : ip;
        cleanIp = cleanIp.replace(/^(https?:\/\/|wss?:\/\/)/, '');
        cleanIp = cleanIp.replace(/\/$/, '');

        // Usamos ws:// siempre para este puerto custom, salvo que se requiera wss explícitamente
        // pero por ahora asumimos websocket simple local/tunelizado
        const url = `ws://${cleanIp}:${this.port}`;

        console.log(`[PLUGIN RELAY] Intentando conectar a ${url} (ID: ${this.userId}) ...`);

        try {
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                console.log(`Plugin Socket opened for user ${this.userId}`);
                this.isConnected = true;
                this.broadcastStatus(true);
            });

            this.ws.on('message', (data) => {
                try {
                    // Intentar parsear si es JSON
                    const parsed = JSON.parse(data.toString());
                    if (this.io) {
                        this.io.to(`user_${this.userId}`).emit('plugin_event', parsed);
                    }
                } catch (e) {
                    console.error(`[PLUGIN RELAY] Error parseando mensaje del plugin (${this.userId}):`, e.message);
                    // Opcionalmente enviar como texto plano si falla JSON
                    // this.io.to(`user_${this.userId}`).emit('plugin_event', { raw: data.toString() });
                }
            });

            this.ws.on('close', (code, reason) => {
                console.log(`Plugin Connection Closed for user ${this.userId}: ${code} ${reason}`);
                this.isConnected = false;
                this.broadcastStatus(false);
                this.scheduleReconnect();
            });

            this.ws.on('error', (err) => {
                console.error(`[PLUGIN RELAY] Error de conexión para ${this.userId}:`, err.message);
                // El error usualmente dispara close después
                this.isConnected = false;
                this.broadcastStatus(false);
            });

        } catch (error) {
            console.error(`[PLUGIN RELAY] Error iniciando conexión para ${this.userId}:`, error.message);
            this.isConnected = false;
            this.broadcastStatus(false);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        // Reintentar en 15 segundos para no saturar si el plugin no está
        this.retryTimeout = setTimeout(() => this.connect(), 15000);
    }

    async sendCommand(requestData) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to Plugin');
        }

        // Enviar datos
        // Si requestData es objeto, stringify. Si es string, enviar directo.
        const payload = typeof requestData === 'string' ? requestData : JSON.stringify(requestData);

        return new Promise((resolve, reject) => {
            this.ws.send(payload, (err) => {
                if (err) {
                    console.error(`[PLUGIN RELAY] Error enviado comando: ${err.message}`);
                    reject(err);
                } else {
                    resolve({ status: 'sent' });
                }
            });
        });
    }

    disconnect() {
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        if (this.ws) {
            this.ws.close(); // Cierra limpiamente
            this.ws = null;
        }
        this.isConnected = false;
    }

    // Update config and reconnect if changed
    updateConfig(newConfig) {
        const oldIp = this.config.ip || '';
        const newIp = newConfig.ip || '';

        // Actualizamos siempre la config
        this.config = newConfig;

        // Si la IP cambia, reconectamos
        if (oldIp !== newIp && newIp) {
            console.log(`Config IP changed for user ${this.userId}, reconnecting plugin...`);
            this.disconnect();
            this.connect();
        }
    }
}

class PluginManager {
    constructor() {
        this.connections = new Map(); // userId -> PluginConnection
        this.io = null;
    }

    setIo(io) {
        this.io = io;
    }

    async getOrCreateConnection(userId, config) {
        if (this.connections.has(userId)) {
            const conn = this.connections.get(userId);
            conn.updateConfig(config);
            // Asegurarnos que si no estaba conectado intente conectar
            if (!conn.isConnected) {
                conn.connect();
            }
            return conn;
        }

        const newConn = new PluginConnection(userId, config, this.io);
        this.connections.set(userId, newConn);
        // Iniciamos conexión asíncrona pero devolvemos la instancia ya
        newConn.connect();
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
        // Similar to obsService logic if needed later
    }
}

const pluginManager = new PluginManager();
export default pluginManager;
