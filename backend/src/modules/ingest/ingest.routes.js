import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseOsmand } from './osmand.js';
import { recordFromDevice } from './ingest.service.js';

// Recepción de posiciones desde los dispositivos. No usa el JWT de usuario:
// el equipo se identifica con su identificador.
const router = Router();

// En desarrollo se registra cada envío para diagnosticar equipos nuevos.
// Del identificador (es la credencial del equipo) solo se muestran 4 caracteres.
if (!config.isProduction) {
  router.use((req, res, next) => {
    res.on('finish', () => {
      const format = req.body?.location ? 'json' : 'url';
      const id = String(req.query.id ?? req.body?.device_id ?? '-').slice(0, 4);
      const fields = res.statusCode >= 400 ? ` campos=${[...Object.keys(req.query), ...Object.keys(req.body ?? {})].join(',')}` : '';
      console.log(`[ingest] ${req.method} ${res.statusCode} formato=${format} id=${id}…${fields}`);
    });
    next();
  });
}

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
