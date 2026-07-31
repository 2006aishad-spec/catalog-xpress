import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Djumbai Shop" },
      {
        name: "description",
        content:
          "Cria a tua conta Djumbai Shop e publica o catálogo da tua loja com vendas pelo WhatsApp.",
      },
      { property: "og:title", content: "Entrar no Djumbai Shop" },
      {
        property: "og:description",
        content: "Acede ao painel da tua loja, gere produtos e recebe encomendas pelo WhatsApp.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<"confirm" | "reset" | null>(null);

  const safeRedirect = redirect && redirect.startsWith("/") ? redirect : "/dashboard";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: safeRedirect });
      } else if (mode === "signup") {
        if (password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/criar-loja" });
        } else {
          setSent("confirm");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
      }
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Não foi possível entrar com o Google. Tenta outra vez.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: safeRedirect });
  }

  return (
    <main className="hero-aura flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Djumbai Shop
      </Link>

      <div className="glass-panel w-full max-w-md rounded-3xl p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
          <Sparkles className="h-5 w-5" />
        </span>

        {sent ? (
          <div className="mt-6">
            <h1 className="text-2xl font-bold">
              {sent === "confirm" ? "Confirma o teu email" : "Verifica o teu email"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Enviámos uma mensagem para <span className="text-foreground">{email}</span>.{" "}
              {sent === "confirm"
                ? "Toca no link para ativar a conta e criar a tua loja."
                : "Toca no link para definir uma nova senha."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(null);
                setMode("signin");
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary/60"
            >
              <Mail className="h-4 w-4" /> Voltar ao início de sessão
            </button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold">
              {mode === "signin"
                ? "Entrar na tua conta"
                : mode === "signup"
                  ? "Criar a minha loja grátis"
                  : "Recuperar senha"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "Escreve o teu email e enviamos um link para definir nova senha."
                : "Catálogo online e encomendas no WhatsApp, sem cartão de crédito."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "signup" ? (
                <Field label="O teu nome">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="Ex.: Aida Sanhá"
                    className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
                  />
                </Field>
              ) : null}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={160}
                  placeholder="nome@email.com"
                  className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
                />
              </Field>

              {mode !== "forgot" ? (
                <Field label="Senha">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={72}
                    placeholder="Pelo menos 6 caracteres"
                    className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
                  />
                </Field>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success px-5 py-3.5 font-semibold text-success-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta grátis"
                    : "Enviar link"}
              </button>
            </form>

            {mode !== "forgot" ? (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full rounded-xl border border-border bg-secondary/50 px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  Continuar com Google
                </button>
              </>
            ) : null}

            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  <p>
                    Ainda não tens conta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="font-medium text-primary hover:underline"
                    >
                      Criar loja grátis
                    </button>
                  </p>
                  <p>
                    Esqueceste a senha?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="font-medium text-primary hover:underline"
                    >
                      Recuperar acesso
                    </button>
                  </p>
                </>
              ) : (
                <p>
                  Já tens conta?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-medium text-primary hover:underline"
                  >
                    Entrar
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function translateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Invalid login credentials/i.test(message)) return "Email ou senha incorretos.";
  if (/already registered|already exists/i.test(message))
    return "Este email já tem conta. Tenta entrar.";
  if (/Email not confirmed/i.test(message)) return "Confirma o teu email antes de entrar.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Espera um momento.";
  return message;
}
