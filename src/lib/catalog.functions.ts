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

    const { data: store, error: storeError } = await client
      .from("stores")
      .select(
        "id, name, slug, tagline, description, category, location, currency, whatsapp_number, primary_color, logo_url, banner_url, plan",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (storeError) {
      console.error("[catalog] store lookup failed", { slug: data.slug, error: storeError });
      return null;
    }
    if (!store) return null;

    let categories: { id: string; name: string }[] = [];
    let rawProducts: Record<string, unknown>[] = [];
    try {
      const [catRes, prodRes] = await Promise.all([
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
      if (catRes.error)
        console.error("[catalog] categories failed", { slug: data.slug, error: catRes.error });
      if (prodRes.error)
        console.error("[catalog] products failed", { slug: data.slug, error: prodRes.error });
      categories = catRes.data ?? [];
      rawProducts = (prodRes.data ?? []) as Record<string, unknown>[];
    } catch (error) {
      // Falha de leitura não deve derrubar a loja: mostramos o cabeçalho da loja.
      console.error("[catalog] unexpected read failure", { slug: data.slug, error });
    }

    // Storage é uma dependência independente: se falhar, o catálogo carrega sem fotos.
    const signed = new Map<string, string>();
    const storeAssetPaths = [store.logo_url, store.banner_url].filter(
      (path): path is string =>
        typeof path === "string" && path.length > 0 && !path.startsWith("http"),
    );
    const paths = [
      ...storeAssetPaths,
      ...rawProducts
        .map((p) => p["image_url"])
        .filter((p): p is string => typeof p === "string" && p.length > 0 && !p.startsWith("http")),
    ];
    if (paths.length) {
      try {
        const { data: urls, error } = await client.storage
          .from("produtos")
          .createSignedUrls(paths, 60 * 60 * 24 * 30);
        if (error) console.error("[catalog] createSignedUrls failed", { slug: data.slug, error });
        urls?.forEach((entry) => {
          // Entradas com erro parcial são ignoradas; as válidas continuam a ser usadas.
          if (entry.error) {
            console.error("[catalog] signed url entry failed", {
              path: entry.path,
              error: entry.error,
            });
            return;
          }
          if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
        });
      } catch (error) {
        console.error("[catalog] storage unavailable", { slug: data.slug, error });
      }
    }

    return {
      store: {
        ...(store as PublicStore),
        logo_url:
          typeof store.logo_url === "string" && store.logo_url.startsWith("http")
            ? store.logo_url
            : store.logo_url
              ? (signed.get(store.logo_url) ?? null)
              : null,
        banner_url:
          typeof store.banner_url === "string" && store.banner_url.startsWith("http")
            ? store.banner_url
            : store.banner_url
              ? (signed.get(store.banner_url) ?? null)
              : null,
      },
      categories,
      products: rawProducts.map((p) => {
        const path = typeof p["image_url"] === "string" ? (p["image_url"] as string) : null;
        return {
          ...p,
          image_url: path ? (signed.get(path) ?? null) : null,
          price: Number(p["price"] ?? 0),
          sale_price:
            p["sale_price"] === null || p["sale_price"] === undefined
              ? null
              : Number(p["sale_price"]),
        };
      }) as PublicProduct[],
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
    const { error } = await publicClient().from("orders").insert({
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
