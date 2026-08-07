-- ═══════════════════════════════════════════════════════════════════════════
-- AMFA · PASO 2B de 4 — EL RESTO DE LAS TABLAS CLÍNICAS
--
-- Corre esto SOLO si el paso 2A funcionó y lo comprobaste en la aplicación.
--
-- Sin este paso el aislamiento está incompleto: AMFA no vería el renglón del
-- paciente, pero sí podría alcanzar sus consultas, antecedentes y anexos.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='pacientes'
                    AND policyname='pacientes_sede') THEN
    RAISE EXCEPTION 'Falta el paso 2A. Corre primero AMFA_2A_solo_pacientes.sql';
  END IF;
END $$;

-- ── 2.3 · Todas las tablas colgadas de un paciente ─────────────────────────
-- Se recorren solas: cualquier tabla con columna `paciente_id` queda cubierta,
-- incluidas las que se agreguen en el futuro si se vuelve a correr esto.
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth_all_'||t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'sede_'||t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (public.puede_ver_paciente(paciente_id)) '
      'WITH CHECK (public.puede_ver_paciente(paciente_id))',
      'sede_'||t, t);
    RAISE NOTICE 'Política aplicada a %', t;
  END LOOP;
END $$;


-- ── 2.4 · La tabla puente: solo se leen las filas de la propia unidad ──────
ALTER TABLE public.paciente_sedes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS paciente_sedes_sede ON public.paciente_sedes;
CREATE POLICY paciente_sedes_sede ON public.paciente_sedes
  FOR ALL TO authenticated
  USING (sede = public.sede_del_usuario() OR public.sede_del_usuario() = 'ambas')
  WITH CHECK (true);



-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname='public' AND policyname LIKE 'sede_%' ORDER BY tablename;

-- PRUEBAS EN LA APLICACIÓN, en este orden:
--  1. QP Clinic: abrir un expediente y guardar una nota   → funciona
--  2. AMFA: dar de alta un paciente                        → aparece solo ahí
--  3. QP Clinic: buscar ese paciente                       → NO aparece
--  4. Enviar interconsulta de QP a AMFA                    → aparece en AMFA
--
-- Si algo falla: AMFA_3_revertir.sql
