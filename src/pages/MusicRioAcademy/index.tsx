import { FC, useEffect } from 'react';
import { FiArrowUpRight } from 'react-icons/fi';

import { Header, Footer } from '../Landing/LightChrome';
import { useAppSelector } from '../../store/store';
import styles from './MusicRioAcademy.module.scss';

const MRA_URL = 'https://musicrioacademy.com.br';

const STATS = [
  { num: '5.000+', label: 'alunos formados' },
  { num: '140+', label: 'edições realizadas' },
  { num: '100+', label: 'professores e instrutores' },
  { num: '250h', label: 'de aulas e webinars por ano' },
];

const CARDS = [
  {
    title: 'O que a escola oferece',
    body: 'Cursos de curta e média duração em music business, marketing digital, finanças no showbiz, direitos autorais, branding, distribuição digital e planejamento de carreira. Webinars, experiências imersivas presenciais e mentoria individual com Anita Carvalho.',
  },
  {
    title: 'Para quem é',
    body: 'Artistas independentes que precisam gerir a própria carreira. Jovens que querem trabalhar com música e não sabem por onde começar. Profissionais que já atuam e querem se especializar. Quem quer atuar no mercado criativo sem formação acadêmica formal.',
  },
];

const MusicRioAcademy: FC = () => {
  const loggedIn = useAppSelector((s) => !!s.auth.user);

  // Ao abrir a página (vinda da landing/rodapé), começa do topo.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className={styles.page}>
      <Header loggedIn={loggedIn} />

      <main className={styles.main}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>A escola por trás da Maestra</p>
          <h1 className={styles.title}>
            Formação que nasce <span>dentro do mercado</span>
          </h1>
          <p className={styles.subtitle}>
            A Music Rio Academy é uma escola de formação prática em música, marketing e mercado
            criativo, fundada em 2019 e sediada no Vivo Rio, no Rio de Janeiro. São sete anos formando
            artistas e profissionais que precisavam aprender fazendo, dentro da indústria que ensinam.
            É dela que veio a metodologia que hoje move a Maestra.
          </p>
        </header>

        <div className={styles.statsRow}>
          {STATS.map((s) => (
            <div key={s.label} className={styles.statCell}>
              <p className={styles.statNum}>{s.num}</p>
              <p className={styles.statLabel}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className={styles.cards}>
          {CARDS.map((c) => (
            <div key={c.title} className={styles.card}>
              <p className={styles.cardTitle}>{c.title}</p>
              <p className={styles.cardBody}>{c.body}</p>
            </div>
          ))}
        </div>

        <div className={styles.footerBand}>
          <p className={styles.footerText}>
            Fundada por <strong>Anita Carvalho</strong>, gestora de carreira com 30 anos de mercado,
            doutoranda e pesquisadora do empresariamento artístico. A mesma metodologia que ela ensina
            na escola é a que orienta o planejamento estratégico aqui na Maestra.
          </p>
          <a className={styles.cta} href={MRA_URL} target='_blank' rel='noreferrer'>
            Conheça a escola <FiArrowUpRight size={16} />
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MusicRioAcademy;
