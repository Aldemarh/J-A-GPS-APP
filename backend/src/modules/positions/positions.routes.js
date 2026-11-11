import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './positions.service.js';

const router = Router();

router.use(authenticate);

// El tenant SIEMPRE sale del token.
router.get(
  '/latest',
  asyncHandler(async (req, res) => {
    res.json({ positions: await service.latest(req.user.tenantId) });
  }),
);

export default router;
