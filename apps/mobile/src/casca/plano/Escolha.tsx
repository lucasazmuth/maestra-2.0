import { Pressable, StyleSheet, Text } from 'react-native';

import { COR_PLANO } from '@maestra/core/constants/design';

// A `Escolha` que morava aqui virou primitiva: `casca/Escolha`. Ela nunca foi do plano — o
// checkout tinha a própria cópia dela.

/** O chip cinza da categoria e o do prazo — os dois pílulas de 26px que a web desenha na linha. */
export const Chip = ({ texto, tom, aoTocar, rotulo }: {
  texto: string;
  tom: 'categoria' | 'prazo';
  aoTocar?: () => void;
  rotulo: string;
}) => (
  <Pressable
    style={[estilos.chip, tom === 'prazo' ? estilos.chipDePrazo : estilos.chipDeCategoria]}
    onPress={aoTocar}
    disabled={!aoTocar}
    accessibilityRole="button"
    accessibilityLabel={rotulo}
  >
    <Text
      style={[estilos.chipTexto, tom === 'prazo' ? estilos.textoDePrazo : estilos.textoDeCategoria]}
      numberOfLines={1}
    >
      {texto}
    </Text>
  </Pressable>
);

const estilos = StyleSheet.create({
  chip: {
    minHeight: 26, paddingHorizontal: 9, justifyContent: 'center',
    borderRadius: 7,
  },
  chipDeCategoria: {
    backgroundColor: COR_PLANO.chipFundo,
    borderWidth: 1, borderColor: COR_PLANO.chipContorno,
  },
  // O prazo NÃO tem contorno: é a diferença que separa "o que a tarefa é" de "quando ela vence".
  chipDePrazo: { backgroundColor: COR_PLANO.prazoFundo },
  chipTexto: { fontSize: 10.5, fontWeight: '800' },
  textoDeCategoria: { color: COR_PLANO.chipTexto },
  textoDePrazo: { color: COR_PLANO.prazoTexto },
});
