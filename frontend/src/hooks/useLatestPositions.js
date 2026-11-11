import { useCallback, useEffect, useState } from 'react';
import { positionsApi } from '../api/client.js';

// Hasta tener tiempo real (Socket.IO) se consulta cada 10 s, solo con la pestaña visible.
const POLL_MS = 10_000;

/**
 * Última posición de cada vehículo de la cuenta.
 * status: 'loading' | 'ready' | 'error' (en error se conservan las últimas posiciones conocidas).
 */
export function useLatestPositions() {
  const [positions, setPositions] = useState([]);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    try {
      const data = await positionsApi.latest();
      setPositions(data.positions);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { positions, status };
}
