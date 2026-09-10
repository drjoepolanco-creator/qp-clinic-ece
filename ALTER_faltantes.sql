-- ALTER_faltantes.sql · 10 de septiembre de 2026
--
-- El verificador nuevo (CHK-5, contra el esquema real) encontró más columnas
-- que el código escribe y que no existen en la base. Cada una es una función
-- que falla en silencio desde que se escribió:
--
--   · episodios_quirurgicos: cancelar o reprogramar una cirugía NO se guardaba
--   · interconsultas: responder una interconsulta no la marcaba como respondida
--   · inventario_movimientos: NINGÚN movimiento de inventario se registraba
--   · pacientes.notas_admin: al unificar expedientes, el secundario NO quedaba
--     desactivado — los duplicados seguían apareciendo en el padrón
--
-- Dos más se arreglaron del lado del código, no aquí: «facturacion» (la columna
-- real es datos_facturacion) y «usuario» en inventario_movimientos (es
-- usuario_nombre).
--
-- CORRER ANTES de publicar. SQL Editor → New query → pegar todo → Run.
-- Todo es aditivo: las columnas nuevas heredan las políticas RLS de su tabla.

ALTER TABLE public.episodios_quirurgicos
  ADD COLUMN IF NOT EXISTS motivo_cambio       text,
  ADD COLUMN IF NOT EXISTS fecha_cambio_estado timestamptz,
  ADD COLUMN IF NOT EXISTS cambio_por          uuid,
  ADD COLUMN IF NOT EXISTS episodio_origen     uuid;

ALTER TABLE public.interconsultas
  ADD COLUMN IF NOT EXISTS nota_respuesta_id uuid;

ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS stock_previo     numeric,
  ADD COLUMN IF NOT EXISTS stock_resultante numeric;

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS notas_admin text;

-- Comprobación: las 8 deben aparecer.
SELECT table_name || '.' || column_name AS columna
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (table_name, column_name) IN (
     ('episodios_quirurgicos','motivo_cambio'), ('episodios_quirurgicos','fecha_cambio_estado'),
     ('episodios_quirurgicos','cambio_por'),    ('episodios_quirurgicos','episodio_origen'),
     ('interconsultas','nota_respuesta_id'),
     ('inventario_movimientos','stock_previo'), ('inventario_movimientos','stock_resultante'),
     ('pacientes','notas_admin'))
 ORDER BY 1;
