import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { COR, COR_AVISO, COR_DIAGNOSTICO, RAIO } from '@maestra/core/constants/design';
import { LOCKED_FEATURE_CONFIG, type LockedFeatureKey } from '@maestra/core/constants/bloqueios';

import { irParaOCheckout } from '@/nucleo/loja';

// O QUE UM BOTÃO TRANCADO DIZ ANTES DE MANDAR ALGUÉM PAGAR.
//
// O cadeado sozinho informa que não dá, e não informa por quê nem o que muda. Tocar nele
// abria o checkout direto: a pessoa saía do app para uma tela de pagamento sem nunca ter lido o
// que estava comprando. Este aviso é o passo do meio — diz o nome do recurso, o que ele entrega
// e só então oferece o caminho.
//
// Os textos vêm do núcleo (`LOCKED_FEATURE_CONFIG`), os mesmos da web: a promessa comercial de
// um plano não pode ter duas redações.
//
// O checkout vive na WEB, já autenticado (ver `nucleo/loja`), e não dentro do app. O preço não
// aparece no rótulo — é a parte que a diretriz de anti-steering enxerga primeiro, e não muda a
// decisão de quem já quer assinar.

export const AvisoDoPro = ({
  recurso, visivel, aoFechar, artistId,
}: {
  recurso: LockedFeatureKey;
  visivel: boolean;
  aoFechar: () => void;
  artistId?: string;
}) => {
  const config = LOCKED_FEATURE_CONFIG[recurso];

  const seguir = () => {
    aoFechar();
    void irParaOCheckout(
      config.cta.kind === 'unlock-profile' && artistId
        ? { destino: 'desbloqueio', artistId }
        : { destino: 'assinatura' },
    );
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      {/* Tocar fora fecha: é o gesto que todo mundo tenta primeiro num aviso destes. */}
      <Pressable style={estilos.fundo} onPress={aoFechar} accessibilityLabel="Fechar" />
      <View style={estilos.caixa} accessibilityViewIsModal accessibilityRole="alert">
        <View style={estilos.cabecalho}>
          <View style={estilos.emblema}>
            <Feather name="lock" size={16} color={COR.primaria} />
          </View>
          <Text style={estilos.titulo}>{config.title}</Text>
        </View>

        <Text style={estilos.apoio}>
          Este recurso é do Maestra PRO. Com a assinatura ativa ele libera na hora, neste mesmo
          perfil.
        </Text>

        <View style={estilos.beneficios}>
          {config.benefits.map((beneficio) => (
            <View key={beneficio} style={estilos.beneficio}>
              <Feather name="check" size={15} color={COR.primaria} />
              <Text style={estilos.beneficioTexto}>{beneficio}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={estilos.principal}
          onPress={seguir}
          accessibilityRole="button"
          accessibilityLabel={config.cta.label}
        >
          <Text style={estilos.principalTexto}>{config.cta.label}</Text>
          <Feather name="arrow-right" size={16} color={COR.sobrePrimaria} />
        </Pressable>

        <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Agora não">
          <Text style={estilos.secundario}>Agora não</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  fundo: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COR_AVISO.veu,
  },
  caixa: {
    position: 'absolute', left: 16, right: 16, top: '50%', transform: [{ translateY: -190 }],
    padding: 22, gap: 14, borderRadius: RAIO.cartao, backgroundColor: COR.superficie,
    shadowColor: 'rgb(46, 72, 117)', shadowOpacity: 0.18, shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 }, elevation: 8,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emblema: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_DIAGNOSTICO.discoFundo,
  },
  titulo: { flex: 1, fontSize: 18, fontWeight: '800', color: COR_DIAGNOSTICO.titulo },
  apoio: { fontSize: 13.5, lineHeight: 20, color: COR_DIAGNOSTICO.texto },
  beneficios: { gap: 10 },
  beneficio: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  beneficioTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: COR_DIAGNOSTICO.texto },
  principal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
  },
  principalTexto: { fontSize: 15, fontWeight: '800', color: COR.sobrePrimaria },
  secundario: {
    textAlign: 'center', fontSize: 13.5, fontWeight: '700', color: COR_DIAGNOSTICO.fonte,
  },
});
