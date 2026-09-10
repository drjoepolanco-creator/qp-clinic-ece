-- ALTER_neonatales.sql · 10 de septiembre de 2026
--
-- POR QUÉ: los antecedentes neonatales se guardaban como JSON dentro de
-- antecedentes_no_patologicos.texto, la MISMA columna (fila única por
-- paciente_id) que usa la pestaña «No Patológicos». Cada pestaña borraba a la
-- otra, y además los datos neonatales nunca se volvían a leer al abrir el
-- expediente: se guardaban y se perdían.
--
-- CORRER ESTE ARCHIVO ANTES de publicar el index.html del 10-sep-2026.
-- Panel: Supabase → proyecto ebukjdxeekhzeurmhgkj → SQL Editor → New query.
-- Pegar todo y darle Run. No toca RLS: una columna nueva hereda las políticas
-- que la tabla ya tiene.

-- 1 · Columna propia para los antecedentes neonatales.
ALTER TABLE public.antecedentes_no_patologicos
  ADD COLUMN IF NOT EXISTS neonatales jsonb;

-- 2 · Rescatar lo que quedó atrapado dentro de «texto» y dejar «texto» vacío,
--     que es lo que la pestaña No Patológicos espera encontrar ahí.
UPDATE public.antecedentes_no_patologicos
   SET neonatales = (texto::jsonb) -> 'datos',
       texto      = ''
 WHERE neonatales IS NULL
   AND texto LIKE '{"tipo":"neonatales"%';

-- 3 · Comprobación. Es el único resultado que muestra el editor.
--     «sin_migrar» debe quedar en 0.
SELECT count(*) FILTER (WHERE neonatales IS NOT NULL)                AS con_neonatales,
       count(*) FILTER (WHERE texto LIKE '{"tipo":"neonatales"%')    AS sin_migrar,
       count(*)                                                      AS filas_totales
  FROM public.antecedentes_no_patologicos;
