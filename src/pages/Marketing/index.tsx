import { FC } from 'react';

import { MarketingIcon } from '../../components/Icons/system';

const UPCOMING_FEATURES = [
  ['01', 'Campanhas e lançamentos'],
  ['02', 'Calendário de conteúdo'],
  ['03', 'Resultados e audiência'],
] as const;

const Marketing: FC = () => (
  <div className="board-content page-view marketing-empty">
    <section className="marketing-empty-state">
      <div className="marketing-empty-icon" aria-hidden="true"><MarketingIcon size={30} /></div>
      <p>MARKETING</p>
      <h1>Uma nova área está chegando.</h1>
      <span>Estamos preparando um espaço para organizar campanhas, conteúdo e resultados da carreira em um só lugar.</span>
      <div className="marketing-coming-list">
        {UPCOMING_FEATURES.map(([number, label]) => (
          <div key={number}>
            <i>{number}</i>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      <small>Em breve na Maestra</small>
    </section>
  </div>
);

export default Marketing;
