import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Store = Tables<"stores">;
export type Product = Tables<"products">;
export type Category = Tables<"categories">;
export type Order = Tables<"orders">;

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useMyStore() {
  return useQuery({
    queryKey: ["my-store"],
    queryFn: async (): Promise<Store | null> => {
      const uid = await currentUserId();
      if (!uid) return null;
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProducts(storeId?: string) {
  return useQuery({
    queryKey: ["products", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCategories(storeId?: string) {
  return useQuery({
    queryKey: ["categories", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", storeId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrders(storeId?: string) {
  return useQuery({
    queryKey: ["orders", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStoreStats(storeId?: string) {
  return useQuery({
    queryKey: ["store-stats", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_events")
        .select("event_type, created_at")
        .eq("store_id", storeId!)
        .limit(1000);
      if (error) throw error;
      const rows = data ?? [];
      return {
        views: rows.filter((r) => r.event_type === "catalog_view").length,
        clicks: rows.filter((r) => r.event_type === "whatsapp_click").length,
      };
    },
  });
}
