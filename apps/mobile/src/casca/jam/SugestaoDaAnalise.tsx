import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';
import { bpmLegivel, tomInseguro, tomLegivel } from '@maestra/core/services/db/audioJobs';
import { useAnaliseDaVersao } from '@maestra/core/hooks/useAnaliseDaVersao';

// O BPM e o tom que a máquina ouviu, ao lado dos campos que a pessoa preenche.
//
// ⚠️ ELE NÃO ESCREVE NADA SOZINHO. O detetado aparece aqui, e só entra na ficha quando alguém
// toca em "usar". A razão não é cerimônia: o detector erra, e erra de um jeito específico — o
// `KeyExtractor` confunde relativa maior com menor a toda a hora, porque Am e C têm as mesmas
// notas. Um número que se instala sozinho por cima do que o artista digitou apaga trabalho de
// gente sem avisar, e ainda por cima às vezes está errado.
//
// Por isso a CONFIANÇA aparece quando é baixa. Um tom com 0,4 é um palpite, e mostrá-lo com a
// mesma cara de um BPM (que é bem mais confiável) enganaria quem lê.

export const SugestaoDaAnalise = ({ versaoId, aoUsar }: {
  /** A versão principal: é o áudio que representa a música. Sem ela não há o que ouvir. */
  versaoId?: string | null;
  aoUsar: (valores: { bpm: string; tom: string }) => void;
}) => {
  const { analise, emCurso, ultimoErro, carregando, pedindo, erro, pedir, podeCancelar, cancelar } =
    useAnaliseDaVersao(versaoId);

  if (!versaoId || carregando) return null;

  const andando = emCurso('bpm_tom') || pedindo === 'bpm_tom';
  const falhou = erro || ultimoErro('bpm_tom');

  if (andando) {
    // ⚠️ A SAÍDA SÓ APARECE ENQUANTO O TRABALHO NÃO COMEÇOU, e é honesta por isso: dá para
    // desistir da fila, não dá para interromper a máquina no meio. Sem ela, quem toca em
    // "detectar" com o worker fora do ar fica preso neste texto para sempre — e o único jeito
    // de sair seria apagar a linha no banco.
    const naFila = podeCancelar('bpm_tom');
    return (
      <View style={estilos.linha}>
        <ActivityIndicator size="small" color={COR.primaria} />
        <Text style={estilos.apoio}>Ouvindo o áudio… isso leva alguns minutos.</Text>
        {naFila && (
          <Pressable
            onPress={() => { void cancelar('bpm_tom'); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancelar a análise"
          >
            <Text style={estilos.desistir}>Cancelar</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (analise?.bpm) {
    const tom = tomLegivel(analise.tom, analise.tom_escala);
    const inseguro = tomInseguro(analise);
    return (
      <View style={estilos.linha}>
        <Feather name="activity" size={14} color={COR_JAM.legenda} />
        <View style={estilos.meio}>
          <Text style={estilos.detetado} numberOfLines={1}>
            Ouvi {bpmLegivel(analise.bpm)} BPM{tom ? ` · ${tom}` : ''}
          </Text>
          {inseguro && (
            <Text style={estilos.ressalva}>
              O tom veio com pouca certeza. Confira antes de usar.
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => aoUsar({ bpm: bpmLegivel(analise.bpm), tom })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Usar o BPM e o tom detetados"
        >
          <Text style={estilos.acao}>Usar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.linha}>
      <Feather name="activity" size={14} color={COR_JAM.legenda} />
      <View style={estilos.meio}>
        <Pressable
          onPress={() => { void pedir('bpm_tom'); }}
          accessibilityRole="button"
          accessibilityLabel="Detectar o BPM e o tom"
        >
          <Text style={estilos.acao}>Detectar BPM e tom</Text>
        </Pressable>
        {!!falhou && <Text style={estilos.erro}>{falhou}</Text>}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: COR_JAM.fio,
  },
  meio: { flex: 1, minWidth: 0 },
  detetado: { fontSize: 13, fontWeight: '700', color: COR_JAM.titulo },
  apoio: { flex: 1, fontSize: 13, color: COR_JAM.apoio },
  ressalva: { fontSize: 11, color: COR_JAM.apoio, marginTop: 2 },
  acao: { fontSize: 13, fontWeight: '800', color: COR.primaria },
  desistir: { fontSize: 13, fontWeight: '700', color: COR_JAM.legenda },
  erro: { fontSize: 11, color: COR.erro, marginTop: 3, lineHeight: 16 },
});
