import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboard.controller';

export const dashboardRouter: Router = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/', dashboardController.get);
