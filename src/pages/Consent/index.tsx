import { FC, useMemo, useRef, useState } from 'react';
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

const Consent: FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { state, apply } = useConsent();

  // Antes era um <input type="date">: no iOS/Android isso abre o seletor nativo de rolagem, que
  // exige rolar por dezenas de anos para alguem nascido nos anos 90 chegar la — lento e o motivo
  // mais comum de abandono nesse tipo de campo. Three digitos ao inves de selecionar: dia, mes e
  // ano em caixas separadas, cada uma com o teclado numerico do celular (inputMode="numeric") e
  // avanco automatico para a proxima ao completar — o mesmo padrao ja usado no codigo de
  // confirmacao por e-mail (EmailCodeStep.tsx).
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const diaRef = useRef<HTMLInputElement>(null);
  const mesRef = useRef<HTMLInputElement>(null);
  const anoRef = useRef<HTMLInputElement>(null);

  // Só vira uma data pra validar quando os três campos estão completos — ISO (AAAA-MM-DD), o
  // formato que `idadeEmAnos` espera. Incompleta, fica '' e nenhum aviso de erro aparece ainda
  // (ver dataInvalida abaixo): a pessoa não pode ver "data inválida" no meio da digitação.
  const birthDate = useMemo(
    () => (dia.length === 2 && mes.length === 2 && ano.length === 4 ? `${ano}-${mes}-${dia}` : ''),
    [dia, mes, ano]
  );

  const soDigitos = (v: string) => v.replace(/\D/g, '');

  const onDiaChange = (v: string) => {
    const d = soDigitos(v).slice(0, 2);
    setDia(d);
    if (d.length === 2) mesRef.current?.focus();
  };
  const onMesChange = (v: string) => {
    const m = soDigitos(v).slice(0, 2);
    setMes(m);
    if (m.length === 2) anoRef.current?.focus();
  };
  const onAnoChange = (v: string) => setAno(soDigitos(v).slice(0, 4));

  // Backspace num campo vazio volta e foca o campo anterior — sem apagar nada nele: a pessoa só
  // reencontra o cursor de onde vai continuar corrigindo, do jeito que já espera de um campo
  // segmentado (mesma convenção do código de confirmação por e-mail).
  const onMesKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && mes === '') diaRef.current?.focus();
  };
  const onAnoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && ano === '') mesRef.current?.focus();
  };

  // Colar uma data inteira ("23/02/1995", "23021995"...) no primeiro campo distribui os dígitos
  // pelos três — sem isso, colar preencheria só os 2 primeiros dígitos do dia e o resto se perdia.
  const onDiaPaste = (e: React.ClipboardEvent) => {
    const digitos = soDigitos(e.clipboardData.getData('text'));
    if (digitos.length < 8) return; // poucos dígitos: deixa o comportamento normal de colar
    e.preventDefault();
    setDia(digitos.slice(0, 2));
    setMes(digitos.slice(2, 4));
    setAno(digitos.slice(4, 8));
    anoRef.current?.focus();
  };
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
            <div className={styles.field}>
              {/* Rótulo de grupo, não de UM campo: com três inputs dentro, um <label> só
                  encaminharia o foco/clique para o primeiro. O vínculo com os campos vem do
                  aria-label de cada um. */}
              <span id='birthDateLabel'>Data de nascimento</span>
              <div className={styles.dateGroup} role='group' aria-labelledby='birthDateLabel'>
                <input
                  ref={diaRef}
                  className={styles.dateBox}
                  type='text'
                  inputMode='numeric'
                  autoComplete='bday-day'
                  placeholder='DD'
                  maxLength={2}
                  value={dia}
                  onChange={(e) => onDiaChange(e.target.value)}
                  onPaste={onDiaPaste}
                  aria-label='Dia'
                  required
                />
                <span className={styles.dateSep} aria-hidden>/</span>
                <input
                  ref={mesRef}
                  className={styles.dateBox}
                  type='text'
                  inputMode='numeric'
                  autoComplete='bday-month'
                  placeholder='MM'
                  maxLength={2}
                  value={mes}
                  onChange={(e) => onMesChange(e.target.value)}
                  onKeyDown={onMesKeyDown}
                  aria-label='Mês'
                  required
                />
                <span className={styles.dateSep} aria-hidden>/</span>
                <input
                  ref={anoRef}
                  className={`${styles.dateBox} ${styles.dateBoxYear}`}
                  type='text'
                  inputMode='numeric'
                  autoComplete='bday-year'
                  placeholder='AAAA'
                  maxLength={4}
                  value={ano}
                  onChange={(e) => onAnoChange(e.target.value)}
                  onKeyDown={onAnoKeyDown}
                  aria-label='Ano'
                  required
                />
              </div>
              {dataInvalida && <span className={styles.hint}>Essa data não existe no calendário.</span>}
              {dataFutura && <span className={styles.hint}>A data não pode estar no futuro.</span>}
              {menorDeIdade && (
                <span className={styles.hint}>
                  A Maestra é destinada a maiores de 18 anos. Ao enviar, sua conta ficará bloqueada
                  para revisão.
                </span>
              )}
            </div>
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
