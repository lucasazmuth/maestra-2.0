import { render, screen, fireEvent, within } from '@testing-library/react';

import { Biblioteca } from '../pages/Catalog/daw/Biblioteca';

// A BIBLIOTECA COMO GAVETA, no telemóvel.
//
// Como coluna, no desktop, ela funciona por ARRASTO: pega-se um ficheiro e larga-se sobre uma
// faixa. Como gaveta, esse gesto deixa de existir por duas razões ao mesmo tempo — o dedo não
// arrasta entre janelas, e a gaveta TAPA as faixas para onde se arrastaria.
//
// O que sobrava era uma lista de nomes que não respondia a toque nenhum, debaixo de uma frase
// a mandar arrastar. A pessoa tocava no ficheiro, não acontecia nada, e a única saída era
// fechar a gaveta à mão para descobrir que nada tinha acontecido mesmo.

const arquivo = (nome: string) => new File(['x'], nome, { type: 'audio/wav' });

const itens = [
  { id: '1', nome: 'Bateria.wav', tamanho: 1024 * 1024, arquivo: arquivo('Bateria.wav') },
  { id: '2', nome: 'Baixo.wav', tamanho: 2048 * 1024, arquivo: arquivo('Baixo.wav') },
];

const montar = (emGaveta: boolean) => {
  const aoEnviar = jest.fn();
  render(
    <Biblioteca
      itens={itens}
      aoAbrirPasta={() => {}}
      aoEnviar={aoEnviar}
      podeEditar
      emGaveta={emGaveta}
    />,
  );
  return aoEnviar;
};

describe('a biblioteca como gaveta', () => {
  it('tocar num ficheiro envia esse ficheiro', () => {
    const aoEnviar = montar(true);

    fireEvent.click(screen.getByRole('button', { name: /Enviar Bateria\.wav como pista/ }));

    expect(aoEnviar).toHaveBeenCalledTimes(1);
    // Só aquele, e não a lista toda: quem toca num nome está a escolher um.
    expect(aoEnviar.mock.calls[0][0]).toHaveLength(1);
    expect(aoEnviar.mock.calls[0][0][0].name).toBe('Bateria.wav');
  });

  it('o teclado faz o mesmo que o toque', () => {
    const aoEnviar = montar(true);
    const item = screen.getByRole('button', { name: /Enviar Baixo\.wav como pista/ });

    fireEvent.keyDown(item, { key: 'Enter' });
    expect(aoEnviar).toHaveBeenCalledTimes(1);
    expect(aoEnviar.mock.calls[0][0][0].name).toBe('Baixo.wav');
  });

  // ⚠️ A FRASE ERA MENTIRA na gaveta: "arraste para uma faixa" num painel que tapa as faixas
  // não descreve gesto nenhum.
  it('a instrução fala do gesto que existe ali', () => {
    montar(true);
    expect(screen.getByText(/Toque num arquivo/)).toBeInTheDocument();
    expect(screen.queryByText(/Arraste para uma faixa/)).not.toBeInTheDocument();
  });

  // 8 px de recuo davam 30 px de altura: abaixo de qualquer mínimo confortável para o dedo.
  it('o alvo do dedo tem pelo menos 44 px', () => {
    montar(true);
    const item = screen.getByRole('button', { name: /Enviar Bateria\.wav como pista/ });
    expect(item).toHaveStyle({ minHeight: '44px' });
  });
});

describe('a biblioteca como coluna (desktop)', () => {
  // O desktop continua a ser o que era: arrasta-se para a faixa, e é o arrasto que diz EM QUE
  // SEGUNDO o clipe entra — coisa que um toque não consegue dizer.
  it('o ficheiro é arrastável, e não um botão', () => {
    montar(false);

    // O "Enviar todos como pistas" continua a existir aqui — o que NÃO existe é cada ficheiro
    // virar um botão de envio individual.
    expect(screen.queryByRole('button', { name: /Enviar Bateria\.wav/ })).not.toBeInTheDocument();
    const lista = screen.getByRole('list');
    const primeiro = within(lista).getByText('Bateria.wav').closest('div');
    expect(primeiro).toHaveAttribute('draggable', 'true');
  });

  it('a instrução continua a ser a do arrasto', () => {
    montar(false);
    expect(screen.getByText(/Arraste para uma faixa/)).toBeInTheDocument();
  });
});
