import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';

const Signup: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [name, setName] = useState('');
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
      const res = await dispatch(
        authActions.signUp({ email: email.trim(), password, name: name.trim() })
      ).unwrap();
      if (res.session) {
        // Login imediato (confirmação de e-mail desativada) → tela de boas-vindas.
        navigate('/welcome', { replace: true });
      } else {
        // Confirmação de e-mail ativada no Supabase.
        setInfo('Conta criada! Verifique seu e-mail para confirmar e depois faça login.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(authError(err));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <p style={{ color: '#b3b3b3', fontSize: 14, marginTop: 28, textAlign: 'center' }}>
          Já possui cadastro?{' '}
          <Link to='/login' style={{ color: '#af68d8', fontWeight: 700 }}>
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='text' placeholder='Seu nome' value={name} onChange={setName} autoFocus />
        <AuthField type='email' placeholder='E-mail' value={email} onChange={setEmail} />
        <AuthField type='password' placeholder='Senha (mín. 6 caracteres)' value={password} onChange={setPassword} />
        {error && <div style={{ color: '#e91429', fontSize: 13 }}>{error}</div>}
        {info && <div style={{ color: '#af2896', fontSize: 13 }}>{info}</div>}
        <AuthSubmit loading={loading} label='Criar conta' />
      </form>
    </AuthShell>
  );
};

export default Signup;
