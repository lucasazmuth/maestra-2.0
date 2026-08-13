import { FC } from 'react';
import { Input, Spin } from 'antd';
import { FiCreditCard, FiUser, FiCalendar, FiLock, FiSmartphone, FiMapPin } from 'react-icons/fi';

import { formatCardNumber, formatExpiry, formatPhone, formatCep, formatCpfCnpj } from '../../utils/asaasForm';
import type { CheckoutForm } from './useCheckoutForm';
import styles from './checkout.module.scss';

// Campo CPF/CNPJ — exigido tanto no PIX quanto no cartão, então fica fora do
// formulário de cartão (acima dos métodos de pagamento).
export const CpfField: FC<{ form: CheckoutForm }> = ({ form }) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel}>CPF ou CNPJ</label>
    <Input
      prefix={<FiUser className={styles.fieldIcon} />}
      value={form.cpf}
      onChange={(e) => form.setCpf(formatCpfCnpj(e.target.value))}
      placeholder="000.000.000-00"
      inputMode="numeric"
      size="large"
      status={form.fieldErrors.cpfCnpj ? 'error' : undefined}
    />
    {form.fieldErrors.cpfCnpj && <span className={styles.fieldError}>{form.fieldErrors.cpfCnpj}</span>}
  </div>
);

// Formulário de cartão — as bandeiras ficam no cabeçalho do método de pagamento.
export const CardForm: FC<{ form: CheckoutForm; brands?: unknown }> = ({ form }) => {
  const e = form.fieldErrors;
  return (
    <div className={styles.fieldStack}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Número do cartão</label>
        <Input
          prefix={<FiCreditCard className={styles.fieldIcon} />}
          value={form.cardNumber}
          onChange={(ev) => form.setCardNumber(formatCardNumber(ev.target.value))}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          size="large"
          status={e.cardNumber ? 'error' : undefined}
        />
        {e.cardNumber && <span className={styles.fieldError}>{e.cardNumber}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nome impresso no cartão</label>
        <Input
          prefix={<FiUser className={styles.fieldIcon} />}
          value={form.cardName}
          onChange={(ev) => form.setCardName(ev.target.value.toUpperCase())}
          placeholder="Como aparece no cartão"
          size="large"
          status={e.cardName ? 'error' : undefined}
        />
        {e.cardName && <span className={styles.fieldError}>{e.cardName}</span>}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Validade</label>
          <Input
            prefix={<FiCalendar className={styles.fieldIcon} />}
            value={form.cardExpiry}
            onChange={(ev) => form.setCardExpiry(formatExpiry(ev.target.value))}
            placeholder="MM/AA"
            inputMode="numeric"
            size="large"
            status={e.cardExpiry ? 'error' : undefined}
          />
          {e.cardExpiry && <span className={styles.fieldError}>{e.cardExpiry}</span>}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>CVV</label>
          <Input
            prefix={<FiLock className={styles.fieldIcon} />}
            value={form.cardCvv}
            onChange={(ev) => form.setCardCvv(ev.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            inputMode="numeric"
            size="large"
            status={e.cardCvv ? 'error' : undefined}
          />
          {e.cardCvv && <span className={styles.fieldError}>{e.cardCvv}</span>}
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Celular</label>
          <Input
            prefix={<FiSmartphone className={styles.fieldIcon} />}
            value={form.phone}
            onChange={(ev) => form.setPhone(formatPhone(ev.target.value))}
            placeholder="(11) 99999-9999"
            inputMode="tel"
            size="large"
            status={e.phone ? 'error' : undefined}
          />
          {e.phone && <span className={styles.fieldError}>{e.phone}</span>}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>CEP</label>
          <Input
            prefix={<FiMapPin className={styles.fieldIcon} />}
            suffix={form.cepLoading ? <Spin size="small" /> : null}
            value={form.cep}
            onChange={(ev) => form.setCep(formatCep(ev.target.value))}
            placeholder="00000-000"
            inputMode="numeric"
            size="large"
            status={e.cep || form.cepLookupError ? 'error' : undefined}
          />
          {(e.cep || form.cepLookupError) && (
            <span className={styles.fieldError}>{e.cep || form.cepLookupError}</span>
          )}
          {/* Endereço resolvido pelo ViaCEP — confirmação visual de que o CEP é válido. */}
          {!form.cepLookupError && form.resolvedAddress?.localidade && (
            <span className={styles.fieldHint}>
              {[form.resolvedAddress.bairro, `${form.resolvedAddress.localidade} – ${form.resolvedAddress.uf}`]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardForm;
