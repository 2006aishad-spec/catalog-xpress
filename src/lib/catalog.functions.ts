import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

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

