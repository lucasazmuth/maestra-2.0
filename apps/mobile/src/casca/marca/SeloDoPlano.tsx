import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LottieView, { type AnimationObject } from 'lottie-react-native';

import { COR, COR_PERFIS, RAIO } from '@maestra/core/constants/design';
import {
  SHINE_HEX, TONE_STOPS, paintDiamond, paintShine, type PlanTone,
} from '@maestra/core/constants/planTagLottie';
import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

import brilhoCru from '@/assets/lottie/badge-shine.json';
import diamanteCru from '@/assets/lottie/gradient-diamond.json';

// O selo do plano ao lado da marca — o `PlanTag` da web.
//
// A pílula era estática aqui. Ela tem DUAS animações na web, e as duas são Lottie: o diamante,
// que fica em loop (é ele quem dá vida à pílula), e o brilho que atravessa uma vez ao abrir.
// Sem elas, o selo lê como uma etiqueta parada — e é justamente o elemento que a web usa para
// chamar atenção para o plano.
//
// As cores TÊM que ser injetadas no JSON: o Lottie não herda `currentColor`. A pintura e as
// paletas moram no núcleo, para as duas superfícies terem o mesmo diamante.

const ROTULOS: Record<PlanTone, string> = { pro: 'PRO', pending: 'Pendente', free: 'FREE' };

export const SeloDoPlano = ({ aoTocar }: { aoTocar?: () => void }) => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.subscription.status);
  const iniciado = useAppSelector((s) => s.subscription.initialized);
  const fimDaTolerancia = useAppSelector((s) => s.subscription.gracePeriodEndsAt);
  const idDaAssinatura = useAppSelector((s) => s.subscription.asaasSubscriptionId);

  // Sem resposta do servidor ainda, o status é 'none' por padrão: mostrar "FREE" e trocar para
  // "PRO" um segundo depois seria pior do que não mostrar nada.
  const pendente =
    (status === 'pending' && !!idDaAssinatura)
    || (status === 'overdue' && !!fimDaTolerancia && Date.now() < new Date(fimDaTolerancia).getTime());
  const plano: PlanTone = status === 'active' ? 'pro' : pendente ? 'pending' : 'free';

  // O selo BUSCA o que precisa. Na web quem carrega o status é o Layout, que envolve tudo; no
  // app não há esse envoltório único, e a pílula simplesmente não aparecia na lista de perfis —
  // `initialized` ficava falso para sempre porque ninguém pedia. `initialized` também é o que
  // impede a busca de repetir a cada montagem.
  useEffect(() => {
    if (!iniciado) void dispatch(fetchSubscriptionStatus());
  }, [iniciado, dispatch]);

  // `as AnimationObject`: a pintura devolve o JSON genérico (ela caminha na árvore sem saber o
  // formato), e o tipo do Lottie é a forma concreta do arquivo. É a mesma peça.
  const diamante = useMemo(
    () => paintDiamond(diamanteCru, TONE_STOPS[plano]) as unknown as AnimationObject,
    [plano],
  );
  // 20% já lê como um brilho passando, sem competir com o rótulo — a barra já vem tingida com a
  // cor do tom, então não precisa de mais opacidade que isso.
  const brilho = useMemo(
    () => paintShine(brilhoCru, SHINE_HEX[plano], 20) as unknown as AnimationObject,
    [plano],
  );

  if (!iniciado || PAYWALL_DISABLED) return null;

  return (
    <Pressable
      style={[estilos.pilula, estilos[plano]]}
      onPress={aoTocar}
      disabled={!aoTocar}
      accessibilityRole="button"
      accessibilityLabel={
        plano === 'pro' ? 'Maestra Pro ativo'
          : plano === 'pending' ? 'Pagamento em confirmação, seu acesso segue liberado'
            : 'Plano gratuito, ver o Maestra Pro'
      }
    >
      {/* O brilho fica ATRÁS do conteúdo, recortado pela pílula. */}
      <View style={estilos.brilho} pointerEvents="none">
        <LottieView source={brilho} autoPlay loop={false} resizeMode="cover" style={estilos.preencher} />
      </View>
      <LottieView source={diamante} autoPlay loop style={estilos.diamante} />
      <Text style={[estilos.rotulo, TEXTO[plano]]}>{ROTULOS[plano]}</Text>
    </Pressable>
  );
};

const TEXTO: Record<PlanTone, { color: string }> = {
  free: { color: COR_PERFIS.selo },
  pro: { color: COR.primariaEscura },
  pending: { color: COR_PERFIS.pendente },
};

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 20, paddingHorizontal: 8, borderRadius: RAIO.pilula,
    borderWidth: 1, overflow: 'hidden',
  },
  free: { backgroundColor: COR_PERFIS.seloFundo, borderColor: COR_PERFIS.seloContorno },
  pro: { backgroundColor: COR_PERFIS.proFundo, borderColor: COR_PERFIS.proContorno },
  pending: { backgroundColor: COR_PERFIS.pendenteFundo, borderColor: COR_PERFIS.pendenteContorno },
  textoFree: { color: COR_PERFIS.selo },
  textoPro: { color: COR.primariaEscura },
  textoPending: { color: COR_PERFIS.pendente },
  brilho: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  preencher: { width: '100%', height: '100%' },
  diamante: { width: 12, height: 12 },
  rotulo: { fontSize: 9, fontWeight: '800', letterSpacing: 0.54 },

});
