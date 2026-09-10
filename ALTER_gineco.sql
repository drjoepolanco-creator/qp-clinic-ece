-- ALTER_gineco.sql · 10 de septiembre de 2026
--
-- POR QUÉ: la pestaña Gineco-obstétricos escribía 26 campos, pero la tabla
-- antecedentes_gineco solo tiene 10 columnas. El upsert fallaba SIEMPRE con
-- «Could not find the 'cantidad' column», y como el código ignoraba el error,
-- la pantalla decía «guardado» y no se guardaba nada. Nunca ha guardado.
--
-- Columnas que ya existen y NO se tocan:
--   id, paciente_id, menarquia, frecuencia, secreciones, gestaciones,
--   partos, abortos, cesareas, observaciones, vida_sexual_activa,
--   metodo_anticonceptivo, updated_at
-- (el index.html del 10-sep-2026 ya usa los nombres vida_sexual_activa y
--  metodo_anticonceptivo, que antes escribía como vida_sexual y mac).
--
-- CORRER ESTE ARCHIVO ANTES de publicar. Panel: Supabase → proyecto
-- ebukjdxeekhzeurmhgkj → SQL Editor → New query → pegar todo → Run.
-- Todas son texto, como las que ya están. No toca RLS: las columnas nuevas
-- heredan las políticas que la tabla ya tiene.

ALTER TABLE public.antecedentes_gineco
  ADD COLUMN IF NOT EXISTS fum           text,  -- fecha de última menstruación
  ADD COLUMN IF NOT EXISTS ritmo         text,
  ADD COLUMN IF NOT EXISTS menopausia    text,
  ADD COLUMN IF NOT EXISTS duracion      text,
  ADD COLUMN IF NOT EXISTS cantidad      text,
  ADD COLUMN IF NOT EXISTS dolor         text,
  ADD COLUMN IF NOT EXISTS edad_inicio   text,
  ADD COLUMN IF NOT EXISTS num_parejas   text,
  ADD COLUMN IF NOT EXISTS relaciones    text,
  ADD COLUMN IF NOT EXISTS ets           text,
  ADD COLUMN IF NOT EXISTS papanicolaou  text,
  ADD COLUMN IF NOT EXISTS pap_resultado text,
  ADD COLUMN IF NOT EXISTS colposcopia   text,
  ADD COLUMN IF NOT EXISTS mastografia   text,
  ADD COLUMN IF NOT EXISTS perinatales   text,
  ADD COLUMN IF NOT EXISTS lactancia     text;

-- Comprobación: deben salir las 26 del formulario + id, paciente_id, updated_at.
SELECT string_agg(column_name, ', ' ORDER BY column_name) AS columnas,
       count(*)                                           AS total
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'antecedentes_gineco';
