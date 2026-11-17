/* global google -- lo define el script de Google Maps al cargar */
import { useCallback, useEffect, useRef } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
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

// Los marcadores con HTML propio (AdvancedMarkerElement) exigen un Map ID. DEMO_MAP_ID es el
// de pruebas de Google; para producción se crea uno propio en Google Cloud con estilo oscuro.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';
const MAP_BACKGROUND = '#0f1318';

const toLatLng = ([lat, lng]) => ({ lat, lng });

// Los problemas de key o de facturación (p. ej. el límite de uso de la Demo Key) Google solo los
// informa con un mensaje en la consola, "Google Maps JavaScript API error: <Código>", y deja el mapa
// en modo "solo para desarrollo"; no llama a gm_authFailure. Se escucha ese mensaje, cuyo formato
// documenta Google: https://developers.google.com/maps/documentation/javascript/error-messages
const GOOGLE_ERROR = /Google Maps JavaScript API error: (\w+)/;
const errorListeners = new Set();
let consoleWatched = false;

function onGoogleMapsError(listener) {
  if (!consoleWatched) {
    consoleWatched = true;
    const original = console.error;
    console.error = (...args) => {
      const code = typeof args[0] === 'string' && args[0].match(GOOGLE_ERROR)?.[1];
      if (code) errorListeners.forEach((fn) => fn(code));
      original.apply(console, args);
    };
  }
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

// position de AdvancedMarkerElement puede ser LatLng (métodos) o un literal (propiedades).
function readPosition(p) {
  return typeof p.lat === 'function' ? { lat: p.lat(), lng: p.lng() } : { lat: p.lat, lng: p.lng };
}

function fitAll(map, points) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.moveCamera({ center: toLatLng(points[0]), zoom: CLOSE_ZOOM });
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  points.forEach((p) => bounds.extend(toLatLng(p)));
  map.fitBounds(bounds, FIT_PADDING);
  // fitBounds no tiene zoom máximo: con vehículos muy juntos se acercaría demasiado.
  google.maps.event.addListenerOnce(map, 'idle', () => {
    if (map.getZoom() > CLOSE_ZOOM) map.setZoom(CLOSE_ZOOM);
  });
}

// Google no tiene un "flyTo" con zoom: se desplaza hasta el punto y luego acerca.
function flyTo(map, point, zoom) {
  if (prefersReducedMotion()) {
    map.moveCamera({ center: point, zoom });
    return;
  }
  map.panTo(point);
  if (map.getZoom() !== zoom) {
    google.maps.event.addListenerOnce(map, 'idle', () => map.setZoom(zoom));
  }
}

// ¿Está el punto dentro del mapa, dejando un margen del 20 % en cada borde?
function isWellInside(map, lat, lng) {
  const bounds = map.getBounds();
  if (!bounds) return true;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const padLat = (ne.lat() - sw.lat()) * 0.2;
  const padLng = (ne.lng() - sw.lng()) * 0.2;
  return lat > sw.lat() + padLat && lat < ne.lat() - padLat && lng > sw.lng() + padLng && lng < ne.lng() - padLng;
}

/**
 * Un vehículo en el mapa. Se maneja el AdvancedMarkerElement directamente (como en Leaflet)
 * para reutilizar el mismo HTML del marcador y animar su recorrido entre posiciones.
 * El marcador vive en una ref: es un objeto de Google, no estado de React. Los efectos de abajo
 * dependen de map y markerLibrary para volver a aplicarse cuando el marcador se crea.
 */
function VehicleMarker({ row, selected, onSelect }) {
  const map = useMap();
  const markerLibrary = useMapsLibrary('marker');
  const markerRef = useRef(null);
  const { vehicle, position, status } = row;
  const { latitude: lat, longitude: lng, course } = position;
  const title = markerTitle(row);

  // Se crea una sola vez, cuando el mapa y la librería están listos; los efectos de abajo aplican los cambios.
  useEffect(() => {
    if (!map || !markerLibrary) return undefined;
    const content = document.createElement('div');
    content.className = 'vm vm-google';
    const marker = new markerLibrary.AdvancedMarkerElement({
      map,
      position: { lat, lng },
      content,
      gmpClickable: true, // también se puede enfocar con Tab y abrir con Enter
    });
    markerRef.current = marker;
    return () => {
      marker.map = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, markerLibrary]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.content.innerHTML = markerHtml({ plate: vehicle.plate, status, selected, course });
    marker.title = title;
    marker.zIndex = selected ? 1000 : 0;
  }, [map, markerLibrary, title, vehicle.plate, status, selected, course]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return undefined;
    const handleClick = () => onSelect(vehicle.id);
    marker.addEventListener('gmp-click', handleClick);
    return () => marker.removeEventListener('gmp-click', handleClick);
  }, [map, markerLibrary, onSelect, vehicle.id]);

  // Desliza el marcador desde donde está hasta la nueva posición.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return undefined;
    return glide(readPosition(marker.position), { lat, lng }, (a, b) => {
      marker.position = { lat: a, lng: b };
    });
  }, [map, markerLibrary, lat, lng]);

  return null;
}

function GoogleMapContent({ rows, allPoints, selectedId, focus, onSelect, message, onFail, children }) {
  const map = useMap();
  const apiStatus = useApiLoadingStatus();
  const fitted = useRef(false);
  const lastSelected = useRef(null);
  const markers = rows.filter((r) => r.position);
  const selected = markers.find((r) => r.vehicle.id === selectedId);
  const selLat = selected?.position.latitude;
  const selLng = selected?.position.longitude;

  // Si Google no puede mostrar el mapa, se vuelve a OpenStreetMap.
  // Este efecto se registra antes de que APIProvider empiece a cargar el script (los efectos de los hijos van primero).
  useEffect(() => (onFail ? onGoogleMapsError(onFail) : undefined), [onFail]);
  useEffect(() => {
    if (apiStatus === APILoadingStatus.AUTH_FAILURE) onFail?.('AuthFailure');
    if (apiStatus === APILoadingStatus.FAILED) onFail?.('ScriptLoadFailed');
  }, [apiStatus, onFail]);

  // Encuadra la flota la primera vez que hay posiciones; después el usuario decide dónde mirar.
  useEffect(() => {
    if (!map || fitted.current || allPoints.length === 0) return;
    fitted.current = true;
    fitAll(map, allPoints);
  }, [map, allPoints]);

  useEffect(() => {
    if (!map || !focus) return;
    flyTo(map, toLatLng(focus.point), Math.max(map.getZoom() ?? 0, CLOSE_ZOOM));
  }, [map, focus]);

  // Si el vehículo seleccionado se acerca al borde mientras avanza, el mapa lo acompaña.
  useEffect(() => {
    if (!selectedMoved(lastSelected, selectedId, selLat, selLng) || !map) return;
    if (!isWellInside(map, selLat, selLng)) {
      const point = { lat: selLat, lng: selLng };
      if (prefersReducedMotion()) map.setCenter(point);
      else map.panTo(point);
    }
  }, [map, selectedId, selLat, selLng]);

  // Clic en el mapa vacío quita la selección (los clics en marcadores no llegan aquí).
  const handleMapClick = useCallback(() => onSelect(null), [onSelect]);

  return (
    <div className="fleet-map relative h-full min-h-[320px] overflow-hidden" style={{ background: MAP_BACKGROUND }}>
      <GoogleMap
        mapId={MAP_ID}
        colorScheme="DARK"
        defaultCenter={toLatLng(DEFAULT_CENTER)}
        defaultZoom={DEFAULT_ZOOM}
        backgroundColor={MAP_BACKGROUND}
        disableDefaultUI
        scaleControl
        gestureHandling="greedy"
        clickableIcons={false}
        // Reutiliza el mapa al volver a esta pantalla: Google cobra cada mapa nuevo que se crea.
        reuseMaps
        onClick={handleMapClick}
        className="h-full w-full"
      >
        {markers.map((row) => (
          <VehicleMarker key={row.vehicle.id} row={row} selected={row.vehicle.id === selectedId} onSelect={onSelect} />
        ))}
      </GoogleMap>

      <MapControls
        onZoomIn={() => map?.setZoom(map.getZoom() + 1)}
        onZoomOut={() => map?.setZoom(map.getZoom() - 1)}
        onFitAll={() => map && fitAll(map, allPoints)}
        fitDisabled={allPoints.length === 0}
        message={message}
      >
        {children}
      </MapControls>
    </div>
  );
}

/**
 * Mapa de la flota con Google Maps. Mismas propiedades que LeafletFleetMap, más:
 * - apiKey: key de Google Maps.
 * - onFail(code): Google no puede mostrar el mapa (key inválida, sin facturación o límite de la
 *   Demo Key, sin permiso para el sitio, sin red). `code` es el código de error de Google.
 */
export default function GoogleFleetMap({ apiKey, ...props }) {
  return (
    <APIProvider apiKey={apiKey} language="es" region="CO">
      <GoogleMapContent {...props} />
    </APIProvider>
  );
}
