import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { COR, COR_DIAGNOSTICO } from '@maestra/core/constants/design';
import { LOCKED_FEATURE_CONFIG, type LockedFeatureKey } from '@maestra/core/constants/bloqueios';

import { Dialogo } from '@/casca/Dialogo';

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
    <Dialogo
      aberto={visivel}
      titulo={config.title}
      emblema={<Feather name="lock" size={16} color={COR.primaria} />}
      aoFechar={aoFechar}
      acao={{
        rotulo: config.cta.label,
        aoTocar: seguir,
        sufixo: <Feather name="arrow-right" size={16} color={COR.sobrePrimaria} />,
      }}
      recusa="Agora não"
    >
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

    </Dialogo>
  );
};

// A caixa, o véu e os dois botões moram no `Dialogo`. Aqui fica só o miolo deste aviso.
const estilos = StyleSheet.create({
  apoio: { fontSize: 13.5, lineHeight: 20, color: COR_DIAGNOSTICO.texto },
  beneficios: { gap: 10 },
  beneficio: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  beneficioTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: COR_DIAGNOSTICO.texto },
});
