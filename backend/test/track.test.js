import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TRACK_POINTS,
  cleanTrack,
  distanceMeters,
  summarizeTrack,
  thinTrack,
} from '../src/modules/positions/track.js';

// Pruebas del cálculo de recorridos (sin base de datos).

const M_PER_DEG_LAT = 111_195; // metros por grado de latitud con el radio que usa distanceMeters
const T0 = new Date('2026-11-16T12:00:00Z').getTime();

/**
 * Arma un recorrido sintético: cada paso agrega una posición `every` segundos después de la anterior.
 * wait: quieto (velocidad 0, con un temblor opcional del GPS); drive: hacia el norte a `kmh`.
 */
function trackBuilder({ withSpeed = true } = {}) {
  const points = [{ recordedAt: new Date(T0), latitude: 4.6, longitude: -74.08, speedKmh: withSpeed ? 0 : null }];
  const last = () => points.at(-1);
  const add = (dt, dNorthM, dEastM, kmh) => {
    const p = last();
    points.push({
      recordedAt: new Date(p.recordedAt.getTime() + dt * 1000),
      latitude: p.latitude + dNorthM / M_PER_DEG_LAT,
      longitude: p.longitude + dEastM / M_PER_DEG_LAT,
      speedKmh: withSpeed ? kmh : null,
    });
  };
  const api = {
    points,
    wait(seconds, every, jitterM = 0) {
      for (let i = 1; i <= seconds / every; i++) add(every, 0, i % 2 ? jitterM : -jitterM, 0);
      return api;
    },
    drive(seconds, every, kmh) {
      for (let i = 1; i <= seconds / every; i++) add(every, (kmh / 3.6) * every, 0, kmh);
      return api;
    },
  };
  return api;
}

const at = (secondsFromStart) => new Date(T0 + secondsFromStart * 1000);

test('distanceMeters: un grado de latitud mide unos 111,2 km', () => {
  const d = distanceMeters({ latitude: 4, longitude: -74 }, { latitude: 5, longitude: -74 });
  assert.ok(Math.abs(d - M_PER_DEG_LAT) < 1, `distancia ${d}`);
});

test('summarizeTrack: distancia, tiempos y paradas de un recorrido con altos', () => {
  // 5 min quieto → 2 min a 36 km/h → 1 min quieto (no es parada) → 1 min a 36 km/h → 4 min quieto
  const { points } = trackBuilder().wait(300, 30).drive(120, 10, 36).wait(60, 30).drive(60, 10, 36).wait(240, 30);
  const { summary, stops } = summarizeTrack(points);

  assert.equal(summary.pointCount, points.length);
  assert.equal(summary.distanceKm, 1.8);
  assert.equal(summary.maxSpeedKmh, 36);
  // El tramo que une un punto en marcha con uno quieto cuenta como movimiento (desaceleración).
  assert.equal(summary.movingSeconds, 240);
  assert.equal(summary.stoppedSeconds, 540);
  assert.deepEqual(summary.startedAt, at(0));
  assert.deepEqual(summary.endedAt, at(780));

  assert.equal(stops.length, 2);
  assert.deepEqual(
    stops.map((s) => [s.startedAt, s.endedAt, s.durationSeconds]),
    [
      [at(0), at(300), 300],
      [at(570), at(780), 210],
    ],
  );
  assert.equal(stops[0].latitude, points[0].latitude);
});

test('summarizeTrack: el temblor del GPS estacionado no suma distancia', () => {
  const { points } = trackBuilder().wait(600, 30, 15);
  const { summary, stops } = summarizeTrack(points);
  assert.equal(summary.distanceKm, 0);
  assert.equal(summary.movingSeconds, 0);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].durationSeconds, 600);
});

test('summarizeTrack: sin velocidad reportada usa la velocidad calculada', () => {
  const { points } = trackBuilder({ withSpeed: false }).wait(240, 30).drive(100, 10, 36).wait(200, 20);
  const { summary, stops } = summarizeTrack(points);
  assert.equal(summary.distanceKm, 1);
  assert.equal(summary.maxSpeedKmh, null);
  assert.equal(summary.movingSeconds, 100);
  assert.equal(stops.length, 2);
});

test('summarizeTrack: un desplazamiento grande es movimiento aunque el GPS diga 0 km/h', () => {
  // El celular dejó de enviar mientras se conducía: dos posiciones quietas separadas 3 km.
  const points = [
    { recordedAt: at(0), latitude: 4.6, longitude: -74.08, speedKmh: 0 },
    { recordedAt: at(3600), latitude: 4.6 + 3000 / M_PER_DEG_LAT, longitude: -74.08, speedKmh: 0 },
  ];
  const { summary, stops } = summarizeTrack(points);
  assert.equal(summary.distanceKm, 3);
  assert.equal(stops.length, 0);
});

test('summarizeTrack: sin posiciones devuelve un resumen vacío', () => {
  const { summary, stops } = summarizeTrack([]);
  assert.deepEqual(summary, {
    pointCount: 0,
    startedAt: null,
    endedAt: null,
    distanceKm: 0,
    movingSeconds: 0,
    stoppedSeconds: 0,
    maxSpeedKmh: null,
  });
  assert.deepEqual(stops, []);
});

test('cleanTrack: quita posiciones con hora repetida y saltos imposibles', () => {
  const { points } = trackBuilder().drive(60, 10, 36);
  const spike = { ...points[3], recordedAt: new Date(points[3].recordedAt.getTime() + 5000), latitude: 5.5 }; // 100 km en 5 s
  const duplicate = { ...points[5], latitude: points[5].latitude + 0.001 };
  const dirty = [...points.slice(0, 4), spike, ...points.slice(4, 6), duplicate, ...points.slice(6)];

  assert.deepEqual(cleanTrack(dirty), points);
});

test('thinTrack: limita los puntos a dibujar y conserva el primero y el último', () => {
  const many = Array.from({ length: 12_345 }, (_, i) => ({ i }));
  const thinned = thinTrack(many);
  assert.ok(thinned.length <= MAX_TRACK_POINTS, `quedaron ${thinned.length}`);
  assert.equal(thinned[0], many[0]);
  assert.equal(thinned.at(-1), many.at(-1));
  const few = many.slice(0, 10);
  assert.equal(thinTrack(few), few);
});
