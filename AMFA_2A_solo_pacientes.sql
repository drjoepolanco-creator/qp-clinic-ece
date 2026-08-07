-- ═══════════════════════════════════════════════════════════════════════════
-- AMFA · PASO 2A de 4 — SOLO LA TABLA DE PACIENTES
--
-- Esta es la prueba de fuego, sobre UNA sola tabla. Si algo sale mal, el daño
-- se limita a la lista de pacientes y se revierte con dos líneas (al final).
--
-- Requiere haber corrido AMFA_1_preparar.sql. La comprobación de abajo se
-- detiene sola si no es así, sin tocar nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 2.1 · Comprobación previa. Si algo falta, se detiene sin tocar nada. ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='paciente_sedes') THEN
    RAISE EXCEPTION 'Falta la tabla paciente_sedes. Corre primero AMFA_1_preparar.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='puede_ver_paciente') THEN
    RAISE EXCEPTION 'Falta la función puede_ver_paciente(). Corre primero AMFA_1_preparar.sql';
  END IF;
  IF (SELECT count(*) FROM public.paciente_sedes) = 0 THEN
    RAISE EXCEPTION 'La tabla paciente_sedes está vacía: nadie vería pacientes. Revisa el PASO 1';
  END IF;
END $$;


-- ── 2.2 · La tabla de pacientes ────────────────────────────────────────────
DROP POLICY IF EXISTS auth_all_pacientes ON public.pacientes;
DROP POLICY IF EXISTS pacientes_sede     ON public.pacientes;

CREATE POLICY pacientes_sede ON public.pacientes
  FOR ALL TO authenticated
  USING (public.puede_ver_paciente(id))
  WITH CHECK (true);          -- dar de alta siempre se puede, el disparador asigna la unidad



-- ═══════════════════════════════════════════════════════════════════════════
-- PRUEBA AHORA, ANTES DE SEGUIR
-- ═══════════════════════════════════════════════════════════════════════════
--  1. Entrar como QP Clinic  → debe ver sus pacientes de siempre
--  2. Entrar como AMFA       → NO debe ver ninguno
--
-- Si el punto 1 falla, corre ESTO y avísame:
--   DROP POLICY IF EXISTS pacientes_sede ON public.pacientes;
--   CREATE POLICY auth_all_pacientes ON public.pacientes
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);
--
-- Si ambos puntos salen bien, sigue con AMFA_2B_resto_de_tablas.sql
