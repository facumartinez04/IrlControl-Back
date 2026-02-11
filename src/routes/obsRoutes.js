import express from 'express';
import obsController from '../controllers/obsController.js';

const router = express.Router();

/**
 * @swagger
 * /api/obs/{username}/connect:
 *   post:
 *     summary: Actualiza la configuración de OBS y conecta (o reconecta) para un usuario
 *     tags: [OBS]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ip:
 *                 type: string
 *               port:
 *                 type: string
 *               password:
 *                 type: string
 */
router.post('/:username/connect', obsController.connect);

/**
 * @swagger
 * /api/obs/{username}/status:
 *   get:
 *     summary: Obtiene el estado de conexión de OBS para un usuario
 *     tags: [OBS]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:username/status', obsController.getStatus);

export default router;
