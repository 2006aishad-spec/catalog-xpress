import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    redirect: z.string().optional(),
    mode: z.enum(["signin", "signup", "forgot"]).optional(),
    plan: z.enum(["free", "basic", "pro"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Djumbai Shop" },
      {
        name: "description",
        content:
          "Cria a tua conta Djumbai Shop com email e senha e publica o catálogo da tua loja em minutos.",
      },
      { property: "og:title", content: "Entrar no Djumbai Shop" },
      {
        property: "og:description",
        content: "Acede ao painel da tua loja, gere produtos e recebe pedidos pelo WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

/** Autenticação Djumbai Shop: apenas email + senha. Sem telemóvel, SMS ou OTP. */
function AuthPage() {
  const { redirect, mode: initialMode, plan } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const safeRedirect = redirect && redirect.startsWith("/") ? redirect : "/dashboard";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
        return;
      }

      const loginEmail = email.trim();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: safeRedirect });
        return;
      }

      if (password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
      if (!name.trim()) throw new Error("Escreve o teu nome completo.");

      const { data, error } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: name.trim() },
        },
      });
      if (error) throw error;

      if (!data.session) {
        setSent(true);
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: data.session.user.id,
        full_name: name.trim(),
      });
      if (profileError && !/duplicate key/i.test(profileError.message)) {
        console.warn("perfil não guardado", profileError.message);
      }

      navigate({
        to: "/criar-loja",
        search: { plan: plan === "basic" || plan === "pro" ? plan : undefined },
      });
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="hero-aura flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao início
      </Link>

      <div className="glass-panel w-full max-w-md rounded-3xl p-7">
        <BrandLogo height={72} priority />

        {sent ? (
          <div className="mt-6">
            <h1 className="text-2xl font-bold">Verifica o teu email</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Enviámos uma mensagem para <span className="text-foreground">{email}</span>. Toca no
              link para continuar.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
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
                ? "Escreve o email da conta e enviamos um link para definir nova senha."
                : "Entra com email e senha. Não é preciso cartão de crédito."}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === "signup" ? (
                <Field label="Nome completo">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="Ex.: Aida Sanhá"
                    className={inputClass}
                  />
                </Field>
              ) : null}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  maxLength={160}
                  placeholder="nome@email.com"
                  className={inputClass}
                />
              </Field>

              {mode !== "forgot" ? (
                <Field label="Senha">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={6}
                    maxLength={72}
                    placeholder="Pelo menos 6 caracteres"
                    className={inputClass}
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
                      Recuperar por email
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

const inputClass =
  "w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60";

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
  if (/Invalid login credentials/i.test(message))
    return "Email ou senha incorretos. Verifica e tenta outra vez.";
  if (/already registered|already exists|duplicate/i.test(message))
    return "Já existe uma conta com este email. Tenta entrar.";
  if (/Email not confirmed/i.test(message)) return "Confirma o teu email antes de entrar.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Espera um momento.";
  if (/password/i.test(message) && /weak|short|pwned|compromised/i.test(message))
    return "Escolhe uma senha mais forte (evita senhas comuns).";
  return message;
}
