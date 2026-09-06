import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import LottieView, { type AnimationObject } from 'lottie-react-native';

import { COR, COR_PERFIS, RAIO } from '@maestra/core/constants/design';
import { SHINE_HEX, paintShine } from '@maestra/core/constants/planTagLottie';

import { DiamanteAnimado } from '@/casca/marca/DiamanteAnimado';
import { useTomDoSelo, type TomDoSelo } from '@/nucleo/assinatura';

import brilhoCru from '@/assets/lottie/badge-shine.json';

// A pílula do plano, ao lado da marca.
//
// É o `PlanTag` da web menos um estado. Na web ela também diz FREE; aqui não: uma pílula "FREE"
// que leva ao checkout é direcionar para fora da loja, que é o que a App Store proíbe na 3.1.3.
// Quem não assina encontra o convite dentro do menu do sistema, em "Seja PRO".
//
// Sobram os dois estados que são INFORMAÇÃO sobre a conta, e não venda: o plano ativo e o
// pagamento em confirmação. Nenhum dos dois é botão — não há para onde ir.
//
// As DUAS animações são Lottie, como na web: o diamante em loop, que dá vida à pílula, e o
// brilho que atravessa uma vez ao abrir. As cores TÊM que ser injetadas no JSON — o Lottie não
// herda `currentColor`.

const ROTULO: Record<TomDoSelo, string> = { pro: 'PRO', pending: 'Pendente' };

const DESCRICAO: Record<TomDoSelo, string> = {
  pro: 'Maestra Pro ativo',
  // Quem está aqui pagou e está esperando a confirmação. Dizer que o acesso segue liberado é o
  // que evita a ligação para o suporte.
  pending: 'Pagamento em confirmação, seu acesso segue liberado',
};

export const SeloDoPlano = () => {
  const tom = useTomDoSelo();

  // 20% já lê como um brilho passando, sem competir com o rótulo — a barra já vem tingida com a
  // cor do tom, então não precisa de mais opacidade que isso.
  const brilho = useMemo(
    () => (tom ? paintShine(brilhoCru, SHINE_HEX[tom], 20) as unknown as AnimationObject : null),
    [tom],
  );

  if (!tom || !brilho) return null;

  return (
    <View
      style={[estilos.pilula, estilos[tom]]}
      accessibilityRole="text"
      accessibilityLabel={DESCRICAO[tom]}
    >
      {/* O brilho fica ATRÁS do conteúdo, recortado pela pílula. */}
      <View style={estilos.brilho} pointerEvents="none">
        <LottieView source={brilho} autoPlay loop={false} resizeMode="cover" style={estilos.preencher} />
      </View>
      <DiamanteAnimado tom={tom} tamanho={12} />
      <Text style={[estilos.rotulo, estilos[`texto_${tom}`]]}>{ROTULO[tom]}</Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 20, paddingHorizontal: 8, borderRadius: RAIO.pilula,
    borderWidth: 1, overflow: 'hidden',
  },
  pro: { backgroundColor: COR_PERFIS.proFundo, borderColor: COR_PERFIS.proContorno },
  pending: { backgroundColor: COR_PERFIS.pendenteFundo, borderColor: COR_PERFIS.pendenteContorno },
  brilho: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  preencher: { width: '100%', height: '100%' },
  rotulo: { fontSize: 9, fontWeight: '800', letterSpacing: 0.54 },
  texto_pro: { color: COR.primariaEscura },
  texto_pending: { color: COR_PERFIS.pendente },
});
