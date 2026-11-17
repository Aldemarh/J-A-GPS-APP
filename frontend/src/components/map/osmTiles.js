// Teselas de OpenStreetMap para los mapas de Leaflet, oscurecidas con CSS (.map-tiles-dark en
// index.css) para que combinen con el panel de la landing. Los mapas oscuros "listos" (CARTO,
// Stadia...) piden clave de API; cuando se contrate uno, basta cambiar esta URL y quitar el filtro.
export const OSM_TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const OSM_MAX_ZOOM = 19;
