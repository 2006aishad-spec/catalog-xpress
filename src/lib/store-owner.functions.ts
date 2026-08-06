import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verificação de propriedade feita no servidor: o cliente nunca decide se é dono.
 * Devolve false para visitantes (o pedido falha na autenticação e é tratado como visitante).
 */
export const amIOwnerOfStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) return { isOwner: false };
    return { isOwner: !!row };
  });
