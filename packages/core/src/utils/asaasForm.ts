// Formatadores de campos de pagamento (CPF/CNPJ, cartão, etc.) compartilhados
// entre a assinatura PRO e a cobrança única do perfil. Validadores puros vivem
// em pages/Subscription (isValidCpfCnpj, validateCreditCardFields).

export function formatCpfCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) return d.slice(0, 2) + '/' + d.slice(2);
  return d;
}

export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

export function formatCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length > 5) return d.slice(0, 5) + '-' + d.slice(5);
  return d;
}
