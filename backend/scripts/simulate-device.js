// Simulador de un celular con Traccar Client (protocolo OsmAnd, formato clásico).
// Envía posiciones de un recorrido simulado al mismo endpoint que usará el celular real.
//
// Uso:  npm run simulate -- <identificador> [--interval 5] [--lat 4.6510] [--lon -74.0610] [--url ...]

import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string', default: 'http://localhost:4000/api/ingest/osmand' },
    interval: { type: 'string', default: '5' },
    lat: { type: 'string', default: '4.6510' },
    lon: { type: 'string', default: '-74.0610' },
  },
});

const identifier = positionals[0];
if (!identifier) {
  console.log('Uso: npm run simulate -- <identificador> [--interval 5] [--lat 4.6510] [--lon -74.0610]');
  console.log('El identificador está en la ventana "GPS" del vehículo, en el panel.');
  process.exit(1);
}

const intervalSec = Math.max(1, Number(values.interval));
const KMH_TO_KNOTS = 1 / 1.852;
const METERS_PER_DEGREE = 111_320;

const state = {
  lat: Number(values.lat),
  lon: Number(values.lon),
  bearing: Math.random() * 360,
  speedKmh: 30,
  battery: 100,
};
let sent = 0;
let timer;

// Se deja terminar el proceso solo: process.exit() con fetch abierto falla en Node para Windows.
function stop(code) {
  clearInterval(timer);
  process.exitCode = code;
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Avanza el vehículo: velocidad y rumbo cambian poco a poco, como en una vía real.
function step() {
  state.speedKmh = clamp(state.speedKmh + (Math.random() - 0.5) * 16, 0, 60);
  state.bearing = (state.bearing + (Math.random() - 0.5) * 40 + 360) % 360;
  const meters = (state.speedKmh / 3.6) * intervalSec;
  const rad = (state.bearing * Math.PI) / 180;
  state.lat += (meters * Math.cos(rad)) / METERS_PER_DEGREE;
  state.lon += (meters * Math.sin(rad)) / (METERS_PER_DEGREE * Math.cos((state.lat * Math.PI) / 180));
  state.battery = Math.max(5, state.battery - 0.1);
}

// Devuelve false si no tiene sentido seguir enviando.
async function send() {
  const params = new URLSearchParams({
    id: identifier,
    timestamp: String(Math.floor(Date.now() / 1000)),
    lat: state.lat.toFixed(6),
    lon: state.lon.toFixed(6),
    speed: (state.speedKmh * KMH_TO_KNOTS).toFixed(2),
    bearing: state.bearing.toFixed(0),
    altitude: '2600',
    accuracy: (5 + Math.random() * 10).toFixed(1),
    batt: state.battery.toFixed(0),
  });
  const time = new Date().toLocaleTimeString('es-CO');

  let res;
  try {
    res = await fetch(`${values.url}?${params}`, { method: 'POST' });
  } catch {
    console.log(`[${time}] Sin conexión con ${values.url}. ¿Está corriendo la API (npm run dev en backend)?`);
    return true;
  }

  if (res.ok) {
    sent += 1;
    console.log(
      `[${time}] Enviada #${sent}: ${state.lat.toFixed(5)}, ${state.lon.toFixed(5)} · ${state.speedKmh.toFixed(0)} km/h`,
    );
    return true;
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) {
    console.log('El identificador no está registrado. Cópialo desde la ventana "GPS" del vehículo.');
    return false;
  }
  const details = body.details?.map((d) => `${d.field}: ${d.message}`).join('; ');
  console.log(`[${time}] Rechazada (${res.status}): ${body.error ?? ''} ${details ?? ''}`);
  return true;
}

console.log(`Simulando el dispositivo ${identifier}: una posición cada ${intervalSec} s. Ctrl+C para detener.\n`);
process.on('SIGINT', () => {
  console.log(`\nSimulación detenida. Posiciones enviadas: ${sent}.`);
  stop(0);
});

if (await send()) {
  timer = setInterval(async () => {
    step();
    if (!(await send())) stop(1);
  }, intervalSec * 1000);
} else {
  stop(1);
}
