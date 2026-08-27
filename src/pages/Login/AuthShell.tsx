import { FC, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiCalendar } from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import useIsMobile from '../../utils/isMobile';
import { rodandoNativo } from '@maestra/core/lib/plataforma';
import { useAppDispatch } from '@maestra/core/store/store';
import { authActions, type SocialProvider } from '@maestra/core/store/slices/auth';
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

const SOCIAL_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

// A ordem é a da tela. O ícone da Apple é monocromático por regra da própria Apple: o logo não
// pode ser recolorido nem ganhar efeito.
const SOCIAL_PROVIDERS: { provider: SocialProvider; icon: ReactNode; somenteMobile?: boolean }[] = [
  { provider: 'google', icon: <FcGoogle /> },
  { provider: 'apple', icon: <FaApple />, somenteMobile: true },
];

export const AuthShell: FC<{ children: ReactNode; footer?: ReactNode }> = ({ children, footer }) => {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();
  // O Sign in with Apple existe aqui por causa da App Store (diretriz 4.8), que exige o botão
  // dentro do app quando já há outro login social. Na web de desktop ele não é exigido, e cada
  // provedor a mais é uma porta a mais para a mesma pessoa entrar por duas contas diferentes.
  //
  // O `rodandoNativo()` NÃO é redundante com a largura: no iPad o app passa de 768px, e esconder
  // o botão por viewport reprovaria justamente o caso que a regra existe para cobrir.
  const mostraApple = rodandoNativo() || isMobile;
  const provedores = SOCIAL_PROVIDERS.filter((p) => !p.somenteMobile || mostraApple);

  const [socialNote, setSocialNote] = useState<string | null>(null);
  // Guarda QUAL provedor está redirecionando, não um booleano: com dois botões, um booleano
  // deixaria os dois em "Redirecionando…" ao mesmo tempo.
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  // Dispara o OAuth: o Supabase redireciona pro provedor e volta em /auth/callback.
  const social = async (provider: SocialProvider) => {
    const nome = SOCIAL_LABEL[provider];
    setSocialNote(null);
    setSocialLoading(provider);
    try {
      await dispatch(authActions.signInWithProvider(provider)).unwrap();
      // Sucesso: o navegador está sendo redirecionado; não há mais nada a fazer aqui.
    } catch (err: any) {
      setSocialLoading(null);
      const msg = String(err?.message || '').toLowerCase();
      setSocialNote(
        msg.includes('not enabled') || msg.includes('provider')
          ? `Login com ${nome} indisponível no momento. Use e-mail e senha.`
          : `Não foi possível iniciar o login com ${nome}. Tente novamente.`
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
          {/* Os dois botões são iguais em tamanho, peso e posição de propósito: a diretriz 4.8
              da App Store exige que o Sign in with Apple tenha a MESMA proeminência dos outros
              logins sociais. Destacar um dos dois aqui reprova o app. */}
          {/* A coluna acompanha quantos provedores sobraram: com um só, dois botões de meia
              largura deixariam um buraco ao lado do Google. */}
          <div className={styles.social} data-provedores={provedores.length}>
            {provedores.map(({ provider, icon }) => {
              const redirecionando = socialLoading === provider;
              return (
                <button
                  key={provider}
                  type='button'
                  className={styles.socialBtn}
                  onClick={() => social(provider)}
                  disabled={socialLoading !== null}
                  style={socialLoading !== null ? { opacity: 0.7, cursor: 'wait' } : undefined}
                >
                  {icon} {redirecionando ? 'Redirecionando…' : SOCIAL_LABEL[provider]}
                </button>
              );
            })}
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
