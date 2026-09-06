import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_ENTRADA } from '@maestra/core/constants/design';

// A caixa de marcar dos aceites legais.
//
// O React Native não tem checkbox nativo, e as das bibliotecas vêm com a aparência do sistema —
// que nas duas plataformas é diferente da nossa. Esta é a mesma das telas de cadastro e de
// consentimento, que pedem as mesmas coisas.

export const CaixaDeAceite = ({ marcada, texto, aoTocar }: {
  marcada: boolean;
  texto: React.ReactNode;
  aoTocar: () => void;
}) => (
  <Pressable
    style={estilos.linha}
    onPress={aoTocar}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: marcada }}
  >
    <View style={[estilos.caixa, marcada && estilos.marcada]}>
      {marcada && <Feather name="check" size={13} color={COR.sobrePrimaria} />}
    </View>
    <Text style={estilos.texto}>{texto}</Text>
  </Pressable>
);

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6 },
  caixa: {
    width: 20, height: 20, borderRadius: 5, marginTop: 1,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_ENTRADA.campoContorno, backgroundColor: COR_ENTRADA.campoFundo,
  },
  marcada: { backgroundColor: COR.primaria, borderColor: COR.primaria },
  texto: { flex: 1, fontSize: 13, lineHeight: 19, color: COR_ENTRADA.apoio },
});
