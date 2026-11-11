import { useEffect, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatLastSeen } from '../devices/deviceFormat.js';

// Centro inicial: Colombia. Al llegar las primeras posiciones, el mapa se encuadra en los vehículos.
const DEFAULT_CENTER = [4.5709, -74.2973];
const DEFAULT_ZOOM = 6;
const MARKER_STYLE = { color: '#ffffff', weight: 2, fillColor: '#1d4ed8', fillOpacity: 1 };

// Solo encuadra la primera vez: después, el usuario decide dónde mirar.
function FitToPoints({ points }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

function overlayMessage({ vehicles, vehiclesStatus, markers, positionsStatus }) {
  if (positionsStatus === 'error') return 'No se pudieron actualizar las ubicaciones. Se reintentará en unos segundos.';
  if (vehiclesStatus === 'ready' && vehicles.length === 0) return 'Registra tu primer vehículo para empezar.';
  if (positionsStatus === 'ready' && markers.length === 0) {
    return 'Aún no hay ubicaciones: aparecerán cuando el GPS del vehículo envíe datos.';
  }
  return null;
}

/**
 * Mapa de la flota (Leaflet + OpenStreetMap): un marcador por vehículo en su última posición conocida.
 */
export default function FleetMap({ vehicles, vehiclesStatus, positions, positionsStatus }) {
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const markers = positions.filter((p) => vehicleById.has(p.vehicleId));
  const points = markers.map((p) => [p.latitude, p.longitude]);
  const message = overlayMessage({ vehicles, vehiclesStatus, markers, positionsStatus });

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl ring-1 ring-slate-900/10">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitToPoints points={points} />
        {markers.map((p) => {
          const vehicle = vehicleById.get(p.vehicleId);
          return (
            <CircleMarker key={p.vehicleId} center={[p.latitude, p.longitude]} radius={9} pathOptions={MARKER_STYLE}>
              <Tooltip permanent direction="top" offset={[0, -10]}>
                {vehicle.plate}
              </Tooltip>
              <Popup>
                <p className="font-semibold">{vehicle.name}</p>
                <p>
                  {vehicle.plate}
                  {p.speedKmh !== null && ` · ${Math.round(p.speedKmh)} km/h`}
                </p>
                <p className="text-slate-500">{formatLastSeen(p.recordedAt)}</p>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {message && (
        // z-index por encima de las capas de Leaflet (400).
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-center">
          <p className="rounded-lg bg-white/95 px-3 py-2 text-center text-xs text-slate-600 shadow ring-1 ring-slate-900/5">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
