import { AppError } from '../utils/AppError.js';
import { config } from '../config/index.js';

// Ruta no encontrada (se registra después de todas las rutas).
export function notFound(req, res, next) {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// Manejador central de errores. Debe tener 4 parámetros para que Express lo reconozca.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Error de JSON mal formado en el body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  }

  // Error inesperado: se registra en el servidor, nunca se expone al cliente.
  console.error('[error]', err);
  return res.status(500).json({
    error: 'Error interno del servidor.',
    ...(!config.isProduction && { debug: err.message }),
  });
}
