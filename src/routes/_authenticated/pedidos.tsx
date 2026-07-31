import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState, NoStoreState } from "@/components/dashboard-shell";
import { useMyStore, useOrders } from "@/hooks/use-store-data";
import { onlyDigits } from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: OrdersPage,
});

const statuses = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contactado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

function OrdersPage() {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useMyStore();
  const { data: orders = [] } = useOrders(store?.id);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar o pedido.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["orders", store?.id] });
  }

  async function remove(id: string) {
    if (!confirm("Eliminar este pedido?")) return;
    await supabase.from("orders").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["orders", store?.id] });
  }

  if (isLoading) {
    return (
      <DashboardShell title="Pedidos">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Pedidos">
        <NoStoreState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Pedidos"
      description="Cada pedido enviado pelo catálogo aparece aqui, mesmo que a conversa continue no WhatsApp."
    >
      {orders.length === 0 ? (
        <EmptyState
          title="Sem pedidos ainda"
          text="Publica o catálogo e partilha o link. Quando um cliente pedir um produto, o contacto fica registado aqui."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{order.product_name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.customer_name || "Cliente"} · {order.customer_phone || "sem contacto"} ·{" "}
                    {new Date(order.created_at).toLocaleString("pt-PT")}
                  </p>
                  {order.variant ? (
                    <p className="mt-1 text-xs text-muted-foreground">Opções: {order.variant}</p>
                  ) : null}
                  {order.notes ? (
                    <p className="mt-2 rounded-xl border border-border bg-surface/40 px-3 py-2 text-xs">
                      {order.notes}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quantidade: {order.quantity}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="rounded-xl border border-input bg-surface/60 px-3 py-2 text-xs outline-none"
                  >
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  {order.customer_phone ? (
                    <a
                      href={`https://wa.me/${onlyDigits(order.customer_phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Responder no WhatsApp"
                      className="rounded-lg border border-border p-2 text-success hover:bg-secondary/60"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(order.id)}
                    aria-label="Eliminar pedido"
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
