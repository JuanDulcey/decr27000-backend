-- ============================================================================
-- DECR 27000 (AuditSys Mini) - Endurecimiento de Supabase (PLAN B1.4)
-- Supabase publica el esquema "public" por su API REST (PostgREST). Sin RLS,
-- cualquiera con la "anon key" podría leer o escribir las tablas sin pasar por
-- el backend. Este script:
--   1. Activa RLS en las 8 tablas, sin políticas (todo acceso vía PostgREST queda
--      denegado). El backend se conecta como dueño de las tablas y no se ve afectado.
--   2. Revoca los privilegios de los roles "anon" y "authenticated" si existen
--      (en un PostgreSQL normal, como el de Docker, esos roles no existen).
-- Es idempotente: se puede ejecutar varias veces y después de cada semilla.
-- ============================================================================
DO $$
DECLARE
  t TEXT;
  r TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuario', 'control', 'auditoria', 'evaluacion_control',
                           'evidencia', 'hallazgo', 'recomendacion', 'informe']
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;
