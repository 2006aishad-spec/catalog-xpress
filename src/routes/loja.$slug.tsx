import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  Sparkles,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  createOrderLead,
  getPublicCatalog,
  logStoreEvent,
  type PublicCatalog,
  type PublicProduct,
} from "@/lib/catalog.functions";
import {
  availabilityLabel,
  availabilityOf,
  buildWhatsappMessage,
  deviceType,
  formatPrice,
  initialsOf,
  planOf,
  whatsappUrl,
} from "@/lib/store-helpers";
import { useMyStore } from "@/hooks/use-store-data";

export const Route = createFileRoute("/loja/$slug")({
  loader: async ({ params }) => {
    const catalog = await getPublicCatalog({ data: { slug: params.slug } });
    if (!catalog) throw notFound();
    return catalog;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Loja não encontrada" }, { name: "robots", content: "noindex" }] };
    }
    const { store } = loaderData;
    const description =
      store.description || store.tagline || `Catálogo online de ${store.name} com compra no WhatsApp.`;
    return {
      meta: [
        { title: `${store.name} — Catálogo online | Djumbai Shop` },
        { name: "description", content: description },
        { property: "og:title", content: `${store.name} — ${store.tagline || "Catálogo online"}` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
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
          Este link de loja não existe ou ainda não foi publicado.
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
  const catalog = Route.useLoaderData() as NonNullable<PublicCatalog>;
  const { store, categories, products: allProducts } = catalog;
  const { data: myStore } = useMyStore();
  const isOwner = !!myStore && myStore.id === store.id;
  const [query, setQuery] = useState("");

  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    void logStoreEvent({
      data: { storeId: store.id, eventType: "catalog_view", device: deviceType() },
    });
  }, [store.id]);

  const products = useMemo(() => {
    const term = query.trim().toLowerCase();
    return allProducts.filter((p) => {
      const matchCategory = category === "all" || p.category_id === category;
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term);
      return matchCategory && matchTerm;
    });
  }, [allProducts, query, category]);

  async function handleOrder(product: PublicProduct) {
    const price = product.sale_price ?? product.price;
    void logStoreEvent({
      data: {
        storeId: store.id,
        eventType: "whatsapp_click",
        productId: product.id,
        device: deviceType(),
      },
    });
    void createOrderLead({
      data: {
        storeId: store.id,
        productId: product.id,
        productName: product.name,
        notes: `Interesse via catálogo · ${formatPrice(price, store.currency)}`,
      },
    });
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: store.name, text: store.tagline, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      /* utilizador cancelou */
    }
  }

  const showBranding = planOf(store.plan).branding !== "Sem marca Djumbai";

  return (
    <main className="min-h-screen pb-16">
      <section className="hero-aura relative border-b border-border/60 px-5 pb-8 pt-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Djumbai Shop
            </Link>
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary/60"
            >
              <Share2 className="h-3.5 w-3.5" /> Partilhar
            </button>
          </div>
          <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/15 font-display text-xl font-bold text-primary glow-ring">
              {store.logo_url ? (
                <img src={store.logo_url} alt={`Logo de ${store.name}`} className="h-full w-full object-cover" />
              ) : (
                initialsOf(store.name)
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{store.name}</h1>
              {store.tagline ? (
                <p className="mt-1 text-sm text-muted-foreground">{store.tagline}</p>
              ) : null}
            </div>
          </div>
          {store.description ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{store.description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {store.location ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <MapPin className="h-3.5 w-3.5" /> {store.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" /> {store.category}
            </span>
          </div>
        </div>
      </section>

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
          {categories.length ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {[{ id: "all", name: "Todos" }, ...categories].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    category === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-5 py-6">
        <div className="mx-auto max-w-4xl">
          {products.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <h2 className="text-lg font-semibold">
                {allProducts.length === 0 ? "Catálogo em preparação" : "Nada encontrado"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {allProducts.length === 0
                  ? "Esta loja ainda está a adicionar produtos. Volta em breve."
                  : "Tenta outra palavra ou escolhe outra categoria."}
              </p>
              {allProducts.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                  className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((product) => {
                const availability = availabilityOf(product.stock);
                const price = product.sale_price ?? product.price;
                const message = buildWhatsappMessage({
                  storeName: store.name,
                  productName: product.name,
                  price,
                  currency: store.currency,
                  sku: product.sku,
                });
                const soldOut = availability === "out";
                return (
                  <article
                    key={product.id}
                    className="glass-panel surface-hover flex flex-col overflow-hidden rounded-2xl"
                  >
                    <div className="relative grid aspect-square place-items-center bg-secondary/40">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff className="h-8 w-8 text-muted-foreground" aria-hidden />
                      )}
                      {product.sale_price ? (
                        <span className="absolute left-2 top-2 rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                          Promoção
                        </span>
                      ) : null}
                      {product.is_featured ? (
                        <span className="absolute right-2 top-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Destaque
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <h2 className="text-sm font-semibold leading-snug">{product.name}</h2>
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {product.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-base font-semibold text-primary">
                          {formatPrice(price, store.currency)}
                        </span>
                        {product.sale_price ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(product.price, store.currency)}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`mt-2 text-[11px] font-medium ${
                          soldOut
                            ? "text-destructive"
                            : availability === "low"
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        {availabilityLabel[availability]}
                      </span>
                      {soldOut ? (
                        <span className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                          Esgotado
                        </span>
                      ) : (
                        <a
                          href={whatsappUrl(store.whatsapp_number, message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void handleOrder(product)}
                          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-success px-3 py-2.5 text-xs font-semibold text-success-foreground transition-transform hover:scale-[1.02] active:scale-100"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Comprar no WhatsApp
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {showBranding ? (
        <footer className="px-5 pt-6 text-center text-xs text-muted-foreground">
          Catálogo criado com{" "}
          <Link to="/" className="text-primary hover:underline">
            Djumbai Shop
          </Link>
        </footer>
      ) : null}
    </main>
  );
}
