import express from 'express';
import commandController from '../controllers/commandController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/commands/latest:
 *   get:
 *     summary: Obtiene el último comando para un usuario específico (Protegido con JWT)
 *     tags: [Commands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: El ID del usuario
 *     responses:
 *       200:
 *         description: El comando más reciente
 *       401:
 *         description: No autorizado (Token faltante o inválido)
 *       400:
 *         description: Falta el parámetro user_id
 */
router.get('/latest', authenticateToken, commandController.getLatestCommand);

/**
 * @swagger
 * /api/commands:
 *   post:
 *     summary: Agrega un nuevo comando a la cola (Protegido con JWT)
 *     tags: [Commands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - command
 *             properties:
 *               user_id:
 *                 type: string
 *               command:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       201:
 *         description: Comando agregado
 *       401:
 *         description: No autorizado
 */
router.post('/', authenticateToken, commandController.addCommand);

export default router;
