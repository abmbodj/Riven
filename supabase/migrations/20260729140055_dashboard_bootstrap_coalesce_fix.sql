-- The initial production application schema-qualified COALESCE in one branch.
-- COALESCE is SQL syntax rather than a pg_catalog function, so rebuild the
-- routine definition with the valid unqualified expression.
do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('public.get_dashboard_bootstrap(text)'::regprocedure)
  into v_definition;

  execute pg_catalog.replace(
    v_definition,
    'pg_catalog.coalesce(u.streak_data, '''')',
    'coalesce(u.streak_data, '''')'
  );
end;
$migration$;
;
