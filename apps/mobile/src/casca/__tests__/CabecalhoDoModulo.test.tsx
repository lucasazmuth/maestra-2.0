import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CabecalhoDoModulo } from '@/casca/CabecalhoDoModulo';

// O cabeçalho de página dos módulos do artista. Um só, para todos.
//
// Cada módulo tinha o seu, com título 27 num e 30 noutro, entrelinha 18 aqui e 19 ali. Nada
// disso se percebe uma tela por vez; todas juntas dão a impressão de telas escritas por gente
// diferente. O teste guarda o que ficou combinado.

describe('cabeçalho do módulo', () => {
  it('mostra título e descrição', async () => {
    const tela = await render(
      <CabecalhoDoModulo titulo="Músicas" descricao="Organize as músicas." />,
    );

    expect(tela.getByText('Músicas')).toBeTruthy();
    expect(tela.getByText('Organize as músicas.')).toBeTruthy();
  });

  // Ele dizia "MÚSICAS DO ARTISTA" acima de "Músicas": uma linha para repetir a de baixo, num
  // aparelho onde a altura é o recurso escasso. A aba acesa já diz em que módulo se está.
  it('não tem kicker', async () => {
    const tela = await render(
      <CabecalhoDoModulo titulo="Equipe" descricao="Gerencie quem participa." />,
    );

    expect(tela.queryByText(/DO ARTISTA/)).toBeNull();
    expect(tela.queryByText(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{6,}$/)).toBeNull();
  });

  // A nota é o único lugar do que o módulo tem de particular — hoje só o limite do plano.
  it('a nota só aparece quando existe', async () => {
    const sem = await render(<CabecalhoDoModulo titulo="Equipe" descricao="Gerencie." />);
    expect(sem.queryByText(/músicas/)).toBeNull();

    const com = await render(
      <CabecalhoDoModulo titulo="Músicas" descricao="Organize." nota="5/10 músicas" />,
    );
    expect(com.getByText('5/10 músicas')).toBeTruthy();
  });

  // O recuo de cima é TODO daqui. Era o contrário: cada tela somava o seu ao daqui, e o título
  // nascia a 12 nas Músicas, 24 no Diagnóstico, 30 na Equipe e 36 no Plano — quatro números que
  // ninguém escolheu, porque se somaram sem que nada dissesse que estavam se somando.
  it('é o dono do espaço até a barra do topo', async () => {
    const tela = await render(<CabecalhoDoModulo titulo="Músicas" descricao="Organize." />);
    const cabecalho = tela.getByText('Músicas').parent!;

    expect((StyleSheet.flatten(cabecalho.props.style) as { paddingTop?: number }).paddingTop)
      .toBe(22);
  });

  it('o título é o mesmo em qualquer módulo', async () => {
    const musicas = await render(<CabecalhoDoModulo titulo="Músicas" descricao="A." />);
    const equipe = await render(<CabecalhoDoModulo titulo="Equipe" descricao="B." />);

    const estilo = (tela: typeof musicas, texto: string) =>
      StyleSheet.flatten(tela.getByText(texto).props.style) as { fontSize?: number };

    expect(estilo(musicas, 'Músicas').fontSize).toBe(30);
    expect(estilo(equipe, 'Equipe').fontSize).toBe(30);
  });
});
