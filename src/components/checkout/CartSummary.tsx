import { FC, ReactNode } from 'react';
import { Spin } from 'antd';
import { FiLock, FiCheck } from 'react-icons/fi';
import { LoadingOutlined } from '@ant-design/icons';

import styles from './checkout.module.scss';

export interface CartTimelineItem {
  label: string;
  value?: string;
  hint?: string;
  /** Marcador "vazado" (futuro) em vez de preenchido (agora). */
  open?: boolean;
}

interface Props {
  title?: string;
  selectLabel?: string;
  selectValue?: string;
  /** Conteúdo custom logo abaixo do título (ex.: seletor de parcelamento). */
  topSlot?: ReactNode;
  item: {
    icon: ReactNode | string; // string = URL de imagem
    name: string;
    sub?: ReactNode;
    price: string;
  };
  /** Checklist curta "o que está incluído". */
  includes?: string[];
  rows?: { label: string; value: string; strong?: boolean }[];
  timeline?: CartTimelineItem[];
  checkbox?: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode };
  legal?: ReactNode;
  ctaLabel: string;
  onCta: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
}

// Painel "Seu carrinho" — resumo do pedido com item, totais, timeline de cobrança
// opcional, texto legal e CTA primário (estilo Adobe, tema escuro).
export const CartSummary: FC<Props> = ({
  title = 'Seu carrinho', selectLabel, selectValue, topSlot, item, includes, rows, timeline,
  checkbox, legal, ctaLabel, onCta, loading, disabled, error,
}) => (
  <div className={styles.cart}>
    <div className={styles.cartTitle}>{title}</div>

    {topSlot}

    {selectLabel && (
      <div className={styles.cartSelectRow}>
        <span className={styles.cartSelectLabel}>{selectLabel}</span>
        <span className={styles.cartSelectValue}>{selectValue}</span>
      </div>
    )}

    <div className={styles.cartItem}>
      {typeof item.icon === 'string'
        ? <img className={styles.cartItemIcon} src={item.icon} alt="" />
        : <span className={styles.cartItemIcon}>{item.icon}</span>}
      <div className={styles.cartItemMain}>
        <div className={styles.cartItemName}>{item.name}</div>
        {item.sub && <div className={styles.cartItemSub}>{item.sub}</div>}
      </div>
      <div className={styles.cartItemPrice}>{item.price}</div>
    </div>

    {includes && includes.length > 0 && (
      <ul className={styles.cartIncludes}>
        {includes.map((it) => (
          <li key={it}><span className={styles.cartIncludesIcon}><FiCheck /></span> {it}</li>
        ))}
      </ul>
    )}

    {rows?.map((r) => (
      <div key={r.label} className={`${styles.cartRow} ${r.strong ? styles.cartRowStrong : ''}`}>
        <span>{r.label}</span><span>{r.value}</span>
      </div>
    ))}

    {timeline && timeline.length > 0 && (
      <div className={styles.timeline}>
        {timeline.map((t, i) => (
          <div key={i} className={styles.timelineRow}>
            <span className={styles.timelineMarker}>
              <span className={`${styles.timelineDot} ${t.open ? styles.timelineDotOpen : ''}`} />
              {i < timeline.length - 1 && <span className={styles.timelineLine} />}
            </span>
            <div className={styles.timelineMain}>
              <div className={styles.timelineTop}>
                <span className={`${styles.timelineLabel} ${t.open ? styles.timelineLabelMuted : ''}`}>{t.label}</span>
                {t.value && <span className={styles.timelineValue}>{t.value}</span>}
              </div>
              {t.hint && <div className={styles.timelineHint}>{t.hint}</div>}
            </div>
          </div>
        ))}
      </div>
    )}

    {checkbox && (
      <button type="button" className={styles.cartCheck} onClick={() => checkbox.onChange(!checkbox.checked)}>
        <span className={`${styles.cartCheckBox} ${checkbox.checked ? styles.cartCheckBoxOn : ''}`}>
          {checkbox.checked && <FiCheck />}
        </span>
        <span className={styles.cartCheckLabel}>{checkbox.label}</span>
      </button>
    )}

    {legal && <div className={styles.cartLegal}>{legal}</div>}

    {error && <div className={styles.errorMsg}>{error}</div>}

    <button className={styles.payBtn} onClick={onCta} disabled={disabled || loading} style={legal || checkbox ? undefined : { marginTop: 18 }}>
      {loading
        ? <><Spin indicator={<LoadingOutlined style={{ color: '#fff' }} spin />} size="small" /> Processando…</>
        : ctaLabel}
    </button>

    <div className={styles.secure}><FiLock size={12} /> Compra segura · processada via Asaas</div>

    {/* Razão social por trás da Maestra: é o nome que aparece na fatura do cartão / extrato. */}
    <div className={styles.receiverNote}>
      Na fatura do cartão e no extrato, a cobrança aparece como
      <br />
      <strong>MUSIC RIO ACADEMY LTDA</strong> · CNPJ 22.826.985/0001-41
    </div>
  </div>
);

export default CartSummary;
