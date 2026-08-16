import { FC, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { supabase } from '../../lib/supabase';
import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { MaestraBrand } from '../../components/MaestraBrand';
import { useConsent, type ConsentState } from '../../hooks/useConsent';
import { IDADE_MINIMA, idadeEmAnos } from '../../utils/age';
import styles from './Consent.module.scss';

// Coleta de maioridade e aceite dos documentos legais (LGPD).
//
// Uma tela só para os três casos: cadastro por e-mail, login por Google (que não passa por
// formulário nenhum) e as contas criadas antes desta exigência. Quem decide se o dado vale é a
// edge function `account-consent` — aqui a validação existe só para dar retorno imediato.

const hojeISO = () => new Date().toISOString().slice(0, 10);

const Consent: FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { state, apply } = useConsent();

  const [birthDate, setBirthDate] = useState('');
  const [maioridade, setMaioridade] = useState(false);
  const [termos, setTermos] = useState(false);
  const [politica, setPolitica] = useState(false);
  const [comunicacoes, setComunicacoes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reaceite de uma versão nova não volta a pedir a data: o servidor reaproveita a já registrada.
  const precisaData = state?.needsBirthDate !== false;
  const docsPendentes = state?.pendingDocs ?? [];

  const idade = useMemo(() => (birthDate ? idadeEmAnos(birthDate) : null), [birthDate]);
  const dataInvalida = birthDate !== '' && idade === null;
  const menorDeIdade = idade !== null && idade >= 0 && idade < IDADE_MINIMA;
  const dataFutura = idade !== null && idade < 0;

  const podeEnviar =
    !loading &&
    maioridade && termos && politica &&
    (!precisaData || (birthDate !== '' && !dataInvalida && !dataFutura));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('account-consent', {
        body: {
          action: 'submit',
          ...(precisaData ? { birthDate } : {}),
          aceitaTermos: termos,
          aceitaPolitica: politica,
          aceitaComunicacoes: comunicacoes,
        },
      });
      if (fnError) throw fnError;
      if (data?.error && !data?.blocked) throw new Error(data.error);

      apply(data as ConsentState);
      // O bloqueio de menor tem tela própria; o gate redireciona sozinho na próxima renderização.
      navigate(data?.blocked ? '/conta-bloqueada' : '/artists', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível registrar. Tente novamente.');
      setLoading(false);
    }
  };

  const sair = async () => {
    await dispatch(authActions.signOut());
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <MaestraBrand variant='lockup' tone='dark' className={styles.brand} />

        <p className={styles.eyebrow}>Um passo antes de continuar</p>
        <h1 className={styles.title}>
          {docsPendentes.length && !precisaData
            ? 'Atualizamos nossos documentos'
            : 'Confirme sua idade e o aceite dos termos'}
        </h1>
        <p className={styles.lead}>
          {docsPendentes.length && !precisaData
            ? 'Revise e aceite a versão mais recente para seguir usando a Maestra.'
            : 'A Maestra é destinada a maiores de 18 anos. Precisamos registrar sua declaração e o aceite dos nossos documentos, como exige a Lei Geral de Proteção de Dados.'}
        </p>

        <form onSubmit={enviar}>
          {precisaData && (
            <label className={styles.field}>
              <span>Data de nascimento</span>
              <input
                className={styles.dateInput}
                type='date'
                value={birthDate}
                max={hojeISO()}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
              {dataInvalida && <span className={styles.hint}>Essa data não existe no calendário.</span>}
              {dataFutura && <span className={styles.hint}>A data não pode estar no futuro.</span>}
              {menorDeIdade && (
                <span className={styles.hint}>
                  A Maestra é destinada a maiores de 18 anos. Ao enviar, sua conta ficará bloqueada
                  para revisão.
                </span>
              )}
            </label>
          )}

          <div className={styles.checks}>
            <label className={styles.check}>
              <input type='checkbox' checked={maioridade} onChange={(e) => setMaioridade(e.target.checked)} />
              <span>Declaro ter 18 anos ou mais.</span>
            </label>

            <label className={styles.check}>
              <input type='checkbox' checked={termos} onChange={(e) => setTermos(e.target.checked)} />
              <span>
                Li e concordo com os{' '}
                <Link to='/legal/termos' target='_blank' rel='noreferrer'>Termos de Uso</Link>.
              </span>
            </label>

            <label className={styles.check}>
              <input type='checkbox' checked={politica} onChange={(e) => setPolitica(e.target.checked)} />
              <span>
                Li e concordo com a{' '}
                <Link to='/legal/privacidade' target='_blank' rel='noreferrer'>Política de Privacidade</Link>.
              </span>
            </label>

            {/* Opt-in próprio: comunicação de marketing não pode vir embutida no aceite da política. */}
            <label className={`${styles.check} ${styles.optional}`}>
              <input type='checkbox' checked={comunicacoes} onChange={(e) => setComunicacoes(e.target.checked)} />
              <span>
                Quero receber novidades e comunicações da Maestra por e-mail.{' '}
                <em>Opcional — você pode cancelar quando quiser.</em>
              </span>
            </label>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type='submit' className={styles.submit} disabled={!podeEnviar}>
            {loading ? 'Registrando…' : 'Confirmar e continuar'}
          </button>
        </form>

        <button type='button' className={styles.signOut} onClick={sair}>
          Sair da conta
        </button>
      </div>
    </div>
  );
};

export default Consent;
