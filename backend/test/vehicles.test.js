import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';

// Pruebas de integración del módulo de vehículos, incluido el aislamiento entre cuentas.
// Requieren PostgreSQL con migraciones aplicadas. Borran las cuentas que crean.

let server;
let base;
const stamp = Date.now();
const emailFor = (label) => `veh-${label}-${stamp}@ejemplo.com`;
let tokenA;
let tokenB;
let vehicleId;

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

async function registerUser(label) {
  const { data } = await call('POST', '/auth/register', {
    body: { fullName: `Vehiculos ${label}`, email: emailFor(label), password: 'claveSegura123' },
  });
  return data.token;
}

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
  tokenA = await registerUser('a');
  tokenB = await registerUser('b');
});

after(async () => {
  await query('DELETE FROM tenants WHERE id IN (SELECT tenant_id FROM users WHERE email = ANY($1))', [
    [emailFor('a'), emailFor('b')],
  ]);
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

test('sin token responde 401', async () => {
  assert.equal((await call('GET', '/vehicles')).status, 401);
});

test('una cuenta nueva no tiene vehículos', async () => {
  const { status, data } = await call('GET', '/vehicles', { token: tokenA });
  assert.equal(status, 200);
  assert.deepEqual(data.vehicles, []);
});

test('crear vehículo normaliza la placa y aplica valores por defecto', async () => {
  const { status, data } = await call('POST', '/vehicles', {
    token: tokenA,
    body: { name: 'Mi carro', plate: 'abc-123', brand: '', year: '2020' },
  });
  assert.equal(status, 201);
  assert.equal(data.vehicle.plate, 'ABC123');
  assert.equal(data.vehicle.type, 'car');
  assert.equal(data.vehicle.brand, null);
  assert.equal(data.vehicle.year, 2020);
  vehicleId = data.vehicle.id;
});

test('placa repetida en la misma cuenta responde 409', async () => {
  const { status } = await call('POST', '/vehicles', {
    token: tokenA,
    body: { name: 'Otro', plate: 'ABC 123' },
  });
  assert.equal(status, 409);
});

test('otra cuenta sí puede usar la misma placa', async () => {
  const { status } = await call('POST', '/vehicles', {
    token: tokenB,
    body: { name: 'Carro de B', plate: 'ABC123', type: 'motorcycle' },
  });
  assert.equal(status, 201);
});

test('validación: datos inválidos responden 400 por campo', async () => {
  const { status, data } = await call('POST', '/vehicles', {
    token: tokenA,
    body: { name: '', plate: '!', type: 'avion', year: 1800 },
  });
  assert.equal(status, 400);
  const fields = data.details.map((d) => d.field);
  for (const f of ['name', 'plate', 'type', 'year']) assert.ok(fields.includes(f), `falta error en ${f}`);
});

test('listar devuelve solo los vehículos de la propia cuenta', async () => {
  const a = await call('GET', '/vehicles', { token: tokenA });
  const b = await call('GET', '/vehicles', { token: tokenB });
  assert.equal(a.data.vehicles.length, 1);
  assert.equal(b.data.vehicles.length, 1);
  assert.notEqual(a.data.vehicles[0].id, b.data.vehicles[0].id);
});

test('editar actualiza solo los campos enviados', async () => {
  const { status, data } = await call('PATCH', `/vehicles/${vehicleId}`, {
    token: tokenA,
    body: { color: 'Rojo' },
  });
  assert.equal(status, 200);
  assert.equal(data.vehicle.color, 'Rojo');
  assert.equal(data.vehicle.name, 'Mi carro');
});

test('editar sin campos responde 400', async () => {
  const { status } = await call('PATCH', `/vehicles/${vehicleId}`, { token: tokenA, body: {} });
  assert.equal(status, 400);
});

test('AISLAMIENTO: otra cuenta no puede ver, editar ni borrar el vehículo (404)', async () => {
  assert.equal((await call('GET', `/vehicles/${vehicleId}`, { token: tokenB })).status, 404);
  assert.equal(
    (await call('PATCH', `/vehicles/${vehicleId}`, { token: tokenB, body: { name: 'Robado' } })).status,
    404,
  );
  assert.equal((await call('DELETE', `/vehicles/${vehicleId}`, { token: tokenB })).status, 404);

  // El vehículo sigue intacto para su dueño
  const { data } = await call('GET', `/vehicles/${vehicleId}`, { token: tokenA });
  assert.equal(data.vehicle.name, 'Mi carro');
});

test('id mal formado responde 404 (no 500)', async () => {
  assert.equal((await call('GET', '/vehicles/no-es-un-uuid', { token: tokenA })).status, 404);
});

test('borrar elimina el vehículo', async () => {
  assert.equal((await call('DELETE', `/vehicles/${vehicleId}`, { token: tokenA })).status, 204);
  assert.equal((await call('GET', `/vehicles/${vehicleId}`, { token: tokenA })).status, 404);
});
