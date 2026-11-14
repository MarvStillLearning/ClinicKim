-- Clears clinic/demo records while preserving all staff accounts.
-- This permanently deletes the listed data and resets their generated IDs.
-- It does not delete auth.users or public.profiles.

begin;

truncate table
  public.sale_items,
  public.sales,
  public.audit_logs,
  public.appointments,
  public.records,
  public.doctor_schedule_dates,
  public.products,
  public.patients
restart identity;

commit;
