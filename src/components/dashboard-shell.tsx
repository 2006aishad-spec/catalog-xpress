import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { amIAdmin } from "@/lib/admin.functions";


const navItems = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Boxes },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { to: "/loja", label: "Loja e plano", icon: Settings },
] as const;

export function DashboardShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(amIAdmin);
  const { data: isAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => checkAdmin(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    // Aguardar o signOut garante que não fica sessão "fantasma" no dispositivo.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignorado: a sessão local é limpa de qualquer forma */
    }
    navigate({ to: "/", replace: true });
  }


  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <BrandLogo variant="mark" height={34} priority />
            <span className="truncate font-display font-semibold">Djumbai Shop</span>
          </Link>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 pb-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "bg-primary/15 text-primary" }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              to="/admin"
              activeProps={{ className: "bg-primary/15 text-primary" }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              to="/pagamentos"
              activeProps={{ className: "bg-primary/15 text-primary" }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ShieldCheck className="h-4 w-4" /> Pagamentos
            </Link>
          ) : null}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
            {description ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function NoStoreState() {
  return (
    <EmptyState
      title="Ainda não tens loja criada"
      text="Cria a tua loja em menos de 2 minutos: nome, WhatsApp e link do catálogo."
      action={
        <Link
          to="/criar-loja"
          search={{ plan: undefined }}
          className="rounded-xl bg-success px-5 py-3 text-sm font-semibold text-success-foreground"
        >
          Criar a minha loja
        </Link>
      }
    />
  );
}
