import commandRepository from '../repositories/commandRepository.js';

class CommandService {
    async getLatestCommand(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Aquí se podrían agregar validaciones adicionales de negocio
        // O transformaciones de datos si fuera necesario

        return await commandRepository.getLatestCommandByUserId(userId);
    }

    async addCommand(userId, command, payload = {}) {
        if (!userId || !command) {
            throw new Error('User ID and command type are required');
        }

        const commandData = {
            user_id: userId,
            command,
            payload,
            created_at: new Date().toISOString()
        };

        return await commandRepository.create(commandData);
    }
}

export default new CommandService();
