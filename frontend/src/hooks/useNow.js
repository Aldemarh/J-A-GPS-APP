import { useEffect, useState } from 'react';

// Hora actual que se refresca cada `intervalMs`: para estados que dependen del tiempo
// (p. ej. un GPS pasa a "sin señal" aunque no llegue ningún dato nuevo).
export function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
