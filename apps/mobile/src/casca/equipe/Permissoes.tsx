import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_EQUIPE, RAIO } from '@maestra/core/constants/design';
import { ACCESS_LEVEL_HINTS, MVP_ACCESS_LEVEL_OPTIONS } from '@maestra/core/constants/maestra';
import type { AccessLevel } from '@maestra/core/interfaces/maestra';

// Os cartões de acesso — o que a pessoa convidada vai poder abrir.
//
// São CAIXAS DE SELEÇÃO, não bolinhas: são várias escolhas ao mesmo tempo, e a bolinha diria o
// contrário. A web já corrigiu isso lá e a razão vale igual aqui.
//
// "Acesso completo" não é mais um módulo: marcá-lo limpa os outros, e escolher um módulo
// desmarca ele. Antes os cinco conviviam na mesma lista e dava para pedir "Músicas + Acesso
// completo", o que não quer dizer nada.

export const alternarAcesso = (
  atuais: AccessLevel[],
  nivel: AccessLevel,
): AccessLevel[] => {
  if (nivel === 'full') return atuais.includes('full') ? [] : ['full'];
  const semTudo = atuais.filter((item) => item !== 'full');
  return semTudo.includes(nivel)
    ? semTudo.filter((item) => item !== nivel)
    : [...semTudo, nivel];
};

export const Permissoes = ({ escolhidos, travado, aoMudar }: {
  escolhidos: AccessLevel[];
  travado?: boolean;
  aoMudar: (proximos: AccessLevel[]) => void;
}) => {
  const tudo = escolhidos.includes('full');

  const cartao = (id: AccessLevel, rotulo: string) => {
    // Com "Acesso completo" marcado, os módulos aparecem incluídos — e travados: o acesso já
    // os cobre, e desmarcar um deles não teria como significar nada.
    const marcado = id === 'full' ? tudo : tudo || escolhidos.includes(id);
    const inerte = travado || (tudo && id !== 'full');
    return (
      <Pressable
        key={id}
        style={[estilos.cartao, marcado && estilos.cartaoMarcado, inerte && estilos.cartaoInerte]}
        onPress={() => !inerte && aoMudar(alternarAcesso(escolhidos, id))}
        disabled={inerte}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcado, disabled: inerte }}
        accessibilityLabel={rotulo}
      >
        <View style={estilos.flex}>
          <Text style={[estilos.rotulo, marcado && estilos.rotuloMarcado]}>{rotulo}</Text>
          <Text style={estilos.apoio}>{ACCESS_LEVEL_HINTS[id]}</Text>
        </View>
        <View style={[estilos.caixa, marcado && estilos.caixaMarcada]}>
          {marcado && <Feather name="check" size={12} color={COR.superficie} />}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={estilos.grade}>
      {/* "Acesso completo" primeiro, como na web: é a decisão que dispensa as outras quatro. */}
      {cartao('full', 'Acesso completo')}
      {MVP_ACCESS_LEVEL_OPTIONS
        .filter((entrada) => entrada.id !== 'full')
        .map((entrada) => cartao(entrada.id, entrada.label))}
    </View>
  );
};

const estilos = StyleSheet.create({
  // Uma coluna, não duas: a web usa 2×2, mas em 375px cada cartão levaria a dica para três
  // linhas — e a dica é a metade útil do cartão.
  grade: { gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  cartao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    minHeight: 46, paddingVertical: 9, paddingHorizontal: 13,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_EQUIPE.permissaoContorno,
    backgroundColor: COR_EQUIPE.permissaoFundo,
  },
  cartaoMarcado: { borderColor: COR_EQUIPE.permissaoMarcadaContorno, backgroundColor: COR_EQUIPE.acessoFundo },
  cartaoInerte: { opacity: 0.7 },
  rotulo: { fontSize: 12, fontWeight: '700', color: COR_EQUIPE.permissaoTexto },
  rotuloMarcado: { color: COR_EQUIPE.permissaoMarcadaTexto },
  apoio: { fontSize: 11, color: COR_EQUIPE.permissaoApoio, marginTop: 3, lineHeight: 16 },
  caixa: {
    width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COR_EQUIPE.permissaoCaixa,
  },
  caixaMarcada: { borderColor: COR.primaria, backgroundColor: COR.primaria },
});
