-- ═══════════════════════════════════════════════════════════════════════════
-- AMFA · PASO 3 de 3 — REVERTIR
--
-- Deja la base exactamente como estaba antes del PASO 2: todas las unidades
-- vuelven a ver todos los pacientes, con las políticas `auth_all_*` originales.
--
-- Corre este archivo COMPLETO si después de activar el aislamiento algo falla.
-- Tarda segundos. No borra datos: la tabla puente y los disparadores se quedan,
-- inofensivos, por si quieres reintentar el PASO 2 más adelante.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Restaurar la política original de pacientes ────────────────────────────
DROP POLICY IF EXISTS pacientes_sede ON public.pacientes;
DROP POLICY IF EXISTS auth_all_pacientes ON public.pacientes;
CREATE POLICY auth_all_pacientes ON public.pacientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Restaurar todas las tablas con paciente_id ─────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name  = 'paciente_id'
       AND tb.table_type  = 'BASE TABLE'
       AND c.table_name  <> 'paciente_sedes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'sede_'||t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth_all_'||t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'auth_all_'||t, t);
    RAISE NOTICE 'Restaurada %', t;
  END LOOP;
END $$;

-- ── La tabla puente vuelve a ser visible para todos ────────────────────────
DROP POLICY IF EXISTS paciente_sedes_sede ON public.paciente_sedes;
CREATE POLICY auth_all_paciente_sedes ON public.paciente_sedes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Comprobar ──────────────────────────────────────────────────────────────
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname='public' AND policyname LIKE 'auth_all_%' ORDER BY tablename;
