import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutRow, Remote, RemoteRow } from './engine';

/** Remote-implementasjon mot Supabase-tabellen `records` (RLS: bare eierens rader). */
export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull(since) {
      const out: RemoteRow[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        let q = client.from('records').select('kind,id,data,deleted,client_updated_at,updated_at').order('updated_at', { ascending: true }).range(from, from + page - 1);
        if (since) q = q.gt('updated_at', since);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        out.push(...((data ?? []) as RemoteRow[]));
        if (!data || data.length < page) break;
      }
      return out;
    },
    async push(rows: OutRow[]) {
      if (!rows.length) return;
      const { error } = await client.from('records').upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: 'user_id,kind,id' },
      );
      if (error) throw new Error(error.message);
    },
  };
}
