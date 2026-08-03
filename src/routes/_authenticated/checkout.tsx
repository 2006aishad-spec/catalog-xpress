import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, NoStoreState } from "@/components/dashboard-shell";
import { useMyStore } from "@/hooks/use-store-data";
import { formatPrice, whatsappUrl } from "@/lib/store-helpers";
import {
  createPaymentIntent,
  getPaymentIntent,
  listCheckoutPlans,
} from "@/lib/djp/payments.functions";

const searchSchema = z.object({
  plan: z.string().optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: searchSchema,
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Pagamento do plano | Djumbai Shop" },
      {
        name: "description",
        content:
          "Ativa o teu plano Djumbai Shop com Orange Money: pagamento confirmado automaticamente pelo Djumbai Pay.",
      },
      { property: "og:title", content: "Pagamento do plano | Djumbai Shop" },
      {
        property: "og:description",
        content: "Paga por Orange Money e o teu plano é ativado automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CheckoutPage() {
  const { plan: planParam, ref } = Route.useSearch();
  return ref ? <WaitingScreen reference={ref} /> : <PlanChooser preselected={planParam} />;
}

// --------------------------------------------------------------- escolha
function PlanChooser({ preselected }: { preselected?: string }) {
  const navigate = useNavigate();
  const { data: store, isLoading: loadingStore } = useMyStore();
  const fetchPlans = useServerFn(listCheckoutPlans);
  const createIntent = useServerFn(createPaymentIntent);
  const [selected, setSelected] = useState(preselected ?? "basic");
  const [msisdn, setMsisdn] = useState("");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["checkout-plans"],
    queryFn: () => fetchPlans(),
  });

  const mutation = useMutation({
    mutationFn: (input: { planCode: string; msisdnHint?: string }) =>
      createIntent({ data: input }),
    onSuccess: (result) => {
      navigate({ to: "/checkout", search: { ref: result.reference } });
    },
    onError: () => toast.error("Não foi possível criar o pedido de pagamento."),
  });

  if (loadingStore || isLoading) {
    return (
      <DashboardShell title="Pagamento do plano">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Pagamento do plano">
        <NoStoreState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Pagamento do plano"
      description="Escolhe o plano, paga por Orange Money e a ativação é automática."
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3">
          {(plans ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.code)}
              className={`glass-panel flex items-center justify-between gap-4 rounded-2xl p-5 text-left transition-colors ${
                selected === p.code ? "border-primary/60 bg-primary/5" : ""
              }`}
            >
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {p.billing_period === "monthly" ? "por mês" : p.billing_period}
                </p>
              </div>
              <p className="font-display text-lg font-bold text-primary">
                {formatPrice(Number(p.price_amount), p.price_currency)}
              </p>
            </button>
          ))}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-sm font-semibold">Número que vai pagar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional, mas ajuda-nos a confirmar mais rápido se algo não bater certo.
          </p>
          <input
            value={msisdn}
            onChange={(event) => setMsisdn(event.target.value.replace(/\D/g, "").slice(0, 15))}
            inputMode="numeric"
            placeholder="955000000"
            className="mt-3 w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ planCode: selected, msisdnHint: msisdn })}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gerar referência de pagamento
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            A referência é válida por 60 minutos. Paga exatamente o valor indicado.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}

// ------------------------------------------------------------- espera
function WaitingScreen({ reference }: { reference: string }) {
  const fetchIntent = useServerFn(getPaymentIntent);
  const { data: store } = useMyStore();

  const { data: intent, refetch, isLoading } = useQuery({
    queryKey: ["payment-intent", reference],
    queryFn: () => fetchIntent({ data: { reference } }),
    // Polling de segurança: o Realtime é o caminho rápido, isto é a rede de proteção.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "MATCHED" || status === "CONFIRMED"
        ? 10_000
        : false;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`djp-intent-${reference}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payment_intents",
          filter: `reference=eq.${reference}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reference, refetch]);

  if (isLoading) {
    return (
      <DashboardShell title="Pagamento">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!intent) {
    return (
      <DashboardShell title="Pagamento">
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="font-semibold">Referência não encontrada</p>
          <Link to="/checkout" search={{}} className="mt-4 inline-block text-sm text-primary">
            Criar novo pedido
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const activated = intent.status === "ACTIVATED";
  const review = intent.status === "NEEDS_REVIEW";
  const dead = intent.status === "EXPIRED" || intent.status === "REJECTED";

  return (
    <DashboardShell
      title="Pagamento por Orange Money"
      description={`Plano ${intent.plan_name} — referência ${intent.reference}`}
    >
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-primary" /> Instruções
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              1. Envia{" "}
              <strong className="text-foreground">
                {formatPrice(intent.expected_amount, intent.expected_currency)}
              </strong>{" "}
              por Orange Money para{" "}
              <strong className="text-foreground">{intent.provider_msisdn}</strong>.
            </li>
            <li>
              2. Guarda a referência{" "}
              <strong className="text-foreground">{intent.reference}</strong> — usa-a se falares com
              a nossa equipa.
            </li>
            <li>3. Fica nesta página: o plano ativa sozinho ao receber a confirmação.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(intent.provider_msisdn);
                toast.success("Número copiado.");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm"
            >
              <Copy className="h-4 w-4" /> Copiar número
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(intent.reference);
                toast.success("Referência copiada.");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm"
            >
              <Copy className="h-4 w-4" /> Copiar referência
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Paga o valor exato. Valores diferentes vão para verificação manual e não ativam o plano
            automaticamente.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          {activated ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <p className="mt-3 font-semibold">Pagamento confirmado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Plano {intent.plan_name} ativo
                {intent.receipt_number ? ` — recibo ${intent.receipt_number}` : ""}.
              </p>
              {store?.whatsapp_number ? (
                <a
                  href={whatsappUrl(
                    store.whatsapp_number,
                    `Djumbai Pay — pagamento confirmado.\nReferência: ${intent.reference}\nPlano: ${intent.plan_name}\nValor: ${formatPrice(intent.expected_amount, intent.expected_currency)}${intent.receipt_number ? `\nRecibo: ${intent.receipt_number}` : ""}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-block rounded-xl bg-success px-5 py-3 text-sm font-semibold text-success-foreground"
                >
                  Receber confirmação no WhatsApp
                </a>
              ) : null}
              <Link to="/loja" className="mt-4 block text-sm text-primary">
                Ver o meu plano
              </Link>
            </div>
          ) : review ? (
            <div className="text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
              <p className="mt-3 font-semibold">Em verificação manual</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {intent.review_reason ??
                  "Precisamos de confirmar este pagamento manualmente. A equipa entra em contacto."}
              </p>
            </div>
          ) : dead ? (
            <div className="text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
              <p className="mt-3 font-semibold">
                {intent.status === "EXPIRED" ? "Referência expirada" : "Pedido rejeitado"}
              </p>
              <Link
                to="/checkout"
                search={{}}
                className="mt-4 inline-block text-sm text-primary"
              >
                Criar novo pedido
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-3 font-semibold">A aguardar confirmação...</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Assim que o pagamento chegar, esta página muda sozinha.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Válido até{" "}
                {new Date(intent.expires_at).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
