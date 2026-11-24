-- Move as funções de checagem de acesso para um schema fora da API pública.
-- As políticas de RLS continuam apontando para elas (referência por OID).
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

alter function public.is_admin() set schema privado;
alter function public.paciente_ativo() set schema privado;
alter function public.tem_procedimento(uuid) set schema privado;
alter function public.pode_ver_video(text) set schema privado;

create or replace function privado.pode_ver_video(caminho text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.storage_path = caminho
      and privado.tem_procedimento(v.procedimento_id)
  );
$$;

revoke execute on function privado.is_admin(), privado.paciente_ativo(), privado.tem_procedimento(uuid), privado.pode_ver_video(text) from public, anon;
grant execute on function privado.is_admin(), privado.paciente_ativo(), privado.tem_procedimento(uuid), privado.pode_ver_video(text) to authenticated;
