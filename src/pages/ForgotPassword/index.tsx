import { FC, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';
import styles from '../Login/AuthShell.module.scss';

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
              background: '#eef3ff', color: '#3361ff',
            }}
          >
            <FiMail size={28} />
          </div>
          <h2 className={styles.stepTitle}>Confira seu e-mail</h2>
          <p className={styles.stepText} style={{ marginBottom: 6 }}>
            Se existir uma conta com <strong style={{ color: '#405985' }}>{email.trim()}</strong>, enviamos um
            link para você criar uma nova senha.
          </p>
          <p className={styles.stepText} style={{ fontSize: 13.5, marginBottom: 24 }}>
            O link chega em alguns minutos e vale por pouco tempo. Não esqueça de olhar a caixa de spam.
          </p>

          <button
            type='button'
            onClick={resend}
            disabled={loading}
            className={styles.submit}
            style={{ marginTop: 0 }}
          >
            {loading ? 'Reenviando…' : 'Reenviar e-mail'}
          </button>
          {error && <div className={styles.error} style={{ marginTop: 12 }}>{error}</div>}

          <button
            type='button'
            onClick={() => navigate('/login')}
            className={styles.textLink}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18 }}
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
      <h2 className={styles.stepTitle}>Esqueceu sua senha?</h2>
      <p className={styles.stepText}>
        Digite o e-mail do seu cadastro e a gente envia um link para você criar uma nova senha.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='email' placeholder='E-mail' value={email} onChange={setEmail} autoFocus />
        {error && <div className={styles.error}>{error}</div>}
        <AuthSubmit loading={loading} label='Enviar link de recuperação' />
      </form>

      <button
        type='button'
        onClick={() => navigate('/login')}
        className={styles.textLink}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <FiArrowLeft size={15} /> Voltar ao login
      </button>
    </AuthShell>
  );
};

export default ForgotPassword;
