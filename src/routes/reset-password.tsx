import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — Djumbai Shop" },
      { name: "description", content: "Define uma nova senha para a tua conta Djumbai Shop." },
      { property: "og:title", content: "Definir nova senha — Djumbai Shop" },
      { property: "og:description", content: "Recupera o acesso ao painel da tua loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(
        /session/i.test(error.message)
          ? "O link expirou. Pede um novo email de recuperação."
          : error.message,
      );
      return;
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="hero-aura flex min-h-screen items-center justify-center px-5 py-12">
      <div className="glass-panel w-full max-w-md rounded-3xl p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">Definir nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolhe uma senha com pelo menos 6 caracteres.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            maxLength={72}
            placeholder="Nova senha"
            className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success px-5 py-3.5 font-semibold text-success-foreground disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar senha
          </button>
        </form>
        <Link
          to="/auth"
          className="mt-5 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          Voltar ao início de sessão
        </Link>
      </div>
    </main>
  );
}
