REVOKE ALL ON FUNCTION public.enforce_product_limit() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_product_featured() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_category_limit() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_operational_email() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_plan_request() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_max_products(text) FROM anon;
REVOKE ALL ON FUNCTION public.plan_max_categories(text) FROM anon;