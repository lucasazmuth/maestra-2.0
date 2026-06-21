import { createClient } from '@supabase/supabase-js';

// Projeto "Maestra Oficial". Lê das env vars (CRA → REACT_APP_*) com fallback para os valores
// públicos do projeto, garantindo que o app suba mesmo sem .env configurado localmente.
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || 'https://tpwmzcgtidaxgxwqfxwf.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  'sb_publishable_JnmNt0Cg7tCJtQ9VXPfQBA_04mjnGP9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Login é email/senha — não há retorno de OAuth na URL.
    detectSessionInUrl: false,
  },
});

export const getSupabaseProjectRef = (): string => {
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0];
  } catch {
    return '';
  }
};

export default supabase;
