# Integrar o logo oficial Djumbai Shop

O ficheiro do logo que enviaste está no projeto (`src/assets/`), mas nenhuma página o usa — o cabeçalho ainda mostra o ícone genérico de estrela ("Sparkles"). Vou substituir isso pelo logo real em todo o produto.

## Preparação do ficheiro

- A imagem enviada contém duas variantes (fundo branco e fundo preto). Vou extrair a variante adequada e gerar um PNG com fundo transparente, para assentar bem no tema escuro da app.
- Guardar como `src/assets/djumbai-logo.png` (marca completa: ícone + nome + slogan) e uma versão só do ícone/sacola para espaços pequenos.

## Onde o logo passa a aparecer

1. **Landing page** (`src/routes/index.tsx`)
   - Cabeçalho: logo em vez do quadrado com estrela + texto.
   - Rodapé: logo em tamanho reduzido.
2. **Painel do lojista** (`src/components/dashboard-shell.tsx`) — logo no topo, ligado a `/dashboard`.
3. **Página de entrada/registo** (`src/routes/auth.tsx`) — logo acima do formulário.
4. **Catálogo público** (`src/routes/loja.$slug.tsx`) — assinatura "Criado com Djumbai Shop" no rodapé passa a mostrar o logo (mantendo o logo da própria loja no topo, como já está).
5. **Favicon / ícone do separador** e imagem de partilha social, via `src/routes/__root.tsx` e `public/`.

## Detalhes técnicos

- Import ES6 direto do asset (`import logo from "@/assets/djumbai-logo.png"`), com `alt="Djumbai Shop"`, `width`/`height` definidos e `loading="lazy"` fora do cabeçalho, para não afetar o desempenho.
- Componente reutilizável `src/components/brand-logo.tsx` com variantes `full` e `mark` e tamanho configurável, para o logo ficar consistente e num único lugar.
- Nenhuma alteração de lógica de negócio, base de dados ou planos.
