import { FC, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiArrowUp, FiCheck, FiChevronDown, FiPlay } from 'react-icons/fi';

import { NytaAvatar } from '../Wizard/chat/nytaPersona';
import { usePwaInstall } from '../../components/PwaInstallBanner';
import { Header, Footer } from './NoirChrome';
import heroFigure from '../../assets/landing-hero-figure.png';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { fetchPlanConfig } from '../../store/slices/subscription';
import { usePlanPrices, fmtBRL } from '../../hooks/usePlanPrices';
import styles from './Noir.module.scss';

// ─────────────────────────────────────────────────────────────────────────────
// Landing oficial, no layout de referência (design-ref/soundbox): fundo azul-noite em degradê,
// display em caixa alta, cartões de vidro, selo serrilhado, onda e barras decorativas.
//
// A estrutura e as medidas vêm da réplica em design-ref/soundbox/home.html (extraída dos SVGs
// originais). O conteúdo é o da Maestra; o verde-limão da referência ficou como cor de destaque.
//
// O chrome CLARO antigo (usado por /diagnostico-real e /music-rio-academy) mudou pra
// ./LightChrome.tsx — os re-exports no fim mantêm os imports de fora funcionando.
// ─────────────────────────────────────────────────────────────────────────────

const fmt = fmtBRL;

const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// ─── Dados ───────────────────────────────────────────────────────────────────
// O carrossel de módulos segue o bloco "Popular Album" da referência: o ativo grande no meio e
// os vizinhos como painéis estreitos, com o nome na vertical.
const MODULES: { title: string; sub: string; desc: string; to?: string }[] = [
  {
    title: 'Diagnóstico REAL', sub: 'o ponto de partida', to: '/diagnostico-real',
    desc: 'Um raio-X da carreira em quatro dimensões, cruzando dados do Spotify e das redes com o que só você sabe. Em minutos você descobre qual dos 16 perfis é o seu e onde a carreira realmente está, não onde parece estar.',
  },
  {
    title: 'Planejamento estratégico', sub: 'o mapa',
    desc: 'A metodologia de 30 anos da Anita Carvalho, destilada de 313 planejamentos reais, transforma o diagnóstico em visão, missão, objetivos e as estratégias certas pro seu momento, já priorizadas.',
  },
  {
    title: 'Plano de ação', sub: 'a execução',
    desc: 'Cada estratégia vira tarefas com progresso, prazos e responsáveis, além de cronograma e modelagem financeira. É o caminho do "o que fazer" pro "feito".',
  },
  {
    title: 'Gestão completa', sub: 'o dia a dia',
    desc: 'Músicas, agenda de shows e lançamentos e a equipe junto: a operação da carreira mora no mesmo lugar do plano, e cada entrega alimenta o próximo diagnóstico.',
  },
  {
    title: 'Nyta IA', sub: 'a assistente',
    desc: 'A assistente que acompanha a carreira em todos os módulos: tira dúvidas, sugere caminhos e ajuda a executar o plano, sempre no contexto dos seus dados.',
  },
  {
    title: 'E ela só cresce', sub: 'em breve',
    desc: 'Novos módulos a caminho: marketing, CRM e financeiro, no mesmo lugar do resto da carreira.',
  },
];

const SUGGESTIONS = [
  'Como aumentar meus ouvintes no Spotify?',
  'Qual o próximo passo da minha carreira?',
  'Como montar meu plano de lançamento?',
  'Por onde eu começo a crescer?',
];

// Clientes REAIS da Maestra (nomes informados pelo Lucas). As frases são ilustrativas —
// confirmar/ajustar com o depoimento real de cada um antes de tratar como citação literal.
const TESTIMONIALS = [
  { quote: 'O planejamento com a Nyta virou meu mapa. Hoje sei exatamente qual é o próximo passo de cada artista que produzo.', name: 'AZMUTH', role: 'Produtor Musical · Rio de Janeiro', i: 'A', c: '#9A4FD1' },
  { quote: 'A gente vivia apagando incêndio. Com o plano de ação organizado, a operação anda toda na mesma direção.', name: 'A Banca Records', role: 'Gravadora · Rio de Janeiro', i: 'B', c: '#6d4aff' },
  { quote: 'O Diagnóstico REAL me mostrou com dados onde eu realmente estava. Parei de agir no achismo.', name: 'Madhá', role: 'Compositora · Minas Gerais', i: 'M', c: '#c1543f' },
];

const FREE_ITEMS = ['Diagnóstico REAL completo nas 4 dimensões', 'Descubra qual dos 16 perfis é o seu', 'Sem cartão de crédito pra começar'];
const PLAN_ITEMS = ['Planejamento estratégico completo com a Nyta', 'Plano de ação com metas e cronograma', 'Análise de audiência: ouvintes e cidades', 'Músicas, agenda e equipe', 'Acesso vitalício ao perfil e ao plano'];
const PRO_ITEMS = ['Nyta IA (assistente, até 100 interações por dia)', 'Edição em todos os perfis que você acessa', 'Músicas ilimitadas', 'Acesso a todos os perfis da conta'];

const buildFaqItems = (once: number, monthly: number, annual: number): { q: string; a: string }[] => [
  { q: 'O diagnóstico é grátis mesmo?', a: 'Sim. Você cria a conta, conecta o perfil do artista e recebe o Diagnóstico REAL completo sem pagar nada e sem cadastrar cartão. O pagamento só aparece se você quiser desbloquear o planejamento estratégico daquele artista.' },
  { q: 'O que eu ganho ao desbloquear um artista?', a: `Por ${fmt(once)} (pagamento único, sem mensalidade), aquele artista ganha o planejamento estratégico completo, o plano de ação com metas e cronograma, análise de audiência e as ferramentas de gestão: músicas, agenda e equipe. É vitalício.` },
  { q: 'Qual a diferença entre o desbloqueio e o Maestra PRO?', a: `São coisas diferentes: o desbloqueio é um pagamento único por artista e libera o planejamento daquele perfil pra sempre. O PRO é uma assinatura opcional (${fmt(monthly)}/mês ou ${fmt(annual)}/ano) que adiciona a Nyta IA e o gerenciamento de vários perfis na conta.` },
  { q: 'Posso cancelar o PRO quando quiser?', a: 'Pode. O PRO é uma assinatura sem fidelidade: cancelando, você mantém o acesso até o fim do período já pago. Os desbloqueios de artista não expiram — são seus.' },
  { q: 'Sou empresário/produtor e cuido de vários artistas. Funciona pra mim?', a: 'Sim. Cada artista tem um perfil próprio com diagnóstico, planejamento e operação. Com o PRO você gerencia todos os perfis da conta e convida a equipe de cada artista com níveis de acesso.' },
  { q: 'De onde vêm os dados do diagnóstico?', a: 'De duas fontes: dados públicos das plataformas (Spotify, redes sociais, YouTube) e o que você informa sobre shows, receita e reconhecimento. O cruzamento das duas é o que torna o retrato honesto.' },
];

// ID do vídeo de apresentação no YouTube (o trecho depois de `v=` na URL). Vazio, o container
// mostra o espaço reservado em vez de um player em branco.
const HERO_VIDEO_ID = 'CeMv7yjdAMU';

// ─── Hero ────────────────────────────────────────────────────────────────────
// Selo serrilhado da referência: 26 pontas curtas geradas por código (mesmo desenho do
// design-ref). O texto corre num arco em cima e o centro é o botão de play.
const SEAL_POINTS = (() => {
  const pts: string[] = [];
  const N = 26;
  for (let i = 0; i < N * 2; i++) {
    const r = i % 2 ? 42.5 : 49;
    const a = (Math.PI * i) / N - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const Hero: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const start = () => navigate(loggedIn ? '/criar-artista' : '/signup');

  return (
    <section className={styles.hero} id='top'>
      <div className={styles.heroTitle}>
        <span className={styles.heroKicker}>Gestão de carreira musical</span>
        <div className={styles.heroLine1}>
          <h1 className={styles.hDisplay}>A música evoluiu</h1>
          <span className={styles.heroBadge} aria-hidden><FiPlay size={30} /></span>
        </div>
        <h1 className={`${styles.hDisplay} ${styles.heroLine2}`}>A gestão também</h1>
        <div className={styles.heroCtas}>
          <button className={styles.btnNeon} onClick={start}>
            Fazer meu diagnóstico grátis <FiArrowRight size={18} />
          </button>
          <button className={styles.btnGhost} onClick={scrollTo('planos')}>Ver planos</button>
        </div>
        <p className={styles.heroNote}>Sem cartão de crédito.</p>
      </div>

      {/* Palco nas coordenadas da referência (Hero.svg): a figura em x=483/y=412, o cartão em
          855/696, o selo com centro em 266/578, os controles em 182/831 e os pontos em 1088/887,
          medidos na prancheta de 1440 com conteúdo de 1110. */}
      <div className={`${styles.shell} ${styles.heroStage}`}>
        {/* Onda: o traço do próprio arquivo (paint4), no sistema de 1465×811 do Hero.svg. */}
        <svg className={styles.heroWave} viewBox='0 240 1465 230' preserveAspectRatio='none' aria-hidden focusable='false'>
          <path d='M0 354.5H402.109C402.945 354.5 403.693 353.98 403.984 353.196L441.717 251.499C442.442 249.547 445.295 249.863 445.574 251.926L473.114 455.091C473.425 457.383 476.732 457.406 477.074 455.117L499.347 306.061C499.677 303.854 502.827 303.763 503.283 305.948L521.278 392.241C521.708 394.305 524.627 394.384 525.168 392.347L558.084 268.582C558.639 266.496 561.649 266.647 561.992 268.779L580.234 382.233C580.516 383.992 582.785 384.531 583.829 383.088L603.901 355.328C604.277 354.808 604.88 354.5 605.522 354.5H1082.08C1082.93 354.5 1083.69 355.04 1083.97 355.845L1103.4 411.949C1104.05 413.802 1106.69 413.721 1107.22 411.832L1132.19 322.286C1132.76 320.246 1135.69 320.374 1136.08 322.455L1161.27 457.092C1161.69 459.316 1164.9 459.247 1165.22 457.007L1189.5 287.495C1189.81 285.307 1192.92 285.169 1193.42 287.321L1218.7 394.967C1219.13 396.806 1221.64 397.077 1222.45 395.373L1241.46 355.637C1241.79 354.942 1242.49 354.5 1243.26 354.5H1465' />
        </svg>

        {/* O selo repetia o botão ("diagnóstico grátis" nos dois, a 150px um do outro). Agora ele
            usa o ▶ pra que serve: leva ao vídeo de apresentação. */}
        <button className={styles.seal} onClick={scrollTo('video')} aria-label='Ver como funciona'>
          <svg className={styles.sealStar} viewBox='0 0 100 100' aria-hidden focusable='false'><path d={SEAL_POINTS} /></svg>
          {/* O texto corre no meio do anel: raio 50 põe a linha entre a ponta da estrela (78) e o
              disco escuro (33), e o startOffset de 50% com âncora ao centro mantém a frase
              centrada no arco, qualquer que seja o comprimento dela. */}
          <svg className={styles.sealCaption} viewBox='0 0 160 160' aria-hidden focusable='false'>
            <defs><path id='landing-seal-arc' d='M30 80a50 50 0 0 1 100 0' /></defs>
            <text textAnchor='middle'><textPath href='#landing-seal-arc' startOffset='50%'>veja como funciona</textPath></text>
          </svg>
          <span className={styles.sealCore}><FiPlay size={20} /></span>
          <span className={styles.sealDot} aria-hidden />
        </button>

        {/* Figura central: blob neon + recorte. A foto é o placeholder herdado da referência —
            trocar por um recorte de artista da Maestra (mesmo enquadramento, PNG sem fundo). */}
        <div className={styles.heroFigure}>
          <span className={styles.heroBlob} aria-hidden />
          <img src={heroFigure} alt='' />
        </div>

        {/* O cartão "tocando agora" da referência virou a pergunta da Nyta. Mostrar um resultado
            fictício ("Perfil Rising · 72") não dizia nada a quem chega; a pergunta fala com o
            visitante e o clique leva pro diagnóstico que responde. */}
        <button className={styles.nowCard} onClick={start}>
          <span className={styles.nowIcon}><NytaAvatar size={40} /></span>
          <span className={styles.nowMeta}>
            <em>Nyta IA</em>
            <strong>Você sabe como está a sua carreira hoje?</strong>
          </span>
          <span className={styles.nowGo} aria-hidden><FiArrowRight size={18} /></span>
        </button>
      </div>
    </section>
  );
};

// ─── Vídeo + números (slot "many top songs" da referência) ───────────────────
function useCountUp(target: number, start: boolean, duration = 1600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setN(Math.floor(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);
  return n;
}

// Barras decorativas com as alturas do SVG original (a "onda sonora" da referência).
const BAR_HEIGHTS = [16, 30, 57, 75, 95, 117, 137, 137, 122, 103, 84, 58, 31, 61, 80, 98, 116, 144, 122, 144, 161, 160, 105, 139, 120, 100, 77, 49, 77, 120, 98, 74, 53, 70, 88, 76, 90, 72, 58, 41, 41];

const VideoStats: FC = () => {
  const ref = useRef<HTMLElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const planos = useCountUp(313, vis);
  const perfis = useCountUp(16, vis);
  const anos = useCountUp(30, vis);

  return (
    <section className={styles.video} id='video' ref={ref}>
      <div className={`${styles.shell} ${styles.videoGrid}`}>
        {/* O vídeo ocupa a largura do conteúdo e o texto vem abaixo: em duas colunas, o player
            ficava pequeno demais pra ser assistido de fato. */}
        <div className={styles.videoFrame}>
          {HERO_VIDEO_ID ? (
            <iframe
              className={styles.videoPlayer}
              src={`https://www.youtube-nocookie.com/embed/${HERO_VIDEO_ID}?rel=0&modestbranding=1`}
              title='Conheça a Maestra'
              allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
              allowFullScreen
              loading='lazy'
            />
          ) : (
            <div className={styles.videoEmpty}>
              <span className={styles.videoPlay} aria-hidden><FiPlay size={24} /></span>
              <p>Espaço reservado pro vídeo de apresentação</p>
            </div>
          )}
        </div>
        <div className={styles.videoCopy}>
          <h2 className={styles.hSection}>O retrato honesto da sua carreira</h2>
          <p className={styles.pLead}>
            A metodologia nasce de 30 anos de gestão de carreiras e da análise de planejamentos reais,
            sustentada por pesquisa de doutorado. Método de mercado, não achismo de internet.
          </p>
          <div className={styles.videoStats}>
            <div><strong>{planos}+</strong><span>planejamentos reais</span></div>
            <div><strong>{perfis}</strong><span>perfis de carreira</span></div>
            <div><strong>{anos}+</strong><span>anos de metodologia</span></div>
          </div>
        </div>
      </div>
      {/* Onda do Auto Layout Horizontal.svg: a linha entra pela esquerda e as barras terminam
          coladas na borda direita da página. Alturas e passo (28px) são os do arquivo. */}
      <div className={styles.waveBars} aria-hidden>
        <i className={styles.waveLine} />
        {BAR_HEIGHTS.map((h, i) => <i key={i} style={{ height: `${h}px` }} />)}
      </div>
    </section>
  );
};

// ─── Módulos (slot "our top tier features") ──────────────────────────────────
const num = (i: number) => `${String(i + 1).padStart(2, '0')}.`;

const Modules: FC = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const total = MODULES.length;
  const prev = (active - 1 + total) % total;
  const next = (active + 1) % total;
  const current = MODULES[active];

  // O painel lateral é o atalho pro módulo vizinho: clicar traz ele pro meio.
  const Side: FC<{ index: number }> = ({ index }) => {
    const m = MODULES[index];
    return (
      <button className={styles.modSide} onClick={() => setActive(index)} aria-label={`Ver ${m.title}`}>
        <span className={styles.modSideNum}>{num(index)}</span>
        <span className={styles.modSideRule} aria-hidden />
        <span className={styles.modSideText}>
          <strong>{m.title}</strong>
          <em>{m.sub}</em>
        </span>
      </button>
    );
  };

  return (
    <section className={styles.modules} id='recursos'>
      <div className={styles.shell}>
        <div className={styles.sectionHead}>
          <h2 className={styles.hSection}>A carreira inteira, num lugar só</h2>
          <p className={styles.pBody}>
            Diagnóstico, planejamento, plano de ação, músicas, agenda e equipe: as frentes da sua
            carreira conectadas e evoluindo juntas, com a Nyta IA acompanhando cada passo.
          </p>
        </div>

        <span className={styles.modRule} aria-hidden />

        <div className={styles.modCarousel}>
          <Side index={prev} />

          {/* Cartão aberto: o número em cima e o texto na base, sem arte ao fundo. */}
          <article className={styles.modMain} key={active}>
            <span className={styles.modMainNum}>{num(active)}</span>
            <div className={styles.modMainBody}>
              <h3>{current.title}</h3>
              <em>{current.sub}</em>
              <p>{current.desc}</p>
              {current.to && (
                <button className={styles.modMainLink} onClick={() => navigate(current.to as string)}>
                  Saiba mais <FiArrowRight size={16} />
                </button>
              )}
            </div>
          </article>

          <Side index={next} />
        </div>

        {/* Os pontos dão acesso direto a qualquer módulo (com 6, os laterais só alcançam 2). */}
        <div className={styles.modDots}>
          {MODULES.map((m, i) => (
            <button
              key={m.title}
              className={i === active ? styles.modDotOn : undefined}
              onClick={() => setActive(i)}
              aria-label={m.title}
              aria-current={i === active}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Nyta (vitrine do chat com efeito de digitação) ──────────────────────────
const NytaSection: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const [pi, setPi] = useState(0);
  const [display, setDisplay] = useState('');

  const start = (text: string) => {
    const v = (text || '').trim();
    if (v) {
      try { sessionStorage.setItem('nyta_intro_prompt', v); } catch { /* noop */ }
    }
    navigate(loggedIn ? '/criar-artista' : '/signup');
  };

  // Efeito "digitando": digita e apaga as sugestões em loop. A caixa é SÓ vitrine — o clique
  // leva pro fluxo de início com a pergunta em foco.
  useEffect(() => {
    const phrase = SUGGESTIONS[pi % SUGGESTIONS.length];
    let i = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      if (!deleting) {
        i += 1;
        setDisplay(phrase.slice(0, i));
        if (i >= phrase.length) { timer = window.setTimeout(() => { deleting = true; tick(); }, 1800); return; }
        timer = window.setTimeout(tick, 42 + Math.random() * 45);
      } else {
        i -= 1;
        setDisplay(phrase.slice(0, Math.max(0, i)));
        if (i <= 0) { setPi((p) => p + 1); return; }
        timer = window.setTimeout(tick, 22);
      }
    };
    timer = window.setTimeout(tick, 500);
    return () => window.clearTimeout(timer);
  }, [pi]);

  const current = SUGGESTIONS[pi % SUGGESTIONS.length];

  return (
    <section className={styles.nyta} id='nyta'>
      <div className={styles.shell}>
        <div className={styles.nytaHead}>
          <h2 className={styles.hSection}>Converse com a Nyta</h2>
          <p className={styles.pLead}>Uma assistente de IA que conhece a sua carreira, do diagnóstico ao dia a dia.</p>
        </div>
        <div className={styles.promptWrap}>
          <div
            className={styles.promptBox}
            role='button'
            tabIndex={0}
            aria-label='Começar com a Nyta'
            onClick={() => start(current)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(current); } }}
          >
            <div className={styles.promptInput} aria-hidden>
              {display || ' '}<span className={styles.promptCaret} />
            </div>
            <div className={styles.promptBar}>
              <span className={styles.nytaPill}><NytaAvatar size={22} /> Nyta IA</span>
              <span className={styles.promptSubmit} aria-hidden><FiArrowUp size={20} /></span>
            </div>
          </div>
          <div className={styles.chips}>
            {SUGGESTIONS.map((s) => <button key={s} type='button' className={styles.chip} onClick={() => start(s)}>{s}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Depoimentos (slot "what are they saying") ───────────────────────────────
// Como na referência: cartões de 468×308 numa faixa que começa na margem do conteúdo e sangra
// pela direita (o próximo aparece cortado, mostrando que há mais). As setas rolam a faixa.
const Testimonials: FC = () => {
  const track = useRef<HTMLDivElement>(null);
  // 468 do cartão + 55 da folga: um clique = um cartão.
  const slide = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * 523, behavior: 'smooth' });

  return (
    <section className={styles.says}>
      <div className={styles.shell}>
        <div className={styles.sectionHead}>
          <h2 className={styles.hSection}>O que estão dizendo?</h2>
          <p className={styles.pBody}>Artistas, produtores e gravadoras já constroem carreira com método na Maestra.</p>
        </div>
        <div className={styles.sayArrows}>
          <button className={styles.sayArrow} onClick={() => slide(-1)} aria-label='Depoimento anterior'>
            <FiArrowLeft size={20} />
          </button>
          <button className={styles.sayArrow} onClick={() => slide(1)} aria-label='Próximo depoimento'>
            <FiArrowRight size={20} />
          </button>
        </div>
      </div>
      <div className={styles.sayTrack} ref={track}>
        {TESTIMONIALS.map((t) => (
          <article key={t.name} className={styles.sayCard}>
            <div className={styles.sayWho}>
              <span className={styles.sayAvatar} style={{ background: t.c }}>{t.i}</span>
              <div>
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </div>
            </div>
            <p>{t.quote}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

// ─── Planos ──────────────────────────────────────────────────────────────────
// Dois modelos de cobrança são coisas diferentes e a UI deixa isso explícito: o Planejamento é
// PAGAMENTO ÚNICO por perfil (vitalício); o PRO é ASSINATURA. O toggle Mensal/Anual vive DENTRO
// do card do PRO — só a assinatura tem essa escolha.
const Plans: FC = () => {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const { once, monthly, annual: annualPrice, discountPct } = usePlanPrices();
  return (
    <section className={styles.plans} id='planos'>
      <div className={styles.shell}>
        <div className={styles.sectionHead}>
          <h2 className={styles.hSection}>Preços transparentes, sem surpresas</h2>
          <p className={styles.pBody}>O diagnóstico é grátis. Você paga uma vez para desbloquear o planejamento de cada artista, e o Maestra PRO é uma assinatura opcional.</p>
        </div>

        <div className={styles.planGrid}>
          <article className={styles.planCard}>
            <span className={styles.planKind}>Grátis pra sempre</span>
            <h3>Diagnóstico REAL</h3>
            <p className={styles.planDesc}>Crie o perfil e receba o retrato completo da carreira.</p>
            <div className={styles.planPrice}><strong>R$ 0</strong></div>
            <ul>
              {FREE_ITEMS.map((f) => <li key={f}><FiCheck size={17} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.btnGhost} onClick={() => navigate('/signup')}>Criar conta grátis</button>
          </article>

          <article className={`${styles.planCard} ${styles.planCardHero}`}>
            <span className={styles.planBadge}>Desbloqueio do artista</span>
            <span className={styles.planKind}>Pagamento único · vitalício</span>
            <h3>Planejamento estratégico</h3>
            <p className={styles.planDesc}>Pague uma vez e o planejamento, o plano de ação e a gestão desse artista ficam seus pra sempre.</p>
            <div className={styles.planPrice}><strong>{fmt(once)}</strong><span>uma vez</span></div>
            <p className={styles.planNote}>por artista · sem mensalidade</p>
            <ul>
              {PLAN_ITEMS.map((f) => <li key={f}><FiCheck size={17} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.btnNeon} onClick={() => navigate('/signup')}>Fazer diagnóstico grátis</button>
            <p className={styles.planCancel}>Você só paga quando decidir desbloquear.</p>
          </article>

          <article className={`${styles.planCard} ${styles.planCardPro}`}>
            <span className={styles.planBadgePro}>PRO</span>
            <span className={styles.planKind}>Assinatura · opcional</span>
            <h3>Maestra PRO</h3>
            <p className={styles.planDesc}>A Nyta IA e as ferramentas pra gerenciar vários artistas.</p>
            <div className={styles.toggle}>
              <button className={annual ? '' : styles.toggleOn} onClick={() => setAnnual(false)}>Mensal</button>
              <button className={annual ? styles.toggleOn : ''} onClick={() => setAnnual(true)}>
                Anual <em>-{discountPct}%</em>
              </button>
            </div>
            <div className={styles.planPrice}><strong>{fmt(annual ? annualPrice : monthly)}</strong><span>{annual ? '/ano' : '/mês'}</span></div>
            <p className={styles.planNote}>{annual ? `equivale a ${fmt(annualPrice / 12)}/mês` : 'cobrança recorrente'}</p>
            <ul>
              {PRO_ITEMS.map((f) => <li key={f}><FiCheck size={17} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.btnGhost} onClick={() => navigate('/signup')}>Assinar o PRO</button>
            <p className={styles.planCancel}>Cancele quando quiser.</p>
          </article>
        </div>

        <p className={styles.plansFootnote}>
          <strong>Como se combinam:</strong> o <strong>diagnóstico</strong> é sempre grátis. O <strong>planejamento</strong> é um
          pagamento único por artista, vitalício, sem mensalidade. O <strong>Maestra PRO</strong> é uma assinatura opcional que
          adiciona a Nyta IA e o gerenciamento de vários perfis à sua conta.
        </p>
      </div>
    </section>
  );
};

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const Faq: FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  const { once, monthly, annual } = usePlanPrices();
  const faqItems = buildFaqItems(once, monthly, annual);
  return (
    <section className={styles.faq} id='faq'>
      <div className={styles.shell}>
        <div className={styles.faqHead}>
          <h2 className={styles.hSection}>Perguntas frequentes</h2>
        </div>
        <div className={styles.faqList}>
          {faqItems.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={styles.faqItem}>
                <button className={styles.faqBtn} onClick={() => setOpen(isOpen ? null : i)}>
                  <span>{item.q}</span>
                  <FiChevronDown size={20} className={`${styles.faqChevron} ${isOpen ? styles.faqChevronOpen : ''}`} />
                </button>
                {isOpen && <p className={styles.faqA}>{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Download + CTA final (slots "download section" e "subscribe us") ────────
// Os selos das lojas seguem as medidas do arquivo (216/243/200 × 72, raio 12, folga de 40).
// Os apps ainda não existem: em vez de links quebrados, o clique avisa que vem por aí e lembra
// que hoje dá pra instalar a Maestra pelo próprio navegador.
const STORES = [
  {
    name: 'App Store', kicker: 'Baixe na',
    icon: <path d='M16.4 12.7c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-1.9.8-1.1 1.1-2.2 1.1-2.2 0-.1-2.1-.8-2.1-3.2zM14.5 6.3c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z' fill='#000' />,
  },
  {
    name: 'Google Play', kicker: 'Disponível no',
    icon: (
      <>
        <path d='M3.6 2.3v19.4l10-9.7z' fill='#00A3EE' />
        <path d='M3.6 2.3l13 6.9-3 2.8z' fill='#7EB900' />
        <path d='M3.6 21.7l10-9.7 3 2.8z' fill='#F15021' />
        <path d='M16.6 9.2l3.8 2.8-3.8 2.8-3-2.8z' fill='#FFB800' />
      </>
    ),
  },
  {
    name: 'Microsoft', kicker: 'Baixe na',
    icon: (
      <>
        <rect x='3' y='3' width='8.4' height='8.4' fill='#F15021' />
        <rect x='12.6' y='3' width='8.4' height='8.4' fill='#7EB900' />
        <rect x='3' y='12.6' width='8.4' height='8.4' fill='#00A3EE' />
        <rect x='12.6' y='12.6' width='8.4' height='8.4' fill='#FFB800' />
      </>
    ),
  },
];

const Download: FC = () => {
  const [soon, setSoon] = useState<string | null>(null);
  const { visible: pwaVisible, ios: pwaIOS, install: installPwa } = usePwaInstall();

  return (
    <section className={styles.download}>
      <div className={styles.shell}>
        <h2 className={styles.hSection}>A Maestra no seu bolso</h2>
        <p className={styles.downloadLead}>
          Os aplicativos estão a caminho. Enquanto isso, a Maestra funciona no navegador e pode ser
          instalada como app no celular ou no computador.
        </p>
        <div className={styles.stores}>
          {STORES.map((st) => (
            <button key={st.name} className={styles.store} onClick={() => setSoon(st.name)}>
              <svg viewBox='0 0 24 24' aria-hidden focusable='false'>{st.icon}</svg>
              <span>
                {st.kicker}
                <strong>{st.name}</strong>
              </span>
            </button>
          ))}
        </div>
        {soon && (
          <p className={styles.storeSoon} role='status'>
            O app da Maestra na {soon} ainda está em desenvolvimento.
            {pwaVisible && !pwaIOS && (
              <> Você pode <button onClick={installPwa}>instalar agora pelo navegador</button>.</>
            )}
            {pwaIOS && ' No iPhone, use Compartilhar → Adicionar à Tela de Início.'}
          </p>
        )}
      </div>
    </section>
  );
};

const CtaBand: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  // O e-mail digitado aqui abre o cadastro já preenchido (o Signup lê essa chave uma vez).
  const start = () => {
    const v = email.trim();
    if (v) {
      try { sessionStorage.setItem('signup_email', v); } catch { /* noop */ }
    }
    navigate(loggedIn ? '/artists' : '/signup');
  };

  return (
    <section className={styles.ctaBand}>
      <div className={styles.shell}>
        <div className={styles.ctaCard}>
          <h2>Comece com o diagnóstico grátis</h2>
          <p>Leva poucos minutos pra ver onde sua carreira está, e dá o primeiro passo pra onde ela pode ir.</p>
          {loggedIn ? (
            <button className={styles.btnNeon} onClick={start}>
              Ir pro app <FiArrowRight size={18} />
            </button>
          ) : (
            <form className={styles.ctaForm} onSubmit={(e) => { e.preventDefault(); start(); }}>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='seu@email.com'
                aria-label='Seu e-mail'
              />
              <button className={styles.btnNeon} type='submit'>Começar grátis</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Landing ─────────────────────────────────────────────────────────────────
const Landing: FC = () => {
  const loggedIn = useAppSelector((s) => !!s.auth.user);
  const location = useLocation();
  const dispatch = useAppDispatch();

  // Preços dinâmicos (config compartilhada). RLS permite leitura anônima na landing pública.
  useEffect(() => {
    dispatch(fetchPlanConfig());
  }, [dispatch]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Maestra · sua carreira musical, com método';
    return () => { document.title = prev; };
  }, []);

  // Chegando de outra página (ex.: /diagnostico-real) com uma seção pedida: rola até ela.
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.state]);

  return (
    <div className={styles.page}>
      <Header loggedIn={loggedIn} />
      <Hero loggedIn={loggedIn} />
      <VideoStats />
      <Modules />
      <NytaSection loggedIn={loggedIn} />
      <Testimonials />
      <Plans />
      <Faq />
      <Download />
      <CtaBand loggedIn={loggedIn} />
      <Footer />
    </div>
  );
};

export default Landing;
