import { FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import { useAppSelector } from '../../store/store';
import { PRODUCT_THEME } from '../../components/productTheme';
import { Header, Footer } from '../Landing';
import landing from '../Landing/Landing.module.scss';
import styles from './DiagnosticoReal.module.scss';

// Accent do produto REAL (mesmo verde usado nos cards da jornada e no recurso da landing).
const ACCENT = PRODUCT_THEME.real.accent;

// As quatro dimensões — resumo (strip) e versão detalhada (§ "O que o REAL mede").
const DIMENSIONS: { k: string; name: string; sub: string; short: string; long: string }[] = [
  {
    k: 'R', name: 'Reach', sub: 'Alcance',
    short: 'Alcance: quanta gente é atingida pela música.',
    long: 'Quanta gente é atingida pela música: ouvintes mensais no Spotify, seguidores nas redes e consumo de vídeo no YouTube. Mede exposição: ser ouvido e visto, mesmo passivamente.',
  },
  {
    k: 'E', name: 'Earnings', sub: 'Receita',
    short: 'Receita: a música sustenta o artista, com saúde.',
    long: 'A música sustenta o artista, com saúde: receita de shows e fontes musicais, ajustada pela estrutura (formalização, empresariamento). Mede sustentabilidade financeira: não o volume bruto, mas a saúde.',
  },
  {
    k: 'A', name: 'Audience', sub: 'Público real',
    short: 'Público real: quem escolheu, paga e aparece.',
    long: 'Quem escolheu o artista de verdade: conversão de ouvintes em seguidores, engajamento, shows e público pagante. Mede compromisso: gente que paga, aparece e segue. O oposto do alcance passivo.',
  },
  {
    k: 'L', name: 'Legitimacy', sub: 'Legitimação',
    short: 'Legitimação: o reconhecimento de júri e mídia.',
    long: 'O reconhecimento externo: prêmios, presença na imprensa, playlists editoriais e execução em rádio. Mede a chancela de júris, mídia e curadoria: o capital simbólico da carreira.',
  },
];

// Os 16 perfis, na ordem do Icon (todas altas) ao Beginner (todas baixas).
// `bits` segue a ordem das letras R-E-A-L (1 = dimensão alta/acesa, 0 = baixa/apagada).
const LETTERS = ['R', 'E', 'A', 'L'];
const PROFILES: { name: string; bits: string }[] = [
  { name: 'Icon', bits: '1111' }, { name: 'Hit', bits: '1110' }, { name: 'Spotlight', bits: '1101' }, { name: 'Digital', bits: '1100' },
  { name: 'Underpaid', bits: '1011' }, { name: 'Potential', bits: '1010' }, { name: 'Hype', bits: '1001' }, { name: 'Influencer', bits: '1000' },
  { name: 'Analog', bits: '0111' }, { name: 'Rising', bits: '0110' }, { name: 'Outlier', bits: '0101' }, { name: 'Moneymaker', bits: '0100' },
  { name: 'Bet', bits: '0011' }, { name: 'Paradox', bits: '0010' }, { name: 'Cult', bits: '0001' }, { name: 'Beginner', bits: '0000' },
];

const STATS = [
  { n: '16', l: 'perfis de carreira mapeados' },
  { n: '4', l: 'dimensões objetivas' },
  { n: '313', l: 'planejamentos analisados' },
  { n: '30+', l: 'anos de gestão destilados' },
];

const DiagnosticoReal: FC = () => {
  const navigate = useNavigate();
  const loggedIn = useAppSelector((s) => !!s.auth.user);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Diagnóstico REAL · Maestra Manager';
    window.scrollTo({ top: 0 });
    return () => { document.title = prev; };
  }, []);

  const startDiagnostic = () => navigate(loggedIn ? '/criar-artista' : '/signup');

  return (
    <div className={styles.page} style={{ ['--accent' as string]: ACCENT } as React.CSSProperties}>
      <Header loggedIn={loggedIn} />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.kicker}>Diagnóstico REAL</span>
          <h1 className={styles.heroTitle}>O retrato <span className={styles.accent}>honesto</span> de uma carreira musical.</h1>
          <p className={styles.heroLead}>
            O Índice REAL é o motor de diagnóstico da Maestra Manager. Ele lê a carreira de um artista por quatro
            dimensões objetivas e devolve, em segundos, onde ela realmente está, não onde parece estar. É o ponto de
            partida de todo planejamento na plataforma.
          </p>
          <button className={`${landing.btnPrimary} ${styles.heroCta}`} onClick={startDiagnostic}>
            Fazer meu diagnóstico grátis <FiArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── As quatro dimensões (resumo) ─────────────────────────────────────── */}
      <section className={styles.dims}>
        <div className={styles.dimsGrid}>
          {DIMENSIONS.map((d) => (
            <div key={d.k} className={styles.dimCard}>
              <span className={styles.dimLetter}>{d.k}</span>
              <div className={styles.dimName}>{d.name}</div>
              <p className={styles.dimShort}>{d.short}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Callout: alcance ≠ público ───────────────────────────────────────── */}
      <section className={styles.calloutWrap}>
        <div className={styles.callout}>
          <h2 className={styles.calloutTitle}>Alcance não é público.</h2>
          <p className={styles.calloutBody}>
            O coração do REAL é uma distinção que o mercado costuma confundir: ter milhões de streams (alcance) é
            diferente de ter gente que compra ingresso e segue a música (público). O REAL mede as duas coisas
            separadamente e revela o descompasso entre elas. É aí que mora a estratégia.
          </p>
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────────────────────── */}
      <section className={styles.how}>
        <div className={styles.howInner}>
          <span className={styles.introKicker}>Como funciona</span>
          <div className={styles.howCols}>
            <div className={styles.howCol}>
              <h3>Dados reais, não percepção</h3>
              <p>
                O REAL cruza dados de plataforma (Spotify, redes, YouTube, lidos via API) com o que o artista informa
                sobre shows, receita e reconhecimento. Cada dimensão é calibrada e classificada, gerando 1 de 16 perfis
                de carreira, do iniciante ao ícone.
              </p>
            </div>
            <div className={styles.howCol}>
              <h3>Método, não achismo</h3>
              <p>
                O índice nasce de mais de 30 anos de gestão de carreiras musicais e da análise de 313 planejamentos
                estratégicos reais, sustentado por pesquisa de doutorado. Rigor acadêmico a serviço de uma resposta
                prática.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Números ──────────────────────────────────────────────────────────── */}
      <section className={styles.stats}>
        <div className={styles.statsInner}>
          {STATS.map((s) => (
            <div key={s.l} className={styles.stat}>
              <div className={styles.statNum}>{s.n}</div>
              <div className={styles.statLabel}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── O que o REAL mede (detalhado) ────────────────────────────────────── */}
      <section className={styles.measure}>
        <div className={styles.measureInner}>
          <div className={styles.measureHead}>
            <span className={styles.introKicker}>As quatro dimensões</span>
            <h2 className={styles.measureTitle}>O que o REAL mede e como vira perfil.</h2>
          </div>
          <div className={styles.dimRows}>
            {DIMENSIONS.map((d) => (
              <div key={d.k} className={styles.dimRow}>
                <span className={styles.dimRowLetter}>{d.k}</span>
                <div className={styles.dimRowBody}>
                  <h3 className={styles.dimRowName}>{d.name} <span className={styles.dimRowSub}>· {d.sub}</span></h3>
                  <p className={styles.dimRowDesc}>{d.long}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Os 16 perfis ─────────────────────────────────────────────────────── */}
      <section className={styles.profiles}>
        <div className={styles.profilesInner}>
          <div className={styles.profilesHead}>
            <span className={styles.introKicker}>Os 16 perfis</span>
            <p className={styles.profilesIntro}>
              Cada dimensão acende (alta) ou não (baixa). A combinação das quatro letras define um de 16 perfis de
              carreira, do Beginner ao Icon. As letras acesas mostram as forças de cada perfil.
            </p>
            <div className={styles.legend}>
              <span className={styles.legendItem}><span className={`${styles.dot} ${styles.dotOn}`} /> letra acesa (dimensão alta)</span>
              <span className={styles.legendItem}><span className={`${styles.dot} ${styles.dotOff}`} /> letra apagada (dimensão baixa)</span>
            </div>
          </div>
          <div className={styles.profileGrid}>
            {PROFILES.map((p) => (
              <div key={p.name} className={styles.profileCard}>
                <div className={styles.profileName}>{p.name}</div>
                <div className={styles.profileBits}>
                  {LETTERS.map((letter, i) => (
                    <span key={letter} className={`${styles.bit} ${p.bits[i] === '1' ? styles.bitOn : styles.bitOff}`}>{letter}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className={styles.ctaBand}>
        <div className={styles.ctaBandInner}>
          <h2 className={styles.ctaBandTitle}>Comece com o diagnóstico grátis</h2>
          <p className={styles.ctaBandSub}>
            Leva poucos minutos pra ver onde sua carreira está, e dá o primeiro passo pra onde ela pode ir.
          </p>
          <button className={`${landing.btnPrimary} ${styles.ctaBandBtn}`} onClick={() => navigate(loggedIn ? '/artists' : '/signup')}>
            {loggedIn ? 'Ir pro app' : 'Começar grátis'} <FiArrowRight size={18} />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default DiagnosticoReal;
