import { FC, ReactNode } from 'react';
import { FiCheck, FiCreditCard } from 'react-icons/fi';

import styles from './checkout.module.scss';

// Layout de checkout em 2 colunas (form à esquerda, resumo/"carrinho" à direita),
// no padrão Adobe/Behance. Empilha no mobile.
export const CheckoutLayout: FC<{ main: ReactNode; aside: ReactNode }> = ({ main, aside }) => (
  <div className={styles.layout}>
    <div className={styles.main}>{main}</div>
    <div className={styles.aside}>{aside}</div>
  </div>
);

// Linha da conta (email confirmado) no topo da coluna de pagamento.
export const AccountRow: FC<{ email: string }> = ({ email }) => (
  <div className={styles.account}>
    <span className={styles.accountCheck}><FiCheck /></span>
    <span className={styles.accountEmail}>{email}</span>
  </div>
);

// Painel branco-escuro com cabeçalho (título + ícone) — o "card" do formulário.
export const CheckoutPanel: FC<{ title: string; icon?: ReactNode; children: ReactNode }> = ({ title, icon, children }) => (
  <div className={styles.panel}>
    <div className={styles.panelHead}>
      <span className={styles.panelHeadIcon}>{icon || <FiCreditCard />}</span>
      <span className={styles.panelTitle}>{title}</span>
    </div>
    {children}
  </div>
);

export default CheckoutLayout;
