import { useCallback, useState } from 'react';
import GoogleFleetMap from './GoogleFleetMap.jsx';
import LeafletFleetMap from './LeafletFleetMap.jsx';

// Etapa de comparación: con VITE_GOOGLE_MAPS_API_KEY en frontend/.env.local se usa Google Maps
// y aparece un selector para cambiar a OpenStreetMap; sin la key, solo OpenStreetMap.
// Cuando se elija un proveedor, este archivo y el selector desaparecen.
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
const STORAGE_KEY = 'jya.mapProvider';

const PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'osm', label: 'OSM' },
];

function readStoredProvider() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeProvider(provider) {
  try {
    window.localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    // Sin almacenamiento (modo privado): la elección dura hasta recargar.
  }
}

// Qué hacer según el error de Google (los de facturación también salen al pasar el límite de la Demo Key).
function failureHint(code) {
  if (code === 'BillingNotEnabledMapError') {
    return 'El proyecto de la key no tiene facturación activa, o la Demo Key pasó su límite de uso.';
  }
  if (code === 'OverQuotaMapError') return 'Se alcanzó la cuota diaria de la key. Recarga la página más tarde.';
  return 'Revisa la key en frontend/.env.local.';
}

function ProviderSwitch({ provider, googleError, onChange }) {
  return (
    <>
      {googleError && (
        <p role="status" className="max-w-[220px] rounded-lg border border-line-2 bg-panel/90 px-2.5 py-1.5 text-[11px] text-mute">
          <span className="font-medium text-amber">Google Maps no disponible</span> ({googleError}).{' '}
          {failureHint(googleError)}
        </p>
      )}
      <div
        role="group"
        aria-label="Proveedor del mapa"
        className="flex overflow-hidden rounded-lg border border-line-2 bg-panel/90 font-mono text-[11px]"
      >
        {PROVIDERS.map(({ id, label }) => {
          const unavailable = id === 'google' && Boolean(googleError);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={provider === id}
              disabled={unavailable}
              title={unavailable ? 'Google Maps no está disponible en esta sesión' : `Ver el mapa de ${label}`}
              onClick={() => onChange(id)}
              className={`px-2.5 py-1.5 transition disabled:opacity-40 ${
                provider === id ? 'bg-blue/20 text-fg' : 'text-mute hover:bg-white/5 hover:text-fg'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Mapa de la flota. Mismas propiedades que LeafletFleetMap; elige el proveedor. */
export default function FleetMap(props) {
  const [provider, setProvider] = useState(() => (GOOGLE_KEY && readStoredProvider() !== 'osm' ? 'google' : 'osm'));
  // Código de error de Google. Dura hasta recargar la página: entonces se vuelve a intentar.
  const [googleError, setGoogleError] = useState(null);

  const handleGoogleFail = useCallback((code) => {
    setGoogleError(code);
    setProvider('osm');
  }, []);

  function changeProvider(next) {
    setProvider(next);
    storeProvider(next);
  }

  const providerSwitch = GOOGLE_KEY && (
    <ProviderSwitch provider={provider} googleError={googleError} onChange={changeProvider} />
  );

  if (provider === 'google') {
    return (
      <GoogleFleetMap apiKey={GOOGLE_KEY} onFail={handleGoogleFail} {...props}>
        {providerSwitch}
      </GoogleFleetMap>
    );
  }
  return <LeafletFleetMap {...props}>{providerSwitch}</LeafletFleetMap>;
}
