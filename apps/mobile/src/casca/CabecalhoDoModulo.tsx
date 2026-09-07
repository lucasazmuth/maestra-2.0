import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COR_CABECALHO_DE_MODULO } from '@maestra/core/constants/design';

// O CABEÇALHO DE PÁGINA dos módulos do artista — um só, para todos.
//
// Cada módulo tinha o seu: título 27 num, 30 noutro; espaçamento de letra só num deles; a
// descrição com entrelinha 18 aqui e 19 ali; e paletas diferentes para a mesma coisa. Nada
// disso se percebe olhando uma tela de cada vez, e todas juntas dão a impressão de telas
// escritas por gente diferente — que é exatamente o que eram.
//
// O KICKER SAIU. Ele dizia "MÚSICAS DO ARTISTA" acima de "Músicas", "TIME DO ARTISTA" acima de
// "Equipe": uma linha para repetir a de baixo, num aparelho onde a altura é o recurso escasso.
// E a aba acesa lá embaixo já diz em que módulo se está.
//
// A `nota` é o único lugar para o que o módulo tem de particular — hoje só a contagem do limite
// do plano, nas Músicas. Ela é uma LINHA, não uma faixa com botão ao lado: criar virou o botão
// flutuante.

/**
 * O espaço entre o fio do cabeçalho e o que vem abaixo dele.
 *
 * Ele NÃO mora dentro do componente, e a razão é chata mas decide o desenho: cada tela conduz
 * esse espaço numa propriedade diferente — as Músicas no recuo das abas, o Plano na margem do
 * bloco, a Equipe na margem da lista, e o Diagnóstico no `gap` da pilha de cartões. Uma margem
 * no componente SOMARIA com a do `gap`, e o Diagnóstico voltaria a ser o diferente.
 *
 * Então o número mora aqui, exportado, e cada tela o aplica onde faz sentido para ela. É uma
 * linha a mais em quatro arquivos, e um valor só para mudar.
 */
export const FOLGA_APOS_O_CABECALHO = 20;

export const CabecalhoDoModulo = ({ chapeu, titulo, descricao, nota, acao }: {
  /** A linha curta acima do título, em caixa alta. Opcional: só o Diagnóstico REAL usa. */
  chapeu?: string;
  titulo: string;
  descricao: string;
  nota?: string;
  /** Um controle à direita do título — hoje, o "refazer" do diagnóstico. */
  acao?: ReactNode;
}) => (
  <View style={estilos.cabecalho}>
    {!!chapeu && <Text style={estilos.chapeu}>{chapeu}</Text>}
    <View style={estilos.linhaDoTitulo}>
      <Text style={[estilos.titulo, estilos.flex]}>{titulo}</Text>
      {acao}
    </View>
    <Text style={estilos.descricao}>{descricao}</Text>
    {!!nota && <Text style={estilos.nota}>{nota}</Text>}
  </View>
);

const estilos = StyleSheet.create({
  // Sem recuo lateral: quem chama já vive dentro do seu (a lista de músicas tem 16, a equipe
  // 14). Daqui sai só o ritmo vertical e o fio que separa o cabeçalho do conteúdo.
  //
  // O RECUO DE CIMA É TODO DAQUI, e quem chama não acrescenta nada. Era o contrário: cada tela
  // somava o seu ao daqui, e o título nascia a 12 nas Músicas, 24 no Diagnóstico, 30 na Equipe
  // e 36 no Plano. Ninguém escreveu quatro números diferentes de propósito — eles se somaram
  // sem que nada dissesse que estavam se somando.
  cabecalho: {
    paddingTop: 22, paddingBottom: 26,
    borderBottomWidth: 1, borderBottomColor: COR_CABECALHO_DE_MODULO.fio,
  },
  chapeu: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase',
    color: COR_CABECALHO_DE_MODULO.rotulo, marginBottom: 6,
  },
  linhaDoTitulo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  titulo: {
    fontSize: 30, fontWeight: '800', letterSpacing: -0.75,
    color: COR_CABECALHO_DE_MODULO.titulo,
  },
  descricao: {
    fontSize: 12, lineHeight: 19, marginTop: 9, color: COR_CABECALHO_DE_MODULO.apoio,
  },
  nota: {
    fontSize: 12, fontWeight: '700', marginTop: 12, color: COR_CABECALHO_DE_MODULO.rotulo,
  },
});
