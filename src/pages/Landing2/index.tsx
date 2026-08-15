import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiArrowUpRight, FiCheck, FiPlay } from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import { NytaAvatar } from '../Wizard/chat/nytaPersona';
import { useAppSelector } from '../../store/store';
import { usePlanPrices } from '../../hooks/usePlanPrices';
import featureReal from '../../assets/feature-real.png';
import featurePlanning from '../../assets/feature-planning.png';
import featureAction from '../../assets/feature-action.png';
import featureGestao from '../../assets/feature-gestao.png';
import anitaPhoto from '../../assets/anita.jpg';
import styles from './Landing2.module.scss';

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA DE REFERÊNCIA — não é a landing oficial.
//
// Rota /index2. Existe pra olharmos juntos a ideia do layout de referência (o template escuro
// "Soundbox") aplicada ao conteúdo da Maestra, antes de mexer na landing de verdade.
//
// O que veio da referência: fundo azul-noite em degradê, tipografia display em caixa alta,
// cartões de vidro, pílulas, a faixa de números, a tabela de "top chart", os depoimentos em
// carrossel e o rodapé em colunas.
//
// O que NÃO veio: o verde-limão do template. No lugar dele entrou o verde do REAL, que já é uma
// cor da Maestra — o papel de "cor que acende" é o mesmo, sem inventar uma sexta cor.
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Recursos', id: 'recursos' },
  { label: 'Método', id: 'metodo' },
  { label: 'Planos', id: 'planos' },
];

const scrollTo = (id: string) => () => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Os módulos, no formato dos cartões de recurso da referência.
const MODULES = [
  {
    img: featureReal, accent: '46, 196, 122',
    title: 'Diagnóstico REAL',
    desc: 'Um raio-X da carreira em quatro dimensões, cruzando dados do Spotify e das redes com o que só o artista sabe.',
  },
  {
    img: featurePlanning, accent: '154, 79, 209',
    title: 'Planejamento estratégico',
    desc: 'O diagnóstico vira plano: visão, missão, objetivos e as estratégias certas pro momento da carreira.',
  },
  {
    img: featureAction, accent: '154, 79, 209',
    title: 'Plano de ação',
    desc: 'Cada estratégia quebrada em tarefas, com progresso, prazos e responsáveis. Do "o que fazer" pro "feito".',
  },
  {
    img: featureGestao, accent: '46, 196, 178',
    title: 'Gestão completa',
    desc: 'Músicas, agenda de shows e lançamentos e a equipe junto. A operação da carreira no mesmo lugar do plano.',
  },
];

const STEPS = [
  { n: '01', accent: '46, 196, 122', t: 'Diagnóstico REAL', d: 'Conecte seus dados e responda o que só você sabe. Em minutos, o retrato da carreira em 4 dimensões.' },
  { n: '02', accent: '154, 79, 209', t: 'Planejamento', d: 'O diagnóstico vira um plano: visão, missão, objetivos e estratégias já priorizadas.' },
  { n: '03', accent: '154, 79, 209', t: 'Plano de ação', d: 'As estratégias viram tarefas com progresso, prazos e responsáveis.' },
  { n: '04', accent: '124, 92, 255', t: 'Evolua e refaça', d: 'Execute, cresça e refaça o REAL pra ver sua fase subir. A Nyta acompanha o ciclo.' },
];

// A tabela do "Today's Top Chart" da referência vira a régua dos perfis: o que o REAL mede e
// como cada dimensão acende.
const DIMENSIONS = [
  { k: 'R', name: 'Reach', sub: 'Alcance', desc: 'Ouvintes, seguidores e consumo de vídeo', bits: '1000' },
  { k: 'E', name: 'Earnings', sub: 'Receita', desc: 'Shows, fontes musicais e estrutura', bits: '0100' },
  { k: 'A', name: 'Audience', sub: 'Público real', desc: 'Quem paga, aparece e segue', bits: '0010' },
  { k: 'L', name: 'Legitimacy', sub: 'Legitimação', desc: 'Prêmios, imprensa, playlists e rádio', bits: '0001' },
];

const PROFILES = [
  'Icon', 'Hit', 'Spotlight', 'Digital', 'Underpaid', 'Potential', 'Hype', 'Influencer',
  'Analog', 'Rising', 'Outlier', 'Moneymaker', 'Bet', 'Paradox', 'Cult', 'Beginner',
];

const TESTIMONIALS = [
  { quote: 'O planejamento com a Nyta virou meu mapa. Hoje sei exatamente qual é o próximo passo de cada artista que produzo.', name: 'AZMUTH', role: 'Produtor Musical · Rio de Janeiro', i: 'A', c: '#9A4FD1' },
  { quote: 'A gente vivia apagando incêndio. Com o plano de ação organizado, a operação anda toda na mesma direção.', name: 'A Banca Records', role: 'Gravadora · Rio de Janeiro', i: 'B', c: '#6d4aff' },
  { quote: 'O Diagnóstico REAL me mostrou com dados onde eu realmente estava. Parei de agir no achismo.', name: 'Madhá', role: 'Compositora · Minas Gerais', i: 'M', c: '#c1543f' },
];

// Sem ID, o container do vídeo mostra o espaço reservado (mesma regra da landing oficial).
const HERO_VIDEO_ID = '';

// ─── Chrome ──────────────────────────────────────────────────────────────────
const Header: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.headerInner}>
        <button className={styles.brand} onClick={() => navigate('/')} aria-label='Maestra'>
          <MaestraBrand variant='lockup' tone='light' className={styles.brandMark} />
        </button>
        <nav className={styles.nav}>
          {NAV.map((n) => (
            <button key={n.id} className={styles.navLink} onClick={scrollTo(n.id)}>{n.label}</button>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <button className={styles.navLink} onClick={() => navigate(loggedIn ? '/artists' : '/login')}>
            {loggedIn ? 'Meus perfis' : 'Entrar'}
          </button>
          <button className={styles.btnNeon} onClick={() => navigate(loggedIn ? '/criar-artista' : '/signup')}>
            Começar grátis
          </button>
        </div>
      </div>
    </header>
  );
};

// Linha de onda: o traço que atravessa o hero da referência, aqui em SVG (barras de altura
// variável, sem imagem).
const Waveform: FC<{ bars?: number }> = ({ bars = 64 }) => (
  <svg className={styles.wave} viewBox={`0 0 ${bars * 6} 48`} preserveAspectRatio='none' aria-hidden focusable='false'>
    {Array.from({ length: bars }).map((_, i) => {
      const h = 4 + Math.abs(Math.sin(i * 0.7)) * 34 + (i % 5) * 1.6;
      return <rect key={i} x={i * 6} y={(48 - h) / 2} width='2' height={h} rx='1' />;
    })}
  </svg>
);

const Hero: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const start = () => navigate(loggedIn ? '/criar-artista' : '/signup');

  return (
    <section className={styles.hero} id='top'>
      <div className={styles.heroGlow} aria-hidden />
      <div className={styles.heroInner}>
        <span className={styles.kicker}>Gestão de carreira musical</span>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroLine}>
            A música evoluiu
            <span className={styles.heroBadge} aria-hidden><FiPlay size={20} /></span>
          </span>
          <span className={styles.heroLineAlt}>a gestão também</span>
        </h1>
        <p className={styles.heroLead}>
          Do diagnóstico ao dia a dia: a Maestra conecta tudo o que a sua carreira precisa num lugar só, com método.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnNeon} onClick={start}>
            Fazer meu diagnóstico grátis <FiArrowRight size={18} />
          </button>
          <button className={styles.btnGhost} onClick={scrollTo('planos')}>Ver planos</button>
        </div>

        <Waveform />

        <div className={styles.videoWrap}>
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
                <span className={styles.videoPlay} aria-hidden><FiPlay size={26} /></span>
                <p>Espaço reservado pro vídeo de apresentação</p>
              </div>
            )}
          </div>

          {/* O cartão flutuante do player da referência vira o resultado do diagnóstico. */}
          <div className={styles.nowCard}>
            <span className={styles.nowIcon} aria-hidden><NytaAvatar size={26} /></span>
            <div className={styles.nowBody}>
              <strong>Perfil Rising</strong>
              <span>Índice REAL · alcance e público em alta</span>
            </div>
            <span className={styles.nowScore}>72</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const StatsBand: FC = () => (
  <section className={styles.band}>
    <div className={styles.bandInner}>
      <div className={styles.bandCopy}>
        <h2 className={styles.bandTitle}>Método de mercado, não achismo de internet</h2>
        <p className={styles.bandLead}>
          A metodologia nasce de 30 anos de gestão de carreiras e da análise de 313 planejamentos reais,
          sustentada por pesquisa de doutorado.
        </p>
      </div>
      <div className={styles.bandStats}>
        <div><strong>313+</strong><span>planejamentos reais</span></div>
        <div><strong>16</strong><span>perfis de carreira</span></div>
        <div><strong>30+</strong><span>anos de metodologia</span></div>
      </div>
    </div>
  </section>
);

const Modules: FC = () => (
  <section className={styles.section} id='recursos'>
    <div className={styles.sectionInner}>
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>Recursos</span>
          <h2 className={styles.sectionTitle}>A carreira inteira, num lugar só</h2>
        </div>
        <p className={styles.sectionLead}>
          Diagnóstico, planejamento, plano de ação, músicas, agenda e equipe: as frentes da sua carreira
          conectadas e evoluindo juntas, com a Nyta acompanhando cada passo.
        </p>
      </div>
      <div className={styles.moduleGrid}>
        {MODULES.map((m) => (
          <article key={m.title} className={styles.moduleCard} style={{ ['--accent' as string]: m.accent }}>
            <span className={styles.moduleIcon}><img src={m.img} alt='' /></span>
            <h3>{m.title}</h3>
            <p>{m.desc}</p>
          </article>
        ))}
        <article className={`${styles.moduleCard} ${styles.moduleCardNyta}`} style={{ ['--accent' as string]: '124, 92, 255' }}>
          <span className={styles.moduleIcon}><NytaAvatar size={64} /></span>
          <h3>Nyta IA</h3>
          <p>
            A assistente que acompanha a carreira em todos os módulos: tira dúvidas, sugere caminhos e ajuda a
            executar o plano, sempre no contexto dos seus dados.
          </p>
        </article>
      </div>
    </div>
  </section>
);

const Method: FC = () => (
  <section className={styles.section} id='metodo'>
    <div className={styles.sectionInner}>
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>Como funciona</span>
          <h2 className={styles.sectionTitle}>Do diagnóstico à evolução</h2>
        </div>
        <p className={styles.sectionLead}>
          Um ciclo, quatro passos. Cada um alimenta o próximo, e o REAL refeito mostra a carreira mudando de fase.
        </p>
      </div>
      <div className={styles.stepGrid}>
        {STEPS.map((s) => (
          <article key={s.n} className={styles.stepCard} style={{ ['--accent' as string]: s.accent }}>
            <span className={styles.stepNum}>{s.n}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

// A tabela do "top chart" da referência, com o conteúdo do índice.
const RealTable: FC = () => {
  const navigate = useNavigate();
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.tableHead}>
          <span className={styles.eyebrow}>Índice REAL</span>
          <h2 className={styles.sectionTitle}>O que o REAL mede</h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Dimensão</th>
                <th>O que entra na conta</th>
                <th>Letra</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d, i) => (
                <tr key={d.k}>
                  <td className={styles.tableIndex}>{String(i + 1).padStart(2, '0')}</td>
                  <td>
                    <div className={styles.tableName}>{d.name}</div>
                    <div className={styles.tableSub}>{d.sub}</div>
                  </td>
                  <td className={styles.tableDesc}>{d.desc}</td>
                  <td>
                    <span className={styles.bits}>
                      {['R', 'E', 'A', 'L'].map((letter, bi) => (
                        <span key={letter} className={d.bits[bi] === '1' ? styles.bitOn : styles.bitOff}>{letter}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.profileStrip}>
          {PROFILES.map((p) => <span key={p} className={styles.profileChip}>{p}</span>)}
        </div>
        <button className={styles.linkNeon} onClick={() => navigate('/diagnostico-real')}>
          Entenda o Índice REAL <FiArrowUpRight size={16} />
        </button>
      </div>
    </section>
  );
};

const Founder: FC = () => (
  <section className={styles.founder}>
    <div className={styles.founderInner}>
      <div className={styles.founderPhoto}><img src={anitaPhoto} alt='Anita Carvalho' /></div>
      <div className={styles.founderBody}>
        <span className={styles.eyebrow}>Quem assina o método</span>
        <h2 className={styles.sectionTitle}>Anita Carvalho</h2>
        <p>
          Gestora de carreira com 30 anos de mercado, doutoranda e pesquisadora do empresariamento artístico,
          fundadora da Music Rio Academy. A metodologia que ela ensina na escola é a que orienta o planejamento
          estratégico aqui dentro.
        </p>
        <div className={styles.founderTags}>
          <span>313 planejamentos analisados</span>
          <span>5.000+ alunos formados</span>
          <span>Vivo Rio · Rio de Janeiro</span>
        </div>
      </div>
    </div>
  </section>
);

const Testimonials: FC = () => (
  <section className={styles.section}>
    <div className={styles.sectionInner}>
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>Quem usa</span>
          <h2 className={styles.sectionTitle}>Carreira construída com método</h2>
        </div>
      </div>
      <div className={styles.tRow}>
        {TESTIMONIALS.map((t) => (
          <article key={t.name} className={styles.tCard}>
            <p>{t.quote}</p>
            <div className={styles.tWho}>
              <span className={styles.tAvatar} style={{ background: t.c }}>{t.i}</span>
              <div>
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const Plans: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const { onceFmt, monthlyFmt, annualFmt, discountPct } = usePlanPrices();
  const go = () => navigate(loggedIn ? '/criar-artista' : '/signup');

  return (
    <section className={styles.section} id='planos'>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>Planos</span>
            <h2 className={styles.sectionTitle}>Comece grátis, avance quando fizer sentido</h2>
          </div>
          <p className={styles.sectionLead}>
            O diagnóstico é gratuito e sem cartão. O desbloqueio do perfil é pagamento único; o PRO é assinatura.
          </p>
        </div>
        <div className={styles.planGrid}>
          <article className={styles.planCard}>
            <span className={styles.planKind}>Grátis</span>
            <h3>Diagnóstico</h3>
            <div className={styles.planPrice}><strong>R$ 0</strong></div>
            <ul>
              <li><FiCheck size={16} /> Índice REAL completo</li>
              <li><FiCheck size={16} /> Seu perfil entre os 16</li>
              <li><FiCheck size={16} /> Sem cartão pra começar</li>
            </ul>
            <button className={styles.btnGhost} onClick={go}>Começar grátis</button>
          </article>

          <article className={`${styles.planCard} ${styles.planCardHero}`}>
            <span className={styles.planBadge}>Mais escolhido</span>
            <span className={styles.planKind}>Pagamento único</span>
            <h3>Perfil completo</h3>
            <div className={styles.planPrice}><strong>{onceFmt}</strong><span>por perfil</span></div>
            <ul>
              <li><FiCheck size={16} /> Planejamento estratégico completo</li>
              <li><FiCheck size={16} /> Plano de ação com tarefas</li>
              <li><FiCheck size={16} /> Catálogo, agenda e equipe</li>
            </ul>
            <button className={styles.btnNeon} onClick={go}>Desbloquear perfil</button>
          </article>

          <article className={`${styles.planCard} ${styles.planCardPro}`}>
            <span className={styles.planKind}>Assinatura</span>
            <h3>Maestra PRO</h3>
            <div className={styles.planPrice}><strong>{monthlyFmt}</strong><span>por mês</span></div>
            <p className={styles.planNote}>{annualFmt} no plano anual · economia de {discountPct}%</p>
            <ul>
              <li><FiCheck size={16} /> Perfis ilimitados</li>
              <li><FiCheck size={16} /> Nyta até 100 interações por dia em cada perfil</li>
              <li><FiCheck size={16} /> Novos módulos incluídos</li>
            </ul>
            <button className={styles.btnGhost} onClick={go}>Assinar o PRO</button>
          </article>
        </div>
      </div>
    </section>
  );
};

const CtaBand: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  return (
    <section className={styles.ctaBand}>
      <div className={styles.ctaCard}>
        <h2>Comece com o diagnóstico grátis</h2>
        <p>Leva poucos minutos pra ver onde sua carreira está, e dá o primeiro passo pra onde ela pode ir.</p>
        <button className={styles.btnNeon} onClick={() => navigate(loggedIn ? '/artists' : '/signup')}>
          {loggedIn ? 'Ir pro app' : 'Fazer meu diagnóstico grátis'} <FiArrowRight size={18} />
        </button>
      </div>
    </section>
  );
};

const Footer: FC = () => {
  const navigate = useNavigate();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <MaestraBrand variant='lockup' tone='light' className={styles.brandMark} />
          <p>A plataforma que diagnostica, planeja e acompanha a sua carreira na música.</p>
        </div>
        <div className={styles.footerCols}>
          <div>
            <span>Produto</span>
            <button onClick={scrollTo('recursos')}>Recursos</button>
            <button onClick={() => navigate('/diagnostico-real')}>Diagnóstico REAL</button>
            <button onClick={() => navigate('/music-rio-academy')}>Music Rio Academy</button>
            <button onClick={scrollTo('planos')}>Planos</button>
          </div>
          <div>
            <span>Conta</span>
            <button onClick={() => navigate('/login')}>Entrar</button>
            <button onClick={() => navigate('/signup')}>Criar conta</button>
          </div>
          <div>
            <span>Legal</span>
            <button onClick={() => navigate('/termos')}>Termos de uso</button>
            <button onClick={() => navigate('/privacidade')}>Política de privacidade</button>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} Maestra. Todos os direitos reservados.</span>
        <span className={styles.footerRef}>Página de referência · /index2</span>
      </div>
    </footer>
  );
};

const Landing2: FC = () => {
  const loggedIn = useAppSelector((s) => !!s.auth.user);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Maestra · referência de landing';
    window.scrollTo(0, 0);
    return () => { document.title = prev; };
  }, []);

  return (
    <div className={styles.page}>
      <Header loggedIn={loggedIn} />
      <Hero loggedIn={loggedIn} />
      <StatsBand />
      <Modules />
      <Method />
      <RealTable />
      <Founder />
      <Testimonials />
      <Plans loggedIn={loggedIn} />
      <CtaBand loggedIn={loggedIn} />
      <Footer />
    </div>
  );
};

export default Landing2;
