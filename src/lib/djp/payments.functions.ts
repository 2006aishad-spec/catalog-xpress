/**
 * DJUMBAI PAY — server functions (checkout + administração)
 *
 * Regras de ouro deste módulo:
 * - O cliente NUNCA escreve em tabelas de pagamento (sem GRANT). Toda a
 *   escrita passa por aqui, com a service role, depois de validar quem chama.
 * - Ambiguidade e divergência de valor nunca são resolvidas automaticamente.
 * - Toda mudança de estado deixa rasto em audit_log.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckoutPlan = {
  id: string;
  code: string;
  name: string;
  price_amount: number;
  price_currency: string;
  billing_period: string;
};

export type IntentView = {
  reference: string;
  status: string;
  expected_amount: number;
  expected_currency: string;
  expires_at: string;
  provider_msisdn: string;
  provider_name: string;
  plan_code: string;
  plan_name: string;
  review_reason: string | null;
  receipt_number: string | null;
};

/** Referência legível e sem caracteres ambíguos (sem 0/O/1/I). */
function makeReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `DJP-${out}`;
}

export const listCheckoutPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckoutPlan[]> => {
    const { data, error } = await context.supabase
      .from("plans")
      .select("id, code, name, price_amount, price_currency, billing_period")
      .eq("is_active", true)
      .order("price_amount", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

/** Cria um payment_intent PENDING com janela de 60 minutos. */
export const createPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planCode: string; msisdnHint?: string }) => ({
    planCode: String(data.planCode ?? "").slice(0, 30),
    msisdnHint: data.msisdnHint ? String(data.msisdnHint).replace(/\D/g, "").slice(0, 15) : "",
  }))
  .handler(async ({ data, context }): Promise<{ reference: string }> => {
    // A loja é lida com o cliente do utilizador (RLS): garante que é dele.
    const { data: store, error: storeError } = await context.supabase
      .from("stores")
      .select("id, owner_id")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (storeError) throw storeError;
    if (!store) throw new Error("Sem loja criada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, code, price_amount, price_currency")
      .eq("code", data.planCode)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) throw new Error("Plano inválido");
    if (Number(plan.price_amount) <= 0) throw new Error("Este plano não requer pagamento");

    const { data: provider } = await supabaseAdmin
      .from("payment_providers")
      .select("id")
      .eq("provider_code", "orange_money_gw")
      .eq("is_active", true)
      .maybeSingle();
    if (!provider) throw new Error("Operador de pagamento indisponível");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Tenta algumas referências: a coluna é UNIQUE, colisão é erro 23505.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = makeReference();
      const { data: inserted, error } = await supabaseAdmin
        .from("payment_intents")
        .insert({
          reference,
          store_id: store.id,
          plan_id: plan.id,
          provider_id: provider.id,
          customer_identifier: context.userId,
          customer_msisdn_hint: data.msisdnHint || null,
          expected_amount: plan.price_amount,
          expected_currency: plan.price_currency,
          status: "PENDING",
          expires_at: expiresAt,
        })
        .select("id, reference")
        .maybeSingle();
      if (error) {
        if ((error as { code?: string }).code === "23505") continue;
        throw error;
      }
      if (!inserted) throw new Error("Falha ao criar pedido de pagamento");

      await supabaseAdmin.from("audit_log").insert({
        entity_type: "payment_intent",
        entity_id: inserted.id,
        action: "create",
        from_state: null,
        to_state: "PENDING",
        actor: `user:${context.userId}`,
        metadata: {
          plan_code: plan.code,
          amount: plan.price_amount,
          currency: plan.price_currency,
          store_id: store.id,
        },
      });
      return { reference: inserted.reference };
    }
    throw new Error("Não foi possível gerar uma referência única");
  });

/** Estado do pedido — lido com RLS do próprio lojista. */
export const getPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reference: string }) => ({
    reference: String(data.reference ?? "").slice(0, 20),
  }))
  .handler(async ({ data, context }): Promise<IntentView | null> => {
    const { data: intent, error } = await context.supabase
      .from("payment_intents")
      .select(
        "id, reference, status, expected_amount, expected_currency, expires_at, review_reason, plans(code, name), payment_providers(display_name, receiving_msisdn)",
      )
      .eq("reference", data.reference)
      .maybeSingle();
    if (error) throw error;
    if (!intent) return null;

    const { data: receipt } = await context.supabase
      .from("payment_history")
      .select("receipt_number")
      .eq("payment_intent_id", intent.id)
      .maybeSingle();

    const plan = intent.plans as { code: string; name: string } | null;
    const provider = intent.payment_providers as {
      display_name: string;
      receiving_msisdn: string;
    } | null;

    return {
      reference: intent.reference,
      status: intent.status,
      expected_amount: Number(intent.expected_amount),
      expected_currency: intent.expected_currency,
      expires_at: intent.expires_at,
      provider_msisdn: provider?.receiving_msisdn ?? "",
      provider_name: provider?.display_name ?? "",
      plan_code: plan?.code ?? "",
      plan_name: plan?.name ?? "",
      review_reason: intent.review_reason ?? null,
      receipt_number: receipt?.receipt_number ?? null,
    };
  });

// ------------------------------------------------------------------ admin

export type ReviewIntent = {
  id: string;
  reference: string;
  status: string;
  expected_amount: number;
  expected_currency: string;
  created_at: string;
  expires_at: string;
  review_reason: string | null;
  store_name: string;
  store_slug: string;
  store_whatsapp: string;
  plan_name: string;
};

export type UnmatchedTx = {
  id: string;
  provider_transaction_id: string;
  amount: number;
  currency: string;
  sender_msisdn: string | null;
  transaction_date: string | null;
  transaction_time: string | null;
  created_at: string;
};

export type ParseErrorSms = {
  id: string;
  raw_body: string;
  parse_error: string | null;
  received_at_server: string;
  gateway_device_id: string;
};

export type PaymentsAdminData = {
  needsReview: ReviewIntent[];
  unmatched: UnmatchedTx[];
  parseErrors: ParseErrorSms[];
  totals: { confirmed: number; activatedAmount: number; pending: number };
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supa = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await supa.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

export const getPaymentsAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentsAdminData> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [intents, txs, errors, history] = await Promise.all([
      supabaseAdmin
        .from("payment_intents")
        .select(
          "id, reference, status, expected_amount, expected_currency, created_at, expires_at, review_reason, stores(name, slug, whatsapp_number), plans(name)",
        )
        .in("status", ["NEEDS_REVIEW", "CONFIRMED"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("provider_transactions")
        .select(
          "id, provider_transaction_id, amount, currency, sender_msisdn, transaction_date, transaction_time, created_at",
        )
        .eq("is_used", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("raw_sms_events")
        .select("id, raw_body, parse_error, received_at_server, gateway_device_id")
        .eq("processing_status", "PARSE_ERROR")
        .order("received_at_server", { ascending: false })
        .limit(50),
      supabaseAdmin.from("payment_history").select("amount, activation_status"),
    ]);

    const needsReview: ReviewIntent[] = (intents.data ?? []).map((i) => {
      const store = i.stores as {
        name: string;
        slug: string;
        whatsapp_number: string;
      } | null;
      const plan = i.plans as { name: string } | null;
      return {
        id: i.id,
        reference: i.reference,
        status: i.status,
        expected_amount: Number(i.expected_amount),
        expected_currency: i.expected_currency,
        created_at: i.created_at,
        expires_at: i.expires_at,
        review_reason: i.review_reason ?? null,
        store_name: store?.name ?? "—",
        store_slug: store?.slug ?? "",
        store_whatsapp: store?.whatsapp_number ?? "",
        plan_name: plan?.name ?? "",
      };
    });

    return {
      needsReview,
      unmatched: (txs.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })),
      parseErrors: errors.data ?? [],
      totals: {
        confirmed: (history.data ?? []).length,
        activatedAmount: (history.data ?? [])
          .filter((h) => h.activation_status === "ACTIVATED")
          .reduce((sum, h) => sum + Number(h.amount), 0),
        pending: needsReview.filter((i) => i.status === "NEEDS_REVIEW").length,
      },
    };
  });

/**
 * Resolução manual pelo admin.
 * - confirm: opcionalmente liga uma transação órfã ao pedido, confirma e ativa.
 * - reject: fecha o pedido como REJEITADO, sem ativar nada.
 * Nada aqui é automático: o autor fica registado em audit_log.
 */
export const adminResolveIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { intentId: string; action: "confirm" | "reject"; txId?: string }) => ({
    intentId: String(data.intentId ?? "").slice(0, 40),
    action: data.action === "confirm" ? ("confirm" as const) : ("reject" as const),
    txId: data.txId ? String(data.txId).slice(0, 40) : undefined,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = `admin:${context.userId}`;

    const { data: intent } = await supabaseAdmin
      .from("payment_intents")
      .select("id, status, matched_transaction_id, expected_amount, expected_currency")
      .eq("id", data.intentId)
      .maybeSingle();
    if (!intent) throw new Error("Pedido inexistente");

    if (data.action === "reject") {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "REJECTED", review_reason: "rejeitado manualmente pelo admin" })
        .eq("id", intent.id);
      await supabaseAdmin.from("audit_log").insert({
        entity_type: "payment_intent",
        entity_id: intent.id,
        action: "manual_reject",
        from_state: intent.status,
        to_state: "REJECTED",
        actor,
        metadata: {},
      });
      return { ok: true, status: "REJECTED" as const };
    }

    // Ligação manual de uma transação órfã (dupla confirmação feita na UI).
    let txId = intent.matched_transaction_id as string | null;
    if (data.txId) {
      const { data: tx } = await supabaseAdmin
        .from("provider_transactions")
        .select("id, is_used, amount, currency, provider_transaction_id")
        .eq("id", data.txId)
        .maybeSingle();
      if (!tx) throw new Error("Transação inexistente");
      if (tx.is_used) throw new Error("Transação já usada noutro pedido");
      const { error: txError } = await supabaseAdmin
        .from("provider_transactions")
        .update({ is_used: true, used_by_intent_id: intent.id })
        .eq("id", tx.id)
        .eq("is_used", false);
      if (txError) throw txError;
      txId = tx.id;
      await supabaseAdmin.from("audit_log").insert({
        entity_type: "provider_transaction",
        entity_id: tx.id,
        action: "manual_link",
        from_state: "UNMATCHED",
        to_state: "USED",
        actor,
        metadata: {
          intent_id: intent.id,
          tx_amount: tx.amount,
          expected_amount: intent.expected_amount,
          provider_transaction_id: tx.provider_transaction_id,
        },
      });
    }

    await supabaseAdmin
      .from("payment_intents")
      .update({ status: "CONFIRMED", matched_transaction_id: txId })
      .eq("id", intent.id);
    await supabaseAdmin.from("audit_log").insert({
      entity_type: "payment_intent",
      entity_id: intent.id,
      action: "manual_confirm",
      from_state: intent.status,
      to_state: "CONFIRMED",
      actor,
      metadata: { transaction_id: txId },
    });

    const { data: activation, error: activationError } = await supabaseAdmin.rpc(
      "djp_activate_intent",
      { _intent_id: intent.id, _actor: actor },
    );
    if (activationError) throw activationError;

    return { ok: true, status: "ACTIVATED" as const, activation };
  });
