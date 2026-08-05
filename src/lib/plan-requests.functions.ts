import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanRequestRow = {
  id: string;
  store_id: string;
  user_id: string;
  plan_code: string;
  amount: number;
  currency: string;
  reference: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  store_name: string;
  store_slug: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (isAdmin !== true) throw new Error("Forbidden");
}

/** Lista todos os pedidos de plano (pagamento manual) para a equipa. */
export const adminListPlanRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanRequestRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: requests }, { data: stores }] = await Promise.all([
      supabaseAdmin
        .from("plan_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin.from("stores").select("id, name, slug"),
    ]);
    const byId = new Map((stores ?? []).map((s) => [s.id, s]));
    return (requests ?? []).map((r) => ({
      ...r,
      store_name: byId.get(r.store_id)?.name ?? "—",
      store_slug: byId.get(r.store_id)?.slug ?? "",
    })) as PlanRequestRow[];
  });

/**
 * Resolve um pedido manual.
 * - under_review: a equipa está a verificar o pagamento.
 * - active: confirma o pagamento e ativa o plano na loja.
 * - rejected: recusa (a loja mantém o plano atual).
 */
export const adminResolvePlanRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string; status: string; note?: string }) => {
    if (!["under_review", "active", "rejected"].includes(data.status)) {
      throw new Error("Estado inválido.");
    }
    return {
      requestId: String(data.requestId).slice(0, 40),
      status: data.status,
      note: (data.note ?? "").slice(0, 400),
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request, error: readError } = await supabaseAdmin
      .from("plan_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (readError) throw readError;
    if (!request) throw new Error("Pedido não encontrado.");

    const { error } = await supabaseAdmin
      .from("plan_requests")
      .update({
        status: data.status,
        admin_note: data.note || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.requestId);
    if (error) throw error;

    if (data.status === "active") {
      const { error: storeError } = await supabaseAdmin
        .from("stores")
        .update({ plan: request.plan_code })
        .eq("id", request.store_id);
      if (storeError) throw storeError;
    }

    await supabaseAdmin.from("audit_log").insert({
      entity_type: "plan_request",
      entity_id: data.requestId,
      action: "admin_resolve",
      from_state: request.status,
      to_state: data.status,
      actor: context.userId,
      metadata: { plan_code: request.plan_code, store_id: request.store_id, note: data.note },
    });

    return { ok: true };
  });
