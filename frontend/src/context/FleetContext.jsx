import { createContext, useContext } from 'react';
import { useVehicles } from '../hooks/useVehicles.js';
import { useDevices } from '../hooks/useDevices.js';
import { useLatestPositions } from '../hooks/useLatestPositions.js';

const FleetContext = createContext(null);

// Datos de la flota compartidos por todas las pantallas privadas: se cargan una vez,
// no se vuelven a pedir al cambiar de sección y los cambios se ven en todas.
// Vive dentro de la ruta protegida: al cerrar sesión se descarta todo.
export function FleetProvider({ children }) {
  const vehicles = useVehicles();
  const devices = useDevices();
  const latest = useLatestPositions();
  return <FleetContext.Provider value={{ vehicles, devices, latest }}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet debe usarse dentro de <FleetProvider>');
  return ctx;
}
