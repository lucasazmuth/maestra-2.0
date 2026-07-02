import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight, FiArrowUp, FiCheck, FiChevronDown, FiMessageCircle, FiGrid,
  FiInstagram, FiZap, FiStar,
} from 'react-icons/fi';

import { Wordmark } from '../../components/Wordmark';
import anitaPhoto from '../../assets/anita.png';
import { DiagnosticoIcon, PlanejamentoIcon, PlanoAcaoIcon } from '../../components/Icons/system';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { fetchPlanConfig } from '../../store/slices/subscription';
import { PRODUCT_THEME } from '../../components/productTheme';
import styles from './Landing.module.scss';

// Cores extras (produtos que não fazem parte do ciclo REAL→Planejamento→Plano).
const NYTA_ACCENT = '124, 92, 255';   // violeta
const GESTAO_ACCENT = '46, 196, 178'; // teal

// Preços dinâmicos (via asaas_plan_config; RLS permite leitura anônima). Estes são
// só FALLBACKS enquanto a config carrega (ou se a leitura falhar).
// PLAN_ONCE = desbloqueio do planejamento POR PERFIL (cobrança única, vitalícia).
// MONTHLY/ANNUAL = assinatura Maestra PRO (nível conta). São eixos independentes.
const FALLBACK_ONCE = 199.9;
const FALLBACK_MONTHLY = 39.9;
const FALLBACK_ANNUAL = 335.16;
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Preços da config (com fallback) — compartilhado entre os cards de planos e o FAQ.
const usePlanPrices = () => {
  const plan = useAppSelector((s) => s.subscription.plan);
  const once = plan?.profileUnlockValue ?? FALLBACK_ONCE;
  const monthly = plan?.monthlyValue ?? FALLBACK_MONTHLY;
  const annual = plan?.annualValue ?? FALLBACK_ANNUAL;
  const discountPct = monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
  return { once, monthly, annual, discountPct };
};

const NAV = [
  { label: 'Recursos', id: 'recursos' },
  { label: 'Planos', id: 'planos' },
  { label: 'FAQ', id: 'faq' },
];

const FEATURES: { badge: string; title: string; desc: string; items: string[]; glyph: ReactNode; accent: string; bg?: string; reverse?: boolean; to?: string; toLabel?: string }[] = [
  {
    badge: 'Diagnóstico REAL',
    accent: PRODUCT_THEME.real.accent, bg: PRODUCT_THEME.real.bg,
    title: 'Saiba exatamente onde sua carreira está',
    desc: 'Um raio-X da sua carreira em quatro dimensões (alcance, receita, audiência e legitimação), combinando dados reais do Spotify e das suas redes com o que só você sabe.',
    items: ['Índice REAL calculado a partir de dados reais, não achismo', 'Descubra qual dos 16 perfis de carreira é o seu', 'Onde seus ouvintes estão, playlists e referências'],
    glyph: <DiagnosticoIcon size={88} />,
    to: '/diagnostico-real', toLabel: 'Entenda o Índice REAL',
  },
  {
    badge: 'Planejamento estratégico', reverse: true,
    accent: PRODUCT_THEME.planning.accent, bg: PRODUCT_THEME.planning.bg,
    title: 'Do diagnóstico à estratégia certa',
    desc: 'A metodologia da Anita Carvalho, destilada de mais de 30 anos de carreira e 313 planejamentos reais, transforma seu diagnóstico em um planejamento completo — com as estratégias certas pro seu momento.',
    items: ['Visão, missão e objetivos da carreira', 'Estratégias priorizadas pelo seu momento', 'Análise SWOT e mapa de referências'],
    glyph: <PlanejamentoIcon size={88} />,
  },
  {
    badge: 'Plano de ação',
    accent: PRODUCT_THEME.action.accent, bg: PRODUCT_THEME.action.bg,
    title: 'Execute o plano, tarefa por tarefa',
    desc: 'O planejamento vira um plano executável: cada estratégia quebrada em tarefas, com progresso, prazos e responsáveis. Você sai do "o que fazer" pro "feito".',
    items: ['Estratégias viram tarefas acompanháveis', 'Progresso, prazos e responsáveis', 'Cronograma e modelagem financeira'],
    glyph: <PlanoAcaoIcon size={88} />,
  },
  {
    badge: 'Nyta IA', reverse: true,
    accent: NYTA_ACCENT,
    title: 'Uma consultora de IA ao seu lado',
    desc: 'A Nyta IA acompanha sua carreira em todos os módulos: tira dúvidas, sugere caminhos e ajuda a executar o plano, sempre no contexto dos seus dados.',
    items: ['Chat com a Nyta no contexto da sua carreira', 'Recomendações sob os seus dados reais', 'Do planejamento à gestão do dia a dia'],
    glyph: <FiMessageCircle size={88} />,
  },
  {
    badge: 'Gestão completa',
    accent: GESTAO_ACCENT,
    title: 'Catálogo, agenda e equipe num lugar só',
    desc: 'Centralize a operação da sua carreira: organize suas faixas, acompanhe shows e lançamentos e traga sua equipe pra dentro.',
    items: ['Catálogo de faixas ilimitado', 'Agenda de shows e lançamentos', 'Acesso a todos os perfis da conta'],
    glyph: <FiGrid size={88} />,
  },
];

// FAQ com os preços interpolados (dinâmicos). `once/monthly/annual` vêm da config.
const buildFaqItems = (once: number, monthly: number, annual: number): { q: string; a: string }[] => {
  const discountPct = monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
  return [
    { q: 'O que é a Maestra Manager?', a: 'A Maestra Manager é uma plataforma de gestão de carreira musical. Num só lugar, ela reúne o diagnóstico da sua carreira (o Índice REAL), o planejamento estratégico, o plano de ação para executar e a gestão do dia a dia (catálogo, agenda e equipe), tudo com o apoio da Nyta, a consultora de IA. A ideia é simples: tirar a carreira do achismo e colocar no método, com dados e estratégia.' },
    { q: 'O que é o diagnóstico REAL?', a: 'É uma análise da sua carreira em 4 dimensões (alcance, receita, audiência e legitimação), combinando dados reais do Spotify e das suas redes com o que você nos conta. O resultado é um dos 16 perfis de carreira e um retrato claro de onde você está.' },
    { q: 'Preciso pagar para ver o diagnóstico?', a: 'Não, o diagnóstico REAL é sempre grátis. Para desbloquear o planejamento estratégico e a gestão de um artista é que existe um pagamento único por perfil, com acesso vitalício.' },
    { q: 'Como funciona a cobrança?', a: `São dois modelos independentes. O diagnóstico é grátis. O planejamento de cada artista é um pagamento único de ${fmt(once)} (acesso vitalício ao perfil, sem mensalidade). E o Maestra PRO é uma assinatura opcional de ${fmt(monthly)} por mês, que adiciona a Nyta IA e o gerenciamento de vários perfis à sua conta.` },
    { q: 'O que está incluído no Maestra PRO?', a: 'A Nyta IA (até 100 interações por dia), edição em todos os perfis que você acessa, catálogo de faixas ilimitado e acesso a todos os perfis da conta. É uma assinatura, à parte do desbloqueio de cada perfil.' },
    { q: 'Quanto custa?', a: `O diagnóstico é grátis. O planejamento é um pagamento único de ${fmt(once)} por artista (vitalício). O Maestra PRO, opcional, custa ${fmt(monthly)} por mês ou ${fmt(annual)} no plano anual (cerca de ${discountPct}% de desconto). Cancele quando quiser.` },
    { q: 'Como faço o pagamento?', a: 'Cartão de crédito (com renovação automática) ou PIX. Tudo processado com segurança via Asaas.' },
    { q: 'Posso cancelar quando quiser?', a: 'Sim. Você cancela a qualquer momento pela sua conta, sem burocracia.' },
  ];
};

const FREE_ITEMS = ['Diagnóstico REAL completo nas 4 dimensões', 'Descubra qual dos 16 perfis é o seu', 'Sem cartão de crédito pra começar'];
const PLAN_ITEMS = ['Planejamento estratégico completo com a Nyta', 'Plano de ação com metas e cronograma', 'Análise de audiência: ouvintes e cidades', 'Catálogo, agenda e equipe', 'Acesso vitalício ao perfil e ao plano'];
const PRO_ITEMS = ['Nyta IA (consultora, até 100 interações por dia)', 'Edição em todos os perfis que você acessa', 'Catálogo de faixas ilimitado', 'Acesso a todos os perfis da conta'];

const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// Navegação por seção que também funciona fora da landing (ex.: /diagnostico-real):
// se a seção existe na página atual, rola até ela; senão volta pra landing pedindo o scroll.
const useSectionNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (id: string) => () => {
    if (location.pathname === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/', { state: { scrollTo: id } });
  };
};

// Clique na marca: topo da landing (rola se já estiver nela, senão navega pra home).
const useGoHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/');
  };
};

// ─── Header ──────────────────────────────────────────────────────────────────
export const Header: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const goToSection = useSectionNav();
  const goHome = useGoHome();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.headerInner}>
        <a className={styles.brand} href="#top" onClick={goHome}>
          <Wordmark className={styles.brandText} />
        </a>
        <nav className={styles.nav}>
          {NAV.map((n) => <button key={n.id} className={styles.navLink} onClick={goToSection(n.id)}>{n.label}</button>)}
        </nav>
        <div className={styles.actions}>
          {loggedIn ? (
            <button className={`${styles.btnPrimary} ${styles.headerCta}`} onClick={() => navigate('/artists')}>Ir pro app</button>
          ) : (
            <>
              <button className={`${styles.btnLink} ${styles.entrar}`} onClick={() => navigate('/login')}>Entrar</button>
              <button className={`${styles.btnPrimary} ${styles.headerCta}`} onClick={() => navigate('/signup')}>Começar grátis</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

// Avatares de prova social (iniciais + cor, sem fotos falsas).
const AVATARS = [
  { i: 'L', c: '#af2896' }, { i: 'M', c: '#6d4aff' }, { i: 'A', c: '#2d7d6f' },
  { i: 'R', c: '#c1543f' }, { i: 'J', c: '#3f6fc1' },
];
const SUGGESTIONS = [
  'Como aumentar meus ouvintes no Spotify?',
  'Qual o próximo passo da minha carreira?',
  'Como montar meu plano de lançamento?',
  'Por onde eu começo a crescer?',
];

// ─── Hero (caixa de prompt da Nyta IA) ───────────────────────────────────────
const Hero: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');

  // O prompt é a porta de entrada pra IA: guarda a pergunta e leva pro fluxo de início.
  const start = (text: string) => {
    const v = text.trim();
    if (v) {
      try { sessionStorage.setItem('nyta_intro_prompt', v); } catch { /* noop */ }
    }
    navigate(loggedIn ? '/criar-artista' : '/signup');
  };

  return (
    <section className={styles.hero} id="top">
      <div className={styles.heroInner}>
        <div className={styles.avatars}>
          <div className={styles.avatarRow}>
            {AVATARS.map((a, i) => <span key={i} className={styles.avatar} style={{ background: a.c }}>{a.i}</span>)}
          </div>
          <p className={styles.avatarsText}>Centenas de artistas já constroem a carreira com método na Maestra</p>
        </div>

        <span className={styles.kicker}>Gestão de carreira musical</span>
        <h1 className={styles.heroTitle}>A música evoluiu. A gestão também.</h1>
        <p className={styles.heroSub}>
          A plataforma nº 1 para artistas e equipes que querem crescer com inteligência.
        </p>

        <div className={styles.promptWrap}>
          <form onSubmit={(e) => { e.preventDefault(); start(prompt); }}>
            <div className={styles.promptBox}>
              <textarea
                className={styles.promptInput}
                placeholder="Pergunte à Nyta sobre sua carreira… ex: como aumentar meus ouvintes?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); start(prompt); } }}
                rows={2}
              />
              <div className={styles.promptBar}>
                <span className={styles.nytaPill}><FiZap size={14} /> Nyta IA</span>
                <button type="submit" className={styles.promptSubmit} aria-label="Começar com a Nyta"><FiArrowUp size={20} /></button>
              </div>
            </div>
          </form>
          <div className={styles.chips}>
            {SUGGESTIONS.map((s) => <button key={s} type="button" className={styles.chip} onClick={() => start(s)}>{s}</button>)}
          </div>
        </div>

        <div className={styles.heroSecondary} style={{ color: '#6b7280' }}>
          <button className={styles.heroSecondaryLink} onClick={scrollTo('planos')}>Ver planos</button>
          {' · Diagnóstico grátis, sem cartão pra começar'}
        </div>
      </div>
    </section>
  );
};

// ─── Stats (count-up ao entrar na tela) ──────────────────────────────────────
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

const Stats: FC = () => {
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
    <section className={styles.stats} ref={ref}>
      <div className={styles.statsInner}>
        <p className={styles.statsLead}>A metodologia por trás da <span>Maestra</span></p>
        <div className={styles.statsGroup}>
          <div><div className={styles.statNum}>{planos}+</div><div className={styles.statLabel}>planejamentos reais</div></div>
          <div><div className={styles.statNum}>{perfis}</div><div className={styles.statLabel}>perfis de carreira</div></div>
          <div><div className={styles.statNum}>{anos}+</div><div className={styles.statLabel}>anos de metodologia</div></div>
        </div>
      </div>
    </section>
  );
};

// ─── Como funciona (4 passos) ────────────────────────────────────────────────
const STEPS = [
  { n: '01', t: 'Diagnóstico REAL', accent: PRODUCT_THEME.real.accent, d: 'Conecte seus dados e responda o que só você sabe. Em minutos, o retrato da sua carreira em 4 dimensões.' },
  { n: '02', t: 'Planejamento estratégico', accent: PRODUCT_THEME.planning.accent, d: 'O diagnóstico vira um plano: visão, missão, objetivos e as estratégias certas pro seu momento — priorizadas.' },
  { n: '03', t: 'Plano de ação', accent: PRODUCT_THEME.action.accent, d: 'As estratégias viram tarefas com progresso, prazos e responsáveis. Do "o que fazer" pro "feito".' },
  { n: '04', t: 'Evolua e refaça', accent: NYTA_ACCENT, d: 'Execute, cresça e refaça o REAL pra ver sua fase subir. A Nyta IA acompanha cada passo do ciclo.' },
];

const HowItWorks: FC = () => (
  <section className={styles.how}>
    <div className={styles.howInner}>
      <div className={styles.howHead}>
        <span className={styles.introKicker}>Como funciona</span>
        <h2 className={styles.howTitle}>Do diagnóstico ao palco, com método</h2>
      </div>
      <div className={styles.howGrid}>
        {STEPS.map((s, i) => (
          <div key={s.n} className={styles.howStep} style={{ ['--accent' as string]: s.accent } as React.CSSProperties}>
            {i < STEPS.length - 1 && <span className={styles.howLine} />}
            <div className={styles.howNum}>{s.n}</div>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Carrossel de artistas / depoimentos ─────────────────────────────────────
// PLACEHOLDER: substitua por cases reais (nome, papel, foto e frase do artista).
const TESTIMONIALS = [
  { quote: 'Depoimento do artista vai aqui. Conte em uma frase o que mudou na carreira com a Maestra.', name: 'Nome do artista', role: 'Cantora · São Paulo', i: 'A', c: '#af2896' },
  { quote: 'Depoimento do artista vai aqui. Conte em uma frase o que mudou na carreira com a Maestra.', name: 'Nome do artista', role: 'Produtor · Recife', i: 'B', c: '#6d4aff' },
  { quote: 'Depoimento do artista vai aqui. Conte em uma frase o que mudou na carreira com a Maestra.', name: 'Nome do artista', role: 'Banda · Porto Alegre', i: 'C', c: '#2d7d6f' },
  { quote: 'Depoimento do artista vai aqui. Conte em uma frase o que mudou na carreira com a Maestra.', name: 'Nome do artista', role: 'Compositora · Salvador', i: 'D', c: '#c1543f' },
];

const Testimonials: FC = () => (
  <section className={styles.tcar}>
    <div className={styles.tcarHead}>
      <span className={styles.introKicker}>Quem usa</span>
      <h2 className={styles.tcarTitle}>Artistas construindo carreira com método</h2>
    </div>
    <div className={styles.tcarTrack}>
      {TESTIMONIALS.map((t, i) => (
        <div key={i} className={styles.tcard}>
          <div className={styles.tcardStars}>{[0, 1, 2, 3, 4].map((s) => <FiStar key={s} size={14} fill="currentColor" />)}</div>
          <p className={styles.tcardQuote}>{t.quote}</p>
          <div className={styles.tcardWho}>
            <span className={styles.avatar} style={{ background: t.c, marginLeft: 0 }}>{t.i}</span>
            <div>
              <div className={styles.tcardName}>{t.name}</div>
              <div className={styles.tcardRole}>{t.role}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <p className={styles.tcarNote}>Espaço reservado para depoimentos reais. Envie nomes, fotos e frases pra publicarmos aqui.</p>
  </section>
);

// ─── Feature ─────────────────────────────────────────────────────────────────
const Feature: FC<{ data: typeof FEATURES[number] }> = ({ data }) => {
  const navigate = useNavigate();
  return (
    <section className={`${styles.feature} ${data.reverse ? styles.reverse : ''}`} style={{ ['--accent' as string]: data.accent } as React.CSSProperties}>
      <div className={styles.featureGrid}>
        <div
          className={styles.featureVisual}
          style={data.bg ? { backgroundImage: `linear-gradient(158deg, rgba(11,11,13,0.5) 0%, rgba(11,11,13,0.88) 100%), url(${data.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <span className={styles.featureGlyph}>{data.glyph}</span>
        </div>
        <div className={styles.featureBody}>
          <span className={styles.featureBadge}>{data.badge}</span>
          <h2 className={styles.featureTitle}>{data.title}</h2>
          <p className={styles.featureDesc}>{data.desc}</p>
          <ul className={styles.featureList}>
            {data.items.map((it) => <li key={it} className={styles.featureItem}><FiCheck size={20} /> <span>{it}</span></li>)}
          </ul>
          {data.to && (
            <button className={styles.featureLink} onClick={() => navigate(data.to as string)}>
              {data.toLabel ?? 'Saiba mais'} <FiArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Fundadora (história da Anita) ───────────────────────────────────────────
// Carta da fundadora, sem travessões (a pedido). A foto entra em `anitaPhoto` quando o arquivo existir.
const ANITA_STORY = [
  'Tenho mais de 30 anos no mercado da música, e durante todos eles ouvi a mesma pergunta, vinda de artistas dos mais diferentes tamanhos: "qual o caminho pra chegar onde eu quero?". Por muito tempo, tudo que eu tinha pra oferecer eram alguns conselhos genéricos. Isso me incomodava, porque eu sou filha de um compositor que nunca alcançou o reconhecimento que merecia, e que, na época, eu não soube como ajudar. Sem o que sei hoje, vi de perto o que acontece quando o talento existe mas falta um caminho. Essa ausência virou o motor da minha vida profissional.',
  'No mestrado, transformei essa inquietação em método: um processo de planejamento estratégico que apliquei, ao longo dos últimos anos, em mais de 300 consultorias individuais. Ali eu tive a confirmação do que suspeitava: o artista não precisa só de incentivo; precisa de um norte e de um mapa para chegar até ele. O método funcionava. O problema era de alcance: consultoria individual é cara, e por mais que eu desse aulas gratuitas e distribuísse a planilha do método de graça, muitos artistas ainda travavam na hora de aplicar sozinhos. Foi aí que veio o estalo: e se a inteligência artificial pudesse traduzir a minha metodologia, e a minha forma de pensar e a minha experiência profissional, numa ferramenta acessível a qualquer artista, em qualquer lugar do mundo? A Maestra Manager nasceu dessa motivação, sustentada por uma hipótese que carrego como bandeira: talento não basta; é preciso gestão.',
  'A Maestra pega tudo que aprendi em mais de 300 consultorias e transforma num roteiro guiado, que conduz o artista do seu mapa de referências até um plano de ação concreto, passo a passo, do jeito que eu faria pessoalmente. É uma metodologia proprietária, testada e aprovada, que nenhuma outra plataforma oferece. E há ainda o REAL, o diagnóstico que mostra ao artista, com objetividade, onde sua carreira está hoje: ele nasceu diretamente da minha pesquisa de doutorado, e é o que permite que cada plano comece não de um achismo, mas de um retrato honesto da realidade. Construí a Maestra para o artista em qualquer estágio que queira evoluir, mas, acima de tudo, para quem está começando, sem estrutura profissional por trás nem dinheiro para montar uma equipe. Para quem o meu pai foi, um dia.',
  'Nada disso seria possível sozinha. Construí a Maestra em parceria com Lucas Azmuth, produtor musical de diversos nomes da música urbana, fundador da Banca Records e empreendedor digital. Conheci o Lucas quando ele me convidou para ser embaixadora de outra de suas iniciativas, e desde então nutro profunda admiração pelo seu olhar inovador. Quando tive a ideia da Maestra, ele foi minha escolha natural: é quem traduz a minha inteligência em sistema, e quem trouxe à ferramenta uma contribuição que só quem vive os dois mundos, a música e a tecnologia, poderia trazer. Juntos, transformamos um método que cabia numa sala de consultoria em algo que agora cabe na palma da mão de qualquer artista.',
];

const Founder: FC = () => (
  <section className={styles.founder} id="fundadora">
    <div className={styles.founderInner}>
      <div className={styles.founderHead}>
        <span className={styles.introKicker}>Quem está por trás</span>
        <h2 className={styles.founderTitle}>A história por trás da Maestra</h2>
      </div>
      <div className={styles.founderGrid}>
        <aside className={styles.founderAside}>
          <div className={styles.founderPhoto}><img src={anitaPhoto} alt="Anita Carvalho" /></div>
          <div className={styles.founderName}>Anita Carvalho</div>
          <div className={styles.founderRole}>Criadora do Índice REAL · Fundadora da Maestra Manager</div>
        </aside>
        <div className={styles.founderStory}>
          {ANITA_STORY.map((p, i) => <p key={i} className={styles.founderPara}>{p}</p>)}
        </div>
      </div>
    </div>
  </section>
);

// ─── Plans ───────────────────────────────────────────────────────────────────
// Dois modelos de cobrança são coisas diferentes e a UI deixa isso explícito (pra ninguém se
// sentir enganado): o Planejamento é PAGAMENTO ÚNICO por perfil (vitalício); o PRO é ASSINATURA.
// O toggle Mensal/Anual vive DENTRO do card do PRO — só a assinatura tem essa escolha.
const Plans: FC = () => {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const { once, monthly, annual: annualPrice, discountPct } = usePlanPrices();
  return (
    <section className={styles.plans} id="planos">
      <div className={styles.plansInner}>
        <div className={styles.plansHead}>
          <span className={styles.introKicker}>Planos</span>
          <h2 className={styles.plansTitle}>Preços transparentes, sem surpresas</h2>
          <p className={styles.plansSub}>O diagnóstico é grátis. Você paga uma vez para desbloquear o planejamento de cada artista, e o Maestra PRO é uma assinatura opcional.</p>
        </div>

        <div className={styles.planGrid}>
          {/* Grátis — o diagnóstico */}
          <div className={styles.planCard}>
            <span className={`${styles.planKind} ${styles.planKindFree}`}>Grátis pra sempre</span>
            <h3 className={styles.planName}>Diagnóstico REAL</h3>
            <p className={styles.planDesc}>Crie o perfil e receba o retrato completo da carreira.</p>
            <div className={styles.planPriceFree}>R$ 0</div>
            <ul className={styles.planList}>
              {FREE_ITEMS.map((f) => <li key={f} className={`${styles.planItem} ${styles.planItemFree}`}><FiCheck size={18} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.planCtaOutline} onClick={() => navigate('/signup')}>Criar conta grátis</button>
          </div>

          {/* Planejamento — pagamento único por perfil (o principal desbloqueio) */}
          <div className={`${styles.planCard} ${styles.planCardHero}`}>
            <span className={styles.planBadge}>Desbloqueio do artista</span>
            <span className={`${styles.planKind} ${styles.planKindOnce}`} style={{ marginTop: 4 }}>Pagamento único · vitalício</span>
            <h3 className={styles.planName}>Planejamento estratégico</h3>
            <p className={styles.planDesc}>Pague uma vez e o planejamento, o plano de ação e a gestão desse artista ficam seus pra sempre.</p>
            <div className={styles.planPrice}><strong>{fmt(once)}</strong><span className={styles.planUnit}>uma vez</span></div>
            <p className={styles.planNote}>por artista · sem mensalidade</p>
            <ul className={styles.planList}>
              {PLAN_ITEMS.map((f) => <li key={f} className={`${styles.planItem} ${styles.planItemPro}`}><FiCheck size={18} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.planCtaPrimary} onClick={() => navigate('/signup')}>Fazer diagnóstico grátis</button>
            <p className={styles.planCancel}>Você só paga quando decidir desbloquear.</p>
          </div>

          {/* Maestra PRO — assinatura (opcional), com o toggle mensal/anual próprio */}
          <div className={`${styles.planCard} ${styles.planCardPro}`}>
            <span className={styles.planBadgePro}>PRO</span>
            <span className={`${styles.planKind} ${styles.planKindSub}`}>Assinatura · opcional</span>
            <h3 className={`${styles.planName} ${styles.planNamePro}`}>Maestra PRO</h3>
            <p className={styles.planDesc}>A Nyta IA e as ferramentas pra gerenciar vários artistas.</p>
            <div className={styles.toggle}>
              <button className={`${styles.toggleBtn} ${!annual ? styles.toggleBtnOn : ''}`} onClick={() => setAnnual(false)}>Mensal</button>
              <button className={`${styles.toggleBtn} ${annual ? styles.toggleBtnOn : ''}`} onClick={() => setAnnual(true)}>
                Anual <span className={styles.toggleSave}>-{discountPct}%</span>
              </button>
            </div>
            <div className={styles.planPrice}><strong>{fmt(annual ? annualPrice : monthly)}</strong><span className={styles.planUnit}>{annual ? '/ano' : '/mês'}</span></div>
            <p className={styles.planNote}>{annual ? `equivale a ${fmt(annualPrice / 12)}/mês` : 'cobrança recorrente'}</p>
            <ul className={styles.planList}>
              {PRO_ITEMS.map((f) => <li key={f} className={`${styles.planItem} ${styles.planItemPro}`}><FiCheck size={18} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.planCtaPrimary} onClick={() => navigate('/signup')}>Assinar o PRO</button>
            <p className={styles.planCancel}>Cancele quando quiser.</p>
          </div>
        </div>

        <p className={styles.plansFootnote}>
          <strong>Como se combinam:</strong> o <strong>diagnóstico</strong> é sempre grátis. O <strong>planejamento</strong> é um pagamento único por artista, vitalício, sem mensalidade. O <strong>Maestra PRO</strong> é uma assinatura opcional que adiciona a Nyta IA e o gerenciamento de vários perfis à sua conta.
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
    <section className={styles.faq} id="faq">
      <div className={styles.faqInner}>
        <div className={styles.faqHead}>
          <span className={styles.introKicker}>Dúvidas</span>
          <h2 className={styles.faqTitle}>Perguntas frequentes</h2>
        </div>
        <div className={styles.faqList}>
          {faqItems.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={styles.faqItem}>
                <button className={styles.faqBtn} onClick={() => setOpen(isOpen ? null : i)}>
                  <span className={styles.faqQ}>{item.q}</span>
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

// ─── Footer ──────────────────────────────────────────────────────────────────
export const Footer: FC = () => {
  const navigate = useNavigate();
  const goToSection = useSectionNav();
  const goHome = useGoHome();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <a className={styles.brand} href="#top" onClick={goHome}>
              <Wordmark className={styles.brandText} />
            </a>
            <p className={styles.footerTag}>A plataforma que diagnostica, planeja e acompanha a sua carreira na música.</p>
          </div>
          <div className={styles.footerCols}>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Produto</span>
              <button className={styles.footerLink} onClick={goToSection('recursos')}>Recursos</button>
              <button className={styles.footerLink} onClick={() => navigate('/diagnostico-real')}>Diagnóstico REAL</button>
              <button className={styles.footerLink} onClick={goToSection('planos')}>Planos</button>
              <button className={styles.footerLink} onClick={goToSection('faq')}>FAQ</button>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Conta</span>
              <button className={styles.footerLink} onClick={() => navigate('/login')}>Entrar</button>
              <button className={styles.footerLink} onClick={() => navigate('/signup')}>Criar conta</button>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Legal</span>
              <button className={styles.footerLink} onClick={() => navigate('/legal/termos')}>Termos de uso</button>
              <button className={styles.footerLink} onClick={() => navigate('/legal/privacidade')}>Política de privacidade</button>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Social</span>
              <a href="https://www.instagram.com/maestramanager/" target="_blank" rel="noreferrer" aria-label="Instagram" className={styles.footerSocial}><FiInstagram size={18} /></a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>© {new Date().getFullYear()} Maestra Manager. Todos os direitos reservados.</div>
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
    document.title = 'Maestra Manager · sua carreira musical, com método';
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
      <Stats />
      <HowItWorks />
      <div className={styles.introWrap} id="recursos">
        <div className={styles.introInner}>
          <span className={styles.introKicker}>Recursos</span>
          <h2 className={styles.introTitle}>Do diagnóstico à execução</h2>
          <p className={styles.introSub}>Tudo o que sua carreira precisa pra sair do achismo e entrar no método.</p>
        </div>
      </div>
      {FEATURES.map((f) => <Feature key={f.badge} data={f} />)}
      <Founder />
      <Testimonials />
      <Plans />
      <Faq />
      <section className={styles.ctaBand}>
        <div className={styles.ctaBandInner}>
          <h2 className={styles.ctaBandTitle}>Comece com o diagnóstico grátis</h2>
          <p className={styles.ctaBandSub}>Leva poucos minutos pra ver onde sua carreira está, e o primeiro passo pra onde ela pode ir.</p>
          <HeroCtaButton loggedIn={loggedIn} />
        </div>
      </section>
      <Footer />
    </div>
  );
};

const HeroCtaButton: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  return (
    <button className={`${styles.btnPrimary} ${styles.ctaBandBtn}`} onClick={() => navigate(loggedIn ? '/artists' : '/signup')}>
      {loggedIn ? 'Ir pro app' : 'Começar grátis'} <FiArrowRight size={18} />
    </button>
  );
};

export default Landing;
