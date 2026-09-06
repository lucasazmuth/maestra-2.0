import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import LottieView, { type AnimationObject } from 'lottie-react-native';

import { COR, COR_PERFIS, RAIO } from '@maestra/core/constants/design';
import { SHINE_HEX, paintShine } from '@maestra/core/constants/planTagLottie';

import { DiamanteAnimado } from '@/casca/marca/DiamanteAnimado';
import { useAssinaturaAtiva } from '@/nucleo/assinatura';

import brilhoCru from '@/assets/lottie/badge-shine.json';

// A pílula PRO, ao lado da marca.
//
// É o `PlanTag` da web, reduzido a UM estado. Na web ele também diz FREE e Pendente; aqui não:
// o app não vende, e uma pílula "FREE" que leva ao checkout é justamente o que a App Store
// chama de direcionar para fora (3.1.3). Quem não assina encontra o convite dentro do menu do
// sistema, em "Seja PRO".
//
// Sobra o oposto disso: dizer a quem PAGA que o plano está ativo. Isso não vende nada, é
// informação sobre a conta.
//
// As DUAS animações são Lottie, como na web: o diamante em loop, que dá vida à pílula, e o
// brilho que atravessa uma vez ao abrir. As cores TÊM que ser injetadas no JSON — o Lottie não
// herda `currentColor`.

export const SeloPro = () => {
  const ativa = useAssinaturaAtiva();

  // 20% já lê como um brilho passando, sem competir com o rótulo — a barra já vem tingida com a
  // cor do tom, então não precisa de mais opacidade que isso.
  const brilho = useMemo(
    () => paintShine(brilhoCru, SHINE_HEX.pro, 20) as unknown as AnimationObject,
    [],
  );

  if (!ativa) return null;

  return (
    <View style={estilos.pilula} accessibilityRole="text" accessibilityLabel="Maestra Pro ativo">
      {/* O brilho fica ATRÁS do conteúdo, recortado pela pílula. */}
      <View style={estilos.brilho} pointerEvents="none">
        <LottieView source={brilho} autoPlay loop={false} resizeMode="cover" style={estilos.preencher} />
      </View>
      <DiamanteAnimado tom="pro" tamanho={12} />
      <Text style={estilos.rotulo}>PRO</Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 20, paddingHorizontal: 8, borderRadius: RAIO.pilula,
    borderWidth: 1, overflow: 'hidden',
    backgroundColor: COR_PERFIS.proFundo, borderColor: COR_PERFIS.proContorno,
  },
  brilho: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  preencher: { width: '100%', height: '100%' },
  rotulo: { fontSize: 9, fontWeight: '800', letterSpacing: 0.54, color: COR.primariaEscura },
});
