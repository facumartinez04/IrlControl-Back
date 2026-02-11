import userRepository from '../repositories/userRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

class UserService {
    generateTokens(user) {
        const payload = { id: user.id, username: user.username, isAdmin: user.isAdmin };

        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

        return { accessToken, refreshToken };
    }

    async register(userData) {
        const { username, password, isAdmin = false } = userData;
        const existingUser = await userRepository.findByUsername(username);
        if (existingUser) {
            throw new Error('El usuario ya existe');
        }

        const newUser = {
            id: uuidv4(),
            username,
            password, // Guardamos en texto plano
            isAdmin,
            isSuspended: false,
            obsConfig: userData.obsConfig || {},
            ingestConfigs: userData.ingestConfigs || [],
            rdpConfig: userData.rdpConfig || {},
            subscription: userData.subscription || { type: 'unlimited' },
            created_at: new Date().toISOString()
        };

        return await userRepository.create(newUser);
    }

    async login(username, password) {
        let user = await userRepository.findByUsername(username);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        // Ejecutar verificación de suscripción
        user = await this.verifySubscription(user);

        // Verificar si la cuenta está suspendida
        if (user.isSuspended) {
            throw new Error('Cuenta suspendida o plan vencido');
        }

        // Comparación simple de texto plano (como en el sistema viejo)
        if (user.password !== password) {
            throw new Error('Contraseña incorrecta');
        }

        // Generar Tokens
        const tokens = this.generateTokens(user);

        return { user, ...tokens };
    }

    async refreshToken(token) {
        try {
            const payload = jwt.verify(token, JWT_REFRESH_SECRET);

            // Verificar si el usuario aún existe y no está suspendido
            const user = await userRepository.findById(payload.id);
            if (!user) throw new Error('Usuario no encontrado');
            if (user.isSuspended) throw new Error('Cuenta suspendida');

            // Generar nuevo set de tokens (para rotar el refresh token también)
            return this.generateTokens(user);
        } catch (error) {
            throw new Error('Refresh token inválido o expirado');
        }
    }

    async verifySubscription(user) {
        if (user.isAdmin) return user;

        if (user.subscription && user.subscription.type === 'fixed' && user.subscription.endDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (todayStr > user.subscription.endDate) {
                if (!user.isSuspended) {
                    await userRepository.updateSuspension(user.id, true);
                    user.isSuspended = true;
                }
            }
        }
        return user;
    }

    async getAllUsers() {
        return await userRepository.findAll();
    }

    async updateUser(id, data) {
        // No hasheamos el password, se guarda en texto plano
        return await userRepository.update(id, data);
    }

    async deleteUser(id) {
        return await userRepository.delete(id);
    }

    async toggleUserSuspension(id) {
        const user = await userRepository.findById(id);
        if (!user) throw new Error('Usuario no encontrado');

        const newStatus = !user.isSuspended;
        await userRepository.updateSuspension(id, newStatus);
        return { isSuspended: newStatus };
    }

    async getUserById(id) {
        const user = await userRepository.findById(id);
        if (!user) throw new Error('Usuario no encontrado');
        return user;
    }
}

export default new UserService();
