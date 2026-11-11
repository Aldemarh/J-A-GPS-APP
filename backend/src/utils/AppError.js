/**
 * Error controlado de la aplicación. Su mensaje sí puede mostrarse al cliente.
 * Cualquier otro error se responde como 500 genérico y se registra en el servidor.
 */
export class AppError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
