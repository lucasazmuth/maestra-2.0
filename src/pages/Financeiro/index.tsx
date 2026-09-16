import { FC } from 'react';

import { FinanceiroIcon } from '../../components/Icons/system';

const UPCOMING_FEATURES = [
  ['01', 'Receitas e despesas da carreira'],
  ['02', 'Cachês, contratos e pagamentos'],
  ['03', 'Visão financeira do projeto'],
] as const;

const Financeiro: FC = () => (
  <div className="board-content page-view marketing-empty financeiro-empty">
    <section className="marketing-empty-state">
      <div className="marketing-empty-icon" aria-hidden="true"><FinanceiroIcon size={30} /></div>
      <p>FINANCEIRO</p>
      <h1>Uma nova área está chegando.</h1>
      <span>Estamos preparando um espaço para organizar as finanças da carreira e acompanhar os resultados do projeto em um só lugar.</span>
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

export default Financeiro;
