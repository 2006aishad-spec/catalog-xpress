-- Trial de 14 dias, planos oficiais e bloqueio server-side.
-- O trial é estado da loja; a tabela plans mantém apenas planos pagos faturáveis.

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.stores ALTER COLUMN plan SET DEFAULT 'trial';

-- Migração justa: lojas que ainda estavam em free recebem 14 dias a partir desta migração.
DO $$
DECLARE
  migrated_free integer;
  migrated_basic integer;
BEGIN
  SELECT count(*) INTO migrated_free FROM public.stores WHERE plan = 'free';
  UPDATE public.stores
     SET plan = 'trial', trial_ends_at = now() + interval '14 days'
   WHERE plan = 'free';
  GET DIAGNOSTICS migrated_basic = ROW_COUNT;
  RAISE NOTICE 'Lojas free migradas para trial: %', migrated_free;
  IF migrated_basic <> migrated_free THEN
    RAISE WARNING 'Contagem inesperada na migração free: antes %, atualizadas %', migrated_free, migrated_basic;
  END IF;

  UPDATE public.stores SET plan = 'essential' WHERE plan = 'basic';
  GET DIAGNOSTICS migrated_basic = ROW_COUNT;
  RAISE NOTICE 'Lojas basic migradas para essential: %', migrated_basic;
END $$;

-- Qualquer loja sem plano fica no trial; lojas trial existentes sem data recebem prazo de 14 dias.
UPDATE public.stores SET plan = 'trial' WHERE plan IS NULL OR plan NOT IN ('trial','essential','pro');
UPDATE public.stores
   SET trial_ends_at = now() + interval '14 days'
 WHERE plan = 'trial' AND trial_ends_at IS NULL;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_plan_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_plan_check CHECK (plan IN ('trial','essential','pro'));

CREATE OR REPLACE FUNCTION public.is_trial_expired(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT trial_ends_at < now() AND plan = 'trial'
    FROM public.stores WHERE id = _store_id), false)
$$;

CREATE OR REPLACE FUNCTION public.plan_max_products(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'pro' THEN NULL WHEN 'essential' THEN 80 ELSE 15 END
$$;

CREATE OR REPLACE FUNCTION public.plan_max_categories(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'pro' THEN NULL WHEN 'essential' THEN 20 ELSE 3 END
$$;

-- Nenhuma operação pública de leitura é afetada: estes triggers existem apenas nas tabelas de gestão.
CREATE OR REPLACE FUNCTION public.block_edits_when_trial_expired()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_store uuid;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN COALESCE(NEW, OLD); END IF;
  target_store := COALESCE(NEW.store_id, OLD.store_id);
  IF public.is_trial_expired(target_store) THEN
    RAISE EXCEPTION 'O teu período de teste de 14 dias terminou. Faz upgrade para continuar a gerir a tua loja.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS products_trial_guard ON public.products;
CREATE TRIGGER products_trial_guard BEFORE INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.block_edits_when_trial_expired();
DROP TRIGGER IF EXISTS categories_trial_guard ON public.categories;
CREATE TRIGGER categories_trial_guard BEFORE INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.block_edits_when_trial_expired();

CREATE OR REPLACE FUNCTION public.enforce_store_customization_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE store_plan text := COALESCE(NEW.plan, 'trial');
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF OLD.plan = 'trial' AND OLD.trial_ends_at IS NOT NULL AND OLD.trial_ends_at < now() THEN
    RAISE EXCEPTION 'O teu período de teste de 14 dias terminou. Faz upgrade para continuar a gerir a tua loja.';
  END IF;
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url AND NEW.logo_url IS NOT NULL AND store_plan NOT IN ('essential','pro') THEN
    RAISE EXCEPTION 'O logo da loja está disponível a partir do plano Essencial.';
  END IF;
  IF NEW.banner_url IS DISTINCT FROM OLD.banner_url AND store_plan <> 'pro' THEN
    RAISE EXCEPTION 'A capa da loja está disponível no plano Profissional.';
  END IF;
  IF NEW.primary_color IS DISTINCT FROM OLD.primary_color AND store_plan <> 'pro' THEN
    RAISE EXCEPTION 'A cor principal está disponível no plano Profissional.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stores_customization_plan ON public.stores;
CREATE TRIGGER stores_customization_plan BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.enforce_store_customization_plan();

UPDATE public.plans SET code='essential', name='Essencial', price_amount=1450 WHERE code='basic';
UPDATE public.plans SET code='pro', name='Profissional', price_amount=3000 WHERE code='pro';
-- Não inserimos trial em plans: não é faturável nem pedido de pagamento; vive em stores.
