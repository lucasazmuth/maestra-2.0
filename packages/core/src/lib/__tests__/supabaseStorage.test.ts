import { supabase, getSupabaseProjectRef } from '../supabase';
import { ambiente, configurarAmbiente, reiniciarAmbiente, type Armazenamento } from '../../nucleo/ambiente';

// O supabase-js guardava a sessao no `localStorage` por conta propria. Agora recebe a porta do
// nucleo, para o app nativo ter onde guardar a dele.
//
// O risco desta mudanca e especifico e serio: se a chave ou o deposito mudarem na web, todo
// mundo e deslogado no proximo deploy. Estes testes existem para isso — nao para cobrir o
// supabase-js, mas para provar que na web nada mudou de lugar.

const chaveDaSessao = () => `sb-${getSupabaseProjectRef()}-auth-token`;

const sessaoFalsa = () => ({
  access_token: 'a.b.c',
  token_type: 'bearer',
  // Bem no futuro: sessao vencida faria o cliente tentar renovar, e ai o teste dependeria de rede.
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  expires_in: 60 * 60 * 24 * 365,
  refresh_token: 'r',
  user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.c',
          app_metadata: {}, user_metadata: {}, created_at: '2020-01-01T00:00:00Z' },
});

describe('onde a sessao do supabase fica guardada', () => {
  beforeEach(() => {
    reiniciarAmbiente();
    localStorage.clear();
  });
  afterAll(reiniciarAmbiente);

  it('na web, continua sendo o localStorage, na chave do projeto', async () => {
    // Semeia como o supabase-js semearia, e le pelo cliente: se ele achar, o deposito e o mesmo
    // de antes e as sessoes que ja existem nos navegadores das pessoas seguem validas.
    localStorage.setItem(chaveDaSessao(), JSON.stringify(sessaoFalsa()));

    const { data, error } = await supabase.auth.getSession();

    expect(error).toBeNull();
    expect(data.session?.user.id).toBe('u1');
  });

  it('a chave e derivada do projeto, nao inventada aqui', () => {
    expect(getSupabaseProjectRef()).toBe('tpwmzcgtidaxgxwqfxwf');
    expect(chaveDaSessao()).toBe('sb-tpwmzcgtidaxgxwqfxwf-auth-token');
  });

  it('quando a superficie registra o proprio deposito, o cliente passa a usar ELE', async () => {
    // E este o caso do app nativo: MMKV no lugar do localStorage, sem tocar no supabase-js.
    const memoria = new Map<string, string>();
    const proprio: Armazenamento = {
      ler: (c) => memoria.get(c) ?? null,
      gravar: (c, v) => { memoria.set(c, v); },
      apagar: (c) => { memoria.delete(c); },
    };
    configurarAmbiente({ armazenamento: proprio, sessao: proprio, origemDoApp: 'maestra://' });

    memoria.set(chaveDaSessao(), JSON.stringify({ ...sessaoFalsa(), user: { ...sessaoFalsa().user, id: 'do-app' } }));

    const { data } = await supabase.auth.getSession();

    expect(data.session?.user.id).toBe('do-app');
    // E o navegador nao foi tocado.
    expect(localStorage.getItem(chaveDaSessao())).toBeNull();
  });

  it('a porta resolve na chamada: configurar depois do import continua valendo', () => {
    // `lib/supabase.ts` monta o cliente durante o import. Se o deposito fosse resolvido ali,
    // o app nativo nao teria como se registrar a tempo.
    expect(ambiente().armazenamento).toBeDefined();
  });
});
