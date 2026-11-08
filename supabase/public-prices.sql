-- Allow unauthenticated visitors to read Medicine and Service prices.
alter table public.products enable row level security;

drop policy if exists "public medicine and service prices" on public.products;
create policy "public medicine and service prices"
  on public.products
  for select
  to anon
  using (false);

drop view if exists public.public_product_prices;
create view public.public_product_prices
with (security_invoker = false) as
select id, name, category, price
from public.products
where category in ('Medicine', 'Service');

grant select on public.public_product_prices to anon;
notify pgrst, 'reload schema';
