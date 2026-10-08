import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Creates the single owner account for DJ Set Planner from a username + password.
// No email is sent: the username is mapped to an internal address.
// Only one account may exist; after that, signing up is refused.

const EMAIL_DOMAIN = 'users.djsetplanner.invalid';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { username, password } = await req.json();
    const name = String(username ?? '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(name)) return json({ error: 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore.' }, 400);
    if (typeof password !== 'string' || password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (listError) return json({ error: listError.message }, 500);
    if (existing.users.length > 0) return json({ error: 'An account already exists for this app. Sign in instead.' }, 403);

    const { error } = await admin.auth.admin.createUser({ email: `${name}@${EMAIL_DOMAIN}`, password, email_confirm: true, user_metadata: { username: name } });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, username: name });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
