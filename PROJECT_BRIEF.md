# Odosian Shield — Project Technical Brief

> AI-powered Elastic SIEM detection engineering platform. Build, analyze, enhance, and generate detection rules with AI-driven scoring, MITRE ATT&CK mapping, and attack simulation.

**Status:** Active Development  
**Stack:** Next.js 16 · React 19 · Prisma 7 · SQLite  
**Branch:** master  
**Repo:** github.com/MohdAlkafaween/odosian

---

## What is Odosian

Odosian is a web-based platform for security analysts and detection engineers who work with Elastic Security (formerly Elastic SIEM). It solves the problem of manually writing, reviewing, and maintaining detection rules by bringing AI into the workflow.

A security analyst can:

- **Create detection rules** — write KQL, EQL, ES|QL, or Lucene queries with a Monaco code editor, set severity/risk/MITRE mappings
- **Analyze rules with AI** — get a quality score (0-100) across 10 dimensions: logic accuracy, field validation, performance, false positive potential, evasion resistance, MITRE coverage, query optimization, documentation quality, noise ratio, detection coverage
- **Enhance rules** — AI fixes identified weaknesses and produces an improved query
- **Generate rules from natural language** — describe what you want to detect and AI writes the rule
- **Map to MITRE ATT&CK** — interactive matrix view with tactic/technique/sub-technique coverage
- **Simulate attacks** — red team lab that generates attack commands for MITRE techniques, optionally executing them on connected Kali Linux machines via SSH
- **Manage projects** — group rules into logical projects (e.g., "Endpoint Detection", "Network Monitoring")
- **Use templates** — pre-built rule templates with variables for common detection scenarios

---

## Tech Stack & Versions

Every version matters. The project uses bleeding-edge versions with specific API patterns.

### Core Framework

- **Next.js 16.2.9** — App Router (NOT Pages Router)
- **React 19.2.4**
- **TypeScript 5** — strict mode
- **Turbopack** — dev server bundler

### Database

- **Prisma 7.8+** with driver adapters
- **@prisma/adapter-better-sqlite3**
- **better-sqlite3** — native SQLite
- Generated to `prisma/generated/prisma`

### Styling

- **Tailwind CSS v4** — uses `@theme` in CSS
- NO `tailwind.config.ts` file
- Theme tokens defined in `globals.css`
- PostCSS with `@tailwindcss/postcss`

### Auth & Security

- **jose** — JWT (HS256), httpOnly cookies
- **bcryptjs** — password hashing (cost 12)
- Cookie name: `odosian_token`
- 7-day token expiry

### Other Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| recharts | 3.8 | Dashboard charts |
| @monaco-editor/react | 4.7 | Code editing |
| zustand | 5 | Client state management |
| zod | 4 | Validation (import from `zod/v4`) |
| nodemailer | 9 | Email sending |
| xlsx | 0.18 | Excel export |
| uuid | 14 | UUID generation |

### Infrastructure

- **Docker** — multi-stage build, node:22-alpine
- Entry script handles DB init + seed
- **ESLint 9** — flat config
- Security headers via `next.config.ts`

---

## Critical Patterns You Must Follow

> **Read this section carefully.** These patterns differ from typical Next.js / Prisma tutorials. Getting them wrong will produce runtime errors.

### Next.js 16: params is a Promise

In route handlers and page components, `params` is a **Promise**, not a plain object. You must await it.

```typescript
// CORRECT — Next.js 16
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}

// WRONG — will fail silently or crash
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params; // params is a Promise, not an object
}
```

### Middleware: proxy.ts, NOT middleware.ts

Next.js 16 uses `src/proxy.ts` instead of `middleware.ts`. This handles JWT validation for protected routes. Public routes (login, register, verify, health) bypass auth.

### Auth HOF patterns — authenticate vs requireRole

These have **different** calling conventions:

```typescript
// authenticate() takes handler DIRECTLY (not curried)
export const GET = authenticate(async (request: AuthenticatedRequest) => {
  // ...
});

// requireRole() IS curried — returns a function that takes handler
export const DELETE = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  // ...
});
```

### Tailwind CSS v4 — @theme directive

All theme tokens are defined using `@theme` in `globals.css`. There is NO `tailwind.config.ts`. Do not create one.

### Zod v4 import path

```typescript
import { z } from "zod/v4";  // correct
import { z } from "zod";     // wrong
```

### Prisma client — password omission

The Prisma singleton in `src/lib/prisma.ts` uses `omit: { user: { password: true } }` globally. The password field is excluded from all queries by default — you must explicitly select it when needed for auth.

---

## Project Structure

```
odosian/
├── prisma/
│   ├── schema.prisma          # 16 models
│   ├── seed.ts                # Initial data (users, rules, templates, prompts)
│   ├── generated/prisma/      # Generated Prisma client
│   └── migrations/
├── src/
│   ├── proxy.ts               # Auth middleware (NOT middleware.ts)
│   ├── app/
│   │   ├── globals.css        # Tailwind v4 @theme tokens + custom animations
│   │   ├── layout.tsx         # Root layout (fonts, metadata)
│   │   ├── page.tsx           # Landing page
│   │   ├── verify/            # Email verification
│   │   ├── (auth)/            # Login, register, forgot/reset password
│   │   ├── (dashboard)/       # Dashboard shell + all protected pages
│   │   │   ├── layout.tsx     # Sidebar, topbar, command palette, notifications
│   │   │   └── dashboard/     # All dashboard routes
│   │   └── api/               # All API route handlers
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   ├── sidebar.tsx        # Navigation sidebar
│   │   ├── notification-bell.tsx
│   │   ├── command-palette.tsx # Ctrl+K quick navigation
│   │   ├── dashboard-charts.tsx
│   │   ├── rule-form.tsx
│   │   └── monaco-query-editor.tsx
│   ├── lib/
│   │   ├── prisma.ts          # DB singleton
│   │   ├── auth.ts            # JWT + password utils
│   │   ├── middleware.ts      # authenticate(), requireRole(), rateLimit()
│   │   ├── ai.ts              # AI provider abstraction
│   │   ├── validation.ts      # Zod schemas + XSS sanitization
│   │   ├── audit.ts           # Audit logging
│   │   ├── email.ts           # Nodemailer
│   │   ├── errors.ts          # Error response helpers
│   │   ├── mitre-data.ts      # Static MITRE ATT&CK framework data
│   │   └── webhook-dispatcher.ts
│   └── stores/
│       ├── auth.ts            # Zustand auth store
│       └── toast.ts           # Zustand toast store
├── Dockerfile
├── docker-entrypoint.sh
└── .env
```

---

## Database Schema — 16 Models

SQLite via better-sqlite3 driver adapter. Schema in `prisma/schema.prisma`.

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| **User** | Users with ADMIN/ANALYST roles, email verification, login lockout | → Rules, Analyses, AuditLogs, Projects, AttackSimulations |
| **Rule** | Detection rules (KQL/EQL/ES\|QL/Lucene), severity, risk score, versioning | → User (author), → Analyses, MitreMappings, ProjectRules |
| **Analysis** | AI analysis results (score, rating, findings, suggestions, evasion risks) | → Rule (optional, cascade delete), → User |
| **MitreMapping** | Links rules to ATT&CK tactics/techniques with confidence scores | → Rule (cascade delete) |
| **Project** | Logical grouping of rules | → User (owner), → ProjectRules |
| **ProjectRule** | Join table (Project <-> Rule) | → Project (cascade), → Rule (cascade) |
| **AuditLog** | Immutable activity log (action, target, IP) | → User |
| **Setting** | Key-value config store (categories: ai, display, export, analysis) | — |
| **Prompt** | System prompts for AI operations (analyze, enhance, generate, feedback) | — |
| **AIProvider** | AI provider configs (base URL, API key, model, cost tracking) | — |
| **RuleTemplate** | Pre-built rule templates with variables | — |
| **CustomFieldDefinition** | User-defined field schemas | — |
| **RuleCustomField** | Custom field values per rule | → Rule (cascade) |
| **Webhook** | Outbound webhooks with HMAC signing | — |
| **RateLimit** | Per-user per-endpoint sliding window | — |
| **KaliConnection** | SSH connections to Kali Linux for attack simulation | → AttackSimulations |
| **AttackSimulation** | Red team simulation records | → User, → KaliConnection |
| **MitreAttackPrompt** | Per-technique system prompts for attack simulation | — |

---

## API Routes

All routes under `src/app/api/`. All protected routes use `authenticate()` or `requireRole()`.

### Auth (8 endpoints)

- `POST /api/auth/login` — Email/password login, returns JWT cookie
- `POST /api/auth/register` — Create account, sends verification email
- `POST /api/auth/logout` — Clear auth cookie
- `GET /api/auth/me` — Current user profile
- `POST /api/auth/verify` — Verify email with token
- `POST /api/auth/resend-verification` — Resend verification email
- `POST /api/auth/change-password` — Change password (authenticated)
- `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` — Password reset flow

### Rules (7 endpoints)

- `GET/POST /api/rules` — List all / create new rule
- `GET/PUT/DELETE /api/rules/:id` — CRUD on specific rule
- `POST /api/rules/:id/duplicate` — Clone a rule
- `GET /api/rules/export` — Export rules (JSON/CSV/Excel)
- `POST /api/rules/import` — Import rules from file

### Analysis — AI (6 endpoints)

- `GET /api/analysis` — Analysis history
- `GET/DELETE /api/analysis/:id` — Get/delete specific analysis
- `POST /api/analysis/analyze` — Full AI analysis (10-dimension scoring)
- `POST /api/analysis/enhance` — AI enhancement (fix findings)
- `POST /api/analysis/generate` — Generate rule from natural language
- `POST /api/analysis/feedback` — Quick lightweight assessment

### Attack Lab (6 endpoints)

- `POST /api/attack-lab/simulate` — Run attack simulation for a MITRE technique
- `GET /api/attack-lab/history` — Simulation history
- `GET /api/attack-lab/prompts` — Per-technique simulation prompts
- `POST /api/attack-lab/kali/connect` — Connect to Kali Linux via SSH
- `POST /api/attack-lab/kali/execute` — Execute command on Kali
- `GET/PUT /api/attack-lab/kali/settings` — Kali connection settings

### Other (25+ endpoints)

- `GET /api/dashboard/stats` + `GET /api/dashboard/charts` — Dashboard data
- `GET/POST /api/projects` + `GET/PUT/DELETE /api/projects/:id` — Project CRUD
- `GET/POST/DELETE /api/projects/:id/rules` — Project-rule associations
- `GET/POST /api/templates` + `GET/PUT/DELETE /api/templates/:id`
- `GET /api/mitre` — MITRE ATT&CK data with rule coverage
- `GET /api/audit` — Audit log with filtering
- `GET /api/users` + `GET/PUT/DELETE /api/users/:id` + `POST /api/users/:id/unlock`
- `GET /api/settings` + `GET/PUT /api/settings/:key` — App settings
- `GET/PUT /api/settings/prompts/:id` — AI prompt management
- `GET/PUT /api/settings/providers/:id` — AI provider management
- `GET/POST /api/webhooks` + `GET/PUT/DELETE /api/webhooks/:id` + `POST /api/webhooks/:id/test`
- `GET/POST /api/custom-fields` + `GET/PUT/DELETE /api/custom-fields/:id`
- `GET /api/health` — Health check (public)
- `GET /api/notifications` — Recent audit log notifications

---

## Frontend Pages

### Public

- `/` — Landing page (hero, features, stats)
- `/login` — Sign in
- `/register` — Create account
- `/forgot-password` — Request reset
- `/reset-password` — Set new password
- `/verify` — Email verification

### Dashboard (Protected)

- `/dashboard` — Stats, charts, activity overview
- `/dashboard/rules` — Rules list, create, edit, detail view
- `/dashboard/analysis` — Run analysis, history, detail view
- `/dashboard/projects` — Project management
- `/dashboard/templates` — Rule templates
- `/dashboard/mitre` — ATT&CK matrix view
- `/dashboard/attack-lab` — Red team simulation
- `/dashboard/audit` — Activity log
- `/dashboard/users` — User management (admin only)
- `/dashboard/settings` — App settings
- `/dashboard/profile` — User profile

---

## AI Integration

The AI layer uses any OpenAI-compatible chat completions API. Provider is configurable in the DB.

### How it works

- `src/lib/ai.ts` — core abstraction: `callAI<T>()` and `callAIWithSystemPrompt<T>()`
- Fetches active default `AIProvider` from DB first, falls back to `.env` vars
- Uses OpenAI-compatible `/chat/completions` endpoint
- Robust JSON parsing: strips markdown fences, repairs truncated JSON, cleans trailing commas
- 3 retry attempts with exponential backoff
- Error classification: 401/403 → auth, 429 → rate limit, 503 → service unavailable

### AI Operations

- **Analyze** — 10-dimension scoring (0-100), findings list, MITRE mapping, evasion risks
- **Enhance** — Takes findings, produces improved rule query with explanation
- **Generate** — Natural language → complete detection rule
- **Feedback** — Quick lightweight assessment without full scoring

### System Prompts

Stored in the `Prompt` table (seeded via `prisma/seed.ts`). Editable in Settings. Each contains detailed instructions telling the AI to return structured JSON with specific fields. The prompts are the core intelligence of the platform.

---

## Theme & Design System

Dark cybersecurity theme defined in `src/app/globals.css` using Tailwind v4 `@theme`.

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| bg | `#0B0F19` | Page background |
| surface | `#111827` | Card/panel background |
| surface-light | `#1A2332` | Hover/raised surfaces |
| border | `#1E2D3D` | Default borders |
| primary | `#4CBDFA` | Cyan accent, links, focus |
| success | `#84E29E` | Success states |
| danger | `#EF4444` | Errors, critical severity |
| warning | `#EAB308` | Warnings, medium severity |
| text | `#FFFFFF` | Primary text |
| text-secondary | `#94A3B8` | Secondary text |
| text-muted | `#64748B` | Muted/disabled text |

### Severity Colors

- Critical: `#EF4444` (red)
- High: `#F97316` (orange)
- Medium: `#EAB308` (yellow)
- Low: `#4CBDFA` (cyan)

### Fonts

- **Inter** — sans-serif (body text)
- **JetBrains Mono** — monospace (code, data)

### Animations

12 custom animations: fadeInUp, pulseCyan, radarSweep, float1-4 (particles), shimmer, forgeGlow, forgeLoader, countUp, borderPulse, hexBg

---

## Components

### UI Primitives (`src/components/ui/`)

Badge, Button, Card, Input, Select, Textarea, Modal, ConfirmDialog, DataTable, Pagination, Tabs, Breadcrumb, Toast, Loading, ScoreGauge, StatCard, CodeBlock, SearchInput, EmptyState

### Feature Components (`src/components/`)

- **Sidebar** — navigation + mobile drawer
- **NotificationBell** — polls `/api/notifications`, shows recent audit events
- **CommandPalette** — Ctrl+K quick navigation
- **KeyboardShortcuts** — shortcut reference modal
- **DashboardCharts** — Recharts visualizations
- **RuleForm** — rule creation/editing with Monaco editor
- **MonacoQueryEditor** — code editor with SSR-safe dynamic import
- **AuthGuard** — client-side auth redirect

### Stores (Zustand — `src/stores/`)

- **auth.ts** — user, token, isLoading, fetchUser(), clearAuth()
- **toast.ts** — toasts[], addToast(), removeToast(), 5s auto-dismiss

---

## Utility Reference

| File | Exports | Notes |
|------|---------|-------|
| `prisma.ts` | `prisma` (singleton) | Global cache in dev; omits password by default |
| `auth.ts` | `signToken`, `verifyToken`, `hashPassword`, `comparePassword`, cookie helpers | HS256 via jose; token from cookie or Bearer header |
| `middleware.ts` | `authenticate(handler)`, `requireRole(role)(handler)`, `rateLimit(limit, endpoint)` | authenticate is NOT curried; requireRole IS curried |
| `ai.ts` | `callAI<T>`, `callAIWithSystemPrompt<T>`, `getProvider()` | DB provider first, .env fallback; OpenAI-compatible API |
| `validation.ts` | All Zod schemas, `validateRequest<T>()` | Uses `zod/v4`; includes XSS sanitization |
| `audit.ts` | `logAudit()`, `getClientIp()` | Writes to AuditLog table |
| `email.ts` | `sendVerificationEmail()`, `sendPasswordResetEmail()` | Nodemailer SMTP; 24h token expiry; branded HTML |
| `errors.ts` | `errorResponse()`, `aiErrorResponse()` | Standardized JSON error responses |
| `mitre-data.ts` | `MITRE_TACTICS`, `MITRE_TECHNIQUES` | All 14 tactics with techniques/sub-techniques |
| `webhook-dispatcher.ts` | `dispatchWebhookEvent()` | HMAC-SHA256 signing; 5s timeout; async |

---

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="your-secret-key"
NODE_ENV="development"

# AI Provider (fallback when no DB provider configured)
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://your-provider/v1"
AI_API_KEY="your-api-key"
AI_MODEL="model-name"

# Email (SMTP)
SMTP_HOST="live.smtp.mailtrap.io"
SMTP_PORT=587
SMTP_USER="api"
SMTP_PASS="your-smtp-password"
SMTP_FROM="Odosian <hello@odosian.xyz>"

# App
APP_URL="http://localhost:3000"

# Rate Limits (per minute)
RATE_LIMIT_AI=10
RATE_LIMIT_AUTH=5
RATE_LIMIT_GENERAL=60
```

---

## Seed Data

Run `npx prisma db seed` to populate. Defined in `prisma/seed.ts`.

### Default Users

- **Admin:** admin@odosian.com / Admin@123! (ADMIN role)
- **Analyst:** analyst@odosian.com / Analyst@123! (ANALYST role)

### Seeded Content

- 4 AI prompts (analyze, enhance, generate, feedback)
- 2 AI providers (Gemini, GLM)
- 8 settings (temperature, max tokens, defaults, scoring weights)
- 5 sample detection rules
- 10 rule templates
- 3 projects with rule assignments
- 2 webhooks (inactive)
- 3 custom field definitions
- ~100 MITRE ATT&CK simulation prompts

---

## Security Features

### Built-in Protections

- JWT auth with httpOnly, SameSite=Strict cookies
- bcrypt password hashing (cost 12)
- XSS sanitization in Zod schemas
- Rate limiting per user per endpoint
- Login lockout after failed attempts
- Email verification required
- RBAC: ADMIN and ANALYST roles
- Audit logging for all actions

### Security Headers (next.config.ts)

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- CSP: self-only (unsafe-eval for Monaco)
- Permissions-Policy: no camera/mic/geo

---

## Getting Started

```bash
# Clone and install
git clone https://github.com/MohdAlkafaween/odosian.git
cd odosian
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values (JWT_SECRET, AI provider, SMTP)

# Initialize database
npx prisma generate
npx prisma db push
npx prisma db seed

# Run dev server
npm run dev
```

### Docker

```bash
docker build -t odosian .
docker run -p 3000:3000 -v odosian-data:/data odosian
```

The entrypoint script handles DB initialization and seeding automatically on first run.
