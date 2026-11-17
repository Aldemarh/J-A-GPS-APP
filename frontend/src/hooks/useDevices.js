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

  // El estado cambia solo cuando llega la respuesta (el "cargando" inicial ya está en useState).
  const fetchDevices = useCallback(
    () =>
      devicesApi.list().then(
        (data) => {
          setDevices(data.devices);
          setStatus('ready');
        },
        (err) => {
          setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los dispositivos.');
          setStatus('error');
        },
      ),
    [],
  );

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Reintentar (lo pide el usuario): vuelve a mostrar "cargando".
  const reload = useCallback(() => {
    setStatus('loading');
    setError('');
    return fetchDevices();
  }, [fetchDevices]);

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

  return { devices, status, error, reload, create, remove, forgetVehicle };
}
