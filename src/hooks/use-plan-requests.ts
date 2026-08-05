import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { currentUserId } from "@/hooks/use-store-data";
import { PLANS, type PlanId } from "@/lib/store-helpers";

export type PlanRequest = Tables<"plan_requests">;
export type Profile = Tables<"profiles">;

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async (): Promise<Profile | null> => {
      const uid = await currentUserId();
      if (!uid) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMyPlanRequests(storeId?: string) {
  return useQuery({
    queryKey: ["plan-requests", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<PlanRequest[]> => {
      const { data, error } = await supabase
        .from("plan_requests")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function buildReference() {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `DJ-${stamp}-${random}`;
}

/** Cria um pedido de plano com pagamento manual (equipa confirma no WhatsApp). */
export function useCreatePlanRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      planCode: PlanId;
      contactName: string;
      contactPhone: string;
      currency: string;
    }) => {
      const uid = await currentUserId();
      if (!uid) throw new Error("Sessão expirada. Entra outra vez.");
      const plan = PLANS[input.planCode];
      const reference = buildReference();
      const { data, error } = await supabase
        .from("plan_requests")
        .insert({
          store_id: input.storeId,
          user_id: uid,
          plan_code: input.planCode,
          amount: plan.priceAmount,
          currency: input.currency,
          reference,
          contact_name: input.contactName.slice(0, 80),
          contact_phone: input.contactPhone.slice(0, 20),
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan-requests", variables.storeId] });
    },
  });
}
