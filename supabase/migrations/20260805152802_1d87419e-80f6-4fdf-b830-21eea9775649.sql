CREATE OR REPLACE FUNCTION public.protect_store_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  -- Contexto de servidor privilegiado (service_role) ou admin: sem restrições.
  IF auth.uid() IS NULL OR current_setting('request.jwt.claims', true) IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- O plano só pode ser alterado pela equipa após confirmação de pagamento.
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'O plano só pode ser alterado pela equipa Djumbai Shop após confirmação do pagamento.';
  END IF;

  -- O lojista pode publicar/despublicar, mas não atribuir estados administrativos.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('draft','published') THEN
    RAISE EXCEPTION 'Estado de loja inválido para o lojista: %', NEW.status;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS stores_protect_billing ON public.stores;
CREATE TRIGGER stores_protect_billing
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.protect_store_billing_fields();