---
phase: 01-fundacao
plan: 03
subsystem: auth
tags: [next.js, middleware, route-protection, rbac, jwt, layout]

# Dependency graph
requires:
  - phase: 01-02
    provides: Supabase auth setup with login/signup pages
provides:
  - Next.js 16 proxy.ts middleware with role-based route protection
  - Patient area layout with horizontal header navigation
  - Doctor area layout with vertical sidebar navigation
  - Sign-out functionality across both areas
  - Dashboard placeholders for patient and doctor
affects: [01-04, phase-03, phase-06, phase-07]

# Tech tracking
tech-stack:
  added: [jwt-decode@4.0.0]
  patterns: [route-group-layouts, role-based-access-control, jwt-role-extraction]

key-files:
  created:
    - app/proxy.ts
    - components/layout/sign-out-button.tsx
    - components/layout/patient-header.tsx
    - components/layout/doctor-sidebar.tsx
    - app/(patient)/layout.tsx
    - app/(patient)/dashboard/page.tsx
    - app/(doctor)/layout.tsx
    - app/(doctor)/dashboard/page.tsx
  modified:
    - lib/supabase/middleware.ts
    - app/page.tsx
    - app/layout.tsx

key-decisions:
  - "Modified middleware.ts to return supabase client for JWT access in proxy.ts"
  - "Used route groups (patient) and (doctor) for distinct layout hierarchies"
  - "Made PatientHeader a client component to use usePathname for active state"
  - "All UI text in pt-BR, code in English per project standards"

patterns-established:
  - "Route protection via proxy.ts with updateSession integration"
  - "Role extraction from JWT user_role claim for access control"
  - "Layout composition: route groups define area-specific chrome"
  - "SignOutButton reusable across both patient and doctor areas"

# Metrics
duration: 15min
completed: 2026-02-07
---

# Phase 01 Plan 03: Auth Middleware and Layout Structure Summary

**Next.js 16 proxy.ts middleware with JWT role-based access control, separate patient/doctor layouts with navigation, and dashboard placeholders**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-07
- **Completed:** 2026-02-07
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Route protection enforces authentication across all protected routes
- Role-based access control prevents patients from accessing doctor area and vice versa
- Patient area has horizontal header navigation with home and triage links
- Doctor area has vertical sidebar navigation with patient queue, history, and settings
- Both areas have functioning sign-out buttons that redirect to login
- Root page redirects based on authentication state and user role

## Task Commits

Each task was committed atomically:

1. **Task 1: Create proxy.ts for route protection with role-based redirects** - `b1abe9d` (feat)
2. **Task 2: Create patient/doctor layouts with navigation components** - `975f77e` (feat)

## Files Created/Modified
- `app/proxy.ts` - Next.js 16 middleware for route protection, JWT role extraction, and role-based redirects
- `lib/supabase/middleware.ts` - Modified to return supabase client for session access
- `app/page.tsx` - Replaced boilerplate with auth-based redirect logic
- `app/layout.tsx` - Updated to pt-BR locale and correct metadata
- `components/layout/sign-out-button.tsx` - Reusable client component for auth sign-out
- `components/layout/patient-header.tsx` - Horizontal header with navigation for patient area
- `components/layout/doctor-sidebar.tsx` - Vertical sidebar with navigation for doctor area
- `app/(patient)/layout.tsx` - Patient route group layout with header
- `app/(patient)/dashboard/page.tsx` - Patient dashboard placeholder with CTA
- `app/(doctor)/layout.tsx` - Doctor route group layout with sidebar
- `app/(doctor)/dashboard/page.tsx` - Doctor dashboard placeholder with empty queue state

## Decisions Made

1. **Modified middleware.ts to return supabase client** - Proxy.ts needs access to the session's access_token for JWT decoding. Rather than recreating the client or reading cookies directly, modified updateSession to return the supabase client instance alongside user and response.

2. **PatientHeader as client component** - Initially planned as server component, but usePathname() is required for active link highlighting, which requires 'use client' directive.

3. **Route group naming** - Used `(patient)` and `(doctor)` route groups to create distinct layout hierarchies without affecting URL structure.

4. **All UI text in pt-BR** - Strictly followed project standard: "Inicio", "Nova Triagem", "Sair", "Bem-vindo", "Fila de Pacientes", etc. Code remains in English.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified without errors.

## User Setup Required

None - no external service configuration required. This plan builds on the Supabase configuration completed in 01-02.

## Next Phase Readiness

**Ready for Phase 01 Plan 04 (Design System)**
- Route protection and RBAC foundation complete
- Layout structure established for both patient and doctor areas
- Navigation components ready for design token application
- Dashboard placeholders ready for feature implementation in later phases

**No blockers or concerns.**

## Self-Check: PASSED

All created files verified:
```
FOUND: app/proxy.ts
FOUND: components/layout/sign-out-button.tsx
FOUND: components/layout/patient-header.tsx
FOUND: components/layout/doctor-sidebar.tsx
FOUND: app/(patient)/layout.tsx
FOUND: app/(patient)/dashboard/page.tsx
FOUND: app/(doctor)/layout.tsx
FOUND: app/(doctor)/dashboard/page.tsx
```

All commits verified:
```
975f77e feat(01-03): create patient/doctor layouts with navigation
b1abe9d feat(01-03): implement route protection with role-based redirects
```

TypeScript compilation: PASSED (no errors)

---
*Phase: 01-fundacao*
*Completed: 2026-02-07*
