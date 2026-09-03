export type PlanId = "trial" | "essential" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  /** Preço formatado com separador de milhares (sem moeda). */
  price: string;
  priceAmount: number;
  note: string;
  maxProducts: number;
  maxCategories: number;
  analytics: string;
  branding: string;
  support: string;
  /** Funcionalidades oficiais mostradas na landing, no dashboard e no checkout. */
  features: string[];
};

/** Duração oficial do período de teste. */
export const TRIAL_DAYS = 14;

/**
 * FONTE ÚNICA DE VERDADE DOS PLANOS.
 * Estes valores têm de ser iguais aos limites aplicados na base de dados
 * (funções plan_max_products / plan_max_categories).
 */
export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Teste",
    price: "0",
    priceAmount: 0,
    note: "14 dias grátis",
    maxProducts: 15,
    maxCategories: 3,
    analytics: "Estatísticas básicas",
    branding: "Marca Djumbai Shop visível",
    support: "Suporte normal",
    features: [
      "15 produtos",
      "3 categorias",
      "Catálogo online",
      "Link público da loja",
      'Botão "Comprar no WhatsApp"',
      "Partilhar catálogo",
      "Válido por 14 dias",
    ],
  },
  essential: {
    id: "essential",
    name: "Essencial",
    price: "1.450",
    priceAmount: 1450,
    note: "por mês",
    maxProducts: 80,
    maxCategories: 20,
    analytics: "Estatísticas básicas",
    branding: "Marca Djumbai Shop visível",
    support: "Suporte normal",
    features: [
      "80 produtos",
      "20 categorias",
      "Logo da loja",
      "Registo de pedidos",
      "Estatísticas básicas",
      "Suporte normal",
    ],
  },
  pro: {
    id: "pro",
    name: "Profissional",
    price: "3.000",
    priceAmount: 3000,
    note: "por mês",
    maxProducts: Number.POSITIVE_INFINITY,
    maxCategories: Number.POSITIVE_INFINITY,
    analytics: "Relatórios avançados",
    branding: "Sem marca Djumbai",
    support: "Suporte prioritário",
    features: [
      "Produtos ilimitados",
      "Categorias ilimitadas",
      "Personalização completa (logo + capa + cor)",
      "Sem marca Djumbai Shop",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
  },
};


export const PLAN_ORDER: PlanId[] = ["trial", "essential", "pro"];

export const PAID_PLANS: PlanId[] = ["essential", "pro"];

/** Número de WhatsApp da equipa Djumbai Shop (pagamento manual e suporte). */
export const TEAM_WHATSAPP = "245955469148";

export function planOf(plan: string | null | undefined): Plan {
  return PLANS[(plan as PlanId) ?? "trial"] ?? PLANS.trial;
}

export function isPaidPlan(plan: string | null | undefined) {
  return planOf(plan).id !== "trial";
}

/** Dias inteiros que faltam do teste (0 quando já terminou). */
export function trialDaysLeft(trialEndsAt: string | null | undefined) {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** Teste terminado: catálogo público continua, mas a edição fica bloqueada. */
export function isTrialExpired(store: { plan: string; trial_ends_at?: string | null } | null | undefined) {
  if (!store) return false;
  if (isPaidPlan(store.plan)) return false;
  if (!store.trial_ends_at) return false;
  return new Date(store.trial_ends_at).getTime() < Date.now();
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

// ------------------------------------------- telemóvel (dados de negócio)
/**
 * Normaliza um número da Guiné-Bissau para 9 dígitos locais.
 * Usado apenas para o WhatsApp da loja — NÃO é um método de autenticação.
 *
 * Testes:
 *  normalizePhone("955469148")      -> "955469148"
 *  normalizePhone("+245 955469148") -> "955469148"
 *  normalizePhone("00245955469148") -> "955469148"
 *  normalizePhone("12345")          -> null
 */
export function normalizePhone(value: string): string | null {
  let digits = onlyDigits(value);
  if (digits.startsWith("00245")) digits = digits.slice(5);
  else if (digits.startsWith("245") && digits.length > 9) digits = digits.slice(3);
  if (digits.length !== 9) return null;
  return /^[0-9]{9}$/.test(digits) ? digits : null;
}


// ---------------------------------------------------------------- catálogo
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
  if (input.sku) lines.push(`Referência: ${input.sku}`);
  if (input.size) lines.push(`Tamanho: ${input.size}`);
  if (input.color) lines.push(`Cor: ${input.color}`);
  if (input.quantity && input.quantity > 1) lines.push(`Quantidade: ${input.quantity}`);
  if (input.customerName) lines.push(`Nome: ${input.customerName}`);
  lines.push("", "Ainda está disponível?");
  return lines.join("\n");
}

/** Mensagem pré-preenchida para a equipa Djumbai Shop (pagamento manual). */
export function buildPlanRequestMessage(input: {
  customerName: string;
  storeId?: string;
  storeName: string;
  planName: string;
  amount: number;
  currency: string;
  reference: string;
}) {
  return [
    "Olá.",
    `Pretendo adquirir o plano ${input.planName}.`,
    `Código da Loja: ${input.storeId ?? "—"}`,
    `Nome da Loja: ${input.storeName}`,
    `Valor: ${formatPrice(input.amount, input.currency)}`,
    `Referência: ${input.reference}`,
    `Contacto: ${input.customerName || "—"}`,
    "Aguardo instruções para pagamento.",
  ].join("\n");
}


export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${onlyDigits(number)}?text=${encodeURIComponent(message)}`;
}

export function deviceType() {
  if (typeof navigator === "undefined") return "unknown";
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Aguarda contacto",
  under_review: "Em análise",
  active: "Ativo",
  rejected: "Rejeitado",
};

