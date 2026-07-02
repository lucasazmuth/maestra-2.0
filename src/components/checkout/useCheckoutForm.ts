import { useCallback, useEffect, useMemo, useState } from 'react';

import { isValidCpfCnpj, validateCreditCardFields } from '../../utils/payments';

// Endereço resolvido pelo CEP (ViaCEP). Mandamos logradouro/bairro pro Asaas
// pra compor o endereço do titular do cartão (alguns CEPs são recusados sem isso).
export interface ResolvedAddress {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

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
  /** Consulta ViaCEP em andamento (8 dígitos preenchidos). */
  cepLoading: boolean;
  /** Erro da consulta de CEP (ex.: "CEP não encontrado"). Separado do erro de formato. */
  cepLookupError: string;
  /** Endereço resolvido pelo ViaCEP (logradouro/bairro/cidade/UF). Null enquanto não resolve. */
  resolvedAddress: ResolvedAddress | null;
  /** Valida o formulário. `isCard` controla se os campos de cartão são exigidos. */
  validate: (isCard: boolean) => string | null;
  /** Marca que o usuário tentou pagar — aí os campos obrigatórios vazios ficam vermelhos. */
  markSubmitted: (isCard: boolean) => void;
}

// Foca e rola até o primeiro campo marcado como inválido (após uma tentativa de
// pagar). Roda no próximo tick pra o React já ter pintado as classes de erro.
export function focusFirstInvalidField() {
  setTimeout(() => {
    const el = document.querySelector(
      '.ant-input-status-error, .ant-input-affix-wrapper-status-error',
    ) as HTMLElement | null;
    if (!el) return;
    const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLElement | null;
    input?.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 0);
}

export function useCheckoutForm(): CheckoutForm {
  const [cpf, setCpf] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepLookupError, setCepLookupError] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<ResolvedAddress | null>(null);
  // Depois que o usuário clica em pagar, os campos obrigatórios VAZIOS passam a
  // aparecer em vermelho (antes só marcávamos formato inválido do que foi digitado).
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitCard, setSubmitCard] = useState(false);
  const markSubmitted = useCallback((isCard: boolean) => { setSubmitAttempted(true); setSubmitCard(isCard); }, []);

  // Consulta ViaCEP quando o CEP fica completo (8 dígitos). Valida se o CEP existe
  // (bloqueia CEP inválido no checkout) e resolve o endereço pra mandar ao Asaas.
  // Rede/ViaCEP fora do ar NÃO bloqueia o pagamento (fica sem endereço resolvido).
  useEffect(() => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepLookupError('');
      setResolvedAddress(null);
      setCepLoading(false);
      return;
    }
    let cancelled = false;
    setCepLoading(true);
    setCepLookupError('');
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.erro) {
          setResolvedAddress(null);
          setCepLookupError('CEP não encontrado. Confira o número.');
        } else {
          setCepLookupError('');
          setResolvedAddress({
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            localidade: data.localidade || '',
            uf: data.uf || '',
          });
        }
      })
      .catch(() => {
        // ViaCEP indisponível: não trava o checkout — segue sem endereço resolvido.
        if (!cancelled) { setCepLookupError(''); setResolvedAddress(null); }
      })
      .finally(() => { if (!cancelled) setCepLoading(false); });
    return () => { cancelled = true; };
  }, [cep]);

  // Erros por campo (inline). Formato inválido aparece assim que o usuário digita;
  // "obrigatório" (campo vazio) só depois que ele clica em pagar (submitAttempted).
  const fieldErrors = useMemo((): CheckoutFieldErrors => {
    const errors: CheckoutFieldErrors = {};
    // Campos de cartão só são exigidos quando o pagamento tentado foi com cartão.
    const reqCard = submitAttempted && submitCard;

    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length > 0) {
      if (cpfDigits.length !== 11 && cpfDigits.length !== 14) errors.cpfCnpj = 'CPF deve ter 11 dígitos ou CNPJ 14';
      else if (!isValidCpfCnpj(cpf)) errors.cpfCnpj = 'CPF/CNPJ inválido';
    } else if (submitAttempted) errors.cpfCnpj = 'CPF ou CNPJ é obrigatório';

    const numDigits = cardNumber.replace(/\D/g, '').length;
    if (numDigits > 0) { if (numDigits < 13 || numDigits > 19) errors.cardNumber = 'Número do cartão deve ter 13–19 dígitos'; }
    else if (reqCard) errors.cardNumber = 'Número do cartão é obrigatório';

    const trimmedName = cardName.trim();
    if (trimmedName.length > 0) { if (trimmedName.length < 3 || trimmedName.length > 100) errors.cardName = 'Nome deve ter 3–100 caracteres'; }
    else if (reqCard) errors.cardName = 'Nome é obrigatório';

    const expiryDigits = cardExpiry.replace(/\D/g, '');
    if (expiryDigits.length > 0) {
      if (expiryDigits.length !== 4) errors.cardExpiry = 'Validade deve ter 4 dígitos (MMAA)';
      else {
        const month = parseInt(expiryDigits.slice(0, 2), 10);
        if (month < 1 || month > 12) errors.cardExpiry = 'Mês inválido (01–12)';
      }
    } else if (reqCard) errors.cardExpiry = 'Validade é obrigatória';

    const cvvDigits = cardCvv.replace(/\D/g, '');
    if (cvvDigits.length > 0) { if (cvvDigits.length < 3 || cvvDigits.length > 4) errors.cardCvv = 'CVV deve ter 3–4 dígitos'; }
    else if (reqCard) errors.cardCvv = 'CVV é obrigatório';

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length > 0) { if (phoneDigits.length < 10 || phoneDigits.length > 11) errors.phone = 'Telefone deve ter 10–11 dígitos'; }
    else if (reqCard) errors.phone = 'Celular é obrigatório';

    const cepDigits = cep.replace(/\D/g, '');
    if (cepDigits.length > 0) {
      if (cepDigits.length !== 8) errors.cep = 'CEP deve ter 8 dígitos';
      else if (cepLookupError) errors.cep = cepLookupError; // CEP inexistente (ViaCEP)
    } else if (reqCard) errors.cep = 'CEP é obrigatório';

    return errors;
  }, [cpf, cardNumber, cardName, cardExpiry, cardCvv, phone, cep, cepLookupError, submitAttempted, submitCard]);

  const validate = useCallback((isCard: boolean): string | null => {
    const cpfDigits = cpf.replace(/\D/g, '');
    if (!cpfDigits.length) return 'CPF ou CNPJ é obrigatório';
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) return 'CPF deve ter 11 dígitos ou CNPJ 14';
    if (!isValidCpfCnpj(cpf)) return 'CPF/CNPJ inválido';
    if (isCard) {
      const cardErr = validateCreditCardFields({ number: cardNumber, holderName: cardName, expiry: cardExpiry, cvv: cardCvv, phone, cep });
      if (cardErr) return cardErr;
      // ViaCEP: não deixa pagar com CEP inexistente nem enquanto a consulta roda.
      if (cepLoading) return 'Aguarde a validação do CEP.';
      if (cepLookupError) return cepLookupError;
    }
    return null;
  }, [cpf, cardNumber, cardName, cardExpiry, cardCvv, phone, cep, cepLoading, cepLookupError]);

  return {
    cpf, setCpf, cardNumber, setCardNumber, cardName, setCardName,
    cardExpiry, setCardExpiry, cardCvv, setCardCvv, phone, setPhone, cep, setCep,
    fieldErrors, cepLoading, cepLookupError, resolvedAddress, validate, markSubmitted,
  };
}
