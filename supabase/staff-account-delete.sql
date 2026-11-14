-- Keep historic sales and audit records when a staff auth account is deleted.
-- The account ID is cleared; the original transaction and audit row remain.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
      and a.attnum = any(c.conkey)
    where c.conrelid = 'public.sales'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.contype = 'f'
      and a.attname = 'cashier_id'
  loop
    execute format('alter table public.sales drop constraint %I', constraint_name);
  end loop;

  alter table public.sales
    add constraint sales_cashier_id_fkey
    foreign key (cashier_id) references auth.users(id) on delete set null;

  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
      and a.attnum = any(c.conkey)
    where c.conrelid = 'public.audit_logs'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.contype = 'f'
      and a.attname = 'actor_id'
  loop
    execute format('alter table public.audit_logs drop constraint %I', constraint_name);
  end loop;

  alter table public.audit_logs
    add constraint audit_logs_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;
end;
$$;
