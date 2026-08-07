-- ═══════════════════════════════════════════════════════════════════════════
-- ECE QP Clinic · Row Level Security — política mínima y segura
-- 
-- Qué hace: cierra las tablas clínicas a quien no tenga sesión iniciada.
-- Hoy, sin esto, la llave pública que viaja en el index.html permite consultar
-- el padrón completo de pacientes sin siquiera entrar al sistema.
--
-- Por qué es seguro: las políticas NO mencionan ninguna columna. El intento
-- anterior falló justamente por referirse a columnas inexistentes.
--
-- QUEDAN FUERA a propósito, porque el sistema las necesita SIN sesión:
--   · usuarios       → el login traduce usuario→correo antes de autenticar
--   · pre_registros  → los pacientes llenan su pre-registro desde un enlace
-- Ambas se resuelven después con funciones RPC. Ver notas al final.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── PASO 0 · Fotografía previa. Ejecuta SOLO esto primero y guarda el resultado.
--    Te sirve para comparar si algo sale mal.

-- SELECT tablename, rowsecurity AS rls_activo
--   FROM pg_tables WHERE schemaname='public' ORDER BY tablename;


-- ── PASO 1 · Activar. Ejecuta TODO este bloque de una sola vez.
--    Son 32 tablas. Tarda un par de segundos.

ALTER TABLE public.alergias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alergias_sesion" ON public.alergias;
CREATE POLICY "alergias_sesion" ON public.alergias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anexos_sesion" ON public.anexos;
CREATE POLICY "anexos_sesion" ON public.anexos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.anotaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anotaciones_sesion" ON public.anotaciones;
CREATE POLICY "anotaciones_sesion" ON public.anotaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.antecedentes_familiares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "antecedentes_familiares_sesion" ON public.antecedentes_familiares;
CREATE POLICY "antecedentes_familiares_sesion" ON public.antecedentes_familiares
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.antecedentes_gineco ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "antecedentes_gineco_sesion" ON public.antecedentes_gineco;
CREATE POLICY "antecedentes_gineco_sesion" ON public.antecedentes_gineco
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.antecedentes_no_patologicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "antecedentes_no_patologicos_sesion" ON public.antecedentes_no_patologicos;
CREATE POLICY "antecedentes_no_patologicos_sesion" ON public.antecedentes_no_patologicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.antecedentes_patologicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "antecedentes_patologicos_sesion" ON public.antecedentes_patologicos;
CREATE POLICY "antecedentes_patologicos_sesion" ON public.antecedentes_patologicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.bitacora_accesos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bitacora_accesos_sesion" ON public.bitacora_accesos;
CREATE POLICY "bitacora_accesos_sesion" ON public.bitacora_accesos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.checklist_oms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklist_oms_sesion" ON public.checklist_oms;
CREATE POLICY "checklist_oms_sesion" ON public.checklist_oms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consultas_sesion" ON public.consultas;
CREATE POLICY "consultas_sesion" ON public.consultas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.consultas_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consultas_historial_sesion" ON public.consultas_historial;
CREATE POLICY "consultas_historial_sesion" ON public.consultas_historial
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.discapacidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discapacidades_sesion" ON public.discapacidades;
CREATE POLICY "discapacidades_sesion" ON public.discapacidades
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.episodios_quirurgicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "episodios_quirurgicos_sesion" ON public.episodios_quirurgicos;
CREATE POLICY "episodios_quirurgicos_sesion" ON public.episodios_quirurgicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.fisioterapia_prescripciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fisioterapia_prescripciones_sesion" ON public.fisioterapia_prescripciones;
CREATE POLICY "fisioterapia_prescripciones_sesion" ON public.fisioterapia_prescripciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.imagenes_expediente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "imagenes_expediente_sesion" ON public.imagenes_expediente;
CREATE POLICY "imagenes_expediente_sesion" ON public.imagenes_expediente
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.inbody_resultados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inbody_resultados_sesion" ON public.inbody_resultados;
CREATE POLICY "inbody_resultados_sesion" ON public.inbody_resultados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.indicaciones_medicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "indicaciones_medicas_sesion" ON public.indicaciones_medicas;
CREATE POLICY "indicaciones_medicas_sesion" ON public.indicaciones_medicas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.interconsultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interconsultas_sesion" ON public.interconsultas;
CREATE POLICY "interconsultas_sesion" ON public.interconsultas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.interrogatorio_aparatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interrogatorio_aparatos_sesion" ON public.interrogatorio_aparatos;
CREATE POLICY "interrogatorio_aparatos_sesion" ON public.interrogatorio_aparatos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.inventario_insumos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventario_insumos_sesion" ON public.inventario_insumos;
CREATE POLICY "inventario_insumos_sesion" ON public.inventario_insumos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventario_movimientos_sesion" ON public.inventario_movimientos;
CREATE POLICY "inventario_movimientos_sesion" ON public.inventario_movimientos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.medicamentos_usados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medicamentos_usados_sesion" ON public.medicamentos_usados;
CREATE POLICY "medicamentos_usados_sesion" ON public.medicamentos_usados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.notas_enfermeria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notas_enfermeria_sesion" ON public.notas_enfermeria;
CREATE POLICY "notas_enfermeria_sesion" ON public.notas_enfermeria
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pacientes_sesion" ON public.pacientes;
CREATE POLICY "pacientes_sesion" ON public.pacientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagos_sesion" ON public.pagos;
CREATE POLICY "pagos_sesion" ON public.pagos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.registro_anestesico_farmacos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "registro_anestesico_farmacos_sesion" ON public.registro_anestesico_farmacos;
CREATE POLICY "registro_anestesico_farmacos_sesion" ON public.registro_anestesico_farmacos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.registro_anestesico_signos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "registro_anestesico_signos_sesion" ON public.registro_anestesico_signos;
CREATE POLICY "registro_anestesico_signos_sesion" ON public.registro_anestesico_signos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.resultados_herramientas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resultados_herramientas_sesion" ON public.resultados_herramientas;
CREATE POLICY "resultados_herramientas_sesion" ON public.resultados_herramientas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.resultados_laboratorio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resultados_laboratorio_sesion" ON public.resultados_laboratorio;
CREATE POLICY "resultados_laboratorio_sesion" ON public.resultados_laboratorio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salas_sesion" ON public.salas;
CREATE POLICY "salas_sesion" ON public.salas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.signos_vitales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signos_vitales_sesion" ON public.signos_vitales;
CREATE POLICY "signos_vitales_sesion" ON public.signos_vitales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.vacunas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vacunas_sesion" ON public.vacunas;
CREATE POLICY "vacunas_sesion" ON public.vacunas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ── PASO 2 · Comprobar. Debe listar las mismas tablas con rls_activo = true.

-- SELECT tablename, rowsecurity AS rls_activo
--   FROM pg_tables WHERE schemaname='public' ORDER BY rowsecurity DESC, tablename;

-- Y estas dos deben seguir en false, es lo esperado:
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE schemaname='public' AND tablename IN ('usuarios','pre_registros');


-- ── PASO 3 · Probar EN ESTE ORDEN antes de dar por bueno el cambio:
--    1. Cerrar sesión y volver a entrar          → debe funcionar
--    2. Buscar un paciente y abrir su expediente → debe funcionar
--    3. Guardar una nota de consulta             → debe funcionar
--    4. Abrir la agenda                          → debe funcionar
--    5. Enviar un pre-registro y llenarlo        → debe funcionar


-- ── PASO 4 · Revertir si algo falla. Deja todo como antes, al instante.

-- ALTER TABLE public.alergias DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.anexos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.anotaciones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.antecedentes_familiares DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.antecedentes_gineco DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.antecedentes_no_patologicos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.antecedentes_patologicos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bitacora_accesos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.checklist_oms DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.consultas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.consultas_historial DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.discapacidades DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.episodios_quirurgicos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.fisioterapia_prescripciones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.imagenes_expediente DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.inbody_resultados DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.indicaciones_medicas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.interconsultas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.interrogatorio_aparatos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.inventario_insumos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.inventario_movimientos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.medicamentos_usados DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.notas_enfermeria DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.registro_anestesico_farmacos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.registro_anestesico_signos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.resultados_herramientas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.resultados_laboratorio DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.salas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.signos_vitales DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.vacunas DISABLE ROW LEVEL SECURITY;


-- ── PENDIENTE para la certificación NOM-024 ────────────────────────────────
-- 1. usuarios: mover la traducción usuario→correo a una función RPC con
--    SECURITY DEFINER que solo devuelva el correo, y cerrar la tabla.
-- 2. pre_registros: función RPC que reciba el token y devuelva únicamente
--    ese renglón, en vez de exponer la tabla.
-- 3. Bitácora de accesos inalterable (NOM-024 pide trazabilidad de consultas,
--    no solo de escrituras).
-- 4. Política de retención y respaldos verificables.
