-- OPCIONAL_gineco_duplicadas.sql · 10 de septiembre de 2026
--
-- La tabla antecedentes_gineco ya tenía columnas con los nombres largos
-- correctos; el código usaba nombres cortos distintos, así que el 10-sep se
-- agregaron 5 duplicadas por error de mi parte:
--
--   cantidad   ↔ cantidad_sangre          duracion    ↔ duracion_menstruacion
--   dolor      ↔ presencia_dolor          edad_inicio ↔ edad_inicio_sexual
--   num_parejas ↔ num_companeros
--
-- El index.html ya apunta a las originales (las largas). Las cinco cortas
-- quedaron vacías: nunca se publicó código que escribiera en ellas.
--
-- Esto es OPCIONAL y es la única acción destructiva de hoy. Antes de correrla,
-- confirme que siguen vacías con la primera consulta. Si algún número es > 0,
-- NO corra el DROP y avíseme.

SELECT count(cantidad)    AS cantidad,   count(duracion)    AS duracion,
       count(dolor)       AS dolor,      count(edad_inicio) AS edad_inicio,
       count(num_parejas) AS num_parejas
  FROM public.antecedentes_gineco;

-- Solo si los cinco salieron en 0:
-- ALTER TABLE public.antecedentes_gineco
--   DROP COLUMN cantidad, DROP COLUMN duracion, DROP COLUMN dolor,
--   DROP COLUMN edad_inicio, DROP COLUMN num_parejas;
