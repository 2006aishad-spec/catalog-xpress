import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, EmptyState } from "@/components/dashboard-shell";
import { formatPrice, whatsappUrl } from "@/lib/store-helpers";
import { adminResolveIntent, getPaymentsAdminData } from "@/lib/djp/payments.functions";

export const Route = createFileRoute("/_authenticated/djumbai-pay")({
  component: PaymentsAdminPage,
  head: () => ({
    meta: [
      { title: "Djumbai Pay | Revisão de pagamentos" },
      {
        name: "description",
        content: "Fila de revisão manual de pagamentos e transações não correspondidas.",
      },
      { property: "og:title", content: "Djumbai Pay | Revisão de pagamentos" },
      { property: "og:description", content: "Confirmação e reconciliação de pagamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PaymentsAdminPage() {
  const fetchData = useServerFn(getPaymentsAdminData);
  const resolve = useServerFn(adminResolveIntent);
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState<Record<string, string>>({});
  const [confirmTwice, setConfirmTwice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["djp-admin"],
    queryFn: () => fetchData(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: { intentId: string; action: "confirm" | "reject"; txId?: string }) =>
      resolve({ data: input }),
    onSuccess: () => {
      toast.success("Pagamento resolvido.");
      setConfirmTwice(null);
      queryClient.invalidateQueries({ queryKey: ["djp-admin"] });
    },
    onError: () => toast.error("Não foi possível resolver este pagamento."),
  });

  if (isLoading) {
    return (
      <DashboardShell title="Djumbai Pay">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (error || !data) {
    return (
      <DashboardShell title="Djumbai Pay">
        <EmptyState title="Acesso restrito" text="Esta área é reservada à equipa Djumbai." />
      </DashboardShell>
    );
  }

  const review = data.needsReview.filter((i) => i.status === "NEEDS_REVIEW");
  const confirmedPending = data.needsReview.filter((i) => i.status === "CONFIRMED");

  return (
    <DashboardShell
      title="Djumbai Pay"
      description="Revisão manual de pagamentos e reconciliação de transações."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Em revisão" value={String(data.totals.pending)} />
        <Stat label="Recibos emitidos" value={String(data.totals.confirmed)} />
        <Stat label="Valor ativado" value={formatPrice(data.totals.activatedAmount, "XOF")} />
      </div>

      <Section
        icon={<ShieldAlert className="h-4 w-4 text-warning" />}
        title="Pedidos em revisão manual"
      >
        {review.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada por revisar. Bom sinal.</p>
        ) : (
          <div className="grid gap-3">
            {review.map((intent) => (
              <div key={intent.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {intent.reference} · {intent.store_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Plano {intent.plan_name} ·{" "}
                      {formatPrice(intent.expected_amount, intent.expected_currency)}
                    </p>
                    <p className="mt-1 text-xs text-warning">{intent.review_reason}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={linking[intent.id] ?? ""}
                      onChange={(event) =>
                        setLinking((prev) => ({ ...prev, [intent.id]: event.target.value }))
                      }
                      className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs"
                    >
                      <option value="">Sem ligar transação</option>
                      {data.unmatched.map((tx) => (
                        <option key={tx.id} value={tx.id}>
                          {tx.provider_transaction_id} · {formatPrice(tx.amount, tx.currency)}
                        </option>
                      ))}
                    </select>
                    {confirmTwice === intent.id ? (
                      <button
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            intentId: intent.id,
                            action: "confirm",
                            txId: linking[intent.id] || undefined,
                          })
                        }
                        className="rounded-xl bg-success px-4 py-2 text-xs font-semibold text-success-foreground"
                      >
                        Confirmar mesmo (ativa o plano)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmTwice(intent.id)}
                        className="rounded-xl border border-success/60 px-4 py-2 text-xs font-semibold text-success"
                      >
                        Confirmar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ intentId: intent.id, action: "reject" })}
                      className="rounded-xl border border-destructive/60 px-4 py-2 text-xs font-semibold text-destructive"
                    >
                      Rejeitar
                    </button>
                    {intent.store_whatsapp ? (
                      <a
                        href={whatsappUrl(
                          intent.store_whatsapp,
                          `Djumbai Pay — sobre o pagamento ${intent.reference} (${formatPrice(intent.expected_amount, intent.expected_currency)}).`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-border px-4 py-2 text-xs"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {confirmedPending.length > 0 ? (
        <Section
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          title="Confirmados a aguardar ativação"
        >
          <div className="grid gap-2 text-sm">
            {confirmedPending.map((intent) => (
              <div key={intent.id} className="flex items-center justify-between gap-3">
                <span>
                  {intent.reference} · {intent.store_name}
                </span>
                <button
                  type="button"
                  onClick={() => mutation.mutate({ intentId: intent.id, action: "confirm" })}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs"
                >
                  Ativar agora
                </button>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        icon={<AlertTriangle className="h-4 w-4 text-primary" />}
        title="Transações sem correspondência"
      >
        {data.unmatched.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transação órfã.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">ID transação</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Remetente</th>
                  <th className="py-2 pr-4">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.unmatched.map((tx) => (
                  <tr key={tx.id} className="border-t border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">{tx.provider_transaction_id}</td>
                    <td className="py-2 pr-4">{formatPrice(tx.amount, tx.currency)}</td>
                    <td className="py-2 pr-4">{tx.sender_msisdn ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {tx.transaction_date ?? "—"} {tx.transaction_time ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {data.parseErrors.length > 0 ? (
        <Section
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          title="SMS que não conseguimos interpretar"
        >
          <div className="grid gap-2">
            {data.parseErrors.map((sms) => (
              <div key={sms.id} className="rounded-xl border border-border/70 p-3 text-xs">
                <p className="text-destructive">{sms.parse_error}</p>
                <p className="mt-1 font-mono text-muted-foreground">{sms.raw_body}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel mt-5 rounded-2xl p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
