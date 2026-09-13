import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { AZUL_DO_EDITOR, COR_EDITOR, VERMELHO_DO_EDITOR } from '@maestra/core/constants/design';

// A BARRA DO TRANSPORTE — a mesma da web, botão a botão.
//
// |◀ voltar ao início · ▶/❚❚ tocar · ⟲ repetir · ● armar · o relógio · o zoom da linha do tempo.
//
// ⚠️ NÃO HÁ RÉGUA DE PROCURA AQUI, e é de propósito: quem leva a agulha é a régua da própria
// linha do tempo, onde se vê PARA ONDE se está a ir. Uma segunda régua, cega, a disputar a
// mesma barra com cinco botões e o zoom, era o que fazia o relógio sair do ecrã.
//
// ⚠️ O PARAR NÃO EXISTE, a pedido do dono do produto: parar é pausar (o botão grande) mais
// voltar ao início (o |◀ ao lado), e ninguém precisa de um terceiro botão para encadear dois
// que já estão ali. O loop, esse, não tinha como se fazer à mão.

const relogio = (segundos: number) => {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const Transporte = ({
  tocando, posicao, carregando, prontas, emLoop, armado,
  aoAlternar, aoVoltarAoInicio, aoLoopar, aoArmar, zoom,
}: {
  tocando: boolean;
  posicao: number;
  carregando: boolean;
  /** Quantas faixas conseguiram carregar. Zero = não há o que tocar. */
  prontas: number;
  emLoop?: boolean;
  /** O REC armado. Armar não grava — marca a intenção e espera o play. */
  armado?: boolean;
  aoAlternar: () => void;
  aoVoltarAoInicio: () => void;
  aoLoopar: (v: boolean) => void;
  aoArmar: () => void;
  /** O zoom só aparece na linha do tempo: na mesa não há eixo nenhum para aproximar. */
  zoom?: { valor: number; afastar: () => void; aproximar: () => void };
}) => {
  const inerte = carregando || prontas === 0;

  return (
    <View style={estilos.barra}>
      <Pressable
        onPress={aoVoltarAoInicio}
        style={estilos.botaozinho}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao início"
      >
        <Feather name="skip-back" size={16} color={COR_EDITOR.apoio} />
      </Pressable>

      {/* ⚠️ MESMO BOTÃO, MESMA COR, MESMO SÍTIO: tocar e pausar são o mesmo gesto a alternar, e
          trocar a cor entre os dois faria a barra piscar de identidade a cada toque. O que muda
          é o BRILHO — aceso enquanto toca. É o sinal de "está a andar" que se lê de relance. */}
      <Pressable
        onPress={aoAlternar}
        disabled={inerte}
        style={[
          estilos.tocar,
          inerte && estilos.tocarInerte,
          tocando && !inerte && estilos.tocarAceso,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: inerte }}
        accessibilityLabel={carregando ? 'Preparando as faixas' : tocando ? 'Pausar' : 'Tocar'}
      >
        <Feather
          name={tocando ? 'pause' : 'play'}
          size={18}
          color={COR_EDITOR.papel}
          style={tocando ? undefined : estilos.biscoDoPlay}
        />
      </Pressable>

      <Pressable
        onPress={() => aoLoopar(!emLoop)}
        style={[estilos.botaozinho, emLoop && estilos.loopAceso]}
        accessibilityRole="button"
        accessibilityState={{ selected: Boolean(emLoop) }}
        accessibilityLabel={emLoop ? 'Desligar o loop' : 'Repetir do início ao fim'}
      >
        <Feather name="repeat" size={15} color={emLoop ? AZUL_DO_EDITOR : COR_EDITOR.apoio} />
      </Pressable>

      {/* O REC ARMA A GRAVAÇÃO, e armar não é gravar — é a distinção que toda mesa faz.
          ⚠️ GRAVAR AINDA NÃO EXISTE, e o botão diz isso em vez de fingir. Até lá ele guarda a
          intenção, que é o que um botão armado faz mesmo numa mesa de verdade. */}
      <Pressable
        onPress={aoArmar}
        style={[estilos.botaozinho, !armado && estilos.armadoApagado]}
        accessibilityRole="button"
        accessibilityState={{ selected: Boolean(armado) }}
        accessibilityLabel={armado ? 'Desarmar a gravação' : 'Armar para gravar'}
      >
        <Feather
          name={armado ? 'disc' : 'circle'}
          size={20}
          color={VERMELHO_DO_EDITOR}
        />
      </Pressable>

      <View style={estilos.folga} />

      <Text style={estilos.relogio} accessibilityLabel={`Posição: ${relogio(posicao)}`}>
        {relogio(posicao)}
      </Text>

      {!!zoom && (
        <>
          <Pressable
            onPress={zoom.afastar}
            style={estilos.botaozinho}
            accessibilityRole="button"
            accessibilityLabel="Afastar a linha do tempo"
          >
            <Feather name="zoom-out" size={14} color={COR_EDITOR.apoio} />
          </Pressable>
          <Text style={estilos.numeroDoZoom}>{Math.round(zoom.valor * 100)}%</Text>
          <Pressable
            onPress={zoom.aproximar}
            style={estilos.botaozinho}
            accessibilityRole="button"
            accessibilityLabel="Aproximar a linha do tempo"
          >
            <Feather name="zoom-in" size={14} color={COR_EDITOR.apoio} />
          </Pressable>
        </>
      )}
    </View>
  );
};

/** A altura da barra, como na web. */
export const ALTURA_DO_TRANSPORTE = 62;

const estilos = StyleSheet.create({
  barra: {
    height: ALTURA_DO_TRANSPORTE, flexDirection: 'row', alignItems: 'center',
    gap: 4, paddingHorizontal: 8,
    backgroundColor: COR_EDITOR.painel,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
  },
  botaozinho: {
    width: 32, height: 32, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  loopAceso: { backgroundColor: `${AZUL_DO_EDITOR}22` },
  armadoApagado: { opacity: 0.6 },

  tocar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: AZUL_DO_EDITOR,
  },
  tocarInerte: { backgroundColor: COR_EDITOR.botaoRedondo },
  // Parado, é só o círculo azul: uma auréola permanente não diz nada. O brilho fica reservado
  // para o instante em que ele significa alguma coisa — enquanto o som anda.
  tocarAceso: {
    shadowColor: AZUL_DO_EDITOR, shadowOpacity: 0.75, shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  // O triângulo do play tem o peso todo à esquerda; centrado pelo quadro, parece fora do sítio.
  biscoDoPlay: { marginLeft: 2 },

  folga: { flex: 1 },
  relogio: {
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6,
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderWidth: 1, borderColor: COR_EDITOR.fio,
    fontSize: 12, color: COR_EDITOR.texto, fontVariant: ['tabular-nums'],
  },
  numeroDoZoom: {
    width: 42, textAlign: 'center', fontSize: 12, color: COR_EDITOR.apoio,
    fontVariant: ['tabular-nums'],
  },
});
