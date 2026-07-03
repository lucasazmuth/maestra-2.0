import { FC, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';

// Tela dedicada de "Esqueci minha senha", em dois passos:
//   1) form  → o usuário digita o e-mail e a gente dispara o link de recuperação.
//   2) sent  → confirmação clara ("confira seu e-mail"), com reenviar e voltar ao login.
// O link do e-mail abre em /redefinir-senha (que lê os tokens do hash e troca a senha).
const ForgotPassword: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Se veio do login com o e-mail já digitado, começa preenchido.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!value) { setError('Informe seu e-mail.'); return; }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      setSent(true);
    } catch (err: any) {
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
    } catch (err: any) {
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Passo 2: confirmação ──────────────────────────────────────────────────
  if (sent) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 60, height: 60, borderRadius: '50%', margin: '4px auto 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(175, 40, 150, 0.14)', color: '#c65fb0',
            }}
          >
            <FiMail size={28} />
          </div>
          <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, margin: '0 0 10px', fontFamily: 'SpotifyMixUITitle, sans-serif' }}>
            Confira seu e-mail
          </h2>
          <p style={{ color: '#cfcfd4', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 6px' }}>
            Se existir uma conta com <strong style={{ color: '#fff' }}>{email.trim()}</strong>, enviamos um
            link para você criar uma nova senha.
          </p>
          <p style={{ color: '#9a9aa5', fontSize: 13.5, lineHeight: 1.6, margin: '0 0 24px' }}>
            O link chega em alguns minutos e vale por pouco tempo. Não esqueça de olhar a caixa de spam.
          </p>

          <button
            type='button'
            onClick={resend}
            disabled={loading}
            style={{
              width: '100%', background: 'linear-gradient(135deg, #af2896, #6d3bd1)', border: 'none',
              color: '#fff', padding: '13px 24px', borderRadius: 9999, fontWeight: 700, fontSize: 15,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Reenviando…' : 'Reenviar e-mail'}
          </button>
          {error && <div style={{ color: '#e91429', fontSize: 13, marginTop: 12 }}>{error}</div>}

          <button
            type='button'
            onClick={() => navigate('/login')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, margin: '18px auto 0',
              background: 'none', border: 'none', color: '#509bf5', fontSize: 14, cursor: 'pointer',
            }}
          >
            <FiArrowLeft size={15} /> Voltar ao login
          </button>
        </div>
      </AuthShell>
    );
  }

  // ── Passo 1: digitar o e-mail ─────────────────────────────────────────────
  return (
    <AuthShell>
      <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, margin: '0 0 8px', fontFamily: 'SpotifyMixUITitle, sans-serif' }}>
        Esqueceu sua senha?
      </h2>
      <p style={{ color: '#9a9aa5', fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
        Digite o e-mail do seu cadastro e a gente envia um link para você criar uma nova senha.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='email' placeholder='E-mail' value={email} onChange={setEmail} autoFocus />
        {error && <div style={{ color: '#e91429', fontSize: 13 }}>{error}</div>}
        <AuthSubmit loading={loading} label='Enviar link de recuperação' />
      </form>

      <button
        type='button'
        onClick={() => navigate('/login')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, margin: '16px auto 0',
          background: 'none', border: 'none', color: '#509bf5', fontSize: 14, cursor: 'pointer',
        }}
      >
        <FiArrowLeft size={15} /> Voltar ao login
      </button>
    </AuthShell>
  );
};

export default ForgotPassword;
