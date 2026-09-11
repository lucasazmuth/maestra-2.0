import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import Feather from '@expo/vector-icons/Feather';

import type { Pista } from '@maestra/core/audio/mesa';
import type { EstadoDaMesa } from '@maestra/core/audio/mesa';
import {
  PIXELS_POR_SEGUNDO, encaixeDaGrade, gradeDoCompasso, marcasDaRegua, zoomQueEncaixa,
} from '@maestra/core/audio/grade';
import { NOME_DA_MIX, ehPistaDaMix } from '@maestra/core/audio/pistasDaVersao';
import {
  AZUL_DO_EDITOR, COR, COR_EDITOR, VERMELHO_DO_EDITOR, corDaPista,
} from '@maestra/core/constants/design';

import { IconeDeEnviar } from './icones';

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

// As medidas do editor da web no telemóvel, à letra: a coluna de 132 e a faixa de 96.
//
// ⚠️ A COLUNA ENCOLHE, E NÃO AS ONDAS. Os 256 da web em desktop comem 68 % de um ecrã de 390, e
// o que sobrava para o áudio — que é o assunto desta aba — era um terço. Aqui a coluna fica com
// o nome e os quatro botões; o volume e o panorama vivem na Mesa, que é a aba ao lado e onde o
// fader tem curso para um dedo.
const COLUNA = 132;
const ALTURA_DA_REGUA = 30;
const ALTURA_DA_FAIXA = 96;
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

/**
 * Um clipe na linha do tempo, com a edição que o dedo permite.
 *
 * ⚠️ ARRASTAR EXIGE O CLIPE ESCOLHIDO PRIMEIRO, e é a mesma regra da web. No mesmo ecrã, o
 * arrasto horizontal já é o gesto de rolar a montagem: sem um sinal de intenção, cada tentativa
 * de percorrer a música mexeria no clipe por onde o dedo passasse. Um toque escolhe, e a partir
 * daí o `Pan` deste clipe ganha do `ScrollView` que o contém.
 *
 * A barra de ações vive DENTRO do clipe, e não por cima: por cima, a da primeira faixa saía
 * pelo topo da área visível.
 */
const Clipe = ({
  clipe, rotulo, nome, cor, escala, largura, picos: osPicos, escolhido, podeEditar, agulha, duracao,
  passoDoEncaixe, aoEscolher, aoLargar, aoMoverEnquantoArrasta, aoCortar, aoApagar,
}: {
  clipe: { id: string; inicio: number };
  /** O que o leitor de tela lê, e o que os testes procuram. Um alvo mudo não se alcança. */
  rotulo: string;
  /**
   * O nome do ficheiro, escrito no canto do clipe — o mesmo rótulo da web.
   *
   * ⚠️ AQUI NÃO HAVIA NENHUM, e o canto vazio era uma diferença a menos que ninguém via: na
   * web o clipe sempre se identificou. Sem ficheiro com nome, volta o número do trecho.
   */
  nome: string;
  cor: string;
  escala: number;
  largura: number;
  picos: number[];
  escolhido: boolean;
  podeEditar: boolean;
  agulha: number;
  duracao: number;
  passoDoEncaixe: number;
  aoEscolher: () => void;
  aoLargar: (inicio: number, de: number) => void;
  aoMoverEnquantoArrasta: (inicio: number) => void;
  aoCortar: () => void;
  aoApagar: () => void;
}) => {
  const partiuDe = useRef(clipe.inicio);

  const arrastar = Gesture.Pan()
    .enabled(escolhido && podeEditar)
    // Declarar o eixo: sem isto o `ScrollView` e o clipe disputam o mesmo dedo, e quem ganha
    // depende do ângulo do primeiro pixel.
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin(() => { partiuDe.current = clipe.inicio; })
    .onUpdate((e) => {
      const bruto = partiuDe.current + e.translationX / escala;
      runOnJS(aoMoverEnquantoArrasta)(Math.max(0, bruto));
    })
    .onEnd((e) => {
      const bruto = partiuDe.current + e.translationX / escala;
      const destino = Math.max(0, Math.round(bruto / passoDoEncaixe) * passoDoEncaixe);
      // Um toque não é um arrasto: sem esta guarda, escolher um clipe fora da grelha o faria
      // saltar para o tempo mais próximo sem ninguém pedir.
      if (Math.abs(destino - partiuDe.current) < 0.001) return;
      runOnJS(aoLargar)(destino, partiuDe.current);
    });


  // O corte é na AGULHA, e só quando ela está dentro deste clipe: é ela que diz onde cai.
  const podeCortar = agulha > clipe.inicio + 0.05 && agulha < clipe.inicio + duracao - 0.05;

  return (
    // ⚠️ O TOQUE É UM `Pressable`, e não um `Gesture.Tap`. Dois motivos, e o segundo é o que
    // decide: o `Pressable` dá o retorno de toque e a acessibilidade de graça, e um gesto de
    // toque dentro do `GestureDetector` é invisível para quem testa a tela — o alvo existiria
    // para o dedo e não para o teste, que é como um botão deixa de funcionar sem ninguém ver.
    // O `Pan` fica por fora e só ganha depois de 8 pontos: um toque nunca lhe chega.
    <GestureDetector gesture={arrastar}>
      <Pressable
        onPress={aoEscolher}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityState={{ selected: escolhido }}
        style={[
          estilos.clipe,
          {
            left: clipe.inicio * escala,
            width: largura,
            borderColor: cor,
            backgroundColor: `${cor}1f`,
            borderWidth: escolhido ? 2 : 1,
          },
        ]}
      >
        {/* A onda é cortada pela borda do clipe; a BARRA não. Ver o `overflow` dos estilos. */}
        <View style={estilos.dentroDoClipe}>
          <OndaDoClipe
            picos={osPicos}
            cor={cor}
            largura={largura - 2}
            altura={ALTURA_DA_FAIXA - FOLGA * 2 - 2}
          />
        </View>

        <Text style={[estilos.nomeDoClipe, { color: cor }]} numberOfLines={1}>
          {nome}
        </Text>

        {escolhido && podeEditar && (
          <View style={estilos.acoesDoClipe}>
            <Pressable
              onPress={aoCortar}
              disabled={!podeCortar}
              hitSlop={6}
              style={[estilos.acaoDoClipe, !podeCortar && estilos.acaoInerte]}
              accessibilityRole="button"
              accessibilityLabel={podeCortar
                ? 'Dividir o clipe na agulha'
                : 'Leve a agulha para dentro do clipe'}
            >
              <Feather name="scissors" size={12} color={podeCortar ? AZUL_DO_EDITOR : COR_EDITOR.estrela} />
            </Pressable>
            <Pressable
              onPress={aoApagar}
              hitSlop={6}
              style={estilos.acaoDoClipe}
              accessibilityRole="button"
              accessibilityLabel="Remover o clipe"
            >
              <Feather name="trash-2" size={12} color={COR.erro} />
            </Pressable>
          </View>
        )}
      </Pressable>
    </GestureDetector>
  );
};

export const LinhaDoTempo = ({
  pistas, estado, picos, duracaoDoClipe, bpm, podeEditar, zoom, aoEncaixar,
  armadas, aoArmar, aoRenomearPista, aoApagarPista, aoMudarPista, aoSolarPista, aoEnviarPara,
  aoAdicionarFaixa,
  aoBuscar, aoMover, aoCortar, aoApagar,
}: {
  pistas: Pista[];
  estado: EstadoDaMesa;
  /** Os picos que a mesa já tem: ela descodificou o áudio para tocar. */
  picos: (id: string, n: number) => number[];
  /**
   * Quanto o clipe dura de facto.
   *
   * ⚠️ NÃO SE USA O `clipe.duracao` AQUI. A pista da Mix nasce com uma hora — o marcador de
   * "ainda não sei quanto dura" —, e desenhar por ele fazia a Mix ocupar dezoito vezes a
   * largura da música, com a onda inteira espremida no primeiro pedaço visível.
   */
  duracaoDoClipe: (id: string) => number;
  /** O andamento da gravação, como está escrito no campo. Sem ele, a régua conta segundos. */
  bpm?: string | number | null;
  /** Sem permissão, a montagem só se vê: nenhum clipe se escolhe, nenhum botão aparece. */
  podeEditar?: boolean;
  /** O zoom vive na barra do transporte, como na web. Aqui ele só se lê. */
  zoom: number;
  /** O encaixe da montagem no ecrã, medido aqui e guardado lá fora. */
  aoEncaixar?: (minimo: number) => void;
  /** As pistas armadas para gravar. Armar não grava — marca ONDE, e o REC marca QUANDO. */
  armadas?: string[];
  aoArmar?: (pistaId: string) => void;
  aoRenomearPista?: (pistaId: string, nome: string) => void;
  aoApagarPista?: (pistaId: string) => void;
  aoMudarPista?: (pistaId: string, muda: boolean) => void;
  aoSolarPista?: (pistaId: string, solo: boolean) => void;
  aoEnviarPara?: (pistaId: string) => void;
  /** Cria uma faixa nova com um áudio do aparelho. */
  aoAdicionarFaixa?: () => void;
  aoBuscar: (segundo: number) => void;
  /** `de` só vai preenchido quando o dedo largou: é o que o desfazer precisa. */
  aoMover?: (clipeId: string, inicio: number, de?: number) => void;
  aoCortar?: (clipeId: string, emSegundo: number) => void;
  aoApagar?: (clipeId: string) => void;
}) => {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [larguraVisivel, setLarguraVisivel] = useState(0);

  const escala = PIXELS_POR_SEGUNDO * zoom;
  const duracao = Math.max(estado.duracao, 1);
  const largura = duracao * escala + 24;

  // ⚠️ A MONTAGEM ABRE ENCAIXADA NO ECRÃ, como na web. A 100 % são 60 pt por segundo: uma
  // música de dois minutos mede 7 200 pt, e num ecrã de 390 isso são dezanove ecrãs em fila.
  // Encaixada, a música inteira está à vista de partida.
  //
  // Quem GUARDA o zoom é a tela, porque os botões dele vivem na barra do transporte — como na
  // web. O que se faz aqui é medir a largura e dizer lá para fora qual é o encaixe.
  const encaixe = useMemo(
    () => zoomQueEncaixa(duracao, larguraVisivel - COLUNA),
    [duracao, larguraVisivel],
  );
  useEffect(() => {
    if (larguraVisivel > 0) aoEncaixar?.(encaixe);
  }, [encaixe, larguraVisivel, aoEncaixar]);

  const medir = (e: LayoutChangeEvent) => setLarguraVisivel(e.nativeEvent.layout.width);

  const grade = useMemo(() => gradeDoCompasso(bpm, escala), [bpm, escala]);
  const passoDoEncaixe = useMemo(() => encaixeDaGrade(grade, escala), [grade, escala]);
  const passo = escala >= 40 ? 5 : escala >= 8 ? 15 : 60;
  const marcas = useMemo(
    () => marcasDaRegua(grade, duracao, escala, passo),
    [grade, duracao, escala, passo],
  );

  return (
    // Uma ROLAGEM VERTICAL só, para as duas colunas — é o mesmo que a web faz, e impede o pior
    // erro que uma tela destas pode ter: o cabeçalho de uma pista alinhado com a faixa de
    // OUTRA. Com um scroll por coluna, bastava rolar uma para o M e o S deixarem de ser os da
    // onda ao lado, e a pessoa calava a pista errada.
    <ScrollView
      style={estilos.bloco}
      contentContainerStyle={estilos.conteudo}
      onLayout={medir}
    >
      <View style={estilos.corpo}>
        <View style={estilos.coluna}>
          <View style={estilos.cantoDaColuna}>
            <Text style={estilos.rotuloDaColuna}>FAIXAS</Text>
          </View>
          {pistas.map((pista, i) => {
            const daMesa = estado.pistas.find((p) => p.id === pista.id);
            const calada = daMesa?.muda ?? false;
            const fixa = ehPistaDaMix(pista.id);
            const mexivel = !!podeEditar && !fixa;
            return (
              <View
                key={pista.id}
                style={[
                  estilos.cabecalhoDaFaixa,
                  { borderLeftColor: calada ? COR_EDITOR.estrela : corDaPista(i) },
                  calada && estilos.faixaCalada,
                ]}
              >
                <View style={estilos.linhaDoNome}>
                  <TextInput
                    style={estilos.nomeDaFaixa}
                    value={pista.nome}
                    editable={mexivel}
                    onChangeText={(t) => aoRenomearPista?.(pista.id, t)}
                    accessibilityLabel={`Nome da faixa ${pista.nome}`}
                  />
                  {mexivel && (
                    <Pressable
                      onPress={() => aoApagarPista?.(pista.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Apagar a faixa ${pista.nome}`}
                    >
                      <Feather name="trash-2" size={13} color={COR_EDITOR.rotulo} />
                    </Pressable>
                  )}
                </View>

                {/* Os quatro repartem a largura em partes iguais: é o que os faz caber numa
                    coluna de 132 seja qual for o ecrã, em vez de o último sair para fora. */}
                <View style={estilos.botoesDaFaixa}>
                  <Pressable
                    onPress={() => aoMudarPista?.(pista.id, !calada)}
                    style={[estilos.botaozinho, calada && estilos.mudoAceso]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: calada }}
                    accessibilityLabel={calada ? `Ouvir ${pista.nome}` : `Silenciar ${pista.nome}`}
                  >
                    {/* ⚠️ Mudo e solo têm CORES DIFERENTES: são as duas ações mais usadas de uma
                        mesa e são opostas. Pintadas iguais quando acesas, ninguém sabe qual
                        carregou. */}
                    <Text style={[estilos.letraDoBotao, calada && estilos.letraMuda]}>M</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => aoSolarPista?.(pista.id, !daMesa?.solo)}
                    style={[estilos.botaozinho, daMesa?.solo && estilos.soloAceso]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: Boolean(daMesa?.solo) }}
                    accessibilityLabel={daMesa?.solo ? 'Ouvir tudo de novo' : `Ouvir só ${pista.nome}`}
                  >
                    <Text style={[estilos.letraDoBotao, daMesa?.solo && estilos.letraSolo]}>S</Text>
                  </Pressable>
                  {mexivel && (
                    <Pressable
                      onPress={() => aoArmar?.(pista.id)}
                      style={[
                        estilos.botaozinho,
                        { borderColor: armadas?.includes(pista.id) ? VERMELHO_DO_EDITOR : COR_EDITOR.fio },
                        !armadas?.includes(pista.id) && estilos.armadoApagado,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: Boolean(armadas?.includes(pista.id)) }}
                      accessibilityLabel={armadas?.includes(pista.id)
                        ? `Desarmar ${pista.nome}`
                        : `Armar ${pista.nome} para gravar`}
                    >
                      <Feather
                        name={armadas?.includes(pista.id) ? 'disc' : 'circle'}
                        size={11}
                        color={VERMELHO_DO_EDITOR}
                      />
                    </Pressable>
                  )}
                  {/* ⚠️ ENVIAR DIRETO PARA ESTA PISTA. Sem isto, uma pista que ficou sem áudio
                      (o clipe foi apagado) vira um beco sem saída: não há arrasto de ficheiro
                      num telemóvel, e a pista ficava lá, vazia, sem forma de a encher. */}
                  {mexivel && (
                    <Pressable
                      onPress={() => aoEnviarPara?.(pista.id)}
                      style={estilos.botaozinho}
                      accessibilityRole="button"
                      accessibilityLabel={`Enviar um áudio para ${pista.nome}`}
                    >
                      <IconeDeEnviar tamanho={13} cor={COR_EDITOR.apoio} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {/* ⚠️ A PORTA DA FAIXA NOVA MORA NA COLUNA, no fim da lista — é onde a web a põe, e é
              onde o olho a procura: a seguir à última faixa, no sítio onde a próxima vai
              nascer. A pasta do rodapé abre a biblioteca, que é outro gesto (escolher entre o
              que já está do lado de cá); esta cria uma faixa de uma vez. */}
          {podeEditar && (
            <Pressable
              onPress={aoAdicionarFaixa}
              style={estilos.adicionarFaixa}
              accessibilityRole="button"
              accessibilityLabel="Adicionar faixa"
            >
              <Text style={estilos.adicionarFaixaTexto}>+ Adicionar faixa</Text>
            </Pressable>
          )}
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

            {!pistas.length && (
              <View style={estilos.semPistas} pointerEvents="none">
                <Text style={estilos.semPistasTexto}>
                  Nenhuma faixa nesta gravação ainda.
                </Text>
              </View>
            )}

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
                {pista.clipes.map((clipe, n) => {
                  const dura = duracaoDoClipe(clipe.id) || clipe.duracao;
                  const larguraDoClipe = Math.max(dura * escala, 3);
                  const cor = corDaPista(i);
                  const meu = escolhido === clipe.id;
                  return (
                    <Clipe
                      key={clipe.id}
                      clipe={clipe}
                      rotulo={`Trecho ${n + 1} de ${pista.nome}`}
                      nome={ehPistaDaMix(pista.id)
                        ? NOME_DA_MIX
                        : (clipe.nome || `Take ${n + 1}`)}
                      cor={cor}
                      escala={escala}
                      largura={larguraDoClipe}
                      picos={picos(clipe.id, RESOLUCAO)}
                      escolhido={meu}
                      podeEditar={!!podeEditar && !ehPistaDaMix(pista.id)}
                      agulha={estado.posicao}
                      duracao={dura}
                      aoEscolher={() => setEscolhido((atual) => (atual === clipe.id ? null : clipe.id))}
                      aoLargar={(inicio, de) => aoMover?.(clipe.id, inicio, de)}
                      aoMoverEnquantoArrasta={(inicio) => aoMover?.(clipe.id, inicio)}
                      passoDoEncaixe={passoDoEncaixe}
                      aoCortar={() => { aoCortar?.(clipe.id, estado.posicao); setEscolhido(null); }}
                      aoApagar={() => { aoApagar?.(clipe.id); setEscolhido(null); }}
                    />
                  );
                })}
              </View>
            ))}

            {/* A agulha, por cima de tudo o que é montagem. A bolinha do topo é o que a torna
                um objeto e não um risco — é onde o olho a encontra ao percorrer a régua. */}
            <View
              pointerEvents="none"
              style={[
                estilos.agulha,
                {
                  left: estado.posicao * escala,
                  height: ALTURA_DA_REGUA + pistas.length * ALTURA_DA_FAIXA,
                },
              ]}
            >
              <View style={estilos.cabecaDaAgulha} />
            </View>
          </View>
        </ScrollView>
      </View>

    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  bloco: { flex: 1, backgroundColor: COR_EDITOR.fundoDe },
  // `minHeight` para a montagem encher o ecrã mesmo com uma faixa só: sem isto, o fundo da
  // linha do tempo acabava a meio da tela e o resto era o fundo da página.
  conteudo: { minHeight: '100%' },
  corpo: { flexDirection: 'row', flex: 1 },
  coluna: {
    width: COLUNA,
    borderRightWidth: 1, borderRightColor: COR_EDITOR.fio,
    // ⚠️ SEM FUNDO PRÓPRIO: quem pinta é cada linha. Com o fundo na coluna, o vazio abaixo da
    // última faixa saía mais claro do que o vazio ao lado dele — dois tons a dividir a tela ao
    // meio numa linha vertical que não significava nada.
  },
  cantoDaColuna: {
    height: ALTURA_DA_REGUA, justifyContent: 'center', paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
  },
  rotuloDaColuna: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: COR_EDITOR.rotulo },
  // A cor da pista é a BORDA ESQUERDA do cabeçalho, como na web — e não uma fita solta.
  cabecalhoDaFaixa: {
    height: ALTURA_DA_FAIXA, justifyContent: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
    borderLeftWidth: 3,
    backgroundColor: COR_EDITOR.cabecaDaVersao,
  },
  faixaCalada: { opacity: 0.6 },
  linhaDoNome: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomeDaFaixa: {
    flex: 1, minWidth: 0, padding: 0, fontSize: 13, fontWeight: '600', color: COR_EDITOR.titulo,
  },
  botoesDaFaixa: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  botaozinho: {
    flex: 1, minWidth: 0, height: 26, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_EDITOR.fio,
  },
  mudoAceso: { backgroundColor: COR_EDITOR.rotulo, borderColor: COR_EDITOR.rotulo },
  soloAceso: { backgroundColor: COR_EDITOR.estrelaAcesa, borderColor: COR_EDITOR.estrelaAcesa },
  letraDoBotao: { fontSize: 11, fontWeight: '800', color: COR_EDITOR.apoio },
  letraMuda: { color: COR_EDITOR.papel },
  letraSolo: { color: COR_EDITOR.tintaEscura },
  armadoApagado: { opacity: 0.5 },
  regua: {
    height: ALTURA_DA_REGUA,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
    backgroundColor: COR_EDITOR.cabecaDaVersao,
  },
  marcaDaRegua: {
    position: 'absolute', top: 0, bottom: 0,
    borderLeftWidth: 1, borderLeftColor: COR_EDITOR.fio, paddingLeft: 4,
    justifyContent: 'center',
  },
  numeroDaRegua: { fontSize: 9, color: COR_EDITOR.rotulo },
  adicionarFaixa: {
    height: 46, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
  },
  adicionarFaixaTexto: { fontSize: 13, color: COR_EDITOR.apoio },
  semPistas: { paddingTop: 60, alignItems: 'center' },
  semPistasTexto: { fontSize: 13, color: COR_EDITOR.rotulo },
  faixa: {
    height: ALTURA_DA_FAIXA,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
  },
  grelha: {
    position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: COR_EDITOR.fio,
  },
  clipe: {
    position: 'absolute', top: FOLGA, bottom: FOLGA,
    borderWidth: 1, borderRadius: 5,
    justifyContent: 'center',
    // ⚠️ VISÍVEL, e não escondido: um clipe de dez segundos numa música de quatro minutos mede
    // doze pontos ao abrir. Com o corte na borda, escolhê-lo mostrava uma barra de ações
    // cortada ao meio — o clipe ficava selecionado e sem forma de agir sobre ele. A onda
    // continua cortada, pela View de dentro.
    overflow: 'visible',
  },
  // O canto do clipe: miúdo, em caixa alta e de uma linha só — um nome de ficheiro é tão
  // comprido quanto quem o gravou quis, e o clipe não é.
  nomeDoClipe: {
    position: 'absolute', top: 3, left: 6, right: 6,
    fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase',
  },
  dentroDoClipe: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    overflow: 'hidden', borderRadius: 4, justifyContent: 'center',
  },
  // A agulha é VERMELHA nas duas superfícies: é a cor que toda mesa usa para 'aqui'.
  agulha: {
    position: 'absolute', top: 0, width: 2, backgroundColor: VERMELHO_DO_EDITOR,
    alignItems: 'center',
  },
  cabecaDaAgulha: {
    position: 'absolute', top: 0, width: 11, height: 11, borderRadius: 6,
    backgroundColor: VERMELHO_DO_EDITOR,
    shadowColor: VERMELHO_DO_EDITOR, shadowOpacity: 0.9, shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  // A barra fica DENTRO do clipe: por cima, a da primeira faixa saía pelo topo da área visível.
  acoesDoClipe: {
    position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', gap: 4,
  },
  acaoDoClipe: {
    width: 26, height: 26, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderWidth: 1, borderColor: COR_EDITOR.fio,
  },
  acaoInerte: { opacity: 0.4 },
});
