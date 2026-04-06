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

1. **Básico** — acesso fundamental
2. **Premium** — recursos intermediários
3. **Exclusive** — recursos avançados
4. **Business** — foco em empresas e páginas

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

## Pendências / Inconsistências Conhecidas

- `useColors.ts` está forçando **light theme**, mas o documento de arquitetura define **dark mode**. Aguardando confirmação do usuário sobre qual tema aplicar às telas principais.
- Aba **Mercado** atualmente exibe conteúdo de marketplace (vinhos à venda). Deve ser convertida para **Adega Virtual + Certificações**.
- Níveis de conta no código usam `gratuito/basico/executivo`. Devem ser atualizados para `basico/premium/exclusive/business`.
