import { FC, useEffect, useRef, useState } from 'react';

import { useAppDispatch } from '../store/store';
import { authActions } from '../store/slices/auth';
import { AuthSubmit, authError } from '../pages/Login/AuthShell';

// Campo de PIN: 6 caixas (1 dígito cada) com auto-avanço, backspace e colar o código inteiro.
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

const RESEND_COOLDOWN = 45; // segundos entre reenvios (evita o rate limit de e-mail do Supabase)

// Passo de confirmação de e-mail por CÓDIGO (OTP). Reutilizado no cadastro e no login (quando o
// usuário volta com e-mail ainda não confirmado). `resendOnMount` dispara um código novo ao abrir
// (usado no login, já que o código do cadastro pode ter expirado).
export const EmailCodeStep: FC<{ email: string; onVerified: () => void; resendOnMount?: boolean }> = ({ email, onVerified, resendOnMount }) => {
  const dispatch = useAppDispatch();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => setCooldown(RESEND_COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Reenvia ao montar (fluxo de login com e-mail não confirmado).
  const sentOnMount = useRef(false);
  useEffect(() => {
    if (!resendOnMount || sentOnMount.current) return;
    sentOnMount.current = true;
    dispatch(authActions.resendSignupOtp({ email }))
      .unwrap()
      .then(() => { setInfo('Enviamos um código para o seu e-mail.'); startCooldown(); })
      .catch((err) => setError(authError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runVerify = async (token: string) => {
    if (token.length < PIN_LEN || loading) return;
    setLoading(true);
    setError(null);
    try {
      await dispatch(authActions.verifySignupOtp({ email, token })).unwrap();
      onVerified();
    } catch (err: any) {
      setError(authError(err) || 'Código inválido ou expirado.');
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      await dispatch(authActions.resendSignupOtp({ email })).unwrap();
      setInfo('Enviamos um novo código para o seu e-mail.');
      startCooldown();
    } catch (err: any) {
      setError(authError(err));
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); runVerify(code); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#b3b3b3', fontSize: 14, margin: '0 0 4px', lineHeight: 1.5, textAlign: 'center' }}>
        Confirme seu e-mail digitando o código de 6 dígitos que enviamos para <strong style={{ color: '#fff' }}>{email}</strong>.
      </p>
      <PinInput value={code} onChange={setCode} onComplete={runVerify} />
      {error && <div style={{ color: '#e91429', fontSize: 13, textAlign: 'center' }}>{error}</div>}
      {info && <div style={{ color: '#af2896', fontSize: 13, textAlign: 'center' }}>{info}</div>}
      <AuthSubmit loading={loading} label="Confirmar e entrar" />
      <p style={{ color: '#b3b3b3', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
        Não recebeu?{' '}
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0}
          style={{ color: cooldown > 0 ? '#6b7280' : '#af68d8', fontWeight: 700, background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer', padding: 0, font: 'inherit' }}
        >
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
        </button>
      </p>
    </form>
  );
};

export default EmailCodeStep;
