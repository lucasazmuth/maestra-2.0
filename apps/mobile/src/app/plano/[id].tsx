import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, RAIO } from '@maestra/core/constants/design';
import type { ActionTask, Strategy } from '@maestra/core/interfaces/maestra';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

// O Plano de Acao.
//
// E a superficie de uso DIARIO: no celular, o que a pessoa quer e ver o que falta e riscar o que
// fez. Por isso a tarefa e tocavel aqui, e nao so lida — um plano que nao se marca no aparelho
// obriga a voltar ao computador para uma acao de dois segundos.
//
// Quem grava e o mesmo `updateArtistContent` da web, com o content inteiro. Nao ha endpoint
// proprio do app: a regra de escrita e uma so.

const feita = (t: ActionTask) => t.status === 'done';

export default function Plano() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const artista = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  // So a tarefa tocada mostra progresso; travar a tela inteira numa lista longa e desagradavel.
  const [gravando, setGravando] = useState<string | null>(null);

  const estrategias: Strategy[] = artista?.content?.strategies ?? [];
  const tarefas = estrategias.flatMap((e) => e.tasks ?? []);
  const concluidas = tarefas.filter(feita).length;

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
    <SafeAreaView style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={estilos.voltar}>
          <Text style={estilos.voltarTexto}>‹  {artista?.name ?? 'Perfil'}</Text>
        </Pressable>

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

            {estrategias.map((estrategia) => (
              <View key={estrategia.id} style={estilos.bloco}>
                <Text style={estilos.estrategia}>{estrategia.title}</Text>
                {!!estrategia.why && <Text style={estilos.porque}>{estrategia.why}</Text>}

                {(estrategia.tasks ?? []).map((tarefa) => (
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
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.superficie },
  conteudo: { padding: 24, paddingBottom: 48, gap: 12 },
  voltar: { paddingVertical: 4, alignSelf: 'flex-start' },
  voltarTexto: { fontSize: 16, color: COR.primaria, fontWeight: '600' },
  titulo: { fontSize: 26, fontWeight: '800', color: COR.titulo, letterSpacing: -0.4, marginTop: 4 },
  resumo: { fontSize: 14, color: COR.secundario, marginBottom: 4 },
  aviso: { borderWidth: 1, borderColor: COR.contorno, borderRadius: 14, padding: 18, gap: 6, marginTop: 10 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR.titulo },
  avisoTexto: { fontSize: 14, color: COR.secundario, lineHeight: 20 },
  bloco: { borderWidth: 1, borderColor: COR.contorno, borderRadius: 16, padding: 16, gap: 4 },
  estrategia: { fontSize: 16, fontWeight: '700', color: COR.titulo, lineHeight: 22 },
  porque: { fontSize: 13, color: COR.apagado, lineHeight: 19, marginBottom: 6 },
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
