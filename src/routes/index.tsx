import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  ImagePlus,
  MessageCircle,
  Palette,
  ShieldCheck,
  Smartphone,
  Store,
  Zap,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroCatalog from "@/assets/hero-catalog.jpg";
import { BrandLogo } from "@/components/brand-logo";
import { PLANS } from "@/lib/store-helpers";
import { useSession } from "@/hooks/use-session";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Djumbai Shop — Catálogo digital com WhatsApp para lojas" },
      {
        name: "description",
        content:
          "Monte o catálogo da sua loja, partilhe um link e receba encomendas pelo WhatsApp. Sem site complicado, pronto em minutos.",
      },
      { property: "og:title", content: "Djumbai Shop — Venda pelo WhatsApp com um link" },
      {
        property: "og:description",
        content:
          "Catálogo online profissional para lojas locais. Produtos organizados, botão de compra no WhatsApp e painel de gestão.",
      },
    ],
  }),
  component: Landing,
});

const benefits = [
  {
    icon: Store,
    title: "Catálogo com link próprio",
    text: "djumbai.shop/sua-loja. Partilha no status, bio ou grupos e vende no mesmo dia.",
  },
  {
    icon: MessageCircle,
    title: "Encomendas no WhatsApp",
    text: "O cliente toca em comprar e a mensagem chega pronta, com produto e preço.",
  },
  {
    icon: ImagePlus,
    title: "Produtos organizados",
    text: "Fotos, preços, descontos, stock e categorias — tudo editável pelo telemóvel.",
  },
  {
    icon: BarChart3,
    title: "Métricas que importam",
    text: "Visitas ao catálogo, cliques no WhatsApp e produtos mais vistos.",
  },
  {
    icon: Palette,
    title: "A sua identidade",
    text: "Logo, cor principal, capa e mensagem de boas-vindas personalizadas.",
  },
  {
    icon: ShieldCheck,
    title: "Dados seguros",
    text: "Cada loja com acesso separado e histórico de pedidos protegido.",
  },
];

const steps = [
  { n: "01", title: "Cria a tua loja", text: "Nome, logo, WhatsApp e cor. Leva 2 minutos." },
  { n: "02", title: "Adiciona produtos", text: "Foto, preço e categoria. Publica de imediato." },
  { n: "03", title: "Partilha o link", text: "Recebe encomendas e acompanha os resultados." },
];

// Fonte única de verdade dos planos: src/lib/store-helpers.ts
const plans = [
  { ...PLANS.free, cta: "Começar grátis", planId: "free" as const, highlight: false },
  { ...PLANS.basic, cta: "Escolher Básico", planId: "basic" as const, highlight: true },
  { ...PLANS.pro, cta: "Escolher Pro", planId: "pro" as const, highlight: false },
];


const testimonials = [
  {
    name: "Aida Sanhá",
    role: "Bela Moda · Bissau",
    text: "Antes enviava fotos uma a uma. Agora mando um link e as clientes escolhem sozinhas.",
  },
  {
    name: "Nuno Cabral",
    role: "TecnoPhone · Bafatá",
    text: "Em duas semanas dobrei as encomendas. O cliente já chega a saber o preço.",
  },
  {
    name: "Mariama Baldé",
    role: "Glow Cosmética",
    text: "Consigo atualizar preços do telemóvel entre atendimentos. Simples de verdade.",
  },
];

const faqs = [
  {
    q: "Preciso de conhecimentos técnicos?",
    a: "Não. Tudo é feito por formulários simples no telemóvel, com instruções curtas em cada passo.",
  },
  {
    q: "Os pagamentos passam pela plataforma?",
    a: "Não. A negociação e o pagamento acontecem no WhatsApp, como já fazes hoje. Nós organizamos o catálogo e registamos os pedidos.",
  },
  {
    q: "Posso usar o meu domínio?",
    a: "Sim, no plano Profissional podes ligar o teu domínio próprio e remover a marca Djumbai.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. O cancelamento é feito com um clique na área de faturação, sem contratos.",
  },
];

function Landing() {
  const { session } = useSession();

  return (
    <main className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <BrandLogo variant="mark" height={36} priority />
            <span className="truncate font-display text-lg font-semibold">Djumbai Shop</span>
          </Link>
          <nav className="flex items-center gap-2">
            <a
              href="#planos"
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Planos
            </a>
            {session ? (
              <Link
                to="/dashboard"
                className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Ir para o painel
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-secondary/60"
                >
                  Entrar
                </Link>
                <Link
                  to="/auth"
                  search={{ plan: "free", mode: "signup" }}
                  className="rounded-xl bg-success px-3 py-2 text-sm font-semibold text-success-foreground"
                >
                  Criar loja
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-aura relative px-5 pb-16 pt-14 sm:pt-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Zap className="h-3.5 w-3.5" /> Catálogo pronto em minutos
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
              A tua loja com <span className="text-gradient">catálogo online</span> e vendas no
              WhatsApp
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Mostra os teus produtos de forma profissional, partilha um único link e recebe
              encomendas organizadas. Sem loja online complicada, sem taxas por venda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                search={{ plan: "free", mode: "signup" }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-6 py-3.5 font-semibold text-success-foreground transition-transform hover:scale-[1.02] active:scale-100"
              >
                Criar catálogo grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#planos"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 font-semibold transition-colors hover:border-primary/50 hover:bg-secondary/60"
              >
                <Smartphone className="h-4 w-4" /> Ver planos
              </a>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border/60 pt-6">
              {[
                ["2 min", "para publicar"],
                ["0%", "comissão por venda"],
                ["100%", "pensado para telemóvel"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-xl font-semibold text-primary">{value}</dt>
                  <dd className="text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="glass-panel relative rounded-3xl p-3">
            <img
              src={heroCatalog}
              alt="Catálogo digital Djumbai Shop apresentado num telemóvel"
              width={1280}
              height={1024}
              className="w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </section>

      {/* Problema / solução */}
      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-7">
            <h2 className="text-xl font-semibold">Como é hoje</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {[
                "Envias as mesmas fotos a cada cliente",
                "Perdes encomendas em conversas antigas",
                "Ninguém sabe o que ainda tens em stock",
                "Não sabes que produto atrai mais gente",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-success/25 bg-success/5 p-7">
            <h2 className="text-xl font-semibold">Com o Djumbai Shop</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {[
                "Um link com todos os produtos atualizados",
                "Pedidos registados com produto, hora e estado",
                "Stock e preços editados em segundos",
                "Relatórios de visitas e cliques no WhatsApp",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="px-5 py-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">
            Tudo o que a tua loja precisa, num só lugar
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="glass-panel surface-hover rounded-2xl p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Passos */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold sm:text-4xl">Três passos para vender</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="rounded-2xl border border-border bg-surface/50 p-6">
                <span className="font-display text-3xl font-bold text-primary/40">{step.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold sm:text-4xl">Planos simples</h2>
          <p className="mt-3 text-muted-foreground">
            Começa grátis. Sobe de plano quando as encomendas crescerem.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`surface-hover rounded-3xl p-7 ${
                  plan.highlight
                    ? "glass-panel glow-ring border-primary/40"
                    : "border border-border bg-surface/40"
                }`}
              >
                {plan.highlight ? (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                    Mais escolhido
                  </span>
                ) : null}
                <h3 className="mt-4 text-lg font-semibold">{plan.name}</h3>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">XOF · {plan.note}</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-3 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  search={{ plan: plan.planId, mode: "signup" }}
                  className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 font-semibold transition-transform hover:scale-[1.02] active:scale-100 ${
                    plan.highlight
                      ? "bg-success text-success-foreground"
                      : "border border-border bg-secondary/60 text-foreground"
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="px-5 py-8">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="glass-panel rounded-2xl p-6">
              <blockquote className="text-sm leading-relaxed text-foreground/90">
                “{t.text}”
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-semibold">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold sm:text-4xl">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left text-base">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pb-20">
        <div className="glass-panel glow-ring mx-auto max-w-4xl rounded-3xl p-9 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Publica o teu catálogo hoje</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Grátis para começar. Sem cartão, sem comissão por venda.
          </p>
          <Link
            to="/auth"
            search={{ plan: "free", mode: "signup" }}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-success px-7 py-3.5 font-semibold text-success-foreground transition-transform hover:scale-[1.02] active:scale-100"
          >
            Criar a minha loja <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo height={60} />
          <span>© {new Date().getFullYear()} Djumbai Shop. Feito para negócios locais.</span>
        </div>
      </footer>
    </main>
  );
}
