import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';
import commandRoutes from './routes/commandRoutes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import logRoutes from './routes/logRoutes.js';
import obsRoutes from './routes/obsRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/obs', obsRoutes);
app.use('/api/proxy', proxyRoutes);

// Early error handling for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

export default app;
