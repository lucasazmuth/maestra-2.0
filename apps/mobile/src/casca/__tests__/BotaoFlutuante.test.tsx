import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { BotaoFlutuante } from '@/casca/BotaoFlutuante';

// O botão de criar, flutuando no canto de baixo à direita.
//
// O que este arquivo guarda é a POSIÇÃO: ela é derivada da ilha de navegação, e um número solto
// ficaria certo hoje e sobreposto à ilha no dia em que ela mudasse de altura. Um botão coberto
// pela barra de abas não dá erro nenhum — só deixa de ser tocável.

const medidas = (margemDeBaixo: number): Metrics => ({
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: margemDeBaixo },
});

const montar = (margemDeBaixo: number, aoTocar = jest.fn()) => render(
  <SafeAreaProvider initialMetrics={medidas(margemDeBaixo)}>
    <BotaoFlutuante rotulo="Nova música" aoTocar={aoTocar} />
  </SafeAreaProvider>,
);

describe('botão flutuante', () => {
  /** A âncora é a View que envolve o botão: é nela que mora o `bottom`. */
  const distanciaAteEmbaixo = (tela: Awaited<ReturnType<typeof montar>>) => {
    const ancora = tela.getByLabelText('Nova música').parent!;
    return (StyleSheet.flatten(ancora.props.style) as { bottom?: number }).bottom;
  };

  // Num aparelho com barra de gestos: 34 de reserva + 78 de ilha + 14 de folga.
  it('fica acima da ilha de navegação', async () => {
    expect(distanciaAteEmbaixo(await montar(34))).toBe(126);
  });

  // Sem barra de gestos a ilha desce, e o botão desce com ela: 18 + 78 + 14.
  it('acompanha a ilha quando ela muda de lugar', async () => {
    expect(distanciaAteEmbaixo(await montar(0))).toBe(110);
  });

  it('chama quem o criou', async () => {
    const aoTocar = jest.fn();
    const tela = await montar(34, aoTocar);
    await userEvent.setup().press(tela.getByLabelText('Nova música'));

    expect(aoTocar).toHaveBeenCalled();
  });
});
