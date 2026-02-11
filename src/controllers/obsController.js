import userRepository from '../repositories/userRepository.js';
import obsManager from '../services/obsService.js';

class OBSController {
    async connect(req, res) {
        try {
            const { username } = req.params;
            const config = req.body; // { ip, port, password }

            if (!config.ip || !config.port) {
                return res.status(400).json({ error: 'IP and port are required' });
            }

            // 1. Find the user
            const user = await userRepository.findByUsername(username);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // 2. Update user's obsConfig in DB
            await userRepository.update(user.id, { obsConfig: config });

            // 3. Update or create the connection in the manager
            const conn = await obsManager.getOrCreateConnection(user.id, config);

            // 4. Return current status
            return res.status(200).json({
                message: 'OBS config updated and connection initiated',
                connected: conn.isConnected
            });
        } catch (error) {
            console.error('OBS Connect Error:', error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    async getStatus(req, res) {
        try {
            const { username } = req.params;
            const user = await userRepository.findByUsername(username);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const conn = obsManager.getConnection(user.id);
            return res.status(200).json({
                connected: conn ? conn.isConnected : false,
                config: user.obsConfig
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

const obsController = new OBSController();
export default obsController;
