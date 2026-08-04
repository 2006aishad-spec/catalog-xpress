# Djumbai Shop V2 — plano de implementação

Nota: as imagens do logo oficial não chegaram nesta mensagem. Enquanto não as enviares, gero um logo provisório fiel à descrição (mala de compras + balão de conversa, vermelho/amarelo/verde da bandeira, fundo escuro) e substituo pelo oficial depois — sem alterar o resto do trabalho.

## Fase 0 — Fonte única de verdade dos planos (base de tudo)
- Reescrever `src/lib/store-helpers.ts` com os planos oficiais: Grátis 0 XOF (10 produtos / 2 categorias), Básico 3.500 XOF (60 / 30), Profissional 7.900 XOF (ilimitado / ilimitado), com as listas de funcionalidades exatas da tua secção 5.
- Remover `autoMessages` e qualquer texto sobre automação de WhatsApp, pagamento automático ou Orange Money.
- Alinhar a tabela `plans` na base de dados com estes mesmos valores (update de dados, sem apagar nada).
- Formatação de preço sempre com espaço: `3.500 XOF`.

## Fase 1 — Limites de plano validados no servidor
- Novos server functions `createProduct` / `createCategory` (com `requireSupabaseAuth`) que contam as linhas existentes e recusam acima do limite do plano da loja, com a mensagem: "Este plano permite até X produtos. Faz upgrade para adicionar mais produtos."
- Produtos e categorias no dashboard passam a criar através destes server functions (edição/eliminação continuam diretas por RLS).
- Reforço na base de dados: função + trigger que impede exceder o limite mesmo por chamada direta à API.
- Destaque de produto (`is_featured`) só permitido no plano Profissional, validado no servidor.

## Fase 2 — Autenticação (a parte mais delicada)
Abordagem: manter o Supabase Auth atual e usar **email sintético derivado do telemóvel**, sem migrar nem apagar nada.

- Nova tabela `profiles` (user_id, full_name, phone normalizado único, created_at) com RLS própria.
- Registo de lojista: nome + telemóvel + senha. O telemóvel é normalizado (só dígitos, 9 dígitos GW) e transformado num email interno determinístico (ex.: `955469148@phone.djumbaishop.app`) usado apenas pelo Auth; guarda-se o telemóvel real em `profiles`. Auto-confirmação ativada só para este domínio interno, porque não recebe email.
- Login de lojista: telemóvel + senha (mesma derivação).
- **Contas existentes não são tocadas.** O ecrã de autenticação mantém um separador discreto "Entrar com email" que serve (a) os lojistas já registados por email e (b) a conta de administrador `6ahmadodanfa@gmail.com`, que continua email + senha, como pediste.
- Um lojista antigo (email) que entre e ainda não tenha telemóvel associado vê um passo simples "Associa o teu número" no dashboard; associação só com sessão válida e recusada se o número já pertencer a outra conta (unicidade na base de dados).
- Google Login deixa de ser fluxo principal (removido do ecrã de lojista).
- Arquitetura pronta para OTP futuro (campo `phone_verified_at` já criado), mas **sem SMS nesta versão**.
- Atribuir role `admin` a `6ahmadodanfa@gmail.com` (se a conta ainda não existir, a role é aplicada automaticamente no primeiro login desse email por regra na base de dados).
- Recuperação de senha: por email continua a funcionar para contas de email; para contas de telefone a recuperação é feita pela equipa via WhatsApp (indicado claramente no ecrã), porque ainda não há SMS.

## Fase 3 — Pagamento manual dos planos
- Estados de pagamento: `pending`, `under_review`, `active`, `rejected` numa tabela `plan_requests` (referência única legível, ex. `DJS-4F7K2`).
- `/checkout` reescrito: nome do plano, preço, lista de funcionalidades, instruções passo a passo, referência, estado atual do pedido, aviso "a ativação depende de confirmação da nossa equipa" e botão que abre o WhatsApp 955469148 com a mensagem pré-preenchida no formato que indicaste.
- O plano da loja só muda quando o admin confirma. Downgrade para Grátis continua imediato.
- Djumbai Pay: **nada é apagado** — as rotas/tabelas ficam intactas mas desligadas da interface do lojista e sem promessas visíveis (fica só acessível a admins como módulo interno futuro).

## Fase 4 — Landing page, textos e identidade visual
- Correção de todos os erros apontados ("A tua identidade", "Produtos ilimitados", "Começar grátis" / "Mais escolhido" separados, `0 XOF`, `3.500 XOF`, `7.900 XOF`), tratamento por "tu" em todo o site.
- Mensagens principais exatamente as que definiste.
- Remoção dos três testemunhos fictícios; a secção passa a mensagem institucional honesta.
- Novo logo aplicado em landing, dashboard, catálogo público, favicon e imagem de partilha.
- Remoção de imagens sem relação com o produto; blocos de planos gerados a partir da fonte única da Fase 0.
- FAQ reescrito com a distinção entre pagamento do cliente e mensalidade, e com a nota honesta sobre cancelamento manual.

## Fase 5 — Páginas públicas, navegação e SEO
- Novas páginas `/termos`, `/privacidade`, `/suporte` (nenhum link anunciado a dar 404).
- Metadados por rota (título, descrição, og/twitter, canónico) e favicon novo.
- Catálogo público: logo leva à landing, sem menu interno; dashboard: logo leva ao dashboard; logout limpa sessão e bloqueia volta atrás.

## Fase 6 — Catálogo, produtos, dashboard e onboarding (ajustes)
- Catálogo: pesquisa, categorias, promoções, imagem em falta tratada, mensagem de WhatsApp com loja + produto + preço + referência; registo de visita e clique (produto, loja, hora, origem).
- Dashboard: estado de publicação, plano, estado do pagamento quando aplicável, métricas e todos os botões rápidos; estados vazios com instruções úteis.
- Onboarding: validações de slug duplicado, WhatsApp inválido, campos obrigatórios e caracteres especiais.

## Fase 7 — Testes e relatório
- Verificação automatizada com browser real (telemóvel 390px e desktop) dos fluxos: registo por telefone, login, logout, rota protegida sem sessão, login admin por email, onboarding, CRUD de produtos e categorias, bloqueio de limite, catálogo público (vazio, com muitos produtos, loja inexistente, não publicada), botão WhatsApp, checkout manual e painel de admin.
- Testes de isolamento entre lojas (tentar ler/editar dados de outra loja e aceder ao painel de admin como lojista normal).
- Relatório final com arquitetura, páginas, modelo de dados, fluxos, regras de limites e segurança, correções de texto, testes realizados e o que ficar pendente.

## Detalhes técnicos
- Backend: novas tabelas `profiles` e `plan_requests` com GRANTs + RLS (lojista só as suas linhas, admin tudo via `has_role`); trigger de limites de plano; registo das ações administrativas em `audit_log`.
- Limites: validados em server functions com `requireSupabaseAuth` e reforçados por trigger na base de dados.
- Auth: sem alteração ao `_authenticated/route.tsx` gerido pela integração; email sintético apenas como credencial interna.
- Nada é apagado: sem `DROP TABLE`, sem remoção de contas, lojas, produtos ou do módulo Djumbai Pay.

## Sequência de entrega
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. A Fase 2 vai numa alteração isolada e testada antes de seguir, por ser a mais sensível.
