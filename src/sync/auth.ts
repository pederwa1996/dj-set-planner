import { supabase } from './supabase';

/** Brukernavnet gjøres om til en intern adresse (det sendes aldri e-post til den). */
export const USERNAME_DOMAIN = 'users.djsetplanner.invalid';

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function validateUsername(u: string): string | null {
  return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(u)) ? null : 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore.';
}

export const usernameToEmail = (u: string) => `${normalizeUsername(u)}@${USERNAME_DOMAIN}`;
export const usernameFromEmail = (email: string | undefined | null) => (email ?? '').replace(`@${USERNAME_DOMAIN}`, '');

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong username or password.';
  if (/failed to fetch|network/i.test(message)) return 'Can’t reach the server — check your connection.';
  return message;
}

export async function signIn(username: string, password: string): Promise<void> {
  const err = validateUsername(username);
  if (err) throw new Error(err);
  const { error } = await supabase().auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) throw new Error(friendly(error.message));
}

/** Oppretter (den ene) kontoen via Edge Function, og logger inn. */
export async function createAccount(username: string, password: string): Promise<void> {
  const err = validateUsername(username);
  if (err) throw new Error(err);
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const { data, error } = await supabase().functions.invoke('create-account', { body: { username: normalizeUsername(username), password } });
  if (error) {
    // Funksjonen svarer med { error } i kroppen også ved 4xx
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).error ?? msg;
    } catch {
      /* behold opprinnelig melding */
    }
    throw new Error(friendly(msg));
  }
  if (data?.error) throw new Error(friendly(data.error));
  await signIn(username, password);
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}
