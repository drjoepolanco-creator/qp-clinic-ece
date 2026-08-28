-- Comprobación posterior. El editor de Supabase solo muestra el resultado de
-- la ÚLTIMA consulta pegada, así que correr UNA a la vez.

-- 1) ¿Existen las tablas y tienen RLS encendido?
select tablename, rowsecurity from pg_tables
 where schemaname='public' and tablename in ('cuentas_insumos','cuentas_insumos_items');

-- 2) ¿Qué políticas quedaron?
-- select tablename, policyname, cmd, qual from pg_policies
--  where schemaname='public' and tablename in ('cuentas_insumos','cuentas_insumos_items');

-- 3) Insumos de QP Surgery SIN costo capturado: son los que no se podrán
--    cobrar aunque se usen de más. Conviene revisarla antes de estrenar.
-- select categoria, nombre, presentacion
--   from public.inventario_insumos
--  where sede='surgery' and activo
--    and coalesce(precio_publico,0)=0 and coalesce(costo_unitario,0)=0
--  order by categoria, nombre;
