/**
 * DJUMBAI PAY — receção de SMS do gateway Android.
 *
 * POST /api/public/webhooks/sms-inbound
 * Headers obrigatórios:
 *   x-djp-timestamp: epoch em segundos (janela de 5 min, anti-replay)
 *   x-djp-signature : HMAC-SHA256 hex de `${timestamp}.${corpo cru}` com DJP_SMS_DEVICE_SECRET
 * Body JSON: { device_id, raw_body, received_at_device?, sender_shortcode? }
 *
 * Ordem inviolável:
 *   1. gravar o SMS bruto (sempre, mesmo que o parsing falhe depois)
 *   2. parsing
 *   3. gravar transação estruturada (ID único)
 *   4. motor de validação (função Postgres atómica)
 *   5. ativação, só se CONFIRMED
 *
 * Devolve sempre 200 quando o SMS foi guardado — o telemóvel não deve reenviar
 * em ciclo por causa de um SMS que não conseguimos interpretar.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { parseOrangeMoneySms } from "@/lib/djp/parse-orange-money";

function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/sms-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["DJP_SMS_DEVICE_SECRET"];
        if (!secret) {
          console.error("[djp] DJP_SMS_DEVICE_SECRET não configurado");
          return new Response("Not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-djp-signature") ?? "";
        const timestamp = request.headers.get("x-djp-timestamp") ?? "";
        const ts = Number(timestamp);
        if (!signature || !Number.isFinite(ts)) {
          return new Response("Missing signature", { status: 401 });
        }
        if (Math.abs(Date.now() / 1000 - ts) > 300) {
          return new Response("Stale timestamp", { status: 401 });
        }
        if (!verifySignature(rawBody, timestamp, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          device_id?: unknown;
          raw_body?: unknown;
          received_at_device?: unknown;
          sender_shortcode?: unknown;
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const smsBody = typeof payload.raw_body === "string" ? payload.raw_body : "";
        if (!smsBody.trim()) return new Response("raw_body required", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. GRAVAR PRIMEIRO — nunca perder o SMS.
        const { data: rawEvent, error: rawError } = await supabaseAdmin
          .from("raw_sms_events")
          .insert({
            gateway_device_id:
              typeof payload.device_id === "string" ? payload.device_id.slice(0, 80) : "",
            raw_body: smsBody.slice(0, 4000),
            received_at_device:
              typeof payload.received_at_device === "string" ? payload.received_at_device : null,
            sender_shortcode:
              typeof payload.sender_shortcode === "string"
                ? payload.sender_shortcode.slice(0, 40)
                : null,
            processing_status: "RECEIVED",
          })
          .select("id")
          .maybeSingle();
        if (rawError || !rawEvent) {
          console.error("[djp] falha a gravar raw_sms_events", rawError);
          return new Response("Storage error", { status: 500 });
        }

        const { data: provider } = await supabaseAdmin
          .from("payment_providers")
          .select("id, receiving_msisdn")
          .eq("provider_code", "orange_money_gw")
          .maybeSingle();
        if (!provider) {
          await supabaseAdmin
            .from("raw_sms_events")
            .update({ processing_status: "PARSE_ERROR", parse_error: "operador não configurado" })
            .eq("id", rawEvent.id);
          return Response.json({ ok: true, status: "PARSE_ERROR" });
        }

        // 2. PARSING
        const parsed = parseOrangeMoneySms(smsBody, {
          recipientMsisdn: provider.receiving_msisdn,
        });
        if (!parsed.ok) {
          await supabaseAdmin
            .from("raw_sms_events")
            .update({ processing_status: "PARSE_ERROR", parse_error: parsed.error.slice(0, 300) })
            .eq("id", rawEvent.id);
          await supabaseAdmin.from("audit_log").insert({
            entity_type: "raw_sms_event",
            entity_id: rawEvent.id,
            action: "parse",
            from_state: "RECEIVED",
            to_state: "PARSE_ERROR",
            actor: "system_auto",
            metadata: { error: parsed.error },
          });
          return Response.json({ ok: true, status: "PARSE_ERROR", error: parsed.error });
        }
        const sms = parsed.data;

        // 3. TRANSAÇÃO ESTRUTURADA (ID único por operador impede reuso)
        const { data: tx, error: txError } = await supabaseAdmin
          .from("provider_transactions")
          .insert({
            raw_event_id: rawEvent.id,
            provider_id: provider.id,
            provider_transaction_id: sms.providerTransactionId,
            amount: sms.amount,
            currency: sms.currency,
            transaction_date: sms.transactionDate,
            transaction_time: sms.transactionTime,
            sender_msisdn: sms.senderMsisdn,
            recipient_msisdn: sms.recipientMsisdn,
            new_balance: sms.newBalance,
          })
          .select("id")
          .maybeSingle();

        if (txError) {
          if ((txError as { code?: string }).code === "23505") {
            // Mesmo ID de transação outra vez: replay ou SMS duplicado.
            await supabaseAdmin
              .from("raw_sms_events")
              .update({ processing_status: "DUPLICATE" })
              .eq("id", rawEvent.id);
            await supabaseAdmin.from("fraud_signals").insert({
              signal_type: "duplicate_transaction_id",
              severity: "medium",
              details: {
                provider_transaction_id: sms.providerTransactionId,
                raw_event_id: rawEvent.id,
              },
            });
            return Response.json({ ok: true, status: "DUPLICATE" });
          }
          console.error("[djp] falha a gravar provider_transactions", txError);
          return new Response("Storage error", { status: 500 });
        }
        if (!tx) return new Response("Storage error", { status: 500 });

        // 4. MOTOR DE VALIDAÇÃO (atómico, com bloqueio de linha)
        const { data: match, error: matchError } = await supabaseAdmin.rpc(
          "djp_match_transaction",
          { _tx_id: tx.id },
        );
        if (matchError) {
          console.error("[djp] falha no motor de validação", matchError);
          return Response.json({ ok: true, status: "MATCH_ERROR" }, { status: 200 });
        }
        const outcome = (match as { outcome?: string } | null)?.outcome ?? "UNKNOWN";
        const intentId = (match as { intent_id?: string } | null)?.intent_id;

        if (outcome === "UNMATCHED") {
          await supabaseAdmin
            .from("raw_sms_events")
            .update({ processing_status: "UNMATCHED" })
            .eq("id", rawEvent.id);

          // Regra do negócio: valor diferente do esperado NUNCA ativa nada.
          // Se o remetente coincide com um pedido pendente, esse pedido vai
          // para revisão manual em vez de ficar silenciosamente à espera.
          if (sms.senderMsisdn && sms.senderMsisdn.length >= 6) {
            const tail = sms.senderMsisdn.slice(-6);
            const { data: candidates } = await supabaseAdmin
              .from("payment_intents")
              .select("id, status, customer_msisdn_hint")
              .eq("status", "PENDING")
              .gt("expires_at", new Date().toISOString())
              .like("customer_msisdn_hint", `%${tail}`);
            for (const candidate of candidates ?? []) {
              await supabaseAdmin
                .from("payment_intents")
                .update({
                  status: "NEEDS_REVIEW",
                  review_reason: `valor recebido (${sms.amount}) diferente do esperado`,
                })
                .eq("id", candidate.id)
                .eq("status", "PENDING");
              await supabaseAdmin.from("audit_log").insert({
                entity_type: "payment_intent",
                entity_id: candidate.id,
                action: "amount_mismatch",
                from_state: "PENDING",
                to_state: "NEEDS_REVIEW",
                actor: "system_auto",
                metadata: {
                  reason: "transação do mesmo número com valor diferente do esperado",
                  transaction_id: tx.id,
                  received_amount: sms.amount,
                },
              });
            }
            if ((candidates ?? []).length > 0) {
              await supabaseAdmin.from("fraud_signals").insert({
                signal_type: "amount_mismatch",
                severity: "medium",
                related_tx_id: tx.id,
                details: { received_amount: sms.amount, sender_msisdn: sms.senderMsisdn },
              });
            }
          }
          return Response.json({ ok: true, status: "UNMATCHED" });
        }

        if (outcome === "NEEDS_REVIEW") {
          await supabaseAdmin
            .from("raw_sms_events")
            .update({ processing_status: "NEEDS_REVIEW" })
            .eq("id", rawEvent.id);
          return Response.json({ ok: true, status: "NEEDS_REVIEW" });
        }

        if (outcome === "CONFIRMED" && intentId) {
          await supabaseAdmin
            .from("raw_sms_events")
            .update({ processing_status: "MATCHED" })
            .eq("id", rawEvent.id);
          // 5. ATIVAÇÃO
          const { data: activation, error: activationError } = await supabaseAdmin.rpc(
            "djp_activate_intent",
            { _intent_id: intentId, _actor: "system_auto" },
          );
          if (activationError) {
            console.error("[djp] falha na ativação", activationError);
            return Response.json({ ok: true, status: "CONFIRMED_ACTIVATION_FAILED" });
          }
          return Response.json({ ok: true, status: "ACTIVATED", activation });
        }

        return Response.json({ ok: true, status: outcome });
      },
    },
  },
});
