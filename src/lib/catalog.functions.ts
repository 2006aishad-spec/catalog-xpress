import { createServerFn } from "@tanstack/react-start";

export type PublicStore = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  location: string;
  currency: string;
  whatsapp_number: string;
  primary_color: string;
  logo_url: string | null;
  banner_url: string | null;
  plan: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  stock: number | null;
  sku: string | null;
  sizes: string[];
  colors: string[];
  is_featured: boolean;
  category_id: string | null;
};

export type PublicCatalog = {
  store: PublicStore;
  categories: { id: string; name: string }[];
  products: PublicProduct[];
} | null;

export const getPublicCatalog = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data.slug).slice(0, 60) }))
  .handler(async ({ data }): Promise<PublicCatalog> => {
    const { publicClient } = await import("./supabase-public.server");
    const client = publicClient();

    const { data: store } = await client
      .from("stores")
      .select(
        "id, name, slug, tagline, description, category, location, currency, whatsapp_number, primary_color, logo_url, banner_url, plan",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (!store) return null;

    const [{ data: categories }, { data: products }] = await Promise.all([
      client
        .from("categories")
        .select("id, name")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      client
        .from("products")
        .select(
          "id, name, description, price, sale_price, image_url, stock, sku, sizes, colors, is_featured, category_id",
        )
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const rawProducts = products ?? [];
    const paths = rawProducts.map((p) => p.image_url).filter((p): p is string => !!p);
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await client.storage
        .from("produtos")
        .createSignedUrls(paths, 60 * 60 * 24 * 30);
      urls?.forEach((entry) => {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
      });
    }

    return {
      store: store as PublicStore,
      categories: categories ?? [],
      products: rawProducts.map((p) => ({
        ...p,
        image_url: p.image_url ? (signed.get(p.image_url) ?? null) : null,
        price: Number(p.price),
        sale_price: p.sale_price === null ? null : Number(p.sale_price),
      })) as PublicProduct[],
    };
  });

export const logStoreEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      storeId: string;
      eventType: "catalog_view" | "whatsapp_click" | "product_view";
      productId?: string | null;
      device?: string;
    }) => ({
      storeId: String(data.storeId).slice(0, 40),
      eventType: data.eventType,
      productId: data.productId ? String(data.productId).slice(0, 40) : null,
      device: (data.device ?? "unknown").slice(0, 20),
    }),
  )
  .handler(async ({ data }) => {
    const { publicClient } = await import("./supabase-public.server");
    const allowed = ["catalog_view", "whatsapp_click", "product_view"];
    if (!allowed.includes(data.eventType)) return { ok: false };
    await publicClient().from("store_events").insert({
      store_id: data.storeId,
      product_id: data.productId,
      event_type: data.eventType,
      device: data.device,
      source: "catalog",
    });
    return { ok: true };
  });

export const createOrderLead = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      storeId: string;
      productId?: string | null;
      productName: string;
      customerName?: string;
      customerPhone?: string;
      quantity?: number;
      variant?: string;
      notes?: string;
    }) => ({
      storeId: String(data.storeId).slice(0, 40),
      productId: data.productId ? String(data.productId).slice(0, 40) : null,
      productName: String(data.productName).slice(0, 160),
      customerName: String(data.customerName ?? "Cliente do catálogo").slice(0, 120),
      customerPhone: String(data.customerPhone ?? "").slice(0, 40),
      quantity: Math.min(Math.max(Number(data.quantity ?? 1) || 1, 1), 999),
      variant: data.variant ? String(data.variant).slice(0, 120) : null,
      notes: data.notes ? String(data.notes).slice(0, 800) : null,
    }),
  )
  .handler(async ({ data }) => {
    const { publicClient } = await import("./supabase-public.server");
    const { error } = await publicClient()
      .from("orders")
      .insert({
        store_id: data.storeId,
        product_id: data.productId,
        product_name: data.productName,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        quantity: data.quantity,
        variant: data.variant,
        notes: data.notes,
      });
    return { ok: !error };
  });
