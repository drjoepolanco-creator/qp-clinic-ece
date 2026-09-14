-- DIAG_expedientes.sql · por qué la numeración va en 471 con 445 pacientes
-- SQL Editor → New query → pegar → Run. Solo lee, no cambia nada.
--
-- `numero_expediente` NO lo escribe la aplicación: revisé todos los insert y
-- update del index.html y la columna no aparece en ninguno. La asigna la base
-- con un valor por omisión (una secuencia). Una secuencia de PostgreSQL nunca
-- reutiliza un número: lo consume aunque el alta falle o el paciente se
-- desactive después. De ahí los huecos.

SELECT (SELECT column_default FROM information_schema.columns
         WHERE table_schema='public' AND table_name='pacientes'
           AND column_name='numero_expediente')                       AS como_se_asigna,
       (SELECT max(numero_expediente) FROM public.pacientes)          AS numero_mas_alto,
       (SELECT count(*) FROM public.pacientes)                        AS filas_en_la_tabla,
       (SELECT count(*) FROM public.pacientes WHERE activo)           AS activos,
       (SELECT count(*) FROM public.pacientes WHERE activo IS NOT TRUE) AS inactivos,
       (SELECT count(DISTINCT numero_expediente) FROM public.pacientes) AS numeros_distintos,
       (SELECT count(*) FROM public.pacientes WHERE numero_expediente IS NULL) AS sin_numero;
