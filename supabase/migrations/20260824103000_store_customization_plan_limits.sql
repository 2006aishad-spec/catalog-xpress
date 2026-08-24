-- Personalização da loja: logo a partir do Básico; capa e cor no Profissional.
-- Reutiliza os campos já existentes em public.stores.
CREATE OR REPLACE FUNCTION public.enforce_store_customization_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  store_plan text := COALESCE(NEW.plan, 'free');
BEGIN
  IF COALESCE(NEW.logo_url, '') <> COALESCE(OLD.logo_url, '')
     AND store_plan NOT IN ('basic', 'pro') THEN
    RAISE EXCEPTION 'O logo da loja está disponível a partir do plano Básico. Faz upgrade para desbloquear.';
  END IF;

  IF (COALESCE(NEW.banner_url, '') <> COALESCE(OLD.banner_url, '')
      OR COALESCE(NEW.primary_color, '#22d3ee') <> COALESCE(OLD.primary_color, '#22d3ee'))
     AND store_plan <> 'pro' THEN
    RAISE EXCEPTION 'A capa e a cor personalizada estão disponíveis no plano Profissional. Faz upgrade para desbloquear.';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS stores_customization_plan ON public.stores;
CREATE TRIGGER stores_customization_plan
BEFORE UPDATE OF logo_url, banner_url, primary_color ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.enforce_store_customization_plan();
