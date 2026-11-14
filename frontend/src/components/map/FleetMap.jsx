import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FLEET_STATUS, SELECTED_COLOR } from '../fleet/fleetStatus.js';
import { IconExpand, IconMinus, IconPlus } from '../icons.jsx';

// Centro inicial: Colombia. Al llegar las primeras posiciones, el mapa se encuadra en los vehículos.
const DEFAULT_CENTER = [4.5709, -74.2973];
const DEFAULT_ZOOM = 6;
const CLOSE_ZOOM = 15;

// Teselas de OpenStreetMap oscurecidas con CSS (.map-tiles-dark en index.css) para que
// combinen con el panel de la landing. Los mapas oscuros "listos" (CARTO, Stadia...) piden
// clave de API; cuando se contrate uno, basta cambiar esta URL y quitar el filtro.
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Al llegar una posición nueva, el marcador se desliza hasta ella en vez de saltar.
// Dura algo menos que el intervalo de consulta (5 s): el vehículo avanza de forma continua.
const GLIDE_MS = 4500;
// Saltos más largos (p. ej. un GPS que vuelve tras horas sin señal) no se animan.
const GLIDE_MAX_METERS = 3000;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Marcador como en la landing: halo + punto + placa. Estilos en index.css (.vm-*).
function vehicleIcon({ plate, status, selected, course }) {
  const color = selected ? SELECTED_COLOR : FLEET_STATUS[status === 'nogps' ? 'offline' : status].color;
  const moving = status === 'moving';
  const classes = ['vm-in', moving && 'is-moving', selected && 'is-selected'].filter(Boolean).join(' ');
  const heading = moving && course != null ? `<span class="vm-dir" style="--r:${Number(course)}deg"></span>` : '';
  return L.divIcon({
    className: 'vm', // reemplaza el recuadro blanco que Leaflet pone por defecto
    iconSize: [0, 0],
    html: `<div class="${classes}" style="--c:${color}"><span class="vm-halo"></span>${heading}<span class="vm-dot"></span><span class="vm-label">${escapeHtml(plate)}</span></div>`,
  });
}

function fitAll(map, points, animate = true) {
  if (points.length === 0) return;
  if (points.length === 1) map.setView(points[0], CLOSE_ZOOM, { animate });
  else map.fitBounds(points, { padding: [56, 56], maxZoom: CLOSE_ZOOM, animate });
}

/**
 * Un vehículo en el mapa. Se maneja el marcador de Leaflet directamente para poder
 * animar su recorrido entre posiciones (react-leaflet lo movería de un salto).
 */
function VehicleMarker({ row, selected, onSelect }) {
  const map = useMap();
  const markerRef = useRef(null);
  const { vehicle, position, status } = row;
  const { latitude: lat, longitude: lng, course } = position;
  const title = `${vehicle.name} (${vehicle.plate}): ${FLEET_STATUS[status].label}`;

  // Se crea una sola vez; los efectos de abajo aplican los cambios.
  useEffect(() => {
    const marker = L.marker([lat, lng], {
      icon: vehicleIcon({ plate: vehicle.plate, status, selected, course }),
      keyboard: true, // se puede enfocar con Tab y abrir con Enter
      riseOnHover: true,
      title,
    }).addTo(map);
    markerRef.current = marker;
    return () => marker.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const marker = markerRef.current;
    marker.options.title = title; // setIcon vuelve a aplicar el título
    marker.setIcon(vehicleIcon({ plate: vehicle.plate, status, selected, course }));
    marker.setZIndexOffset(selected ? 1000 : 0);
  }, [title, vehicle.plate, status, selected, course]);

  useEffect(() => {
    const marker = markerRef.current;
    const handleClick = () => onSelect(vehicle.id);
    marker.on('click', handleClick);
    return () => marker.off('click', handleClick);
  }, [onSelect, vehicle.id]);

  // Desliza el marcador desde donde está hasta la nueva posición.
  useEffect(() => {
    const marker = markerRef.current;
    const from = marker.getLatLng();
    const to = L.latLng(lat, lng);
    if (from.equals(to)) return undefined;
    if (prefersReducedMotion() || from.distanceTo(to) > GLIDE_MAX_METERS) {
      marker.setLatLng(to);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const step = (time) => {
      const k = Math.min(1, (time - start) / GLIDE_MS);
      marker.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k]);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lat, lng]);

  return null;
}

function MapButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center text-mute transition hover:bg-white/5 hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Mapa de la flota.
 * - rows: filas visibles ({ vehicle, position, status }); solo se dibujan las que tienen posición.
 * - allPoints: todas las posiciones conocidas, para encuadrar la flota completa.
 * - focus: { point } nuevo en cada pedido de "centrar"; el mapa vuela hasta ahí.
 * - onSelect(vehicleId | null): clic en un marcador, o en el mapa vacío para quitar la selección.
 */
export default function FleetMap({ rows, allPoints, selectedId, focus, onSelect, message }) {
  const [map, setMap] = useState(null);
  const fitted = useRef(false);
  const lastSelectedId = useRef(null);
  const markers = rows.filter((r) => r.position);
  const selected = markers.find((r) => r.vehicle.id === selectedId);
  const selLat = selected?.position.latitude;
  const selLng = selected?.position.longitude;

  // Encuadra la flota la primera vez que hay posiciones; después el usuario decide dónde mirar.
  useEffect(() => {
    if (!map || fitted.current || allPoints.length === 0) return;
    fitted.current = true;
    fitAll(map, allPoints, false);
  }, [map, allPoints]);

  useEffect(() => {
    if (!map || !focus) return;
    const zoom = Math.max(map.getZoom(), CLOSE_ZOOM);
    if (prefersReducedMotion()) map.setView(focus.point, zoom, { animate: false });
    else map.flyTo(focus.point, zoom, { duration: 0.8 });
  }, [map, focus]);

  // Si el vehículo seleccionado se acerca al borde mientras avanza, el mapa lo acompaña.
  // Solo cuando se mueve el mismo vehículo: al cambiar de selección manda `focus`.
  useEffect(() => {
    const sameVehicle = lastSelectedId.current === selectedId;
    lastSelectedId.current = selectedId;
    if (!map || !sameVehicle || selLat == null) return;
    if (!map.getBounds().pad(-0.2).contains([selLat, selLng])) {
      map.panTo([selLat, selLng], { animate: !prefersReducedMotion() });
    }
  }, [map, selectedId, selLat, selLng]);

  useEffect(() => {
    if (!map) return undefined;
    const handleClick = () => onSelect(null);
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [map, onSelect]);

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
        <TileLayer url={TILES_URL} attribution={TILES_ATTRIBUTION} maxZoom={19} className="map-tiles-dark" />
        {markers.map((row) => (
          <VehicleMarker key={row.vehicle.id} row={row} selected={row.vehicle.id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>

      {/* z-index por encima de las capas de Leaflet (400) y por debajo de los modales. */}
      <div className="absolute right-3 bottom-8 z-[500] grid divide-y divide-line overflow-hidden rounded-lg border border-line-2 bg-panel/90">
        <MapButton label="Acercar" onClick={() => map?.zoomIn()}>
          <IconPlus className="size-4" />
        </MapButton>
        <MapButton label="Alejar" onClick={() => map?.zoomOut()}>
          <IconMinus className="size-4" />
        </MapButton>
        <MapButton
          label="Ver todos los vehículos"
          onClick={() => map && fitAll(map, allPoints)}
          disabled={allPoints.length === 0}
        >
          <IconExpand className="size-4" />
        </MapButton>
      </div>

      {message && (
        <div className="pointer-events-none absolute inset-x-3 bottom-10 z-[500] flex justify-center">
          <p className="max-w-sm rounded-lg border border-line-2 bg-panel/90 px-3 py-2 text-center text-xs text-mute">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
