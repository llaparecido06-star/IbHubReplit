# Overview

This project is a pnpm workspace monorepo utilizing TypeScript, designed for the wine market. It comprises a mobile application, a web application, and an API server, all aimed at connecting professionals (Sommeliers, Producers, Importers, Distributors), businesses, and enthusiasts within the wine industry. The platform facilitates networking, content sharing, event management, and access to market data.

**Key Capabilities:**
- Social networking features (posts, comments, likes, connections)
- Virtual wine cellar management
- Professional certifications management
- Business pages for companies
- Job and event opportunities
- Market analytics and insights
- User engagement features (profile views, completeness, referral codes, achievements)
- Subscription-based access to premium features

The project's vision is to create a comprehensive digital ecosystem for the global wine community, fostering connections and facilitating knowledge exchange.

# User Preferences

I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

# System Architecture

The project is structured as a pnpm monorepo using Node.js 24 and TypeScript 5.9.

## Monorepo Structure

- **API Server (`artifacts/api-server/`)**: Built with Express 5, PostgreSQL (via Drizzle ORM), Zod for validation, and Orval for API codegen from OpenAPI spec. It handles API requests, database interactions, and integrations with services like Resend for emails. Key features include Zod-validated environment configuration, generic Zod validation middlewares, IP-based rate limiting, CORS configuration, and a custom error handler.
- **Web App (`artifacts/web/`)**: A React application using Vite, TypeScript, and Tailwind CSS v4. It serves as the primary web interface for the IbHub platform.
    - **UI/UX**: Features a consistent design system with a Navy (`#0d1b2a`), Gold (`#c9a84c`), and Wine (`#722f37`) color palette, Inter font, 12px default border-radius, and a light mode theme.
    - **Technical Implementation**: Integrates with Supabase for backend services (Auth, PostgreSQL) and Stripe for subscriptions. Uses Wouter for routing with `PrivateRoute` and `PublicOnlyRoute` guards.
- **Mobile App (`artifacts/ibhub/`)**: A React Native application built with Expo (Expo Router).
    - **UI/UX**: Emphasizes an elegant, premium, clean aesthetic with a native dark mode. Uses a Navy (`#0d1b2a`) background, Gold (`#c9a84c`) for highlights, and rounded borders (8px or 12px). Serif typography for titles and sans-serif for body text. Auth screens feature a dark navy background with glassmorphism and gold accents. Strictly uses native React Native components, avoiding HTML tags.
    - **Technical Implementation**: Utilizes Supabase for backend services (Auth, PostgreSQL, Storage). Implements a 5-tab navigation structure. Features a `PermissionsContext` for managing user permissions based on subscription tiers and a `PaywallScreen` component for restricted features. Integrates `react-native-svg` for chart components (AreaChart, BarChart).
    - **Database Migrations**: Includes several Supabase schema migrations (`schema.sql`, `migrations_user_blocks_post_hidden.sql`, `migrations_v2.sql`, `migrations_v16_engagement.sql`) to define user profiles, posts, likes, comments, social connections, notifications, stories, conversations, wine cellar, and company pages. Triggers are used for maintaining denormalized counts (e.g., `followers_count`).

## Core Features and Design Patterns

- **Authentication and Authorization**: Managed via Supabase, with distinct contexts (`AuthContext`, `PermissionsContext`) for session management and feature access based on subscription plans (Basic, Premium, Exclusive, Business).
- **Data Validation**: Zod is extensively used across the API server for request validation.
- **Canonical Domain Handling**: The system enforces `https://www.ibhub.com.br` as the canonical domain, with `https://ibhub.com.br` redirecting. This is handled both within the application code (e.g., `getCanonicalWebBaseUrl` helper, API server middleware) and requires external configuration at the DNS and Replit Deployments level.
- **Engagement Features**: Includes profile views tracking, profile completeness bar, QR code sharing, achievements/badges, referral codes, mutual connections display, and regional leaderboards.
- **Reusable Components**: Encourages the creation of reusable UI components (e.g., `GoldButton`, `WineCard`, `FilterChip`) in both web and mobile applications to ensure consistency and reduce code duplication.

# External Dependencies

- **Database**: PostgreSQL (Replit built-in, via `DATABASE_URL`)
- **ORM**: Drizzle ORM
- **Email Service**: Resend (`RESEND_API_KEY`)
- **API Codegen**: Orval (generates from OpenAPI spec)
- **Authentication/Backend-as-a-Service**: Supabase (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SESSION_SECRET`)
- **Payment Processing**: Stripe (for subscriptions)
- **Build Tool**: esbuild (for CJS bundles)
- **Mobile Development**: Expo (React Native framework)
- **Web Development**: Vite (React build tool), Tailwind CSS v4 (styling)