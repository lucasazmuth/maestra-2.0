import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CONTA, RAIO } from '@maestra/core/constants/design';
import { getMyPlatformReview, savePlatformReview } from '@maestra/core/services/db/platformReviews';

// "Avaliar a Maestra": nota de 1 a 5 e um comentário opcional.
//
// É a avaliação DO PRODUTO, guardada no banco — não a da App Store. As duas coisas se parecem e
// não são a mesma: esta a equipe lê e responde; a da loja é pública e o app nem está publicado.
//
// Abre com o que a pessoa já respondeu antes, como na web: avaliar de novo é REVER a nota, e
// começar do zero faria parecer que a anterior sumiu.

const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Boa', 'Excelente'];
const LIMITE = 2000;

export const FolhaDaAvaliacao = ({ aberta, usuarioId, aoFechar }: {
  aberta: boolean;
  usuarioId?: string | null;
  aoFechar: () => void;
}) => {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta || !usuarioId) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    getMyPlatformReview(usuarioId)
      .then((avaliacao) => {
        if (!vivo) return;
        setNota(avaliacao?.rating || 0);
        setComentario(avaliacao?.comment || '');
      })
      .catch(() => { if (vivo) { setNota(0); setComentario(''); } })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [aberta, usuarioId]);

  const enviar = async () => {
    if (!usuarioId || !nota) return;
    setEnviando(true);
    setErro(null);
    try {
      await savePlatformReview({
        userId: usuarioId,
        rating: nota,
        comment: comentario,
        // Na web isto é o caminho da página; aqui é a tela de onde a avaliação partiu.
        pagePath: '/conta',
      });
      aoFechar();
    } catch {
      setErro('Não foi possível enviar sua avaliação agora.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={aberta} animationType="slide" transparent onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={estilos.folha}>
          <View style={estilos.cabecalho}>
            <View style={estilos.flex}>
              <Text style={estilos.sobrenome}>SUA OPINIÃO IMPORTA</Text>
              <Text style={estilos.titulo}>Avalie a Maestra</Text>
              <Text style={estilos.apoio}>
                Conte como está sendo sua experiência. Sua avaliação ajuda a gente a evoluir o
                produto.
              </Text>
            </View>
            <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={20} color={COR_CONTA.rotulo} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
            <View style={estilos.bloco}>
              <Text style={estilos.pergunta}>Como você avalia sua experiência?</Text>
              <View style={estilos.estrelas}>
                {[1, 2, 3, 4, 5].map((valor) => (
                  <Pressable
                    key={valor}
                    onPress={() => setNota(valor)}
                    disabled={carregando || enviando}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ selected: nota >= valor }}
                    accessibilityLabel={`${valor} ${valor === 1 ? 'estrela' : 'estrelas'}`}
                  >
                    <Feather
                      name="star"
                      size={32}
                      color={nota >= valor ? COR_CONTA.estrela : COR_CONTA.contorno}
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={estilos.dica}>
                {carregando
                  ? 'Carregando sua avaliação…'
                  : ROTULOS[nota] || 'Selecione de 1 a 5 estrelas'}
              </Text>
            </View>

            <View style={estilos.campo}>
              <Text style={estilos.rotulo}>Quer contar um pouco mais? (opcional)</Text>
              <TextInput
                style={estilos.entrada}
                value={comentario}
                onChangeText={setComentario}
                maxLength={LIMITE}
                multiline
                editable={!carregando && !enviando}
                placeholder="O que está funcionando bem? O que podemos melhorar?"
                placeholderTextColor={COR_CONTA.texto}
                accessibilityLabel="Comentário da avaliação"
              />
              <Text style={estilos.contador}>{comentario.length}/{LIMITE}</Text>
            </View>

            {!!erro && <Text style={estilos.erro}>{erro}</Text>}
          </ScrollView>

          <View style={estilos.rodape}>
            <Pressable onPress={aoFechar} disabled={enviando} accessibilityRole="button" accessibilityLabel="Agora não">
              <Text style={estilos.agoraNao}>Agora não</Text>
            </Pressable>
            <Pressable
              style={[estilos.enviar, (!nota || carregando || enviando) && estilos.enviarApagado]}
              onPress={enviar}
              disabled={!nota || carregando || enviando}
              accessibilityRole="button"
              accessibilityLabel="Enviar avaliação"
            >
              {enviando
                ? <ActivityIndicator size="small" color={COR.superficie} />
                : <Text style={estilos.enviarTexto}>Enviar avaliação</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 30, 55, .45)' },
  folha: {
    maxHeight: '90%', backgroundColor: COR.superficie,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 22, borderBottomWidth: 1, borderBottomColor: COR_CONTA.contorno,
  },
  sobrenome: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', color: COR_CONTA.rotulo,
  },
  titulo: { fontSize: 22, fontWeight: '800', color: COR_CONTA.titulo, marginTop: 8 },
  apoio: { fontSize: 13, lineHeight: 20, color: COR_CONTA.apoio, marginTop: 8 },
  corpo: { padding: 22, gap: 24 },
  bloco: { alignItems: 'center', gap: 12 },
  pergunta: { fontSize: 14, fontWeight: '700', color: COR_CONTA.tituloDoCartao },
  estrelas: { flexDirection: 'row', gap: 10 },
  dica: { fontSize: 13, color: COR_CONTA.texto },
  campo: { gap: 8 },
  rotulo: { fontSize: 13, fontWeight: '700', color: COR_CONTA.tituloDoCartao },
  entrada: {
    minHeight: 110, padding: 14, textAlignVertical: 'top',
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_CONTA.contorno,
    fontSize: 15, color: COR_CONTA.titulo,
  },
  contador: { fontSize: 11, color: COR_CONTA.texto, textAlign: 'right' },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COR_CONTA.contorno,
  },
  agoraNao: { fontSize: 14, color: COR_CONTA.apoio },
  enviar: {
    minHeight: 46, minWidth: 170, paddingHorizontal: 22, borderRadius: RAIO.campo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  enviarApagado: { opacity: 0.45 },
  enviarTexto: { fontSize: 15, fontWeight: '700', color: COR.superficie },
});
