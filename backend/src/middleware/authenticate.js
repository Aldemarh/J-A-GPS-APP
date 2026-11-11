import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Verifica el JWT del header "Authorization: Bearer <token>".
 * Si es válido, deja en req.user los datos del token:
 *   { id, tenantId, role }
 * El tenantId viene del token firmado, NO del cliente. Así cada
 * consulta de datos puede filtrarse por el tenant del usuario autenticado.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Token de autenticación requerido.'));
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'jya-gps',
    });

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
    return next();
  } catch {
    return next(new AppError(401, 'Token inválido o expirado.'));
  }
}
