# Phase 2: Segurança e Compliance - Research

**Researched:** 2026-02-07
**Domain:** LGPD compliance, Row Level Security (RLS), consent management
**Confidence:** HIGH

## Summary

Phase 2 implements security and LGPD (Lei Geral de Proteção de Dados - Brazil's General Data Protection Law) compliance for health data collection. The phase requires three main components: (1) LGPD consent screen before triage, (2) Row Level Security policies in Supabase, and (3) consent record tracking with audit trail.

LGPD treats health data as sensitive personal data requiring explicit, specific, informed, and unambiguous consent in writing (electronic forms qualify). Consent must be given for specific purposes (generic authorizations are void), and withdrawal must be as easy as granting consent. Controllers bear the burden of proving consent compliance.

Supabase RLS is already partially implemented in the schema but needs additional policies for consultations table insert operations. Performance optimization requires indexes on user_id columns and wrapping auth.uid() in SELECT statements to cache results. The consent tracking database needs specific fields for LGPD audit compliance: timestamp, IP address (anonymized), consent version, and withdrawal tracking.

**Primary recommendation:** Implement consent modal before triage using client-side dialog component, store consent records with full audit trail, and add missing RLS policy for consultation creation while optimizing existing policies with indexes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase RLS | PostgreSQL 15+ | Row-level access control | Built-in auth integration, declarative policies, excellent performance with proper indexing |
| Next.js Server Actions | 16.1.6 | Consent form submission | Already in use for signup, provides CSRF protection and progressive enhancement |
| Tailwind CSS | 4.x | UI styling | Already in project, no additional UI library needed for consent modal |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.3.6 | Consent validation | Already in project, type-safe validation for consent data |
| jwt-decode | 4.0.0 | JWT claim extraction | Already in project, needed for role-based RLS verification |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom consent modal | shadcn/ui Dialog + React Hook Form | More features but adds dependencies (React Hook Form, Radix UI). Current stack sufficient for simple consent modal. |
| Cookie consent library | CookieYes, Usercentrics | Overkill for health data consent (focused on cookie/tracking consent). Need custom LGPD health consent flow. |
| Custom RLS functions | Supabase built-in helpers | Custom functions add complexity without benefit. auth.uid() and authorize() helper already created. |

**Installation:**
```bash
# No new packages needed - using existing stack
# Already installed: zod, jwt-decode, @supabase/supabase-js
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── patient/
│   └── consent/          # Consent screen route (blocks dashboard access)
│       ├── page.tsx      # Consent form UI
│       └── actions.ts    # Server action to save consent
lib/
├── db/
│   ├── schema.sql        # Add consent_records table + RLS policies
│   └── migrations/       # Future: migration scripts
middleware.ts             # Update: check consent before allowing triage access
```

### Pattern 1: Consent-Gated Access
**What:** Middleware checks for valid consent before allowing access to triage/dashboard. Redirects to /patient/consent if missing or expired.

**When to use:** Before any health data collection (triage flow).

**Example:**
```typescript
// Source: Supabase RLS patterns + LGPD requirements
// In middleware/proxy
if (pathname.startsWith('/patient/dashboard') || pathname.startsWith('/patient/triage')) {
  const { data: consent } = await supabase
    .from('consent_records')
    .select('id, consented_at, version')
    .eq('user_id', user.id)
    .eq('withdrawn_at', null)
    .order('consented_at', { ascending: false })
    .limit(1)
    .single()

  if (!consent) {
    return NextResponse.redirect(new URL('/patient/consent', request.url))
  }
}
```

### Pattern 2: Audit Trail with Version Tracking
**What:** Store consent records with timestamp, IP (anonymized), version, and track withdrawals separately (soft delete).

**When to use:** All consent operations (grant, withdraw, update).

**Example:**
```sql
-- Source: GDPR/LGPD consent tracking standards
CREATE TABLE public.consent_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  consent_type text NOT NULL DEFAULT 'health_data_collection',
  consented_at timestamptz DEFAULT now() NOT NULL,
  withdrawn_at timestamptz,
  ip_address_hash text NOT NULL, -- SHA-256 hash, not raw IP
  version text NOT NULL, -- e.g., 'v1.0' - tracks T&C version
  consent_text text NOT NULL, -- Full text shown to user
  user_agent text
);

CREATE INDEX idx_consent_user_active ON consent_records(user_id, withdrawn_at)
  WHERE withdrawn_at IS NULL;
```

### Pattern 3: RLS Policy Optimization (Function Wrapping)
**What:** Wrap auth.uid() in SELECT to cache result per-statement instead of per-row evaluation.

**When to use:** All RLS policies using auth.uid() or auth.jwt().

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- BEFORE (slow - calls auth.uid() per row)
CREATE POLICY "Patients can view own consultations"
  ON consultations FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM patients WHERE id = patient_id));

-- AFTER (fast - caches auth.uid() result)
CREATE POLICY "Patients can view own consultations"
  ON consultations FOR SELECT
  USING ((SELECT auth.uid()) = (SELECT user_id FROM patients WHERE id = patient_id));
```

### Pattern 4: LGPD Consent Screen Requirements
**What:** Modal/screen before triage with specific purpose, clear language (Portuguese), separate accept/reject buttons, scrollable full text.

**When to use:** First access to triage, after consent withdrawal, after version update.

**Example:**
```typescript
// Source: LGPD Article 8 + consent UX best practices
'use client'

export default function ConsentPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        Consentimento para Coleta de Dados de Saúde
      </h1>

      {/* Scrollable consent text */}
      <div className="border border-border rounded-lg p-4 h-96 overflow-y-auto mb-6 bg-surface">
        <h2 className="font-semibold mb-2">Finalidade Específica</h2>
        <p className="mb-4">
          Coletamos seus dados de saúde para realizar triagem virtual e conectá-lo(a)
          a um médico. Os dados incluem: sintomas, histórico médico, e gravidade.
        </p>

        <h2 className="font-semibold mb-2">Seus Direitos</h2>
        <p className="mb-4">
          Você pode revogar este consentimento a qualquer momento em Configurações &gt;
          Privacidade. A revogação não afeta o processamento realizado até o momento.
        </p>

        {/* Full legal text... */}
      </div>

      <form action={handleConsent}>
        {/* Equal prominence buttons - LGPD requirement */}
        <div className="flex gap-4">
          <button
            type="submit"
            name="action"
            value="accept"
            className="flex-1 bg-primary text-white py-3 px-6 rounded-lg font-medium"
          >
            Aceitar e Continuar
          </button>
          <button
            type="submit"
            name="action"
            value="reject"
            className="flex-1 bg-surface text-text-primary border border-border py-3 px-6 rounded-lg font-medium"
          >
            Recusar
          </button>
        </div>
      </form>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Pre-checked consent boxes:** LGPD requires active consent, not passive acceptance
- **Generic consent language:** "I agree to terms" is void under LGPD Article 8 - must specify purpose
- **Storing raw IP addresses:** LGPD requires data minimization - hash/anonymize IP addresses
- **RLS without indexes:** auth.uid() policies on user_id columns need btree indexes or suffer 100x+ slowdown
- **Using service_role key client-side:** Bypasses RLS entirely, catastrophic security vulnerability
- **Hiding withdrawal option:** Must be as easy to withdraw as to grant consent

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Consent version management | Custom versioning system | Database column + timestamp | Simple field tracks version, timestamp proves when user saw which version. No need for complex versioning. |
| IP anonymization | Custom hashing logic | PostgreSQL `digest()` function | Built-in SHA-256: `digest(inet_client_addr()::text, 'sha256')` - cryptographically secure, no external library. |
| JWT claim extraction | Manual base64 decode + JSON parse | jwt-decode library (already installed) | Handles edge cases (padding, encoding), already in dependencies. |
| RLS policy testing | Manual SQL queries | Supabase Dashboard "View as user" | Built-in tool simulates different user contexts without complex test setup. |

**Key insight:** LGPD compliance is about process and documentation, not complex technical solutions. The challenging part is legal text and UX, not implementation.

## Common Pitfalls

### Pitfall 1: Missing RLS Policy for INSERT on consultations
**What goes wrong:** Patients cannot create consultation records even though they own the data.

**Why it happens:** Current schema has SELECT policy for patients on consultations but no INSERT policy. Phase 3 (triage) will need patients to insert their own consultation records.

**How to avoid:** Add INSERT policy now during security phase.
```sql
CREATE POLICY "Patients can create own consultations"
  ON consultations FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = (SELECT user_id FROM patients WHERE id = patient_id)
  );
```

**Warning signs:** 403 Forbidden errors when patient tries to start triage.

### Pitfall 2: Consent Modal Accessibility Issues
**What goes wrong:** Screen readers can't navigate consent text, keyboard users can't scroll, mobile users can't read full text.

**Why it happens:** Forgetting semantic HTML, ARIA labels, and responsive design in rush to implement.

**How to avoid:**
- Use `<dialog>` element or proper ARIA roles
- Ensure scrollable area has `tabindex="0"` and keyboard scroll support
- Test with screen reader (NVDA/JAWS on Windows)
- Ensure minimum 16px font size on mobile

**Warning signs:** Accessibility audit failures, user complaints about "can't read terms".

### Pitfall 3: RLS Performance Degradation on Large Tables
**What goes wrong:** Queries take 10+ seconds as consultation records grow beyond 10k rows.

**Why it happens:** Missing indexes on columns used in RLS policies (user_id, patient_id).

**How to avoid:** Add indexes immediately during schema setup:
```sql
-- On patients table
CREATE INDEX idx_patients_user_id ON patients(user_id);

-- On consultations table
CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);

-- On consent_records table (combined index for common query)
CREATE INDEX idx_consent_user_active ON consent_records(user_id, withdrawn_at)
  WHERE withdrawn_at IS NULL;
```

**Warning signs:** Slow dashboard loads, timeout errors, Supabase performance advisor warnings.

### Pitfall 4: Forgetting Consent Withdrawal Flow
**What goes wrong:** Users can grant consent but have no way to withdraw it, violating LGPD Article 8.

**Why it happens:** Focusing only on "happy path" (user consents and uses app), not considering user rights.

**How to avoid:**
- Add "Withdraw Consent" button in patient settings
- Soft delete (set withdrawn_at timestamp, don't delete record - need audit trail)
- After withdrawal, block access to triage and show re-consent option
- Document withdrawal process in privacy policy

**Warning signs:** LGPD audit findings, user complaints, regulatory warnings.

### Pitfall 5: Not Logging IP Address for Audit Compliance
**What goes wrong:** During LGPD audit, cannot prove when/where consent was given.

**Why it happens:** Treating consent as simple boolean flag without audit context.

**How to avoid:** Capture and hash IP address during consent:
```typescript
// In server action
const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
const ipHash = createHash('sha256').update(ip).digest('hex')

await supabase.from('consent_records').insert({
  user_id: user.id,
  ip_address_hash: ipHash,
  consented_at: new Date().toISOString(),
  version: 'v1.0',
  consent_text: CONSENT_TEXT_V1
})
```

**Warning signs:** Missing audit trail data, cannot respond to regulatory inquiries.

## Code Examples

Verified patterns from official sources:

### Example 1: RLS Policy with Role Targeting and Function Wrapping
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Optimized patient access policy

-- Enable RLS
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- Policy: Patients can view own consultations
CREATE POLICY "Patients can view own consultations"
  ON consultations
  FOR SELECT
  TO authenticated  -- Specify role to avoid unnecessary evaluation
  USING (
    (SELECT auth.uid()) = (  -- Wrap auth.uid() to cache result
      SELECT user_id FROM patients WHERE id = patient_id
    )
  );

-- Policy: Patients can create consultations for themselves
CREATE POLICY "Patients can create own consultations"
  ON consultations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = (
      SELECT user_id FROM patients WHERE id = patient_id
    )
  );

-- Add index for performance (100x+ improvement)
CREATE INDEX idx_consultations_patient_id ON consultations USING btree (patient_id);
```

### Example 2: Consent Records Table Schema
```sql
-- Source: GDPR/LGPD audit trail standards
-- Full audit trail for consent management

CREATE TABLE public.consent_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  consent_type text NOT NULL DEFAULT 'health_data_collection',
  consented_at timestamptz DEFAULT now() NOT NULL,
  withdrawn_at timestamptz,  -- NULL = active, timestamp = withdrawn
  ip_address_hash text NOT NULL,  -- SHA-256 hash for privacy
  version text NOT NULL,  -- Tracks which T&C version user saw
  consent_text text NOT NULL,  -- Full text shown to user (proves what they agreed to)
  user_agent text,  -- Browser info for audit context

  -- Constraints
  CONSTRAINT valid_withdrawal CHECK (withdrawn_at IS NULL OR withdrawn_at >= consented_at)
);

-- Enable RLS
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Policies: Users can view and manage their own consent records
CREATE POLICY "Users can view own consent records"
  ON consent_records FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own consent records"
  ON consent_records FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own consent records"
  ON consent_records FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Indexes for performance
CREATE INDEX idx_consent_user_id ON consent_records(user_id);
CREATE INDEX idx_consent_user_active ON consent_records(user_id, withdrawn_at)
  WHERE withdrawn_at IS NULL;  -- Partial index for active consents only
```

### Example 3: Server Action for Consent Recording
```typescript
// Source: Next.js Server Actions + LGPD requirements
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto'

const CONSENT_VERSION = 'v1.0'
const CONSENT_TEXT = `[Full legal text that was shown to user...]`

export async function recordConsent(formData: FormData) {
  const action = formData.get('action') as string
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get IP address from headers (Next.js server context)
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ||
             headersList.get('x-real-ip') ||
             '0.0.0.0'

  // Hash IP for privacy (LGPD data minimization)
  const ipHash = createHash('sha256').update(ip).digest('hex')

  if (action === 'accept') {
    // Record consent
    const { error } = await supabase.from('consent_records').insert({
      user_id: user.id,
      consent_type: 'health_data_collection',
      ip_address_hash: ipHash,
      version: CONSENT_VERSION,
      consent_text: CONSENT_TEXT,
      user_agent: headersList.get('user-agent') || 'unknown'
    })

    if (error) {
      return { error: 'Failed to record consent' }
    }

    redirect('/patient/dashboard')
  } else {
    // User rejected - cannot proceed with service
    redirect('/patient/consent-rejected')
  }
}
```

### Example 4: Middleware Consent Check
```typescript
// Source: Next.js middleware patterns + LGPD gating
// Add to existing proxy.ts

async function checkConsent(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('consent_records')
    .select('id')
    .eq('user_id', userId)
    .is('withdrawn_at', null)  // Only active consents
    .order('consented_at', { ascending: false })
    .limit(1)
    .maybeSingle()  // Don't error if no consent found

  return !error && data !== null
}

// In proxy function, before patient dashboard/triage access:
if (pathname.startsWith('/patient/dashboard') || pathname.startsWith('/patient/triage')) {
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const hasConsent = await checkConsent(supabase, user.id)
  if (!hasConsent) {
    return NextResponse.redirect(new URL('/patient/consent', request.url))
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cookie consent banners for all data | Purpose-specific health data consent | LGPD effective Aug 2020 | Generic cookie banners don't satisfy LGPD for health data collection |
| Boolean consent flag | Full audit trail with version/IP/timestamp | GDPR 2018, LGPD 2020 | Regulatory audits now require proof of consent, not just "user consented: true" |
| RLS policies without performance consideration | Function wrapping + indexes | Supabase docs updated ~2023-2024 | Without optimization, RLS becomes bottleneck at 10k+ rows |
| User metadata in JWT for authorization | Custom claims in app_metadata | Supabase best practices 2024 | user_metadata is modifiable by user, insecure for authorization |
| Hard delete consent records | Soft delete with withdrawn_at timestamp | GDPR/LGPD enforcement 2020+ | Deleting consent records destroys audit trail, violates compliance |

**Deprecated/outdated:**
- **Generic "I accept all terms" checkboxes:** LGPD Article 8 invalidates generic consent - must be purpose-specific
- **Storing consent as boolean in user profile:** No audit trail, cannot prove compliance during regulatory review
- **Client-side only consent validation:** Trivial to bypass, must gate at middleware/database level with RLS

## Open Questions

1. **Consent text legal review**
   - What we know: LGPD requires specific purpose, clear language, rights explanation in Portuguese
   - What's unclear: Exact legal wording needs review by Brazilian legal counsel specializing in health data
   - Recommendation: Engage legal counsel before launch; use placeholder text during development with clear "LEGAL REVIEW NEEDED" markers

2. **Consent version migration strategy**
   - What we know: When consent text changes, users need to re-consent
   - What's unclear: How to handle users with old consent during transition period - immediate block vs grace period?
   - Recommendation: Soft block with banner "New privacy terms, please review" for 30 days, then hard block; track version in consent_records table

3. **Minor patient consent (under 18)**
   - What we know: LGPD has special provisions for minors, may require parental consent
   - What's unclear: Age verification process and parental consent flow not specified in requirements
   - Recommendation: Confirm with product owner if minors are in scope; if yes, requires additional legal analysis and separate consent flow

4. **Data retention after consent withdrawal**
   - What we know: LGPD allows retention for legal obligation/regulatory compliance even after withdrawal
   - What's unclear: Exact retention period for medical records in Brazil
   - Recommendation: Consult with Brazilian healthcare regulatory requirements (CFM/Conselho Federal de Medicina) for medical record retention mandates

## Sources

### Primary (HIGH confidence)
- [Supabase Row Level Security Official Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS patterns, performance optimization, function wrapping
- [Supabase Auth RLS Integration](https://supabase.com/docs/guides/auth/row-level-security) - auth.uid() usage, role-based policies
- [LGPD Brazil Article 8 - Consent Requirements](https://lgpd-brazil.info/chapter_02/article_08) - Legal consent requirements, specific purpose mandate
- Project schema.sql - Current RLS implementation, existing policies, auth setup

### Secondary (MEDIUM confidence)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) - Index optimization, query patterns
- [LGPD Compliance Guide - Secure Privacy](https://secureprivacy.ai/blog/lgpd-compliance-requirements) - Consent withdrawal, audit trail requirements
- [Brazil Data Protection - Baker McKenzie](https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/latin-america/brazil/topics/legal-bases-for-processing-of-personal-data) - Legal bases for health data processing
- [GDPR Consent Database Fields - iubenda](https://www.iubenda.com/en/help/6469-consent-solution-getting-started) - Standard consent tracking fields
- [Cookie Consent Implementation 2026 Guide](https://secureprivacy.ai/blog/cookie-consent-implementation) - Audit trail logging, version tracking
- [shadcn/ui Dialog Documentation](https://ui.shadcn.com/docs/components/radix/dialog) - React modal component patterns

### Tertiary (LOW confidence - flagged for validation)
- [LGPD Telemedicine Requirements](https://cms.law/en/int/expert-guides/cms-expert-guide-to-digital-health-apps-and-telemedicine/brazil) - Telemedicine consent requirements (no template found)
- Community articles on RLS optimization (Medium, Dev.to) - Practical examples but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Supabase RLS verified in official docs, existing project dependencies confirmed
- Architecture patterns: HIGH - RLS patterns from official Supabase docs, LGPD requirements from official legal source
- Pitfalls: HIGH - Performance pitfalls documented in official Supabase troubleshooting, LGPD pitfalls from legal compliance guides
- Consent text/legal: LOW - No specific template found, requires legal counsel review

**Research date:** 2026-02-07
**Valid until:** 2026-03-09 (30 days - LGPD stable, RLS stable, Next.js patterns stable)

**Notes:**
- No CONTEXT.md exists for this phase - all implementation choices at Claude's discretion
- RLS already partially implemented in Phase 1 schema - Phase 2 adds consent gating and optimization
- Consent legal text requires professional legal review before production use
- Project uses vanilla Tailwind CSS without UI component library - consent modal will be custom-built
