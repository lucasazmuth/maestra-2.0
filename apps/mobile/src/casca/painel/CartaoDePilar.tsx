import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR_PAINEL, COR_PILARES, RAIO } from '@maestra/core/constants/design';
import type { ChaveDoPilar, Pilar } from '@maestra/core/nucleo/pilaresDoPainel';

// Um dos três pilares da home: onde estou, execução, para onde ir.
//
// O desenho é o mesmo da web (`src/components/dashboard/PillarCards.module.scss`): o navy do
// herói do painel, o anel vazado no canto na cor do pilar, rótulo em caixa alta, título, uma linha
// de status com dado real e a ação no rodapé. O que decide o TEXTO e o DESTINO não está aqui, está
// em `pilaresDoPainel`, no núcleo, que as duas superfícies chamam.
//
// O cartão inteiro é o alvo do toque: estes três são o único caminho para o Diagnóstico, o Plano
// e o Planejamento, e um alvo pequeno num cartão grande é caça ao botão.

const ANEL: Record<ChaveDoPilar, string> = {
  diagnostico: COR_PILARES.anelDiagnostico,
  execucao: COR_PILARES.anelExecucao,
  planejamento: COR_PILARES.anelPlanejamento,
};

/** As letras dos quatro pontos, na ordem do acrônimo. */
const REAL = ['R', 'E', 'A', 'L'];

export function CartaoDePilar({ pilar, aoTocar }: { pilar: Pilar; aoTocar: () => void }) {
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={`${pilar.titulo}: ${pilar.cta}`}
      style={({ pressed }) => [estilos.toque, pressed && estilos.pressionado]}
    >
      <LinearGradient
        colors={[COR_PAINEL.heroDe, COR_PAINEL.heroAte]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={estilos.cartao}
      >
        <View style={[estilos.anel, { borderColor: ANEL[pilar.chave] }]} pointerEvents="none" />

        <Text style={estilos.rotulo}>{pilar.rotulo.toUpperCase()}</Text>
        <Text style={estilos.titulo} numberOfLines={2}>{pilar.titulo}</Text>
        <Text style={estilos.linha} numberOfLines={2}>{pilar.linha}</Text>

        {!!pilar.marcas && (
          <View style={estilos.pontos}>
            {pilar.marcas.map((acesa, i) => (
              <View key={REAL[i]} style={[estilos.ponto, acesa && estilos.pontoAceso]}>
                <Text style={[estilos.pontoTexto, acesa && estilos.pontoTextoAceso]}>{REAL[i]}</Text>
              </View>
            ))}
          </View>
        )}

        {!!pilar.progresso && (
          <View style={estilos.regua}>
            <View style={[estilos.reguaCheia, { width: `${pilar.progresso.pct}%` }]} />
          </View>
        )}

        {!!pilar.detalhe && (
          <Text style={estilos.detalhe} numberOfLines={2}>{pilar.detalhe}</Text>
        )}

        <View style={estilos.acao}>
          <Text style={estilos.acaoTexto}>{pilar.cta}</Text>
          <Feather name="arrow-right" size={16} color={COR_PAINEL.seta} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  toque: { borderRadius: RAIO.cartao },
  pressionado: { opacity: 0.92, transform: [{ scale: 0.995 }] },

  cartao: { overflow: 'hidden', padding: 20, borderRadius: RAIO.cartao },
  // O anel mora no canto, quase todo para fora: dentro do cartão ele atravessaria as três linhas
  // de texto e leria como defeito, não como assinatura.
  anel: {
    position: 'absolute',
    right: -96,
    bottom: -96,
    width: 188,
    height: 188,
    borderRadius: 94,
    borderWidth: 2,
    opacity: 0.55,
  },

  rotulo: { color: COR_PAINEL.heroRotulo, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  titulo: { marginTop: 6, color: COR_PAINEL.sobreEscuro, fontSize: 23, lineHeight: 27, fontWeight: '800' },
  linha: { marginTop: 6, color: COR_PAINEL.heroTexto, fontSize: 13, lineHeight: 19 },

  // Apagada é contorno, acesa é campo: preenchidas as duas, a diferença virava um tom de cinza.
  pontos: { flexDirection: 'row', gap: 7, marginTop: 14 },
  ponto: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COR_PILARES.pontoApagado,
  },
  pontoAceso: { borderColor: COR_PILARES.pontoAceso, backgroundColor: COR_PILARES.pontoAceso },
  pontoTexto: { color: 'rgba(255, 255, 255, .55)', fontSize: 9, fontWeight: '800' },
  pontoTextoAceso: { color: COR_PAINEL.heroAte },

  regua: {
    height: 4,
    marginTop: 14,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: COR_PILARES.regua,
  },
  reguaCheia: { height: 4, borderRadius: 2, backgroundColor: COR_PILARES.reguaCheia },

  detalhe: { marginTop: 10, color: COR_PAINEL.velado, fontSize: 11, lineHeight: 16 },

  acao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  acaoTexto: { color: COR_PAINEL.sobreEscuro, fontSize: 13, fontWeight: '700' },
});

export default CartaoDePilar;
