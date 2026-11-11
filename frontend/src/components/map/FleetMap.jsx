import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Centro inicial: Colombia. Cuando haya posiciones reales, el mapa se ajustará a los vehículos.
const DEFAULT_CENTER = [4.5709, -74.2973];
const DEFAULT_ZOOM = 6;

/**
 * Mapa base de la flota (Leaflet + OpenStreetMap).
 * Todavía no hay posiciones GPS: no se dibujan marcadores inventados.
 */
export default function FleetMap({ vehicleCount }) {
  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl ring-1 ring-slate-900/10">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </MapContainer>

      {/* Aviso sobre el mapa: z-index por encima de las capas de Leaflet (400). */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-center">
        <p className="rounded-lg bg-white/95 px-3 py-2 text-center text-xs text-slate-600 shadow ring-1 ring-slate-900/5">
          {vehicleCount === 0
            ? 'Registra tu primer vehículo para empezar.'
            : 'Aún no hay ubicaciones: aparecerán cuando conectes un dispositivo GPS al vehículo.'}
        </p>
      </div>
    </div>
  );
}
