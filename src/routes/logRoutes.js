import express from 'express';
import logController from '../controllers/logController.js';
import { authenticateToken, isAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/logs:
 *   post:
 *     summary: Crea una entrada de log (Protegido con JWT)
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *               details:
 *                 type: string
 *     responses:
 *       201:
 *         description: Log creado
 */
router.post('/', authenticateToken, logController.addLog);

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Obtiene los últimos logs (Solo Admin)
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de logs
 */
router.get('/', authenticateToken, isAdmin, logController.getLogs);

export default router;
