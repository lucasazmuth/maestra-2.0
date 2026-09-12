import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CORES_DAS_PISTAS } from '@maestra/core/constants/design';
import type { CatalogClip } from '@maestra/core/interfaces/maestra';

import { Clipe } from '../Clipe';

// A BARRA DE AÇÕES DO CLIPE — e o seletor de cor que passou a viver nela.
//
// ⚠️ ESTE FICHEIRO NASCEU DE UM DEFEITO QUE NENHUM TESTE DE CÓDIGO-FONTE APANHAVA. O botão da
// cor estava lá, com o rótulo certo, a chamar `setPaletaAberta` — e não abria nada. O clipe
// inteiro tem um `onClick` que ALTERNA a seleção, e a barra vive DENTRO dele: o clique subia,
// o clipe largava a seleção, e a barra — com a paleta lá dentro — desaparecia no mesmo gesto.
// A paleta abria e fechava no mesmo instante. Ao olho, o botão simplesmente não fazia nada.
//
// O cromo só pode dizer que o botão está no sítio certo. Só um teste de comportamento pode
// dizer que carregar nele produz alguma coisa.

const umClipe = (over: Partial<CatalogClip> = {}): CatalogClip => ({
  id: 'c-1', track_id: 't-1', file_id: 'f-1',
  start_seconds: 0, offset_seconds: 0, duration_seconds: 30,
  ...over,
} as CatalogClip);

const montar = (over: Partial<React.ComponentProps<typeof Clipe>> = {}) => {
  const aoSelecionar = jest.fn();
  const aoPintar = jest.fn();
  const aoDuplicar = jest.fn();
  render(
    <Clipe
      clipe={umClipe()}
      indice={0}
      cor={CORES_DAS_PISTAS[1]}
      picos={[0.2, 0.8, 0.4]}
      escala={10}
      agulha={0}
      selecionado
      altura={96}
      indiceDaCor={1}
      aoSelecionar={aoSelecionar}
      aoArrastar={() => {}}
      aoCortar={() => {}}
      aoDuplicar={aoDuplicar}
      aoApagar={() => {}}
      aoPintar={aoPintar}
      {...over}
    />,
  );
  return { aoSelecionar, aoPintar, aoDuplicar };
};

describe('a barra de ações do clipe', () => {
  it('abre a paleta sem largar o clipe que a está a mostrar', async () => {
    const usuario = userEvent.setup();
    const { aoSelecionar } = montar();

    await usuario.click(screen.getByLabelText('Cor da faixa'));

    // ⚠️ AS DUAS METADES DA MESMA REGRA. A paleta tem de aparecer, E a seleção tem de ficar de
    // pé: era ela a cair que fazia a paleta desaparecer no instante em que nascia.
    expect(screen.getByRole('group', { name: 'Cores da faixa' })).toBeInTheDocument();
    expect(aoSelecionar).not.toHaveBeenCalled();
  });

  it('pintar manda o índice da cor e fecha a paleta, sem mexer na seleção', async () => {
    const usuario = userEvent.setup();
    const { aoPintar, aoSelecionar } = montar();

    await usuario.click(screen.getByLabelText('Cor da faixa'));
    await usuario.click(screen.getByLabelText('Turquesa'));

    // A sexta cor da paleta do núcleo: o que vai para a coluna `color_index` é o ÍNDICE, e não
    // o código da tinta — é ele que as duas superfícies leem para pintar.
    expect(aoPintar).toHaveBeenCalledWith(5);
    expect(screen.queryByRole('group', { name: 'Cores da faixa' })).not.toBeInTheDocument();
    expect(aoSelecionar).not.toHaveBeenCalled();
  });

  // Seis bolinhas iguais não dizem qual é a desta faixa: sem a marca, a pessoa carrega na que
  // já estava, nada muda, e o seletor parece quebrado.
  it('marca a cor que a faixa já tem', async () => {
    const usuario = userEvent.setup();
    montar({ indiceDaCor: 3 });

    await usuario.click(screen.getByLabelText('Cor da faixa'));

    expect(screen.getByLabelText('Âmbar')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Azul')).toHaveAttribute('aria-pressed', 'false');
  });

  // ⚠️ DUPLICAR FICA AO LADO DA TESOURA, e não no fim da fila. Cortar e duplicar são o mesmo
  // par de gestos de estrutura — partir uma coisa em duas, repetir uma coisa duas vezes — e quem
  // monta um arranjo alterna entre eles. A lixeira é a única da fila que destrói, e o vizinho
  // dela decide-se com mais cuidado do que a ordem de escrita do JSX.
  it('duplicar fica entre cortar e apagar, e chama quem repete', async () => {
    const usuario = userEvent.setup();
    const { aoDuplicar, aoSelecionar } = montar();

    const barra = screen.getByLabelText('Duplicar o clipe').parentElement!;
    expect(Array.from(barra.children, (b) => b.getAttribute('aria-label'))).toEqual([
      'Dividir o clipe na agulha', 'Duplicar o clipe', 'Remover o clipe', 'Cor da faixa',
    ]);

    await usuario.click(screen.getByLabelText('Duplicar o clipe'));
    expect(aoDuplicar).toHaveBeenCalledTimes(1);
    // ⚠️ E O CLIQUE NÃO SOBE — a regra é da BARRA, e não de cada botão. Este caso apanhou-a a
    // faltar: o `stopPropagation` vivia no botão da cor, e "duplicar" nasceu sem ele.
    expect(aoSelecionar).not.toHaveBeenCalled();
  });

  // ⚠️ A MIX NÃO SE PINTA, e não é arbitrário: ela não é uma faixa da montagem, é a gravação
  // inteira por montar. A barra toda não existe nela — nem tesoura, nem lixeira, nem cor.
  it('a Mix não oferece ações nenhumas', () => {
    montar({ fixo: true });

    expect(screen.queryByLabelText('Cor da faixa')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Duplicar o clipe')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remover o clipe')).not.toBeInTheDocument();
  });

  // Sem quem pinte (a faixa da Mix, ou uma gravação que esta pessoa só pode ver), o botão não
  // aparece: um alvo que não faz nada é pior do que a ausência dele.
  it('sem quem pinte, o botão não aparece — mas as outras ações ficam', () => {
    montar({ aoPintar: undefined });

    expect(screen.queryByLabelText('Cor da faixa')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Remover o clipe')).toBeInTheDocument();
  });
});
