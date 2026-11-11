import { AppError } from '../utils/AppError.js';
import { config } from '../config/index.js';

// Ruta no encontrada (se registra después de todas las rutas).
export function notFound(req, res, next) {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// Traduce errores típicos de PostgreSQL a un mensaje útil.
function describeDatabaseError(err) {
  switch (err.code) {
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case '57P01': // administrador cerró la conexión
      return 'No se puede conectar con la base de datos. Verifica que PostgreSQL esté corriendo y que DATABASE_URL sea correcta.';
    case '28P01': // contraseña incorrecta
    case '28000': // rol no válido
      return 'Credenciales de la base de datos incorrectas. Revisa DATABASE_URL en backend/.env.';
    case '3D000': // base de datos no existe
      return 'La base de datos indicada en DATABASE_URL no existe. Créala y ejecuta npm run db:migrate.';
    case '42P01': // tabla no existe
      return 'Faltan tablas en la base de datos. Ejecuta npm run db:migrate dentro de backend/.';
    default:
      return null;
  }
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

  // Problemas de conexión o credenciales de PostgreSQL: se explican sin exponer detalles internos.
  const dbMessage = describeDatabaseError(err);
  if (dbMessage) {
    console.error('[db]', err.code || '', err.message);
    return res.status(503).json({
      error: dbMessage,
      ...(!config.isProduction && { debug: err.message }),
    });
  }

  // Error inesperado: se registra en el servidor, nunca se expone al cliente.
  console.error('[error]', err);
  return res.status(500).json({
    error: 'Error interno del servidor.',
    ...(!config.isProduction && { debug: err.message }),
  });
}
