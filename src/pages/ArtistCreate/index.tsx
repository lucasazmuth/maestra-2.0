import { FC, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Spin } from 'antd';
import { FiAlertCircle } from 'react-icons/fi';
import { useDebounce } from 'use-debounce';

import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { supabase } from '../../lib/supabase';
import { artistsActions } from '../../store/slices/artists';
import { searchSpotifyArtists, type SpotifyArtistSearchResult } from '../../services/spotifyArtist';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { SpotifyLottie } from '../../components/SpotifyLottie';
import type { RealIndex } from '../../interfaces/maestra';
import { useCanCreateArtist } from '../../hooks/useCanCreateArtist';
import { formatRemainingTime } from '../../utils/rateLimitCalc';
import { DiagnosticReport, type Chartmetric } from './DiagnosticReport';
import styles from './ArtistCreate.module.scss';

type Step = 'perfil' | 'quiz' | 'analisando' | 'diagnostico';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Quiz do Índice REAL (5 perguntas de autorrelato). As OPÇÕES são os buckets das
// tabelas de z-score do backend — devem casar exatamente com as chaves em artist-diagnostic.
const QUIZ: { key: string; q: (n: string) => string; options: string[] }[] = [
  { key: 'faturamento', q: () => 'Qual seu faturamento bruto mensal médio com música? (média dos últimos 12 meses, incluindo o digital)', options: ['Não faturei', 'Menos de R$ 1.000', 'R$ 1.000 a R$ 5.000', 'R$ 5.000 a R$ 10.000', 'R$ 10.000 a R$ 20.000', 'R$ 20.000 a R$ 50.000', 'Acima de R$ 50.000', 'Não sei'] },
  { key: 'shows_pagos', q: () => 'Quantos shows pagos você realizou nos últimos 12 meses?', options: ['Nenhum', '1 a 5', '6 a 15', '16 a 30', '31 a 60', 'Mais de 60'] },
  { key: 'maior_publico', q: () => 'Qual o maior público para o qual você já se apresentou?', options: ['Nunca me apresentei', 'Até 100', '100 a 500', '500 a 2.000', '2.000 a 10.000', 'Mais de 10.000'] },
  { key: 'premios', q: () => 'Qual o maior reconhecimento em premiações que você já teve?', options: ['Nunca tive indicação nem prêmio', 'Já tive indicação, sem ganhar', 'Ganhei prêmio nacional', 'Ganhei prêmio internacional'] },
  { key: 'imprensa', q: () => 'Qual o maior alcance de mídia (imprensa, rádio, TV) que o seu trabalho já teve?', options: ['Nunca apareci na mídia', 'Repercussão em mídia local/regional', 'Repercussão em mídia nacional', 'Repercussão em mídia internacional'] },
];

const STEP_INDEX: Record<Step, number> = {
  perfil: 0, quiz: 1, analisando: 2, diagnostico: 2,
};

const ArtistCreate: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const artists = useAppSelector((s) => s.artists.items);
  const { canCreate: allowed, reason: rateLimitReason, pendingCount, cooldownRemainingSeconds, loading: rlLoading, error: rlError, retry: rlRetry } = useCanCreateArtist();

  const [step, setStep] = useState<Step>('perfil');
  const [line, setLine] = useState('');     // fala atual da Maestra
  const [typed, setTyped] = useState('');   // efeito de digitação
  const [typing, setTyping] = useState(false);

  // Perfil / busca (Spotify obrigatório)
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query, 400);
  const [results, setResults] = useState<SpotifyArtistSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Aviso inline quando o artista buscado já existe (mesmo usuário).
  const [notice, setNotice] = useState<{ name: string } | null>(null);
  const chosen = useRef<{ name: string; spotifyArtistId: string | null; followers: number | null; image: string | null }>({ name: '', spotifyArtistId: null, followers: null, image: null });

  // Quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const answers = useRef<Record<string, string>>({});

  // Diagnóstico (Índice REAL)
  const [realIndex, setRealIndex] = useState<RealIndex | null>(null);
  const [chartmetric, setChartmetric] = useState<Chartmetric | null>(null);
  const [diagError, setDiagError] = useState(false);
  const createdRef = useRef<{ artistId: string; locked: boolean } | null>(null);

  const say = (text: string) => setLine(text);

  // Typewriter da fala da Maestra (igual /welcome).
  useEffect(() => {
    if (!line) return;
    if (REDUCE_MOTION) { setTyped(line); setTyping(false); return; }
    setTyping(true);
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(line.slice(0, i));
      if (i >= line.length) { window.clearInterval(id); setTyping(false); }
    }, 18);
    return () => window.clearInterval(id);
  }, [line]);

  // Saudação inicial
  const intro = useRef(false);
  useEffect(() => {
    if (intro.current) return;
    intro.current = true;
    const hasArtists = artists.some((a) => a.role !== 'member');
    say(hasArtists
      ? 'Bora criar outro perfil de artista. Qual a gente vai trabalhar? Busca no Spotify que eu já trago os dados.'
      : 'Vamos criar um perfil de artista. Qual a gente vai trabalhar? Busca no Spotify que eu já trago os dados.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca Spotify
  useEffect(() => {
    let active = true;
    if (!debounced.trim()) { setResults([]); return; }
    setSearching(true);
    searchSpotifyArtists(debounced)
      .then((r) => active && setResults(r))
      .catch(() => active && setResults([]))
      .finally(() => active && setSearching(false));
    return () => { active = false; };
  }, [debounced]);

  // Roda o diagnóstico ao entrar em "analisando": cria (ou retorna) o artista no banco,
  // já com quiz + Chartmetric + diagnóstico salvos no content (nunca regerar).
  useEffect(() => {
    if (step !== 'analisando') return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('artist-diagnostic', {
          body: {
            name: chosen.current.name,
            spotifyArtistId: chosen.current.spotifyArtistId,
            spotify: { followers: chosen.current.followers, image: chosen.current.image },
            quiz: answers.current,
          },
        });
        if (error) throw error;
        const d = data as { artistId: string; locked?: boolean; reused?: boolean; realIndex: RealIndex | null; chartmetric: Chartmetric | null };
        if (!active) return;
        createdRef.current = { artistId: d.artistId, locked: d.locked !== false };
        // Atualiza a lista pra refletir o novo perfil (pendente) em /artists.
        if (user?.id) dispatch(artistsActions.fetchArtists(user.id));
        // Perfil reaproveitado já PAGO → segue direto pro app (sem mostrar diagnóstico de novo).
        if (d.reused && d.locked === false) {
          navigate(`/artists/${d.artistId}`, { replace: true });
          return;
        }
        setRealIndex(d?.realIndex || null);
        setChartmetric(d?.chartmetric || null);
        setDiagError(!d?.realIndex);
      } catch {
        if (active) setDiagError(true);
      }
      if (active) setStep('diagnostico');
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Handlers de fluxo ──────────────────────────────────────────────────────
  const startQuiz = (name: string, spotifyArtistId: string | null, followers: number | null, image: string | null = null) => {
    chosen.current = { name, spotifyArtistId, followers, image };
    setQuizIndex(0);
    setStep('quiz');
    say(QUIZ[0].q(name));
  };

  const handleSelectSpotify = async (r: SpotifyArtistSearchResult) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        const { data: isDuplicate } = await supabase.rpc('check_self_duplicate', {
          p_user_id: userId,
          p_spotify_id: r.id,
        });
        if (isDuplicate) {
          setNotice({ name: r.name });
          setResults([]);
          return;
        }
      }
    } catch { /* backend revalida via constraint */ }
    setNotice(null);
    setQuery('');
    setResults([]);
    startQuiz(r.name, r.id, r.followers ?? null, r.image ?? null);
  };

  const answerQuiz = (option: string) => {
    answers.current[QUIZ[quizIndex].key] = option;
    if (quizIndex + 1 < QUIZ.length) {
      const next = quizIndex + 1;
      setQuizIndex(next);
      say(QUIZ[next].q(chosen.current.name));
    } else {
      setStep('analisando');
      say(`Deixa eu cruzar esses dados e montar um diagnóstico de ${chosen.current.name}…`);
    }
  };

  const goToUnlock = () => {
    const created = createdRef.current;
    // O artista já viu o diagnóstico aqui no chat → abre o desbloqueio direto no pagamento.
    if (created) navigate(`/artists/${created.artistId}/desbloquear`, { state: { skipDiagnostic: true } });
    else navigate('/artists');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const showInteraction = !typing;
  const dotIndex = STEP_INDEX[step];

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/artists')}>Sair</button>

      <div className={styles.pillWrap}>
        <div className={styles.pillGlow} aria-hidden />
        <div className={styles.pill}>
          <MaestraLogo className={`${styles.pillLogo} maestra-logo-live`} />
          <span className={styles.pillText}>Maestra <span className={styles.pillManager}>Manager</span></span>
        </div>
      </div>

      <div className={styles.progress}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`${styles.dot} ${i === dotIndex ? styles.dotOn : i < dotIndex ? styles.dotDone : ''}`} />
        ))}
      </div>

      <div className={styles.step} key={`${step}-${quizIndex}`}>
        {step !== 'diagnostico' && (
          <p className={styles.line}>
            {typed}
            {typing && <span className={styles.caret} aria-hidden />}
          </p>
        )}

        {(showInteraction || step === 'diagnostico') && (
          <div className={styles.interaction}>
            {/* PERFIL — Spotify obrigatório (o diagnóstico REAL precisa dos dados da API) */}
            {step === 'perfil' && (
              <>
                {rlLoading && (
                  <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
                )}

                {!rlLoading && !allowed && rateLimitReason === 'pending_limit' && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Você tem {pendingCount} perfis pendentes. Pague ou exclua antes de criar outro.
                    </div>
                    <button className={styles.dupeNoticeBtn} onClick={() => navigate('/artists')}>Ver meus perfis</button>
                  </div>
                )}

                {!rlLoading && !allowed && rateLimitReason === 'cooldown' && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Aguarde {formatRemainingTime(cooldownRemainingSeconds)} para criar outro perfil.
                    </div>
                  </div>
                )}

                {rlError && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Erro ao verificar limites. Verifique sua conexão e tente novamente.
                    </div>
                    <button className={styles.dupeNoticeBtn} onClick={rlRetry}>Tentar novamente</button>
                  </div>
                )}

                <Input
                  autoFocus
                  size='large'
                  style={{ height: 56, fontSize: 16, borderRadius: 14, background: '#1a1a1a' }}
                  placeholder='Busque o artista no Spotify…'
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (notice) setNotice(null); }}
                  prefix={<SpotifyLottie size={24} style={{ marginRight: 4 }} />}
                  disabled={!allowed || rlLoading}
                />
                {(searching || results.length > 0) && (
                  <div className={styles.results}>
                    {searching && <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>}
                    {!searching && results.map((r) => (
                      <button key={r.id} className={styles.resultItem} onClick={() => handleSelectSpotify(r)}>
                        <img src={r.image || ARTISTS_DEFAULT_IMAGE} alt={r.name} />
                        <div>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                          {r.followers != null && <div style={{ color: '#b3b3b3', fontSize: 12 }}>{r.followers.toLocaleString('pt-BR')} seguidores</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {notice && (
                  <div className={styles.dupeNotice}>
                    <FiAlertCircle className={styles.dupeNoticeIcon} />
                    <div className={styles.dupeNoticeText}>
                      Você já tem <strong>{notice.name}</strong> nos seus perfis. Não dá pra criar de novo, mas você pode abrir o que já existe.
                    </div>
                    <button className={styles.dupeNoticeBtn} onClick={() => navigate('/artists')}>Ver meus perfis</button>
                  </div>
                )}
              </>
            )}

            {/* QUIZ */}
            {step === 'quiz' && (
              <div className={styles.options}>
                {QUIZ[quizIndex].options.map((o) => (
                  <button key={o} className={styles.option} onClick={() => answerQuiz(o)}>{o}</button>
                ))}
              </div>
            )}

            {/* ANALISANDO */}
            {step === 'analisando' && (
              <div className={styles.analyzing}><Spin /> Analisando o perfil e cruzando os dados do quiz…</div>
            )}

            {/* DIAGNÓSTICO (Índice REAL) */}
            {step === 'diagnostico' && (
              realIndex ? (
                <DiagnosticReport
                  realIndex={realIndex}
                  chartmetric={chartmetric}
                  artistName={chosen.current.name}
                  artistImage={chosen.current.image}
                  onContinue={goToUnlock}
                />
              ) : (
                <div className={styles.diagWrap} style={{ textAlign: 'center' }}>
                  <p style={{ color: '#cfcfd4', marginBottom: 18 }}>
                    {diagError ? 'Não consegui gerar seu diagnóstico agora. Tente novamente em instantes.' : 'Carregando…'}
                  </p>
                  {diagError && (
                    <button className={styles.cta} onClick={() => { setDiagError(false); setStep('analisando'); }}>
                      Tentar de novo
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistCreate;
