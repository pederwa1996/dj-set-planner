import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
 * Supabase-prosjektet «dj-set-planner». URL og anon-nøkkel er offentlige av natur:
 * tilgangen styres av radnivå-sikkerhet (RLS) i databasen, så bare kontoeieren
 * kan lese og skrive egne data. Kan overstyres med VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://gozqdfatmsftxskrqgza.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvenFkZmF0bXNmdHhza3JxZ3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDEwNzcsImV4cCI6MjEwNzAxNzA3N30.pPojHGcJwV5ay8XwGE8E8HJQcHHMmb7kAxvV2SQxlQw';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dj-set-planner-auth' } });
  return client;
}
