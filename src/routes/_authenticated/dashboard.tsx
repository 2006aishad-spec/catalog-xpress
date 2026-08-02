import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  Rocket,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState, NoStoreState } from "@/components/dashboard-shell";
import {
  useCategories,
  useMyStore,
  useOrders,
  useProducts,
  useStoreStats,
} from "@/hooks/use-store-data";
import { formatPrice, planOf } from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useMyStore();
  const { data: products = [] } = useProducts(store?.id);
  const { data: categories = [] } = useCategories(store?.id);
  const { data: orders = [] } = useOrders(store?.id);
  const { data: stats } = useStoreStats(store?.id);

  if (isLoading) {
    return (
      <DashboardShell title="Visão geral">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }

  if (!store) {
    return (
      <DashboardShell title="Visão geral">
        <NoStoreState />
      </DashboardShell>
    );
  }

  const plan = planOf(store.plan);
  const publicPath = `/loja/${store.slug}`;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;
  const activeProducts = products.filter((p) => p.is_active).length;
  const published = store.status === "published";

  const checklist = [
    { done: true, label: "Loja criada" },
    { done: !!store.whatsapp_number, label: "Número de WhatsApp configurado" },
    { done: products.length > 0, label: "Primeiro produto adicionado" },
    { done: categories.length > 0, label: "Pelo menos uma categoria" },
    { done: published, label: "Catálogo publicado" },
  ];

  async function publish() {
    const nextStatus = published ? "draft" : "published";
    const { error } = await supabase
      .from("stores")
      .update({ status: nextStatus })
      .eq("id", store!.id);
    if (error) {
      toast.error("Não foi possível atualizar o estado da loja.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
    if (nextStatus === "draft") {
      toast.success("Catálogo passou a rascunho.");
      return;
    }
    // Verificação real: confirmar que o catálogo público carrega de facto.
    try {
      const catalog = await verifyCatalog({ data: { slug: store!.slug } });
      if (catalog?.store) {
        toast.success("Catálogo publicado e acessível!");
      } else {
        toast.error("Publicação incompleta — o catálogo ainda não está acessível.");
      }
    } catch {
      toast.error("Publicação incompleta — o catálogo ainda não está acessível.");
    }
  }


  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  }

  return (
    <DashboardShell
      title={store.name}
      description={published ? "Catálogo publicado e pronto a partilhar." : "Catálogo em rascunho — publica para começar a vender."}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/produtos"
            className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground"
          >
            <Plus className="h-4 w-4" /> Adicionar produto
          </Link>
          <button
            type="button"
            onClick={publish}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary/60"
          >
            <Rocket className="h-4 w-4" /> {published ? "Voltar a rascunho" : "Publicar catálogo"}
          </button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                published
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              }`}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> {published ? "Publicado" : "Rascunho"}
            </span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              Plano {plan.name}
            </span>
          </div>
          <p className="mt-4 break-all rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm">
            {publicUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary/60"
            >
              <Copy className="h-4 w-4" /> Copiar link
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Vê o catálogo da ${store.name}: ${publicUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary/60"
            >
              <Share2 className="h-4 w-4" /> Partilhar no WhatsApp
            </a>
            <Link
              to="/loja/$slug"
              params={{ slug: store.slug }}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary/60"
            >
              <ExternalLink className="h-4 w-4" /> Ver catálogo
            </Link>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric icon={Package} label="Produtos ativos" value={`${activeProducts}`} />
            <Metric icon={Eye} label="Visitas" value={`${stats?.views ?? 0}`} />
            <Metric icon={MessageCircle} label="Cliques WhatsApp" value={`${stats?.clicks ?? 0}`} />
            <Metric icon={Rocket} label="Pedidos" value={`${orders.length}`} />
          </dl>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Checklist da loja</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    item.done ? "bg-success/20 text-success" : "border border-border text-muted-foreground"
                  }`}
                >
                  {item.done ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-5">
        <h2 className="text-lg font-semibold">Pedidos recentes</h2>
        <div className="mt-4">
          {orders.length === 0 ? (
            <EmptyState
              title="Sem pedidos ainda"
              text="Quando um cliente pedir um produto pelo catálogo, o pedido aparece aqui com nome e contacto."
            />
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border">
              {orders.slice(0, 5).map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer_name || "Cliente"} · {order.customer_phone || "sem contacto"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString("pt-PT")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Plano {plan.name}: até {Number.isFinite(plan.maxProducts) ? plan.maxProducts : "produtos ilimitados"}{" "}
        {Number.isFinite(plan.maxProducts) ? "produtos" : ""} · preços em {store.currency} (ex.:{" "}
        {formatPrice(15000, store.currency)}).
      </p>
    </DashboardShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <Icon className="h-4 w-4 text-primary" />
      <dt className="mt-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}
