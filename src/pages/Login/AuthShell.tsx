import { FC, ReactNode, useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser } from 'react-icons/fi';

import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';
import styles from './AuthShell.module.scss';

export const authError = (err: any): string => {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered') || msg.includes('already exists'))
    return 'Este e-mail já está cadastrado. Faça login.';
  if (msg.includes('provider is not enabled') || msg.includes('not enabled'))
    return 'Login social indisponível no momento. Use e-mail e senha.';
  if (msg.includes('password')) return 'A senha precisa ter ao menos 6 caracteres.';
  if (msg.includes('email')) return 'Informe um e-mail válido.';
  return err?.message || 'Algo deu errado. Tente novamente.';
};

export const AuthShell: FC<{ children: ReactNode; footer?: ReactNode }> = ({ children, footer }) => {
  const [socialNote, setSocialNote] = useState<string | null>(null);

  // Login social ainda não disponível: apenas avisa, sem redirecionar.
  const social = () =>
    setSocialNote('Login com Google e Facebook em breve. Por enquanto, entre com e-mail e senha.');

  return (
    <div className={styles.page}>
      {/* Coluna do formulário */}
      <div className={styles.formCol}>
        <div className={styles.formInner}>
          <div className={styles.brand}>
            {/* Só a logo (o SVG já tem aria-label "Maestra Manager"). */}
            <MaestraLogo />
          </div>

          <p className={styles.eyebrow}>Acesse com:</p>
          <div className={styles.social}>
            <button type='button' className={styles.socialBtn} onClick={social}>
              <FcGoogle /> Google
            </button>
            <button type='button' className={styles.socialBtn} onClick={social}>
              <FaFacebook color='#1877F2' /> Facebook
            </button>
          </div>
          {socialNote && (
            <div style={{ color: '#e0a82e', fontSize: 13, marginBottom: 12 }}>{socialNote}</div>
          )}

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
}> = ({ type, placeholder, value, onChange, autoFocus }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  // text (nome) → usuário; email → envelope; senha → cadeado.
  const Icon = type === 'email' ? FiMail : isPassword ? FiLock : FiUser;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: '0 14px',
      }}
    >
      <Icon color='#888' size={18} style={{ flexShrink: 0 }} />
      <input
        type={isPassword && show ? 'text' : type}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          padding: '13px 0',
          color: '#fff',
          fontSize: 15,
          outline: 'none',
        }}
      />
      {isPassword && (
        <button
          type='button'
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', padding: 4 }}
        >
          {show ? <FiEyeOff size={18} /> : <FiEye size={18} />}
        </button>
      )}
    </div>
  );
};

export const AuthSubmit: FC<{ loading: boolean; label: string }> = ({ loading, label }) => (
  <button
    type='submit'
    disabled={loading}
    style={{
      marginTop: 8,
      width: '100%',
      background: 'linear-gradient(135deg, #af2896, #6d3bd1)',
      border: 'none',
      color: '#fff',
      padding: '14px 24px',
      borderRadius: 9999,
      fontWeight: 700,
      fontSize: 16,
      cursor: loading ? 'default' : 'pointer',
      opacity: loading ? 0.7 : 1,
    }}
  >
    {loading ? 'Aguarde…' : label}
  </button>
);
