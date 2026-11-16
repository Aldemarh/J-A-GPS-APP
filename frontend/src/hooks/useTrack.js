import { useCallback, useEffect, useState } from 'react';
import { ApiError, positionsApi } from '../api/client.js';
import { dayRange } from '../components/tracks/trackFormat.js';

// Si se está viendo el día de hoy, el recorrido sigue creciendo: se vuelve a pedir cada minuto.
const LIVE_REFRESH_MS = 60_000;

/**
 * Recorrido de un vehículo en un día ("AAAA-MM-DD", calendario local).
 * status: 'idle' (sin vehículo o fecha) | 'loading' | 'ready' | 'error'
 * Con live, se actualiza en segundo plano mientras la pestaña está visible.
 */
export function useTrack(vehicleId, day, { live = false } = {}) {
  const [state, setState] = useState({ status: 'idle', data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!vehicleId || !day) {
      setState({ status: 'idle', data: null, error: '' });
      return undefined;
    }
    let cancelled = false;
    const { from, to } = dayRange(day);

    async function load(background) {
      try {
        const data = await positionsApi.track(vehicleId, from, to);
        if (!cancelled) setState({ status: 'ready', data, error: '' });
      } catch (err) {
        // Un fallo al refrescar en segundo plano no borra lo que ya se ve.
        if (cancelled || background) return;
        setState({
          status: 'error',
          data: null,
          error: err instanceof ApiError ? err.message : 'No se pudo cargar el recorrido.',
        });
      }
    }

    // Otro vehículo u otro día: se limpia para no mostrar el recorrido anterior mientras carga.
    setState({ status: 'loading', data: null, error: '' });
    load(false);
    const timer = live
      ? setInterval(() => document.visibilityState === 'visible' && load(true), LIVE_REFRESH_MS)
      : null;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [vehicleId, day, live, attempt]);

  return { ...state, retry };
}
