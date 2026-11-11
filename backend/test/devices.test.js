import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';

// Pruebas de integración del módulo de dispositivos, incluido el aislamiento entre cuentas.
// Requieren PostgreSQL con migraciones aplicadas. Borran las cuentas que crean.

let server;
let base;
const stamp = Date.now();
const emails = [`dev-a-${stamp}@ejemplo.com`, `dev-b-${stamp}@ejemplo.com`];
let tokenA;
let tokenB;
let vehicleA1;
let vehicleA2;
let vehicleB;
let deviceId;

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

async function registerUser(email) {
  const { data } = await call('POST', '/auth/register', {
    body: { fullName: 'Dispositivos Prueba', email, password: 'claveSegura123' },
  });
  return data.token;
}

async function createVehicle(token, plate) {
  const { data } = await call('POST', '/vehicles', { token, body: { name: `Vehículo ${plate}`, plate } });
  return data.vehicle.id;
}

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
  tokenA = await registerUser(emails[0]);
  tokenB = await registerUser(emails[1]);
  vehicleA1 = await createVehicle(tokenA, 'AAA111');
  vehicleA2 = await createVehicle(tokenA, 'AAA222');
  vehicleB = await createVehicle(tokenB, 'BBB111');
});

after(async () => {
  await query('DELETE FROM tenants WHERE id IN (SELECT tenant_id FROM users WHERE email = ANY($1))', [emails]);
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

test('sin token responde 401', async () => {
  assert.equal((await call('GET', '/devices')).status, 401);
});

test('crear dispositivo genera un identificador aleatorio de celular', async () => {
  const { status, data } = await call('POST', '/devices', {
    token: tokenA,
    body: { name: 'Mi celular', vehicleId: vehicleA1 },
  });
  assert.equal(status, 201);
  assert.match(data.device.identifier, /^[2-9a-z]{4}-[2-9a-z]{4}-[2-9a-z]{4}-[2-9a-z]{4}$/);
  assert.equal(data.device.protocol, 'osmand');
  assert.equal(data.device.vehicleId, vehicleA1);
  assert.equal(data.device.lastSeenAt, null);
  deviceId = data.device.id;
});

test('el cliente no puede elegir el identificador ni el protocolo', async () => {
  const { status, data } = await call('POST', '/devices', {
    token: tokenA,
    body: { name: 'Intento', vehicleId: vehicleA2, identifier: 'elegido-por-mi', protocol: 'gt06' },
  });
  assert.equal(status, 201);
  assert.notEqual(data.device.identifier, 'elegido-por-mi');
  assert.equal(data.device.protocol, 'osmand');
  assert.equal((await call('DELETE', `/devices/${data.device.id}`, { token: tokenA })).status, 204);
});

test('un vehículo solo puede tener un dispositivo (409)', async () => {
  const { status } = await call('POST', '/devices', {
    token: tokenA,
    body: { name: 'Segundo', vehicleId: vehicleA1 },
  });
  assert.equal(status, 409);
});

test('validación: sin nombre ni vehículo responde 400 por campo', async () => {
  const { status, data } = await call('POST', '/devices', { token: tokenA, body: { name: '' } });
  assert.equal(status, 400);
  const fields = data.details.map((d) => d.field);
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('vehicleId'));
});

test('vehículo inexistente responde 400 en el campo vehicleId', async () => {
  const { status, data } = await call('POST', '/devices', {
    token: tokenA,
    body: { name: 'X', vehicleId: randomUUID() },
  });
  assert.equal(status, 400);
  assert.equal(data.details[0].field, 'vehicleId');
});

test('AISLAMIENTO: no se puede vincular un dispositivo al vehículo de otra cuenta', async () => {
  const created = await call('POST', '/devices', {
    token: tokenA,
    body: { name: 'Intruso', vehicleId: vehicleB },
  });
  assert.equal(created.status, 400);

  const moved = await call('PATCH', `/devices/${deviceId}`, {
    token: tokenA,
    body: { vehicleId: vehicleB },
  });
  assert.equal(moved.status, 400);
});

test('AISLAMIENTO: otra cuenta no puede ver, editar ni borrar el dispositivo (404)', async () => {
  assert.equal((await call('GET', `/devices/${deviceId}`, { token: tokenB })).status, 404);
  assert.equal(
    (await call('PATCH', `/devices/${deviceId}`, { token: tokenB, body: { name: 'Robado' } })).status,
    404,
  );
  assert.equal((await call('DELETE', `/devices/${deviceId}`, { token: tokenB })).status, 404);
  assert.deepEqual((await call('GET', '/devices', { token: tokenB })).data.devices, []);
});

test('editar cambia el nombre y puede mover el dispositivo a otro vehículo propio', async () => {
  const { status, data } = await call('PATCH', `/devices/${deviceId}`, {
    token: tokenA,
    body: { name: 'Celular viejo', vehicleId: vehicleA2 },
  });
  assert.equal(status, 200);
  assert.equal(data.device.name, 'Celular viejo');
  assert.equal(data.device.vehicleId, vehicleA2);
});

test('id mal formado responde 404 (no 500)', async () => {
  assert.equal((await call('GET', '/devices/no-es-un-uuid', { token: tokenA })).status, 404);
});

test('borrar el vehículo borra también su dispositivo', async () => {
  assert.equal((await call('DELETE', `/vehicles/${vehicleA2}`, { token: tokenA })).status, 204);
  assert.equal((await call('GET', `/devices/${deviceId}`, { token: tokenA })).status, 404);
});

test('borrar un dispositivo libera el vehículo', async () => {
  const first = await call('POST', '/devices', { token: tokenA, body: { name: 'Uno', vehicleId: vehicleA1 } });
  assert.equal((await call('DELETE', `/devices/${first.data.device.id}`, { token: tokenA })).status, 204);
  const again = await call('POST', '/devices', { token: tokenA, body: { name: 'Dos', vehicleId: vehicleA1 } });
  assert.equal(again.status, 201);
});
