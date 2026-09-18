# Silex Zenith Suite (`silex2.0`)

**Silex Zenith Suite** is a modern, AI-native enterprise workspace and operations management platform built with **TanStack Start**, **React 19**, **Supabase Auth & SSR**, **Drizzle ORM**, **PostgreSQL with pgvector**, and **Tailwind CSS v4**.

---

## 📖 Comprehensive Documentation Suite

All system documentation, architectural specifications, database models, security rules, design tokens, and task tracking records are centrally located in the [`docs/`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/README.md) directory:

- 📄 **[`PRD`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/01_PRD.md)** — Product Requirements & Core Modules
- 📄 **[`Tech Stack`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/02_TECH_STACK.md)** — Architecture & Technology Stack
- 📄 **[`App Flow`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/03_APP_FLOW.md)** — Routing Map & User Journeys
- 📄 **[`Database Schema`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/04_DATABASE_SCHEMA.md)** — 41 Postgres Tables, RFC 9562 UUIDv7 & `pgvector`
- 📄 **[`Security Architecture`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/05_SECURITY.md)** — Auth, RLS Policies & Tenant Isolation
- 📄 **[`Design System`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/06_DESIGN_SYSTEM.md)** — UI Tokens, Glassmorphic Panels & Components
- 📄 **[`Deployment Guide`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/07_DEPLOYMENT.md)** — Setup, Migrations & Hosting
- 📄 **[`Implementation Guide`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/08_IMPLEMENTATION_GUIDE.md)** — Developer Guide & Post-Task Maintenance Protocol
- 📄 **[`Status & Roadmap`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/09_STATUS_AND_ROADMAP.md)** — Current Readiness & Milestones M1–M5
- 📄 **[`Task Tracker`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/10_TASK_TRACKER.md)** — Dynamic Kanban Task Board & Change History

👉 View the **[Documentation Master Index](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/README.md)** for full details.

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run database schema push
npx drizzle-kit push

# Start local development server
npm run dev
```

---

## 🔄 Post-Task Maintenance Protocol

Whenever a task is completed or code is modified, the relevant `.md` documents in `docs/` MUST be updated according to the rules defined in [`docs/08_IMPLEMENTATION_GUIDE.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/08_IMPLEMENTATION_GUIDE.md).
