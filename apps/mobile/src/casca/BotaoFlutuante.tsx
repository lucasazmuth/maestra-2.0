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

export const BotaoFlutuante = ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => {
  const margem = useSafeAreaInsets();
  const debaixo = rodapeDaIlha(margem.bottom) + ALTURA_DA_ILHA + FOLGA;

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
