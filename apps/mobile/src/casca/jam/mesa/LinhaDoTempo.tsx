import { memo, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import Feather from '@expo/vector-icons/Feather';

import type { Pista } from '@maestra/core/audio/mesa';
import type { EstadoDaMesa } from '@maestra/core/audio/mesa';
import {
  PIXELS_POR_SEGUNDO, ZOOM_MAXIMO, ZOOM_MINIMO, gradeDoCompasso, marcasDaRegua,
  zoomQueEncaixa,
} from '@maestra/core/audio/grade';
import { COR, COR_JAM, corDaPista } from '@maestra/core/constants/design';

// A LINHA DO TEMPO, no aparelho.
//
// O app já tinha a mesa: faixas empilhadas com mutar, solo e volume. O que faltava era a outra
// metade do editor, a que mostra ONDE cada som está no tempo. Sem ela o app dizia "esta gravação
// tem cinco faixas" e a web dizia "esta gravação é isto", com a forma da música à vista.
//
// ⚠️ ELA É DE VER, e não de editar. Arrastar, dividir e apagar chegam depois, com o desfazer
// junto: um editor que mexe sem saber voltar atrás é pior do que um que só mostra.
//
// ─── Por que a coluna fica FORA do scroll horizontal ─────────────────────────
//
// É o mesmo erro que a web já cometeu e consertou: com a coluna dentro do mesmo scroll, rolar
// para o lado leva os nomes junto e a pessoa perde de vista de quem é cada onda; com duas
// rolagens sincronizadas à mão, elas dessincronizam no primeiro empurrão rápido e o M de uma
// faixa passa a ser o da onda ao lado.
//
// Aqui a coluna é IRMÃ do scroll, não filha: ela não se mexe porque não está lá dentro. E o
// eixo vertical é o da própria tela, que já rola — assim as duas colunas não podem divergir,
// porque não há duas rolagens.

/** A largura da coluna dos nomes. O resto do ecrã é a música. */
const COLUNA = 104;
const ALTURA_DA_REGUA = 26;
const ALTURA_DA_FAIXA = 76;
/** A folga do clipe dentro da faixa, em cima e em baixo. */
const FOLGA = 6;

/** As barras da onda de um clipe, em unidades do `viewBox`. Escalam com a largura real. */
const RESOLUCAO = 120;

/**
 * A onda de um clipe, esticada à largura que ele tem.
 *
 * ⚠️ NÃO É A `MiniOnda`, e não podia ser: aquela desenha um número FIXO de barras de 2 pt, que é
 * o que serve a uma linha da mesa, sempre da mesma largura. Aqui a largura é a duração vezes o
 * zoom, e muda a cada toque no mais e no menos. O `viewBox` com `preserveAspectRatio="none"`
 * resolve isso sem redesenhar: o desenho é sempre o mesmo, e quem o estica é o SVG.
 */
const OndaDoClipe = memo(({ picos, cor, largura, altura }: {
  picos: number[];
  cor: string;
  largura: number;
  altura: number;
}) => {
  if (!picos.length || largura <= 0) return null;
  const passo = RESOLUCAO / picos.length;
  return (
    <Svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${RESOLUCAO} 100`}
      preserveAspectRatio="none"
    >
      {picos.map((p, i) => {
        // Uma barra sempre visível: silêncio absoluto é uma linha, não um vazio.
        const alta = Math.max(2, p * 100);
        return (
          <Rect
            key={i}
            x={i * passo}
            y={(100 - alta) / 2}
            width={Math.max(passo * 0.7, 0.4)}
            height={alta}
            fill={cor}
            opacity={0.85}
          />
        );
      })}
    </Svg>
  );
});

export const LinhaDoTempo = ({ pistas, estado, picos, bpm, aoBuscar }: {
  pistas: Pista[];
  estado: EstadoDaMesa;
  /** Os picos que a mesa já tem: ela descodificou o áudio para tocar. */
  picos: (id: string, n: number) => number[];
  /** O andamento da gravação, como está escrito no campo. Sem ele, a régua conta segundos. */
  bpm?: string | number | null;
  aoBuscar: (segundo: number) => void;
}) => {
  const [zoom, setZoom] = useState(1);
  const [larguraVisivel, setLarguraVisivel] = useState(0);
  /** Quem mexeu no zoom manda: o encaixe automático não volta a mexer nele. */
  const zoomMexido = useRef(false);

  const escala = PIXELS_POR_SEGUNDO * zoom;
  const duracao = Math.max(estado.duracao, 1);
  const largura = duracao * escala + 24;

  // ⚠️ A MONTAGEM ABRE ENCAIXADA NO ECRÃ, como na web. A 100 % são 60 pt por segundo: uma
  // música de dois minutos mede 7 200 pt, e num ecrã de 390 isso são dezanove ecrãs em fila.
  // Encaixada, a música inteira está à vista de partida.
  const encaixe = useMemo(
    () => zoomQueEncaixa(duracao, larguraVisivel - COLUNA),
    [duracao, larguraVisivel],
  );
  if (!zoomMexido.current && larguraVisivel > 0 && zoom !== encaixe) setZoom(encaixe);

  const medir = (e: LayoutChangeEvent) => setLarguraVisivel(e.nativeEvent.layout.width);
  const mexerNoZoom = (novo: number) => { zoomMexido.current = true; setZoom(novo); };
  // Afastar vai sempre ATÉ ao encaixe: sem isto, quem aproximasse uma vez não conseguia voltar
  // a ver a música inteira.
  const zoomMinimo = Math.min(ZOOM_MINIMO, encaixe);

  const grade = useMemo(() => gradeDoCompasso(bpm, escala), [bpm, escala]);
  const passo = escala >= 40 ? 5 : escala >= 8 ? 15 : 60;
  const marcas = useMemo(
    () => marcasDaRegua(grade, duracao, escala, passo),
    [grade, duracao, escala, passo],
  );

  return (
    <View style={estilos.bloco} onLayout={medir}>
      <View style={estilos.corpo}>
        <View style={estilos.coluna}>
          <View style={estilos.cantoDaColuna}>
            <Text style={estilos.rotuloDaColuna}>FAIXAS</Text>
          </View>
          {pistas.map((pista, i) => (
            <View key={pista.id} style={estilos.cabecalhoDaFaixa}>
              <View style={[estilos.fitaDaCor, { backgroundColor: corDaPista(i) }]} />
              <Text style={estilos.nomeDaFaixa} numberOfLines={2}>{pista.nome}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ width: largura }}
        >
          <View style={{ width: largura }}>
            <Pressable
              style={[estilos.regua, { width: largura }]}
              onPress={(e) => aoBuscar(Math.max(0, e.nativeEvent.locationX / escala))}
              accessibilityRole="adjustable"
              accessibilityLabel="Levar a agulha"
            >
              {marcas.map((marca) => (
                <View
                  key={marca.segundo}
                  style={[
                    estilos.marcaDaRegua,
                    { left: marca.segundo * escala, opacity: marca.forte ? 1 : 0.45 },
                  ]}
                >
                  {!!marca.rotulo && <Text style={estilos.numeroDaRegua}>{marca.rotulo}</Text>}
                </View>
              ))}
            </Pressable>

            {pistas.map((pista, i) => (
              <View key={pista.id} style={[estilos.faixa, { width: largura }]}>
                {marcas.map((marca) => (
                  <View
                    key={marca.segundo}
                    style={[
                      estilos.grelha,
                      { left: marca.segundo * escala, opacity: marca.forte ? 0.9 : 0.35 },
                    ]}
                  />
                ))}
                {pista.clipes.map((clipe) => {
                  const larguraDoClipe = Math.max(clipe.duracao * escala, 3);
                  const cor = corDaPista(i);
                  return (
                    <View
                      key={clipe.id}
                      style={[
                        estilos.clipe,
                        {
                          left: clipe.inicio * escala,
                          width: larguraDoClipe,
                          borderColor: cor,
                          backgroundColor: `${cor}1f`,
                        },
                      ]}
                    >
                      <OndaDoClipe
                        picos={picos(clipe.id, RESOLUCAO)}
                        cor={cor}
                        largura={larguraDoClipe - 2}
                        altura={ALTURA_DA_FAIXA - FOLGA * 2 - 2}
                      />
                    </View>
                  );
                })}
              </View>
            ))}

            {/* A agulha, por cima de tudo o que é montagem. */}
            <View
              pointerEvents="none"
              style={[
                estilos.agulha,
                {
                  left: estado.posicao * escala,
                  height: ALTURA_DA_REGUA + pistas.length * ALTURA_DA_FAIXA,
                },
              ]}
            />
          </View>
        </ScrollView>
      </View>

      <View style={estilos.zoom}>
        <Pressable
          onPress={() => mexerNoZoom(Math.max(zoomMinimo, zoom / 1.5))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Afastar a linha do tempo"
        >
          <Feather name="zoom-out" size={16} color={COR_JAM.apoio} />
        </Pressable>
        <Text style={estilos.numeroDoZoom}>{Math.round(zoom * 100)}%</Text>
        <Pressable
          onPress={() => mexerNoZoom(Math.min(ZOOM_MAXIMO, zoom * 1.5))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Aproximar a linha do tempo"
        >
          <Feather name="zoom-in" size={16} color={COR_JAM.apoio} />
        </Pressable>
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  bloco: { borderBottomWidth: 1, borderBottomColor: COR_JAM.fio },
  corpo: { flexDirection: 'row' },
  coluna: {
    width: COLUNA,
    borderRightWidth: 1, borderRightColor: COR_JAM.fio,
    backgroundColor: COR_JAM.cabecaDaVersao,
  },
  cantoDaColuna: {
    height: ALTURA_DA_REGUA, justifyContent: 'center', paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  rotuloDaColuna: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: COR_JAM.rotulo },
  cabecalhoDaFaixa: {
    height: ALTURA_DA_FAIXA, flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingRight: 8, borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  fitaDaCor: { width: 3, alignSelf: 'stretch' },
  nomeDaFaixa: { flex: 1, fontSize: 12, fontWeight: '600', color: COR_JAM.titulo },
  regua: {
    height: ALTURA_DA_REGUA,
    borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
    backgroundColor: COR_JAM.cabecaDaVersao,
  },
  marcaDaRegua: {
    position: 'absolute', top: 0, bottom: 0,
    borderLeftWidth: 1, borderLeftColor: COR_JAM.fio, paddingLeft: 4,
    justifyContent: 'center',
  },
  numeroDaRegua: { fontSize: 9, color: COR_JAM.rotulo },
  faixa: {
    height: ALTURA_DA_FAIXA,
    borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  grelha: {
    position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: COR_JAM.fio,
  },
  clipe: {
    position: 'absolute', top: FOLGA, bottom: FOLGA,
    borderWidth: 1, borderRadius: 5, overflow: 'hidden',
    justifyContent: 'center',
  },
  agulha: {
    position: 'absolute', top: 0, width: 2, backgroundColor: COR.primaria,
  },
  zoom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  numeroDoZoom: {
    fontSize: 11, fontWeight: '700', color: COR_JAM.apoio, minWidth: 38, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
