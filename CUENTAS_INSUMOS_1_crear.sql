-- ═══════════════════════════════════════════════════════════════════════════
-- CUENTA DE INSUMOS QUIRÚRGICOS — tablas nuevas
-- Pegar en Supabase → SQL Editor → New query → Run.
--
-- Son tablas NUEVAS: crear políticas aquí no afloja ninguna de las 34 tablas
-- que ya tienen RLS. Aun así, ANTES de correr esto conviene ver con qué
-- políticas vive `inventario_insumos`, para que estas queden iguales:
--
--   SELECT tablename, policyname, cmd, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='inventario_insumos';
--
-- El SELECT usa puede_ver_paciente(), que es la misma función que sostiene el
-- aislamiento de AMFA. Así una cuenta nunca se ve desde una unidad que no
-- alcanza a ese paciente.
--
-- `paquete` se deja como texto libre A PROPÓSITO: un CHECK que enumere los
-- cuatro paquetes de hoy es exactamente la trampa de usuarios_sede_chk, que
-- hubo que ampliar cuando nació AMFA. Los valores válidos viven en
-- PAQUETES_QX dentro de index.html.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.cuentas_insumos (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references public.pacientes(id) on delete cascade,
  episodio_id   uuid references public.episodios_quirurgicos(id) on delete set null,
  consulta_id   uuid references public.consultas(id) on delete set null,
  pago_id       uuid references public.pagos(id) on delete set null,
  sede          text not null default 'surgery',
  fecha         date not null default current_date,
  estado        text not null default 'abierta',
  paquete       text,
  procedimiento text,
  total_extra   numeric(12,2) not null default 0,
  abierta_por   text,
  cerrada_por   text,
  cerrada_en    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cuentas_insumos_estado_chk check (estado in ('abierta','cerrada'))
);

create table if not exists public.cuentas_insumos_items (
  id              uuid primary key default gen_random_uuid(),
  cuenta_id       uuid not null references public.cuentas_insumos(id) on delete cascade,
  -- OJO: inventario_insumos.id es bigint, no uuid (lo demás del proyecto sí es uuid).
  insumo_id       bigint references public.inventario_insumos(id) on delete set null,
  nombre          text not null,
  medida          text,
  cantidad        numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  precio_fuente   text not null default 'ninguno',
  momento         text not null default 'quirofano',
  registrado_por  text,
  created_at      timestamptz not null default now(),
  constraint cuentas_insumos_items_momento_chk check (momento in ('quirofano','recuperacion','habitacion')),
  constraint cuentas_insumos_items_fuente_chk  check (precio_fuente in ('publico','costo','ninguno'))
);

-- Una sola cuenta ABIERTA por paciente y día. Es lo que evita que el cirujano
-- y la enfermera de recuperación terminen anotando en cuentas distintas si
-- abren el botón al mismo tiempo.
create unique index if not exists cuentas_insumos_una_abierta_idx
  on public.cuentas_insumos (paciente_id, fecha) where estado = 'abierta';

create index if not exists cuentas_insumos_fecha_idx    on public.cuentas_insumos (fecha desc);
create index if not exists cuentas_insumos_paciente_idx on public.cuentas_insumos (paciente_id);
create index if not exists cuentas_insumos_items_cta_idx on public.cuentas_insumos_items (cuenta_id);

alter table public.cuentas_insumos       enable row level security;
alter table public.cuentas_insumos_items enable row level security;

drop policy if exists cuentas_insumos_sel on public.cuentas_insumos;
create policy cuentas_insumos_sel on public.cuentas_insumos
  for select to authenticated using (public.puede_ver_paciente(paciente_id));

drop policy if exists cuentas_insumos_ins on public.cuentas_insumos;
create policy cuentas_insumos_ins on public.cuentas_insumos
  for insert to authenticated with check (public.puede_ver_paciente(paciente_id));

drop policy if exists cuentas_insumos_upd on public.cuentas_insumos;
create policy cuentas_insumos_upd on public.cuentas_insumos
  for update to authenticated using (public.puede_ver_paciente(paciente_id))
  with check (public.puede_ver_paciente(paciente_id));

drop policy if exists cuentas_insumos_del on public.cuentas_insumos;
create policy cuentas_insumos_del on public.cuentas_insumos
  for delete to authenticated using (public.puede_ver_paciente(paciente_id));

-- Los renglones heredan el permiso de su cuenta.
drop policy if exists cuentas_insumos_items_all on public.cuentas_insumos_items;
create policy cuentas_insumos_items_all on public.cuentas_insumos_items
  for all to authenticated
  using      (exists (select 1 from public.cuentas_insumos c
                       where c.id = cuenta_id and public.puede_ver_paciente(c.paciente_id)))
  with check (exists (select 1 from public.cuentas_insumos c
                       where c.id = cuenta_id and public.puede_ver_paciente(c.paciente_id)));
