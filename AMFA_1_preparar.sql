-- ═══════════════════════════════════════════════════════════════════════════
-- AMFA · PASO 1 de 3 — PREPARACIÓN
--
-- Este archivo SOLO AGREGA cosas. No modifica ni una política, no activa nada,
-- no puede dejar a nadie sin ver pacientes. Es seguro correrlo en horario hábil.
--
-- Crea la tabla puente `paciente_sedes`, que dice qué unidades pueden ver a
-- cada paciente, y los disparadores que la mantienen al día solos:
--   · al dar de alta un paciente        → su unidad de registro
--   · al guardar una consulta           → la unidad que la otorgó
--   · al crear una interconsulta        → la unidad del médico que la recibe
--
-- Después de correrlo, VERIFICA con las consultas del final y avísame el
-- resultado antes de pasar al PASO 2.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1.1 · Columnas de sede (por si no existieran ya) ───────────────────────
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS sede_origen text;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS sede        text;


-- ── 1.2 · Tabla puente ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paciente_sedes (
  paciente_id uuid        NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  sede        text        NOT NULL,
  origen      text,                      -- registro | consulta | interconsulta | manual
  creado_en   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (paciente_id, sede)
);

CREATE INDEX IF NOT EXISTS idx_pac_sedes_sede ON public.paciente_sedes (sede);
CREATE INDEX IF NOT EXISTS idx_pac_sedes_pac  ON public.paciente_sedes (paciente_id);


-- ── 1.3 · Carga inicial ────────────────────────────────────────────────────
-- Todo lo que existe hoy pertenece a QP Clinic y QP Surgery, que es como se ha
-- venido trabajando. AMFA arranca sin ningún paciente: expediente en blanco.

INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
SELECT p.id, 'clinic', 'carga inicial' FROM public.pacientes p
ON CONFLICT DO NOTHING;

INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
SELECT p.id, 'surgery', 'carga inicial' FROM public.pacientes p
ON CONFLICT DO NOTHING;

-- Si alguna consulta ya quedó marcada como de AMFA, se respeta.
INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
SELECT DISTINCT c.paciente_id, 'amfa', 'consulta previa'
  FROM public.consultas c
 WHERE c.sede = 'amfa' AND c.paciente_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ── 1.4 · Función auxiliar: la sede del usuario que hace la petición ───────
CREATE OR REPLACE FUNCTION public.sede_del_usuario()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT u.sede FROM public.usuarios u WHERE u.id = auth.uid()), 'clinic');
$$;

-- ¿La unidad del usuario actual alcanza a este paciente?
-- Un usuario con sede 'ambas' ve todo salvo lo exclusivo de AMFA.
CREATE OR REPLACE FUNCTION public.puede_ver_paciente(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN pid IS NULL THEN true
    WHEN public.sede_del_usuario() = 'ambas' THEN
      EXISTS (SELECT 1 FROM public.paciente_sedes ps
               WHERE ps.paciente_id = pid AND ps.sede IN ('clinic','surgery'))
    ELSE
      EXISTS (SELECT 1 FROM public.paciente_sedes ps
               WHERE ps.paciente_id = pid AND ps.sede = public.sede_del_usuario())
  END;
$$;


-- ── 1.5 · Disparadores que mantienen la tabla puente ───────────────────────

-- (a) Alta de paciente → su unidad de registro
CREATE OR REPLACE FUNCTION public.trg_pac_sede_alta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
  VALUES (NEW.id, COALESCE(NEW.sede_origen, public.sede_del_usuario()), 'registro')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pac_sede_alta ON public.pacientes;
CREATE TRIGGER pac_sede_alta AFTER INSERT ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_pac_sede_alta();

-- (b) Consulta guardada → la unidad que la otorgó
CREATE OR REPLACE FUNCTION public.trg_pac_sede_consulta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.paciente_id IS NOT NULL THEN
    INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
    VALUES (NEW.paciente_id, COALESCE(NEW.sede, public.sede_del_usuario()), 'consulta')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pac_sede_consulta ON public.consultas;
CREATE TRIGGER pac_sede_consulta AFTER INSERT ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION public.trg_pac_sede_consulta();

-- (c) Interconsulta → EL PUENTE. Comparte el paciente con la unidad del médico
--     que la recibe y con la del que la solicita.
CREATE OR REPLACE FUNCTION public.trg_pac_sede_interconsulta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  IF NEW.paciente_id IS NULL THEN RETURN NEW; END IF;

  SELECT u.sede INTO s FROM public.usuarios u WHERE u.id = NEW.medico_interconsultante_id;
  IF s IS NOT NULL THEN
    INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
    VALUES (NEW.paciente_id, s, 'interconsulta') ON CONFLICT DO NOTHING;
  END IF;

  SELECT u.sede INTO s FROM public.usuarios u WHERE u.id = NEW.medico_solicitante_id;
  IF s IS NOT NULL AND s <> 'ambas' THEN
    INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
    VALUES (NEW.paciente_id, s, 'interconsulta') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pac_sede_ic_alta ON public.interconsultas;
CREATE TRIGGER pac_sede_ic_alta AFTER INSERT ON public.interconsultas
  FOR EACH ROW EXECUTE FUNCTION public.trg_pac_sede_interconsulta();

-- El médico destinatario se asigna en un UPDATE posterior, no al insertar.
DROP TRIGGER IF EXISTS pac_sede_ic_upd ON public.interconsultas;
CREATE TRIGGER pac_sede_ic_upd AFTER UPDATE OF medico_interconsultante_id ON public.interconsultas
  FOR EACH ROW EXECUTE FUNCTION public.trg_pac_sede_interconsulta();


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN · corre esto y mándame el resultado antes del PASO 2
-- ═══════════════════════════════════════════════════════════════════════════

-- ¿Cuántos pacientes ve cada unidad?  (amfa debe salir en 0 o muy pocos)
SELECT sede, count(*) AS pacientes
  FROM public.paciente_sedes GROUP BY sede ORDER BY sede;

-- ¿Quedó algún paciente sin unidad?  (debe dar 0)
-- SELECT count(*) AS huerfanos FROM public.pacientes p
--  WHERE NOT EXISTS (SELECT 1 FROM public.paciente_sedes ps WHERE ps.paciente_id = p.id);

-- ¿Qué usuarios hay y con qué sede?
-- SELECT nombre, apellidos, email, rol, sede FROM public.usuarios ORDER BY sede, apellidos;
