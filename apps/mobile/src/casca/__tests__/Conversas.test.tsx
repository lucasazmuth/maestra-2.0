import { render, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { Conversas } from '@/casca/nyta/Conversas';

// Excluir uma conversa apaga as mensagens junto, por ON DELETE CASCADE. A confirmação é a única
// barreira entre um toque errado e um histórico perdido — e é ela que este arquivo guarda.
//
// Na web isso é um `Popconfirm` do antd; aqui é o `Alert` do sistema. O que precisa continuar
// igual não é o widget, é a ordem: nada some antes de alguém dizer "Excluir".

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const CONVERSA = {
  id: 'c-1', title: 'Lançamento do single', updatedAt: '2026-08-29T09:00:00', userId: 'u-1',
};

/** Aperta um botão do `Alert` pelo texto, como quem toca na caixa do sistema. */
const apertarNoAlerta = (chamada: jest.Mock, texto: string) => {
  const botoes = chamada.mock.calls[chamada.mock.calls.length - 1][2] as
    { text: string; onPress?: () => void }[];
  const botao = botoes.find((b) => b.text === texto);
  expect(botao).toBeTruthy();
  botao!.onPress?.();
};

const montar = (props: Partial<Parameters<typeof Conversas>[0]> = {}) => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}>
    <Conversas
      conversas={[CONVERSA]}
      carregando={false}
      ativa={null}
      aoEscolher={jest.fn()}
      aoCriar={jest.fn()}
      aoRenomear={jest.fn()}
      aoExcluir={jest.fn()}
      aoSair={jest.fn()}
      {...props}
    />
  </SafeAreaProvider>,
);

describe('lista de conversas', () => {
  let alerta: jest.SpyInstance;

  beforeEach(() => { alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
  afterEach(() => { alerta.mockRestore(); });

  it('excluir só acontece depois da confirmação', async () => {
    const aoExcluir = jest.fn();
    const tela = await montar({ aoExcluir });
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText(`Ações da conversa ${CONVERSA.title}`));
    apertarNoAlerta(alerta as unknown as jest.Mock, 'Excluir');

    // Ainda não: o primeiro "Excluir" só arma a confirmação.
    expect(aoExcluir).not.toHaveBeenCalled();
    expect(alerta).toHaveBeenLastCalledWith(
      'Excluir conversa?',
      'As mensagens desta conversa serão apagadas.',
      expect.anything(),
    );

    apertarNoAlerta(alerta as unknown as jest.Mock, 'Excluir');
    expect(aoExcluir).toHaveBeenCalledWith('c-1');
  });

  it('cancelar na confirmação não apaga nada', async () => {
    const aoExcluir = jest.fn();
    const tela = await montar({ aoExcluir });
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText(`Ações da conversa ${CONVERSA.title}`));
    apertarNoAlerta(alerta as unknown as jest.Mock, 'Excluir');
    apertarNoAlerta(alerta as unknown as jest.Mock, 'Cancelar');

    expect(aoExcluir).not.toHaveBeenCalled();
  });

  it('renomear troca a linha por um campo e grava o nome novo', async () => {
    const aoRenomear = jest.fn();
    const tela = await montar({ aoRenomear });
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText(`Ações da conversa ${CONVERSA.title}`));
    apertarNoAlerta(alerta as unknown as jest.Mock, 'Renomear');

    const campo = await tela.findByLabelText('Nome da conversa');
    // O campo já vem com o nome atual: renomear quase sempre é ajustar, não recomeçar.
    expect(campo.props.value).toBe(CONVERSA.title);

    // Sem `clear` de propósito: ele tira o foco do campo, e sair do campo É concluir a edição —
    // a linha fechava antes de o teste digitar qualquer coisa.
    await usuario.type(campo, ' 2026', { submitEditing: true });

    expect(aoRenomear).toHaveBeenCalledWith('c-1', `${CONVERSA.title} 2026`);
    // A linha volta ao normal depois de gravar.
    expect(tela.queryByLabelText('Nome da conversa')).toBeNull();
  });

  // Nome vazio apagaria o título sem que ninguém tenha pedido isso — apagar tudo e sair é
  // desistir de renomear, não renomear para nada. (`clear` do userEvent apaga e sai do campo,
  // que é exatamente esse gesto.)
  it('nome em branco não vira o novo título', async () => {
    const aoRenomear = jest.fn();
    const tela = await montar({ aoRenomear });
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText(`Ações da conversa ${CONVERSA.title}`));
    apertarNoAlerta(alerta as unknown as jest.Mock, 'Renomear');

    const campo = await tela.findByLabelText('Nome da conversa');
    console.log('INICIAL', JSON.stringify(campo.props.value));
    await usuario.clear(campo);
    await usuario.type(campo, '   ', { submitEditing: true });

    expect(aoRenomear).not.toHaveBeenCalled();
  });
});
