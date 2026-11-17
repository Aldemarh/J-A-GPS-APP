import { useCallback, useEffect, useState } from 'react';
import { ApiError, positionsApi } from '../api/client.js';
import { dayRange } from '../components/tracks/trackFormat.js';

// Si se está viendo el día de hoy, el recorrido sigue creciendo: se vuelve a pedir cada minuto.
const LIVE_REFRESH_MS = 60_000;

const IDLE = { status: 'idle', data: null, error: '' };
const LOADING = { status: 'loading', data: null, error: '' };

/**
 * Recorrido de un vehículo en un día ("AAAA-MM-DD", calendario local).
 * status: 'idle' (sin vehículo o fecha) | 'loading' | 'ready' | 'error'
 * Con live, se actualiza en segundo plano mientras la pestaña está visible.
 *
 * Cada respuesta se guarda con la clave (vehículo, día, intento) que la pidió. Si la clave ya no
 * coincide con la selección actual, el hook devuelve "cargando": así nunca se muestra el recorrido
 * de otro vehículo o de otro día, sin tener que limpiar el estado dentro de un efecto.
 */
export function useTrack(vehicleId, day, { live = false } = {}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, ...IDLE });
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const key = vehicleId && day ? `${vehicleId}|${day}|${attempt}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const { from, to } = dayRange(day);

    const load = (background) =>
      positionsApi.track(vehicleId, from, to).then(
        (data) => {
          if (!cancelled) setResult({ key, status: 'ready', data, error: '' });
        },
        (err) => {
          // Un fallo al refrescar en segundo plano no borra lo que ya se ve.
          if (cancelled || background) return;
          setResult({
            key,
            status: 'error',
            data: null,
            error: err instanceof ApiError ? err.message : 'No se pudo cargar el recorrido.',
          });
        },
      );

    load(false);
    const timer = live
      ? setInterval(() => document.visibilityState === 'visible' && load(true), LIVE_REFRESH_MS)
      : null;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, vehicleId, day, live]);

  if (!key) return { ...IDLE, retry };
  if (result.key !== key) return { ...LOADING, retry };
  return { status: result.status, data: result.data, error: result.error, retry };
}
