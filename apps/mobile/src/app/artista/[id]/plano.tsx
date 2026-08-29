import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO } from '@maestra/core/constants/design';
import type { ActionTask, Strategy } from '@maestra/core/interfaces/maestra';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { useArtistaDaRota } from '@/nucleo/artista';

// O Plano de Acao.
//
// E a superficie de uso DIARIO: no celular, o que a pessoa quer e ver o que falta e riscar o que
// fez. Por isso a tarefa e tocavel aqui, e nao so lida — um plano que nao se marca no aparelho
// obriga a voltar ao computador para uma acao de dois segundos.
//
// Quem grava e o mesmo `updateArtistContent` da web, com o content inteiro. Nao ha endpoint
// proprio do app: a regra de escrita e uma so.
//
// ACORDEAO, como na web, e nao lista plana. Um perfil real chegou aqui com 31 estrategias e 107
// tarefas: aberto tudo de uma vez, isso e uma parede de texto que nao se navega no celular, e
// ainda monta as 107 linhas de uma so vez. Uma estrategia aberta por vez, com o cabecalho
// dizendo o progresso, e o que a web faz — e o que torna a tela usavel.
//
// So aparecem as estrategias COM tarefa (as priorizadas); as demais ficam de fora, como la.

const feita = (t: ActionTask) => t.status === 'done';

/** Fechada de propósito — diferente de "ninguém escolheu nada ainda". */
const FECHADA = '__nenhuma__' as const;

export default function Plano() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const artista = useArtistaDaRota(id);
  // So a tarefa tocada mostra progresso; travar a tela inteira numa lista longa e desagradavel.
  const [gravando, setGravando] = useState<string | null>(null);

  const todas: Strategy[] = artista?.content?.strategies ?? [];
  // A web mostra so as priorizadas (as que geraram tarefa); sem nenhuma, mostra tudo.
  const comTarefa = todas.filter((e) => (e.tasks?.length ?? 0) > 0);
  const estrategias = comTarefa.length ? comTarefa : todas;

  const tarefas = estrategias.flatMap((e) => e.tasks ?? []);
  const concluidas = tarefas.filter(feita).length;

  const progresso = (e: Strategy) => {
    const lista = e.tasks ?? [];
    const prontas = lista.filter(feita).length;
    return { prontas, total: lista.length, completa: lista.length > 0 && prontas === lista.length };
  };

  // `undefined` (ninguem escolheu ainda) e FECHADA nao sao a mesma coisa. Tratando os dois igual,
  // fechar a propria estrategia em foco cai de volta no auto-foco e ela reabre sozinha — parece
  // que o toque de fechar nao funciona, e so naquela estrategia. E um bug que a web ja teve.
  const [aberta, setAberta] = useState<string | undefined | typeof FECHADA>(undefined);
  const emFoco = estrategias.find((e) => !progresso(e).completa) ?? estrategias[0];
  const abertaAgora =
    aberta === undefined ? emFoco?.id : aberta === FECHADA ? undefined : aberta;

  const alternar = async (estrategiaId: string, tarefa: ActionTask) => {
    if (!artista) return;
    setGravando(tarefa.id);
    const proximo = {
      ...artista.content,
      strategies: estrategias.map((e) =>
        e.id !== estrategiaId
          ? e
          : {
              ...e,
              tasks: (e.tasks ?? []).map((t) =>
                t.id === tarefa.id ? { ...t, status: feita(t) ? ('todo' as const) : ('done' as const) } : t
              ),
            }
      ),
    };
    try {
      await dispatch(artistsActions.updateArtistContent({ id: artista.id, content: proximo })).unwrap();
    } finally {
      setGravando(null);
    }
  };

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>

        <Text style={estilos.titulo}>Plano de ação</Text>

        {estrategias.length === 0 ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Nenhum plano ainda</Text>
            <Text style={estilos.avisoTexto}>
              O planejamento estratégico é feito na web. Depois de concluído, as tarefas aparecem
              aqui para acompanhar no dia a dia.
            </Text>
          </View>
        ) : (
          <>
            <Text style={estilos.resumo}>
              {concluidas} de {tarefas.length} {tarefas.length === 1 ? 'tarefa' : 'tarefas'} concluídas
            </Text>

            {estrategias.map((estrategia, indice) => {
              const { prontas, total, completa } = progresso(estrategia);
              const estaAberta = abertaAgora === estrategia.id;
              return (
              <View key={estrategia.id} style={estilos.bloco}>
                <Pressable
                  style={estilos.cabecalho}
                  onPress={() => setAberta(estaAberta ? FECHADA : estrategia.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: estaAberta }}
                  accessibilityLabel={`Estratégia ${indice + 1}: ${estrategia.title}`}
                >
                  <Feather
                    name={estaAberta ? 'chevron-down' : 'chevron-right'}
                    size={18}
                    color={COR.apagado}
                    style={estilos.chevron}
                  />
                  <View style={estilos.flex}>
                    <Text style={estilos.numero}>
                      ESTRATÉGIA #{String(indice + 1).padStart(2, '0')}
                    </Text>
                    <Text style={estilos.estrategia}>{estrategia.title}</Text>
                  </View>
                  <Text style={[estilos.progresso, completa && estilos.progressoFeito]}>
                    {completa ? 'Concluída' : `${prontas}/${total}`}
                  </Text>
                </Pressable>

                {estaAberta && !!estrategia.why && (
                  <Text style={estilos.porque}>{estrategia.why}</Text>
                )}

                {estaAberta && (estrategia.tasks ?? []).map((tarefa) => (
                  <Pressable
                    key={tarefa.id}
                    style={({ pressed }) => [estilos.tarefa, pressed && estilos.pressionada]}
                    disabled={gravando !== null}
                    onPress={() => alternar(estrategia.id, tarefa)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: feita(tarefa) }}
                    accessibilityLabel={tarefa.description}
                  >
                    {gravando === tarefa.id ? (
                      <ActivityIndicator size="small" color={COR.primaria} style={estilos.caixa} />
                    ) : (
                      <View style={[estilos.caixa, feita(tarefa) && estilos.caixaFeita]}>
                        {feita(tarefa) && <Text style={estilos.tique}>✓</Text>}
                      </View>
                    )}
                    <Text style={[estilos.descricao, feita(tarefa) && estilos.riscada]}>
                      {tarefa.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1 },
  conteudo: { padding: 24, paddingBottom: 122, gap: 12 },
  titulo: { fontSize: 26, fontWeight: '800', color: COR.titulo, letterSpacing: -0.4, marginTop: 4 },
  resumo: { fontSize: 14, color: COR.secundario, marginBottom: 4 },
  aviso: { borderWidth: 1, borderColor: COR.contorno, borderRadius: 14, padding: 18, gap: 6, marginTop: 10 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR.titulo },
  avisoTexto: { fontSize: 14, color: COR.secundario, lineHeight: 20 },
  bloco: { borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.cartao, padding: 14, gap: 4 },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chevron: { marginTop: 3 },
  numero: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: COR.apagado, marginBottom: 2 },
  estrategia: { fontSize: 15, fontWeight: '700', color: COR.titulo, lineHeight: 21 },
  // `flexShrink: 0` nao e detalhe: os titulos reais da metodologia tem cinco linhas, e sem o
  // piso o progresso era espremido ate sumir da tela — o cabecalho perdia justamente o numero
  // que diz se vale a pena abrir.
  progresso: {
    fontSize: 12, fontWeight: '700', color: COR.secundario,
    marginTop: 12, flexShrink: 0, minWidth: 52, textAlign: 'right',
  },
  progressoFeito: { color: COR.primaria },
  porque: { fontSize: 13, color: COR.apagado, lineHeight: 19, marginTop: 8 },
  tarefa: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  pressionada: { opacity: 0.55 },
  caixa: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COR.contorno,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  caixaFeita: { backgroundColor: COR.primaria, borderColor: COR.primaria },
  tique: { color: COR.superficie, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  descricao: { flex: 1, fontSize: 15, color: COR.texto, lineHeight: 21 },
  riscada: { color: COR.apagado, textDecorationLine: 'line-through' },
});
