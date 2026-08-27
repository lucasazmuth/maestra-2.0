import { FC, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { MaestraBrand } from '../../components/MaestraBrand';
import { NytaEmblem } from '../../components/nyta/NytaEmblem';
import { rodandoNativo } from '../../lib/plataforma';
import styles from './MobileIntro.module.scss';

// Abertura do app empacotado, no lugar da landing.
//
// A landing e peca de marketing: quem baixou o app ja foi convencido, e uma pagina de venda
// dentro do app iOS ainda leva ao checkout com PIX, que a App Review recusa (3.1.1). A intro faz
// o trabalho que sobra: dizer em tres telas o que a Maestra entrega, e entregar no login.

/** Marca que a pessoa ja viu a intro. Quem ja viu vai direto para o login nas proximas aberturas. */
const CHAVE_VISTA = 'maestra:intro-vista';

const PASSOS = [
  {
    chave: 'diagnostico',
    titulo: 'O retrato honesto da sua carreira',
    texto: 'O diagnóstico lê os seus números reais e mostra onde você está hoje, sem elogio de graça.',
  },
  {
    chave: 'plano',
    titulo: 'Um plano de verdade, com ordem de fazer',
    texto: 'Visão, missão, objetivos e estratégias priorizadas. Você sai daqui sabendo o que fazer primeiro.',
  },
  {
    chave: 'nyta',
    titulo: 'A Nyta conhece a sua carreira',
    texto: 'Uma assistente de IA que acompanha o seu contexto, do diagnóstico ao dia a dia.',
  },
] as const;

export const MobileIntro: FC = () => {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(0);
  // A splash cobre o primeiro instante para o app nao abrir num branco enquanto o React monta.
  const [abrindo, setAbrindo] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setAbrindo(false), 900);
    return () => clearTimeout(t);
  }, []);

  // Fora do app empacotado esta tela nao existe: na web a porta de entrada continua sendo a landing.
  if (!rodandoNativo()) return <Navigate to='/' replace />;
  if (localStorage.getItem(CHAVE_VISTA)) return <Navigate to='/login' replace />;

  const concluir = () => {
    localStorage.setItem(CHAVE_VISTA, '1');
    navigate('/login', { replace: true });
  };

  const avancar = () => (passo < PASSOS.length - 1 ? setPasso(passo + 1) : concluir());

  if (abrindo) {
    return (
      <div className={styles.splash}>
        <MaestraBrand variant='lockup' tone='dark' className={styles.splashMarca} />
      </div>
    );
  }

  const atual = PASSOS[passo];

  return (
    <div className={styles.tela}>
      <header className={styles.topo}>
        <MaestraBrand variant='symbol' tone='dark' className={styles.marca} />
        <button type='button' className={styles.pular} onClick={concluir}>
          Pular
        </button>
      </header>

      {/* A arte e a mesma em todos os passos, mas troca de cor: a repeticao do disco cria a
          sensacao de continuidade, e a cor diferencia o assunto sem precisar de tres ilustracoes. */}
      <div className={styles.palco} aria-hidden>
        <div className={`${styles.disco} ${styles[`disco_${atual.chave}`]}`}>
          <NytaEmblem tone='onDark' className={styles.emblema} />
        </div>
        <span className={`${styles.satelite} ${styles.sateliteAlto}`} />
        <span className={`${styles.satelite} ${styles.sateliteBaixo}`} />
      </div>

      <div className={styles.rodape}>
        <div className={styles.pontos} role='tablist' aria-label='Passos da apresentação'>
          {PASSOS.map((p, i) => (
            <button
              key={p.chave}
              type='button'
              role='tab'
              aria-selected={i === passo}
              aria-label={`Passo ${i + 1} de ${PASSOS.length}: ${p.titulo}`}
              className={`${styles.ponto} ${i === passo ? styles.pontoAtivo : ''}`}
              onClick={() => setPasso(i)}
            />
          ))}
        </div>

        <h1 className={styles.titulo}>{atual.titulo}</h1>
        <p className={styles.texto}>{atual.texto}</p>

        <button type='button' className={styles.cta} onClick={avancar}>
          {passo < PASSOS.length - 1 ? 'Continuar' : 'Começar'}
        </button>
      </div>
    </div>
  );
};

export default MobileIntro;
