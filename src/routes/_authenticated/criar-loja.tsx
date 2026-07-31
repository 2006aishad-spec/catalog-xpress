import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyStore } from "@/hooks/use-store-data";
import { onlyDigits, slugify } from "@/lib/store-helpers";

export const Route = createFileRoute("/_authenticated/criar-loja")({
  component: CreateStorePage,
});

const categories = [
  "Roupa e acessórios",
  "Cosmética e beleza",
  "Eletrónica",
  "Alimentação",
  "Casa e decoração",
  "Serviços",
  "Outro",
];

function CreateStorePage() {
  const navigate = useNavigate();
  const { data: store, isLoading } = useMyStore();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [location, setLocation] = useState("Bissau, Guiné-Bissau");
  const [tagline, setTagline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) navigate({ to: "/dashboard", replace: true });
  }, [store, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entra outra vez.");
      const finalSlug = slugify(slugEdited ? slug : name);
      if (finalSlug.length < 3) throw new Error("O link da loja precisa de pelo menos 3 letras.");
      const digits = onlyDigits(whatsapp);
      if (digits.length < 8) throw new Error("Escreve um número de WhatsApp válido com indicativo.");

      const { error } = await supabase.from("stores").insert({
        owner_id: uid,
        name: name.trim(),
        slug: finalSlug,
        tagline: tagline.trim(),
        category,
        location: location.trim(),
        whatsapp_number: digits,
        owner_name: (userData.user?.user_metadata?.full_name as string) ?? null,
      });
      if (error) {
        if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
          throw new Error("Esse link já está a ser usado. Escolhe outro.");
        }
        throw error;
      }
      toast.success("Loja criada! Agora adiciona os teus produtos.");
      navigate({ to: "/produtos" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a loja.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const preview = slugify(slugEdited ? slug : name) || "minha-loja";

  return (
    <main className="hero-aura min-h-screen px-5 py-12">
      <div className="glass-panel mx-auto max-w-2xl rounded-3xl p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
          <Store className="h-5 w-5" />
        </span>
        <h1 className="mt-6 text-2xl font-bold sm:text-3xl">Vamos criar a tua loja</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Passo 1 de 3 — depois adicionas produtos e publicas o catálogo.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nome da loja
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              placeholder="Ex.: Bela Moda"
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Link do catálogo
            </span>
            <input
              value={slugEdited ? slug : slugify(name)}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
              maxLength={40}
              placeholder="bela-moda"
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              O teu catálogo: /loja/{preview}
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              WhatsApp (com indicativo)
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              placeholder="245 955 000 111"
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Tipo de negócio
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Localização
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Frase da loja (opcional)
            </span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={140}
              placeholder="Roupa e acessórios com entrega no mesmo dia"
              className="w-full rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-5 py-3.5 font-semibold text-success-foreground disabled:opacity-60 sm:col-span-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar loja
          </button>
        </form>
      </div>
    </main>
  );
}
