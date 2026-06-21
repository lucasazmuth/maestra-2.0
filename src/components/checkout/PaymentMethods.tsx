import { FC, ReactNode } from 'react';
import { FaCcVisa, FaCcMastercard, FaCcAmex } from 'react-icons/fa';

import { ReactComponent as PixMark } from '../../assets/pix-mark.svg';
import styles from './checkout.module.scss';

export type PayMethod = 'PIX' | 'CREDIT' | 'DEBIT';

const META: Record<PayMethod, { label: string; brands: ReactNode }> = {
  PIX: { label: 'PIX', brands: <PixMark style={{ width: 26, height: 26 }} /> },
  CREDIT: { label: 'Cartão de crédito', brands: <><FaCcVisa /><FaCcMastercard /><FaCcAmex /></> },
  DEBIT: { label: 'Cartão de débito', brands: <><FaCcVisa /><FaCcMastercard /></> },
};

interface Props {
  methods: PayMethod[];
  value: PayMethod;
  onChange: (m: PayMethod) => void;
  /** Conteúdo expandido do método selecionado (form de cartão ou QR PIX). */
  renderBody: (m: PayMethod) => ReactNode;
}

// Seletor de método de pagamento como "radio rows" expansíveis (estilo Adobe).
export const PaymentMethods: FC<Props> = ({ methods, value, onChange, renderBody }) => (
  <div className={styles.methods}>
    {methods.map((m) => {
      const on = value === m;
      return (
        <div key={m} className={`${styles.method} ${on ? styles.methodOn : ''}`}>
          <button type="button" className={styles.methodHead} onClick={() => onChange(m)} aria-pressed={on}>
            <span className={styles.methodRadio} />
            <span className={styles.methodLabel}>{META[m].label}</span>
            <span className={styles.methodBrands}>{META[m].brands}</span>
          </button>
          {on && <div className={styles.methodBody}>{renderBody(m)}</div>}
        </div>
      );
    })}
  </div>
);

export default PaymentMethods;
