-- ═══════════════════════════════════════════════════════════════════════════
-- amfa Nutrición Especializada — columnas de sede y aislamiento de pacientes
-- Ejecutar en Supabase → SQL Editor, EN ORDEN, leyendo los avisos.
-- Proyecto: ebukjdxeekhzeurmhgkj
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- PASO 1 · Columnas nuevas.  Sin riesgo: no toca datos existentes.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS sede_origen text;

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS sede text;

-- Todo lo que ya existe se considera de QP Clinic, que es donde se capturó.
UPDATE public.pacientes SET sede_origen = 'clinic' WHERE sede_origen IS NULL;
UPDATE public.consultas SET sede = 'clinic' WHERE sede IS NULL;

-- Índices para que el filtrado no se vuelva lento
CREATE INDEX IF NOT EXISTS idx_pacientes_sede_origen ON public.pacientes (sede_origen);
CREATE INDEX IF NOT EXISTS idx_consultas_sede         ON public.consultas (sede);
CREATE INDEX IF NOT EXISTS idx_consultas_sede_pac     ON public.consultas (sede, paciente_id);


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 2 · Dar de alta a los usuarios de amfa.
-- Créalos primero desde el sistema (Configuración → Gestión de médicos) con
-- cualquier sede, y después córrele aquí el UPDATE con sus correos reales.
-- ───────────────────────────────────────────────────────────────────────────

-- UPDATE public.usuarios SET sede = 'amfa'
--  WHERE email IN ('nutriologa@amfa.mx', 'recepcion@amfa.mx');

-- Para revisar cómo quedaron:
-- SELECT id, nombre, apellido_paterno, email, rol, sede FROM public.usuarios ORDER BY sede, nombre;


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 3 · Seguridad real (Row Level Security)
--
-- ⚠️  LEE ESTO ANTES DE EJECUTARLO.
--
-- Sin RLS, el filtrado que hice en la interfaz es solo cosmético: la llave
-- pública de Supabase viaja dentro del index.html y cualquiera que la extraiga
-- del navegador puede consultar la tabla completa. Para datos clínicos eso es
-- un problema de protección de datos, no un detalle técnico.
--
-- PERO activar RLS es un cambio con dientes: en el momento en que se activa,
-- TODO queda bloqueado salvo lo que las políticas permitan explícitamente.
-- Si algo queda mal escrito, el sistema deja de ver pacientes para todos.
--
-- Recomendación: ejecútalo en un momento sin consulta, y ten a la mano el
-- PASO 4 (revertir), que deja todo como estaba en un segundo.
-- ───────────────────────────────────────────────────────────────────────────

-- Función auxiliar: la sede del usuario que está haciendo la petición.
CREATE OR REPLACE FUNCTION public.sede_del_usuario()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.sede FROM public.usuarios u WHERE u.id = auth.uid()), 'clinic');
$$;

-- ── pacientes ──────────────────────────────────────────────────────────────
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pacientes_lectura ON public.pacientes;
CREATE POLICY pacientes_lectura ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    -- QP Clinic y QP Surgery ven el padrón completo, incluido el de amfa.
    public.sede_del_usuario() <> 'amfa'
    -- amfa solo ve a quien registró ella o a quien ya atendió.
    OR sede_origen = 'amfa'
    OR EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.paciente_id = pacientes.id AND c.sede = 'amfa'
    )
  );

DROP POLICY IF EXISTS pacientes_escritura ON public.pacientes;
CREATE POLICY pacientes_escritura ON public.pacientes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS pacientes_update ON public.pacientes;
CREATE POLICY pacientes_update ON public.pacientes
  FOR UPDATE TO authenticated
  USING (
    public.sede_del_usuario() <> 'amfa'
    OR sede_origen = 'amfa'
    OR EXISTS (
      SELECT 1 FROM public.consultas c
      WHERE c.paciente_id = pacientes.id AND c.sede = 'amfa'
    )
  );

-- ── consultas ──────────────────────────────────────────────────────────────
-- Mismo criterio: amfa solo alcanza las notas de los pacientes que puede ver.
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consultas_lectura ON public.consultas;
CREATE POLICY consultas_lectura ON public.consultas
  FOR SELECT TO authenticated
  USING (
    public.sede_del_usuario() <> 'amfa'
    OR sede = 'amfa'
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = consultas.paciente_id AND p.sede_origen = 'amfa'
    )
  );

DROP POLICY IF EXISTS consultas_escritura ON public.consultas;
CREATE POLICY consultas_escritura ON public.consultas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS consultas_update ON public.consultas;
CREATE POLICY consultas_update ON public.consultas
  FOR UPDATE TO authenticated USING (true);


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 4 · Revertir, si algo sale mal.  Deja todo como estaba antes del PASO 3.
-- ───────────────────────────────────────────────────────────────────────────

-- ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.consultas DISABLE ROW LEVEL SECURITY;


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 5 · Comprobar que quedó bien
-- ───────────────────────────────────────────────────────────────────────────

-- Cuántos pacientes tiene cada unidad:
-- SELECT sede_origen, count(*) FROM public.pacientes GROUP BY sede_origen;

-- Cuántas consultas por unidad:
-- SELECT sede, count(*) FROM public.consultas GROUP BY sede;

-- Qué políticas quedaron activas:
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename IN ('pacientes','consultas');
