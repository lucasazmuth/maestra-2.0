import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { AuthShell, AuthField, AuthSubmit, authError } from './AuthShell';
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
        <p style={{ color: '#b3b3b3', fontSize: 14, marginTop: 28, textAlign: 'center' }}>
          Você não possui cadastro?{' '}
          <Link to='/signup' style={{ color: '#af68d8', fontWeight: 700 }}>
            Cadastre-se!
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='email' placeholder='E-mail' value={email} onChange={setEmail} autoFocus />
        <AuthField type='password' placeholder='Senha' value={password} onChange={setPassword} />
        {error && <div style={{ color: '#e91429', fontSize: 13 }}>{error}</div>}
        <AuthSubmit loading={loading} label='Entrar' />
      </form>
      <button
        type='button'
        onClick={onForgot}
        style={{
          display: 'block',
          margin: '16px auto 0',
          background: 'none',
          border: 'none',
          color: '#509bf5',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Esqueceu sua senha?
      </button>
    </AuthShell>
  );
};

export default Login;
