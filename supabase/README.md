# Supabase setup

The app syncs to the Supabase project **dj-set-planner** (region eu-north-1).

- `migrations/` — the `records` table (one JSON row per track/set), row-level security so only the account owner can read/write, and a trigger that keeps the newest version.
- `functions/create-account/` — Edge Function that creates the single owner account from a username + password (no email is sent). JWT verification is on; the app calls it with the public anon key. Once one account exists, it refuses new ones.

The app's URL and anon key live in `src/sync/supabase.ts` (public by design; access is enforced by RLS).
