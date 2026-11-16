import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapControls from './MapControls.jsx';
import {
  CLOSE_ZOOM,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FIT_PADDING,
  glide,
  markerHtml,
  markerTitle,
  prefersReducedMotion,
  selectedMoved,
} from './mapShared.js';

// Teselas de OpenStreetMap oscurecidas con CSS (.map-tiles-dark en index.css) para que
// combinen con el panel de la landing. Los mapas oscuros "listos" (CARTO, Stadia...) piden
// clave de API; cuando se contrate uno, basta cambiar esta URL y quitar el filtro.
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function vehicleIcon(options) {
  return L.divIcon({
    className: 'vm', // reemplaza el recuadro blanco que Leaflet pone por defecto
    iconSize: [0, 0],
    html: markerHtml(options),
  });
}

function fitAll(map, points, animate = true) {
  if (points.length === 0) return;
  if (points.length === 1) map.setView(points[0], CLOSE_ZOOM, { animate });
  else map.fitBounds(points, { padding: [FIT_PADDING, FIT_PADDING], maxZoom: CLOSE_ZOOM, animate });
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
  const title = markerTitle(row);

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
    const { lat: fromLat, lng: fromLng } = marker.getLatLng();
    return glide({ lat: fromLat, lng: fromLng }, { lat, lng }, (a, b) => marker.setLatLng([a, b]));
  }, [lat, lng]);

  return null;
}

/**
 * Mapa de la flota con Leaflet y OpenStreetMap.
 * - rows: filas visibles ({ vehicle, position, status }); solo se dibujan las que tienen posición.
 * - allPoints: todas las posiciones conocidas ([lat, lng]), para encuadrar la flota completa.
 * - focus: { point } nuevo en cada pedido de "centrar"; el mapa vuela hasta ahí.
 * - onSelect(vehicleId | null): clic en un marcador, o en el mapa vacío para quitar la selección.
 * - children: controles extra encima de los botones de zoom.
 */
export default function LeafletFleetMap({ rows, allPoints, selectedId, focus, onSelect, message, children }) {
  const [map, setMap] = useState(null);
  const fitted = useRef(false);
  const lastSelected = useRef(null);
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
  useEffect(() => {
    if (!selectedMoved(lastSelected, selectedId, selLat, selLng) || !map) return;
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

      <MapControls
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        onFitAll={() => map && fitAll(map, allPoints)}
        fitDisabled={allPoints.length === 0}
        message={message}
      >
        {children}
      </MapControls>
    </div>
  );
}
