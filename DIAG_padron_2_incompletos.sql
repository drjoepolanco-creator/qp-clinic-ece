-- DIAG_padron_2_incompletos.sql · los expedientes que salen en blanco
-- Son los que el padrón manda al principio de la lista: en PostgreSQL una
-- cadena vacía ordena ANTES que cualquier nombre, y un NULL ordena al final.
-- Por eso los registros incompletos aparecen en la página 1 y en la 23.

SELECT numero_expediente, nombre, apellido_paterno, apellido_materno,
       fecha_nacimiento, celular, sede_origen, created_at
  FROM public.pacientes
 WHERE activo
   AND (coalesce(nombre,'')='' OR coalesce(apellido_paterno,'')='')
 ORDER BY created_at NULLS LAST;
