// Validadores puros de pagamento (CPF/CNPJ + cartão), compartilhados entre a
// assinatura PRO e a cobrança única do perfil. Os formatadores ficam em
// utils/asaasForm.ts. (Antes viviam em pages/Subscription; movidos pra cá pra
// evitar dependência cruzada entre páginas e centralizar a regra.)

export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * w1[i];
  let r = sum % 11;
  if ((r < 2 ? 0 : 11 - r) !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * w2[i];
  r = sum % 11;
  return (r < 2 ? 0 : 11 - r) === parseInt(digits[13]);
}

export function isValidCpfCnpj(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

export interface CreditCardFields {
  number: string;
  holderName: string;
  expiry: string;
  cvv: string;
  phone: string;
  cep: string;
}

/**
 * Valida os campos de cartão de crédito. Retorna null se tudo válido, ou a
 * primeira mensagem de erro encontrada.
 */
export function validateCreditCardFields(fields: CreditCardFields): string | null {
  const numDigits = fields.number.replace(/\D/g, '').length;
  if (numDigits < 13 || numDigits > 19) return 'Número do cartão deve ter 13–19 dígitos';

  const trimmedName = fields.holderName.trim();
  if (trimmedName.length < 3 || trimmedName.length > 100) return 'Nome deve ter 3–100 caracteres';

  const expiryDigits = fields.expiry.replace(/\D/g, '');
  if (expiryDigits.length !== 4) return 'Validade deve ter 4 dígitos (MMAA)';
  const month = parseInt(expiryDigits.slice(0, 2), 10);
  if (month < 1 || month > 12) return 'Mês inválido (01–12)';

  const cvvDigits = fields.cvv.replace(/\D/g, '');
  if (cvvDigits.length < 3 || cvvDigits.length > 4) return 'CVV deve ter 3–4 dígitos';

  const phoneDigits = fields.phone.replace(/\D/g, '').length;
  if (phoneDigits < 10 || phoneDigits > 11) return 'Telefone deve ter 10–11 dígitos';

  const cepDigits = fields.cep.replace(/\D/g, '').length;
  if (cepDigits !== 8) return 'CEP deve ter 8 dígitos';

  return null;
}
