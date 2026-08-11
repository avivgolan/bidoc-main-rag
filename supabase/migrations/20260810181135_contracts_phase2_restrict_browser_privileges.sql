-- BIDoc Contracts Agent Phase 2 follow-up least-privilege migration.
-- KAPAIM's legacy default grants included schema/mutation privileges beyond
-- INSERT, UPDATE, and DELETE on the existing Schedule contract target tables.

revoke insert, update, delete, truncate, references, trigger on table
  public.schedule_contract_milestones,
  public.schedule_contract_extensions,
  public.schedule_contract_conditions
from anon, authenticated;

notify pgrst, 'reload schema';
