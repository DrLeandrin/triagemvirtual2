# Phase 1: Fundação - Banco de Dados, Auth e Layout Base - Research

**Researched:** 2026-02-07
**Domain:** Next.js App Router authentication with Supabase, PostgreSQL database setup, role-based access control
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for the triage virtual application using Next.js 16.1.6 App Router with Supabase for authentication, database, and storage. The modern approach uses `@supabase/ssr` package (v0.8.0) for server-side rendering with cookie-based authentication, replacing the older auth-helpers library.

Critical architectural decisions include using Next.js 16's `proxy.ts` instead of deprecated `middleware.ts` for route protection, implementing Supabase Auth Hooks for role-based access control (patient/doctor roles), and enabling Row-Level Security (RLS) policies on all database tables to prevent unauthorized access. Tailwind CSS v4.0+ provides the design system foundation with its new CSS-first configuration approach and Oxide engine for 5x faster builds.

The stack is well-established with extensive official documentation. Main risks center on common security misconfigurations: 83% of exposed Supabase databases involve RLS misconfiguration, primarily from leaving RLS disabled on tables (the default state). Additionally, Next.js 16 introduces a runtime change where `proxy.ts` runs on Node.js runtime only, not Edge, affecting middleware execution strategy.

**Primary recommendation:** Follow Supabase's SSR setup exactly as documented, enable RLS on every table immediately after creation, use Auth Hooks for role management in JWT claims, and implement `auth.getClaims()` for all server-side session validation (never trust `getSession()` in server code).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router framework | Official React framework with server components, streaming, and built-in optimizations |
| React | 19 | UI library | Required by Next.js 16, includes React Server Components |
| TypeScript | 5 | Type safety | Industry standard for large-scale applications, catches errors at compile time |
| @supabase/supabase-js | Latest | Supabase client | Official JavaScript client for Supabase API |
| @supabase/ssr | 0.8.0 | SSR authentication | Official package for server-side rendering, replaces deprecated auth-helpers |
| Tailwind CSS | 4.0+ | Utility-first CSS | New Oxide engine with 5x faster builds, CSS-first configuration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jwt-decode | Latest | JWT token parsing | Accessing custom claims (roles) in client-side code |
| zod | Latest | Runtime validation | Validating environment variables and form inputs |
| @tailwindcss/forms | Latest | Form styling | Styling authentication forms with consistent design |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Auth | NextAuth.js / Auth0 / Clerk | Supabase Auth is tightly integrated with database and RLS, simpler setup for full-stack Supabase projects |
| Supabase DB | Prisma + separate DB | Supabase provides auth, storage, and real-time in one platform with superior DX for rapid prototyping |
| Tailwind CSS | CSS Modules / Styled Components | Tailwind v4 performance and utility-first approach preferred for rapid UI development |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install tailwindcss@latest
npm install --save-dev @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group for auth pages
│   │   ├── login/
│   │   └── signup/
│   ├── (patient)/                # Route group for patient dashboard
│   │   └── dashboard/
│   ├── (doctor)/                 # Route group for doctor dashboard
│   │   └── dashboard/
│   ├── auth/
│   │   └── callback/             # OAuth/Email confirmation callback
│   │       └── route.ts
│   ├── layout.tsx                # Root layout
│   ├── proxy.ts                  # Next.js 16 middleware (renamed from middleware.ts)
│   └── globals.css               # Tailwind imports
├── components/
│   ├── ui/                       # Reusable UI components (buttons, inputs)
│   ├── layout/                   # Layout components (navbar, sidebar)
│   └── features/                 # Feature-specific components
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser client (Client Components)
│   │   ├── server.ts            # Server client (Server Components, Actions, Route Handlers)
│   │   └── middleware.ts        # Middleware client (proxy.ts)
│   ├── db/
│   │   └── schema.sql           # Database schema and migrations
│   └── utils/                   # Utility functions
├── types/
│   └── database.types.ts        # Generated Supabase types
└── .env.local.example           # Example environment variables
```

### Pattern 1: Supabase Client Creation (Server-Side Rendering)
**What:** Create separate Supabase clients for browser, server, and middleware contexts with cookie management.
**When to use:** All authentication flows in Next.js App Router.
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs

// lib/supabase/client.ts - Browser Client (Client Components)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

// lib/supabase/server.ts - Server Client (Server Components, Server Actions, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore, cookies will be set by middleware
          }
        },
      },
    }
  )
}

// lib/supabase/middleware.ts - Middleware Client (proxy.ts)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Use getClaims() not getSession() for security
  const { data: { user } } = await supabase.auth.getClaims()

  return { supabaseResponse, user }
}
```

### Pattern 2: Role-Based Access Control with Auth Hooks
**What:** Use Supabase Auth Hooks to inject user roles into JWT claims, then enforce with RLS policies.
**When to use:** When implementing role-based access (patient vs doctor vs admin).
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac

-- 1. Create role enum
create type public.app_role as enum ('patient', 'doctor', 'admin');

-- 2. Create user_roles table
create table public.user_roles (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

-- 3. Create Auth Hook to inject role into JWT
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    claims jsonb;
    user_role public.app_role;
  begin
    -- Fetch user role
    select role into user_role from public.user_roles
    where user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    -- Set role in JWT claims
    if user_role is not null then
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    else
      claims := jsonb_set(claims, '{user_role}', 'null');
    end if;

    event := jsonb_set(event, '{claims}', claims);
    return event;
  end;
$$;

-- 4. Grant permissions
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant all on table public.user_roles to supabase_auth_admin;
revoke all on table public.user_roles from authenticated, anon, public;

-- 5. Create RLS policy for auth admin
create policy "Allow auth admin to read user roles" ON public.user_roles
as permissive for select
to supabase_auth_admin
using (true);
```

**Client-side role access:**
```typescript
// Source: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
import { jwtDecode } from 'jwt-decode'

const { subscription: authListener } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    if (session) {
      const jwt = jwtDecode(session.access_token)
      const userRole = jwt.user_role // 'patient' | 'doctor' | 'admin'
    }
  }
)
```

### Pattern 3: Next.js 16 Proxy (Middleware) for Route Protection
**What:** Use `proxy.ts` (renamed from `middleware.ts` in Next.js 16) to refresh auth tokens and protect routes.
**When to use:** All protected routes requiring authentication.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
// app/proxy.ts
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  // Protect doctor routes
  if (pathname.startsWith('/doctor')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Check role from JWT claims
    const jwt = jwtDecode(user.access_token)
    if (jwt.user_role !== 'doctor') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // Protect patient routes
  if (pathname.startsWith('/patient')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Exclude static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### Pattern 4: Database Schema with Row-Level Security
**What:** PostgreSQL tables with RLS enabled and policies based on authenticated user.
**When to use:** All database tables handling user data.
**Example:**
```sql
-- Source: Best practices from https://supabase.com/docs/guides/security

-- CRITICAL: Enable RLS on ALL tables (disabled by default!)
create table public.patients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  full_name text not null,
  cpf text unique not null,
  birth_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.patients enable row level security;

-- Policy: Users can only read their own patient record
create policy "Users can view own patient data"
  on public.patients for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own patient record
create policy "Users can insert own patient data"
  on public.patients for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own patient record
create policy "Users can update own patient data"
  on public.patients for update
  using (auth.uid() = user_id);

-- Doctors table with role check
create table public.doctors (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  full_name text not null,
  crm text unique not null,
  specialty text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.doctors enable row level security;

-- Create authorization function (from RBAC pattern)
create or replace function public.authorize(
  requested_role app_role
)
returns boolean as $$
declare
  user_role public.app_role;
begin
  select (auth.jwt() ->> 'user_role')::public.app_role into user_role;
  return user_role = requested_role;
end;
$$ language plpgsql stable security definer set search_path = '';

-- Policy: Only doctors can read doctor table
create policy "Doctors can view doctor data"
  on public.doctors for select
  using (authorize('doctor'));
```

### Anti-Patterns to Avoid

- **Using `getSession()` in server code:** Never trust `supabase.auth.getSession()` in Server Components/Actions. Always use `supabase.auth.getClaims()` which validates tokens server-side.

- **Forgetting to enable RLS:** RLS is DISABLED by default on new tables. 83% of Supabase security breaches involve RLS misconfiguration. Enable RLS immediately after table creation.

- **Storing service_role key in client code:** The `service_role` key bypasses all RLS and grants full database access. NEVER expose it to the browser. Use only in server-side code or Edge Functions.

- **Using `NEXT_PUBLIC_` prefix for secrets:** Environment variables with `NEXT_PUBLIC_` are embedded in client-side JavaScript bundles. Only use for truly public values (Supabase URL and publishable key are safe).

- **Complex business logic in RLS policies:** RLS policies with many joins and subqueries cause performance issues. Keep policies simple, move complex authorization to application code.

- **Overly broad RLS policies:** Policies like `using (true)` defeat the purpose of RLS. Always filter by `auth.uid()` or role-based checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User authentication | Custom JWT auth system | Supabase Auth | Email verification, password reset, OAuth providers, MFA, rate limiting, security best practices all built-in |
| Session management | Custom cookie/token handling | @supabase/ssr | Handles cookie security (HttpOnly, Secure, SameSite), token refresh, SSR hydration issues |
| Password hashing | bcrypt/scrypt implementation | Supabase Auth | Uses Argon2 (current best practice), handles salt generation, timing attack prevention |
| Role-based access | Custom user permissions table | Supabase Auth Hooks + RLS | Roles in JWT claims enable database-level enforcement via RLS policies |
| Email verification | Custom email sending + token validation | Supabase Auth | Built-in email templates, secure token generation, automatic expiration |
| Form validation | Manual field checking | Zod + React Hook Form | Type-safe schemas, async validation, error messages, field-level validation |

**Key insight:** Authentication and authorization are deceptively complex security domains. Custom implementations typically miss edge cases (timing attacks, token refresh race conditions, session fixation, CSRF) that mature libraries handle. Supabase Auth with RLS provides defense-in-depth: even if application logic fails, database-level policies prevent unauthorized access.

## Common Pitfalls

### Pitfall 1: Row-Level Security Disabled (CRITICAL)
**What goes wrong:** Tables created without RLS enabled are accessible to anyone with the Supabase URL and anon key (which is public in client code). 83% of exposed Supabase databases involve this misconfiguration.

**Why it happens:** RLS is DISABLED by default when creating tables. Developers forget to enable it or assume it's on by default.

**How to avoid:**
1. Enable RLS immediately after creating any table: `alter table [table_name] enable row level security;`
2. Create a checklist template for new tables that includes RLS enablement
3. Use Supabase Studio UI which prompts for RLS policies during table creation
4. Run a verification query: `select tablename from pg_tables where schemaname = 'public' and tablename not in (select tablename from pg_tables t join pg_class c on t.tablename = c.relname where c.relrowsecurity = true);`

**Warning signs:**
- Ability to query table data without authentication in API testing
- Supabase Studio shows "RLS disabled" warning on table
- No policies listed in Supabase Studio's Authentication Policies section

### Pitfall 2: Using `getSession()` in Server Code
**What goes wrong:** `supabase.auth.getSession()` reads session from cookies without server-side validation. Attackers can forge cookies to impersonate users.

**Why it happens:** `getSession()` looks like the right method, and it works locally during development. The security issue is subtle and not immediately obvious.

**How to avoid:**
- Always use `supabase.auth.getClaims()` in Server Components, Server Actions, and Route Handlers
- Create a wrapper function that enforces this pattern
- Add ESLint rule to detect `getSession()` usage in server files

**Warning signs:**
- Session validation works in development but fails in production
- Intermittent authentication errors
- Security audit flags cookie validation issues

**Code pattern:**
```typescript
// ❌ WRONG - Don't use in server code
const { data: { session } } = await supabase.auth.getSession()

// ✅ CORRECT - Use getClaims() for validation
const { data: { user } } = await supabase.auth.getClaims()
```

### Pitfall 3: Next.js 16 proxy.ts Runtime Confusion
**What goes wrong:** Developers expect `proxy.ts` to run on Edge runtime (like old `middleware.ts`), but Next.js 16 runs proxy exclusively on Node.js runtime. Edge-only APIs fail.

**Why it happens:** Next.js 16 renamed `middleware.ts` to `proxy.ts` AND changed the runtime from Edge to Node.js. Migration guides focus on renaming, not runtime change.

**How to avoid:**
- Don't use Edge-only APIs in `proxy.ts` (geo-location, IP, etc.)
- Keep proxy lightweight - just auth checks and redirects
- Move heavy logic to Server Components/Actions (this is the design intent)

**Warning signs:**
- Runtime errors about missing Edge APIs
- `process` is available (Node.js) but Edge features aren't
- Performance degradation from heavy proxy logic

### Pitfall 4: Mixing Client and Server Supabase Clients
**What goes wrong:** Using browser client in Server Components or server client in Client Components causes hydration mismatches, missing cookies, or auth failures.

**Why it happens:** Import paths look similar (`@/lib/supabase/client` vs `@/lib/supabase/server`). Easy to import wrong client in wrong context.

**How to avoid:**
- Use clear naming conventions: `createBrowserClient()` and `createServerClient()`
- Add TypeScript lint rule to prevent server imports in client files
- Create a project-wide search for misplaced imports during PR reviews

**Warning signs:**
- "Hydration mismatch" errors in console
- Auth state inconsistent between server and client
- Cookies not being set properly

### Pitfall 5: Missing Environment Variables in Production
**What goes wrong:** Application works locally but auth fails in production because `.env.local` isn't committed to git and environment variables aren't set in deployment platform.

**Why it happens:** `.env.local` is gitignored (correctly for security), but developers forget to configure environment variables in Vercel/deployment platform.

**How to avoid:**
- Create `.env.local.example` with dummy values, commit to git
- Add deployment checklist that includes environment variable verification
- Use `t3-env` or `zod` to validate required environment variables at build time
- Document environment variables in README with links to Supabase dashboard

**Warning signs:**
- "Missing environment variable" errors in production logs
- Build succeeds but runtime authentication fails
- Different behavior between local and deployed environments

**Validation pattern:**
```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export const env = envSchema.parse(process.env)
```

### Pitfall 6: Auth Hook Not Configured in Supabase Dashboard
**What goes wrong:** Custom access token hook function is created but not enabled in Supabase dashboard. Roles aren't added to JWT, authorization fails silently.

**Why it happens:** Creating the SQL function is only half the setup. The hook must be enabled via UI: `Authentication > Hooks (Beta) > Custom Access Token`.

**How to avoid:**
- Document the two-step process: (1) create SQL function, (2) enable in dashboard
- Add verification step: decode JWT after login to confirm role claim exists
- Create setup checklist in project documentation

**Warning signs:**
- Role-based RLS policies always fail
- JWT decoded on client shows no `user_role` claim
- Authorization works for some users but not others (inconsistent hook enablement)

## Code Examples

Verified patterns from official sources:

### Complete Authentication Flow (Sign Up)
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// app/auth/signup/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }

  redirect('/login?message=Check your email to confirm your account')
}
```

### Complete Authentication Flow (Login)
```typescript
// app/auth/login/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
```

### Checking User Role in Server Component
```typescript
// Source: Combined from Supabase RBAC docs
// app/doctor/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'

export default async function DoctorDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getClaims()

  if (!user) {
    redirect('/login')
  }

  // Decode JWT to get role from claims
  const jwt = jwtDecode(user.access_token)

  if (jwt.user_role !== 'doctor') {
    redirect('/unauthorized')
  }

  return <div>Doctor Dashboard</div>
}
```

### Email Confirmation Callback Route Handler
```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Error handling - redirect to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### Tailwind CSS v4 Configuration
```css
/* Source: https://bryananthonio.com/blog/configuring-tailwind-css-v4 */
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Design tokens */
  --color-primary: hsl(210, 100%, 50%);
  --color-secondary: hsl(280, 60%, 50%);
  --color-danger: hsl(0, 70%, 50%);

  /* Spacing scale */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Typography */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'Courier New', monospace;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Q3 2024 | New package required for Next.js 13+, old package deprecated |
| `middleware.ts` (Edge runtime) | `proxy.ts` (Node.js runtime) | Next.js 16 (Jan 2025) | Runtime change affects what APIs are available, lighter weight design |
| JavaScript config `tailwind.config.js` | CSS-first `@theme` directive | Tailwind v4 (Jan 2025) | 5x faster builds, simpler configuration, better type safety |
| `getSession()` for validation | `getClaims()` for server-side | Supabase Auth v2 (2024) | Security improvement - server-side token validation required |
| Manual role tables + policies | Auth Hooks with JWT claims | Supabase Auth Hooks (Q2 2024) | Roles in JWT enable RLS without database queries |
| `service_role` and `anon` keys | Publishable keys (`sb_publishable_xxx`) | Ongoing transition (2026) | Both formats work, new format preferred for clarity |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`, no longer maintained
- `createMiddlewareSupabaseClient`: Old helper function, use `createServerClient` with cookie handlers from `@supabase/ssr`
- `middleware.ts` filename: Renamed to `proxy.ts` in Next.js 16, still works but shows deprecation warning
- `getUser()` without validation: Always use `getClaims()` in server contexts for security
- Tailwind v3 JavaScript config: Works but v4 CSS-first approach is recommended for new projects

## Open Questions

1. **Database migration strategy**
   - What we know: Supabase supports SQL migrations via CLI and dashboard
   - What's unclear: Best practices for team collaboration on schema changes, rollback procedures
   - Recommendation: Use Supabase CLI with migration files in git, document in Phase 2 planning

2. **Multi-role users (patient who is also doctor)**
   - What we know: Current RBAC pattern assumes one role per user (enum, not array)
   - What's unclear: Whether requirements allow same person to have both roles simultaneously
   - Recommendation: Confirm with requirements - if needed, change `app_role` from enum to table with many-to-many relationship

3. **Email template customization**
   - What we know: Supabase provides default email templates for confirmation, password reset
   - What's unclear: Whether templates need customization for branding, Portuguese language
   - Recommendation: Review default templates, customize in Supabase dashboard if needed (pt-BR language requirement)

4. **Rate limiting on authentication endpoints**
   - What we know: Supabase Auth has built-in rate limiting
   - What's unclear: Default limits, whether they're sufficient for expected traffic
   - Recommendation: Document rate limits from Supabase dashboard, plan monitoring in Phase 2

## Sources

### Primary (HIGH confidence)
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) - Complete setup guide, client creation patterns
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) - Auth Hooks implementation, RLS with roles
- [Next.js Proxy (Middleware) Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) - Next.js 16 proxy.ts patterns
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) - New features, CSS-first configuration
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16) - proxy.ts rename, runtime changes
- [@supabase/ssr npm package](https://www.npmjs.com/package/@supabase/ssr) - Version 0.8.0 information

### Secondary (MEDIUM confidence)
- [Supabase Best Practices - Leanware](https://www.leanware.co/insights/supabase-best-practices) - Security patterns, verified against official docs
- [Supabase Security Misconfigurations - ModernPentest](https://modernpentest.com/blog/supabase-security-misconfigurations) - RLS pitfalls (83% statistic)
- [Complete Authentication Guide for Next.js App Router - Clerk](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) - Auth patterns, cross-referenced with Supabase docs
- [Next.js Authentication & Authorization - Auth0](https://auth0.com/blog/whats-new-nextjs-16/) - Next.js 16 auth patterns
- [A First Look at Tailwind CSS v4.0 - Bryan Antonio](https://bryananthonio.com/blog/configuring-tailwind-css-v4/) - Migration guide, verified against official docs
- [Next.js App Router Project Structure - Makerkit](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure) - Architecture patterns

### Tertiary (LOW confidence - marked for validation)
- Community blog posts on Medium about Supabase setup - useful for real-world patterns but not verified
- GitHub discussions about RBAC implementation - provide context but need official doc verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages have official documentation, stable versions, clear installation paths
- Architecture: HIGH - Official Supabase and Next.js docs provide complete patterns with code examples
- Pitfalls: HIGH - RLS misconfiguration statistics verified by multiple security sources, Next.js 16 changes from official changelog
- RBAC implementation: HIGH - Official Supabase documentation with working code examples
- Tailwind v4 setup: MEDIUM - Recently released (Jan 2025), stable but ecosystem still adapting

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stack is stable, but Next.js and Supabase iterate monthly)

**Notes for planner:**
- No CONTEXT.md exists, full discretion on implementation details
- Focus on security-first approach: RLS enabled by default, Auth Hooks for roles, server-side validation
- Next.js 16 proxy.ts is new - include migration/setup as explicit task
- Tailwind v4 setup differs from v3 - document CSS-first approach
- Portuguese language requirement affects email templates and UI text
