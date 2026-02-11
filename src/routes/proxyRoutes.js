import express from 'express';
import proxyController from '../controllers/proxyController.js';

const router = express.Router();

/**
 * @swagger
 * /api/proxy:
 *   get:
 *     summary: Proxy para omitir CORS al pegarle a una URL externa
 *     tags: [Proxy]
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: La URL completa a la que se quiere acceder
 */
router.get('/', proxyController.proxy);

export default router;
