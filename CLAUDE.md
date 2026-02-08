# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Triagem Virtual — AI-powered medical triage system where patients interact with a voice-enabled AI agent (pt-BR) that collects clinical history, generates structured summaries, and queues them for doctor review.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config, v9)
- No test framework configured yet

## Architecture

Next.js 16.1.6 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + Supabase (PostgreSQL + Auth).

### Route Structure

- `app/(auth)/` — Login/signup pages (route group with centered layout)
- `app/patient/` — Patient-facing pages (requires `patient` role)
- `app/doctor/` — Doctor-facing pages (requires `doctor` role)
- `app/auth/callback/route.ts` — OAuth/email confirmation handler

### Middleware & Route Protection

`proxy.ts` (project root) is the Next.js middleware. It decodes the JWT from Supabase session cookies, extracts the `user_role` claim, and enforces role-based access:
- Unauthenticated users → redirected to `/login`
- Patients accessing `/doctor/*` → redirected to `/patient/dashboard`
- Doctors accessing `/patient/*` → redirected to `/doctor/dashboard`
- Root `/` → redirects by role

### Supabase Integration

- `lib/supabase/client.ts` — Browser-side client (SSR-compatible)
- `lib/supabase/server.ts` — Server-side client (cookie-based sessions)
- `lib/supabase/middleware.ts` — Session refresh for middleware
- `lib/env.ts` — Zod validation for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Auth Flow

Supabase Auth with email/password. On signup, server action creates auth user + `patients` row + `user_roles` row. A custom Supabase JWT hook (`custom_access_token_hook`) injects the user's role into the access token as `user_role` claim. Roles: `patient`, `doctor`, `admin`.

### Database Schema (`lib/db/schema.sql`)

Tables: `user_roles`, `patients`, `doctors`, `consultations`. All have RLS enabled. The `authorize(requested_role)` SQL function checks JWT claims for role-based access. Foreign keys to `auth.users` use `ON DELETE CASCADE`.

### Types

`types/database.types.ts` — App-level TypeScript interfaces (`Patient`, `Doctor`, `Consultation`, `UserRole`, `AppRole`). These are hand-maintained, not auto-generated.

## Conventions

- **UI language**: Portuguese (Brazil). **Code/commits**: English
- **Path alias**: `@/*` maps to project root (e.g., `@/lib/supabase/server`)
- **Server actions**: Use React 19 `useActionState` hook. Actions return `{ error?: string, success?: string }`
- **Styling**: Tailwind CSS 4 with custom theme tokens defined via `@theme` in `app/globals.css` (colors: `--color-primary`, urgency levels, surfaces, etc.)
- **Components**: `components/layout/` for layout pieces (patient header, doctor sidebar, sign-out button). No component library — all Tailwind utility classes
- **Layouts**: Patient uses horizontal header (`PatientHeader`), Doctor uses vertical sidebar (`DoctorSidebar`)

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
```

## Compliance Context

This is a healthcare application subject to LGPD (Brazilian data protection) and CFM telemedicine regulations. Medical records must be retained for 20 years. Health data is classified as sensitive — requires explicit consent. Keep this in mind when modifying data handling, storage, or deletion logic.

## Planning Documents

Development follows a 9-phase roadmap tracked in `.planning/`:
- `PROJECT.md` — Project overview and scope
- `ROADMAP.md` — Phase breakdown and plan details
- `STATE.md` — Current progress and decisions
- `REQUIREMENTS.md` — Detailed requirements by phase
