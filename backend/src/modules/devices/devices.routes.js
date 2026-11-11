import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { createDeviceSchema, updateDeviceSchema } from './devices.schemas.js';
import * as controller from './devices.controller.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(authenticate);

router.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return next(new AppError(404, 'Dispositivo no encontrado.'));
  return next();
});

const canWrite = authorize('owner', 'admin');

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', canWrite, validate(createDeviceSchema), asyncHandler(controller.create));
router.patch('/:id', canWrite, validate(updateDeviceSchema), asyncHandler(controller.update));
router.delete('/:id', canWrite, asyncHandler(controller.remove));

export default router;
