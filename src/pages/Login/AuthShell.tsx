import { FC, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiCalendar } from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import styles from './AuthShell.module.scss';

/**
 * Segundos de espera informados pelo Supabase no erro de rate limit, ou null.
 *
 * A resposta traz "For security purposes, you can only request this after 23 seconds." — e o
 * número é a única parte útil: sem ele a pessoa lê "aguarde um instante", não sabe se são 5 ou 60
 * segundos, e fica tentando de novo (o que renova o bloqueio).
 */
export const rateLimitSeconds = (err: any): number | null => {
  const m = /after (\d+)\s*second/i.exec(String(err?.message || ''));
  return m ? Number(m[1]) : null;
};

export const authError = (err: any): string => {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered') || msg.includes('already exists'))
    return 'Este e-mail já está cadastrado. Faça login.';
  if (msg.includes('not confirmed')) return 'E-mail ainda não confirmado.';
  // Rate limit ANTES do genérico de "email" — senão "email rate limit exceeded" virava "e-mail inválido".
  if (msg.includes('rate limit') || msg.includes('for security purposes') || msg.includes('too many'))
    return 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.';
  if (msg.includes('otp') || msg.includes('expired') || (msg.includes('token') && msg.includes('invalid')))
    return 'Código inválido ou expirado. Toque em "Reenviar código".';
  if (msg.includes('provider is not enabled') || msg.includes('not enabled'))
    return 'Login social indisponível no momento. Use e-mail e senha.';
  if (msg.includes('password')) return 'A senha precisa ter ao menos 6 caracteres.';
  if (msg.includes('email')) return 'Informe um e-mail válido.';
  return err?.message || 'Algo deu errado. Tente novamente.';
};

export const AuthShell: FC<{ children: ReactNode; footer?: ReactNode }> = ({ children, footer }) => {
  const dispatch = useAppDispatch();
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  // Dispara o OAuth do Google: o Supabase redireciona pro Google e volta em /auth/callback.
  const social = async () => {
    setSocialNote(null);
    setSocialLoading(true);
    try {
      await dispatch(authActions.signInWithProvider('google')).unwrap();
      // Sucesso: o navegador está sendo redirecionado pro Google; não há mais nada a fazer aqui.
    } catch (err: any) {
      setSocialLoading(false);
      const msg = String(err?.message || '').toLowerCase();
      setSocialNote(
        msg.includes('not enabled') || msg.includes('provider')
          ? 'Login com Google indisponível no momento. Use e-mail e senha.'
          : 'Não foi possível iniciar o login com Google. Tente novamente.'
      );
    }
  };

  return (
    <div className={styles.page}>
      {/* Coluna do formulário */}
      <div className={styles.formCol}>
        <div className={styles.formInner}>
          <div className={styles.brand}>
            {/* Logo clicável → volta para a landing page. */}
            <Link to='/' className={styles.brandLink} aria-label='Ir para a página inicial'>
              <MaestraBrand variant='lockup' tone='dark' className={styles.brandWordmark} />
            </Link>
          </div>

          <p className={styles.eyebrow}>Acesse com:</p>
          <div className={styles.social}>
            <button
              type='button'
              className={styles.socialBtn}
              onClick={social}
              disabled={socialLoading}
              style={socialLoading ? { opacity: 0.7, cursor: 'wait' } : undefined}
            >
              <FcGoogle /> {socialLoading ? 'Redirecionando…' : 'Google'}
            </button>
          </div>
          {socialNote && <div className={styles.note}>{socialNote}</div>}

          <div className={styles.divider}>ou</div>

          {children}
          {footer}
        </div>
      </div>
    </div>
  );
};

export const AuthField: FC<{
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  /** Só para type='date': limita a seleção (usado para barrar datas no futuro). */
  max?: string;
}> = ({ type, placeholder, value, onChange, autoFocus, max }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  // text (nome) → usuário; email → envelope; senha → cadeado; data → calendário.
  const Icon = type === 'email' ? FiMail : isPassword ? FiLock : type === 'date' ? FiCalendar : FiUser;

  return (
    <div className={styles.field}>
      <Icon size={18} className={styles.fieldIcon} />
      <input
        className={styles.input}
        type={isPassword && show ? 'text' : type}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        max={max}
        // O campo de data não mostra placeholder: sem rótulo, "dd/mm/aaaa" não diz de quem é.
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {isPassword && (
        <button
          type='button'
          className={styles.reveal}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <FiEyeOff size={18} /> : <FiEye size={18} />}
        </button>
      )}
    </div>
  );
};

export const AuthSubmit: FC<{ loading: boolean; label: string }> = ({ loading, label }) => (
  <button type='submit' className={styles.submit} disabled={loading}>
    {loading ? 'Aguarde…' : label}
  </button>
);
