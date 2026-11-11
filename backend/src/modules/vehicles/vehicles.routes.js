import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { createVehicleSchema, updateVehicleSchema } from './vehicles.schemas.js';
import * as controller from './vehicles.controller.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Todas las rutas de vehículos requieren sesión.
router.use(authenticate);

// Un id mal formado responde 404 (no llega a la BD ni produce un 500).
router.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return next(new AppError(404, 'Vehículo no encontrado.'));
  return next();
});

const canWrite = authorize('owner', 'admin');

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', canWrite, validate(createVehicleSchema), asyncHandler(controller.create));
router.patch('/:id', canWrite, validate(updateVehicleSchema), asyncHandler(controller.update));
router.delete('/:id', canWrite, asyncHandler(controller.remove));

export default router;
