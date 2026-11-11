import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { closePool, query } from '../src/db/pool.js';

// Pruebas de integración del módulo auth. Requieren PostgreSQL con migraciones aplicadas.
// Cada ejecución usa correos únicos para no chocar con datos previos y borra la cuenta al terminar.

let server;
let base;
const stamp = Date.now();
const email = `test-${stamp}@ejemplo.com`;
const password = 'claveSegura123';

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
});

after(async () => {
  await query('DELETE FROM tenants WHERE id IN (SELECT tenant_id FROM users WHERE email = $1)', [email]);
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

test('health responde ok', async () => {
  const { status, data } = await call('GET', '/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
});

test('register crea cuenta personal y devuelve token', async () => {
  const { status, data } = await call('POST', '/auth/register', {
    body: { fullName: 'Prueba Uno', email, password },
  });
  assert.equal(status, 201);
  assert.ok(data.token);
  assert.equal(data.user.email, email);
  assert.equal(data.user.role, 'owner');
  assert.equal(data.user.password, undefined);
  assert.equal(data.user.password_hash, undefined);
});

test('register rechaza correo duplicado (409), sin importar mayúsculas', async () => {
  const { status } = await call('POST', '/auth/register', {
    body: { fullName: 'Otro', email: email.toUpperCase(), password },
  });
  assert.equal(status, 409);
});

test('register valida campos y muestra errores por campo', async () => {
  const { status, data } = await call('POST', '/auth/register', {
    body: { fullName: 'A', email: 'malo', password: '123' },
  });
  assert.equal(status, 400);
  const fields = data.details.map((d) => d.field);
  assert.ok(fields.includes('fullName'));
  assert.ok(fields.includes('email'));
  assert.ok(fields.includes('password'));
});

test('register sin campos responde 400 con mensaje en español', async () => {
  const { status, data } = await call('POST', '/auth/register', { body: {} });
  assert.equal(status, 400);
  assert.ok(data.details.some((d) => d.message.includes('obligatori')));
});

test('login con credenciales correctas devuelve token', async () => {
  const { status, data } = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(status, 200);
  assert.ok(data.token);
});

test('login con clave incorrecta o correo inexistente responde igual (401)', async () => {
  const wrong = await call('POST', '/auth/login', { body: { email, password: 'otraClave999' } });
  const missing = await call('POST', '/auth/login', {
    body: { email: `nadie-${stamp}@ejemplo.com`, password: 'otraClave999' },
  });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(wrong.data.error, missing.data.error);
});

test('me devuelve el perfil con token válido', async () => {
  const login = await call('POST', '/auth/login', { body: { email, password } });
  const { status, data } = await call('GET', '/auth/me', { token: login.data.token });
  assert.equal(status, 200);
  assert.equal(data.user.email, email);
  assert.equal(data.user.tenant.type, 'personal');
});

test('me rechaza sin token y con token falso (401)', async () => {
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: 'abc.def.ghi' })).status, 401);
});

test('ruta inexistente responde 404 en JSON', async () => {
  const { status, data } = await call('GET', '/no-existe');
  assert.equal(status, 404);
  assert.ok(data.error);
});
