-- DIAG_expedientes_2_huecos.sql · qué números se saltó y quién los tenía
-- Correr después del primero.

-- 1 · Los números que no existen en la tabla, del 1 al más alto.
SELECT string_agg(n::text, ', ' ORDER BY n) AS numeros_ausentes, count(*) AS cuantos
  FROM generate_series(1, (SELECT max(numero_expediente) FROM public.pacientes)) AS n
 WHERE NOT EXISTS (SELECT 1 FROM public.pacientes p WHERE p.numero_expediente = n);

-- 2 · Los que sí existen pero están desactivados: por eso no salen en el padrón.
SELECT numero_expediente, nombre, apellido_paterno, apellido_materno,
       activo, notas_admin, created_at
  FROM public.pacientes
 WHERE activo IS NOT TRUE
 ORDER BY numero_expediente;
