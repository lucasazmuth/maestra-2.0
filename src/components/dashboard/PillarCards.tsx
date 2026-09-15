import { FC } from 'react';

import type { Artist } from '@maestra/core/interfaces/maestra';
import { useJourneyState } from '@maestra/core/hooks/useJourneyState';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { pilaresDoPainel, type ChaveDoPilar } from '@maestra/core/nucleo/pilaresDoPainel';
import styles from './PillarCards.module.scss';

export type SecaoDoPainel = 'visao-geral' | ChaveDoPilar;

const ROTULOS: Record<ChaveDoPilar, string> = {
  diagnostico: 'Diagnóstico REAL',
  execucao: 'Plano de Ação',
  planejamento: 'Planejamento',
};

interface PillarCardsProps {
  artist: Artist;
  ativa: SecaoDoPainel;
  onSelect: (secao: SecaoDoPainel) => void;
}

export const PillarCards: FC<PillarCardsProps> = ({ artist, ativa, onSelect }) => {
  const jornada = useJourneyState(artist);
  const { viewPlanning, manageTasks } = useArtistCapabilities(artist);
  const pilares = pilaresDoPainel(artist, jornada, { viewPlanning, manageTasks });
  const itens: Array<{ chave: SecaoDoPainel; rotulo: string; status?: string }> = [
    { chave: 'visao-geral', rotulo: 'Visão geral' },
    ...pilares.map((pilar) => ({
      chave: pilar.chave,
      rotulo: ROTULOS[pilar.chave],
      status: pilar.estado === 'andamento' ? 'Em andamento' : undefined,
    })),
  ];

  return (
    <nav className={styles.menu} aria-label='Áreas do método'>
      {itens.map((item) => (
        <button
          key={item.chave}
          type='button'
          className={ativa === item.chave ? styles.ativo : undefined}
          aria-current={ativa === item.chave ? 'page' : undefined}
          onClick={() => onSelect(item.chave)}
        >
          <span>{item.rotulo}</span>
          {item.status && <small>{item.status}</small>}
        </button>
      ))}
    </nav>
  );
};

export default PillarCards;
