import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
      //
      // Este atalho deixou de disparar: o Supabase passou a responder `invalid_credentials`
      // ("Invalid login credentials") também para conta não confirmada, para não revelar quais
      // e-mails existem. Como não dá mais para distinguir, mantemos a checagem (ainda vale onde a
      // resposta antiga aparecer) e, abaixo do erro, oferecemos a confirmação manualmente — senão
      // quem se cadastrou e não confirmou lê "e-mail ou senha incorretos" e não tem saída.
      if ((err?.message || '').toLowerCase().includes('not confirmed')) {
        setNeedsVerify(true);
        setLoading(false);
        return;
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
        {error && (
          <div className={styles.error}>
            {error}
            {/* Três causas produzem exatamente este mesmo erro, e o Supabase não deixa distinguir
                (é anti-enumeração): senha errada, e-mail não confirmado, ou conta criada pelo
                Google — que não tem senha nenhuma. As duas saídas ficam à mostra para todo mundo.

                A do Google vem primeiro porque é a mais provável: 29 das 70 contas entraram por
                lá. Mandar essa pessoa para a confirmação por código seria um beco sem saída — o
                Supabase responde 200 e não envia nada quando a conta já está confirmada. */}
            <span className={styles.errorHint}>
              Criou a conta com o Google? Entre pelo botão Google acima.
            </span>
            <button type='button' className={styles.errorAction} onClick={() => setNeedsVerify(true)}>
              Cadastrou-se com e-mail e não confirmou? Confirmar agora
            </button>
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
