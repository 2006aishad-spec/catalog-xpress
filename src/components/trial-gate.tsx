import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, X } from "lucide-react";
import { useMyStore } from "@/hooks/use-store-data";
import { PLANS, PAID_PLANS, isTrialExpired, trialDaysLeft } from "@/lib/store-helpers";

export const TRIAL_OVER_MESSAGE =
  "O teu período de teste de 14 dias terminou. Faz upgrade para continuar a gerir a tua loja.";

/** Estado do teste da loja do lojista autenticado. */
export function useTrialStatus() {
  const { data: store } = useMyStore();
  return {
    store,
    locked: isTrialExpired(store),
    onTrial: !!store && store.plan === "trial",
    daysLeft: trialDaysLeft(store?.trial_ends_at),
  };
}

/**
 * Bloqueio de edição após o teste: o catálogo público continua a funcionar,
 * mas qualquer ação de escrita abre o ecrã de upgrade obrigatório.
 */
export function useUpgradeGuard() {
  const { locked, onTrial, daysLeft } = useTrialStatus();
  const [open, setOpen] = useState(false);

  /** Devolve true quando a ação pode continuar. */
  function allow() {
    if (locked) {
      setOpen(true);
      return false;
    }
    return true;
  }

  return {
    locked,
    onTrial,
    daysLeft,
    allow,
    openUpgrade: () => setOpen(true),
    upgradeModal: open ? <UpgradeModal onClose={() => setOpen(false)} /> : null,
  };
}

export function TrialBanner() {
  const { locked, onTrial, daysLeft } = useTrialStatus();
  if (locked) {
    return (
      <div className="border-b border-destructive/40 bg-destructive/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <Lock className="h-4 w-4 shrink-0" /> {TRIAL_OVER_MESSAGE}
          </span>
          <Link
            to="/checkout"
            search={{ plan: "essential" }}
            className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
          >
            Fazer upgrade
          </Link>
        </div>
      </div>
    );
  }
  if (!onTrial) return null;
  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
        <span className="text-warning">
          {daysLeft === 1 ? "Resta 1 dia do teu teste." : `Restam ${daysLeft} dias do teu teste.`}
        </span>
        <Link
          to="/checkout"
          search={{ plan: "essential" }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}

export function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/85 p-5 backdrop-blur">
      <div className="glass-panel relative w-full max-w-2xl rounded-2xl p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">Teste terminado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {TRIAL_OVER_MESSAGE} O teu catálogo público continua online para os clientes.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {PAID_PLANS.map((id) => {
            const plan = PLANS[id];
            return (
              <article key={id} className="rounded-2xl border border-border bg-surface/40 p-5">
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mt-1 font-display text-2xl font-bold">
                  {plan.price}{" "}
                  <span className="text-sm font-normal text-muted-foreground">XOF / mês</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/checkout"
                  search={{ plan: id }}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground"
                >
                  Escolher {plan.name}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Aviso reutilizável em cima de áreas bloqueadas. */
export function LockedNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children ?? TRIAL_OVER_MESSAGE}
    </div>
  );
}
