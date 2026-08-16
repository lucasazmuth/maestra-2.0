import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { supabase } from '../../lib/supabase';
import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { AuthShell, AuthField, AuthSubmit, authError } from './AuthShell';
import styles from './AuthShell.module.scss';
import { EmailCodeStep } from '../../components/EmailCodeStep';

const Login: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Usuário que se cadastrou mas nunca confirmou o e-mail: o login cai aqui pra confirmar com código.
  const [needsVerify, setNeedsVerify] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await dispatch(authActions.signIn({ email: email.trim(), password })).unwrap();
      navigate('/artists', { replace: true });
    } catch (err: any) {
      // E-mail ainda não confirmado → manda pro passo do código (o EmailCodeStep reenvia ao abrir).
      if ((err?.message || '').toLowerCase().includes('not confirmed')) {
        setNeedsVerify(true);
        setLoading(false);
        return;
      }

      // O Supabase passou a responder `invalid_credentials` também para conta não confirmada (e
      // para conta do Google, que não tem senha), de propósito, para não revelar quais e-mails
      // existem. O navegador não tem como distinguir os três casos — mas o servidor tem, e é só
      // isso que `auth-login-hint` responde: o par e-mail/senha está certo E falta confirmar?
      //
      // Só nesse caso o encaminhamento é automático. Fazer isso em toda falha jogaria quem
      // simplesmente errou a senha numa tela de código que nunca chega (conta já confirmada não
      // recebe reenvio: o Supabase responde 200 e não envia nada), e ainda dispararia um e-mail a
      // cada tentativa, para o endereço que alguém digitasse.
      try {
        const { data } = await supabase.functions.invoke('auth-login-hint', {
          body: { email: email.trim(), password },
        });
        if (data?.needsConfirmation) {
          setNeedsVerify(true);
          setLoading(false);
          return;
        }
      } catch {
        // Indisponível: segue para o erro comum, como era antes desta verificação existir.
      }

      setError(authError(err));
      setLoading(false);
    }
  };

  // Recuperação de senha tem tela própria (/esqueci-senha). Leva o e-mail já digitado.
  const onForgot = () => navigate('/esqueci-senha', { state: { email: email.trim() } });

  if (needsVerify) {
    return (
      <AuthShell>
        <EmailCodeStep email={email.trim()} resendOnMount onVerified={() => navigate('/artists', { replace: true })} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <p className={styles.footerText}>
          Você não possui cadastro?{' '}
          <Link to='/signup' className={styles.footerLink}>
            Cadastre-se!
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='email' placeholder='E-mail' value={email} onChange={setEmail} autoFocus />
        <AuthField type='password' placeholder='Senha' value={password} onChange={setPassword} />
        {/* Chegar aqui já significa que o servidor descartou "falta confirmar" — esse caso é
            encaminhado sozinho para a tela do código. Sobram senha errada e conta do Google, e a
            do Google é a mais provável: 29 das 70 contas entraram por lá. */}
        {error && (
          <div className={styles.error}>
            {error}
            <span className={styles.errorHint}>
              Criou a conta com o Google? Entre pelo botão Google acima.
            </span>
          </div>
        )}
        <AuthSubmit loading={loading} label='Entrar' />
      </form>
      <button type='button' className={styles.textLink} onClick={onForgot}>
        Esqueceu sua senha?
      </button>
    </AuthShell>
  );
};

export default Login;
