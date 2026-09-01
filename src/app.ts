import express, { Request, Response, NextFunction } from 'express';
import taskRoutes from './routes/task.routes';
import expenseRoutes from './routes/expense.routes';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import groupRoutes from './routes/group.routes';
import profileRoutes from './routes/profile.routes';
import journalRoutes from './routes/journal.routes';
import notificationRoutes from './routes/notification.routes';

const app = express();

app.use(express.json());
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err.stack || err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
