import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseOsmand } from './osmand.js';
import { recordFromDevice } from './ingest.service.js';

// Recepción de posiciones desde los dispositivos. No usa el JWT de usuario:
// el equipo se identifica con su identificador.
const router = Router();

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas posiciones en poco tiempo.' },
});

const receiveOsmand = asyncHandler(async (req, res) => {
  await recordFromDevice(parseOsmand(req));
  res.status(200).end();
});

router.get('/osmand', ingestLimiter, receiveOsmand);
router.post('/osmand', ingestLimiter, receiveOsmand);

export default router;
