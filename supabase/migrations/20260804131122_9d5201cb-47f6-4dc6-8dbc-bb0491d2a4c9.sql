-- 1. PERFIS DE LOJISTA (nome + telemóvel como identificador principal)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  phone_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile readable" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. PEDIDOS DE PLANO (pagamento manual por WhatsApp)
CREATE TABLE IF NOT EXISTS public.plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.plan_requests TO authenticated;
GRANT ALL ON public.plan_requests TO service_role;
ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own plan requests" ON public.plan_requests
  FOR SELECT TO authenticated USING (public.owns_store(store_id));
CREATE POLICY "owners create own plan requests" ON public.plan_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_store(store_id) AND user_id = auth.uid() AND status = 'pending');
CREATE POLICY "admins read all plan requests" ON public.plan_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER plan_requests_updated_at BEFORE UPDATE ON public.plan_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_plan_request()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.plan_code NOT IN ('basic','pro') THEN
    RAISE EXCEPTION 'Plano inválido para pedido de pagamento: %', NEW.plan_code;
  END IF;
  IF NEW.status NOT IN ('pending','under_review','active','rejected') THEN
    RAISE EXCEPTION 'Estado de pagamento inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER plan_requests_validate BEFORE INSERT OR UPDATE ON public.plan_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_plan_request();

-- 3. LIMITES DE PLANO APLICADOS NA BASE DE DADOS
CREATE OR REPLACE FUNCTION public.plan_max_products(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'pro' THEN NULL WHEN 'basic' THEN 60 ELSE 10 END
$$;

CREATE OR REPLACE FUNCTION public.plan_max_categories(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'pro' THEN NULL WHEN 'basic' THEN 30 ELSE 2 END
$$;

CREATE OR REPLACE FUNCTION public.enforce_product_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE store_plan text; max_allowed integer; current_count integer;
BEGIN
  SELECT plan INTO store_plan FROM public.stores WHERE id = NEW.store_id;
  max_allowed := public.plan_max_products(COALESCE(store_plan,'free'));
  IF NEW.is_featured AND COALESCE(store_plan,'free') <> 'pro' THEN
    RAISE EXCEPTION 'O destaque de produtos está disponível no plano Profissional.';
  END IF;
  IF max_allowed IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO current_count FROM public.products WHERE store_id = NEW.store_id;
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Este plano permite até % produtos. Faz upgrade para adicionar mais produtos.', max_allowed;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_product_featured()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE store_plan text;
BEGIN
  IF NEW.is_featured AND NOT COALESCE(OLD.is_featured,false) THEN
    SELECT plan INTO store_plan FROM public.stores WHERE id = NEW.store_id;
    IF COALESCE(store_plan,'free') <> 'pro' THEN
      RAISE EXCEPTION 'O destaque de produtos está disponível no plano Profissional.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_category_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE store_plan text; max_allowed integer; current_count integer;
BEGIN
  SELECT plan INTO store_plan FROM public.stores WHERE id = NEW.store_id;
  max_allowed := public.plan_max_categories(COALESCE(store_plan,'free'));
  IF max_allowed IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO current_count FROM public.categories WHERE store_id = NEW.store_id;
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Este plano permite até % categorias. Faz upgrade para adicionar mais categorias.', max_allowed;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS products_plan_limit ON public.products;
CREATE TRIGGER products_plan_limit BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_limit();

DROP TRIGGER IF EXISTS products_featured_plan ON public.products;
CREATE TRIGGER products_featured_plan BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_featured();

DROP TRIGGER IF EXISTS categories_plan_limit ON public.categories;
CREATE TRIGGER categories_plan_limit BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_limit();

-- 4. PLANO GRÁTIS NA LISTA OFICIAL
INSERT INTO public.plans (code, name, price_amount, price_currency, billing_period, is_active)
VALUES ('free', 'Grátis', 0, 'XOF', 'monthly', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_amount = EXCLUDED.price_amount, is_active = true;

UPDATE public.plans SET price_amount = 3500 WHERE code = 'basic';
UPDATE public.plans SET price_amount = 7900 WHERE code = 'pro';

-- 5. ADMIN OPERACIONAL
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = '6ahmadodanfa@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_admin_for_operational_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = '6ahmadodanfa@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- 6. CORREÇÃO DE SEGURANÇA: número recetor de pagamentos deixa de ser público
DROP POLICY IF EXISTS "active providers readable" ON public.payment_providers;
REVOKE SELECT ON public.payment_providers FROM anon;
CREATE POLICY "admins read providers" ON public.payment_providers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));