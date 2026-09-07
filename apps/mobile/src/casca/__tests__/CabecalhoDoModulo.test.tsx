import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CabecalhoDoModulo, FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';

import fs from 'fs';
import path from 'path';

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

  // O espaço DEPOIS do fio não pode morar no componente: cada tela o conduz numa propriedade
  // diferente (o recuo das abas, a margem da lista, o `gap` da pilha de cartões), e uma margem
  // aqui somaria com a do `gap`. Então o número mora aqui exportado — e este teste é o que
  // garante que ninguém volte a digitar um valor solto no lugar dele.
  describe('a folga depois do fio', () => {
    const TELAS = [
      'app/artista/[id]/catalogo.tsx',
      'app/artista/[id]/plano.tsx',
      'app/artista/[id]/equipe.tsx',
      'app/desbloquear/[id].tsx',
    ];

    it.each(TELAS)('%s usa a constante, e não um número solto', (tela) => {
      const fonte = fs.readFileSync(path.join(__dirname, '..', '..', tela), 'utf8');
      expect(fonte).toContain('FOLGA_APOS_O_CABECALHO');
    });

    // O diagnóstico é a exceção, e por um motivo: ele aparece em TRÊS telas (fim da criação,
    // desbloqueio e o módulo dentro do perfil). Enquanto cada moldura decidia o espaçamento,
    // o mesmo documento saía com os cartões grudados numa e respirando na outra. A folga passou
    // para dentro do `Relatorio`, e é lá que ela tem que estar — as três não podem mais divergir.
    it('o relatório do diagnóstico carrega a própria folga, para as três telas não divergirem', () => {
      const relatorio = fs.readFileSync(
        path.join(__dirname, '..', 'diagnostico', 'Relatorio.tsx'), 'utf8',
      );
      expect(relatorio).toContain('FOLGA_APOS_O_CABECALHO');
      expect(relatorio).toMatch(/pilha: \{ gap: FOLGA_APOS_O_CABECALHO \}/);
    });

    // Nenhuma das três pode voltar a impor um ritmo próprio ao relatório.
    it.each([
      'app/artista/[id]/diagnostico.tsx',
      'app/criar-artista.tsx',
    ])('%s não redefine o espaçamento do relatório', (tela) => {
      const fonte = fs.readFileSync(path.join(__dirname, '..', '..', tela), 'utf8');
      expect(fonte).not.toMatch(/conteudo:[^}]*gap:/);
    });

    it('é um valor só', () => {
      expect(FOLGA_APOS_O_CABECALHO).toBe(20);
    });
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
