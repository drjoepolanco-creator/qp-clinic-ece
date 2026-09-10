-- MIGRAR_gineco_paso2.sql · el que sí escribe. Correr después del paso 1.
--
-- Copia de las columnas cortas a las largas SOLO donde la larga está vacía:
-- nunca pisa un dato que la versión nueva ya haya guardado.

UPDATE public.antecedentes_gineco SET
  cantidad_sangre       = COALESCE(nullif(cantidad_sangre,''),       nullif(cantidad,'')),
  duracion_menstruacion = COALESCE(nullif(duracion_menstruacion,''), nullif(duracion,'')),
  presencia_dolor       = COALESCE(nullif(presencia_dolor,''),       nullif(dolor,'')),
  edad_inicio_sexual    = COALESCE(nullif(edad_inicio_sexual,''),    nullif(edad_inicio,'')),
  num_companeros        = COALESCE(nullif(num_companeros,''),        nullif(num_parejas,''))
 WHERE nullif(cantidad,'')    IS NOT NULL OR nullif(duracion,'')    IS NOT NULL
    OR nullif(dolor,'')       IS NOT NULL OR nullif(edad_inicio,'') IS NOT NULL
    OR nullif(num_parejas,'') IS NOT NULL;

-- Comprobación: las largas deben traer ahora lo que traían las cortas.
SELECT paciente_id, cantidad_sangre, duracion_menstruacion, presencia_dolor,
       edad_inicio_sexual, num_companeros
  FROM public.antecedentes_gineco
 WHERE nullif(cantidad,'')    IS NOT NULL OR nullif(duracion,'')    IS NOT NULL
    OR nullif(dolor,'')       IS NOT NULL OR nullif(edad_inicio,'') IS NOT NULL
    OR nullif(num_parejas,'') IS NOT NULL;

-- Solo cuando lo anterior se vea bien, y ya con la versión nueva publicada,
-- se pueden quitar las cinco columnas cortas. Esto SÍ borra:
-- ALTER TABLE public.antecedentes_gineco
--   DROP COLUMN cantidad, DROP COLUMN duracion, DROP COLUMN dolor,
--   DROP COLUMN edad_inicio, DROP COLUMN num_parejas;
