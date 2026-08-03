-- =====================================================================
-- DJUMBAI PAY — módulo de confirmação automática de pagamentos
-- Desenhado para poder ser extraído para um projeto próprio: a única
-- ligação ao Djumbai Shop são payment_intents.store_id / payment_history.store_id
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------- providers
CREATE TABLE public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'mobile_money'
    CHECK (provider_type IN ('mobile_money','bank','cash','other')),
  receiving_msisdn text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_providers TO anon, authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active providers readable" ON public.payment_providers
  FOR SELECT TO anon, authenticated USING (is_active);

-- ------------------------------------------------------------------- plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_amount numeric(14,2) NOT NULL DEFAULT 0,
  price_currency text NOT NULL DEFAULT 'XOF',
  billing_period text NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly','yearly','one_time')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active plans readable" ON public.plans
  FOR SELECT TO anon, authenticated USING (is_active);

-- --------------------------------------------------------- payment_intents
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  customer_identifier text NOT NULL DEFAULT '',
  customer_msisdn_hint text,
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id),
  expected_amount numeric(14,2) NOT NULL,
  expected_currency text NOT NULL DEFAULT 'XOF',
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','EXPIRED','MATCHED','CONFIRMED','NEEDS_REVIEW','REJECTED','ACTIVATED')),
  expires_at timestamptz NOT NULL,
  matched_transaction_id uuid,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_intents_matching_idx
  ON public.payment_intents (status, expected_amount, expires_at);
CREATE INDEX payment_intents_store_idx ON public.payment_intents (store_id, created_at DESC);
-- Cliente NUNCA escreve em pagamentos: apenas SELECT das suas próprias linhas.
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own intents" ON public.payment_intents
  FOR SELECT TO authenticated USING (public.owns_store(store_id));
CREATE POLICY "admins read all intents" ON public.payment_intents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Regra temporal por trigger (CHECK precisa de ser imutável).
CREATE OR REPLACE FUNCTION public.djp_validate_intent()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at deve ser posterior a created_at';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER djp_validate_intent_trg BEFORE INSERT OR UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.djp_validate_intent();

-- ---------------------------------------------------------- raw_sms_events
-- TABELA IMUTÁVEL: nunca DELETE, nunca UPDATE destrutivo.
CREATE TABLE public.raw_sms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_device_id text NOT NULL DEFAULT '',
  raw_body text NOT NULL,
  received_at_device timestamptz,
  received_at_server timestamptz NOT NULL DEFAULT now(),
  sender_shortcode text,
  processing_status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN ('RECEIVED','PARSE_ERROR','DUPLICATE','UNMATCHED','MATCHED','NEEDS_REVIEW')),
  parse_error text
);
CREATE INDEX raw_sms_events_status_idx ON public.raw_sms_events (processing_status, received_at_server DESC);
GRANT SELECT ON public.raw_sms_events TO authenticated;
GRANT ALL ON public.raw_sms_events TO service_role;
ALTER TABLE public.raw_sms_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read raw sms" ON public.raw_sms_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.djp_block_sms_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'raw_sms_events é imutável: eliminação proibida';
END; $$;
CREATE TRIGGER djp_block_sms_delete_trg BEFORE DELETE ON public.raw_sms_events
  FOR EACH ROW EXECUTE FUNCTION public.djp_block_sms_delete();

CREATE OR REPLACE FUNCTION public.djp_protect_sms_body()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Só processing_status/parse_error podem mudar. O conteúdo é intocável.
  NEW.raw_body := OLD.raw_body;
  NEW.gateway_device_id := OLD.gateway_device_id;
  NEW.received_at_device := OLD.received_at_device;
  NEW.received_at_server := OLD.received_at_server;
  NEW.sender_shortcode := OLD.sender_shortcode;
  RETURN NEW;
END; $$;
CREATE TRIGGER djp_protect_sms_body_trg BEFORE UPDATE ON public.raw_sms_events
  FOR EACH ROW EXECUTE FUNCTION public.djp_protect_sms_body();

-- ---------------------------------------------------- provider_transactions
CREATE TABLE public.provider_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_event_id uuid NOT NULL REFERENCES public.raw_sms_events(id),
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id),
  provider_transaction_id text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  transaction_date date,
  transaction_time time,
  sender_msisdn text,
  recipient_msisdn text,
  new_balance numeric(14,2),
  is_used boolean NOT NULL DEFAULT false,
  used_by_intent_id uuid REFERENCES public.payment_intents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_transactions_unique_tx UNIQUE (provider_id, provider_transaction_id)
);
CREATE INDEX provider_transactions_unused_idx ON public.provider_transactions (is_used, created_at DESC);
GRANT SELECT ON public.provider_transactions TO authenticated;
GRANT ALL ON public.provider_transactions TO service_role;
ALTER TABLE public.provider_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read transactions" ON public.provider_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.payment_intents
  ADD CONSTRAINT payment_intents_matched_tx_fkey
  FOREIGN KEY (matched_transaction_id) REFERENCES public.provider_transactions(id);

-- --------------------------------------------------------- payment_history
CREATE SEQUENCE public.djp_receipt_seq START 1;
CREATE TABLE public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES public.payment_intents(id),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_transaction_id uuid REFERENCES public.provider_transactions(id),
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  receipt_number text NOT NULL UNIQUE,
  confirmed_by text NOT NULL DEFAULT 'system_auto',
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  activation_status text NOT NULL DEFAULT 'PENDING'
    CHECK (activation_status IN ('PENDING','ACTIVATED','FAILED')),
  notified_whatsapp boolean NOT NULL DEFAULT false,
  notified_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_history TO authenticated;
GRANT ALL ON public.payment_history TO service_role;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own receipts" ON public.payment_history
  FOR SELECT TO authenticated USING (public.owns_store(store_id));
CREATE POLICY "admins read all receipts" ON public.payment_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------------- audit_log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  from_state text,
  to_state text,
  actor text NOT NULL DEFAULT 'system_auto',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON public.audit_log (entity_type, entity_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------- fraud_signals
CREATE TABLE public.fraud_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  related_intent_id uuid REFERENCES public.payment_intents(id),
  related_tx_id uuid REFERENCES public.provider_transactions(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fraud_signals TO authenticated;
GRANT ALL ON public.fraud_signals TO service_role;
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read fraud signals" ON public.fraud_signals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- MOTOR DE VALIDAÇÃO (atómico, com bloqueio de linha)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.djp_match_transaction(_tx_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx public.provider_transactions;
  candidate_ids uuid[];
  n int;
  chosen uuid;
  prev_status text;
BEGIN
  SELECT * INTO tx FROM public.provider_transactions WHERE id = _tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome','TX_NOT_FOUND');
  END IF;
  IF tx.is_used THEN
    RETURN jsonb_build_object('outcome','ALREADY_USED','intent_id',tx.used_by_intent_id);
  END IF;

  -- Correspondência EXATA: valor idêntico, moeda idêntica, PENDING e dentro da janela.
  -- Sem tolerância, sem arredondamento, sem heurística de proximidade.
  SELECT array_agg(i.id) INTO candidate_ids
  FROM public.payment_intents i
  WHERE i.status = 'PENDING'
    AND i.expires_at > now()
    AND i.expected_amount = tx.amount
    AND i.expected_currency = tx.currency
  FOR UPDATE;

  n := COALESCE(array_length(candidate_ids, 1), 0);

  IF n = 0 THEN
    INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
    VALUES ('provider_transaction', tx.id, 'match_attempt', NULL, 'UNMATCHED', 'system_auto',
            jsonb_build_object('reason','nenhum payment_intent PENDING com este valor na janela',
                               'amount', tx.amount, 'currency', tx.currency));
    RETURN jsonb_build_object('outcome','UNMATCHED');
  END IF;

  IF n > 1 THEN
    -- Ambiguidade NUNCA é resolvida automaticamente.
    UPDATE public.payment_intents
       SET status = 'NEEDS_REVIEW',
           review_reason = 'ambiguidade: vários pedidos com o mesmo valor na mesma janela'
     WHERE id = ANY(candidate_ids);
    INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
    SELECT 'payment_intent', unnest(candidate_ids), 'ambiguous_match', 'PENDING', 'NEEDS_REVIEW', 'system_auto',
           jsonb_build_object('reason','2+ correspondências para a mesma transação',
                              'transaction_id', tx.id, 'candidates', to_jsonb(candidate_ids));
    INSERT INTO public.fraud_signals(signal_type, severity, related_tx_id, details)
    VALUES ('ambiguous_match','medium', tx.id,
            jsonb_build_object('candidates', to_jsonb(candidate_ids), 'amount', tx.amount));
    RETURN jsonb_build_object('outcome','NEEDS_REVIEW','candidates',to_jsonb(candidate_ids));
  END IF;

  chosen := candidate_ids[1];
  SELECT status INTO prev_status FROM public.payment_intents WHERE id = chosen;

  UPDATE public.payment_intents
     SET status = 'MATCHED', matched_transaction_id = tx.id
   WHERE id = chosen;
  INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
  VALUES ('payment_intent', chosen, 'auto_match', prev_status, 'MATCHED', 'system_auto',
          jsonb_build_object('reason','correspondência única exata (valor + moeda + janela + ID novo)',
                             'transaction_id', tx.id, 'provider_transaction_id', tx.provider_transaction_id));

  UPDATE public.provider_transactions
     SET is_used = true, used_by_intent_id = chosen
   WHERE id = tx.id;

  UPDATE public.payment_intents SET status = 'CONFIRMED' WHERE id = chosen;
  INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
  VALUES ('payment_intent', chosen, 'auto_confirm', 'MATCHED', 'CONFIRMED', 'system_auto',
          jsonb_build_object('transaction_id', tx.id));

  -- Sinal informativo: número remetente diferente do indicado (não desqualifica).
  IF EXISTS (
    SELECT 1 FROM public.payment_intents i
     WHERE i.id = chosen
       AND i.customer_msisdn_hint IS NOT NULL
       AND length(i.customer_msisdn_hint) >= 6
       AND tx.sender_msisdn IS NOT NULL
       AND right(regexp_replace(i.customer_msisdn_hint,'\D','','g'), 6)
           <> right(regexp_replace(tx.sender_msisdn,'\D','','g'), 6)
  ) THEN
    INSERT INTO public.fraud_signals(signal_type, severity, related_intent_id, related_tx_id, details)
    VALUES ('msisdn_mismatch','low', chosen, tx.id,
            jsonb_build_object('sender_msisdn', tx.sender_msisdn));
  END IF;

  RETURN jsonb_build_object('outcome','CONFIRMED','intent_id',chosen);
END; $$;
REVOKE ALL ON FUNCTION public.djp_match_transaction(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.djp_match_transaction(uuid) TO service_role;

-- =====================================================================
-- ATIVAÇÃO AUTOMÁTICA
-- =====================================================================
CREATE OR REPLACE FUNCTION public.djp_activate_intent(_intent_id uuid, _actor text DEFAULT 'system_auto')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i public.payment_intents;
  plan_code text;
  receipt text;
BEGIN
  SELECT * INTO i FROM public.payment_intents WHERE id = _intent_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','intent inexistente'); END IF;
  IF i.status = 'ACTIVATED' THEN
    RETURN jsonb_build_object('ok',true,'already',true);
  END IF;
  IF i.status <> 'CONFIRMED' THEN
    RETURN jsonb_build_object('ok',false,'error','intent não está CONFIRMED','status',i.status);
  END IF;

  SELECT code INTO plan_code FROM public.plans WHERE id = i.plan_id;
  receipt := 'DJP-R-' || lpad(nextval('public.djp_receipt_seq')::text, 6, '0');

  UPDATE public.stores SET plan = plan_code WHERE id = i.store_id;

  INSERT INTO public.payment_history(
    payment_intent_id, store_id, provider_transaction_id, amount, currency,
    receipt_number, confirmed_by, activation_status)
  VALUES (i.id, i.store_id, i.matched_transaction_id, i.expected_amount, i.expected_currency,
          receipt, _actor, 'ACTIVATED');

  UPDATE public.payment_intents SET status = 'ACTIVATED' WHERE id = i.id;

  INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
  VALUES ('payment_intent', i.id, 'activate', 'CONFIRMED', 'ACTIVATED', _actor,
          jsonb_build_object('store_id', i.store_id, 'plan_code', plan_code, 'receipt_number', receipt));

  RETURN jsonb_build_object('ok',true,'receipt_number',receipt,'plan_code',plan_code);
END; $$;
REVOKE ALL ON FUNCTION public.djp_activate_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.djp_activate_intent(uuid, text) TO service_role;

-- =====================================================================
-- EXPIRAÇÃO AUTOMÁTICA (pg_cron, 5 em 5 minutos)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.djp_expire_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE expired_ids uuid[];
BEGIN
  UPDATE public.payment_intents
     SET status = 'EXPIRED'
   WHERE status = 'PENDING' AND expires_at <= now()
  RETURNING id INTO expired_ids;

  SELECT array_agg(id) INTO expired_ids
  FROM public.payment_intents WHERE status = 'EXPIRED' AND updated_at > now() - interval '10 seconds';

  IF expired_ids IS NOT NULL THEN
    INSERT INTO public.audit_log(entity_type, entity_id, action, from_state, to_state, actor, metadata)
    SELECT 'payment_intent', unnest(expired_ids), 'expire', 'PENDING', 'EXPIRED', 'system_cron',
           jsonb_build_object('reason','expires_at ultrapassado');
    RETURN array_length(expired_ids,1);
  END IF;
  RETURN 0;
END; $$;
REVOKE ALL ON FUNCTION public.djp_expire_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.djp_expire_intents() TO service_role;

SELECT cron.schedule('djp-expire-intents', '*/5 * * * *', $$SELECT public.djp_expire_intents();$$);

-- =====================================================================
-- REALTIME para o ecrã de espera do checkout
-- =====================================================================
ALTER TABLE public.payment_intents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_intents;

-- =====================================================================
-- SEED
-- =====================================================================
INSERT INTO public.payment_providers (provider_code, display_name, provider_type, receiving_msisdn, config)
VALUES ('orange_money_gw','Orange Money Guiné-Bissau','mobile_money','955469148',
        jsonb_build_object('country','GW','sms_sender','OrangeMoney'));

INSERT INTO public.plans (code, name, price_amount, price_currency, billing_period) VALUES
  ('basic','Básico', 3500, 'XOF', 'monthly'),
  ('pro','Profissional', 7900, 'XOF', 'monthly');
