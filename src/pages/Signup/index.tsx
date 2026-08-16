import { FC, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAppDispatch } from '../../store/store';
import { supabase } from '../../lib/supabase';
import { authActions } from '../../store/slices/auth';
import { AuthShell, AuthField, AuthSubmit, authError } from '../Login/AuthShell';
import styles from '../Login/AuthShell.module.scss';
import { EmailCodeStep } from '../../components/EmailCodeStep';
import { IDADE_MINIMA, ehMaiorDeIdade, idadeEmAnos } from '../../utils/age';
import { guardarConsentimentoPendente } from '../../hooks/useConsent';

const Signup: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // 'form' = dados do cadastro; 'code' = confirmar o e-mail com o código (OTP) enviado por e-mail.
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState('');
  // A landing pode chegar com o e-mail já digitado (cartão final "comece grátis"): a pessoa não
  // digita duas vezes.
  const [params] = useSearchParams();
  const [email, setEmail] = useState(() => {
    // Convite (?email=) tem prioridade: é o endereço a que o convite está amarrado.
    const doLink = params.get('email');
    if (doLink) return doLink;
    try {
      const seed = sessionStorage.getItem('signup_email') || '';
      if (seed) sessionStorage.removeItem('signup_email');
      return seed;
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [aceite, setAceite] = useState(false);
  const [comunicacoes, setComunicacoes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validação básica no cliente (nome é obrigatório; e-mail/senha o Supabase também valida).
    if (!name.trim()) { setError('Informe seu nome.'); return; }
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    if (password.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
    // Retorno imediato só para não criar uma conta que já nasceria bloqueada — quem decide de
    // fato é a edge function, no servidor.
    if (!birthDate) { setError('Informe sua data de nascimento.'); return; }
    if (idadeEmAnos(birthDate) === null) { setError('Essa data de nascimento não existe.'); return; }
    if (!ehMaiorDeIdade(birthDate)) {
      setError(`A Maestra é destinada a maiores de ${IDADE_MINIMA} anos.`);
      return;
    }
    if (!aceite) { setError('É preciso aceitar os Termos de Uso e a Política de Privacidade.'); return; }

    // Guarda o que foi respondido AQUI, antes de criar a conta. O registro em si é feito pelo
    // provider assim que houver sessão — ver o comentário em useConsent.tsx. Tentar enviar deste
    // componente falhava calado: a chamada saía junto com o redirecionamento que o desmonta, e a
    // pessoa reencontrava o mesmo formulário no gate.
    guardarConsentimentoPendente({
      email: email.trim(),
      birthDate,
      aceita: aceite,
      comunicacoes,
    });

    setLoading(true);
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
        // Confirmação ativada → código já enviado por e-mail (Brevo). Limpa a meia-sessão e pede o código.
        await supabase.auth.signOut();
        setStep('code');
        setLoading(false);
      }
    } catch (err: any) {
      setError(authError(err));
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <AuthShell>
        {/* Código já enviado no signUp — sem resendOnMount pra não duplicar. O consentimento
            guardado no formulário é registrado pelo provider assim que a sessão existir. */}
        <EmailCodeStep email={email.trim()} onVerified={() => navigate('/welcome', { replace: true })} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <p className={styles.footerText}>
          Já possui cadastro?{' '}
          <Link to='/login' className={styles.footerLink}>
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthField type='text' placeholder='Seu nome' value={name} onChange={setName} autoFocus />
        <AuthField type='email' placeholder='E-mail' value={email} onChange={setEmail} />
        <AuthField type='password' placeholder='Senha (mín. 6 caracteres)' value={password} onChange={setPassword} />
        <AuthField
          type='date'
          placeholder='Data de nascimento'
          value={birthDate}
          onChange={setBirthDate}
          max={new Date().toISOString().slice(0, 10)}
        />

        {/* Nenhuma caixa nasce marcada, e comunicações é opt-in separado do aceite legal. */}
        <label className={styles.consent}>
          <input type='checkbox' checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>
            Declaro ter {IDADE_MINIMA} anos ou mais e aceito os{' '}
            <Link to='/legal/termos' target='_blank' rel='noreferrer'>Termos de Uso</Link> e a{' '}
            <Link to='/legal/privacidade' target='_blank' rel='noreferrer'>Política de Privacidade</Link>.
          </span>
        </label>
        <label className={styles.consent}>
          <input type='checkbox' checked={comunicacoes} onChange={(e) => setComunicacoes(e.target.checked)} />
          <span>Quero receber novidades da Maestra por e-mail. <em>Opcional.</em></span>
        </label>

        {error && <div className={styles.error}>{error}</div>}
        <AuthSubmit loading={loading} label='Criar conta' />
      </form>
    </AuthShell>
  );
};

export default Signup;
