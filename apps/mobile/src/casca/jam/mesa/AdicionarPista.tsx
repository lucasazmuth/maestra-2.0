import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';
import { MAXIMO_DE_PISTAS } from '@maestra/core/constants/maestra';
import type { EnvioDePista, Recusa } from '@maestra/core/audio/envioDePistas';

// O "+ Adicionar pista", o que está a subir e o que não entrou.
//
// ─── O aviso do MP3 fica AQUI, e não escondido numa ajuda ────────────────────
//
// Quem manda stems em MP3 e ouve tudo desalinhado vai abrir um chamado a dizer que o editor
// está quebrado, e não está: cada codificador de MP3 acrescenta ~25 a 50 ms de silêncio no
// princípio do ficheiro, e stems de programas diferentes chegam desalinhados entre si por
// causa disso. Uma frase no lugar onde se escolhe o ficheiro custa duas linhas; o mesmo aviso
// depois do upload custa a confiança de quem já ouviu errado.

export const AdicionarPista = ({ quantas, envios, recusados, aoEscolher, aoLimparRecusas }: {
  /** Quantos stems a gravação já tem. Decide se ainda cabe alguma. */
  quantas: number;
  envios: EnvioDePista[];
  recusados: Recusa[];
  aoEscolher: () => void;
  aoLimparRecusas: () => void;
}) => {
  const cheio = quantas >= MAXIMO_DE_PISTAS;
  const subindo = envios.filter((e) => e.estado === 'enviando' || e.estado === 'na-fila').length;

  return (
    <View style={estilos.bloco}>
      {/* Cada ficheiro aceito já é uma LINHA aqui, esmaecida, antes de existir no banco: sem
          isso, mandar quatro stems é olhar para uma tela parada durante um minuto. */}
      {envios.filter((e) => e.estado !== 'pronta').map((envio) => (
        <View key={envio.nome} style={estilos.envio}>
          {envio.estado === 'erro'
            ? <Feather name="alert-circle" size={15} color={COR.erro} />
            : <ActivityIndicator size="small" color={COR_JAM.rotulo} />}
          <Text style={estilos.envioNome} numberOfLines={1}>{envio.nome}</Text>
          <Text style={[estilos.envioEstado, envio.estado === 'erro' && estilos.envioErro]}>
            {envio.estado === 'erro' ? (envio.erro || 'Falhou') : envio.estado === 'enviando' ? 'Enviando…' : 'Na fila'}
          </Text>
        </View>
      ))}

      {!!recusados.length && (
        <Pressable
          style={estilos.recusa}
          onPress={aoLimparRecusas}
          accessibilityRole="button"
          accessibilityLabel="Dispensar o aviso dos arquivos recusados"
        >
          <Feather name="alert-triangle" size={14} color={COR.erro} />
          <Text style={estilos.recusaTexto}>
            {recusados.map((r) => `${r.nome}: ${r.motivo}`).join(' · ')}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={[estilos.botao, cheio && estilos.botaoInerte]}
        onPress={aoEscolher}
        disabled={cheio || subindo > 0}
        accessibilityRole="button"
        accessibilityState={{ disabled: cheio || subindo > 0 }}
        accessibilityLabel={cheio
          ? `O limite é ${MAXIMO_DE_PISTAS} pistas`
          : 'Adicionar pistas do aparelho'}
      >
        <Feather name="plus" size={16} color={cheio ? COR_JAM.estrela : COR.primaria} />
        <Text style={[estilos.botaoTexto, cheio && estilos.botaoTextoInerte]}>
          {cheio
            ? `Limite de ${MAXIMO_DE_PISTAS} pistas`
            : subindo > 0 ? `Enviando ${subindo}…` : 'Adicionar pista'}
        </Text>
      </Pressable>

      {!cheio && (
        <Text style={estilos.dica}>
          WAV para sincronia exata. Stems em MP3 só alinham entre si se saíram do mesmo programa:
          cada codificador acrescenta um silêncio de alguns milissegundos no início.
        </Text>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  bloco: { gap: 8, paddingTop: 12 },
  envio: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: COR_JAM.acaoFundo,
  },
  envioNome: { flex: 1, fontSize: 13, fontWeight: '600', color: COR_JAM.texto },
  envioEstado: { fontSize: 12, color: COR_JAM.rotulo },
  envioErro: { color: COR.erro, flexShrink: 1 },
  recusa: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: COR.erro, backgroundColor: COR_JAM.papel,
  },
  recusaTexto: { flex: 1, fontSize: 12, color: COR.erro },
  // Tracejado: é o idioma do "aqui cabe mais alguma coisa", o mesmo do vazio das versões.
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COR_JAM.vazioContorno,
  },
  botaoInerte: { borderColor: COR_JAM.fio },
  botaoTexto: { fontSize: 14, fontWeight: '700', color: COR.primaria },
  botaoTextoInerte: { color: COR_JAM.estrela },
  dica: { fontSize: 11, lineHeight: 16, color: COR_JAM.rotulo },
});
