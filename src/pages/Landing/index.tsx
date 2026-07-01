import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight, FiArrowUp, FiCheck, FiChevronDown, FiActivity, FiTarget, FiMessageCircle, FiGrid,
  FiInstagram, FiZap, FiStar,
} from 'react-icons/fi';

import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';
import { useAppSelector } from '../../store/store';
import { PRODUCT_THEME } from '../../components/productTheme';
import styles from './Landing.module.scss';

// Cores extras (produtos que não fazem parte do ciclo REAL→Planejamento→Plano).
const NYTA_ACCENT = '124, 92, 255';   // violeta
const GESTAO_ACCENT = '46, 196, 178'; // teal

// Preços (estáticos na landing). Se mudarem, atualize aqui.
const MONTHLY = 39.9;
const ANNUAL = 335.16;
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const discount = Math.round((1 - ANNUAL / (MONTHLY * 12)) * 100);

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
    glyph: <FiActivity size={88} />,
    to: '/diagnostico-real', toLabel: 'Entenda o Índice REAL',
  },
  {
    badge: 'Planejamento estratégico', reverse: true,
    accent: PRODUCT_THEME.planning.accent, bg: PRODUCT_THEME.planning.bg,
    title: 'Do diagnóstico à estratégia certa',
    desc: 'A metodologia da Anita Carvalho, destilada de mais de 30 anos de carreira e 313 planejamentos reais, transforma seu diagnóstico em um planejamento completo — com as estratégias certas pro seu momento.',
    items: ['Visão, missão e objetivos da carreira', 'Estratégias priorizadas pelo seu momento', 'Análise SWOT e mapa de referências'],
    glyph: <FiTarget size={88} />,
  },
  {
    badge: 'Plano de ação',
    accent: PRODUCT_THEME.action.accent, bg: PRODUCT_THEME.action.bg,
    title: 'Execute o plano, tarefa por tarefa',
    desc: 'O planejamento vira um plano executável: cada estratégia quebrada em tarefas, com progresso, prazos e responsáveis. Você sai do "o que fazer" pro "feito".',
    items: ['Estratégias viram tarefas acompanháveis', 'Progresso, prazos e responsáveis', 'Cronograma e modelagem financeira'],
    glyph: <FiZap size={88} />,
  },
  {
    badge: 'Nyta IA', reverse: true,
    accent: NYTA_ACCENT,
    title: 'Uma consultora de IA ao seu lado',
    desc: 'A Nyta IA acompanha sua carreira em todos os módulos: tira dúvidas, sugere caminhos e ajuda a executar o plano, sempre no contexto dos seus dados.',
    items: ['Chat de IA ilimitado', 'Recomendações sob o contexto da sua carreira', 'Presente no diagnóstico, no plano e na gestão'],
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

const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: 'O que é o diagnóstico REAL?', a: 'É uma análise da sua carreira em 4 dimensões (alcance, receita, audiência e legitimação), combinando dados reais do Spotify e das suas redes com o que você nos conta. O resultado é um dos 16 perfis de carreira e um retrato claro de onde você está.' },
  { q: 'Preciso pagar para ver o diagnóstico?', a: 'Não. O diagnóstico é grátis. O Maestra PRO é que libera o plano de ação completo, a Nyta IA e a gestão (catálogo, agenda e equipe).' },
  { q: 'O que está incluído no Maestra PRO?', a: 'Edição em todos os perfis que você acessa, Nyta IA ilimitada, catálogo de faixas ilimitado e acesso a todos os perfis da conta. (A gestão das tarefas do seu plano de ação é livre, no plano gratuito.)' },
  { q: 'Quanto custa?', a: 'R$ 39,90 por mês, ou R$ 335,16 no plano anual (cerca de 30% de desconto). Cancele quando quiser.' },
  { q: 'Como faço o pagamento?', a: 'Cartão de crédito (com renovação automática) ou PIX. Tudo processado com segurança via Asaas.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. Você cancela a qualquer momento pela sua conta, sem burocracia.' },
];

const FREE_ITEMS = ['Veja o diagnóstico e o plano de ação', 'Gerencie as tarefas do seu plano de ação', 'Visualize catálogo, agenda e equipe'];
const PRO_ITEMS = ['Edição em todos os perfis que você acessa', 'Nyta IA com chat ilimitado', 'Catálogo de faixas ilimitado', 'Acesso a todos os perfis da conta'];

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
          <MaestraLogo className={styles.brandLogo} /> <span className={styles.brandText}>Maestra Manager</span>
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

// ─── Plans ───────────────────────────────────────────────────────────────────
const Plans: FC = () => {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  return (
    <section className={styles.plans} id="planos">
      <div className={styles.plansInner}>
        <div className={styles.plansHead}>
          <span className={styles.introKicker}>Planos</span>
          <h2 className={styles.plansTitle}>Comece grátis, evolua quando quiser</h2>
          <div className={styles.toggle}>
            <button className={`${styles.toggleBtn} ${!annual ? styles.toggleBtnOn : ''}`} onClick={() => setAnnual(false)}>Mensal</button>
            <button className={`${styles.toggleBtn} ${annual ? styles.toggleBtnOn : ''}`} onClick={() => setAnnual(true)}>
              Anual <span className={styles.toggleSave}>-{discount}%</span>
            </button>
          </div>
        </div>
        <div className={styles.planGrid}>
          <div className={styles.planCard}>
            <h3 className={styles.planName}>Grátis</h3>
            <p className={styles.planDesc}>O essencial para acompanhar o plano e a carreira.</p>
            <div className={styles.planPriceFree}>R$ 0</div>
            <ul className={styles.planList}>
              {FREE_ITEMS.map((f) => <li key={f} className={`${styles.planItem} ${styles.planItemFree}`}><FiCheck size={18} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.planCtaOutline} onClick={() => navigate('/signup')}>Criar conta grátis</button>
          </div>
          <div className={`${styles.planCard} ${styles.planCardPro}`}>
            <span className={styles.planBadge}>PRO</span>
            <h3 className={`${styles.planName} ${styles.planNamePro}`}>Maestra PRO</h3>
            <p className={styles.planDesc}>Ferramentas para executar o plano e crescer mais rápido.</p>
            <div className={styles.planPrice}><strong>{fmt(annual ? ANNUAL : MONTHLY)}</strong><span className={styles.planUnit}>{annual ? '/ano' : '/mês'}</span></div>
            <p className={styles.planNote}>{annual ? `equivale a ${fmt(ANNUAL / 12)}/mês` : ''}</p>
            <ul className={styles.planList}>
              {PRO_ITEMS.map((f) => <li key={f} className={`${styles.planItem} ${styles.planItemPro}`}><FiCheck size={18} /> <span>{f}</span></li>)}
            </ul>
            <button className={styles.planCtaPrimary} onClick={() => navigate('/signup')}>Começar grátis</button>
            <p className={styles.planCancel}>Cancele quando quiser.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const Faq: FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className={styles.faq} id="faq">
      <div className={styles.faqInner}>
        <div className={styles.faqHead}>
          <span className={styles.introKicker}>Dúvidas</span>
          <h2 className={styles.faqTitle}>Perguntas frequentes</h2>
        </div>
        <div className={styles.faqList}>
          {FAQ_ITEMS.map((item, i) => {
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
              <MaestraLogo className={styles.brandLogo} /> <span className={styles.brandText}>Maestra Manager</span>
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
          <span className={styles.introKicker}>O que você ganha</span>
          <h2 className={styles.introTitle}>Do diagnóstico à execução</h2>
          <p className={styles.introSub}>Tudo o que sua carreira precisa pra sair do achismo e entrar no método.</p>
        </div>
      </div>
      {FEATURES.map((f) => <Feature key={f.badge} data={f} />)}
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
