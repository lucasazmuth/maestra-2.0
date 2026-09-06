import { render } from '@testing-library/react-native';

import { SeloPro } from '@/casca/marca/SeloPro';

// A pílula do plano no cabeçalho, reduzida a UM estado.
//
// Na web ela também diz FREE e Pendente. Aqui não: uma pílula "FREE" que leva ao checkout é
// direcionar para fora da loja, que é o que a App Store proíbe na 3.1.3. Sobra o oposto —
// dizer a quem paga que o plano está ativo, o que não vende nada.

let mockAtiva = false;

jest.mock('@/nucleo/assinatura', () => ({
  useAssinaturaAtiva: () => mockAtiva,
}));

describe('selo PRO', () => {
  it('aparece para quem assina', async () => {
    mockAtiva = true;
    const tela = await render(<SeloPro />);

    expect(tela.getByText('PRO')).toBeTruthy();
    expect(tela.getByLabelText('Maestra Pro ativo')).toBeTruthy();
  });

  it('não desenha nada para quem não assina', async () => {
    mockAtiva = false;
    const tela = await render(<SeloPro />);

    expect(tela.queryByText('PRO')).toBeNull();
    // Nem uma casca vazia: o cabeçalho não pode ganhar um buraco no lugar da pílula.
    expect(tela.toJSON()).toBeNull();
  });

  // Ele nao e um botao: nao leva a lugar nenhum. Quem nao assina encontra o convite no menu do
  // sistema, em "Seja PRO" — e para quem ja assina nao ha nada para comprar.
  it('não é um caminho para o checkout', async () => {
    mockAtiva = true;
    const tela = await render(<SeloPro />);

    expect(tela.queryByRole('button')).toBeNull();
  });
});
