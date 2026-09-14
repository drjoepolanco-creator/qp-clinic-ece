-- DIAG_padron.sql · diagnóstico del Padrón de pacientes
-- SQL Editor → New query → pegar → Run. Solo lee, no cambia nada.

SELECT count(*)                                                          AS filas_totales,
       count(*) FILTER (WHERE activo)                                    AS activos,
       count(*) FILTER (WHERE activo IS NOT TRUE)                        AS inactivos_o_nulos,
       count(*) FILTER (WHERE activo AND coalesce(nombre,'')='')         AS activos_sin_nombre,
       count(*) FILTER (WHERE activo AND coalesce(apellido_paterno,'')='') AS activos_sin_apellido,
       count(*) FILTER (WHERE activo AND apellido_paterno IS NULL)       AS apellido_nulo,
       count(*) FILTER (WHERE activo AND numero_expediente IS NULL)      AS sin_numero_exp
  FROM public.pacientes;
