import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO } from '@maestra/core/constants/design';
import { LOCKED_FEATURE_CONFIG, type LockedFeatureKey } from '@maestra/core/constants/bloqueios';
import { usePlanPrices } from '@maestra/core/hooks/usePlanPrices';

import { EmblemaNyta } from '@/casca/EmblemaNyta';

// A tela de recurso bloqueado — a porta de `src/components/LockedFeature`.
//
// Sem ela, o app deixava escrever para a Nyta, mandava a pergunta e o servidor respondia 403.
// A mensagem sumia e nada explicava o porquê: parecia defeito, quando na verdade era o produto
// dizendo "isso é do plano PRO". Esse silêncio é pior que o bloqueio.
//
// O botão leva à assinatura NA WEB, e não a uma compra dentro do app. Isso é deliberado, e não
// preguiça: cobrar assinatura digital por fora da App Store é rejeição certa na diretriz 3.1.1.
// Quando houver StoreKit, é aqui que ele entra.

const ASSINATURA = 'https://www.maestramanager.com/assinatura';

export const RecursoBloqueado = ({ recurso }: { recurso: LockedFeatureKey }) => {
  const { onceFmt, monthlyFmt } = usePlanPrices();
  const config = LOCKED_FEATURE_CONFIG[recurso];

  const rotulo = config.cta.kind === 'unlock-profile'
    ? `${config.cta.label} — ${onceFmt}`
    : `${config.cta.label} — ${monthlyFmt}/mês`;

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
          onPress={() => Linking.openURL(ASSINATURA)}
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
