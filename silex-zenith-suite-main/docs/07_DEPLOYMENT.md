# Deployment & Operations Guide — Silex Zenith Suite

## 1. Local Development Setup

### Requirements

- **Node.js**: `v20.0.0+`
- **Package Manager**: `npm` (or `bun`)
- **Database**: Active Supabase project or local PostgreSQL instance with `pgvector` extension enabled.

### Quick Start Command Flow

```bash
# 1. Clone repository
git clone <repository-url>
cd silex-zenith-suite-main

# 2. Install dependencies
npm install

# 3. Environment configuration
cp .env.example .env
# Edit .env and supply VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DATABASE_URL

# 4. Run database migrations
npx drizzle-kit push

# 5. Start local Vite development server
npm run dev
```

The app will start at `http://localhost:3000` (or `http://localhost:5173`).

---

## 2. Environment Variables Checklist (`.env`)

```ini
# Supabase Client Credentials
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...

# Supabase Admin / Database Credentials
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsIn...
DATABASE_URL=postgres://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres

# Application Settings
VITE_APP_URL=http://localhost:3000
NODE_ENV=development

# Optional Integrations
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...
```

---

## 3. Production Build & Deployment Options

### 3.1. Building Production Bundle

```bash
# Type check and build Vite + TanStack Start bundle
npm run build
```

This generates the Nitro production server output in `.output/server/index.mjs` and static client assets in `.output/public/`.

### 3.2. Hosting Options

#### Option A: Vercel / Netlify

1. Connect Git repository to Vercel.
2. Build Command: `npm run build`
3. Output Directory: Preset auto-detected via `@tanstack/react-start`.
4. Configure environment variables in Vercel project settings.

#### Option B: Cloudflare Pages / Workers (via Wrangler)

The repository includes `.wrangler/` setup and `bunfig.toml` / `vite.config.ts` SSR target configuration.
Run `npx wrangler deploy` to push the Nitro Cloudflare Worker bundle to Cloudflare's edge network.

#### Option C: Docker Containerization

Run standard Node container executing `node .output/server/index.mjs` with port 3000 exposed.

---

## 4. Database Migration Management

All schema changes MUST be performed via Drizzle Kit:

```bash
# Generate SQL migration file from schema modifications
npx drizzle-kit generate

# Apply pending migrations to production DB
npx drizzle-kit migrate

# Prototyping schema push (Development only)
npx drizzle-kit push
```
