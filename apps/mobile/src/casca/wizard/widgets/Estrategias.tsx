import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { SAY } from '@maestra/core/constants/nytaPersona';
import type { Strategy } from '@maestra/core/interfaces/maestra';
import { stripEmDash } from '@maestra/core/wizard/limpar';

import { WZ } from '@/casca/wizard/cores';
import { Acoes, BotaoFantasma, BotaoPrincipal, Cartao } from '@/casca/wizard/widgets/kit';

// As ESTRATÉGIAS: a revisão da lista gerada e a priorização.
//
// A priorização é a etapa mais longa do wizard — dezenas de estratégias vezes todos os
// objetivos, uma nota por toque. Por isso ela grava a cada nota (`aoProgredir`): quem fechar o
// app no meio volta de onde parou, em vez de perder a etapa inteira.

// ---- Revisão das estratégias -------------------------------------------------------------------

/** "Responde a:" — os itens da SWOT que a estratégia endereça. */
const linhaDaSwot = (s: Strategy): string => {
  const r = s.swotRefs || {};
  const partes: string[] = [];
  if (r.weaknesses?.length) partes.push(`Fraquezas: ${r.weaknesses.join(', ')}`);
  if (r.opportunities?.length) partes.push(`Oportunidades: ${r.opportunities.join(', ')}`);
  if (r.strengths?.length) partes.push(`Forças: ${r.strengths.join(', ')}`);
  return partes.join(' · ');
};

export const RevisaoDasEstrategias = ({
  estrategias, aoConfirmar,
}: { estrategias: Strategy[]; aoConfirmar: (e: Strategy[]) => void }) => (
  // Lista SÓ DE LEITURA: elas vêm das matrizes determinísticas e não se editam aqui.
  <Cartao>
    <Text style={estilos.rotulo}>
      SUAS ESTRATÉGIAS <Text style={estilos.quantas}>({estrategias.length})</Text>
    </Text>
    <Text style={estilos.apoio}>
      Construídas a partir do seu diagnóstico, cruzando suas forças, fraquezas e oportunidades.
    </Text>
    <View style={estilos.lista}>
      {estrategias.map((s) => {
        const swot = linhaDaSwot(s);
        return (
          <View key={s.id} style={estilos.estrategia}>
            <Text style={estilos.tituloDaEstrategia}>{stripEmDash(s.title)}</Text>
            {!!s.description && <Text style={estilos.descricao}>{s.description}</Text>}
            {!!s.why && <Text style={estilos.porque}>{s.why}</Text>}
            {!!swot && (
              <Text style={estilos.swot}>
                <Text style={estilos.respondeA}>Responde a:</Text> {swot}
              </Text>
            )}
          </View>
        );
      })}
    </View>
    <Acoes>
      <View style={estilos.empurra} />
      <BotaoPrincipal
        rotulo="Curti, vamos priorizar"
        apagado={!estrategias.length}
        aoTocar={() => aoConfirmar(estrategias)}
      />
    </Acoes>
  </Cartao>
);

// ---- Priorização ---------------------------------------------------------------------------

const NOTAS = Array.from({ length: 11 }, (_, i) => i); // 0..10

const corDaNota = (n: number) => (n <= 3 ? WZ.danger : n <= 6 ? WZ.warn : WZ.blue);
const palavraDaNota = (n?: number) => (typeof n !== 'number'
  ? 'Toque numa nota'
  : n === 0 ? 'Não ajuda em nada'
    : n <= 3 ? 'Ajuda pouco'
      : n <= 6 ? 'Ajuda'
        : n <= 9 ? 'Ajuda bastante' : 'Ajuda muito');

const completa = (s: Strategy, quantosObjetivos: number) =>
  Array.from({ length: quantosObjetivos }, (_, i) => (s.objectiveScores || {})[i])
    .every((v) => typeof v === 'number');

export const Priorizacao = ({
  estrategias, objetivos, aoConfirmar, aoProgredir, aoSugerir, aoAnunciar,
}: {
  estrategias: Strategy[];
  objetivos: string[];
  /** Entrega as estratégias pontuadas e os ids das que viram tarefas. */
  aoConfirmar: (pontuadas: Strategy[], escolhidas: string[]) => void;
  /** Grava as notas já dadas, SEM avançar de etapa. */
  aoProgredir?: (e: Strategy[]) => void;
  aoSugerir?: () => Promise<Record<string, { byObjective: Record<number, number> }>>;
  aoAnunciar?: (falas: string[]) => void;
}) => {
  const [lista, setLista] = useState<Strategy[]>(estrategias);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const jaPontuadas = estrategias.some((s) => completa(s, objetivos.length));
  const [indice, setIndice] = useState(() => {
    const i = estrategias.findIndex((s) => !completa(s, objetivos.length));
    return i === -1 ? estrategias.length : i;
  });
  // Em vez de priorizar sozinha, a Nyta PERGUNTA: ela ordena, ou a pessoa pontua à mão.
  const [escolheu, setEscolheu] = useState(!(aoSugerir && !jaPontuadas));
  const [pensando, setPensando] = useState(false);
  // Ao retomar, começa no primeiro objetivo ainda sem nota da estratégia onde parou.
  const [objetivo, setObjetivo] = useState(() => {
    const s = estrategias.find((st) => !completa(st, objetivos.length));
    if (!s) return 0;
    const i = objetivos.findIndex((_, k) => typeof (s.objectiveScores || {})[k] !== 'number');
    return i === -1 ? 0 : i;
  });
  const [avancando, setAvancando] = useState(false);
  const [minimizado, setMinimizado] = useState(false);

  // ---- O autosave das notas -------------------------------------------------------------------
  // Sem ele, 40 minutos de pontuação viviam só na memória da tela até o toque final. O debounce
  // evita uma escrita por toque; o descarregamento no desmonte cobre quem sai antes de ele vencer.
  // Depois do confirm a gravação é DESLIGADA: lá quem grava é o `aoConfirmar`, com as tarefas.
  const progredirRef = useRef(aoProgredir);
  progredirRef.current = aoProgredir;
  const confirmadoRef = useRef(false);
  const pendenteRef = useRef<Strategy[] | null>(null);
  const montadoRef = useRef(false);

  const salvarPendente = () => {
    const pendente = pendenteRef.current;
    if (!pendente || confirmadoRef.current) return;
    pendenteRef.current = null;
    progredirRef.current?.(pendente);
  };

  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return undefined; }
    pendenteRef.current = lista;
    const conta = setTimeout(salvarPendente, 700);
    return () => clearTimeout(conta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => salvarPendente(), []);

  const deixarComANyta = async () => {
    aoAnunciar?.(SAY.priorityAiChosen());
    setEscolheu(true);
    setPensando(true);
    try {
      const notas = aoSugerir ? await aoSugerir() : {};
      setLista((antes) => antes.map((s) => {
        const sugerido = notas[s.id]?.byObjective || {};
        const objectiveScores: Record<number, number> = { ...(s.objectiveScores || {}) };
        objetivos.forEach((_, oi) => {
          objectiveScores[oi] = typeof sugerido[oi] === 'number' ? sugerido[oi] : objectiveScores[oi] ?? 5;
        });
        return { ...s, objectiveScores };
      }));
      setIndice(estrategias.length); // vai direto para a ordem pronta
    } finally {
      setPensando(false);
    }
  };

  const pontuarEuMesmo = () => {
    aoAnunciar?.(SAY.priorityManualChosen());
    setEscolheu(true);
    setIndice(0);
  };

  const notaMaxima = objetivos.length * 10;

  if (!escolheu) {
    return (
      <Cartao>
        <Text style={estilos.tituloDaEscolha}>Como você quer priorizar?</Text>
        <Text style={estilos.apoioDaEscolha}>
          São {lista.length} estratégias. Não dá pra fazer tudo ao mesmo tempo, então a gente
          coloca em ordem de importância, começando pelas que mais te aproximam dos seus objetivos.
        </Text>
        <View style={estilos.opcoesDaEscolha}>
          <Pressable
            style={estilos.opcaoPrincipal}
            onPress={deixarComANyta}
            accessibilityRole="button"
            accessibilityLabel="Me ajuda, Nyta"
          >
            <Text style={estilos.opcaoPrincipalTitulo}>Me ajuda, Nyta</Text>
            <Text style={estilos.opcaoPrincipalApoio}>
              Ela analisa e já te entrega a ordem pronta
            </Text>
          </Pressable>
          <Pressable
            style={estilos.opcaoFantasma}
            onPress={pontuarEuMesmo}
            accessibilityRole="button"
            accessibilityLabel="Eu prefiro priorizar por conta própria"
          >
            <Text style={estilos.opcaoFantasmaTitulo}>Eu prefiro priorizar por conta própria</Text>
            <Text style={estilos.opcaoFantasmaApoio}>
              Você decide a importância de cada uma, no seu ritmo
            </Text>
          </Pressable>
        </View>
      </Cartao>
    );
  }

  if (pensando) {
    return (
      <Cartao>
        <Text style={estilos.apoio}>Organizando suas estratégias por ordem de importância…</Text>
      </Cartao>
    );
  }

  const pronta = indice >= lista.length;

  if (pronta) {
    const pontuadas = lista.map((s) => ({
      ...s,
      finalScore: Array.from({ length: objetivos.length }, (_, i) => (s.objectiveScores || {})[i] || 0)
        .reduce((a, b) => a + b, 0),
    }));
    const ordenadas = pontuadas.slice().sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    const quantas = escolhidas.size;
    const alternar = (id: string) => setEscolhidas((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
      return proximo;
    });

    // Minimizado: um cartão compacto no fio da conversa para reabrir. Nada se perde.
    if (minimizado) {
      return (
        <Cartao>
          <Text style={estilos.tituloDaEscolha}>Sua ordem de prioridade está pronta</Text>
          <Text style={estilos.apoioDaEscolha}>
            {quantas > 0
              ? `${quantas} estratégia${quantas === 1 ? '' : 's'} selecionada${quantas === 1 ? '' : 's'} até agora.`
              : 'Reabra pra escolher as estratégias que viram tarefas.'}
          </Text>
          <BotaoPrincipal rotulo="Ver ordem de prioridade" aoTocar={() => setMinimizado(false)} />
        </Cartao>
      );
    }

    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setMinimizado(true)}>
        <View style={estilos.vidro}>
          <View style={estilos.folha}>
            <Pressable
              style={estilos.fechar}
              onPress={() => setMinimizado(true)}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Feather name="x" size={18} color={WZ.faint} />
            </Pressable>

            <View style={estilos.cabecaDaFolha}>
              <Text style={estilos.tituloDaFolha}>Sua ordem de prioridade está pronta</Text>
              <Text style={estilos.apoioDaFolha}>
                Da mais importante para a menos.{' '}
                <Text style={estilos.apoioForte}>Selecione até 10 estratégias</Text> que você quer
                transformar em tarefas agora, as outras ficam guardadas pra depois.
              </Text>
            </View>

            <ScrollView contentContainerStyle={estilos.ranking}>
              {ordenadas.map((s, i) => {
                const marcada = escolhidas.has(s.id);
                const pct = Math.round(((s.finalScore || 0) / Math.max(notaMaxima, 1)) * 100);
                return (
                  <Pressable
                    key={s.id}
                    style={[estilos.itemDoRanking, marcada && estilos.itemMarcado]}
                    onPress={() => alternar(s.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcada }}
                    accessibilityLabel={stripEmDash(s.title)}
                  >
                    <View style={estilos.linhaDoTopoDoItem}>
                      <Text style={[estilos.numero, marcada && estilos.numeroMarcado]}>
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <View style={[estilos.marca, marcada && estilos.marcaMarcada]}>
                        {marcada && <Feather name="check" size={14} color={WZ.surface} />}
                      </View>
                      <View style={estilos.empurra} />
                      <Text style={[estilos.pct, marcada && estilos.pctMarcada]}>{pct}%</Text>
                    </View>
                    <Text style={estilos.tituloDoItem}>{stripEmDash(s.title)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={estilos.rodapeDaFolha}>
              <View style={estilos.linhaDaContagem}>
                <Text style={estilos.contagem}>
                  <Text style={estilos.contagemForte}>{quantas}</Text> de {ordenadas.length}
                  {' '}selecionada{quantas === 1 ? '' : 's'}
                </Text>
                <Pressable
                  onPress={() => setEscolhidas(
                    quantas === ordenadas.length ? new Set() : new Set(ordenadas.map((s) => s.id)),
                  )}
                  accessibilityRole="button"
                  accessibilityLabel={quantas === ordenadas.length ? 'Limpar' : 'Selecionar todas'}
                >
                  <Text style={estilos.acaoDaContagem}>
                    {quantas === ordenadas.length ? 'Limpar' : 'Selecionar todas'}
                  </Text>
                </Pressable>
              </View>
              <View style={estilos.acoesDaFolha}>
                <BotaoFantasma
                  rotulo="Refazer priorização"
                  aoTocar={() => {
                    // Volta para a escolha (Nyta / à mão), limpando notas e seleção.
                    setEscolhidas(new Set());
                    setLista(estrategias.map((s) => ({
                      ...s, objectiveScores: undefined, finalScore: undefined,
                    })));
                    setIndice(0);
                    setEscolheu(false);
                  }}
                />
                <View style={estilos.empurra} />
                <BotaoPrincipal
                  rotulo="Gerar plano de ação"
                  apagado={!quantas}
                  aoTocar={() => {
                    // Desliga o autosave ANTES de confirmar: daqui em diante quem grava é o
                    // `aoConfirmar`, com as tarefas e o passo.
                    confirmadoRef.current = true;
                    aoConfirmar(pontuadas, [...escolhidas]);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ---- A pontuação, uma pergunta por vez -------------------------------------------------------

  const estrategia = lista[indice];
  const quantosObjetivos = objetivos.length;
  const notaAtual = (estrategia.objectiveScores || {})[objetivo];
  const respondidas = indice * quantosObjetivos + objetivo;
  const todasCompletas = lista.every((s) => completa(s, objetivos.length));

  const avancarUma = () => {
    if (objetivo + 1 < quantosObjetivos) setObjetivo((o) => o + 1);
    else if (indice + 1 < lista.length) { setIndice((i) => i + 1); setObjetivo(0); }
  };

  const voltarUma = () => {
    if (objetivo > 0) setObjetivo((o) => o - 1);
    else if (indice > 0) { setIndice((i) => i - 1); setObjetivo(quantosObjetivos - 1); }
  };

  const pontuar = (valor: number) => {
    if (avancando) return;
    setLista((antes) => antes.map((s) => (s.id === estrategia.id
      ? { ...s, objectiveScores: { ...(s.objectiveScores || {}), [objetivo]: valor } }
      : s)));
    setAvancando(true);
    // A pausa é o feedback: a nota escolhida fica visível antes de a próxima pergunta entrar.
    setTimeout(() => { setAvancando(false); avancarUma(); }, 480);
  };

  return (
    <Cartao>
      <View style={estilos.topo}>
        <Text style={estilos.rotulo}>ESTRATÉGIA {indice + 1} DE {lista.length}</Text>
        <Text style={estilos.deQuantas}>
          {respondidas + 1} de {lista.length * quantosObjetivos}
        </Text>
      </View>
      <View style={estilos.trilho}>
        <View style={[
          estilos.trilhoCheio,
          { width: `${(respondidas / (lista.length * quantosObjetivos)) * 100}%` },
        ]} />
      </View>

      <View style={estilos.caixaDaPergunta}>
        <Text style={estilos.tituloDaEstrategiaAtual}>{stripEmDash(estrategia.title)}</Text>
        <View style={estilos.fio} />

        <Text style={estilos.rotuloDoObjetivo}>
          OBJETIVO {objetivo + 1} DE {quantosObjetivos}
        </Text>
        <Text style={estilos.pergunta}>
          Ajuda a conquistar o objetivo{' '}
          <Text style={estilos.objetivo}>“{stripEmDash(objetivos[objetivo] || '')}”</Text>?
        </Text>

        {/* O medidor 0–10: barras que sobem e enchem até a nota. */}
        <View style={estilos.medidor}>
          {NOTAS.map((n) => {
            const cheia = typeof notaAtual === 'number' && n <= notaAtual;
            return (
              <Pressable
                key={n}
                style={[
                  estilos.barra,
                  { height: 22 + n * 4 },
                  cheia && { backgroundColor: corDaNota(notaAtual as number) },
                ]}
                onPress={() => pontuar(n)}
                accessibilityRole="button"
                accessibilityLabel={`Nota ${n}`}
              >
                <Text style={[estilos.numeroDaBarra, cheia && estilos.numeroCheio]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={estilos.extremos}>
          <Text style={estilos.extremo}>0 · não ajuda</Text>
          <Text style={estilos.extremo}>10 · ajuda muito</Text>
        </View>

        <View style={estilos.leitura}>
          <Text style={[
            estilos.notaGrande,
            { color: typeof notaAtual === 'number' ? corDaNota(notaAtual) : WZ.faint },
          ]}>
            {typeof notaAtual === 'number' ? notaAtual : '–'}
          </Text>
          <Text style={[
            estilos.palavra,
            typeof notaAtual === 'number' ? estilos.palavraForte : undefined,
          ]}>
            {palavraDaNota(notaAtual)}
          </Text>
        </View>
      </View>

      <Acoes>
        {respondidas > 0 && <BotaoFantasma rotulo="← Voltar" aoTocar={voltarUma} />}
        <View style={estilos.empurra} />
        {!todasCompletas && (
          <Text style={estilos.faltam}>Pontue todos os objetivos pra avançar.</Text>
        )}
        <BotaoPrincipal
          rotulo="Avançar"
          apagado={!todasCompletas || avancando}
          aoTocar={() => { if (todasCompletas) setIndice(lista.length); }}
        />
      </Acoes>
    </Cartao>
  );
};

const estilos = StyleSheet.create({
  empurra: { flex: 1 },
  rotulo: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.72, color: WZ.muted, marginBottom: 4,
  },
  quantas: { color: WZ.faint },
  apoio: { fontSize: 12.5, lineHeight: 18.1, color: WZ.muted, marginBottom: 12 },
  lista: { gap: 8 },
  estrategia: {
    padding: 14, paddingHorizontal: 16, borderRadius: 8,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  tituloDaEstrategia: { fontSize: 14, fontWeight: '700', color: WZ.ink },
  descricao: { fontSize: 13, lineHeight: 20.2, color: WZ.muted, marginTop: 6 },
  porque: { fontSize: 12, lineHeight: 18, color: WZ.muted, marginTop: 8 },
  swot: { fontSize: 11.5, lineHeight: 17.3, color: WZ.faint, marginTop: 8 },
  respondeA: { fontWeight: '700', color: WZ.blue },

  tituloDaEscolha: { fontSize: 16, fontWeight: '800', color: WZ.ink, marginBottom: 6 },
  apoioDaEscolha: { fontSize: 13, lineHeight: 19.5, color: WZ.muted, marginBottom: 16 },
  opcoesDaEscolha: { gap: 10 },
  opcaoPrincipal: {
    gap: 2, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 9999,
    backgroundColor: WZ.blue, alignItems: 'center',
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 }, elevation: 3,
  },
  opcaoPrincipalTitulo: { fontSize: 13, fontWeight: '800', color: WZ.surface },
  opcaoPrincipalApoio: { fontSize: 12, color: WZ.surface, opacity: 0.8, textAlign: 'center' },
  opcaoFantasma: {
    gap: 2, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface, alignItems: 'center',
  },
  opcaoFantasmaTitulo: { fontSize: 13, fontWeight: '700', color: WZ.text, textAlign: 'center' },
  opcaoFantasmaApoio: { fontSize: 12, color: WZ.muted, textAlign: 'center' },

  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 8,
  },
  deQuantas: { fontSize: 12, fontWeight: '600', color: WZ.muted },
  trilho: { height: 3, borderRadius: 3, backgroundColor: WZ.line, marginBottom: 14 },
  trilhoCheio: { height: 3, borderRadius: 3, backgroundColor: WZ.blue },

  caixaDaPergunta: {
    borderRadius: 12, padding: 16, paddingBottom: 18, backgroundColor: WZ.surface2,
  },
  tituloDaEstrategiaAtual: {
    fontSize: 18, fontWeight: '800', lineHeight: 22.5, color: WZ.ink, marginBottom: 12,
  },
  fio: { height: 1, backgroundColor: WZ.line, marginBottom: 12 },
  rotuloDoObjetivo: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: WZ.faint, marginBottom: 4,
  },
  pergunta: { fontSize: 15, lineHeight: 22.5, color: WZ.muted, marginBottom: 16 },
  objetivo: { fontSize: 17, fontWeight: '700', color: WZ.ink },

  medidor: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginBottom: 8 },
  barra: {
    flex: 1, minWidth: 0, borderRadius: 6, backgroundColor: WZ.line,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3,
  },
  numeroDaBarra: { fontSize: 11, fontWeight: '800', color: WZ.faint },
  numeroCheio: { color: WZ.surface },
  extremos: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  extremo: { fontSize: 11, color: WZ.faint },
  leitura: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  notaGrande: { fontSize: 26, fontWeight: '800', lineHeight: 26, minWidth: 34 },
  palavra: { fontSize: 14, fontWeight: '600', color: WZ.faint },
  palavraForte: { color: WZ.ink },
  faltam: { fontSize: 12, color: WZ.muted, marginRight: 12 },

  // A folha da ordem pronta cobre a tela: aqui ela é a etapa inteira, não um cartão do fio.
  vidro: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', padding: 16, justifyContent: 'center',
  },
  folha: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  fechar: { position: 'absolute', top: 14, right: 14, zIndex: 2, padding: 6 },
  cabecaDaFolha: { padding: 22, paddingRight: 44, paddingBottom: 12 },
  tituloDaFolha: { fontSize: 22, fontWeight: '800', lineHeight: 26.4, color: WZ.ink },
  apoioDaFolha: { fontSize: 13.5, lineHeight: 20.3, color: WZ.muted, marginTop: 8 },
  apoioForte: { fontWeight: '700', color: WZ.ink },
  ranking: { paddingHorizontal: 22, paddingBottom: 8, gap: 10 },
  itemDoRanking: {
    padding: 14, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: WZ.surface2,
  },
  itemMarcado: { borderColor: WZ.blue, backgroundColor: WZ.blueSoft },
  linhaDoTopoDoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  numero: { fontSize: 15, fontWeight: '800', color: WZ.muted },
  numeroMarcado: { color: WZ.blue },
  marca: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: WZ.faint,
    alignItems: 'center', justifyContent: 'center',
  },
  marcaMarcada: { borderColor: WZ.blue, backgroundColor: WZ.blue },
  pct: {
    fontSize: 12, fontWeight: '800', color: WZ.muted,
    paddingVertical: 3, paddingHorizontal: 9, borderRadius: 9999, backgroundColor: WZ.surface2,
  },
  pctMarcada: { color: WZ.blue, backgroundColor: WZ.blueSoft },
  tituloDoItem: { fontSize: 15, fontWeight: '600', lineHeight: 21, color: WZ.ink },
  rodapeDaFolha: {
    padding: 22, paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderTopColor: WZ.line,
  },
  linhaDaContagem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  contagem: { fontSize: 12.5, color: WZ.muted },
  contagemForte: { fontWeight: '700', color: WZ.ink },
  acaoDaContagem: { fontSize: 12.5, fontWeight: '700', color: WZ.blue },
  acoesDaFolha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
