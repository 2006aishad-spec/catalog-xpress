export type DemoProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  featured?: boolean;
  emoji: string;
};

export type DemoStore = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  location: string;
  currency: string;
  whatsapp: string;
  initials: string;
  categories: string[];
  products: DemoProduct[];
};

export const demoStores: DemoStore[] = [
  {
    slug: "bela-moda",
    name: "Bela Moda",
    tagline: "Roupa e acessórios com entrega no mesmo dia",
    description:
      "Peças selecionadas para o dia a dia. Encomenda pelo WhatsApp e recebe em casa em Bissau.",
    category: "Roupa e acessórios",
    location: "Bissau, Guiné-Bissau",
    currency: "XOF",
    whatsapp: "245955000111",
    initials: "BM",
    categories: ["Vestidos", "Calçado", "Acessórios", "Bolsas"],
    products: [
      {
        id: "p1",
        name: "Vestido Lumina",
        description: "Tecido leve, corte fluido, ideal para eventos.",
        price: 18500,
        oldPrice: 24000,
        category: "Vestidos",
        featured: true,
        emoji: "👗",
      },
      {
        id: "p2",
        name: "Sandália Nova",
        description: "Conforto o dia inteiro com sola antiderrapante.",
        price: 12000,
        category: "Calçado",
        emoji: "👡",
      },
      {
        id: "p3",
        name: "Bolsa Aura",
        description: "Espaço para portátil, tablet e essenciais.",
        price: 21000,
        category: "Bolsas",
        featured: true,
        emoji: "👜",
      },
      {
        id: "p4",
        name: "Óculos Solar Neo",
        description: "Proteção UV400 com armação leve.",
        price: 7500,
        oldPrice: 9000,
        category: "Acessórios",
        emoji: "🕶️",
      },
      {
        id: "p5",
        name: "Ténis Urban",
        description: "Estilo urbano, amortecimento reforçado.",
        price: 26500,
        category: "Calçado",
        emoji: "👟",
      },
      {
        id: "p6",
        name: "Colar Minimal",
        description: "Aço inoxidável, não escurece com o tempo.",
        price: 5500,
        category: "Acessórios",
        emoji: "📿",
      },
    ],
  },
];

export function findDemoStore(slug: string) {
  return demoStores.find((store) => store.slug === slug);
}

export function formatPrice(value: number, currency: string) {
  return `${value.toLocaleString("pt-PT")} ${currency}`;
}

export function whatsappLink(store: DemoStore, product: DemoProduct) {
  const message = `Olá ${store.name}! Quero encomendar: ${product.name} (${formatPrice(
    product.price,
    store.currency,
  )}).`;
  return `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(message)}`;
}
