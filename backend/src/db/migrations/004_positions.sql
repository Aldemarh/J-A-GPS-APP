-- Posiciones GPS. Pertenecen al vehículo: si se borra el dispositivo, el historial se conserva.

CREATE TABLE IF NOT EXISTS positions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id   UUID NOT NULL,
  device_id    UUID REFERENCES devices(id) ON DELETE SET NULL,
  -- Hora en que el GPS tomó la posición (puede llegar tarde si el equipo estuvo sin señal).
  recorded_at  TIMESTAMPTZ NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude     DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude    DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed_kmh    REAL CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
  course       REAL CHECK (course IS NULL OR (course >= 0 AND course <= 360)),
  altitude     REAL,
  accuracy     REAL CHECK (accuracy IS NULL OR accuracy >= 0),
  battery      REAL CHECK (battery IS NULL OR (battery >= 0 AND battery <= 100)),
  CONSTRAINT positions_vehicle_same_tenant_fk FOREIGN KEY (tenant_id, vehicle_id)
    REFERENCES vehicles (tenant_id, id) ON DELETE CASCADE
);

-- Última posición y recorridos por vehículo.
CREATE INDEX IF NOT EXISTS positions_vehicle_recorded_idx ON positions (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS positions_device_id_idx ON positions (device_id);
