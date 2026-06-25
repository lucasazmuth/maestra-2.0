import { FC, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../../store/store';
import { supabase } from '../../lib/supabase';
import { authActions } from '../../store/slices/auth';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';

// Campo de PIN: 6 caixas (1 dígito cada) com auto-avanço, backspace e colar o código inteiro.
// `onComplete` dispara quando as 6 caixas estão preenchidas (auto-submit). Só aceita dígitos.
const PIN_LEN = 6;
const PinInput: FC<{ value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }> = ({ value, onChange, onComplete }) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length: PIN_LEN }, (_, i) => value[i] ?? '');

  const emit = (arr: string[]) => {
    const v = arr.join('');
    onChange(v);
    if (v.length === PIN_LEN && !arr.includes('')) onComplete?.(v);
  };

  const handleInput = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    const arr = [...chars];
    let j = i;
    for (const d of digits.split('')) { if (j < PIN_LEN) { arr[j] = d; j += 1; } } // distribui (colar)
    emit(arr);
    refs.current[Math.min(j, PIN_LEN - 1)]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = [...chars];
      if (arr[i]) { arr[i] = ''; emit(arr); }
      else if (i > 0) { arr[i - 1] = ''; emit(arr); refs.current[i - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < PIN_LEN - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LEN);
    if (!digits) return;
    e.preventDefault();
    emit(Array.from({ length: PIN_LEN }, (_, i) => digits[i] ?? ''));
    refs.current[Math.min(digits.length, PIN_LEN - 1)]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }} onPaste={handlePaste}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={c}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          maxLength={1}
          aria-label={`Dígito ${i + 1} do código`}
          style={{
            width: 46, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
            color: '#fff', background: '#1f1f1f', border: `1px solid ${c ? '#af2896' : '#2a2a2a'}`,
            borderRadius: 10, outline: 'none', transition: 'border-color .15s',
          }}
        />
      ))}
    </div>
  );
};

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

  // Verifica o código (OTP) — usado pelo submit e pelo auto-submit do PIN (6 dígitos preenchidos).
  const runVerify = async (token: string) => {
    if (token.length < PIN_LEN || loading) return;
    setLoading(true);
    setError(null);
    try {
      await dispatch(authActions.verifySignupOtp({ email: email.trim(), token })).unwrap();
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
        <form onSubmit={(e) => { e.preventDefault(); runVerify(code); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: '#b3b3b3', fontSize: 14, margin: '0 0 4px', lineHeight: 1.5, textAlign: 'center' }}>
            Confirme seu e-mail digitando o código de 6 dígitos que enviamos para <strong style={{ color: '#fff' }}>{email.trim()}</strong>.
          </p>
          <PinInput value={code} onChange={setCode} onComplete={runVerify} />
          {error && <div style={{ color: '#e91429', fontSize: 13, textAlign: 'center' }}>{error}</div>}
          {info && <div style={{ color: '#af2896', fontSize: 13, textAlign: 'center' }}>{info}</div>}
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
