export type PlanId = "free" | "basic" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  note: string;
  maxProducts: number;
  maxCategories: number;
  analytics: string;
  branding: string;
  autoMessages: boolean;
  support: string;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Grátis",
    price: "0",
    note: "para começar hoje",
    maxProducts: 10,
    maxCategories: 3,
    analytics: "Básicas",
    branding: "Marca Djumbai visível",
    autoMessages: false,
    support: "Normal",
  },
  basic: {
    id: "basic",
    name: "Básico",
    price: "3.500",
    note: "por mês",
    maxProducts: 50,
    maxCategories: 10,
    analytics: "Detalhadas",
    branding: "Marca opcional",
    autoMessages: true,
    support: "Prioritário",
  },
  pro: {
    id: "pro",
    name: "Profissional",
    price: "7.900",
    note: "por mês",
    maxProducts: Number.POSITIVE_INFINITY,
    maxCategories: Number.POSITIVE_INFINITY,
    analytics: "Avançadas",
    branding: "Sem marca Djumbai",
    autoMessages: true,
    support: "Prioritário",
  },
};

export function planOf(plan: string | null | undefined): Plan {
  return PLANS[(plan as PlanId) ?? "free"] ?? PLANS.free;
}

export function limitLabel(value: number) {
  return Number.isFinite(value) ? String(value) : "Ilimitado";
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function formatPrice(value: number, currency: string) {
  return `${Number(value).toLocaleString("pt-PT")} ${currency}`;
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export type Availability = "available" | "low" | "out" | "on_request";

export function availabilityOf(stock: number | null): Availability {
  if (stock === null || stock === undefined) return "on_request";
  if (stock <= 0) return "out";
  if (stock <= 3) return "low";
  return "available";
}

export const availabilityLabel: Record<Availability, string> = {
  available: "Disponível",
  low: "Últimas unidades",
  out: "Esgotado",
  on_request: "Sob consulta",
};

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export type WhatsappOrderInput = {
  storeName: string;
  productName: string;
  price: number;
  currency: string;
  sku?: string | null;
  size?: string;
  color?: string;
  quantity?: number;
  customerName?: string;
};

export function buildWhatsappMessage(input: WhatsappOrderInput) {
  const lines = [
    `Olá, ${input.storeName}! Tenho interesse neste produto:`,
    "",
    `Produto: ${input.productName}`,
    `Preço: ${formatPrice(input.price, input.currency)}`,
  ];
  if (input.sku) lines.push(`Código: ${input.sku}`);
  if (input.size) lines.push(`Tamanho: ${input.size}`);
  if (input.color) lines.push(`Cor: ${input.color}`);
  if (input.quantity && input.quantity > 1) lines.push(`Quantidade: ${input.quantity}`);
  if (input.customerName) lines.push(`Nome: ${input.customerName}`);
  lines.push("", "Ainda está disponível?");
  return lines.join("\n");
}

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${onlyDigits(number)}?text=${encodeURIComponent(message)}`;
}

export function deviceType() {
  if (typeof navigator === "undefined") return "unknown";
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
}
