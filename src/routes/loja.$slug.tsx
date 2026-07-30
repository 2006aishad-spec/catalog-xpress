import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, Search, Sparkles } from "lucide-react";
import { findDemoStore, formatPrice, whatsappLink, type DemoStore } from "@/lib/demo-store";

export const Route = createFileRoute("/loja/$slug")({
  loader: ({ params }): { store: DemoStore } => {
    const store = findDemoStore(params.slug);
    if (!store) throw notFound();
    return { store };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Loja não encontrada" }, { name: "robots", content: "noindex" }] };
    }
    const { store } = loaderData;
    return {
      meta: [
        { title: `${store.name} — Catálogo online | Djumbai Shop` },
        { name: "description", content: store.description },
        { property: "og:title", content: `${store.name} — ${store.tagline}` },
        { property: "og:description", content: store.description },
      ],
    };
  },
  component: StoreCatalog,
  errorComponent: () => <CatalogFallback />,
  notFoundComponent: () => <CatalogFallback />,
});

function CatalogFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Catálogo indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link de loja não existe ou foi desativado.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>
      </div>
    </main>
  );
}

function StoreCatalog() {
  const { store } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Todos");

  const products = useMemo(() => {
    const term = query.trim().toLowerCase();
    return store.products.filter((p) => {
      const matchCategory = category === "Todos" || p.category === category;
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term);
      return matchCategory && matchTerm;
    });
  }, [store.products, query, category]);

  return (
    <main className="min-h-screen pb-16">
      {/* Capa */}
      <section className="hero-aura relative border-b border-border/60 px-5 pb-8 pt-6">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Djumbai Shop
          </Link>
          <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/15 font-display text-xl font-bold text-primary glow-ring">
              {store.initials}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{store.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{store.tagline}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{store.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <MapPin className="h-3.5 w-3.5" /> {store.location}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" /> {store.category}
            </span>
          </div>
        </div>
      </section>

      {/* Pesquisa e filtros */}
      <section className="sticky top-0 z-30 border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl">
          <label className="flex items-center gap-3 rounded-xl border border-input bg-surface/60 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar produtos..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {["Todos", ...store.categories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  category === cat
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Produtos */}
      <section className="px-5 py-6">
        <div className="mx-auto max-w-4xl">
          {products.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <h2 className="text-lg font-semibold">Nada encontrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tenta outra palavra ou escolhe outra categoria.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("Todos");
                }}
                className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="glass-panel surface-hover flex flex-col overflow-hidden rounded-2xl"
                >
                  <div className="relative grid aspect-square place-items-center bg-secondary/40 text-5xl">
                    <span aria-hidden>{product.emoji}</span>
                    {product.oldPrice ? (
                      <span className="absolute left-2 top-2 rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                        Promoção
                      </span>
                    ) : null}
                    {product.featured ? (
                      <span className="absolute right-2 top-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Destaque
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h2 className="text-sm font-semibold leading-snug">{product.name}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {product.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2">
                      <span className="font-display text-base font-semibold text-primary">
                        {formatPrice(product.price, store.currency)}
                      </span>
                      {product.oldPrice ? (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.oldPrice, store.currency)}
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={whatsappLink(store, product)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-success px-3 py-2.5 text-xs font-semibold text-success-foreground transition-transform hover:scale-[1.02] active:scale-100"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Comprar no WhatsApp
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="px-5 pt-6 text-center text-xs text-muted-foreground">
        Catálogo criado com{" "}
        <Link to="/" className="text-primary hover:underline">
          Djumbai Shop
        </Link>
      </footer>
    </main>
  );
}
