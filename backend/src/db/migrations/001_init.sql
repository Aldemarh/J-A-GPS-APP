-- 001_init.sql
-- Base multi-tenant: todo dato de negocio pertenecerá a un tenant (cuenta).
-- Una persona natural tiene un tenant de tipo 'personal'.
-- Más adelante, una empresa será un tenant de tipo 'company' con varios usuarios.

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'personal'
                CHECK (type IN ('personal', 'company')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          VARCHAR(254) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'owner'
                   CHECK (role IN ('owner', 'admin', 'member')),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- El email es único en toda la plataforma (un login = una cuenta).
-- Se guarda en minúsculas desde la aplicación.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users (tenant_id);

-- Control de migraciones ejecutadas
CREATE TABLE IF NOT EXISTS schema_migrations (
  name        VARCHAR(255) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
