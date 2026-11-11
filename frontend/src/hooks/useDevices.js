import { useCallback, useEffect, useState } from 'react';
import { ApiError, devicesApi } from '../api/client.js';

/**
 * Dispositivos GPS de la cuenta.
 * status: 'loading' | 'ready' | 'error'
 */
export function useDevices() {
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await devicesApi.list();
      setDevices(data.devices);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los dispositivos.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (payload) => {
    const { device } = await devicesApi.create(payload);
    setDevices((list) => [device, ...list]);
    return device;
  }, []);

  const remove = useCallback(async (id) => {
    await devicesApi.remove(id);
    setDevices((list) => list.filter((d) => d.id !== id));
  }, []);

  // Al borrar un vehículo, la BD borra su dispositivo: se refleja sin volver a consultar.
  const forgetVehicle = useCallback((vehicleId) => {
    setDevices((list) => list.filter((d) => d.vehicleId !== vehicleId));
  }, []);

  return { devices, status, error, reload: load, create, remove, forgetVehicle };
}
