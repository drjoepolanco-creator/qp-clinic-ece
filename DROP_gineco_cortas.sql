-- DROP_gineco_cortas.sql · 10 de septiembre de 2026
-- Correr SOLO después de MIGRAR_gineco_paso2.sql y con la versión nueva ya en
-- línea (comprobado: qpclinic.org ya sirve el index.html del 10-sep).
--
-- Quita las cinco columnas cortas que se agregaron por error. La tabla ya tenía
-- las suyas con nombres largos y es a esas a las que apunta el código:
--   cantidad → cantidad_sangre        duracion    → duracion_menstruacion
--   dolor    → presencia_dolor        edad_inicio → edad_inicio_sexual
--   num_parejas → num_companeros
--
-- Vale la pena quitarlas y no solo dejarlas ahí: el Resumen Médico imprime
-- TODA columna de antecedentes_gineco que traiga algo, así que un
-- «cantidad: No especificado» saldría junto a «cantidad sangre: Escasa».

ALTER TABLE public.antecedentes_gineco
  DROP COLUMN IF EXISTS cantidad,
  DROP COLUMN IF EXISTS duracion,
  DROP COLUMN IF EXISTS dolor,
  DROP COLUMN IF EXISTS edad_inicio,
  DROP COLUMN IF EXISTS num_parejas;

-- Comprobación: 29 columnas, y ninguna de las cinco cortas.
SELECT count(*) AS total_columnas,
       count(*) FILTER (WHERE column_name IN
         ('cantidad','duracion','dolor','edad_inicio','num_parejas')) AS cortas_restantes
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='antecedentes_gineco';
