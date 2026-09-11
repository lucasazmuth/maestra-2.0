import { fireEvent, render } from '@testing-library/react-native';

import { FecharComGuia } from '../jam/FecharComGuia';

// FECHAR O ESPAÇO JAM: a pergunta, e a espera.
//
// ⚠️ A PERGUNTA VEM POR ÚLTIMO, e não é arrumação. O `Modal` dela sobrevive à limpeza entre
// casos, e um caso de ESPERA montado depois dele desenhava a mão mas não chegava ao texto — o
// alvo existia na árvore e a busca não o via. Desmontar à mão não bastou; a ordem bastou. Se um
// dia isto for preciso no meio, o caminho é isolar num ficheiro, como a guia já faz.
//
// ⚠️ TESTADO AQUI, E NÃO DENTRO DO EDITOR. Montado lá, o estado que a espera produz não chega ao
// `render` do teste — o `setGerando` do meio de um `await` fica preso fora do `act` —, e a
// asserção media o momento errado. O editor garante a ORDEM (gera, e só então sai); esta tela
// garante o que se vê.

const nada = () => {};

describe('FecharComGuia', () => {
  it('não desenha nada quando não há pergunta nem espera', async () => {
    const tela = await render(
      <FecharComGuia gerando={null} perguntando={false} aoGerar={nada} aoSair={nada} aoFicar={nada} />,
    );
    expect(tela.queryByText('Gerar a guia antes de fechar?')).toBeNull();
    expect(tela.queryByText(/^Gerando a guia/)).toBeNull();
    tela.unmount();
  });

  it('a espera diz quanto já andou', async () => {
    const tela = await render(
      <FecharComGuia gerando={0.46} perguntando={false} aoGerar={nada} aoSair={nada} aoFicar={nada} />,
    );
    expect(tela.getByText('Gerando a guia… 46%')).toBeTruthy();
    // ⚠️ E POR QUE É QUE DEMORA. Sem esta linha, um minuto e meio numa tela que a pessoa pediu
    // para fechar parece o aplicativo pendurado — e quem acha que pendurou, fecha à força.
    expect(tela.getByText(/Pode demorar um bocado/)).toBeTruthy();
    tela.unmount();
  });

  // Antes do codificador vem a soma das faixas, que não sabe dizer quanto falta. Um "0%" parado
  // durante ela é o mesmo que reticências paradas.
  it('sem conta ainda, é só o texto', async () => {
    const tela = await render(
      <FecharComGuia gerando={NaN} perguntando={false} aoGerar={nada} aoSair={nada} aoFicar={nada} />,
    );
    expect(tela.getByText('Gerando a guia…')).toBeTruthy();
    tela.unmount();
  });

  // A espera ganha da pergunta: quem já escolheu gerar não pode ver a pergunta por baixo.
  it('a espera cobre a pergunta', async () => {
    const tela = await render(
      <FecharComGuia gerando={0} perguntando aoGerar={nada} aoSair={nada} aoFicar={nada} />,
    );
    expect(tela.queryByText('Gerar a guia antes de fechar?')).toBeNull();
    tela.unmount();
  });
  // ⚠️ TRÊS SAÍDAS, E NÃO DUAS. Gerar a guia custa um minuto e meio no aparelho: é o certo para
  // quem acabou de montar, e um roubo para quem entrou só para ouvir e mexeu num fader. E quem
  // abriu a pergunta sem querer tem de poder voltar ao que estava.
  it('a pergunta oferece gerar, só fechar, e ficar', async () => {
    const gerar = jest.fn();
    const sair = jest.fn();
    const ficar = jest.fn();
    const tela = await render(
      <FecharComGuia gerando={null} perguntando aoGerar={gerar} aoSair={sair} aoFicar={ficar} />,
    );

    expect(tela.getByText('Gerar a guia antes de fechar?')).toBeTruthy();
    // ⚠️ E DIZ O PREÇO DAS DUAS ESCOLHAS: sem isto, "só fechar" parece o botão rápido e
    // inofensivo, e a pessoa descobre na lista de Músicas que ficou com o áudio antigo.
    expect(tela.getByText(/a lista continua com o áudio anterior/)).toBeTruthy();

    fireEvent.press(tela.getByText('Gerar e fechar'));
    expect(gerar).toHaveBeenCalled();
    fireEvent.press(tela.getByText('Só fechar'));
    expect(sair).toHaveBeenCalled();
    fireEvent.press(tela.getByText('Cancelar'));
    expect(ficar).toHaveBeenCalled();

    // ⚠️ E TOCAR FORA DA CAIXA, que é o primeiro gesto que toda a gente tenta e o único sem um
    // botão a anunciá-lo. O véu é o primeiro da árvore: a caixa está dentro dele. Fica aqui, e
    // não num caso próprio, pela mesma razão da nota do topo — um segundo `Modal` neste ficheiro
    // não chega a ser procurável.
    fireEvent.press(tela.getAllByLabelText('Cancelar')[0]);
    expect(ficar).toHaveBeenCalledTimes(2);

    // ⚠️ DESMONTADO À MÃO. O `Modal` desta pergunta sobrevive à limpeza automática entre casos,
    // e o caso seguinte procurava o texto dele numa árvore que ainda tinha esta por cima.
    tela.unmount();
  });
});
