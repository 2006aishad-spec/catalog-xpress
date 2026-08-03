CREATE OR REPLACE FUNCTION public.djp_expire_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.payment_intents
       SET status = 'EXPIRED'
     WHERE status = 'PENDING' AND expires_at <= now()
    RETURNING id
  ), logged AS (
    INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
    SELECT 'payment_intent', upd.id, 'expire', 'PENDING', 'EXPIRED', 'system_cron',
           jsonb_build_object('reason','expires_at ultrapassado')
    FROM upd
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM logged;
  RETURN COALESCE(n, 0);
END; $$;
REVOKE ALL ON FUNCTION public.djp_expire_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.djp_expire_intents() TO service_role;