export const PROTOCOL_LABELS = {
  osmand: 'Celular (app Traccar Client)',
};

export function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return 'Aún no ha enviado ubicaciones';
  const when = new Date(lastSeenAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  return `Último dato: ${when}`;
}
