GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT ON public.plan_requests TO authenticated;
GRANT ALL ON public.plan_requests TO service_role;