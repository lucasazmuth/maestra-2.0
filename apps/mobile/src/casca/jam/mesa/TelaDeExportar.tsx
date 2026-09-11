import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';

// EXPORTAR: tirar da tela o que está montado, para levar a outro lugar.
//
// Duas coisas saem daqui, e são coisas DIFERENTES — por isso duas seções, e não uma lista:
//
// · Os STEMS: cada pista, sozinha, num ZIP — para levar a outro programa (Ableton, Logic,
//   Pro Tools) e continuar o trabalho lá. É a matéria-prima da mistura.
// · A GUIA: a soma de tudo, o mesmo ficheiro que a lista de Músicas toca — para ouvir, mandar
//   para alguém ouvir, ou arquivar. É o resultado, não a matéria-prima.
//
// É a mesma tela da web (`src/pages/Catalog/daw/TelaDeExportar.tsx`), com uma diferença de
// verbo: lá é BAIXAR, aqui é ENVIAR. Um telemóvel não tem pasta de transferências que se abra
// noutro programa — o que ele tem é a folha de partilha, e prometer "baixar" deixaria a pessoa
// à procura de um ficheiro que ela nunca vai encontrar.
//
// A tela é PURA: quem renderiza e abre a partilha é a tela do Espaço JAM (é lá que mora a
// mesa). Aqui só se mostra o que há para levar, e avisa-se enquanto algo está a ser preparado.

export type EmCurso = 'stems' | 'guia-wav' | 'guia-mp3' | null;

const Botao = ({ rotulo, icone, carregando, desabilitado, aoTocar, etiqueta }: {
  rotulo: string;
  icone: keyof typeof Feather.glyphMap;
  carregando?: boolean;
  desabilitado: boolean;
  aoTocar: () => void;
  etiqueta: string;
}) => (
  <Pressable
    onPress={aoTocar}
    disabled={desabilitado}
    style={[estilos.botao, desabilitado && estilos.botaoInerte]}
    accessibilityRole="button"
    accessibilityState={{ disabled: desabilitado, busy: Boolean(carregando) }}
    accessibilityLabel={etiqueta}
  >
    {carregando
      ? <ActivityIndicator size="small" color={COR_EDITOR.rotulo} />
      : <Feather name={icone} size={15} color={desabilitado ? COR_EDITOR.estrela : COR_EDITOR.papel} />}
    <Text style={[estilos.botaoTexto, desabilitado && estilos.botaoTextoInerte]}>{rotulo}</Text>
  </Pressable>
);

export const TelaDeExportar = ({
  pistas, temStems, temGuia, emCurso, aoEnviarStems, aoEnviarGuiaWav, aoEnviarGuiaMp3,
}: {
  /** As pistas desta gravação — o que vira o ZIP de stems. */
  pistas: { id: string; nome: string }[];
  /** Se há alguma pista com áudio para exportar. Sem isto, os botões de stem ficam mudos. */
  temStems: boolean;
  /** Se já existe uma guia gerada — a lista de Músicas já tem o que tocar. */
  temGuia: boolean;
  /** Qual exportação está em curso, para desabilitar o botão certo e dizer "Preparando…". */
  emCurso: EmCurso;
  aoEnviarStems: () => void;
  aoEnviarGuiaWav: () => void;
  aoEnviarGuiaMp3: () => void;
}) => (
  <View style={estilos.tela}>
    <View>
      <Text style={estilos.titulo}>Stems</Text>
      <Text style={estilos.apoio}>
        Cada pista, sozinha, num ZIP para levar a outro programa e continuar o trabalho lá.
        Sai em WAV, sem perda, com o volume e o panorama que você já ajustou aqui.
      </Text>

      <View style={estilos.lista}>
        {pistas.length === 0 ? (
          <Text style={estilos.vazio}>Nenhuma pista para exportar ainda.</Text>
        ) : pistas.map((pista, i) => (
          <View key={pista.id} style={[estilos.linha, i > 0 && estilos.linhaSeguinte]}>
            <Feather name="file-text" size={14} color={COR_EDITOR.rotulo} />
            <Text style={estilos.nome} numberOfLines={1}>{pista.nome}</Text>
            <Text style={estilos.extensao}>.wav</Text>
          </View>
        ))}
      </View>

      <Botao
        rotulo={emCurso === 'stems' ? 'Preparando o ZIP…' : 'Enviar stems (.zip)'}
        icone="archive"
        carregando={emCurso === 'stems'}
        desabilitado={!temStems || Boolean(emCurso)}
        aoTocar={aoEnviarStems}
        etiqueta="Compartilhar todas as faixas num ZIP"
      />
    </View>

    <View>
      <Text style={estilos.titulo}>Guia</Text>
      <Text style={estilos.apoio}>
        A soma de todas as pistas num arquivo só, o mesmo que toca na lista de Músicas.
        {/* ⚠️ A FRASE DA WEB NÃO SERVE AQUI. Lá a guia é RENDERIZADA e enviada ao sair do
            editor; o app ainda não faz isso, e dizer "ela é gerada ao sair" mandaria a pessoa
            fechar a tela e voltar à espera de um arquivo que não ia aparecer. O que ele tem é
            o áudio da própria gravação — e o WAV, que sai daqui na hora. */}
        {!temGuia && ' Esta gravação ainda não tem áudio para ouvir; envie um, ou leve o WAV daqui.'}
      </Text>

      <View style={estilos.dupla}>
        <Botao
          rotulo="Enviar guia (.mp3)"
          icone="share"
          carregando={emCurso === 'guia-mp3'}
          desabilitado={!temGuia || Boolean(emCurso)}
          aoTocar={aoEnviarGuiaMp3}
          etiqueta="Compartilhar a guia em MP3"
        />
        <Botao
          rotulo={emCurso === 'guia-wav' ? 'Renderizando…' : 'Enviar guia (.wav)'}
          icone="share"
          carregando={emCurso === 'guia-wav'}
          desabilitado={!temStems || Boolean(emCurso)}
          aoTocar={aoEnviarGuiaWav}
          etiqueta="Compartilhar a guia em WAV, sem perda"
        />
      </View>
    </View>
  </View>
);

const estilos = StyleSheet.create({
  tela: { gap: 28 },
  titulo: { fontSize: 15, fontWeight: '700', color: COR_EDITOR.titulo, marginBottom: 4 },
  apoio: { fontSize: 12, lineHeight: 18, color: COR_EDITOR.rotulo, marginBottom: 16 },

  lista: {
    borderWidth: 1, borderColor: COR_EDITOR.fio, borderRadius: 8,
    backgroundColor: COR_EDITOR.painel, overflow: 'hidden',
  },
  vazio: { padding: 20, fontSize: 13, color: COR_EDITOR.rotulo, textAlign: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  linhaSeguinte: { borderTopWidth: 1, borderTopColor: COR_EDITOR.fio },
  nome: { flex: 1, fontSize: 13, color: COR_EDITOR.texto },
  extensao: { fontSize: 11, color: COR_EDITOR.estrela },

  // Os dois da guia envolvem para a linha de baixo em vez de espremer: "Enviar guia (.wav)"
  // não encolhe mais do que o próprio nome.
  dupla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  botao: {
    height: 38, paddingHorizontal: 18, borderRadius: 6, marginTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: AZUL_DO_EDITOR,
  },
  botaoInerte: { backgroundColor: COR_EDITOR.acaoFundo },
  botaoTexto: { fontSize: 13, fontWeight: '600', color: COR_EDITOR.papel },
  botaoTextoInerte: { color: COR_EDITOR.estrela },
});
