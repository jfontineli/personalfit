-- Organize each professional's exercise library without changing published prescriptions.
alter table public.exercise_library
  add column muscle_group text not null default 'OUTROS'
    check (muscle_group in ('MOBILIDADE','PEITO','COSTAS','OMBROS','BRACOS','PERNAS','POSTERIOR_GLUTEOS','PANTURRILHAS','CORE','OUTROS'));

-- Initial, editable grouping for existing generic exercise names.
update public.exercise_library set muscle_group = case
  when name ~* '(alongamento|aquecimento|mobilidade)' then 'MOBILIDADE'
  when name ~* '(supino|crucifixo inclinado|voador$)' then 'PEITO'
  when name ~* '(puxada|remada|face pull|crucifixo inverso)' then 'COSTAS'
  when name ~* '(desenvolvimento|elevação lateral)' then 'OMBROS'
  when name ~* '(rosca|tríceps)' then 'BRACOS'
  when name ~* '(panturrilha)' then 'PANTURRILHAS'
  when name ~* '(prancha)' then 'CORE'
  when name ~* '(agachamento|búlgaro|extensora|leg press)' then 'PERNAS'
  when name ~* '(flexora|stiff|pélvica|abdutora)' then 'POSTERIOR_GLUTEOS'
  else 'OUTROS' end;

create index exercise_library_tenant_group_name on public.exercise_library(tenant_id, muscle_group, name);
