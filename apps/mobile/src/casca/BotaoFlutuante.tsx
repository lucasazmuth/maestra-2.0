import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO, SOMBRA } from '@maestra/core/constants/design';

import { ALTURA_DA_ILHA, rodapeDaIlha } from '@/casca/BarraDeAbas';

// O botão de CRIAR, flutuando no canto de baixo à direita.
//
// Ele vivia dentro do cabeçalho de cada módulo, ao lado do título. Ali ele sai da tela no
// primeiro rolar — e é justamente quando a pessoa está olhando a lista que ela decide
// acrescentar algo. Flutuando, ele está sempre ao alcance do polegar, que é onde a mão já está.
//
// A POSIÇÃO É DERIVADA da ilha de navegação, e não escrita à mão: `rodapeDaIlha` e
// `ALTURA_DA_ILHA` são as mesmas medidas que a barra de abas usa. Um número solto aqui ficaria
// certo hoje e sobreposto à ilha no dia em que ela mudasse de altura.

/** A folga entre a ilha e o botão. */
const FOLGA = 14;

export const BotaoFlutuante = ({ rotulo, aoTocar, acimaDe = 0, semIlha = false }: {
  rotulo: string;
  aoTocar: () => void;
  /**
   * O topo de algo que já ocupa esse canto e que o botão precisa vencer.
   *
   * Só o catálogo passa isto, e só quando o player está aberto: a barra dele nasce ACIMA da
   * ilha, no mesmo canto de baixo à direita, e o botão ficava por cima — cobrindo o "próxima
   * faixa". Quem sabe onde o player está é a tela que o desenha, então a medida vem de lá em
   * vez de este arquivo passar a conhecer o player.
   */
  acimaDe?: number;
  /**
   * A tela não tem a ilha de navegação embaixo.
   *
   * Só o Espaço JAM passa isto: ele mora fora das abas do artista (é uma tela da pilha da
   * raiz, sem barra), e é a única tela fora das abas que CRIA coisas. Sem esta prop o botão
   * reservaria os 78 pt de uma ilha que não está lá, e flutuaria a meio caminho do rodapé.
   */
  semIlha?: boolean;
}) => {
  const margem = useSafeAreaInsets();
  const chao = semIlha
    ? Math.max(margem.bottom, 14)
    : rodapeDaIlha(margem.bottom) + ALTURA_DA_ILHA;
  const debaixo = Math.max(chao + FOLGA, acimaDe + FOLGA);

  return (
    <View style={[estilos.ancora, { bottom: debaixo }]} pointerEvents="box-none">
      <Pressable
        style={estilos.botao}
        onPress={aoTocar}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
      >
        <Feather name="plus" size={26} color={COR.sobrePrimaria} />
      </Pressable>
    </View>
  );
};

const estilos = StyleSheet.create({
  // `box-none` na âncora: ela ocupa a largura toda para encostar o botão à direita, e sem isso
  // engoliria os toques da lista atrás dela.
  ancora: { position: 'absolute', right: 22, left: 22, alignItems: 'flex-end' },
  botao: {
    width: 56, height: 56, borderRadius: RAIO.pilula,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.primaria,
    ...SOMBRA.celulaAtiva,
  },
});
