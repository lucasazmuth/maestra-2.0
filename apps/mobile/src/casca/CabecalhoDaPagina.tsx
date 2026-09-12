import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COR_CABECALHO_DE_APOIO } from '@maestra/core/constants/design';

import { CabecalhoDeVolta } from '@/casca/CabecalhoDeVolta';

// O CABEÇALHO DAS PÁGINAS DE APOIO — um só, para todas.
//
// São as telas FOLHA do usuário: Notificações, Histórico de pagamentos, Suporte, Termos e
// Política. Entra-se nelas por um caminho, lê-se, e volta-se. O desenho é o mesmo: o botão
// redondo de voltar (o mesmo círculo branco do sino, que é o controle que a plataforma já tem),
// um sobretítulo que diz de onde a página é, o título grande, e às vezes uma linha de apoio.
//
// ⚠️ ELE ESTAVA A SER ESCRITO À MÃO EM CADA TELA, e é assim que se chega a cinco desenhos com o
// mesmo nome. Já aconteceu neste app do lado dos módulos do artista, e o `CabecalhoDoModulo`
// existe por causa disso — o comentário dele diz como era: "título 27 num, 30 noutro;
// espaçamento de letra só num deles... todas juntas dão a impressão de telas escritas por gente
// diferente, que é exatamente o que eram".
//
// A divergência já tinha começado aqui: o sobretítulo do Histórico estava a 9 e o das
// Notificações a 10, e as duas usavam paletas diferentes para a mesma linha.
//
// ⚠️ E ELE É IRMÃO do `CabecalhoDoModulo`, não uma variante: lá o sobretítulo SAIU de propósito
// ("MÚSICAS DO ARTISTA" acima de "Músicas" é uma linha para repetir a de baixo, e a aba acesa já
// diz onde se está). Aqui ele fica, porque estas telas não têm aba nenhuma a dizer de onde são.

export const CabecalhoDaPagina = ({
  sobretitulo, titulo, apoio, acao, para,
}: {
  /** De onde a página é: "CENTRAL DO USUÁRIO", "AJUDA". Em maiúsculas. */
  sobretitulo: string;
  titulo: string;
  /** A linha que explica a página, quando ela precisa de uma. */
  apoio?: string;
  /** A ação da página, à direita do título — "Marcar todas como lidas". */
  acao?: ReactNode;
  /** Para onde voltar quando a pilha está vazia (link direto, notificação tocada). */
  para?: string;
}) => (
  <>
    <CabecalhoDeVolta para={para} />
    <View style={estilos.cabecalho}>
      <Text style={estilos.sobretitulo}>{sobretitulo}</Text>
      {/* ⚠️ ALINHADOS PELA BASE, e não ao centro: o título tem 27 e a ação 13, e centrados a
          ação flutuava a meio da altura do título em vez de assentar na mesma linha. */}
      <View style={estilos.linhaDoTitulo}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {acao}
      </View>
      {!!apoio && <Text style={estilos.apoio}>{apoio}</Text>}
    </View>
  </>
);

const estilos = StyleSheet.create({
  cabecalho: { paddingHorizontal: 18, paddingTop: 8, gap: 2 },
  sobretitulo: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 9,
    color: COR_CABECALHO_DE_APOIO.sobretitulo,
  },
  linhaDoTitulo: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
  },
  // `flexShrink` para o título CEDER à ação: sem ele, "Histórico de pagamentos" empurrava o que
  // estivesse à direita para fora da tela em vez de quebrar a linha.
  titulo: { flexShrink: 1, fontSize: 27, fontWeight: '800', color: COR_CABECALHO_DE_APOIO.titulo },
  apoio: { fontSize: 13, lineHeight: 20, color: COR_CABECALHO_DE_APOIO.apoio, marginTop: 9 },
});
