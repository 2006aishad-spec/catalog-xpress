import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, NoStoreState } from "@/components/dashboard-shell";
import { useMyStore } from "@/hooks/use-store-data";
import { useCreatePlanRequest, useMyPlanRequests, useMyProfile } from "@/hooks/use-plan-requests";
import {
  PAYMENT_STATUS_LABEL,
  PLANS,
  PLAN_ORDER,
  TEAM_WHATSAPP,
  buildPlanRequestMessage,
  formatPrice,
  planOf,
  whatsappUrl,
  type PlanId,
} from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: z.object({ plan: z.enum(["free", "basic", "pro"]).optional() }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan: planParam } = Route.useSearch();
  const navigate = useNavigate();
  const { data: store, isLoading } = useMyStore();
  const { data: profile } = useMyProfile();
  const { data: requests = [] } = useMyPlanRequests(store?.id);
  const createRequest = useCreatePlanRequest();
  const [selected, setSelected] = useState<PlanId>(
    planParam && planParam !== "free" ? planParam : "basic",
  );

  if (isLoading) {
    return (
      <DashboardShell title="Ativar plano">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Ativar plano">
        <NoStoreState />
      </DashboardShell>
    );
  }

  const openRequest = requests.find((r) => r.status === "pending" || r.status === "under_review");
  const plan = PLANS[selected];
  const contactName = profile?.full_name || store.owner_name || "";
  const contactPhone = profile?.phone || store.whatsapp_number || "";

  async function requestPlan() {
    try {
      const created = await createRequest.mutateAsync({
        storeId: store!.id,
        planCode: selected,
        contactName,
        contactPhone,
        currency: store!.currency,
      });
      toast.success("Pedido registado. Agora fala com a equipa no WhatsApp para pagar.");
      const message = buildPlanRequestMessage({
        customerName: contactName,
        storeId: store!.id,
        storeName: store!.name,
        planName: PLANS[selected].name,
        amount: PLANS[selected].priceAmount,
        currency: store!.currency,
        reference: created.reference,
      });
      window.open(whatsappUrl(TEAM_WHATSAPP, message), "_blank", "noopener");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registar o pedido.",
      );
    }
  }

  return (
    <DashboardShell
      title="Ativar plano"
      description="O pagamento é feito com a equipa Djumbai Shop pelo WhatsApp. Depois de confirmarmos, o plano é ativado na tua loja."
      actions={
        <Link
          to="/loja"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary/60"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à loja
        </Link>
      }
    >
      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Como funciona</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          <Step n={1} text="Escolhe o plano que queres ativar." />
          <Step n={2} text="Registamos o teu pedido com uma referência única." />
          <Step
            n={3}
            text={`Falas com a equipa no WhatsApp ${TEAM_WHATSAPP} e combinas o pagamento.`}
          />
          <Step n={4} text="A equipa confirma o pagamento e ativa o plano na tua loja." />
        </ol>
        <p className="mt-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-xs text-muted-foreground">
          Não há pagamento automático dentro da plataforma. A ativação é sempre confirmada por uma
          pessoa da equipa Djumbai Shop.
        </p>
      </section>

      {openRequest ? (
        <section className="glass-panel mt-5 rounded-2xl border border-warning/30 p-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
            <Clock className="h-3.5 w-3.5" /> {PAYMENT_STATUS_LABEL[openRequest.status]}
          </span>
          <h2 className="mt-3 text-lg font-semibold">
            Pedido do plano {planOf(openRequest.plan_code).name}
          </h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <Row label="Referência" value={openRequest.reference} />
            <Row
              label="Valor"
              value={formatPrice(Number(openRequest.amount), openRequest.currency)}
            />
            <Row
              label="Pedido feito em"
              value={new Date(openRequest.created_at).toLocaleString("pt-PT")}
            />
            <Row label="Contacto" value={openRequest.contact_phone || "—"} />
          </dl>
          <a
            href={whatsappUrl(
              TEAM_WHATSAPP,
              buildPlanRequestMessage({
                customerName: openRequest.contact_name,
                storeId: store.id,
                storeName: store.name,
                planName: planOf(openRequest.plan_code).name,
                amount: Number(openRequest.amount),
                currency: openRequest.currency,
                reference: openRequest.reference,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-success-foreground"
          >
            <MessageCircle className="h-4 w-4" /> Continuar no WhatsApp
          </a>
        </section>
      ) : (
        <section className="mt-5 grid gap-4 md:grid-cols-2">
          {PLAN_ORDER.filter((id) => id !== "free").map((id) => {
            const item = PLANS[id];
            const isCurrent = store.plan === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`glass-panel rounded-2xl p-6 text-left transition-colors ${
                  selected === id ? "border-primary/60 ring-1 ring-primary/40" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{item.name}</h3>
                  {isCurrent ? (
                    <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                      Plano atual
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {item.price} <span className="text-sm font-medium text-muted-foreground">XOF / mês</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {feature}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </section>
      )}

      {!openRequest ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={requestPlan}
            disabled={createRequest.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-3.5 text-sm font-semibold text-success-foreground disabled:opacity-60"
          >
            {createRequest.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}{" "}
            Pedir plano {plan.name} ({formatPrice(plan.priceAmount, store.currency)})
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/loja" })}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3.5 text-sm font-medium hover:bg-secondary/60"
          >
            Continuar no plano Grátis
          </button>
        </div>
      ) : null}

      {requests.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Histórico de pedidos</h2>
          <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-surface/40 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {planOf(request.plan_code).name} ·{" "}
                    {formatPrice(Number(request.amount), request.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.reference} · {new Date(request.created_at).toLocaleDateString("pt-PT")}
                    {request.admin_note ? ` · ${request.admin_note}` : ""}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    under_review: "bg-primary/15 text-primary",
    active: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
  };
  const Icon = status === "active" ? BadgeCheck : status === "rejected" ? XCircle : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-secondary text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {PAYMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {n}
      </span>
      {text}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
