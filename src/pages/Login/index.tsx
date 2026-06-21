import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { supabase } from '../../lib/supabase';
import { AuthShell, AuthField, AuthSubmit, authError } from './AuthShell';

const Login: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await dispatch(authActions.signIn({ email: email.trim(), password })).unwrap();
      navigate('/artists', { replace: true });
    } catch (err: any) {
      setError(authError(err));
      setLoading(false);
    }
  };

  const onForgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Informe seu e-mail acima para recuperar a senha.');
      return;
    }
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      setInfo('Enviamos um link de recuperação para o seu e-mail.');
    } catch (err: any) {
      setError(authError(err));
    }
  };

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
        {info && <div style={{ color: '#af2896', fontSize: 13 }}>{info}</div>}
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
