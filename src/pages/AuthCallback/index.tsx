import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@maestra/core/lib/supabase';
import { Spinner } from '../../components/spinner/spinner';

// Retorno do login social (Google) e do REPASSE DO APP para o checkout. O client global tem
// detectSessionInUrl:false (por causa do recovery de senha, que lê o hash manualmente), então
// estabelecemos a sessão aqui, escopado a esta rota. O onAuthStateChange global reage à sessão e
// popula o Redux; depois entramos no app.
//
// Por que o repasse do app aponta para CÁ e não direto para o destino: numa rota protegida, o
// `RequireAuth` redireciona para /login antes de o guardião de hash rodar (ele vive num efeito),
// e a troca de rota descarta os tokens. Aqui a rota é pública e o hash sobrevive.
//
// Este projeto usa o fluxo IMPLICIT: os tokens voltam no HASH (#access_token=...&refresh_token=...).
// Também tratamos ?code= (PKCE) como fallback, caso o fluxo do projeto mude no futuro.
//
// Rota PÚBLICA (fora de RequireAuth/PublicOnly): o usuário ainda não está "logado" no Redux quando
// chega aqui, e precisamos estabelecer a sessão antes de qualquer guardião redirecionar.
const AuthCallback: FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URL(window.location.href).searchParams;

    // O provedor pode voltar com erro (usuário cancelou, consentimento negado, etc.).
    const errDescription = hashParams.get('error_description') || query.get('error_description');
    if (errDescription) {
      setError(errDescription);
      return;
    }

    const access_token = hashParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token');
    const code = query.get('code');

    // Para onde ir depois. O repasse do app manda `?next=/planos` — quem sai do aplicativo
    // para pagar precisa cair NO CHECKOUT, não na lista de perfis.
    //
    // Só caminho relativo, e nunca `//`: `next=https://outro.site` ou `next=//outro.site` faria
    // desta rota um redirecionador aberto, com a sessão recém-criada na bagagem.
    const proximo = query.get('next');
    const destino = proximo && proximo.startsWith('/') && !proximo.startsWith('//')
      ? proximo
      : '/artists';
    const done = () => navigate(destino, { replace: true }); // sai da URL com o hash/token
    const fail = () =>
      setError('Não foi possível concluir o login com Google. Tente novamente.');

    if (access_token && refresh_token) {
      // Fluxo implicit: tokens no hash.
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error: e }) => (e ? fail() : done()))
        .catch(fail);
    } else if (code) {
      // Fluxo PKCE: troca o code por sessão.
      supabase.auth
        .exchangeCodeForSession(window.location.href)
        .then(({ error: e }) => (e ? fail() : done()))
        .catch(fail);
    } else {
      setError('Login não concluído. Tente novamente.');
    }
  }, [navigate]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0f0f0f' }}>
        <div style={{ textAlign: 'center', color: '#e6e6ea', maxWidth: 360 }}>
          <p style={{ fontSize: 15, marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{
              background: '#9A4FD1', color: '#FFFFFF', border: 'none', borderRadius: 9999,
              padding: '10px 22px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <Spinner loading global>{null as any}</Spinner>
  );
};

export default AuthCallback;
