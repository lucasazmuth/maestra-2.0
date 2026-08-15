import { FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiInstagram } from 'react-icons/fi';

import { Header, Footer } from '../Landing/NoirChrome';
import { useAppSelector } from '../../store/store';
import anitaPhoto from '../../assets/anita.jpg';
import styles from './Sobre.module.scss';

// Página "Sobre": a história da Anita, que antes era uma seção da landing.
//
// Lá o texto vinha recolhido, com um "ler mais" — numa página dedicada ele aparece inteiro, que
// é o motivo de existir a página. O chrome escuro vem do NoirChrome, o mesmo da landing.

const ANITA_STORY = [
  'Tenho mais de 30 anos no mercado da música, e durante todos eles ouvi a mesma pergunta, vinda de artistas dos mais diferentes tamanhos: "qual o caminho pra chegar onde eu quero?". Por muito tempo, tudo que eu tinha pra oferecer eram alguns conselhos genéricos. Isso me incomodava, porque eu sou filha de um compositor que nunca alcançou o reconhecimento que merecia, e que, na época, eu não soube como ajudar. Sem o que sei hoje, vi de perto o que acontece quando o talento existe mas falta um caminho. Essa ausência virou o motor da minha vida profissional.',
  'No mestrado, transformei essa inquietação em método: um processo de planejamento estratégico que apliquei, ao longo dos últimos anos, em mais de 300 consultorias individuais. Ali eu tive a confirmação do que suspeitava: o artista não precisa só de incentivo; precisa de um norte e de um mapa para chegar até ele. O método funcionava. O problema era de alcance: consultoria individual é cara, e por mais que eu desse aulas gratuitas e distribuísse a planilha do método de graça, muitos artistas ainda travavam na hora de aplicar sozinhos. Foi aí que veio o estalo: e se a inteligência artificial pudesse traduzir a minha metodologia, e a minha forma de pensar e a minha experiência profissional, numa ferramenta acessível a qualquer artista, em qualquer lugar do mundo? A Maestra nasceu dessa motivação, sustentada por uma hipótese que carrego como bandeira: talento não basta; é preciso gestão.',
  'A Maestra pega tudo que aprendi em mais de 300 consultorias e transforma num roteiro guiado, que conduz o artista do seu mapa de referências até um plano de ação concreto, passo a passo, do jeito que eu faria pessoalmente. É uma metodologia proprietária, testada e aprovada, que nenhuma outra plataforma oferece. E há ainda o REAL, o diagnóstico que mostra ao artista, com objetividade, onde sua carreira está hoje: ele nasceu diretamente da minha pesquisa de doutorado, e é o que permite que cada plano comece não de um achismo, mas de um retrato honesto da realidade. Construí a Maestra para o artista em qualquer estágio que queira evoluir, mas, acima de tudo, para quem está começando, sem estrutura profissional por trás nem dinheiro para montar uma equipe. Para quem o meu pai foi, um dia.',
  'Nada disso seria possível sozinha. Construí a Maestra em parceria com Azmuth, produtor musical de diversos nomes da música urbana, fundador da Banca Records e empreendedor digital. Conheci o Azmuth quando ele me convidou para ser embaixadora de outra de suas iniciativas, e desde então nutro profunda admiração pelo seu olhar inovador. Quando tive a ideia da Maestra, ele foi minha escolha natural: é quem traduz a minha inteligência em sistema, e quem trouxe à ferramenta uma contribuição que só quem vive os dois mundos, a música e a tecnologia, poderia trazer. Juntos, transformamos um método que cabia numa sala de consultoria em algo que agora cabe na palma da mão de qualquer artista.',
];

const NUMEROS = [
  { n: '30+', l: 'anos de mercado' },
  { n: '313', l: 'planejamentos analisados' },
  { n: '16', l: 'perfis de carreira mapeados' },
];

const Sobre: FC = () => {
  const navigate = useNavigate();
  const loggedIn = useAppSelector((s) => !!s.auth.user);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Sobre · Maestra';
    window.scrollTo(0, 0);
    return () => { document.title = prev; };
  }, []);

  return (
    <div className={styles.page}>
      <Header loggedIn={loggedIn} />

      <section className={styles.hero}>
        <div className={styles.shell}>
          <span className={styles.kicker}>Quem está por trás</span>
          <h1>A história por trás da Maestra</h1>
          <p>
            A Maestra nasceu de uma inquietação de trinta anos: artistas com talento de sobra e
            nenhum caminho. Esta é a história de quem decidiu transformar método em ferramenta.
          </p>
        </div>
      </section>

      <section className={styles.story}>
        <div className={`${styles.shell} ${styles.storyGrid}`}>
          <aside className={styles.aside}>
            <div className={styles.photo}><img src={anitaPhoto} alt='Anita Carvalho' /></div>
            <div className={styles.name}>Anita Carvalho</div>
            <div className={styles.role}>Criadora do Índice REAL · Fundadora da Maestra</div>
            <a
              className={styles.social}
              href='https://www.instagram.com/anitacarvalho_/'
              target='_blank'
              rel='noreferrer'
              aria-label='Instagram da Anita Carvalho'
            >
              <FiInstagram size={18} />
            </a>
          </aside>

          <div className={styles.text}>
            {ANITA_STORY.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </section>

      <section className={styles.numbers}>
        <div className={`${styles.shell} ${styles.numbersGrid}`}>
          {NUMEROS.map((item) => (
            <div key={item.l}>
              <strong>{item.n}</strong>
              <span>{item.l}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.school}>
        <div className={styles.shell}>
          <h2>A escola por trás da plataforma</h2>
          <p>
            A metodologia da Maestra nasceu na Music Rio Academy, a escola de formação prática em
            música e mercado criativo fundada pela Anita, no Vivo Rio.
          </p>
          <button className={styles.link} onClick={() => navigate('/music-rio-academy')}>
            Conheça a Music Rio Academy <FiArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.shell}>
          <div className={styles.ctaCard}>
            <h2>Comece com o diagnóstico grátis</h2>
            <p>O mesmo método, agora na palma da sua mão. Leva poucos minutos.</p>
            <button className={styles.btnNeon} onClick={() => navigate(loggedIn ? '/artists' : '/signup')}>
              {loggedIn ? 'Ir pro app' : 'Começar grátis'} <FiArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Sobre;
