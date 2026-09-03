-- 1) Coluna de trial
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.stores ALTER COLUMN plan SET DEFAULT 'trial';

UPDATE public.stores
   SET trial_ends_at = COALESCE(trial_ends_at, created_at + interval '14 days')
 WHERE plan IN ('free', 'trial');

-- 2) Limites por plano (fonte de verdade no servidor)
CREATE OR REPLACE FUNCTION public.plan_max_products(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE _plan
           WHEN 'pro' THEN NULL
           WHEN 'essential' THEN 80
           WHEN 'basic' THEN 80
           ELSE 15
         END
$$;

CREATE OR REPLACE FUNCTION public.plan_max_categories(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE _plan
           WHEN 'pro' THEN NULL
           WHEN 'essential' THEN 20
           WHEN 'basic' THEN 20
           ELSE 3
         END
$$;

-- 3) Helper de trial expirado
CREATE OR REPLACE FUNCTION public.is_trial_expired(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT s.plan = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at < now()
       FROM public.stores s WHERE s.id = _store_id),
    false)
$$;

GRANT EXECUTE ON FUNCTION public.is_trial_expired(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trial_expired(uuid) TO service_role;

-- 4) Bloqueio de edição após o teste (catálogo público continua a funcionar)
CREATE OR REPLACE FUNCTION public.block_edits_when_trial_expired()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  target_store uuid;
BEGIN
  IF auth.uid() IS NULL OR current_setting('request.jwt.claims', true) IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  target_store := COALESCE(NEW.store_id, OLD.store_id);
  IF public.is_trial_expired(target_store) THEN
    RAISE EXCEPTION 'O teu período de teste de 14 dias terminou. Faz upgrade para continuar a gerir a tua loja.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS products_trial_guard ON public.products;
CREATE TRIGGER products_trial_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.block_edits_when_trial_expired();

DROP TRIGGER IF EXISTS categories_trial_guard ON public.categories;
CREATE TRIGGER categories_trial_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.block_edits_when_trial_expired();

-- 5) Personalização por plano + bloqueio de edição da loja após o teste
CREATE OR REPLACE FUNCTION public.enforce_store_customization_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  store_plan text := COALESCE(NEW.plan, 'trial');
  is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL OR current_setting('request.jwt.claims', true) IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF store_plan = 'trial' AND OLD.trial_ends_at IS NOT NULL AND OLD.trial_ends_at < now() THEN
    RAISE EXCEPTION 'O teu período de teste de 14 dias terminou. Faz upgrade para continuar a gerir a tua loja.';
  END IF;

  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url
     AND NEW.logo_url IS NOT NULL
     AND store_plan NOT IN ('essential', 'basic', 'pro') THEN
    RAISE EXCEPTION 'O logo da loja está disponível a partir do plano Essencial.';
  END IF;

  IF NEW.banner_url IS DISTINCT FROM OLD.banner_url
     AND NEW.banner_url IS NOT NULL
     AND store_plan <> 'pro' THEN
    RAISE EXCEPTION 'A capa da loja está disponível no plano Profissional.';
  END IF;

  IF NEW.primary_color IS DISTINCT FROM OLD.primary_color AND store_plan <> 'pro' THEN
    RAISE EXCEPTION 'A cor principal está disponível no plano Profissional.';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS stores_customization_plan ON public.stores;
CREATE TRIGGER stores_customization_plan
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.enforce_store_customization_plan();

-- 6) Pedidos de plano: só planos pagos novos
CREATE OR REPLACE FUNCTION public.validate_plan_request()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.plan_code NOT IN ('essential','pro') THEN
    RAISE EXCEPTION 'Plano inválido para pedido de pagamento: %', NEW.plan_code;
  END IF;
  IF NEW.status NOT IN ('pending','under_review','active','rejected') THEN
    RAISE EXCEPTION 'Estado de pagamento inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;
