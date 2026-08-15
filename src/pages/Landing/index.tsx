import { FC, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight, FiArrowUp, FiCheck, FiChevronDown,
  FiDownload, FiInstagram, FiPlay, FiShare,
} from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import { NytaAvatar } from '../Wizard/chat/nytaPersona';
import { usePwaInstall } from '../../components/PwaInstallBanner';
import anitaPhoto from '../../assets/anita.jpg';
import heroFigure from '../../assets/landing-hero-figure.png';
import featureReal from '../../assets/feature-real.png';
import featurePlanning from '../../assets/feature-planning.png';
import featureAction from '../../assets/feature-action.png';
import featureGestao from '../../assets/feature-gestao.png';
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

const NAV = [
  { label: 'Recursos', id: 'recursos' },
  { label: 'Nyta IA', id: 'nyta' },
  { label: 'Planos', id: 'planos' },
  { label: 'FAQ', id: 'faq' },
];

const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// ─── Dados ───────────────────────────────────────────────────────────────────
const MODULES = [
  { img: featureReal, title: 'Diagnóstico REAL', desc: 'Um raio-X da carreira em 4 dimensões, cruzando dados do Spotify e das redes com o que só você sabe. Descubra qual dos 16 perfis é o seu.' },
  { img: featurePlanning, title: 'Planejamento estratégico', desc: 'A metodologia de 30 anos da Anita Carvalho transforma o diagnóstico em visão, missão, objetivos e estratégias já priorizadas.' },
  { img: featureAction, title: 'Plano de ação', desc: 'Cada estratégia vira tarefas com progresso, prazos e responsáveis. Do "o que fazer" pro "feito".' },
  { img: featureGestao, title: 'Gestão completa', desc: 'Músicas, agenda de shows e lançamentos e a equipe junto: a operação da carreira no mesmo lugar do plano.' },
] as const;

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

// Sem ID, o container do vídeo mostra o espaço reservado (troque pelo ID do YouTube — o trecho
// depois de `v=` na URL).
const HERO_VIDEO_ID = '';

// ─── Cabeçalho ───────────────────────────────────────────────────────────────
const Header: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <div className={styles.shell}>
        <a
          className={styles.brand}
          href='#top'
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <MaestraBrand variant='lockup' tone='light' className={styles.brandMark} />
        </a>
        <nav className={styles.navLinks}>
          {NAV.map((n) => <button key={n.id} onClick={scrollTo(n.id)}>{n.label}</button>)}
        </nav>
        <div className={styles.navActions}>
          {loggedIn ? (
            <button className={styles.btnNeon} onClick={() => navigate('/artists')}>Ir pro app</button>
          ) : (
            <>
              <button className={styles.navEntrar} onClick={() => navigate('/login')}>Entrar</button>
              <button className={styles.btnNeon} onClick={() => navigate('/signup')}>Começar grátis</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

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
        <div className={styles.heroLine1}>
          <h1 className={styles.hDisplay}>A música evoluiu</h1>
          <span className={styles.heroBadge} aria-hidden><FiPlay size={30} /></span>
        </div>
        <div className={styles.heroLine2}>
          <h1 className={`${styles.hDisplay} ${styles.hDisplayNeon}`}>a gestão também</h1>
          <span className={styles.heroTagline}>com método</span>
        </div>
        <p className={styles.heroLead}>
          Do diagnóstico ao dia a dia: a Maestra conecta tudo o que a sua carreira precisa num lugar só.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnNeon} onClick={start}>
            Fazer meu diagnóstico grátis <FiArrowRight size={18} />
          </button>
          <button className={styles.btnGhost} onClick={scrollTo('planos')}>Ver planos</button>
        </div>
      </div>

      <div className={`${styles.shell} ${styles.heroStage}`}>
        {/* Onda que atravessa o palco, atrás da figura (traço da referência) */}
        <svg className={styles.heroWave} viewBox='0 0 1440 150' preserveAspectRatio='none' aria-hidden focusable='false'>
          <path d='M0 75 H250 l24 -58 22 108 20 -128 26 150 24 -92 26 60 22 -34 24 42 H700 l26 -66 22 96 24 -120 26 140 22 -84 26 52 24 -28 22 34 H1440' />
        </svg>

        {/* Selo "Diagnóstico grátis" */}
        <button className={styles.seal} onClick={start} aria-label='Fazer o diagnóstico grátis'>
          <svg className={styles.sealStar} viewBox='0 0 100 100' aria-hidden focusable='false'><path d={SEAL_POINTS} /></svg>
          <svg className={styles.sealCaption} viewBox='0 0 160 160' aria-hidden focusable='false'>
            <defs><path id='landing-seal-arc' d='M22 80a58 58 0 0 1 116 0' /></defs>
            <text><textPath href='#landing-seal-arc' startOffset='6%'>Diagnóstico grátis</textPath></text>
          </svg>
          <span className={styles.sealCore}><FiPlay size={20} /></span>
        </button>

        {/* Figura central: blob neon + recorte. A foto é o placeholder herdado da referência —
            trocar por um recorte de artista da Maestra (mesmo enquadramento, PNG sem fundo). */}
        <div className={styles.heroFigure}>
          <span className={styles.heroBlob} aria-hidden />
          <span className={styles.heroDotPink} aria-hidden />
          <img src={heroFigure} alt='' />
        </div>

        {/* O cartão "tocando agora" da referência vira o resultado do diagnóstico. */}
        <div className={styles.nowCard}>
          <span className={styles.nowEq} aria-hidden><i /><i /><i /></span>
          <span className={styles.nowIcon}><NytaAvatar size={44} /></span>
          <span className={styles.nowMeta}>
            <strong>Perfil Rising</strong>
            <span>Índice REAL · alcance e público em alta</span>
          </span>
          <span className={styles.nowScore}>72</span>
        </div>
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
    <section className={styles.video} ref={ref}>
      <div className={`${styles.shell} ${styles.videoGrid}`}>
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
        <div>
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
      <div className={styles.waveBars} aria-hidden>
        {BAR_HEIGHTS.map((h, i) => <i key={i} style={{ height: `${Math.round(h * 0.75)}px` }} />)}
      </div>
    </section>
  );
};

// ─── Módulos (slot "our top tier features") ──────────────────────────────────
const Modules: FC = () => (
  <section className={styles.modules} id='recursos'>
    <div className={styles.shell}>
      <div className={styles.sectionHead}>
        <h2 className={styles.hSection}>A carreira inteira, num lugar só</h2>
        <p className={styles.pBody}>
          Diagnóstico, planejamento, plano de ação, músicas, agenda e equipe: as frentes da sua
          carreira conectadas e evoluindo juntas, com a Nyta IA acompanhando cada passo.
        </p>
      </div>
      <div className={styles.moduleGrid}>
        {MODULES.map((m) => (
          <article key={m.title} className={styles.moduleCard}>
            <span className={styles.moduleIcon}><img src={m.img} alt='' /></span>
            <h3 className={styles.hCard}>{m.title}</h3>
            <p className={styles.pBody}>{m.desc}</p>
          </article>
        ))}
        <article className={styles.moduleCard}>
          <span className={styles.moduleIcon}><NytaAvatar size={44} /></span>
          <h3 className={styles.hCard}>Nyta IA</h3>
          <p className={styles.pBody}>A assistente que tira dúvidas, sugere caminhos e ajuda a executar o plano, sempre no contexto dos seus dados.</p>
        </article>
        <article className={`${styles.moduleCard} ${styles.moduleCardSoon}`}>
          <span className={styles.moduleSoonTag}>Em breve</span>
          <h3 className={styles.hCard}>E ela só cresce</h3>
          <p className={styles.pBody}>Novos módulos a caminho: marketing, CRM e financeiro, no mesmo lugar do resto da carreira.</p>
        </article>
      </div>
    </div>
  </section>
);

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
const Testimonials: FC = () => (
  <section className={styles.says}>
    <div className={styles.shell}>
      <div className={styles.sectionHead}>
        <h2 className={styles.hSection}>O que estão dizendo?</h2>
        <p className={styles.pBody}>Artistas, produtores e gravadoras já constroem carreira com método na Maestra.</p>
      </div>
      <div className={styles.sayGrid}>
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
    </div>
  </section>
);

// ─── Fundadora ───────────────────────────────────────────────────────────────
const ANITA_STORY = [
  'Tenho mais de 30 anos no mercado da música, e durante todos eles ouvi a mesma pergunta, vinda de artistas dos mais diferentes tamanhos: "qual o caminho pra chegar onde eu quero?". Por muito tempo, tudo que eu tinha pra oferecer eram alguns conselhos genéricos. Isso me incomodava, porque eu sou filha de um compositor que nunca alcançou o reconhecimento que merecia, e que, na época, eu não soube como ajudar. Sem o que sei hoje, vi de perto o que acontece quando o talento existe mas falta um caminho. Essa ausência virou o motor da minha vida profissional.',
  'No mestrado, transformei essa inquietação em método: um processo de planejamento estratégico que apliquei, ao longo dos últimos anos, em mais de 300 consultorias individuais. Ali eu tive a confirmação do que suspeitava: o artista não precisa só de incentivo; precisa de um norte e de um mapa para chegar até ele. O método funcionava. O problema era de alcance: consultoria individual é cara, e por mais que eu desse aulas gratuitas e distribuísse a planilha do método de graça, muitos artistas ainda travavam na hora de aplicar sozinhos. Foi aí que veio o estalo: e se a inteligência artificial pudesse traduzir a minha metodologia, e a minha forma de pensar e a minha experiência profissional, numa ferramenta acessível a qualquer artista, em qualquer lugar do mundo? A Maestra nasceu dessa motivação, sustentada por uma hipótese que carrego como bandeira: talento não basta; é preciso gestão.',
  'A Maestra pega tudo que aprendi em mais de 300 consultorias e transforma num roteiro guiado, que conduz o artista do seu mapa de referências até um plano de ação concreto, passo a passo, do jeito que eu faria pessoalmente. É uma metodologia proprietária, testada e aprovada, que nenhuma outra plataforma oferece. E há ainda o REAL, o diagnóstico que mostra ao artista, com objetividade, onde sua carreira está hoje: ele nasceu diretamente da minha pesquisa de doutorado, e é o que permite que cada plano comece não de um achismo, mas de um retrato honesto da realidade. Construí a Maestra para o artista em qualquer estágio que queira evoluir, mas, acima de tudo, para quem está começando, sem estrutura profissional por trás nem dinheiro para montar uma equipe. Para quem o meu pai foi, um dia.',
  'Nada disso seria possível sozinha. Construí a Maestra em parceria com Azmuth, produtor musical de diversos nomes da música urbana, fundador da Banca Records e empreendedor digital. Conheci o Azmuth quando ele me convidou para ser embaixadora de outra de suas iniciativas, e desde então nutro profunda admiração pelo seu olhar inovador. Quando tive a ideia da Maestra, ele foi minha escolha natural: é quem traduz a minha inteligência em sistema, e quem trouxe à ferramenta uma contribuição que só quem vive os dois mundos, a música e a tecnologia, poderia trazer. Juntos, transformamos um método que cabia numa sala de consultoria em algo que agora cabe na palma da mão de qualquer artista.',
];

const Founder: FC = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={styles.founder} id='fundadora'>
      <div className={`${styles.shell} ${styles.founderGrid}`}>
        <aside className={styles.founderAside}>
          <div className={styles.founderPhoto}><img src={anitaPhoto} alt='Anita Carvalho' /></div>
          <div className={styles.founderName}>Anita Carvalho</div>
          <div className={styles.founderRole}>Criadora do Índice REAL · Fundadora da Maestra</div>
          <a className={styles.founderSocial} href='https://www.instagram.com/anitacarvalho_/' target='_blank' rel='noreferrer' aria-label='Instagram da Anita Carvalho'>
            <FiInstagram size={18} />
          </a>
        </aside>
        <div>
          <h2 className={styles.hSection}>A história por trás da Maestra</h2>
          <div className={`${styles.founderText} ${expanded ? '' : styles.founderTextClamp}`}>
            {ANITA_STORY.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <button className={styles.founderMore} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Ler menos' : 'Ler a história completa'}
            <FiChevronDown size={16} className={expanded ? styles.founderMoreOpen : undefined} />
          </button>
        </div>
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

// ─── CTA final (slot "subscribe us") ─────────────────────────────────────────
const CtaBand: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  return (
    <section className={styles.ctaBand}>
      <div className={styles.shell}>
        <div className={styles.ctaCard}>
          <h2>Comece com o diagnóstico grátis</h2>
          <p>Leva poucos minutos pra ver onde sua carreira está, e dá o primeiro passo pra onde ela pode ir.</p>
          <button className={styles.btnNeon} onClick={() => navigate(loggedIn ? '/artists' : '/signup')}>
            {loggedIn ? 'Ir pro app' : 'Começar grátis'} <FiArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};

// ─── Rodapé ──────────────────────────────────────────────────────────────────
const Footer: FC = () => {
  const navigate = useNavigate();
  const { visible: pwaVisible, ios: pwaIOS, install: installPwa, dismiss: dismissPwa } = usePwaInstall();
  return (
    <footer className={styles.footer}>
      <div className={`${styles.shell} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <MaestraBrand variant='lockup' tone='light' className={styles.brandMark} />
          <p>A plataforma que diagnostica, planeja e acompanha a sua carreira na música.</p>
          {pwaVisible && (
            <div className={styles.footerPwa}>
              <span className={styles.footerPwaIcon}>{pwaIOS ? <FiShare size={16} /> : <FiDownload size={16} />}</span>
              <span className={styles.footerPwaCopy}>
                <strong>Instale a Maestra</strong>
                <span>{pwaIOS ? 'Compartilhar → Adicionar à Tela de Início' : 'Acesso rápido pelo celular ou computador'}</span>
              </span>
              {!pwaIOS && <button className={styles.footerPwaAction} onClick={installPwa}>Instalar</button>}
              <button className={styles.footerPwaClose} onClick={dismissPwa} aria-label='Fechar aviso de instalação'>×</button>
            </div>
          )}
        </div>
        <div className={styles.footerCol}>
          <h4>Produto</h4>
          <button onClick={scrollTo('recursos')}>Recursos</button>
          <button onClick={() => navigate('/diagnostico-real')}>Diagnóstico REAL</button>
          <button onClick={() => navigate('/music-rio-academy')}>Music Rio Academy</button>
          <button onClick={scrollTo('planos')}>Planos</button>
          <button onClick={scrollTo('faq')}>FAQ</button>
        </div>
        <div className={styles.footerCol}>
          <h4>Conta</h4>
          <button onClick={() => navigate('/login')}>Entrar</button>
          <button onClick={() => navigate('/signup')}>Criar conta</button>
        </div>
        <div className={styles.footerCol}>
          <h4>Legal</h4>
          <button onClick={() => navigate('/legal/termos')}>Termos de uso</button>
          <button onClick={() => navigate('/legal/privacidade')}>Política de privacidade</button>
        </div>
        <div className={styles.footerCol}>
          <h4>Social</h4>
          <a href='https://www.instagram.com/maestra.manager/' target='_blank' rel='noreferrer' aria-label='Instagram' className={styles.footerSocial}><FiInstagram size={18} /></a>
        </div>
      </div>
      <div className={`${styles.shell} ${styles.footerBottom}`}>
        <span>
          Maestra <em>by</em>{' '}
          <button onClick={() => { window.scrollTo(0, 0); navigate('/music-rio-academy'); }}>Music Rio Academy</button>
        </span>
        <span>© {new Date().getFullYear()} MUSIC RIO ACADEMY LTDA · CNPJ 22.826.985/0001-41. Todos os direitos reservados.</span>
      </div>
    </footer>
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
      <Founder />
      <Plans />
      <Faq />
      <CtaBand loggedIn={loggedIn} />
      <Footer />
    </div>
  );
};

export default Landing;
