import { useCallback, useEffect, useState } from 'react';
import { ApiError, vehiclesApi } from '../api/client.js';

/**
 * Estado y operaciones de los vehículos de la cuenta.
 * status: 'loading' | 'ready' | 'error'
 */
export function useVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await vehiclesApi.list();
      setVehicles(data.vehicles);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los vehículos.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (payload) => {
    const { vehicle } = await vehiclesApi.create(payload);
    setVehicles((list) => [vehicle, ...list]);
    return vehicle;
  }, []);

  const update = useCallback(async (id, payload) => {
    const { vehicle } = await vehiclesApi.update(id, payload);
    setVehicles((list) => list.map((v) => (v.id === id ? vehicle : v)));
    return vehicle;
  }, []);

  const remove = useCallback(async (id) => {
    await vehiclesApi.remove(id);
    setVehicles((list) => list.filter((v) => v.id !== id));
  }, []);

  return { vehicles, status, error, reload: load, create, update, remove };
}
