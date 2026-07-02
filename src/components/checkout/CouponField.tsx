import { FC } from 'react';
import { Input } from 'antd';
import { FiTag, FiX } from 'react-icons/fi';

import styles from './checkout.module.scss';

// Campo de cupom de desconto (opcional) — mesmo padrão visual do CpfField.
// A validação real acontece no backend (edge `validate-coupon`); aqui só coleta
// o código e mostra o estado aplicado / erro.
export const CouponField: FC<{
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
  loading?: boolean;
  error?: string;
  /** Quando aplicado: rótulo curto tipo "CUPOM10 · −R$ 4,00". */
  appliedLabel?: string | null;
}> = ({ value, onChange, onApply, onClear, loading, error, appliedLabel }) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel}>Cupom de desconto (opcional)</label>
    {appliedLabel ? (
      <div className={styles.couponApplied}>
        <span><FiTag size={13} /> {appliedLabel}</span>
        <button type="button" onClick={onClear} aria-label="Remover cupom"><FiX size={14} /> Remover</button>
      </div>
    ) : (
      <div className={styles.couponRow}>
        <Input
          prefix={<FiTag className={styles.fieldIcon} />}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onPressEnter={onApply}
          placeholder="Digite o código"
          size="large"
          maxLength={30}
          status={error ? 'error' : undefined}
        />
        <button
          type="button"
          className={styles.couponBtn}
          onClick={onApply}
          disabled={!value.trim() || loading}
        >
          {loading ? 'Validando…' : 'Aplicar'}
        </button>
      </div>
    )}
    {error && <span className={styles.fieldError}>{error}</span>}
  </div>
);

export default CouponField;
