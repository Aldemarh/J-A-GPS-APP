import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';

// Pruebas de recepción de posiciones (protocolo OsmAnd) y de la última ubicación por vehículo.
// Requieren PostgreSQL con migraciones aplicadas. Borran las cuentas que crean.

let server;
let base;
const stamp = Date.now();
const emails = [`pos-a-${stamp}@ejemplo.com`, `pos-b-${stamp}@ejemplo.com`];
let tokenA;
let tokenB;
let vehicleA;
let deviceA;
const nowSec = () => Math.floor(Date.now() / 1000);

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

// Igual que Traccar Client clásico: POST con los datos en la URL.
const sendOsmand = (params) => call('POST', `/ingest/osmand?${new URLSearchParams(params)}`);

async function setupAccount(email, plate) {
  const reg = await call('POST', '/auth/register', {
    body: { fullName: 'Posiciones Prueba', email, password: 'claveSegura123' },
  });
  const token = reg.data.token;
  const veh = await call('POST', '/vehicles', { token, body: { name: `Vehículo ${plate}`, plate } });
  const dev = await call('POST', '/devices', { token, body: { name: 'Celular', vehicleId: veh.data.vehicle.id } });
  return { token, vehicle: veh.data.vehicle, device: dev.data.device };
}

const latestFor = async (token) => (await call('GET', '/positions/latest', { token })).data.positions;

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
  const a = await setupAccount(emails[0], 'POS111');
  const b = await setupAccount(emails[1], 'POS222');
  tokenA = a.token;
  vehicleA = a.vehicle;
  deviceA = a.device;
  tokenB = b.token;
});

after(async () => {
  await query('DELETE FROM tenants WHERE id IN (SELECT tenant_id FROM users WHERE email = ANY($1))', [emails]);
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

test('sin posiciones, latest devuelve lista vacía; sin token responde 401', async () => {
  assert.deepEqual(await latestFor(tokenA), []);
  assert.equal((await call('GET', '/positions/latest')).status, 401);
});

test('formato clásico (URL): guarda la posición y convierte nudos a km/h', async () => {
  const ts = nowSec() - 60;
  const { status } = await sendOsmand({
    id: deviceA.identifier,
    lat: '4.6510',
    lon: '-74.0610',
    timestamp: String(ts),
    speed: '10',
    bearing: '90',
    accuracy: '12',
    batt: '80',
  });
  assert.equal(status, 200);

  const [p] = await latestFor(tokenA);
  assert.equal(p.vehicleId, vehicleA.id);
  assert.equal(p.deviceId, deviceA.id);
  assert.equal(p.latitude, 4.651);
  assert.equal(p.longitude, -74.061);
  assert.ok(Math.abs(p.speedKmh - 18.52) < 0.01);
  assert.equal(p.course, 90);
  assert.equal(p.battery, 80);
  assert.equal(new Date(p.recordedAt).getTime(), ts * 1000);
});

test('marca la hora del último dato en el dispositivo', async () => {
  const { data } = await call('GET', `/devices/${deviceA.id}`, { token: tokenA });
  assert.ok(data.device.lastSeenAt);
});

test('formato JSON (Traccar Client reciente): convierte m/s a km/h y batería 0–1 a %', async () => {
  const { status } = await call('POST', '/ingest/osmand', {
    body: {
      device_id: deviceA.identifier,
      location: {
        timestamp: new Date().toISOString(),
        coords: { latitude: 4.652, longitude: -74.062, speed: 10, heading: -1, accuracy: 8 },
        battery: { level: 0.5 },
      },
    },
  });
  assert.equal(status, 200);

  const [p] = await latestFor(tokenA);
  assert.equal(p.latitude, 4.652);
  assert.equal(p.speedKmh, 36);
  assert.equal(p.course, null);
  assert.equal(p.battery, 50);
});

test('una posición atrasada (enviada tarde) no reemplaza a la más reciente', async () => {
  const { status } = await sendOsmand({
    id: deviceA.identifier,
    lat: '4.0',
    lon: '-74.0',
    timestamp: String(nowSec() - 3600),
  });
  assert.equal(status, 200);
  const [p] = await latestFor(tokenA);
  assert.equal(p.latitude, 4.652);
});

test('identificador no registrado responde 404', async () => {
  const { status } = await sendOsmand({ id: 'no-existe-0000', lat: '4.6', lon: '-74.0' });
  assert.equal(status, 404);
});

test('datos inválidos responden 400 por campo', async () => {
  const { status, data } = await sendOsmand({ lat: '200', lon: 'abc' });
  assert.equal(status, 400);
  const fields = data.details.map((d) => d.field);
  for (const f of ['identifier', 'latitude', 'longitude']) assert.ok(fields.includes(f), `falta error en ${f}`);
});

test('una hora en el futuro se rechaza', async () => {
  const { status } = await sendOsmand({
    id: deviceA.identifier,
    lat: '4.6',
    lon: '-74.0',
    timestamp: String(nowSec() + 3600),
  });
  assert.equal(status, 400);
});

test('un dato opcional fuera de rango se descarta sin perder la posición', async () => {
  const { status } = await sendOsmand({
    id: deviceA.identifier,
    lat: '4.653',
    lon: '-74.063',
    bearing: '999',
    batt: '-5',
  });
  assert.equal(status, 200);
  const [p] = await latestFor(tokenA);
  assert.equal(p.latitude, 4.653);
  assert.equal(p.course, null);
  assert.equal(p.battery, null);
});

test('AISLAMIENTO: otra cuenta no ve las posiciones de este vehículo', async () => {
  const positions = await latestFor(tokenB);
  assert.ok(positions.every((p) => p.vehicleId !== vehicleA.id));
});

test('al borrar el dispositivo, el historial del vehículo se conserva', async () => {
  assert.equal((await call('DELETE', `/devices/${deviceA.id}`, { token: tokenA })).status, 204);
  const [p] = await latestFor(tokenA);
  assert.equal(p.vehicleId, vehicleA.id);
  assert.equal(p.deviceId, null);

  // El identificador borrado ya no puede enviar posiciones.
  const { status } = await sendOsmand({ id: deviceA.identifier, lat: '4.6', lon: '-74.0' });
  assert.equal(status, 404);
});
