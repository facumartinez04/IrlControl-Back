import logRepository from '../repositories/logRepository.js';
import { v4 as uuidv4 } from 'uuid';

class LogService {
    async addLog(userId, username, action, details = '') {
        if (!userId || !username) {
            throw new Error('User ID and username are required for logging');
        }

        const newLog = {
            id: uuidv4(),
            userId,
            username,
            action,
            details,
            timestamp: new Date().toISOString()
        };

        return await logRepository.create(newLog);
    }

    async getLogs() {
        return await logRepository.findAll();
    }
}

export default new LogService();
