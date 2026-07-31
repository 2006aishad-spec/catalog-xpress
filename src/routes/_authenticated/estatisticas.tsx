import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState, NoStoreState } from "@/components/dashboard-shell";
import { useMyStore } from "@/hooks/use-store-data";
import { planOf } from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/estatisticas")({
  component: StatsPage,
});

function StatsPage() {
  const { data: store, isLoading } = useMyStore();
  const { data } = useQuery({
    queryKey: ["events-detail", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("store_events")
        .select("event_type, device, created_at, product_id")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return events ?? [];
    },
  });

  if (isLoading) {
    return (
      <DashboardShell title="Estatísticas">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Estatísticas">
        <NoStoreState />
      </DashboardShell>
    );
  }

  const events = data ?? [];
  const views = events.filter((e) => e.event_type === "catalog_view");
  const clicks = events.filter((e) => e.event_type === "whatsapp_click");
  const mobile = events.filter((e) => e.device === "mobile").length;
  const rate = views.length ? Math.round((clicks.length / views.length) * 100) : 0;
  const plan = planOf(store.plan);

  return (
    <DashboardShell
      title="Estatísticas"
      description={`Métricas ${plan.analytics.toLowerCase()} do plano ${plan.name} (últimos 1000 eventos).`}
    >
      {events.length === 0 ? (
        <EmptyState
          title="Sem dados ainda"
          text="Assim que partilhares o link do catálogo, começamos a registar visitas e cliques no WhatsApp."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Visitas ao catálogo" value={String(views.length)} />
          <Card label="Cliques no WhatsApp" value={String(clicks.length)} />
          <Card label="Taxa de interesse" value={`${rate}%`} />
          <Card
            label="Visitas por telemóvel"
            value={`${events.length ? Math.round((mobile / events.length) * 100) : 0}%`}
          />
        </div>
      )}
    </DashboardShell>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
