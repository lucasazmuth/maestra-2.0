import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import Feather from '@expo/vector-icons/Feather';

import type { EstadoDaMesa, Pista } from '@maestra/core/audio/mesa';
import { AZUL_DO_EDITOR, COR_EDITOR, corDaPista } from '@maestra/core/constants/design';

// A MESA: as mesmas pistas, vistas como CANAIS.
//
// A linha do tempo responde "o que toca quando"; a mesa responde "como isto soa junto". É a
// mesma montagem — o que muda é a pergunta, e por isso é uma aba e não outra tela.
//
// ⚠️ OS CANAIS SÃO EM PÉ, lado a lado, e não linhas empilhadas. É a forma de uma mesa de
// verdade, e é o que deixa comparar seis níveis de relance: deitados, seis traços empilhados
// não se comparam — o olho tem de ler número por número. É como a web faz, com as medidas dela
// (116 de largura, o fader esticado até onde a coluna vai).

const LARGURA_DO_CANAL = 116;

/** `C`, `E40`, `D75` — o lado e quanto, como na web. */
const dito = (pan: number) =>
  (Math.abs(pan) < 0.02 ? 'C' : `${pan < 0 ? 'E' : 'D'}${Math.round(Math.abs(pan) * 100)}`);

/**
 * Onde o dedo tocou, em quanto de volume.
 *
 * ⚠️ O ZERO É EMBAIXO. É a única coisa que distingue um fader em pé de um deitado virado de
 * lado, e enganá-la dá um controlo que funciona ao contrário — o gesto de baixar sobe. Por isso
 * ela sai daqui como função à parte: é o que se pode provar sem um dedo.
 */
export const volumeDoToque = (y: number, altura: number): number =>
  // O limite trata sozinho da altura ZERO, que é o que se tem antes do primeiro `onLayout`:
  // `1 - y/0` é `-Infinity`, e `-Infinity` preso entre 0 e 1 é 0. Uma guarda à parte para isso
  // seria uma linha que nunca corre.
  Math.max(0, Math.min(1 - y / altura, 1));

/**
 * O fader EM PÉ.
 *
 * O `Fader` deitado não serve aqui: ele mede o gesto no eixo X e desenha o trilho na horizontal.
 */
const FaderEmPe = ({ valor, cor, rotulo, aoMudar }: {
  valor: number;
  cor: string;
  rotulo: string;
  aoMudar: (v: number) => void;
}) => {
  const [altura, setAltura] = useState(0);
  const paraValor = (y: number) => (altura <= 0 ? valor : volumeDoToque(y, altura));
  const medir = (e: LayoutChangeEvent) => setAltura(e.nativeEvent.layout.height);

  // ⚠️ `activeOffsetY` separa "quero mexer no volume" de "quero rolar de lado". Sem ele, o Pan
  // ganhava no toque e um dedo que começasse sobre o canal para percorrer a mesa arrastava o
  // volume junto.
  const arrastar = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-12, 12])
    .onUpdate((e) => { runOnJS(aoMudar)(paraValor(e.y)); });
  const toque = Gesture.Tap().onEnd((e) => { runOnJS(aoMudar)(paraValor(e.y)); });

  const cheio = Math.max(0, Math.min(valor, 1));

  return (
    <GestureDetector gesture={Gesture.Race(arrastar, toque)}>
      <View
        style={estilos.alvoDoFader}
        onLayout={medir}
        accessibilityRole="adjustable"
        accessibilityLabel={rotulo}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(cheio * 100) }}
      >
        <View style={estilos.trilhoEmPe}>
          <View style={[estilos.cheioEmPe, { height: `${cheio * 100}%`, backgroundColor: cor }]} />
        </View>
        <View style={[estilos.botaoDoFader, { bottom: `${cheio * 100}%` }]} />
      </View>
    </GestureDetector>
  );
};

/** O panorama: um trilho que enche DO CENTRO para o lado, porque é isso que ele significa. */
const Panorama = ({ valor, rotulo, aoMudar }: {
  valor: number;
  rotulo: string;
  aoMudar: (v: number) => void;
}) => {
  const [largura, setLargura] = useState(0);
  const paraValor = (x: number) => {
    if (largura <= 0) return valor;
    const cru = (x / largura) * 2 - 1;
    // Uma zona morta no meio: acertar o centro exato com o dedo é impossível, e um canal a 3 %
    // para a esquerda soa centrado e lê "E3".
    return Math.abs(cru) < 0.06 ? 0 : Math.max(-1, Math.min(cru, 1));
  };
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  const arrastar = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate((e) => { runOnJS(aoMudar)(paraValor(e.x)); });
  const toque = Gesture.Tap().onEnd((e) => { runOnJS(aoMudar)(paraValor(e.x)); });

  const preso = Math.max(-1, Math.min(valor, 1));
  const meio = 50;
  const parte = Math.abs(preso) * 50;

  return (
    <GestureDetector gesture={Gesture.Race(arrastar, toque)}>
      <View
        style={estilos.alvoDoPan}
        onLayout={medir}
        accessibilityRole="adjustable"
        accessibilityLabel={rotulo}
        accessibilityValue={{ min: -100, max: 100, now: Math.round(preso * 100), text: dito(preso) }}
      >
        <View style={estilos.trilhoDoPan}>
          <View style={[
            estilos.cheioDoPan,
            preso < 0 ? { right: `${meio}%`, width: `${parte}%` } : { left: `${meio}%`, width: `${parte}%` },
          ]} />
          {/* A marca do centro: sem ela não se sabe para onde voltar. */}
          <View style={estilos.centroDoPan} />
        </View>
      </View>
    </GestureDetector>
  );
};

export const MesaDeCanais = ({
  pistas, estado, podeEditar, aoMudar, aoSolar, aoGanho, aoPanoramar,
}: {
  pistas: Pista[];
  estado: EstadoDaMesa;
  podeEditar: boolean;
  aoMudar: (pistaId: string, muda: boolean) => void;
  aoSolar: (pistaId: string, solo: boolean) => void;
  aoGanho: (pistaId: string, valor: number) => void;
  aoPanoramar: (pistaId: string, valor: number) => void;
}) => {
  if (!pistas.length) {
    return (
      <View style={estilos.vazio}>
        <Text style={estilos.vazioTexto}>Sem pistas para misturar ainda.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      style={estilos.mesa}
      contentContainerStyle={estilos.dentro}
      showsHorizontalScrollIndicator={false}
    >
      {pistas.map((pista, indice) => {
        const daMesa = estado.pistas.find((p) => p.id === pista.id);
        const cor = corDaPista(indice);
        const calada = Boolean(daMesa?.muda);
        const ganho = daMesa?.ganho ?? 1;
        const pan = daMesa?.pan ?? 0;
        return (
          <View
            key={pista.id}
            style={[
              estilos.canal,
              { borderTopColor: calada ? COR_EDITOR.estrela : cor },
              calada && estilos.canalCalado,
            ]}
          >
            <Text style={estilos.nome} numberOfLines={1}>{pista.nome}</Text>

            <Panorama
              valor={pan}
              rotulo={`Panorama de ${pista.nome} na mesa`}
              aoMudar={(v) => { if (podeEditar) aoPanoramar(pista.id, v); }}
            />
            <Text style={estilos.medida}>{dito(pan)}</Text>

            <FaderEmPe
              valor={ganho}
              cor={cor}
              rotulo={`Volume de ${pista.nome} na mesa`}
              aoMudar={(v) => { if (podeEditar) aoGanho(pista.id, v); }}
            />

            <Text style={estilos.numero}>{Math.round(ganho * 100)}</Text>

            <View style={estilos.botoes}>
              <Pressable
                onPress={() => aoMudar(pista.id, !calada)}
                style={[estilos.botaozinho, calada && estilos.mudoAceso]}
                accessibilityRole="button"
                accessibilityState={{ selected: calada }}
                accessibilityLabel={calada
                  ? `Ouvir ${pista.nome} na mesa`
                  : `Silenciar ${pista.nome} na mesa`}
              >
                <Feather
                  name={calada ? 'volume-x' : 'volume-2'}
                  size={11}
                  color={calada ? COR_EDITOR.papel : COR_EDITOR.apoio}
                />
              </Pressable>
              <Pressable
                onPress={() => aoSolar(pista.id, !daMesa?.solo)}
                style={[estilos.botaozinho, daMesa?.solo && estilos.soloAceso]}
                accessibilityRole="button"
                accessibilityState={{ selected: Boolean(daMesa?.solo) }}
                accessibilityLabel={daMesa?.solo
                  ? 'Ouvir tudo de novo na mesa'
                  : `Ouvir só ${pista.nome} na mesa`}
              >
                <Text style={[estilos.letra, daMesa?.solo && estilos.letraSolo]}>S</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  mesa: { flex: 1, backgroundColor: COR_EDITOR.fundoDe },
  dentro: { padding: 12, gap: 10, alignItems: 'stretch' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COR_EDITOR.fundoDe },
  vazioTexto: { fontSize: 13, color: COR_EDITOR.rotulo },

  canal: {
    width: LARGURA_DO_CANAL, padding: 12, gap: 10,
    alignItems: 'center',
    backgroundColor: COR_EDITOR.cabecaDaVersao,
    borderWidth: 1, borderColor: COR_EDITOR.fio, borderTopWidth: 3,
    borderRadius: 8,
  },
  canalCalado: { opacity: 0.6 },
  nome: { width: '100%', fontSize: 12, fontWeight: '600', color: COR_EDITOR.texto, textAlign: 'center' },

  alvoDoPan: { width: 84, height: 22, justifyContent: 'center' },
  trilhoDoPan: { height: 4, borderRadius: 2, backgroundColor: COR_EDITOR.acaoFundo },
  cheioDoPan: { position: 'absolute', top: 0, bottom: 0, backgroundColor: AZUL_DO_EDITOR },
  centroDoPan: {
    position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1,
    backgroundColor: COR_EDITOR.rotulo,
  },
  medida: { fontSize: 10, color: COR_EDITOR.rotulo, fontVariant: ['tabular-nums'] },

  // ⚠️ O FADER ESTICA até onde a coluna vai: 150 pt fixos dão saltos de 4 % por pixel debaixo de
  // um dedo. É a mesma decisão da web no telemóvel.
  alvoDoFader: { flex: 1, minHeight: 180, width: 28, alignItems: 'center', justifyContent: 'center' },
  trilhoEmPe: {
    width: 6, flex: 1, borderRadius: 3,
    backgroundColor: COR_EDITOR.acaoFundo, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cheioEmPe: { width: '100%' },
  botaoDoFader: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    // Metade da altura para baixo: o `bottom` posiciona a borda, e o que tem de ficar sobre o
    // valor é o CENTRO do botão.
    marginBottom: -11,
    backgroundColor: COR_EDITOR.papel,
    borderWidth: 1, borderColor: COR_EDITOR.contornoDaVersao,
  },
  numero: { fontSize: 11, color: COR_EDITOR.apoio, fontVariant: ['tabular-nums'] },

  botoes: { flexDirection: 'row', gap: 4 },
  botaozinho: {
    width: 26, height: 24, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_EDITOR.fio,
  },
  mudoAceso: { backgroundColor: COR_EDITOR.rotulo, borderColor: COR_EDITOR.rotulo },
  soloAceso: { backgroundColor: COR_EDITOR.estrelaAcesa, borderColor: COR_EDITOR.estrelaAcesa },
  letra: { fontSize: 11, fontWeight: '800', color: COR_EDITOR.apoio },
  letraSolo: { color: COR_EDITOR.tintaEscura },
});
