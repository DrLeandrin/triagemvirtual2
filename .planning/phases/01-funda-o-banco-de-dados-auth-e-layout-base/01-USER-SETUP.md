# User Setup Required — Phase 01 Plan 01

This plan requires manual configuration in external services. Complete these steps before continuing to Phase 01 Plan 02.

## Supabase Setup

**Why needed:** Database, authentication, and storage backend for the entire application

### Step 1: Create Supabase Project

1. Visit https://supabase.com/dashboard
2. Click "New Project"
3. Fill in project details:
   - **Name:** triagemvirtual (or your preferred name)
   - **Database Password:** Generate a strong password (save it securely)
   - **Region:** Choose closest to your users (e.g., South America for Brazil)
4. Click "Create new project"
5. Wait for project provisioning (2-3 minutes)

### Step 2: Get API Credentials

1. In your Supabase project, navigate to:
   **Settings -> API**

2. Copy the following values:
   - **Project URL** (under "Project URL" section)
   - **anon public** key (under "Project API keys" section)

3. Create `.env.local` file in project root:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   Replace with your actual values from step 2.

### Step 3: Run Database Schema

1. In Supabase Dashboard, navigate to:
   **SQL Editor -> New Query**

2. Copy the entire contents of `lib/db/schema.sql` from your project

3. Paste into the SQL Editor

4. Click "Run" to execute the schema

5. Verify tables were created:
   - Navigate to **Database -> Tables**
   - You should see: `user_roles`, `patients`, `doctors`, `consultations`

### Step 4: Enable Custom Access Token Hook

**CRITICAL:** This step enables role-based access control (RBAC) by injecting user roles into JWT tokens.

1. In Supabase Dashboard, navigate to:
   **Authentication -> Hooks**

2. Find "Custom Access Token Hook" section

3. In the dropdown, select:
   `public.custom_access_token_hook`

4. Click "Save"

5. Verify it's enabled:
   - The hook should show as "Enabled" with green indicator
   - Function name should be `public.custom_access_token_hook`

## Verification

After completing all steps, verify setup:

```bash
# Check .env.local exists and has values
cat .env.local

# Run Next.js dev server
npm run dev

# Should start without errors
# Visit http://localhost:3000
```

If you see connection errors, double-check:
- `.env.local` has correct URL and key
- Supabase project is active (not paused)
- Schema was executed successfully

## Next Steps

Once setup is complete, you can proceed to:
- **Phase 01 Plan 02:** Layout Base (navigation, header, footer)
- Begin building authentication UI in later phases

## Troubleshooting

**Error: "Invalid API key"**
- Verify you copied the `anon public` key (not the `service_role` secret)
- Check for extra spaces or line breaks in `.env.local`

**Error: "Could not connect to database"**
- Verify Project URL is correct
- Check Supabase project is not paused (free tier auto-pauses after inactivity)

**Auth hook not working:**
- Verify `custom_access_token_hook` function exists in SQL Editor
- Check hook is enabled in Authentication -> Hooks
- Try disabling and re-enabling the hook

## Environment Variables Reference

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard -> Settings -> API -> Project URL | Supabase project endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard -> Settings -> API -> anon public | Client-side authentication key |

**Security Note:** The `anon public` key is safe to expose in client-side code. It provides limited access controlled by Row Level Security (RLS) policies. Never commit `.env.local` to git.
