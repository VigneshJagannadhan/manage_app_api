import express, { Request, Response, NextFunction } from 'express';
import taskRoutes from './routes/task.routes';
import expenseRoutes from './routes/expense.routes';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';

const app = express();

app.use(express.json());
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/expenses', expenseRoutes);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err.stack || err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
