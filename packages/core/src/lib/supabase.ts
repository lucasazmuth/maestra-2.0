import { createClient } from '@supabase/supabase-js';

import { ambiente } from '../nucleo/ambiente';

// Projeto "Maestra Oficial". Lê das env vars (CRA → REACT_APP_*) com fallback para os valores
// públicos do projeto, garantindo que o app suba mesmo sem .env configurado localmente.
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || 'https://tpwmzcgtidaxgxwqfxwf.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  'sb_publishable_JnmNt0Cg7tCJtQ9VXPfQBA_04mjnGP9';

/**
 * Onde a sessão fica guardada.
 *
 * Sem isto o supabase-js usa o `localStorage` por conta própria — o que serve a web e deixa o
 * app nativo sem sessão nenhuma entre aberturas. Delegar à porta resolve os dois: na web o
 * padrão dela É o `localStorage`, com as MESMAS chaves (quem as escolhe é o supabase-js), então
 * ninguém é deslogado; no app, quem responde é o depósito que a superfície registrar.
 *
 * A resolução acontece a cada chamada, e não aqui em cima, porque este módulo é carregado no
 * import — antes de o app ter chance de se registrar.
 */
const deposito = {
  getItem: (chave: string) => ambiente().armazenamento.ler(chave),
  setItem: (chave: string, valor: string) => ambiente().armazenamento.gravar(chave, valor),
  removeItem: (chave: string) => ambiente().armazenamento.apagar(chave),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Login é email/senha — não há retorno de OAuth na URL.
    detectSessionInUrl: false,
    storage: deposito,
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
