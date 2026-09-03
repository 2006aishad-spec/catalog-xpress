import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Loader2, ShieldCheck, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, EmptyState } from "@/components/dashboard-shell";
import { adminUpdateStore, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const updateStore = useServerFn(adminUpdateStore);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: { storeId: string; plan?: string; status?: string }) =>
      updateStore({ data: input }),
    onSuccess: () => {
      toast.success("Loja atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => toast.error("Não foi possível atualizar a loja."),
  });

  if (isLoading) {
    return (
      <DashboardShell title="Administração" description="A carregar dados da plataforma...">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell title="Administração" description="Área reservada à equipa Djumbai Shop.">
        <EmptyState
          title="Sem permissão"
          text="Esta área é exclusiva para administradores da plataforma."
          action={
            <Link
              to="/dashboard"
              className="rounded-xl border border-border px-5 py-3 text-sm font-semibold"
            >
              Voltar ao painel
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  const t = data.totals;
  const cards = [
    ["Lojas", t.stores],
    ["Publicadas", t.published],
    ["Planos pagos", t.paid],
    ["Produtos", t.products],
    ["Pedidos", t.orders],
    ["Visitas", t.views],
    ["Cliques WhatsApp", t.clicks],
    ["Conversão", t.views ? `${Math.round((t.clicks / t.views) * 100)}%` : "—"],
  ] as const;

  return (
    <DashboardShell
      title="Administração da plataforma"
      description="Visão global de todas as lojas, planos e atividade."
      actions={
        <span className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          <ShieldCheck className="h-4 w-4" /> Super admin
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="glass-panel rounded-2xl p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
        <StoreIcon className="h-4 w-4 text-primary" /> Lojas ({data.stores.length})
      </h2>

      {data.stores.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Sem lojas ainda" text="Assim que alguém criar uma loja, aparece aqui." />
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {data.stores.map((store) => (
            <article key={store.id} className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{store.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    /loja/{store.slug} · {store.category} · {store.location || "Sem localização"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {store.owner_name ?? "Lojista"} · WhatsApp {store.whatsapp_number || "—"} ·
                    criada em {new Date(store.created_at).toLocaleDateString("pt-PT")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    store.status === "published"
                      ? "bg-success/15 text-success"
                      : store.status === "suspended"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {store.status === "published"
                    ? "Publicada"
                    : store.status === "suspended"
                      ? "Suspensa"
                      : "Rascunho"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" /> {store.views} visitas · {store.clicks}{" "}
                  cliques
                </span>
                <span>{store.products} produtos</span>
                <span>{store.orders} pedidos</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="text-xs text-muted-foreground">
                  Plano
                  <select
                    value={store.plan}
                    onChange={(e) =>
                      mutation.mutate({ storeId: store.id, plan: e.target.value })
                    }
                    className="ml-2 rounded-lg border border-input bg-surface/60 px-3 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="trial">Teste (14 dias)</option>
                    <option value="essential">Essencial</option>
                    <option value="pro">Profissional</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Estado
                  <select
                    value={store.status}
                    onChange={(e) =>
                      mutation.mutate({ storeId: store.id, status: e.target.value })
                    }
                    className="ml-2 rounded-lg border border-input bg-surface/60 px-3 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicada</option>
                    <option value="suspended">Suspensa</option>
                  </select>
                </label>
                <Link
                  to="/loja/$slug"
                  params={{ slug: store.slug }}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary/60"
                >
                  Ver catálogo
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
