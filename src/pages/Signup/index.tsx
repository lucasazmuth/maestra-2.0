import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../../store/store';
import { supabase } from '../../lib/supabase';
import { authActions } from '../../store/slices/auth';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';

const Signup: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // 'form' = dados do cadastro; 'code' = confirmar o e-mail com o código (OTP) enviado por e-mail.
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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
      // Anti-enumeração do Supabase: se o e-mail JÁ tem conta, o signUp "passa" mas devolve um usuário
      // com `identities` vazio e NÃO envia código. Tratar como "já cadastrado" (senão mostraria o passo
      // do código esperando um e-mail que nunca chega).
      if (res.user && Array.isArray(res.user.identities) && res.user.identities.length === 0) {
        setError('Esse e-mail já tem uma conta. Faça login ou use "Esqueci minha senha".');
        setLoading(false);
        return;
      }
      // Gate pela CONFIRMAÇÃO do e-mail (não pela sessão): o Supabase pode devolver uma sessão mesmo
      // sem confirmar — mas o usuário precisa passar pelo código antes de entrar.
      if (res.user?.email_confirmed_at) {
        // Confirmação desligada (ou login social) → entra direto.
        navigate('/welcome', { replace: true });
      } else {
        // Confirmação ativada → código enviado por e-mail (Brevo). Limpa a meia-sessão e pede o código.
        // (O parágrafo do passo "code" já avisa pra onde foi; o `info` fica só pro "Reenviar código".)
        await supabase.auth.signOut();
        setStep('code');
        setLoading(false);
      }
    } catch (err: any) {
      setError(authError(err));
      setLoading(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await dispatch(
        authActions.verifySignupOtp({ email: email.trim(), token: code.trim() })
      ).unwrap();
      navigate('/welcome', { replace: true });
    } catch (err: any) {
      setError(authError(err) || 'Código inválido ou expirado.');
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setInfo(null);
    try {
      await dispatch(authActions.resendSignupOtp({ email: email.trim() })).unwrap();
      setInfo('Enviamos um novo código para o seu e-mail.');
    } catch (err: any) {
      setError(authError(err));
    }
  };

  if (step === 'code') {
    return (
      <AuthShell
        footer={
          <p style={{ color: '#b3b3b3', fontSize: 14, marginTop: 28, textAlign: 'center' }}>
            Não recebeu?{' '}
            <button
              type='button'
              onClick={onResend}
              style={{ color: '#af68d8', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              Reenviar código
            </button>
          </p>
        }
      >
        <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: '#b3b3b3', fontSize: 14, margin: '0 0 4px', lineHeight: 1.5 }}>
            Confirme seu e-mail digitando o código de 6 dígitos que enviamos para <strong style={{ color: '#fff' }}>{email.trim()}</strong>.
          </p>
          <AuthField type='text' placeholder='Código de 6 dígitos' value={code} onChange={setCode} autoFocus />
          {error && <div style={{ color: '#e91429', fontSize: 13 }}>{error}</div>}
          {info && <div style={{ color: '#af2896', fontSize: 13 }}>{info}</div>}
          <AuthSubmit loading={loading} label='Confirmar e entrar' />
        </form>
      </AuthShell>
    );
  }

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
