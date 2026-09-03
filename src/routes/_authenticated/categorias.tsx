import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, EmptyState, NoStoreState } from "@/components/dashboard-shell";
import { useUpgradeGuard } from "@/components/trial-gate";
import { useCategories, useMyStore } from "@/hooks/use-store-data";
import { limitLabel, planOf } from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/categorias")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useMyStore();
  const { data: categories = [] } = useCategories(store?.id);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const upgrade = useUpgradeGuard();

  const plan = planOf(store?.plan);
  const atLimit = categories.length >= plan.maxCategories;

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!store) return;
    if (!upgrade.allow()) return;
    if (atLimit) {
      toast.error(`O plano ${plan.name} permite ${limitLabel(plan.maxCategories)} categorias.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("categories").insert({
      store_id: store.id,
      name: name.trim(),
      sort_order: categories.length,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível criar a categoria.");
      return;
    }
    setName("");
    toast.success("Categoria criada.");
    queryClient.invalidateQueries({ queryKey: ["categories", store.id] });
  }

  async function toggle(id: string, isActive: boolean) {
    if (!upgrade.allow()) return;
    await supabase.from("categories").update({ is_active: !isActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["categories", store?.id] });
  }

  async function remove(id: string) {
    if (!upgrade.allow()) return;
    if (!confirm("Eliminar esta categoria? Os produtos ficam sem categoria.")) return;
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoria eliminada.");
    queryClient.invalidateQueries({ queryKey: ["categories", store?.id] });
    queryClient.invalidateQueries({ queryKey: ["products", store?.id] });
  }

  if (isLoading) {
    return (
      <DashboardShell title="Categorias">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }
  if (!store) {
    return (
      <DashboardShell title="Categorias">
        <NoStoreState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Categorias"
      description={`${categories.length} de ${limitLabel(plan.maxCategories)} no plano ${plan.name}.`}
    >
      {upgrade.upgradeModal}
      <form onSubmit={addCategory} className="glass-panel flex flex-wrap gap-3 rounded-2xl p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="Nome da categoria (ex.: Vestidos)"
          className="min-w-0 flex-1 rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-success-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
          Adicionar
        </button>
      </form>

      <div className="mt-5">
        {categories.length === 0 ? (
          <EmptyState
            title="Sem categorias"
            text="As categorias organizam o catálogo e ativam os filtros na página pública."
          />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 bg-surface/40 px-4 py-3"
              >
                <span className="truncate text-sm font-medium">{category.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(category.id, category.is_active)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      category.is_active
                        ? "bg-success/15 text-success"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {category.is_active ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(category.id)}
                    aria-label="Eliminar categoria"
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
