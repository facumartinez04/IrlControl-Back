import userRepository from '../repositories/userRepository.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16


class UserService {
    getSecrets() {
        return {
            access: process.env.JWT_SECRET || 'fallback_secret',
            refresh: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret'
        };
    }

    encrypt(text) {
        if (!text) return text;
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    decrypt(text) {
        if (!text) return text;
        const textParts = text.split(':');
        // If not formatted as iv:content, assume it's legacy plain text
        if (textParts.length < 2) return text;

        try {
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            // If decryption fails (e.g. key changed), return original text or handle accordingly
            console.error("Decryption failed:", error);
            return text;
        }
    }


    generateTokens(user) {
        const payload = { id: user.id, username: user.username, isAdmin: user.isAdmin };
        const secrets = this.getSecrets();

        const accessToken = jwt.sign(payload, secrets.access, { expiresIn: '1h' });
        const refreshToken = jwt.sign(payload, secrets.refresh, { expiresIn: '7d' });

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
            password: this.encrypt(password), // Guardamos encriptado

            isAdmin,
            isSuspended: false,
            obsConfig: userData.obsConfig || {},
            ingestConfigs: userData.ingestConfigs || [],
            rdpConfig: userData.rdpConfig || {},
            subscription: userData.subscription || { type: 'unlimited' },
            created_at: new Date().toISOString()
        };

        const createdUser = await userRepository.create(newUser);
        // Decrypt password for response
        if (createdUser && createdUser.password) {
            createdUser.password = this.decrypt(createdUser.password);
        }
        return createdUser;
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

        // Comparación: Desencriptar la contraseña almacenada y comparar con la recibida
        const decryptedPassword = this.decrypt(user.password);
        if (decryptedPassword !== password) {
            throw new Error('Contraseña incorrecta');
        }

        // Generar Tokens
        const tokens = this.generateTokens(user);

        // Devolver usuario con contraseña desencriptada
        user.password = decryptedPassword;

        return { user, ...tokens };
    }

    async refreshToken(token) {
        try {
            const secrets = this.getSecrets();
            const payload = jwt.verify(token, secrets.refresh);

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
        const users = await userRepository.findAll();
        // Desencriptar passwords para mostrarlos en la lista
        return users.map(user => ({
            ...user,
            password: this.decrypt(user.password)
        }));

    }

    async updateUser(id, data) {
        // Si viene password, lo encriptamos
        if (data.password) {
            data.password = this.encrypt(data.password);
        }
        const updatedUser = await userRepository.update(id, data);

        if (updatedUser && updatedUser.password) {
            updatedUser.password = this.decrypt(updatedUser.password);
        }
        return updatedUser;
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

        // Decrypt password if it exists
        if (user.password) {
            user.password = this.decrypt(user.password);
        }

        return user;
    }
}

export default new UserService();
