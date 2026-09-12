import { render, screen, fireEvent } from '@testing-library/react';

import { CamposDaFicha, CamposDosSplits } from '../components/ficha/campos';
import { CLASSES_DA_OBRA, CLASSES_DO_FONOGRAMA } from '@maestra/core/constants/maestra';

// A FICHA FALA A LÍNGUA DAS ASSOCIAÇÕES.
//
// Quem preenche isto aqui vai preencher o mesmo cadastro na UBC e no ECAD. Lá não há "nome",
// "função" nem "participante": há TITULAR, CLASSE e % PARTIC., e os titulares vêm em dois
// corpos separados — o da OBRA (quem escreveu, quem edita) e o do FONOGRAMA (quem gravou,
// tocou, produziu). Traduzir isso para palavras nossas obriga a pessoa a traduzir de volta na
// hora de registar, e é aí que troca a coluna e assina um split errado.
//
// Estes testes prendem o vocabulário e, sobretudo, prendem a separação: um `SplitEditor` que
// recebesse a mesma lista de classes nos dois corpos ofereceria "Intérprete" numa obra.

const semNada = () => {};

/** Um titular em cada corpo — as colunas só aparecem quando há linha para elas. */
const COM_UM_DE_CADA = {
  composition_splits: [{ id: 'a', name: 'Ana', role: '', percentage: 50 }],
  recording_splits: [{ id: 'b', name: 'Bia', role: '', percentage: 50 }],
};

const montarSplits = (draft: object = COM_UM_DE_CADA) => {
  const set = jest.fn();
  render(<CamposDosSplits draft={draft} set={set} />);
  return set;
};

/**
 * Abre a lista de classes de um dos corpos.
 *
 * Pelo bloco, e não pelo rótulo do campo: os dois corpos rotulam o primeiro titular do mesmo
 * jeito ("Classe do titular 1"), que é o certo — cada bloco se lê sozinho. E quem escuta o
 * clique num `Select` do antd é o invólucro, não o campo em si.
 */
const abrirClasse = (corpo: 'Obra' | 'Fonograma') => {
  const secao = screen.getByText(corpo).closest('.splitSection')!;
  fireEvent.mouseDown(secao.querySelector('.ant-select-selector')!);
};

describe('os splits falam como a UBC e o ECAD', () => {
  it('os dois corpos são a obra e o fonograma, com as colunas deles', () => {
    montarSplits();

    expect(screen.getByText('Obra')).toBeInTheDocument();
    expect(screen.getByText('Fonograma')).toBeInTheDocument();
    expect(screen.getAllByText('Titular')).toHaveLength(2);
    expect(screen.getAllByText('Classe')).toHaveLength(2);
    expect(screen.getAllByText('% Partic.')).toHaveLength(2);
    expect(screen.getAllByText('+ Adicionar titular')).toHaveLength(2);
  });

  it('o corpo vazio diz que está vazio', () => {
    montarSplits({});
    expect(screen.getAllByText('Nenhum titular adicionado.')).toHaveLength(2);
  });

  // Os dois testes que matam a mutação óbvia: passar a MESMA lista de classes aos dois blocos.
  // Um render por corpo — dois `Select` abertos ao mesmo tempo disputam o foco e o segundo
  // nunca chega a abrir.
  it('a obra oferece quem escreve, e não quem canta', () => {
    montarSplits();
    abrirClasse('Obra');

    expect(screen.getByTitle('Compositor/Autor')).toBeInTheDocument();
    expect(screen.queryByTitle('Intérprete')).toBeNull();
  });

  it('o fonograma oferece quem grava, e não quem escreve', () => {
    montarSplits();
    abrirClasse('Fonograma');

    expect(screen.getByTitle('Intérprete')).toBeInTheDocument();
    expect(screen.queryByTitle('Compositor/Autor')).toBeNull();
  });

  it('as duas listas de classes não se misturam', () => {
    expect(CLASSES_DA_OBRA).not.toContain('Intérprete');
    expect(CLASSES_DO_FONOGRAMA).not.toContain('Compositor/Autor');
  });
});

describe('detalhes: o campo que não tem forma', () => {
  it('escreve no rascunho o que a pessoa digita', () => {
    const set = jest.fn();
    render(
      <CamposDaFicha
        draft={{ title: 'Vento sul' }}
        set={set}
        genres={[]}
        assigneeOptions={[]}
        uploading={null}
        aoEnviarCapa={semNada}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Observações sobre a música/), {
      target: { value: 'A editora confirma o split por e-mail' },
    });

    expect(set).toHaveBeenCalledWith({ details: 'A editora confirma o split por e-mail' });
  });
});

// ─── O DESENHO DO FORMULÁRIO ──────────────────────────────────────────────────

/** A ficha inteira, com o mínimo que ela precisa para se desenhar. */
const montarFicha = () => render(
  <CamposDaFicha
    draft={{ title: 'Vento sul' }}
    set={semNada}
    genres={[]}
    assigneeOptions={[{ id: 'u1', name: 'Ana' }]}
    uploading={null}
    aoEnviarCapa={semNada}
  />,
);

/**
 * O campo cujo rótulo é este — a etiqueta inteira, e não só o texto do rótulo.
 *
 * ⚠️ PELO RÓTULO DO CAMPO, e não por qualquer texto igual: o `Select` do status repete a
 * palavra "Status" dentro dele como texto de vazio, e uma busca solta encontrava os dois.
 */
const campoChamado = (rotulo: string) => {
  const etiqueta = screen.getAllByText(rotulo)
    .map((no) => no.closest('label'))
    .find((no) => no?.firstElementChild?.textContent === rotulo);
  if (!etiqueta) throw new Error(`Não há campo rotulado "${rotulo}".`);
  return etiqueta;
};

describe('o desenho do formulário', () => {
  // Sozinhos, os dois ocupavam 710 px cada um para guardar um nome curto e uma data — duas
  // faixas largas e quase vazias entre blocos que usam a largura toda. Emparelhados, leem-se
  // como o par que já estava logo acima: status e gênero.
  it('responsável e data de lançamento dividem a mesma linha, como status e gênero', () => {
    montarFicha();

    const par = campoChamado('Responsável').parentElement;
    expect(par).toBe(campoChamado('Data de lançamento').parentElement);
    // ⚠️ E É A GRADE, e não um `div` qualquer: dois irmãos dentro de um bloco empilhado
    // continuariam um debaixo do outro, e o teste passaria a dizer que estão lado a lado.
    expect(par).toHaveClass('fieldGrid');
    // O par de cima é o mesmo desenho — é dele que este veio.
    expect(campoChamado('Status').parentElement).toHaveClass('fieldGrid');
  });

  // ⚠️ BPM E TOM NÃO SÃO DA FICHA. Eles são da GRAVAÇÃO, e o rodapé do editor já os mostra e os
  // grava — na mesma coluna do banco. Duas caixas para o mesmo número não eram só repetição:
  // o rascunho da ficha só recarrega ao trocar de gravação, e escrever no rodapé e depois
  // tocar em qualquer campo daqui mandava o valor velho por cima do novo.
  it('não oferece andamento nem tom', () => {
    montarFicha();

    expect(screen.queryByText('BPM')).not.toBeInTheDocument();
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
    // Os vizinhos de linha continuam lá: o que saiu foi o par, e não a fila inteira.
    expect(campoChamado('ISRC')).toBeInTheDocument();
    expect(campoChamado('UPC')).toBeInTheDocument();
  });
});
