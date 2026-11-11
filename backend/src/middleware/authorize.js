import { AppError } from '../utils/AppError.js';

/**
 * Permite el acceso solo a los roles indicados. Usar después de authenticate.
 * Uso: router.post('/', authorize('owner', 'admin'), controlador)
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'No tienes permisos para realizar esta acción.'));
    }
    return next();
  };
}
