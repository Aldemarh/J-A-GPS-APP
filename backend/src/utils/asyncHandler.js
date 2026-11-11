/**
 * Envuelve controladores async para que sus errores lleguen al errorHandler
 * (Express 4 no captura promesas rechazadas por sí solo).
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
