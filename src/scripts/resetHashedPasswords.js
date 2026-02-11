import userRepository from '../repositories/userRepository.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function resetHashes() {
    console.log("--- Iniciando limpieza de contraseñas hasheadas ---");

    try {
        const users = await userRepository.findAll();
        let count = 0;

        for (const user of users) {
            // Si la contraseña empieza por el patrón de Bcrypt
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
                console.log(`Usuario [${user.username}] tiene contraseña hasheada. Reseteando...`);

                // Reseteamos a '123456' o al nombre de usuario como contraseña temporal
                const newPassword = 'password123';

                await userRepository.update(user.id, { password: newPassword });
                count++;
            }
        }

        console.log(`\n--- Proceso completado ---`);
        console.log(`Se resetearon ${count} usuarios.`);
        console.log(`Nueva contraseña temporal para ellos: password123`);
        process.exit(0);
    } catch (error) {
        console.error("Error durante el proceso:", error);
        process.exit(1);
    }
}

resetHashes();
