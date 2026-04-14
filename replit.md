# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

---

# IbHub Web — Rede do Vinho (Web App)

## Artefato

- **Diretório**: `artifacts/web/`
- **Framework**: React + Vite + TypeScript + Tailwind CSS v4
- **Preview path**: `/web/`
- **Backend**: Supabase (reutiliza secrets do mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)

## Design System

- **Paleta**: Navy `#0d1b2a` · Gold `#c9a84c` · Wine `#722f37`
- **Fonte**: Inter (system-ui fallback)
- **Radius**: 12px padrão
- **Tema**: Light mode always (alinhado com mobile)

## Páginas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/` | `LandingPage.tsx` | Hero, About, Features, Plans, CTA, Footer |
| `/login` | `LoginPage.tsx` | Email/senha + Google OAuth |
| `/cadastro` | `CadastroPage.tsx` | Registro 3 etapas (dados → áreas → plano) |
| `/app` | `AppFeedPage.tsx` | Feed com Stories, posts, reações, comentários |
| `/app/mercado` | `MercadoPage.tsx` | Feed Ideal.BI (premium), criação de posts |
| `/app/mensagens` | `MensagensPage.tsx` | Lista de conversas + chat direto |
| `/app/grupos` | `GruposPage.tsx` | Grupos da comunidade |
| `/app/grupos/:id` | `GrupoChatPage.tsx` | Chat em grupo com Supabase realtime |
| `/app/oportunidades` | `OportunidadesPage.tsx` | Vagas e eventos |
| `/app/oportunidades/:id` | `OportunidadeDetalhe.tsx` | Detalhe de oportunidade |
| `/app/eventos/:id` | `EventoDetalhe.tsx` | Detalhe de evento |
| `/app/meus-eventos` | `MeusEventosPage.tsx` | Gerenciar eventos criados + criar novo |
| `/app/perfil` | `MeuPerfilPage.tsx` | Perfil próprio com edição |
| `/app/usuario/:id` | `PerfilUsuarioPage.tsx` | Perfil de outro usuário |
| `/app/empresa/:id` | `EmpresaPage.tsx` | Página pública de empresa |
| `/app/empresa/:id/editar` | `GerenciarEmpresaPage.tsx` | Editar página de empresa (owner only) |
| `/app/adega` | `AdegaPage.tsx` | Adega virtual com EAN barcode |
| `/app/ranking-vinho` | `WineRankingPage.tsx` | Ranking de vinhos da comunidade |
| `/app/notificacoes` | `NotificacoesPage.tsx` | Central de notificações |
| `/app/busca` | `BuscaPage.tsx` | Busca de pessoas e conteúdo |
| `/app/conexoes` | `ConexoesPage.tsx` | Rede: conexões, seguidores, seguindo |
| `/app/posts/:id` | `PostDetalhePage.tsx` | Detalhe de post com comentários threaded |
| `/app/salvos` | `ItensSalvosPage.tsx` | Posts salvos |
| `/app/analytics` | `AnalyticsPage.tsx` | Analytics pessoal de engajamento |
| `/app/indicacoes` | `ReferralPage.tsx` | Programa de indicação + ranking |
| `/app/certificacoes` | `CertificacoesPage.tsx` | Gerenciar certificações profissionais |
| `/app/bloqueados` | `UsuariosBloqueadosPage.tsx` | Usuários bloqueados |
| `/assinar` | `AssinarPage.tsx` | Planos + Stripe checkout |
| `/minha-conta` | `MinhaContaPage.tsx` | Configurações da conta |

## Arquivos Importantes

- `src/lib/supabase.ts` — cliente Supabase (usa `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` definidos no vite.config.ts a partir dos secrets EXPO_PUBLIC_*)
- `src/context/AuthContext.tsx` — sessão, signIn/signUp/Google/signOut, resetPassword, refreshProfile
- `src/App.tsx` — roteamento Wouter com PrivateRoute e PublicOnlyRoute guards

---

# IbHub — Rede do Vinho (Mobile App)

## Produto

Rede social de nicho para o mercado do vinho. Conecta profissionais (Sommeliers, Produtores, Importadores, Distribuidores), empresas e entusiastas.

## Artefato

- **Diretório**: `artifacts/ibhub/`
- **Framework**: React Native + Expo (Expo Router)
- **Backend**: Supabase (Auth, PostgreSQL, Storage)
- **Secrets**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SESSION_SECRET`

## Design System

- **Estética**: Elegante, premium, clean — **modo escuro nativo** (dark mode)
- **Fundo / Headers**: Azul Marinho `#0d1b2a`
- **Destaque (botões, ícones ativos, links)**: Dourado `#c9a84c`
- **Bordas arredondadas**: `borderRadius: 8` ou `12`
- **Tipografia**: Serifada para títulos (elegância), sans-serif para corpo de texto
- **Telas de auth (login/cadastro)**: fundo navy escuro com glassmorphism e ouro
- **REGRA**: Nunca usar tags HTML (`div`, `span`). Sempre componentes nativos RN

## Navegação (5 abas inferiores)

| Aba | Arquivo | Conteúdo |
|---|---|---|
| Início | `(tabs)/index.tsx` | Feed de posts, pesquisa, filtros avançados, criar publicação, Avaliar Rótulo |
| Mercado | `(tabs)/network.tsx` | **Adega Virtual** e gestão de **Certificações** |
| Chat | `(tabs)/messages.tsx` | Lista de conversas e mensagens diretas |
| Oportunidades | `(tabs)/notifications.tsx` | Vagas no setor + Eventos de enoturismo (RSVP) |
| Perfil | `(tabs)/profile.tsx` | Painel do usuário, QR Code, status da conta, Gerenciar Páginas |

## Níveis de Conta (Assinaturas)

1. **Básico** — acesso fundamental, GRÁTIS
2. **Premium** — R$ 149/mês, conexões ilimitadas + dados de mercado
3. **Exclusive** — R$ 299/mês, inteligência de mercado + apresentações + destaque no feed
4. **Business** — R$ 499/mês, página empresarial + vagas + suporte prioritário

## Componentes Reutilizáveis (padrão)

Criar na pasta `components/` em vez de repetir código:
- `GoldButton` — botão padrão ouro
- `WineCard` — card de vinho
- `FilterChip` — chip de filtro
- Modais: garantir z-index correto para `onPress` não ser bloqueado

## Arquivos Importantes

- `app/(auth)/login.tsx` — tela de login
- `app/(auth)/register.tsx` — cadastro 3 etapas
- `context/AuthContext.tsx` — sessão Supabase
- `app/_layout.tsx` — roteamento raiz
- `constants/colors.ts` — paleta de cores (dark theme)
- `hooks/useColors.ts` — hook de cores (atualmente forçado para light — ver pendências)

## Banco de Dados — Migrações

| Arquivo | Descrição |
|---|---|
| `supabase/schema.sql` | Schema principal (profiles, posts, likes, comments, follows, connections, notifications, stories, conversations, messages, reports) |
| `supabase/migrations_user_blocks_post_hidden.sql` | Tabelas user_blocks + post_hidden |
| `supabase/migrations_v2.sql` | **v2**: comment_likes, wine_cellar, company_pages + company_page_admins, storage bucket post-images, triggers de followers/connections_count, colunas position/company/areas/profile_type no profiles |

**Status das features (post v2):**
- Upload de imagem: `uploadPostImage()` → bucket `post-images` no Supabase Storage
- Contadores: triggers em `follows` e `connections` mantêm `followers_count`, `following_count`, `connections_count` no `profiles`
- Adega: tabela `wine_cellar` + tela `/wine-cellar` conectada ao Supabase
- Páginas Empresariais: CRUD completo conectado ao Supabase via `fetchCompanyPageById`, `updateCompanyPage`, `deleteCompanyPage`, `fetchCompanyPageAdmins`, `addCompanyPageAdmin`, `removeCompanyPageAdmin`, `uploadCompanyLogo`. Navegação corrigida para passar `?id=` em todos os pontos de entrada (`empresa/[id].tsx`, `(tabs)/index.tsx`, `(tabs)/profile.tsx`). A tela `manage-business-page.tsx` tem 3 abas: Preview (dados reais + excluir), Editar (salvar no DB + upload de logo), Equipe (busca de usuários + add/remove membros com papéis).
- Comment likes: tabela `comment_likes` criada

## Aba Mercado — Detalhes

- **Visão Geral**: KPIs por período (Último Mês / Trimestre YTD / Último Ano), gráfico de área Exportações vs Importações, gráfico de barras Produção Nacional, Tendências, Regiões Produtoras, Variedades em Destaque
- **Apresentações**: catálogo de PDFs/PPTs subidos por admin. Estado vazio por padrão.
- **Top Perfis** (novo): ranking dos perfis com mais seguidores, pódio com medalhas (🥇🥈🥉)
- Dados de mercado são mock — integração real via Supabase a implementar

## Componentes de Gráficos (react-native-svg)

- `AreaChart` — embutido em `network.tsx`, exportações (gold) vs importações (vermelho)
- `BarChart` — embutido em `network.tsx`, produção trimestral (gold)

## Features de Engajamento (v16)

Implementadas e integradas ao Supabase:

| Feature | Tela | Detalhes |
|---|---|---|
| Visualizações de perfil | `profile.tsx` | Banner "X pessoas viram seu perfil esta semana" via `profile_views` table + `fetchProfileViewsThisWeek` |
| Barra de completude do perfil | `profile.tsx` | Calcula 0-100% com base em 8 campos; clica para editar; dica adaptativa |
| QR code do perfil | `profile.tsx` | Modal com QR (react-native-qrcode-svg), botão compartilhar link |
| Conquistas / Badges | `profile.tsx` | 10 badges automáticos por posts, seguidores, conexões, adega, completude |
| Código de convite | `profile.tsx` | `ensureReferralCode()` — gera código único; toque para compartilhar via Share API |
| Registrar view de perfil | `profile/[id].tsx` | Chama `recordProfileView()` ao abrir perfil alheio |
| Conexões em comum | `profile/[id].tsx` | `fetchMutualConnections()` — mostra avatares + texto abaixo do perfil público |
| Leaderboard regional | `network.tsx` | Aba "Top Perfis" com ranking por seguidores |
| Valor estimado da adega | `wine-cellar.tsx` | Calcula `qty × price` para vinhos "adega" com preço |
| Alerta janela de consumo | `wine-cellar.tsx` | `drink_by` ≤ 30 dias → banner amarelo + notificação agendada (`expo-notifications`) |
| Compartilhar vinho | `wine-cellar.tsx` | Botão share-2 em cada card → Share API com detalhes do vinho |
| Nota de degustação | `create-post.tsx` | Modo "Degustação" no criar post: vinho, produtor, safra, pontuação 0-100 (12 valores), aroma, sabor, harmonização, notas |

### Migração Supabase (v16)
- Arquivo: `supabase/migrations_v16_engagement.sql`
- Tabela `profile_views (viewer_id, profile_id, viewed_at, unique daily)` + coluna `profiles.referral_code`
- **Precisa ser executada no Supabase SQL Editor**
