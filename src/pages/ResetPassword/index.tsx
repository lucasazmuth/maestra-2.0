import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';

import { supabase } from '../../lib/supabase';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';

// Tela de "definir nova senha", aberta pelo link do e-mail de recuperação.
//
// O Supabase devolve os tokens no HASH da URL (#access_token=...&refresh_token=...&type=recovery),
// nunca na query string — é assim que o /auth/v1/verify redireciona depois de validar o link.
// O client global tem detectSessionInUrl: false (login é email/senha, não OAuth), então essa
// leitura/aplicação de sessão é feita manualmente aqui, escopada só a esta rota.
//
// Rota PÚBLICA e FORA de RequireAuth/PublicOnly de propósito: RequireAuth bloquearia antes de
// conseguirmos ler o hash (usuário ainda não está "logado" no Redux); PublicOnly redirecionaria
// pra /artists assim que a sessão de recovery entrasse (o listener global de auth reage a ela),
// arrancando o usuário da tela antes de trocar a senha.
const ResetPassword: FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(raw);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const type = params.get('type');

    if (!access_token || !refresh_token || type !== 'recovery') {
      setStatus('invalid');
      return;
    }

    supabase.auth.setSession({ access_token, refresh_token })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setStatus('invalid');
          return;
        }
        // Tira os tokens da barra de endereço (não deixar visível/reaproveitável).
        window.history.replaceState(null, '', window.location.pathname);
        setStatus('ready');
      })
      // Token malformado/truncado faz o setSession LANÇAR (ex.: decodeJWT estoura) em vez de
      // resolver com { error }. Sem este catch, a promise rejeitada deixava a tela travada no
      // spinner. Qualquer falha cai no mesmo estado de "link inválido".
      .catch(() => setStatus('invalid'));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Encerra a sessão de recovery e manda pro login — reforça que a troca deu certo e evita
      // deixar uma sessão ativa aberta se o link tiver sido aberto por outra pessoa/processo.
      await supabase.auth.signOut();
      setStatus('done');
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err: any) {
      setError(authError(err));
      setLoading(false);
    }
  };

  if (status === 'checking') {
    return (
      <AuthShell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <Spin />
        </div>
      </AuthShell>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthShell>
        <p style={{ color: '#e91429', fontSize: 14, lineHeight: 1.5, textAlign: 'center', margin: '4px 0 20px' }}>
          Este link de redefinição é inválido ou expirou. Peça um novo na tela de login.
        </p>
        <button
          type='button'
          onClick={() => navigate('/login')}
          style={{
            display: 'block', margin: '0 auto', background: 'none', border: 'none',
            color: '#509bf5', fontSize: 14, cursor: 'pointer',
          }}
        >
          Voltar ao login
        </button>
      </AuthShell>
    );
  }

  if (status === 'done') {
    return (
      <AuthShell>
        <p style={{ color: '#BE81EC', fontSize: 14, textAlign: 'center', margin: '4px 0' }}>
          Senha atualizada! Redirecionando para o login…
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='password' placeholder='Nova senha' value={password} onChange={setPassword} autoFocus />
        <AuthField type='password' placeholder='Confirmar nova senha' value={confirm} onChange={setConfirm} />
        {error && <div style={{ color: '#e91429', fontSize: 13 }}>{error}</div>}
        <AuthSubmit loading={loading} label='Redefinir senha' />
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
