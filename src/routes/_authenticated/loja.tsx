import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, NoStoreState } from "@/components/dashboard-shell";
import { useMyStore } from "@/hooks/use-store-data";
import { PLANS, limitLabel, onlyDigits, planOf } from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/loja")({
  component: StoreSettingsPage,
});

function StoreSettingsPage() {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useMyStore();
  const [saving, setSaving] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);


  if (isLoading) {
    return (
      <DashboardShell title="Loja e plano">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Loja e plano">
        <NoStoreState />
      </DashboardShell>
    );
  }

  const plan = planOf(store.plan);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const { error } = await supabase
      .from("stores")
      .update({
        name: String(form.get("name") ?? "").slice(0, 80),
        tagline: String(form.get("tagline") ?? "").slice(0, 140),
        description: String(form.get("description") ?? "").slice(0, 600),
        location: String(form.get("location") ?? "").slice(0, 120),
        whatsapp_number: onlyDigits(String(form.get("whatsapp") ?? "")),
        currency: String(form.get("currency") ?? "XOF").slice(0, 6),
        primary_color: String(form.get("color") ?? "#22d3ee"),
      })
      .eq("id", store!.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível guardar as alterações.");
      return;
    }
    toast.success("Loja atualizada.");
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
  }

  async function changePlan(planId: string) {
    // Planos pagos NÃO são ativados automaticamente — só a equipa confirma após pagamento.
    if (planId !== "free") {
      setPendingPlan(planId);
      return;
    }
    const { error } = await supabase.from("stores").update({ plan: "free" }).eq("id", store!.id);
    if (error) {
      toast.error("Não foi possível mudar de plano.");
      return;
    }
    toast.success("Voltaste ao plano Grátis.");
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
  }


  return (
    <DashboardShell
      title="Loja e plano"
      description="Personaliza a informação pública do catálogo e escolhe o teu plano."
    >
      <form onSubmit={save} className="glass-panel grid gap-4 rounded-2xl p-6 sm:grid-cols-2">
        <Field label="Nome da loja" className="sm:col-span-2">
          <input name="name" defaultValue={store.name} required maxLength={80} className={input} />
        </Field>
        <Field label="Frase da loja" className="sm:col-span-2">
          <input name="tagline" defaultValue={store.tagline} maxLength={140} className={input} />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <textarea
            name="description"
            defaultValue={store.description}
            rows={3}
            maxLength={600}
            className={input}
          />
        </Field>
        <Field label="WhatsApp (com indicativo)">
          <input
            name="whatsapp"
            defaultValue={store.whatsapp_number}
            required
            className={input}
          />
        </Field>
        <Field label="Localização">
          <input name="location" defaultValue={store.location} maxLength={120} className={input} />
        </Field>
        <Field label="Moeda">
          <input name="currency" defaultValue={store.currency} maxLength={6} className={input} />
        </Field>
        <Field label="Cor principal">
          <input
            type="color"
            name="color"
            defaultValue={store.primary_color}
            className="h-12 w-full rounded-xl border border-input bg-surface/60 px-2"
          />
        </Field>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-success-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar alterações
          </button>
        </div>
      </form>

      <h2 className="mt-10 text-xl font-bold">Plano da loja</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Plano atual: <span className="text-foreground">{plan.name}</span>. Os planos pagos são
        ativados pela nossa equipa após confirmação do pagamento.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {Object.values(PLANS).map((item) => (
          <article
            key={item.id}
            className={`rounded-2xl p-6 ${
              item.id === plan.id ? "glass-panel glow-ring" : "border border-border bg-surface/40"
            }`}
          >
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <p className="mt-1 font-display text-3xl font-bold">
              {item.price}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {store.currency} · {item.note}
              </span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success" /> {limitLabel(item.maxProducts)}{" "}
                produtos
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success" /> {limitLabel(item.maxCategories)}{" "}
                categorias
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success" /> Estatísticas {item.analytics.toLowerCase()}
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success" /> {item.branding}
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success" /> Suporte {item.support.toLowerCase()}
              </li>
            </ul>
            <button
              type="button"
              disabled={item.id === plan.id}
              onClick={() => changePlan(item.id)}
              className="mt-5 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {item.id === plan.id
                ? "Plano atual"
                : item.id === "free"
                  ? "Voltar ao Grátis"
                  : `Pedir ${item.name}`}
            </button>
          </article>
        ))}
      </div>

      {pendingPlan ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="text-lg font-semibold">Pedido de plano {planOf(pendingPlan).name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              O teu pedido fica <span className="text-warning">pendente de confirmação da nossa
              equipa</span>. A loja mantém-se no plano atual até o pagamento ser confirmado
              manualmente — nada é cobrado nem ativado automaticamente.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Fala com a equipa Djumbai para combinar o pagamento e ativar o plano.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/245955209731?text=${encodeURIComponent(
                  `Olá Djumbai Shop! Quero o plano ${planOf(pendingPlan).name} para a loja ${store.name} (${store.slug}).`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground"
              >
                Falar no WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setPendingPlan(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>

  );
}

const input =
  "w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
