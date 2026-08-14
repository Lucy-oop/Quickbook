UPDATE public.tenants
   SET trial_ends_at = NOW() - INTERVAL '31 days'
 WHERE name = 'Martin Clothing';