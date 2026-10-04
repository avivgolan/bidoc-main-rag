-- Read-only structural fingerprint. Excludes exactly the three NEW dashboard tables.
-- Covers existing public columns, constraints, policies, indexes, triggers and grants.
with relations as (
 select c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p','v','m')
 and c.relname not in ('dashboard_refresh_runs','dashboard_snapshots','dashboard_snapshot_items')
), objects as (
 select 'relation:'||relname as key, row_to_json(r)::text as value from relations r
 union all
 select 'column:'||r.relname||':'||a.attnum, concat_ws('|',a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid))
 from relations r join pg_attribute a on a.attrelid=r.oid left join pg_attrdef d on d.adrelid=r.oid and d.adnum=a.attnum
 where a.attnum>0 and not a.attisdropped
 union all
 select 'constraint:'||r.relname||':'||c.conname, pg_get_constraintdef(c.oid) from relations r join pg_constraint c on c.conrelid=r.oid
 union all
 select 'index:'||r.relname||':'||i.indexrelid::text, pg_get_indexdef(i.indexrelid) from relations r join pg_index i on i.indrelid=r.oid
 union all
 select 'trigger:'||r.relname||':'||t.tgname, pg_get_triggerdef(t.oid) from relations r join pg_trigger t on t.tgrelid=r.oid
 union all
 select 'policy:'||r.relname||':'||p.polname, row_to_json(p)::text from relations r join pg_policy p on p.polrelid=r.oid
 union all
 select 'view:'||r.relname, pg_get_viewdef(r.oid,true) from relations r where r.relkind in ('v','m')
)
select md5(string_agg(key||':'||value,E'\n' order by key)) as source_schema_fingerprint,
 (select count(*) from relations) as existing_relations, count(*) as structural_objects from objects;
