-- Dispositivos GPS. Cada dispositivo está vinculado a un vehículo de la misma cuenta.

-- Permite que devices referencie (tenant_id, id): la BD garantiza que el vehículo es de la misma cuenta.
ALTER TABLE vehicles ADD CONSTRAINT vehicles_tenant_id_id_key UNIQUE (tenant_id, id);

CREATE TABLE IF NOT EXISTS devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id    UUID NOT NULL,
  name          VARCHAR(100) NOT NULL,
  -- 'osmand': celular con Traccar Client. Los rastreadores físicos se agregan como nuevos protocolos.
  protocol      VARCHAR(20) NOT NULL DEFAULT 'osmand' CHECK (protocol IN ('osmand')),
  -- Lo que el equipo envía para identificarse. Único en todo el sistema.
  identifier    VARCHAR(64) NOT NULL,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT devices_vehicle_same_tenant_fk FOREIGN KEY (tenant_id, vehicle_id)
    REFERENCES vehicles (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS devices_identifier_unique ON devices (identifier);
-- Un vehículo tiene como máximo un dispositivo.
CREATE UNIQUE INDEX IF NOT EXISTS devices_vehicle_unique ON devices (vehicle_id);
CREATE INDEX IF NOT EXISTS devices_tenant_id_idx ON devices (tenant_id);
