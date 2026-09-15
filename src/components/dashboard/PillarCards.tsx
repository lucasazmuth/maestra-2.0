import { FC, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import type { Artist } from '@maestra/core/interfaces/maestra';
import { useJourneyState } from '@maestra/core/hooks/useJourneyState';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { pilaresDoPainel, type DestinoDoPilar, type Pilar } from '@maestra/core/nucleo/pilaresDoPainel';
import { DiagnosticoIcon, PlanejamentoIcon, PlanoAcaoIcon } from '../Icons/system';
import styles from './PillarCards.module.scss';

// As três portas do método, no topo da home: onde estou, execução, para onde ir.
//
// Diagnóstico, Plano de Ação e Planejamento saíram da navegação: estes cartões são o ÚNICO
// caminho até eles. Por isso o cartão inteiro é o alvo do clique, e não só o texto da ação: num
// cartão de 132px, um alvo de 40px transforma "acesso fácil" em caça ao botão no celular.
//
// O estado de cada cartão (o que dizer, para onde ir) é decidido no núcleo, em
// `pilaresDoPainel` — o app nativo monta os mesmos três cartões a partir da mesma função.

const ICONE = {
  diagnostico: DiagnosticoIcon,
  execucao: PlanoAcaoIcon,
  planejamento: PlanejamentoIcon,
} as const;

// O destino é semântico no núcleo; a rota é de cada superfície. O app tem a própria tabela.
const ROTA: Record<DestinoDoPilar, (id: string) => string> = {
  diagnostico: (id) => `/artists/${id}/diagnostico`,
  refazerDiagnostico: (id) => `/artists/${id}/diagnostico/refazer`,
  planejamento: (id) => `/artists/${id}/perfil`,
  wizard: (id) => `/artists/${id}/wizard`,
  plano: (id) => `/artists/${id}/action-plan`,
  assinatura: () => '/planos',
};

const Cartao: FC<{ pilar: Pilar; onAbrir: () => void }> = ({ pilar, onAbrir }) => {
  const Icone = ICONE[pilar.chave];
  const resumo = pilar.chave === 'planejamento' && pilar.estado === 'concluido'
    ? pilar.detalhe || pilar.linha
    : pilar.linha;
  const precisaDeAcao = pilar.estado === 'travado' || pilar.estado === 'vazio'
    || (pilar.chave === 'planejamento' && pilar.estado === 'andamento');
  const aoTeclar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAbrir();
    }
  };

  return (
    <article
      className={`${styles.card} ${styles[pilar.chave]}${pilar.estado === 'travado' ? ` ${styles.travado}` : ''}`}
      role='button'
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={aoTeclar}
      aria-label={`${pilar.titulo}: ${pilar.cta}`}
    >
      <span className={styles.marca} aria-hidden><Icone size={24} /></span>
      <div className={styles.corpo}>
        <span className={styles.rotulo}>{pilar.rotulo}</span>
        <h2 className={styles.titulo}>{pilar.titulo}</h2>
        <p className={styles.linha}>{resumo}</p>
          {pilar.progresso && (
            <div className={styles.regua} aria-hidden>
              <div className={styles.reguaCheia} style={{ width: `${pilar.progresso.pct}%` }} />
            </div>
          )}
        {precisaDeAcao && <span className={styles.acao}>{pilar.cta}</span>}
      </div>
      <FiArrowRight className={styles.seta} size={20} aria-hidden />
    </article>
  );
};

export const PillarCards: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const jornada = useJourneyState(artist);
  const { viewPlanning, manageTasks } = useArtistCapabilities(artist);
  const pilares = pilaresDoPainel(artist, jornada, { viewPlanning, manageTasks });

  return (
    <section className={styles.pilares} aria-label='Seu método'>
      {pilares.map((pilar) => (
        <Cartao key={pilar.chave} pilar={pilar} onAbrir={() => navigate(ROTA[pilar.destino](artist.id))} />
      ))}
    </section>
  );
};

export default PillarCards;
