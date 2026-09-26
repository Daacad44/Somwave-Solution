import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as searchController from '../controllers/search.controller';

export const searchRouter: Router = Router();

searchRouter.use(requireAuth);
searchRouter.get('/', searchController.search);
