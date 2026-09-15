import { Pressable, StyleSheet, Text } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PAINEL } from '@maestra/core/constants/design';

// Um cartão do rodapé da home: Suporte, Avaliar, Termos.
//
// Os três LEVAM a algum lugar. Antes o rodapé eram dois cartões informativos ("Dados seguros",
// "Novidades da indústria") que não faziam nada, e a pessoa tocava neles à espera de que fizessem.

export function CartaoDeInformacao({
  icone, titulo, texto, aoTocar,
}: {
  icone: 'life-buoy' | 'star' | 'file-text';
  titulo: string;
  texto: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={titulo}
    >
      <Feather name={icone} size={22} color={COR_PAINEL.rodapeIcone} />
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilos.texto}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { padding: 22, borderRadius: 9, backgroundColor: COR.superficie },
  pressionado: { opacity: 0.85 },
  titulo: { marginTop: 14, marginBottom: 7, color: COR_PAINEL.rodapeTitulo, fontSize: 13, fontWeight: '700' },
  texto: { color: COR_PAINEL.rodapeTexto, fontSize: 11, lineHeight: 17 },
});

export default CartaoDeInformacao;
