import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PLANO, RAIO } from '@maestra/core/constants/design';
import type { Strategy } from '@maestra/core/interfaces/maestra';

// As estratégias ARQUIVADAS: as que o artista não priorizou, e por isso não ganharam tarefa.
//
// Trazer uma de volta é semear nela as tarefas do banco (`buildActionPlan`, no núcleo) — como
// passa a ter tarefa, ela sai do arquivo e entra na lista principal, na prioridade já salva.
//
// A folha é de seleção múltipla: quem abre isto costuma trazer duas ou três de uma vez, e um
// toque por estratégia com a folha fechando no meio seria pior do que a web.

export const Arquivadas = ({ aberta, estrategias, aoTrazer, aoFechar }: {
  aberta: boolean;
  estrategias: Strategy[];
  aoTrazer: (ids: string[]) => void | Promise<void>;
  aoFechar: () => void;
}) => {
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [trazendo, setTrazendo] = useState(false);

  useEffect(() => { if (aberta) { setEscolhidas([]); setTrazendo(false); } }, [aberta]);

  const alternar = (id: string) =>
    setEscolhidas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  const confirmar = async () => {
    if (!escolhidas.length) return;
    setTrazendo(true);
    try {
      await aoTrazer(escolhidas);
      aoFechar();
    } finally {
      setTrazendo(false);
    }
  };

  return (
    <Modal visible={aberta} animationType="slide" onRequestClose={aoFechar}>
      <View style={estilos.folha}>
        <View style={estilos.cabecalho}>
          <View style={estilos.flex}>
            <Text style={estilos.titulo}>Estratégias arquivadas</Text>
            <Text style={estilos.apoio}>
              Estratégias que você não priorizou. Selecione as que quer trazer pro plano — elas
              ganham tarefas e entram na lista principal, saindo do arquivo.
            </Text>
          </View>
          <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Feather name="x" size={20} color={COR_PLANO.rotulo} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={estilos.lista}>
          {estrategias.map((estrategia) => {
            const marcada = escolhidas.includes(estrategia.id);
            return (
              <Pressable
                key={estrategia.id}
                style={[estilos.item, marcada && estilos.itemMarcado]}
                onPress={() => alternar(estrategia.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcada }}
                accessibilityLabel={estrategia.title}
              >
                <Feather
                  name={marcada ? 'check-square' : 'square'}
                  size={20}
                  color={marcada ? COR.primaria : COR_PLANO.chevron}
                />
                <Text style={estilos.itemTexto}>{estrategia.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={estilos.rodape}>
          <Text style={estilos.contagem}>
            {escolhidas.length
              ? `${escolhidas.length} selecionada${escolhidas.length === 1 ? '' : 's'}`
              : 'Nenhuma selecionada'}
          </Text>
          <Pressable
            style={[estilos.trazer, (!escolhidas.length || trazendo) && estilos.trazerApagado]}
            onPress={confirmar}
            disabled={!escolhidas.length || trazendo}
            accessibilityRole="button"
            accessibilityLabel="Trazer pro plano"
          >
            {trazendo
              ? <ActivityIndicator size="small" color={COR.superficie} />
              : <Text style={estilos.trazerTexto}>Trazer pro plano</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  folha: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingTop: 60, paddingHorizontal: 22, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: COR_PLANO.fio,
  },
  titulo: { fontSize: 22, fontWeight: '800', color: COR_PLANO.titulo },
  apoio: { fontSize: 13, lineHeight: 20, color: COR_PLANO.legenda, marginTop: 8 },
  lista: { padding: 22, gap: 10 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: RAIO.campo,
    borderWidth: 1, borderColor: COR_PLANO.contorno,
  },
  itemMarcado: { borderColor: COR_PLANO.contornoAberta, backgroundColor: COR_PLANO.cabecalhoAberta },
  itemTexto: { flex: 1, fontSize: 14, lineHeight: 20, color: COR_PLANO.titulo },
  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COR_PLANO.fio,
  },
  contagem: { fontSize: 13, color: COR_PLANO.legenda },
  trazer: {
    minHeight: 46, minWidth: 170, paddingHorizontal: 22, borderRadius: RAIO.campo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  trazerApagado: { opacity: 0.45 },
  trazerTexto: { fontSize: 15, fontWeight: '700', color: COR.superficie },
});
