import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BadgeCheck, Clock, Loader2, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, EmptyState } from "@/components/dashboard-shell";
import { adminListPlanRequests, adminResolvePlanRequest } from "@/lib/plan-requests.functions";
import {
  PAYMENT_STATUS_LABEL,
  formatPrice,
  planOf,
  whatsappUrl,
} from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  component: PaymentsAdminPage,
});

function PaymentsAdminPage() {
  const queryClient = useQueryClient();
  const list = useServerFn(adminListPlanRequests);
  const resolve = useServerFn(adminResolvePlanRequest);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ["admin-plan-requests"],
    queryFn: () => list(),
    retry: false,
  });

  async function act(requestId: string, status: string) {
    const note =
      status === "rejected"
        ? (prompt("Motivo da recusa (opcional):") ?? "")
        : status === "active"
          ? (prompt("Nota da confirmação (opcional):") ?? "")
          : "";
    setBusy(requestId);
    try {
      await resolve({ data: { requestId, status, note } });
      toast.success(
        status === "active"
          ? "Plano ativado na loja."
          : status === "rejected"
            ? "Pedido recusado."
            : "Pedido marcado como em análise.",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-plan-requests"] });
    } catch {
      toast.error("Não foi possível atualizar o pedido.");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell title="Pagamentos manuais">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (error) {
    return (
      <DashboardShell title="Pagamentos manuais">
        <EmptyState title="Acesso restrito" text="Esta área é apenas para a equipa Djumbai Shop." />
      </DashboardShell>
    );
  }

  const rows = requests ?? [];

  return (
    <DashboardShell
      title="Pagamentos manuais"
      description="Pedidos de plano feitos pelos lojistas. Confirma o pagamento por WhatsApp antes de ativar."
    >
      {rows.length === 0 ? (
        <EmptyState title="Sem pedidos" text="Os pedidos de plano aparecem aqui quando um lojista pede um upgrade." />
      ) : (
        <ul className="space-y-3">
          {rows.map((request) => (
            <li key={request.id} className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {request.store_name} · plano {planOf(request.plan_code).name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.reference} · {formatPrice(Number(request.amount), request.currency)} ·{" "}
                    {new Date(request.created_at).toLocaleString("pt-PT")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.contact_name || "—"} · {request.contact_phone || "sem contacto"}
                  </p>
                  {request.admin_note ? (
                    <p className="mt-1 text-xs text-muted-foreground">Nota: {request.admin_note}</p>
                  ) : null}
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    request.status === "active"
                      ? "bg-success/15 text-success"
                      : request.status === "rejected"
                        ? "bg-destructive/15 text-destructive"
                        : request.status === "under_review"
                          ? "bg-primary/15 text-primary"
                          : "bg-warning/15 text-warning"
                  }`}
                >
                  {request.status === "active" ? (
                    <BadgeCheck className="h-3.5 w-3.5" />
                  ) : request.status === "rejected" ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  {PAYMENT_STATUS_LABEL[request.status] ?? request.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {request.contact_phone ? (
                  <a
                    href={whatsappUrl(
                      request.contact_phone,
                      `Olá ${request.contact_name || ""}! Sobre o pedido ${request.reference} do plano ${planOf(request.plan_code).name} no Djumbai Shop.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60"
                  >
                    <MessageCircle className="h-4 w-4" /> Contactar lojista
                  </a>
                ) : null}
                {request.status !== "active" ? (
                  <>
                    {request.status === "pending" ? (
                      <button
                        type="button"
                        disabled={busy === request.id}
                        onClick={() => act(request.id, "under_review")}
                        className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60 disabled:opacity-60"
                      >
                        Marcar em análise
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === request.id}
                      onClick={() => act(request.id, "active")}
                      className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-60"
                    >
                      Confirmar pagamento e ativar
                    </button>
                    <button
                      type="button"
                      disabled={busy === request.id}
                      onClick={() => act(request.id, "rejected")}
                      className="rounded-xl border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      Recusar
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
