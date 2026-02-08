---
phase: 01-fundacao
plan: 01
subsystem: foundation
tags: [database, auth, supabase, rbac, design-system, tailwind]
dependency_graph:
  requires: []
  provides:
    - supabase-client-factories
    - database-schema
    - typescript-types
    - environment-validation
    - design-tokens
  affects:
    - all-future-phases
tech_stack:
  added:
    - "@supabase/supabase-js": "Browser and server Supabase client"
    - "@supabase/ssr": "SSR-safe Supabase client creation"
    - "zod": "Runtime environment variable validation"
    - "jwt-decode": "JWT token parsing utility"
  patterns:
    - "Supabase client factories (browser, server, middleware)"
    - "RLS-based RBAC with custom JWT claims"
    - "Tailwind CSS v4 @theme directive for design tokens"
key_files:
  created:
    - lib/supabase/client.ts
    - lib/supabase/server.ts
    - lib/supabase/middleware.ts
    - lib/env.ts
    - lib/db/schema.sql
    - types/database.types.ts
    - .env.local.example
  modified:
    - app/globals.css
    - .gitignore
    - package.json
    - package-lock.json
decisions: []
metrics:
  duration_seconds: 146
  completed_date: "2026-02-07"
---

# Phase 01 Plan 01: Foundation Setup Summary

**Supabase authentication, database schema, and medical design system foundation established with RBAC using custom JWT claims**

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Install dependencies, create Supabase clients, env validation, and TypeScript types | bd02fda | Complete |
| 2 | Create database schema SQL and Tailwind design system | f171221 | Complete |

## Implementation Details

### Task 1: Supabase Foundation

**Packages installed:**
- `@supabase/supabase-js` - Core Supabase client library
- `@supabase/ssr` - SSR-safe client factory for Next.js
- `zod` - Runtime schema validation
- `jwt-decode` - JWT token parsing

**Client factories created:**
- **Browser client** (`lib/supabase/client.ts`) - Uses `createBrowserClient` from `@supabase/ssr`
- **Server client** (`lib/supabase/server.ts`) - Uses `createServerClient` with Next.js 16 async `cookies()`, includes try/catch for Server Component cookie limitations
- **Middleware session updater** (`lib/supabase/middleware.ts`) - Implements cookie propagation pattern for auth session refresh

**Environment validation** (`lib/env.ts`) - Zod schema requiring:
- `NEXT_PUBLIC_SUPABASE_URL` (must be valid URL)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (non-empty string)

**TypeScript types** (`types/database.types.ts`):
- `AppRole` type: patient, doctor, admin
- `Patient`, `Doctor`, `Consultation`, `UserRole` interfaces
- `Database` type mapping for type-safe queries

**Environment template** (`.env.local.example`) - Documents required Supabase credentials

### Task 2: Database Schema and Design System

**Database schema** (`lib/db/schema.sql`):

**Enums:**
- `app_role` - patient, doctor, admin
- `consultation_status` - waiting, in_review, contacted, completed
- `urgency_level` - emergency, urgent, less_urgent, non_urgent

**Tables:**
- `user_roles` - Maps users to roles for RBAC
- `patients` - Patient profiles with CPF, birth date, phone
- `doctors` - Doctor profiles with CRM, specialty
- `consultations` - Consultation records with status, transcript, summary, urgency, hypotheses

**RBAC implementation:**
- `custom_access_token_hook()` - PL/pgSQL function that injects user role into JWT claims
- `authorize(role)` - Helper function for role-based policy checks
- Row Level Security (RLS) enabled on all tables
- Policies: patients see own data, doctors see all patients/consultations

**Triggers:**
- `updated_at` trigger on consultations table

**Design system** (`app/globals.css`):

Tailwind CSS v4 `@theme` directive with medical-themed tokens:
- **Primary colors**: Blue shades (#2563eb, #3b82f6, #1d4ed8)
- **Secondary colors**: Cyan shades (#0891b2, #06b6d4)
- **Accent**: Purple (#8b5cf6)
- **Status colors**: Success (green), warning (orange), danger (red)
- **Urgency colors**: Emergency (red), urgent (orange), less urgent (amber), non urgent (green)
- **Surface colors**: White, light gray, dark slate
- **Text colors**: Primary (slate), secondary, muted
- **Fonts**: Geist Sans and Geist Mono with fallbacks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed .gitignore to allow .env.local.example tracking**
- **Found during:** Task 1 commit
- **Issue:** `.env*` pattern in .gitignore blocked `.env.local.example` from being committed, preventing documentation of required environment variables
- **Fix:** Changed `.env*` to specific patterns (`.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`, `.env`) to allow `.env.local.example` to be tracked
- **Files modified:** `.gitignore`
- **Commit:** bd02fda (included in Task 1 commit)
- **Rationale:** Example files must be tracked to document required configuration for other developers

## Verification Results

All verification checks passed:
- TypeScript compilation passes with no errors (`npx tsc --noEmit`)
- All required files exist:
  - lib/supabase/client.ts
  - lib/supabase/server.ts
  - lib/supabase/middleware.ts
  - lib/env.ts
  - lib/db/schema.sql
  - types/database.types.ts
  - .env.local.example
- Schema contains all 4 tables: user_roles, patients, doctors, consultations
- RLS enabled on all tables
- Custom access token hook function present
- Design tokens defined in globals.css with @theme directive

## Next Phase Readiness

**Blockers:** None

**User setup required before Phase 02:**
1. Create Supabase project at https://supabase.com/dashboard
2. Copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`
3. Run `lib/db/schema.sql` in Supabase SQL Editor
4. Enable Custom Access Token Hook in Supabase Dashboard:
   - Authentication -> Hooks -> Custom Access Token Hook
   - Select `public.custom_access_token_hook`

**Ready for:** Phase 01 Plan 02 (Layout Base) - All foundation infrastructure in place

## Self-Check: PASSED

**Files verified:**
```
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/.env.local.example
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/lib/env.ts
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/lib/supabase/client.ts
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/lib/supabase/server.ts
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/lib/supabase/middleware.ts
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/lib/db/schema.sql
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/types/database.types.ts
FOUND: C:/Users/leand/Documents/Porjetos/triagemvirtual/app/globals.css
```

**Commits verified:**
```
FOUND: bd02fda - chore(01-01): install dependencies and create Supabase clients
FOUND: f171221 - feat(01-01): create database schema and medical design system
```
