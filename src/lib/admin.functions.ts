import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStoreRow = {
  id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  category: string;
  location: string;
  plan: string;
  status: string;
  whatsapp_number: string;
  created_at: string;
  products: number;
  orders: number;
  views: number;
  clicks: number;
};

export type AdminOverview = {
  totals: {
    stores: number;
    published: number;
    products: number;
    orders: number;
    views: number;
    clicks: number;
    paid: number;
  };
  stores: AdminStoreRow[];
};

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return data === true;
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [stores, products, orders, events] = await Promise.all([
      supabaseAdmin
        .from("stores")
        .select(
          "id, name, slug, owner_name, category, location, plan, status, whatsapp_number, created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("products").select("store_id"),
      supabaseAdmin.from("orders").select("store_id"),
      supabaseAdmin.from("store_events").select("store_id, event_type"),
    ]);

    const count = (rows: { store_id: string }[] | null, id: string) =>
      (rows ?? []).filter((r) => r.store_id === id).length;

    const rows: AdminStoreRow[] = (stores.data ?? []).map((s) => ({
      ...s,
      products: count(products.data, s.id),
      orders: count(orders.data, s.id),
      views: (events.data ?? []).filter(
        (e) => e.store_id === s.id && e.event_type === "catalog_view",
      ).length,
      clicks: (events.data ?? []).filter(
        (e) => e.store_id === s.id && e.event_type === "whatsapp_click",
      ).length,
    }));

    return {
      totals: {
        stores: rows.length,
        published: rows.filter((r) => r.status === "published").length,
        products: (products.data ?? []).length,
        orders: (orders.data ?? []).length,
        views: (events.data ?? []).filter((e) => e.event_type === "catalog_view").length,
        clicks: (events.data ?? []).filter((e) => e.event_type === "whatsapp_click").length,
        paid: rows.filter((r) => r.plan !== "trial" && r.plan !== "free").length,
      },
      stores: rows,
    };
  });

export const adminUpdateStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string; plan?: string; status?: string }) => ({
    storeId: String(data.storeId).slice(0, 40),
    plan: data.plan && ["trial", "essential", "pro"].includes(data.plan) ? data.plan : undefined,
    status:
      data.status && ["draft", "published", "suspended"].includes(data.status)
        ? data.status
        : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { plan?: string; status?: string } = {};
    if (data.plan) patch.plan = data.plan;
    if (data.status) patch.status = data.status;
    if (!data.plan && !data.status) return { ok: false };
    const { error } = await supabaseAdmin.from("stores").update(patch).eq("id", data.storeId);
    if (error) throw error;
    return { ok: true };
  });
