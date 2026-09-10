import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PLANO, RAIO } from '@maestra/core/constants/design';
import type { Strategy } from '@maestra/core/interfaces/maestra';

import { Folha } from '@/casca/Folha';

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
    <Folha
      aberta={aberta}
      titulo="Estratégias arquivadas"
      aoFechar={aoFechar}
      acao={{
        rotulo: escolhidas.length
          ? `Trazer ${escolhidas.length} pro plano`
          : 'Trazer pro plano',
        aoTocar: confirmar,
        carregando: trazendo,
        desabilitada: !escolhidas.length,
      }}
      semRolagem
    >
      {/* A contagem saiu do rodapé e entrou no RÓTULO do botão: "Trazer 3 pro plano" diz a mesma
          coisa no lugar onde a pessoa vai tocar, em vez de num texto ao lado dele. */}
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
    </Folha>
  );
};

const estilos = StyleSheet.create({
  lista: { padding: 22, gap: 10 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: RAIO.campo,
    borderWidth: 1, borderColor: COR_PLANO.contorno,
  },
  itemMarcado: { borderColor: COR_PLANO.contornoAberta, backgroundColor: COR_PLANO.cabecalhoAberta },
  itemTexto: { flex: 1, fontSize: 14, lineHeight: 20, color: COR_PLANO.titulo },
});
