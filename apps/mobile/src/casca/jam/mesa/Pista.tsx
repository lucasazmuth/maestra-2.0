import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM, corDaPista } from '@maestra/core/constants/design';
import type { EstadoDaPista } from '@maestra/core/audio/mesa';

import { MiniOnda } from './MiniOnda';
import { Fader } from './Fader';

// Uma pista da mesa.
//
// ─── O que diz que a pista está calada ───────────────────────────────────────
//
// Três sinais ao mesmo tempo, e de propósito: a FAIXA de cor à esquerda fica cinzenta, a linha
// inteira perde opacidade, e a onda perde a cor. Assim lê-se o estado de seis pistas de relance,
// sem procurar botão nenhum — que é como se lê uma mesa de verdade.
//
// ⚠️ MUTAR E SOLAR TÊM CORES DIFERENTES, e isso não é gosto. São ações opostas: mutar é "esta
// não", solar é "só esta". Pintados da mesma cor quando ativos (como fazem quase todas as
// mesas de brincar), a pessoa deixa de saber qual carregou — e num editor de stems são as duas
// ações principais. Mutar fica cinzento (a cor de estar apagado); solar fica âmbar, a mesma cor
// da estrela da gravação principal, que no app já quer dizer "é esta que interessa".
//
// Os alvos têm 34 pt. A referência que inspirou esta tela usava 20 — abaixo de qualquer mínimo
// para um dedo, e justamente nos dois botões que mais se tocam.

const ALVO = 34;

export const Pista = ({ pista, indice, picos, progresso, haSolo, aoMudar, aoSolar, aoGanho, aoAbrirOpcoes }: {
  pista: EstadoDaPista;
  indice: number;
  picos: number[];
  /** 0..1 do que já tocou. */
  progresso: number;
  /** Alguma pista está solada? Muda o que "apagada" quer dizer para as outras. */
  haSolo: boolean;
  aoMudar: () => void;
  aoSolar: () => void;
  aoGanho: (v: number) => void;
  /** `undefined` na pista da mix: ela não se renomeia, não se move e não se apaga. */
  aoAbrirOpcoes?: () => void;
}) => {
  const cor = corDaPista(indice);
  const calada = pista.muda || (haSolo && !pista.solo);
  const carregando = pista.carga === 'na-fila' || pista.carga === 'carregando';
  const falhou = pista.carga === 'erro';

  return (
    <View style={[estilos.linha, calada && estilos.linhaCalada]}>
      {/* A faixa de cor: o sinal de estado mais forte da linha, e o que dá identidade à pista. */}
      <View style={[estilos.faixa, { backgroundColor: calada ? COR_JAM.estrela : cor }]} />

      <View style={estilos.miolo}>
        <View style={estilos.cabeca}>
          <View style={[estilos.ponto, { backgroundColor: calada ? COR_JAM.estrela : cor }]} />
          <Text style={estilos.nome} numberOfLines={1}>{pista.nome}</Text>

          {carregando && <ActivityIndicator size="small" color={COR_JAM.rotulo} />}

          {!carregando && !falhou && (
            <>
              <Pressable
                style={[estilos.botao, pista.muda && estilos.botaoMudo]}
                onPress={aoMudar}
                accessibilityRole="button"
                accessibilityState={{ selected: pista.muda }}
                accessibilityLabel={pista.muda ? `Ouvir ${pista.nome}` : `Silenciar ${pista.nome}`}
              >
                <Text style={[estilos.botaoTexto, pista.muda && estilos.botaoTextoMudo]}>M</Text>
              </Pressable>

              <Pressable
                style={[estilos.botao, pista.solo && estilos.botaoSolo]}
                onPress={aoSolar}
                accessibilityRole="button"
                accessibilityState={{ selected: pista.solo }}
                accessibilityLabel={pista.solo ? `Ouvir tudo de novo` : `Ouvir só ${pista.nome}`}
              >
                <Text style={[estilos.botaoTexto, pista.solo && estilos.botaoTextoSolo]}>S</Text>
              </Pressable>
            </>
          )}

          {!!aoAbrirOpcoes && (
            <Pressable
              style={estilos.botao}
              onPress={aoAbrirOpcoes}
              accessibilityRole="button"
              accessibilityLabel={`Opções de ${pista.nome}`}
            >
              <Feather name="more-vertical" size={16} color={COR_JAM.acaoIcone} />
            </Pressable>
          )}
        </View>

        {falhou ? (
          <Text style={estilos.erro} numberOfLines={2}>
            {pista.erro || 'Não consegui carregar esta pista.'}
          </Text>
        ) : (
          <View style={estilos.controlos}>
            <View style={estilos.onda}>
              <MiniOnda picos={picos} progresso={progresso} apagada={calada} />
            </View>
            <View style={estilos.fader}>
              <Fader valor={pista.ganho} aoMudar={aoGanho} apagado={calada} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  // Não `display: none` nem cinzento chapado: a linha continua legível, só recuada. Uma pista
  // calada ainda precisa de se poder renomear e desmutar.
  linhaCalada: { opacity: 0.55 },
  faixa: { width: 3 },
  // As duas filas alinham à MESMA margem: recuar a segunda (como fazia a referência) cria uma
  // coluna fantasma e o olho perde a fila dos controlos entre pistas.
  miolo: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4 },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  nome: { flex: 1, fontSize: 14, fontWeight: '700', color: COR_JAM.titulo },
  botao: {
    width: ALVO, height: ALVO, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },
  botaoTexto: { fontSize: 13, fontWeight: '800', color: COR_JAM.acaoIcone },
  // Mutar: cinzento cheio — a cor de estar apagado.
  botaoMudo: { backgroundColor: COR_JAM.estrela },
  botaoTextoMudo: { color: COR_JAM.papel },
  // Solar: âmbar cheio — a mesma cor da estrela da gravação principal, que já quer dizer
  // "é esta que interessa".
  botaoSolo: { backgroundColor: COR_JAM.estrelaAcesa },
  botaoTextoSolo: { color: COR_JAM.papel },
  controlos: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onda: { flex: 1, minWidth: 0 },
  // 110 pt é o mínimo em que um dedo consegue pousar num valor e não só nos extremos.
  fader: { width: 110 },
  erro: { fontSize: 12, lineHeight: 17, color: COR.erro },
});
