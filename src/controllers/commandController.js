import commandService from '../services/commandService.js';

class CommandController {
    async getLatestCommand(req, res) {
        const { user_id } = req.query;

        try {
            if (!user_id) {
                return res.status(400).json({ error: 'Missing user_id parameter' });
            }

            const data = await commandService.getLatestCommand(user_id);
            return res.status(200).json(data);
        } catch (error) {
            console.error('Controller Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async addCommand(req, res) {
        try {
            const { user_id, command, payload } = req.body;
            if (!user_id || !command) {
                return res.status(400).json({ error: 'Missing user_id or command' });
            }

            const data = await commandService.addCommand(user_id, command, payload);
            return res.status(201).json(data);
        } catch (error) {
            console.error('Controller Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new CommandController();
