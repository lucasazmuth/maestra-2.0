import { useCallback, useMemo, useState } from 'react';

import { isValidCpfCnpj, validateCreditCardFields } from '../../utils/payments';

// Estado + validação dos campos de pagamento (CPF/CNPJ + cartão), compartilhado
// entre a cobrança única (ProfileUnlock) e a assinatura PRO (Subscription).
// Centraliza o que antes estava duplicado nas duas páginas.

export interface CheckoutFieldErrors {
  cpfCnpj?: string;
  cardNumber?: string;
  cardName?: string;
  cardExpiry?: string;
  cardCvv?: string;
  phone?: string;
  cep?: string;
}

export interface CheckoutForm {
  cpf: string; setCpf: (v: string) => void;
  cardNumber: string; setCardNumber: (v: string) => void;
  cardName: string; setCardName: (v: string) => void;
  cardExpiry: string; setCardExpiry: (v: string) => void;
  cardCvv: string; setCardCvv: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  cep: string; setCep: (v: string) => void;
  fieldErrors: CheckoutFieldErrors;
  /** Valida o formulário. `isCard` controla se os campos de cartão são exigidos. */
  validate: (isCard: boolean) => string | null;
}

export function useCheckoutForm(): CheckoutForm {
  const [cpf, setCpf] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');

  // Erros por campo (inline) — só aparecem depois que o usuário digita algo.
  const fieldErrors = useMemo((): CheckoutFieldErrors => {
    const errors: CheckoutFieldErrors = {};
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length > 0) {
      if (cpfDigits.length !== 11 && cpfDigits.length !== 14) errors.cpfCnpj = 'CPF deve ter 11 dígitos ou CNPJ 14';
      else if (!isValidCpfCnpj(cpf)) errors.cpfCnpj = 'CPF/CNPJ inválido';
    }

    const numDigits = cardNumber.replace(/\D/g, '').length;
    if (numDigits > 0 && (numDigits < 13 || numDigits > 19)) errors.cardNumber = 'Número do cartão deve ter 13–19 dígitos';

    const trimmedName = cardName.trim();
    if (trimmedName.length > 0 && (trimmedName.length < 3 || trimmedName.length > 100)) errors.cardName = 'Nome deve ter 3–100 caracteres';

    const expiryDigits = cardExpiry.replace(/\D/g, '');
    if (expiryDigits.length > 0) {
      if (expiryDigits.length !== 4) errors.cardExpiry = 'Validade deve ter 4 dígitos (MMAA)';
      else {
        const month = parseInt(expiryDigits.slice(0, 2), 10);
        if (month < 1 || month > 12) errors.cardExpiry = 'Mês inválido (01–12)';
      }
    }

    const cvvDigits = cardCvv.replace(/\D/g, '');
    if (cvvDigits.length > 0 && (cvvDigits.length < 3 || cvvDigits.length > 4)) errors.cardCvv = 'CVV deve ter 3–4 dígitos';

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 11)) errors.phone = 'Telefone deve ter 10–11 dígitos';

    const cepDigits = cep.replace(/\D/g, '');
    if (cepDigits.length > 0 && cepDigits.length !== 8) errors.cep = 'CEP deve ter 8 dígitos';

    return errors;
  }, [cpf, cardNumber, cardName, cardExpiry, cardCvv, phone, cep]);

  const validate = useCallback((isCard: boolean): string | null => {
    const cpfDigits = cpf.replace(/\D/g, '');
    if (!cpfDigits.length) return 'CPF ou CNPJ é obrigatório';
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) return 'CPF deve ter 11 dígitos ou CNPJ 14';
    if (!isValidCpfCnpj(cpf)) return 'CPF/CNPJ inválido';
    if (isCard) {
      return validateCreditCardFields({ number: cardNumber, holderName: cardName, expiry: cardExpiry, cvv: cardCvv, phone, cep });
    }
    return null;
  }, [cpf, cardNumber, cardName, cardExpiry, cardCvv, phone, cep]);

  return {
    cpf, setCpf, cardNumber, setCardNumber, cardName, setCardName,
    cardExpiry, setCardExpiry, cardCvv, setCardCvv, phone, setPhone, cep, setCep,
    fieldErrors, validate,
  };
}
