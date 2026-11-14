import { useCallback, useEffect, useState } from 'react';
import { positionsApi } from '../api/client.js';

// Hasta tener tiempo real (Socket.IO) se consulta cada 5 s, solo con la pestaña visible.
// Entre consulta y consulta, el mapa desliza los marcadores (ver FleetMap).
const POLL_MS = 5_000;

/**
 * Última posición de cada vehículo de la cuenta.
 * status: 'loading' | 'ready' | 'error' (en error se conservan las últimas posiciones conocidas).
 * updatedAt: hora de la última consulta exitosa (null si nunca la hubo).
 */
export function useLatestPositions() {
  const [positions, setPositions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await positionsApi.latest();
      setPositions(data.positions);
      setUpdatedAt(new Date());
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

  return { positions, status, updatedAt };
}
