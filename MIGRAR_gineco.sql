-- MIGRAR_gineco.sql · 10 de septiembre de 2026
-- CORRER **DESPUÉS** DE PUBLICAR, no antes.
--
-- Qué pasó: la versión que está en línea hoy escribe los nombres cortos
-- (cantidad, duracion, dolor, edad_inicio, num_parejas). Mientras esas columnas
-- no existían, guardar gineco fallaba; en cuanto ALTER_gineco.sql las creó,
-- los guardados empezaron a caer ahí. Por eso la comprobación salió en 1 y no
-- en 0: hay al menos un expediente con datos en las columnas cortas.
--
-- La versión nueva escribe los nombres largos, que son los originales de la
-- tabla. Este archivo mueve lo que quedó en las cortas a las largas.
-- Se corre DESPUÉS de publicar para que no queden guardados a medio camino.

-- 1 · Ver qué hay antes de tocar nada.
SELECT paciente_id,
       cantidad    AS c_corta, cantidad_sangre       AS c_larga,
       duracion    AS d_corta, duracion_menstruacion AS d_larga,
       dolor       AS p_corta, presencia_dolor       AS p_larga,
       edad_inicio AS e_corta, edad_inicio_sexual    AS e_larga,
       num_parejas AS n_corta, num_companeros        AS n_larga
  FROM public.antecedentes_gineco
 WHERE nullif(cantidad,'')    IS NOT NULL OR nullif(duracion,'')    IS NOT NULL
    OR nullif(dolor,'')       IS NOT NULL OR nullif(edad_inicio,'') IS NOT NULL
    OR nullif(num_parejas,'') IS NOT NULL;
