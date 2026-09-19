import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kgqhmphvkwqerkbbqjkl.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-f3CkV58oZ5IdAmugAWAAw_5O4xvCFB';

export function createUserSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const auth = request.headers.get('authorization');

  if (!auth?.startsWith('Bearer ')) throw new Error('Missing user access token');

  return createClient(url, key, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireUser(request: Request) {
  const supabase = createUserSupabase(request);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Unauthorized');
  return { supabase, user: data.user };
}
