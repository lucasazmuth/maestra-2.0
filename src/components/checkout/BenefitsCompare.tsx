import { FC, ReactNode } from 'react';

import styles from './checkout.module.scss';

export interface BenefitGroup {
  icon: ReactNode;
  title: string;
  items: string[];
}

interface Column {
  name: string;
  desc: string;
  price: string;
  unit?: string;
  priceNote?: string;
  groups: BenefitGroup[];
}

// Toggle Mensal/Anual no card PRO. O pai controla o ciclo e passa o preço já resolvido.
export interface BillingToggle {
  cycle: 'MONTHLY' | 'YEARLY';
  onChange: (c: 'MONTHLY' | 'YEARLY') => void;
  annualEnabled: boolean;
  saveLabel?: string;
}

interface Props {
  headline: string;
  sub?: ReactNode;
  free: Column;
  pro: Column;
  ctaLabel: string;
  onCta: () => void;
  proBadge?: string;
  billing?: BillingToggle;
}

const Groups: FC<{ groups: BenefitGroup[] }> = ({ groups }) => (
  <>
    {groups.map((g) => (
      <div key={g.title} className={styles.compareGroup}>
        <div className={styles.compareGroupHead}>
          <span className={styles.compareGroupIcon}>{g.icon}</span>
          <span className={styles.compareGroupTitle}>{g.title}</span>
        </div>
        <ul className={styles.compareList}>
          {g.items.map((it) => <li key={it}>{it}</li>)}
        </ul>
      </div>
    ))}
  </>
);

// Comparação de planos lado a lado (Grátis vs PRO), estilo Adobe/Behance, tema escuro.
// O card PRO tem um seletor Mensal/Anual opcional (billing).
export const BenefitsCompare: FC<Props> = ({ headline, sub, free, pro, ctaLabel, onCta, proBadge = 'PRO', billing }) => (
  <div className={styles.compareWrap}>
    <div className={styles.compareHeadline}>
      <h1 className={styles.compareTitle}>{headline}</h1>
      {sub && <p className={styles.compareSub}>{sub}</p>}
    </div>

    <div className={styles.compare}>
      <div className={styles.compareCol}>
        <div className={styles.compareColName}>{free.name}</div>
        <p className={styles.compareColDesc}>{free.desc}</p>
        <div className={styles.comparePrice}>
          <span className={styles.comparePriceValue}>{free.price}</span>
          {free.unit && <span className={styles.comparePriceUnit}>{free.unit}</span>}
        </div>
        <Groups groups={free.groups} />
      </div>

      <div className={`${styles.compareCol} ${styles.compareColPro}`}>
        <span className={styles.proBadge}>{proBadge}</span>
        <div className={`${styles.compareColName} ${styles.compareColNamePro}`}>{pro.name}</div>
        <p className={styles.compareColDesc}>{pro.desc}</p>

        {billing?.annualEnabled && (
          <div className={styles.billingToggle} role="tablist" aria-label="Ciclo de cobrança">
            <button
              type="button"
              role="tab"
              aria-selected={billing.cycle === 'MONTHLY'}
              className={`${styles.billingOpt} ${billing.cycle === 'MONTHLY' ? styles.billingOptOn : ''}`}
              onClick={() => billing.onChange('MONTHLY')}
            >
              Mensal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billing.cycle === 'YEARLY'}
              className={`${styles.billingOpt} ${billing.cycle === 'YEARLY' ? styles.billingOptOn : ''}`}
              onClick={() => billing.onChange('YEARLY')}
            >
              Anual
              {billing.saveLabel && <span className={styles.billingSave}>{billing.saveLabel}</span>}
            </button>
          </div>
        )}

        <div className={styles.comparePrice}>
          <span className={styles.comparePriceValue}>{pro.price}</span>
          {pro.unit && <span className={styles.comparePriceUnit}>{pro.unit}</span>}
        </div>
        {pro.priceNote && <div className={styles.comparePriceNote}>{pro.priceNote}</div>}

        <Groups groups={pro.groups} />
        <button className={`${styles.payBtn} ${styles.compareCta}`} onClick={onCta}>{ctaLabel}</button>
      </div>
    </div>
  </div>
);

export default BenefitsCompare;
