import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState, NoStoreState } from "@/components/dashboard-shell";
import { useCategories, useMyStore, useProducts, type Product } from "@/hooks/use-store-data";
import { signedImageUrl, uploadProductImage } from "@/lib/images";
import {
  availabilityLabel,
  availabilityOf,
  formatPrice,
  limitLabel,
  planOf,
} from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: ProductsPage,
});

function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useMyStore();
  const { data: products = [] } = useProducts(store?.id);
  const { data: categories = [] } = useCategories(store?.id);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const plan = planOf(store?.plan);
  const atLimit = products.length >= plan.maxProducts;

  async function remove(product: Product) {
    if (!confirm(`Eliminar "${product.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error("Não foi possível eliminar o produto.");
      return;
    }
    toast.success("Produto eliminado.");
    queryClient.invalidateQueries({ queryKey: ["products", store?.id] });
  }

  async function toggleActive(product: Product) {
    await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id);
    queryClient.invalidateQueries({ queryKey: ["products", store?.id] });
  }

  async function toggleFeatured(product: Product) {
    await supabase
      .from("products")
      .update({ is_featured: !product.is_featured })
      .eq("id", product.id);
    queryClient.invalidateQueries({ queryKey: ["products", store?.id] });
  }

  if (isLoading) {
    return (
      <DashboardShell title="Produtos">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Produtos">
        <NoStoreState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Produtos"
      description={`${products.length} de ${limitLabel(plan.maxProducts)} no plano ${plan.name}.`}
      actions={
        <button
          type="button"
          onClick={() => {
            if (atLimit) {
              toast.error(
                `O plano ${plan.name} permite ${limitLabel(plan.maxProducts)} produtos. Faz upgrade para adicionar mais.`,
              );
              return;
            }
            setEditing("new");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground"
        >
          <Plus className="h-4 w-4" /> Adicionar produto
        </button>
      }
    >
      {products.length === 0 ? (
        <EmptyState
          title="Ainda sem produtos"
          text="Adiciona o primeiro produto com foto, preço e categoria. Aparece no catálogo de imediato."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id} className="glass-panel overflow-hidden rounded-2xl">
              <ProductThumb path={product.image_url} name={product.name} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-sm font-semibold">{product.name}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      product.is_active
                        ? "bg-success/15 text-success"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {product.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPrice(Number(product.sale_price ?? product.price), store.currency)} ·{" "}
                  {availabilityLabel[availabilityOf(product.stock)]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(product)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFeatured(product)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      product.is_featured
                        ? "border-primary/50 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" /> Destaque
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(product)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {product.is_active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(product)}
                    aria-label="Eliminar produto"
                    className="rounded-lg border border-border px-2 py-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ProductForm
          storeId={store.id}
          currency={store.currency}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["products", store.id] });
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function ProductThumb({ path, name }: { path: string | null; name: string }) {
  const { data: url } = useQuery({
    queryKey: ["image", path],
    enabled: !!path,
    queryFn: () => signedImageUrl(path),
  });

  if (!url) {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-secondary/40 text-muted-foreground">
        <ImagePlus className="h-7 w-7" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      className="aspect-[4/3] w-full object-cover"
    />
  );
}

function ProductForm({
  storeId,
  currency,
  categories,
  product,
  onClose,
  onSaved,
}: {
  storeId: string;
  currency: string;
  categories: { id: string; name: string }[];
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(Number(product.price)) : "");
  const [salePrice, setSalePrice] = useState(
    product?.sale_price != null ? String(Number(product.sale_price)) : "",
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [sizes, setSizes] = useState((product?.sizes ?? []).join(", "));
  const [colors, setColors] = useState((product?.colors ?? []).join(", "));
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      let imagePath = product?.image_url ?? null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("A imagem não pode passar de 5 MB.");
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Sessão expirada.");
        imagePath = await uploadProductImage(file, userData.user.id);
      }

      const payload = {
        store_id: storeId,
        name: name.trim().slice(0, 120),
        description: description.trim().slice(0, 800),
        price: Number(price) || 0,
        sale_price: salePrice ? Number(salePrice) : null,
        category_id: categoryId || null,
        stock: stock === "" ? null : Number(stock),
        sku: sku.trim() ? sku.trim().slice(0, 40) : null,
        sizes: splitList(sizes),
        colors: splitList(colors),
        is_featured: isFeatured,
        image_url: imagePath,
      };

      const { error } = product
        ? await supabase.from("products").update(payload).eq("id", product.id)
        : await supabase.from("products").insert(payload);
      if (error) throw error;
      toast.success(product ? "Produto atualizado." : "Produto adicionado.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="glass-panel my-8 w-full max-w-2xl rounded-3xl p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{product ? "Editar produto" : "Novo produto"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className={inputClass}
            />
          </Field>

          <Field label="Descrição" className="sm:col-span-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={800}
              className={inputClass}
            />
          </Field>

          <Field label={`Preço (${currency})`}>
            <input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label={`Preço promocional (${currency})`}>
            <input
              type="number"
              min="0"
              step="1"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Categoria">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Stock (vazio = sob consulta)">
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="SKU / código (opcional)">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              maxLength={40}
              className={inputClass}
            />
          </Field>

          <Field label="Tamanhos (separados por vírgula)">
            <input
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              placeholder="S, M, L"
              className={inputClass}
            />
          </Field>

          <Field label="Cores (separadas por vírgula)">
            <input
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="Preto, Branco"
              className={inputClass}
            />
          </Field>

          <Field label="Imagem do produto (máx. 5 MB)">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-foreground"
            />
          </Field>

          <label className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Marcar como produto destacado no catálogo
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-success-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar produto
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-secondary/60"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
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

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}
