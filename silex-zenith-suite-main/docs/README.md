# Silex Zenith Suite — Documentation Master Index

Welcome to the central documentation directory for **Silex Zenith Suite (`silex2.0`)**. This directory contains comprehensive, production-grade documentation detailing all functional, technical, database, security, design, deployment, and operational aspects of the platform.

---

## 📚 Documentation Directory

| File                                                                                                                            | Section Name                            | Summary / Contents                                                                                                         |
| :------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| 📄 [`01_PRD.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/01_PRD.md)                                   | **Product Requirements Document (PRD)** | Vision, Core Business Modules, User Stories, Scope, and Feature Specifications.                                            |
| 📄 [`02_TECH_STACK.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/02_TECH_STACK.md)                     | **Tech Stack & Architecture**           | Fullstack SSR architecture, Frameworks (TanStack Start, Vite, React 19, Supabase, Drizzle ORM, Tailwind v4).               |
| 📄 [`03_APP_FLOW.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/03_APP_FLOW.md)                         | **App Flow & Navigation Map**           | Routing hierarchy (`/`, `/auth`, `/onboarding`, `/app/*`), Server Actions, and Data Hydration.                             |
| 📄 [`04_DATABASE_SCHEMA.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/04_DATABASE_SCHEMA.md)           | **Database Schema Reference**           | 41 PostgreSQL tables across 12 domains, RFC 9562 UUIDv7, `pgvector`, Drizzle schemas, and multi-tenant isolation.          |
| 📄 [`05_SECURITY.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/05_SECURITY.md)                         | **Security Architecture**               | Supabase Auth, Row Level Security (RLS), Workspace Scoping, Secret Management, and Audit Trail.                            |
| 📄 [`06_DESIGN_SYSTEM.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/06_DESIGN_SYSTEM.md)               | **UI/UX Design System**                 | Palette tokens, Typography, Glassmorphism, Micro-animations, Silex Zenith Component Catalog.                               |
| 📄 [`07_DEPLOYMENT.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/07_DEPLOYMENT.md)                     | **Deployment & DevOps Guide**           | Local setup, Environment configurations (`.env`), Migrations, Nitro server build, Cloudflare/Vercel hosting.               |
| 📄 [`08_IMPLEMENTATION_GUIDE.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/08_IMPLEMENTATION_GUIDE.md) | **Developer Implementation Guide**      | Codebase layout, Coding standards, Conventions, and **Post-Task Maintenance Protocol**.                                    |
| 📄 [`09_STATUS_AND_ROADMAP.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/09_STATUS_AND_ROADMAP.md)     | **Current Status & Roadmap**            | Active features, Completed milestones, Known issues, and Strategic Roadmap (M1–M5).                                        |
| 📄 [`10_TASK_TRACKER.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/10_TASK_TRACKER.md)                 | **Task & Feature Tracker**              | Real-time Kanban task ledger, priorities, assignees, completion statuses, and changelog history.                           |
| 📄 [`11_REALITY_AUDIT.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/11_REALITY_AUDIT.md)               | **Reality Audit & Gap Analysis**        | Exhaustive read-only implementation map, Route Audit matrix, security risks, top 10 gaps, M1 blockers & execution roadmap. |
| 📄 [`12_PROJECT_RECONSTRUCTION.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/12_PROJECT_RECONSTRUCTION.md) | **Project Reconstruction & State**      | Complete state reconstruction, initial baseline, post-reconstruction task log, and historical milestone checkpoint log.     |


---

## 🔄 Post-Task Maintenance Protocol

To maintain complete synchronization between the codebase and documentation, **every developer or AI assistant MUST update the relevant `.md` files after completing any task**:

1. **Schema Modifications**: Update [`04_DATABASE_SCHEMA.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/04_DATABASE_SCHEMA.md) if tables, columns, or indexes change.
2. **Route/Flow Updates**: Update [`03_APP_FLOW.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/03_APP_FLOW.md) when routes, layouts, or navigation routes change.
3. **Dependency Changes**: Update [`02_TECH_STACK.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/02_TECH_STACK.md) if new libraries or services are added.
4. **Task Completion**: Move completed items in [`10_TASK_TRACKER.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/10_TASK_TRACKER.md) and update milestones in [`09_STATUS_AND_ROADMAP.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/09_STATUS_AND_ROADMAP.md).
