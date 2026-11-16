import { AppError } from '../utils/AppError.js';

/**
 * Valida req.body (o req.query) con un esquema de zod. Si falla, responde 400 con los errores por campo.
 * Uso: router.post('/x', validate(miEsquema), controlador)
 *      router.get('/x', validate(miEsquema, 'query'), controlador)
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(new AppError(400, 'Datos inválidos.', details));
    }
    req[source] = result.data; // datos ya limpios y tipados
    return next();
  };
}
