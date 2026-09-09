import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';

// O transporte da mesa: um play, um relógio, uma régua.
//
// UM para toda a gravação, e não um por pista — é isso que diz, sem uma palavra, que as pistas
// tocam juntas. Um play por linha prometeria o contrário.

const relogio = (segundos: number) => {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const Transporte = ({ tocando, posicao, duracao, carregando, prontas, aoAlternar, aoBuscar }: {
  tocando: boolean;
  posicao: number;
  duracao: number;
  carregando: boolean;
  /** Quantas pistas conseguiram carregar. Zero = não há o que tocar. */
  prontas: number;
  aoAlternar: () => void;
  aoBuscar: (segundo: number) => void;
}) => {
  const [largura, setLargura] = useState(0);
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  const paraSegundo = (x: number) => {
    if (largura <= 0 || duracao <= 0) return 0;
    return Math.max(0, Math.min(x / largura, 1)) * duracao;
  };

  // Como no fader: só um gesto horizontal declarado move a agulha. Sem isto, rolar a tela com o
  // dedo pousado na régua saltaria a música de lugar.
  const arrastar = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate((e) => { runOnJS(aoBuscar)(paraSegundo(e.x)); });
  const toque = Gesture.Tap().onEnd((e) => { runOnJS(aoBuscar)(paraSegundo(e.x)); });

  const andado = duracao > 0 ? Math.min(posicao / duracao, 1) : 0;
  const inerte = carregando || prontas === 0;

  return (
    <View style={estilos.barra}>
      <Pressable
        onPress={aoAlternar}
        disabled={inerte}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={carregando
          ? 'Preparando as pistas'
          : prontas === 0 ? 'Nenhuma pista para tocar' : tocando ? 'Pausar' : 'Tocar'}
      >
        {carregando
          ? <ActivityIndicator size="small" color={COR.primaria} style={estilos.espera} />
          : (
            <Feather
              name={tocando ? 'pause' : 'play'}
              size={34}
              color={inerte ? COR_JAM.estrela : COR.primaria}
            />
          )}
      </Pressable>

      <Text style={estilos.tempo}>{relogio(posicao)}</Text>

      <GestureDetector gesture={Gesture.Race(arrastar, toque)}>
        <View style={estilos.alvoDaRegua} onLayout={medir}>
          <View style={estilos.regua}>
            <View style={[estilos.andado, { width: `${andado * 100}%` }]} />
          </View>
          <View style={[estilos.agulha, { left: `${andado * 100}%` }]} />
        </View>
      </GestureDetector>

      <Text style={[estilos.tempo, estilos.total]}>{relogio(duracao)}</Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  // O mesmo tamanho do ícone: sem isto a barra encolhe 34 pt enquanto carrega e o resto salta.
  espera: { width: 34, height: 34 },
  tempo: {
    // Tabular à mão: sem largura fixa, `0:09` → `0:10` empurra a régua um pixel a cada segundo.
    minWidth: 40, fontSize: 13, fontWeight: '700', color: COR_JAM.texto,
    fontVariant: ['tabular-nums'],
  },
  total: { textAlign: 'right', color: COR_JAM.apoio },
  alvoDaRegua: { flex: 1, height: 30, justifyContent: 'center' },
  regua: { height: 4, borderRadius: 2, backgroundColor: COR_JAM.acaoFundo, overflow: 'hidden' },
  andado: { height: '100%', backgroundColor: COR.primaria },
  agulha: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6,
    backgroundColor: COR.primaria,
    borderWidth: 2, borderColor: COR_JAM.papel,
  },
});
