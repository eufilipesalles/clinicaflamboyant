-- Área do Paciente — Clínica Flamboyant
-- Pacientes entram com CPF + senha individual. Vídeos ficam em bucket privado
-- e só são entregues por link assinado de curta duração.

-- ───────────────────────── Tabelas ─────────────────────────

create table public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now()
);

create table public.procedimentos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  descricao text,
  criado_em timestamptz not null default now()
);

create table public.videos (
  id              uuid primary key default gen_random_uuid(),
  procedimento_id uuid not null references public.procedimentos (id) on delete cascade,
  fase            text not null check (fase in ('pre', 'trans', 'pos')),
  titulo          text not null,
  descricao       text,
  storage_path    text not null unique,
  ordem           integer not null default 0,
  criado_em       timestamptz not null default now()
);
create index videos_procedimento_idx on public.videos (procedimento_id, fase, ordem);

create table public.pacientes (
  id                   uuid primary key references auth.users (id) on delete cascade,
  nome                 text not null,
  cpf                  text not null unique check (cpf ~ '^[0-9]{11}$'),
  telefone             text,
  ativo                boolean not null default true,
  precisa_trocar_senha boolean not null default true,
  termos_aceitos_em    timestamptz,
  ultimo_acesso_em     timestamptz,
  criado_em            timestamptz not null default now(),
  criado_por           uuid references auth.users (id) on delete set null
);

create table public.paciente_procedimentos (
  paciente_id     uuid not null references public.pacientes (id) on delete cascade,
  procedimento_id uuid not null references public.procedimentos (id) on delete cascade,
  data_cirurgia   date,
  medico          text,
  criado_em       timestamptz not null default now(),
  primary key (paciente_id, procedimento_id)
);
create index paciente_procedimentos_proc_idx on public.paciente_procedimentos (procedimento_id);

create table public.visualizacoes (
  paciente_id  uuid not null references public.pacientes (id) on delete cascade,
  video_id     uuid not null references public.videos (id) on delete cascade,
  assistido_em timestamptz not null default now(),
  primary key (paciente_id, video_id)
);
create index visualizacoes_video_idx on public.visualizacoes (video_id);

-- ───────────────────────── Funções auxiliares ─────────────────────────

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function public.paciente_ativo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.pacientes p where p.id = (select auth.uid()) and p.ativo);
$$;

-- O paciente tem acesso ao procedimento?
create or replace function public.tem_procedimento(proc uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.paciente_procedimentos pp
    join public.pacientes p on p.id = pp.paciente_id
    where pp.paciente_id = (select auth.uid())
      and pp.procedimento_id = proc
      and p.ativo
  );
$$;

-- O paciente pode assistir ao vídeo guardado neste caminho do storage?
create or replace function public.pode_ver_video(caminho text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.storage_path = caminho
      and public.tem_procedimento(v.procedimento_id)
  );
$$;

-- Ações que o próprio paciente pode fazer no seu cadastro
create or replace function public.marcar_senha_trocada()
returns void
language sql security definer set search_path = ''
as $$
  update public.pacientes set precisa_trocar_senha = false where id = (select auth.uid()) and ativo;
$$;

create or replace function public.aceitar_termos()
returns void
language sql security definer set search_path = ''
as $$
  update public.pacientes set termos_aceitos_em = now() where id = (select auth.uid()) and ativo;
$$;

create or replace function public.registrar_acesso()
returns void
language sql security definer set search_path = ''
as $$
  update public.pacientes set ultimo_acesso_em = now() where id = (select auth.uid()) and ativo;
$$;

revoke execute on function public.marcar_senha_trocada(), public.aceitar_termos(), public.registrar_acesso() from public, anon;
grant execute on function public.marcar_senha_trocada(), public.aceitar_termos(), public.registrar_acesso() to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.admins                 enable row level security;
alter table public.procedimentos          enable row level security;
alter table public.videos                 enable row level security;
alter table public.pacientes              enable row level security;
alter table public.paciente_procedimentos enable row level security;
alter table public.visualizacoes          enable row level security;

-- admins: cada admin vê o próprio registro (para o painel saber que é admin)
create policy admins_select on public.admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- procedimentos
create policy procedimentos_admin on public.procedimentos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy procedimentos_paciente on public.procedimentos for select to authenticated
  using (public.tem_procedimento(id));

-- videos
create policy videos_admin on public.videos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy videos_paciente on public.videos for select to authenticated
  using (public.tem_procedimento(procedimento_id));

-- pacientes (criação e alteração de status/senha só pela função admin-pacientes)
create policy pacientes_admin_select on public.pacientes for select to authenticated
  using ((select public.is_admin()));
create policy pacientes_admin_update on public.pacientes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy pacientes_proprio on public.pacientes for select to authenticated
  using (id = (select auth.uid()));

-- vínculo paciente ↔ procedimento
create policy pp_admin on public.paciente_procedimentos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy pp_paciente on public.paciente_procedimentos for select to authenticated
  using (paciente_id = (select auth.uid()) and (select public.paciente_ativo()));

-- visualizações
create policy vis_admin on public.visualizacoes for select to authenticated
  using ((select public.is_admin()));
create policy vis_paciente_select on public.visualizacoes for select to authenticated
  using (paciente_id = (select auth.uid()));
create policy vis_paciente_insert on public.visualizacoes for insert to authenticated
  with check (
    paciente_id = (select auth.uid())
    and exists (select 1 from public.videos v where v.id = video_id and public.tem_procedimento(v.procedimento_id))
  );

-- ───────────────────────── Storage (vídeos privados) ─────────────────────────

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('videos-pacientes', 'videos-pacientes', false, array['video/mp4'])
on conflict (id) do nothing;

create policy videos_storage_admin on storage.objects for all to authenticated
  using (bucket_id = 'videos-pacientes' and (select public.is_admin()))
  with check (bucket_id = 'videos-pacientes' and (select public.is_admin()));

-- Paciente só consegue gerar link assinado dos vídeos dos seus procedimentos
create policy videos_storage_paciente on storage.objects for select to authenticated
  using (bucket_id = 'videos-pacientes' and public.pode_ver_video(name));
