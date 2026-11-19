-- ============================================================================
-- 001 - Archivo adjunto de la evidencia (bucket S3 de Railway, PLAN P8)
-- Columnas opcionales: una evidencia puede tener solo referencia_url, solo
-- archivo, o ambos. Idempotente: se puede ejecutar varias veces.
-- ============================================================================
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS archivo_key    TEXT;
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS archivo_nombre VARCHAR(255);
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS archivo_tipo   VARCHAR(120);
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS archivo_tamano INTEGER CHECK (archivo_tamano IS NULL OR archivo_tamano >= 0);
