import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

export async function signedImageUrl(path?: string | null) {
  if (!path) return null;
  if (cache.has(path)) return cache.get(path)!;
  const { data } = await supabase.storage.from("produtos").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (data?.signedUrl) cache.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}

export async function uploadProductImage(file: File, userId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("produtos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
