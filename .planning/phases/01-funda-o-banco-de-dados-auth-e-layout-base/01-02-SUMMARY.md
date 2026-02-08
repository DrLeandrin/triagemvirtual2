---
phase: 01-fundacao
plan: 02
subsystem: auth
tags: [authentication, supabase, react-19, server-actions]
dependency_graph:
  requires: [01-01]
  provides: [auth-flow, login-page, signup-page, role-assignment]
  affects: [patient-onboarding, auth-middleware]
tech_stack:
  added: [useActionState, exchangeCodeForSession]
  patterns: [server-actions, email-confirmation, metadata-storage]
key_files:
  created:
    - app/(auth)/layout.tsx
    - app/(auth)/login/page.tsx
    - app/(auth)/login/actions.ts
    - app/(auth)/signup/page.tsx
    - app/(auth)/signup/actions.ts
    - app/auth/callback/route.ts
  modified: []
decisions: []
metrics:
  duration: ~15min
  tasks_completed: 2
  completed_date: 2026-02-07
---

# Phase 01 Plan 02: Authentication Pages and User Registration Summary

**One-liner:** Complete patient authentication flow with email/password login, registration with CPF collection, email confirmation callback, and automatic role assignment using Supabase Auth.

## What Was Built

Created a complete authentication system for patient registration and login:

1. **Auth Layout** — Centered, branded layout for authentication pages
2. **Login Flow** — Email/password authentication with Supabase, redirects to patient dashboard
3. **Signup Flow** — Full patient registration collecting name, CPF, email, and password
4. **Email Confirmation** — Callback route that confirms email, creates patient record, and assigns role
5. **User Experience** — All forms use React 19's `useActionState` for progressive enhancement with loading states and error handling

## Tasks Completed

### Task 1: Auth Layout and Login Page
**Commit:** `1dbe6ab`
**Files:** `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`

Created a centered auth layout with app branding and implemented the login page:
- Auth layout provides consistent container (max-w-md) with "Triagem Virtual" heading
- Login page uses React 19's `useActionState` (not deprecated useFormState)
- Server action validates credentials and calls `signInWithPassword`
- Generic error messages in pt-BR for security
- Loading states during submission
- Link to signup page

### Task 2: Signup Page and Auth Callback
**Commit:** `99b0e6d`
**Files:** `app/(auth)/signup/page.tsx`, `app/(auth)/signup/actions.ts`, `app/auth/callback/route.ts`

Created full patient registration flow with email confirmation:
- Signup form collects: full name, CPF (with format validation), email, password, and confirmation
- Server action validates all inputs and stores metadata in `user_metadata`
- Success message instructs user to check email
- Auth callback route handles email confirmation link:
  - Exchanges code for session using `exchangeCodeForSession`
  - Retrieves user metadata (full_name, cpf)
  - Creates patient record in `patients` table
  - Assigns 'patient' role in `user_roles` table
  - Handles duplicate records gracefully (re-confirmation scenario)
  - Supports production deployments with x-forwarded-host header

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All verification criteria passed:

- ✓ `npx tsc --noEmit` passes with no TypeScript errors
- ✓ All auth files exist in correct route group structure: `app/(auth)/*`
- ✓ Login action uses `signInWithPassword` and redirects to `/patient/dashboard`
- ✓ Signup action uses `signUp` with `options.data` for user metadata
- ✓ Callback route uses `exchangeCodeForSession` and creates both patient and role records
- ✓ All user-facing strings are in pt-BR (código, UI labels, error messages)
- ✓ Forms use `useActionState` from React 19 (correct import from 'react')
- ✓ Loading states implemented with `isPending` from useActionState
- ✓ Error/success message display areas functional

## Key Technical Decisions

1. **React 19 useActionState** — Used the new `useActionState` hook instead of deprecated `useFormState`. Signature: `(action, initialState)` returns `[state, formAction, isPending]`.

2. **Metadata Storage** — User metadata (full_name, cpf) stored in Supabase Auth's `user_metadata` during signup, then extracted in callback to populate patient record.

3. **Role Assignment in Callback** — Patient record and role assignment happen in the auth callback after email confirmation, ensuring the user is authenticated before DB writes (avoiding RLS issues).

4. **Generic Error Messages** — Login errors return "E-mail ou senha incorretos" for security (don't reveal if email exists).

5. **CPF Normalization** — CPF input accepts formatted input (000.000.000-00) but stores only digits after validation.

## Next Phase Readiness

**Phase 01 Plan 03 dependencies satisfied:**
- ✓ Auth flow exists for user authentication
- ✓ Patient role assignment working
- ✓ Login/signup pages functional

**Blockers/Concerns:**
- None. Auth pages are ready for middleware protection in Plan 03.
- Patient dashboard route (`/patient/dashboard`) doesn't exist yet but will be created in later plans.

## Self-Check: PASSED

**Files Created:**
```
FOUND: app/(auth)/layout.tsx
FOUND: app/(auth)/login/page.tsx
FOUND: app/(auth)/login/actions.ts
FOUND: app/(auth)/signup/page.tsx
FOUND: app/(auth)/signup/actions.ts
FOUND: app/auth/callback/route.ts
```

**Commits Verified:**
```
FOUND: 1dbe6ab (Task 1)
FOUND: 99b0e6d (Task 2)
```

All files created and commits recorded successfully.
