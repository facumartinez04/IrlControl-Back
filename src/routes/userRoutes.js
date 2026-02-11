import express from 'express';
import userController from '../controllers/userController.js';
import { authenticateToken, isAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Obtiene el perfil del usuario actual (Protegido con JWT)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       401:
 *         description: No autorizado
 */
router.get('/me', authenticateToken, userController.getMe);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Crea un nuevo usuario (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               isAdmin:
 *                 type: boolean
 *               obsConfig:
 *                 type: object
 *               ingestConfigs:
 *                 type: array
 *               rdpConfig:
 *                 type: object
 *               subscription:
 *                 type: object
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       403:
 *         description: No autorizado
 */
router.post('/', authenticateToken, isAdmin, userController.register);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Obtiene todos los usuarios (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       403:
 *         description: No autorizado
 */
router.get('/', authenticateToken, isAdmin, userController.getAll);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Actualiza un usuario (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Usuario actualizado
 */
router.put('/:id', authenticateToken, isAdmin, userController.update);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Elimina un usuario (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario eliminado
 */
router.delete('/:id', authenticateToken, isAdmin, userController.delete);

/**
 * @swagger
 * /api/users/{id}/toggle-suspension:
 *   post:
 *     summary: Activa/Desactiva la suspensión de un usuario (Solo Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado de suspensión actualizado
 */
router.post('/:id/toggle-suspension', authenticateToken, isAdmin, userController.toggleSuspension);

export default router;
