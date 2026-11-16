import { FLEET_STATUS, SELECTED_COLOR } from '../fleet/fleetStatus.js';

// Lo que comparten los mapas de Leaflet (OpenStreetMap) y Google: mismo encuadre, mismo
// marcador y misma animación, para que cambiar de proveedor no cambie la experiencia.

// Centro inicial: Colombia. Al llegar las primeras posiciones, el mapa se encuadra en los vehículos.
export const DEFAULT_CENTER = [4.5709, -74.2973];
export const DEFAULT_ZOOM = 6;
export const CLOSE_ZOOM = 15;
// Margen (px) al encuadrar todos los vehículos.
export const FIT_PADDING = 56;

// Al llegar una posición nueva, el marcador se desliza hasta ella en vez de saltar.
// Dura algo menos que el intervalo de consulta (5 s): el vehículo avanza de forma continua.
const GLIDE_MS = 4500;
// Saltos más largos (p. ej. un GPS que vuelve tras horas sin señal) no se animan.
const GLIDE_MAX_METERS = 3000;

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/** Marcador como en la landing: halo + punto + placa. Estilos en index.css (.vm-*). */
export function markerHtml({ plate, status, selected, course }) {
  const color = selected ? SELECTED_COLOR : FLEET_STATUS[status === 'nogps' ? 'offline' : status].color;
  const moving = status === 'moving';
  const classes = ['vm-in', moving && 'is-moving', selected && 'is-selected'].filter(Boolean).join(' ');
  const heading = moving && course != null ? `<span class="vm-dir" style="--r:${Number(course)}deg"></span>` : '';
  return `<div class="${classes}" style="--c:${color}"><span class="vm-halo"></span>${heading}<span class="vm-dot"></span><span class="vm-label">${escapeHtml(plate)}</span></div>`;
}

export const markerTitle = (row) => `${row.vehicle.name} (${row.vehicle.plate}): ${FLEET_STATUS[row.status].label}`;

/**
 * ¿Avanzó el vehículo seleccionado desde la última llamada? Guarda lo visto en `ref`.
 * Es falso al cambiar de selección (para eso está `focus`) y cuando el mapa se crea o termina
 * de cargar con un vehículo ya seleccionado (p. ej. al cambiar de proveedor).
 */
export function selectedMoved(ref, id, lat, lng) {
  const prev = ref.current;
  ref.current = lat == null ? null : { id, lat, lng };
  return prev != null && lat != null && prev.id === id && (prev.lat !== lat || prev.lng !== lng);
}

/** Distancia en metros entre dos puntos { lat, lng } (fórmula del haverseno). */
function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Desliza un marcador de `from` a `to` ({ lat, lng }) llamando a apply(lat, lng) en cada cuadro.
 * Devuelve una función que cancela la animación.
 */
export function glide(from, to, apply) {
  if (from.lat === to.lat && from.lng === to.lng) return () => {};
  if (prefersReducedMotion() || distanceMeters(from, to) > GLIDE_MAX_METERS) {
    apply(to.lat, to.lng);
    return () => {};
  }
  let frame;
  const start = performance.now();
  const step = (time) => {
    const k = Math.min(1, (time - start) / GLIDE_MS);
    apply(from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k);
    if (k < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
