import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { WebView } from 'react-native-webview';

import type { ArtistContent } from '@maestra/core/interfaces/maestra';
import { STEP_LABELS, currentStepIndex } from '@maestra/core/wizard/script';
import { extractYouTubeId } from '@maestra/core/wizard/youtube';
import { VIDEO_CONVITE } from '@maestra/core/wizard/videos';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { WZ } from '@/casca/wizard/cores';

// As peças da casca do wizard: a barra da etapa, o vídeo, o convite de entrada e o portão entre
// etapas.

// ---- A barra da etapa --------------------------------------------------------------------------

/** "Etapa 3 de 9 · Missão" — e, no celular, a porta para o plano. */
export const BarraDaEtapa = ({
  draft, aoAbrirOPlano,
}: { draft: ArtistContent; aoAbrirOPlano: () => void }) => {
  const atual = currentStepIndex(draft);
  const texto = `Etapa ${atual + 1} de ${STEP_LABELS.length} · ${STEP_LABELS[atual]}`;
  return (
    <Pressable
      style={estilos.barra}
      onPress={aoAbrirOPlano}
      accessibilityRole="button"
      accessibilityLabel={`${texto}. Ver seu plano`}
    >
      <Text style={estilos.textoDaBarra}>{texto}</Text>
      <Feather name="chevron-right" size={16} color={WZ.blue} />
    </Pressable>
  );
};

// ---- O vídeo -----------------------------------------------------------------------------------

/**
 * Um vídeo do YouTube em 16:9.
 *
 * `youtube-nocookie` e os mesmos parâmetros da web — quem decide o id é o núcleo, então uma URL
 * aceita lá é aceita aqui.
 */
export const Video = ({ src, titulo }: { src: string; titulo: string }) => {
  const id = extractYouTubeId(src);
  if (!id) {
    return (
      <View style={[estilos.quadroDoVideo, estilos.videoVazio]}>
        <Text style={estilos.videoVazioTexto}>Vídeo em breve</Text>
      </View>
    );
  }
  return (
    <View style={estilos.quadroDoVideo}>
      <WebView
        source={{ uri: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` }}
        style={estilos.video}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        accessibilityLabel={titulo}
      />
    </View>
  );
};

// ---- O convite ---------------------------------------------------------------------------------

/**
 * A porta de entrada: o que a pessoa vai construir, antes de começar.
 *
 * Quem já respondeu alguma coisa não passa por aqui — a conversa retoma de onde parou.
 */
export const Convite = ({
  nomeDoArtista, aoComecar,
}: { nomeDoArtista: string; aoComecar: () => void }) => (
  <View style={estilos.convite}>
    {/* A Nyta em tamanho discreto: quem fala no vídeo é a Anita, e o emblema grande disputaria a
        autoria da apresentação. */}
    <EmblemaNyta size={40} />
    <Text style={estilos.chapeu}>Planejamento estratégico</Text>
    <Text style={estilos.tituloDoConvite}>
      {nomeDoArtista ? `Antes de começar, ${nomeDoArtista}: ` : 'Antes de começar: '}
      <Text style={estilos.tituloDestaque}>veja o caminho completo</Text>
    </Text>
    <Text style={estilos.textoDoConvite}>
      Anita Carvalho, fundadora da Maestra, apresenta as {STEP_LABELS.length} etapas que você vai
      percorrer. Depois é só começar: a Nyta pergunta, você responde, e o plano se monta no seu
      ritmo.
    </Text>
    <Video src={VIDEO_CONVITE} titulo="Anita Carvalho apresenta o planejamento estratégico" />
    <Pressable
      style={estilos.comecar}
      onPress={aoComecar}
      accessibilityRole="button"
      accessibilityLabel="Começar meu planejamento"
    >
      <Text style={estilos.comecarTexto}>Começar meu planejamento</Text>
      <Feather name="arrow-right" size={17} color={WZ.surface} />
    </Pressable>
  </View>
);

// ---- O portão entre etapas ----------------------------------------------------------------------

/**
 * Cobre a conversa quando uma etapa termina: confirma o que foi concluído e anuncia o que vem.
 *
 * Enquanto ele está aberto, nada avança por trás — senão a Nyta ficaria falando para uma tela
 * que ninguém está vendo.
 */
export const Portao = ({
  concluida, proxima, aoContinuar,
}: { concluida: number; proxima: number; aoContinuar: () => void }) => (
  <View style={estilos.portao}>
    <View style={estilos.cartaoDoPortao}>
      <View style={estilos.checkDoPortao}>
        <Feather name="check" size={26} color={WZ.blue} />
      </View>
      <Text style={estilos.chapeuDoPortao}>Etapa {concluida + 1} concluída</Text>
      <Text style={estilos.tituloDoPortao}>{STEP_LABELS[concluida]}</Text>
      <Text style={estilos.proxima}>
        Próxima · <Text style={estilos.proximaForte}>{proxima + 1}. {STEP_LABELS[proxima]}</Text>
      </Text>
      <Pressable
        style={estilos.continuar}
        onPress={aoContinuar}
        accessibilityRole="button"
        accessibilityLabel="Continuar"
      >
        <Text style={estilos.continuarTexto}>Continuar</Text>
      </Pressable>
    </View>
  </View>
);

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingVertical: 9, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: WZ.line,
  },
  textoDaBarra: { fontSize: 11.5, fontWeight: '900', color: WZ.blue },

  quadroDoVideo: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden',
    backgroundColor: WZ.surface2,
  },
  video: { flex: 1 },
  videoVazio: { alignItems: 'center', justifyContent: 'center' },
  videoVazioTexto: { fontSize: 13, color: WZ.muted },

  convite: { alignItems: 'center', gap: 14, padding: 20, paddingBottom: 40 },
  chapeu: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.66, textTransform: 'uppercase',
    color: WZ.muted,
  },
  tituloDoConvite: {
    fontSize: 24, fontWeight: '800', lineHeight: 28.8, textAlign: 'center', color: WZ.ink,
  },
  tituloDestaque: { color: WZ.blue },
  textoDoConvite: { fontSize: 14, lineHeight: 21, textAlign: 'center', color: WZ.text },
  comecar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    paddingVertical: 13, paddingHorizontal: 26, borderRadius: 9999, backgroundColor: WZ.blue,
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 }, elevation: 3,
  },
  comecarTexto: { fontSize: 15, fontWeight: '800', color: WZ.surface },

  portao: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5,
    alignItems: 'center', justifyContent: 'center', padding: 24,
    backgroundColor: 'rgba(250, 251, 252, 0.94)',
  },
  cartaoDoPortao: {
    alignItems: 'center', gap: 8, padding: 24, borderRadius: 16, width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: WZ.line, backgroundColor: WZ.surface,
    shadowColor: 'rgb(107, 129, 170)', shadowOpacity: 0.13, shadowRadius: 27,
    shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  checkDoPortao: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: WZ.blueSoft, marginBottom: 4,
  },
  chapeuDoPortao: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.66, textTransform: 'uppercase',
    color: WZ.muted,
  },
  tituloDoPortao: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: WZ.ink },
  proxima: { fontSize: 13, color: WZ.muted, marginTop: 2 },
  proximaForte: { fontWeight: '700', color: WZ.ink },
  continuar: {
    marginTop: 12, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 9999,
    backgroundColor: WZ.blue,
  },
  continuarTexto: { fontSize: 14, fontWeight: '800', color: WZ.surface },
});
