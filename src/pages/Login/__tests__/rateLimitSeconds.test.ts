import { rateLimitSeconds } from '../AuthShell';

// O número de segundos é a única parte aproveitável do erro de rate limit do Supabase. Se o
// formato da mensagem mudar, o teste quebra aqui em vez de a tela voltar a dizer "um instante".
describe('rateLimitSeconds', () => {
  it('extrai os segundos da mensagem do Supabase', () => {
    expect(rateLimitSeconds({
      message: 'For security purposes, you can only request this after 23 seconds.',
    })).toBe(23);
  });

  it('aceita a forma singular', () => {
    expect(rateLimitSeconds({ message: 'you can only request this after 1 second.' })).toBe(1);
  });

  it('devolve null quando não é erro de rate limit', () => {
    expect(rateLimitSeconds({ message: 'Invalid login credentials' })).toBeNull();
    expect(rateLimitSeconds({ message: 'Token has expired or is invalid' })).toBeNull();
  });

  it('não quebra com entradas vazias ou malformadas', () => {
    expect(rateLimitSeconds(null)).toBeNull();
    expect(rateLimitSeconds(undefined)).toBeNull();
    expect(rateLimitSeconds({})).toBeNull();
    expect(rateLimitSeconds({ message: '' })).toBeNull();
  });
});
