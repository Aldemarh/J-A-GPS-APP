import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';

// Pruebas del recorrido de un vehículo (GET /api/vehicles/:id/track).
// Requieren PostgreSQL con migraciones aplicadas. Borran las cuentas que crean.

let server;
let base;
const stamp = Date.now();
const emails = [`track-a-${stamp}@ejemplo.com`, `track-b-${stamp}@ejemplo.com`];
let a;
let b;
const KMH_TO_KNOTS = 1 / 1.852;
// El recorrido empieza hace 2 horas (las posiciones del pasado se aceptan).
const START = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
const iso = (unixSeconds) => new Date(unixSeconds * 1000).toISOString();

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function setupAccount(email, plate) {
  const reg = await call('POST', '/auth/register', {
    body: { fullName: 'Recorrido Prueba', email, password: 'claveSegura123' },
  });
  const token = reg.data.token;
  const veh = await call('POST', '/vehicles', { token, body: { name: `Vehículo ${plate}`, plate } });
  const dev = await call('POST', '/devices', { token, body: { name: 'Celular', vehicleId: veh.data.vehicle.id } });
  return { token, vehicle: veh.data.vehicle, device: dev.data.device };
}

const getTrack = (account, vehicleId, from, to) =>
  call('GET', `/vehicles/${vehicleId}/track?${new URLSearchParams({ from, to })}`, { token: account.token });

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
  a = await setupAccount(emails[0], 'TRK111');
  b = await setupAccount(emails[1], 'TRK222');

  // 4 min quieto (una posición por minuto) y luego 3 min hacia el norte a 36 km/h (1 posición cada 30 s = 300 m).
  // Se envían desordenadas: el recorrido debe salir ordenado por la hora del GPS.
  const sends = [];
  for (let i = 0; i <= 4; i++) sends.push({ t: START + i * 60, lat: 4.6, speed: 0 });
  for (let i = 1; i <= 6; i++) sends.push({ t: START + 240 + i * 30, lat: 4.6 + (i * 300) / 111_195, speed: 36 });
  sends.reverse();
  for (const s of sends) {
    const { status } = await call(
      'POST',
      `/ingest/osmand?${new URLSearchParams({
        id: a.device.identifier,
        timestamp: String(s.t),
        lat: String(s.lat),
        lon: '-74.08',
        speed: String(s.speed * KMH_TO_KNOTS),
      })}`,
    );
    assert.equal(status, 200);
  }
});

after(async () => {
  await query('DELETE FROM tenants WHERE id IN (SELECT tenant_id FROM users WHERE email = ANY($1))', [emails]);
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

test('devuelve el trayecto ordenado, el resumen y las paradas', async () => {
  const { status, data } = await getTrack(a, a.vehicle.id, iso(START - 60), iso(START + 3600));
  assert.equal(status, 200);
  assert.equal(data.vehicleId, a.vehicle.id);
  assert.equal(data.points.length, 11);
  const times = data.points.map((p) => p.recordedAt);
  assert.deepEqual(times, [...times].sort());
  assert.deepEqual(Object.keys(data.points[0]).sort(), ['course', 'latitude', 'longitude', 'recordedAt', 'speedKmh']);

  assert.equal(data.summary.pointCount, 11);
  assert.equal(data.summary.startedAt, iso(START));
  assert.equal(data.summary.endedAt, iso(START + 420));
  assert.ok(Math.abs(data.summary.distanceKm - 1.8) < 0.01, `distancia ${data.summary.distanceKm}`);
  assert.ok(Math.abs(data.summary.maxSpeedKmh - 36) < 0.5, `máxima ${data.summary.maxSpeedKmh}`);
  assert.equal(data.summary.movingSeconds, 180);
  assert.equal(data.summary.stoppedSeconds, 240);

  assert.equal(data.stops.length, 1);
  assert.equal(data.stops[0].startedAt, iso(START));
  assert.equal(data.stops[0].durationSeconds, 240);
  assert.equal(data.simplified, false);
  assert.equal(data.truncated, false);
});

test('el rango es [from, to): solo incluye las posiciones dentro', async () => {
  const { data } = await getTrack(a, a.vehicle.id, iso(START + 240), iso(START + 300));
  assert.deepEqual(
    data.points.map((p) => p.recordedAt),
    [iso(START + 240), iso(START + 270)],
  );
});

test('sin posiciones en el rango: trayecto vacío y resumen en cero', async () => {
  const { status, data } = await getTrack(a, a.vehicle.id, iso(START - 7200), iso(START - 3600));
  assert.equal(status, 200);
  assert.deepEqual(data.points, []);
  assert.deepEqual(data.stops, []);
  assert.equal(data.summary.distanceKm, 0);
  assert.equal(data.summary.startedAt, null);
});

test('un vehículo de otra cuenta, inexistente o con id inválido responde 404', async () => {
  const range = [iso(START), iso(START + 3600)];
  assert.equal((await getTrack(b, a.vehicle.id, ...range)).status, 404);
  assert.equal((await getTrack(a, '00000000-0000-4000-8000-000000000000', ...range)).status, 404);
  assert.equal((await getTrack(a, 'no-es-un-id', ...range)).status, 404);
});

test('sin token responde 401', async () => {
  const { status } = await call('GET', `/vehicles/${a.vehicle.id}/track?from=${iso(START)}&to=${iso(START + 60)}`);
  assert.equal(status, 401);
});

test('fechas faltantes, inválidas o rango de más de 7 días responden 400 con el detalle', async () => {
  const missing = await call('GET', `/vehicles/${a.vehicle.id}/track`, { token: a.token });
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.data.details.map((d) => d.field).sort(), ['from', 'to']);

  const backwards = await getTrack(a, a.vehicle.id, iso(START + 60), iso(START));
  assert.equal(backwards.status, 400);
  assert.equal(backwards.data.details[0].field, 'to');

  const tooLong = await getTrack(a, a.vehicle.id, iso(START - 8 * 86400), iso(START));
  assert.equal(tooLong.status, 400);
  assert.match(tooLong.data.details[0].message, /7 días/);

  const notADate = await getTrack(a, a.vehicle.id, 'ayer', iso(START));
  assert.equal(notADate.status, 400);
  assert.equal(notADate.data.details[0].field, 'from');
});
