import express, { Request, Response, NextFunction } from 'express';
import taskRoutes from './routes/task.routes';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(express.json());
app.use('/api/health', healthRoutes);
app.use('/api/tasks', taskRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
