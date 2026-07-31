-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- stores
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_name text,
  description text NOT NULL DEFAULT '',
  tagline text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Geral',
  location text NOT NULL DEFAULT '',
  whatsapp_number text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'XOF',
  primary_color text NOT NULL DEFAULT '#22d3ee',
  logo_url text,
  banner_url text,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stores_owner_idx ON public.stores(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT ON public.stores TO anon;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own store" ON public.stores FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "published stores are public" ON public.stores FOR SELECT TO anon
  USING (status = 'published');
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owns_store(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.store_is_published(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND status = 'published')
$$;

-- categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categories_store_idx ON public.categories(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT ON public.categories TO anon;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own categories" ON public.categories FOR ALL TO authenticated
  USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));
CREATE POLICY "public categories of published stores" ON public.categories FOR SELECT TO anon
  USING (is_active AND public.store_is_published(store_id));

-- products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  image_url text,
  stock int,
  sku text,
  sizes text[] NOT NULL DEFAULT '{}',
  colors text[] NOT NULL DEFAULT '{}',
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_store_idx ON public.products(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own products" ON public.products FOR ALL TO authenticated
  USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));
CREATE POLICY "public products of published stores" ON public.products FOR SELECT TO anon
  USING (is_active AND public.store_is_published(store_id));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- events
CREATE TABLE public.store_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  device text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_events_store_idx ON public.store_events(store_id, created_at DESC);
GRANT SELECT, INSERT ON public.store_events TO authenticated;
GRANT INSERT ON public.store_events TO anon;
GRANT ALL ON public.store_events TO service_role;
ALTER TABLE public.store_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can log events on published stores" ON public.store_events FOR INSERT TO anon, authenticated
  WITH CHECK (public.store_is_published(store_id) AND event_type IN ('catalog_view', 'whatsapp_click', 'product_view'));
CREATE POLICY "owners read own events" ON public.store_events FOR SELECT TO authenticated
  USING (public.owns_store(store_id));

-- orders / leads
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  variant text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'catalog',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_store_idx ON public.orders(store_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can create order on published store" ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (public.store_is_published(store_id) AND char_length(customer_name) <= 120 AND char_length(coalesce(notes, '')) <= 800);
CREATE POLICY "owners read own orders" ON public.orders FOR SELECT TO authenticated
  USING (public.owns_store(store_id));
CREATE POLICY "owners update own orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.owns_store(store_id)) WITH CHECK (public.owns_store(store_id));
CREATE POLICY "owners delete own orders" ON public.orders FOR DELETE TO authenticated
  USING (public.owns_store(store_id));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();