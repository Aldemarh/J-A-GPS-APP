-- 002_vehicles.sql
-- Vehículos de cada cuenta (tenant). Toda consulta debe filtrar por tenant_id.

CREATE TABLE IF NOT EXISTS vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  plate       VARCHAR(10)  NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'car'
                CHECK (type IN ('car', 'motorcycle', 'truck', 'other')),
  brand       VARCHAR(60),
  model       VARCHAR(60),
  color       VARCHAR(30),
  year        SMALLINT CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La placa es única dentro de cada cuenta (dos cuentas distintas sí pueden registrar la misma).
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_tenant_plate_unique ON vehicles (tenant_id, plate);

CREATE INDEX IF NOT EXISTS vehicles_tenant_id_idx ON vehicles (tenant_id);
