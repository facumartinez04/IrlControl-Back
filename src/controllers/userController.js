import userService from '../services/userService.js';

class UserController {
    async register(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }
            const user = await userService.register(req.body);
            return res.status(201).json(user);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }
            const result = await userService.login(username, password);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(401).json({ error: error.message });
        }
    }

    async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ error: 'Refresh token is required' });
            }
            const tokens = await userService.refreshToken(refreshToken);
            return res.status(200).json(tokens);
        } catch (error) {
            return res.status(403).json({ error: error.message });
        }
    }

    async getMe(req, res) {
        try {
            const { id } = req.user;
            const user = await userService.getUserById(id);
            return res.status(200).json(user);
        } catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }

    async getAll(req, res) {
        try {
            const users = await userService.getAllUsers();
            return res.status(200).json(users);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const user = await userService.updateUser(id, req.body);
            return res.status(200).json(user);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            await userService.deleteUser(id);
            return res.status(200).json({ message: 'User deleted successfully' });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    async toggleSuspension(req, res) {
        try {
            const { id } = req.params;
            const result = await userService.toggleUserSuspension(id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export default new UserController();
