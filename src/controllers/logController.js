import logService from '../services/logService.js';

class LogController {
    async addLog(req, res) {
        try {
            const { action, details } = req.body;
            const { id: userId, username } = req.user; // Obtenido del token JWT

            if (!action) {
                return res.status(400).json({ error: 'Action is required' });
            }

            const log = await logService.addLog(userId, username, action, details || '');
            return res.status(201).json(log);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async getLogs(req, res) {
        try {
            const logs = await logService.getLogs();
            return res.status(200).json(logs);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new LogController();
