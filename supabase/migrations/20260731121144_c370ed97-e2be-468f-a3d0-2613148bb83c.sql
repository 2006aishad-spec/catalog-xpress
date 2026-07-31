CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.owns_store(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.store_is_published(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND status = 'published')
$$;

CREATE POLICY "published stores visible to signed in" ON public.stores FOR SELECT TO authenticated
  USING (status = 'published');
CREATE POLICY "public categories visible to signed in" ON public.categories FOR SELECT TO authenticated
  USING (is_active AND public.store_is_published(store_id));
CREATE POLICY "public products visible to signed in" ON public.products FOR SELECT TO authenticated
  USING (is_active AND public.store_is_published(store_id));