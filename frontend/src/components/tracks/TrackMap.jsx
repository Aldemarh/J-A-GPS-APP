import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapControls from '../map/MapControls.jsx';
import { CLOSE_ZOOM, DEFAULT_CENTER, DEFAULT_ZOOM, FIT_PADDING, prefersReducedMotion } from '../map/mapShared.js';
import { OSM_ATTRIBUTION, OSM_MAX_ZOOM, OSM_TILES_URL } from '../map/osmTiles.js';
import { FLEET_STATUS, SELECTED_COLOR } from '../fleet/fleetStatus.js';
import { formatDuration, formatTime } from './trackFormat.js';

// Trayecto en azul con un borde oscuro debajo para que se lea sobre cualquier calle.
const LINE = { color: SELECTED_COLOR, weight: 4, opacity: 0.95, lineJoin: 'round', lineCap: 'round' };
const CASING = { color: '#05070a', weight: 8, opacity: 0.55, lineJoin: 'round', lineCap: 'round' };

// Puntos del recorrido (estilos .tm-* en index.css). El texto va siempre junto al color.
function pointIcon({ color, label, selected }) {
  return L.divIcon({
    className: 'tm',
    iconSize: [0, 0],
    html: `<div class="tm-in${selected ? ' is-selected' : ''}" style="--c:${color}"><span class="tm-dot"></span><span class="tm-label">${label}</span></div>`,
  });
}

function stopIcon({ number, selected }) {
  return L.divIcon({
    className: 'tm',
    iconSize: [0, 0],
    html: `<div class="tm-in${selected ? ' is-selected' : ''}" style="--c:${FLEET_STATUS.stopped.color}"><span class="tm-num">${number}</span></div>`,
  });
}

function fitTrack(map, latlngs, animate = true) {
  if (latlngs.length === 0) return;
  if (latlngs.length === 1) map.setView(latlngs[0], CLOSE_ZOOM, { animate });
  else map.fitBounds(latlngs, { padding: [FIT_PADDING, FIT_PADDING], maxZoom: CLOSE_ZOOM + 1, animate });
}

/**
 * Mapa de un recorrido (Leaflet y OpenStreetMap).
 * - points / stops: los del API de recorridos.
 * - fitKey: cambia con el vehículo o el día; el mapa se encuadra una vez por cada uno
 *   (las actualizaciones del día de hoy no mueven la vista).
 * - selected: 'start' | 'end' | índice de parada | null. onSelect(clave) al pulsar un punto.
 * - focus: { point } nuevo en cada pedido de "ir a"; el mapa vuela hasta ahí.
 * - endLabel: texto del último punto ("Fin" o "Ahora").
 */
export default function TrackMap({ points, stops, fitKey, selected, onSelect, focus, endLabel, message }) {
  const [map, setMap] = useState(null);
  const fittedKey = useRef(null);
  const latlngs = useMemo(() => points.map((p) => [p.latitude, p.longitude]), [points]);
  const first = points[0];
  const last = points.at(-1);

  useEffect(() => {
    if (!map || latlngs.length === 0 || fittedKey.current === fitKey) return;
    fittedKey.current = fitKey;
    fitTrack(map, latlngs, false);
  }, [map, latlngs, fitKey]);

  useEffect(() => {
    if (!map || !focus) return;
    const zoom = Math.max(map.getZoom(), CLOSE_ZOOM + 1);
    if (prefersReducedMotion()) map.setView(focus.point, zoom, { animate: false });
    else map.flyTo(focus.point, zoom, { duration: 0.8 });
  }, [map, focus]);

  useEffect(() => {
    if (!map) return undefined;
    const scale = L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 90 }).addTo(map);
    return () => scale.remove();
  }, [map]);

  return (
    <div className="fleet-map relative h-full min-h-[320px] overflow-hidden">
      <MapContainer
        ref={setMap}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer url={OSM_TILES_URL} attribution={OSM_ATTRIBUTION} maxZoom={OSM_MAX_ZOOM} className="map-tiles-dark" />
        {latlngs.length > 1 && (
          <>
            <Polyline positions={latlngs} pathOptions={CASING} interactive={false} />
            <Polyline positions={latlngs} pathOptions={LINE} interactive={false} />
          </>
        )}
        {stops.map((stop, i) => (
          <Marker
            key={stop.startedAt}
            position={[stop.latitude, stop.longitude]}
            icon={stopIcon({ number: i + 1, selected: selected === i })}
            title={`Parada ${i + 1}: ${formatTime(stop.startedAt)}, ${formatDuration(stop.durationSeconds)}`}
            zIndexOffset={selected === i ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(i) }}
          />
        ))}
        {first && (
          <Marker
            position={[first.latitude, first.longitude]}
            icon={pointIcon({ color: FLEET_STATUS.moving.color, label: 'Inicio', selected: selected === 'start' })}
            title={`Inicio: ${formatTime(first.recordedAt)}`}
            zIndexOffset={selected === 'start' ? 1000 : 500}
            eventHandlers={{ click: () => onSelect('start') }}
          />
        )}
        {last && last !== first && (
          <Marker
            position={[last.latitude, last.longitude]}
            icon={pointIcon({ color: SELECTED_COLOR, label: endLabel, selected: selected === 'end' })}
            title={`${endLabel}: ${formatTime(last.recordedAt)}`}
            zIndexOffset={selected === 'end' ? 1000 : 600}
            eventHandlers={{ click: () => onSelect('end') }}
          />
        )}
      </MapContainer>

      <MapControls
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        onFitAll={() => map && fitTrack(map, latlngs)}
        fitDisabled={latlngs.length === 0}
        fitLabel="Ver todo el recorrido"
        message={message}
      />
    </div>
  );
}
