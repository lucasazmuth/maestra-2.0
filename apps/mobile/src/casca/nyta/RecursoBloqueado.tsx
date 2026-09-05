import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO } from '@maestra/core/constants/design';
import { LOCKED_FEATURE_CONFIG, type LockedFeatureKey } from '@maestra/core/constants/bloqueios';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { irParaOCheckout } from '@/nucleo/loja';

// A tela de recurso bloqueado — a porta de `src/components/LockedFeature`.
//
// Sem ela, o app deixava escrever para a Nyta, mandava a pergunta e o servidor respondia 403.
// A mensagem sumia e nada explicava o porquê: parecia defeito, quando na verdade era o produto
// dizendo "isso é do plano PRO". Esse silêncio é pior que o bloqueio.
//
// O botão leva ao checkout DA WEB, já autenticado (ver `nucleo/loja`), e não a uma compra dentro
// do app. O PREÇO saiu do rótulo: ele é a parte que a diretriz de anti-steering enxerga primeiro,
// e mostrá-lo aqui não muda a decisão de quem já quer assinar — ele aparece no checkout.
//
// O destino dependia do `kind` e não dependia: o botão abria a assinatura mesmo quando o
// bloqueio era de perfil pendente. Como só a chave `nyta` é usada hoje, ninguém viu.

export const RecursoBloqueado = ({
  recurso, artistId,
}: { recurso: LockedFeatureKey; artistId?: string }) => {
  const config = LOCKED_FEATURE_CONFIG[recurso];
  const rotulo = config.cta.label;

  return (
    <View style={estilos.tela}>
      <View style={estilos.conteudo}>
        {/* A tela da Nyta mostra a própria Nyta: um ícone genérico não dizia de quem é o
            recurso. Os outros bloqueios seguem sem emblema. */}
        {recurso === 'nyta' && <EmblemaNyta size={62} />}
        <Text style={estilos.titulo}>{config.title}</Text>

        <View style={estilos.beneficios}>
          {config.benefits.map((beneficio) => (
            <View key={beneficio} style={estilos.beneficio}>
              <Feather name="check" size={16} color={COR.primaria} />
              <Text style={estilos.beneficioTexto}>{beneficio}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={estilos.botao}
          onPress={() => void irParaOCheckout(
            config.cta.kind === 'unlock-profile' && artistId
              ? { destino: 'desbloqueio', artistId }
              : { destino: 'assinatura' },
          )}
          accessibilityRole="button"
          accessibilityLabel={rotulo}
        >
          <Text style={estilos.botaoTexto}>{rotulo}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  tela: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: COR.fundo },
  conteudo: { alignItems: 'center', gap: 20, paddingBottom: 122 },
  titulo: { color: COR.titulo, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  beneficios: { gap: 12, alignSelf: 'stretch' },
  beneficio: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  beneficioTexto: { flex: 1, color: COR.secundario, fontSize: 14, lineHeight: 20 },
  botao: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  botaoTexto: { color: COR.sobrePrimaria, fontSize: 14, fontWeight: '800' },
});
