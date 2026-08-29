import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM, RAIO } from '@maestra/core/constants/design';
import type { CatalogVersion, CatalogVersionComment } from '@maestra/core/interfaces/maestra';
import * as catalogo from '@maestra/core/services/db/catalog';

// Os comentários de UMA versão.
//
// Na web eles vivem na sala da versão, junto da onda: um comentário pode estar preso a um
// segundo do áudio (`time_seconds`) ou solto. Aqui os dois aparecem na mesma lista, e o que tem
// tempo mostra o tempo — o que não dá para fazer sem a onda é CRIAR um comentário preso a um
// ponto, então os daqui saem soltos, como os do campo geral da web.

const relogio = (segundos?: number | null) => {
  if (segundos == null || !Number.isFinite(segundos)) return null;
  const m = Math.floor(segundos / 60);
  const s = String(Math.floor(segundos % 60)).padStart(2, '0');
  return `${m}:${s}`;
};

const quando = (valor?: string | null) => valor
  ? new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : '';

const iniciais = (valor?: string | null) => (valor || '?').trim().slice(0, 1).toUpperCase();

export const ComentariosDaVersao = ({ aberta, versao, autor, aoFechar, aoMudar }: {
  aberta: boolean;
  versao: CatalogVersion | null;
  autor: { id?: string | null; nome: string; foto?: string | null };
  aoFechar: () => void;
  aoMudar: () => void;
}) => {
  const [comentarios, setComentarios] = useState<CatalogVersionComment[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const versaoId = versao?.id;

  const buscar = useCallback(async () => {
    if (!versaoId) return;
    setCarregando(true);
    try {
      setComentarios(await catalogo.listVersionComments(versaoId));
    } catch {
      setErro('Não foi possível carregar os comentários.');
    } finally {
      setCarregando(false);
    }
  }, [versaoId]);

  useEffect(() => { if (aberta) void buscar(); }, [aberta, buscar]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!versaoId || !conteudo || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      const criado = await catalogo.createVersionComment({
        version_id: versaoId,
        author_id: autor.id ?? null,
        author_name: autor.nome,
        author_avatar: autor.foto ?? null,
        text: conteudo,
        time_seconds: null,
      });
      setComentarios((atual) => [...atual, criado]);
      setTexto('');
      aoMudar();
    } catch {
      setErro('Não foi possível enviar. Tente novamente.');
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
              <Text style={estilos.sobrenome}>
                {versao ? `V${versao.version_number}` : 'VERSÃO'}
              </Text>
              <Text style={estilos.titulo}>
                {comentarios.length} {comentarios.length === 1 ? 'comentário' : 'comentários'}
              </Text>
              <Text style={estilos.apoio}>
                O que se fala sobre esta gravação. As decisões do projeto ficam no chat.
              </Text>
            </View>
            <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={20} color={COR_JAM.apoio} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={estilos.lista} keyboardShouldPersistTaps="handled">
            {carregando ? (
              <ActivityIndicator color={COR.primaria} style={estilos.espera} />
            ) : comentarios.length === 0 ? (
              <View style={estilos.vazio}>
                <View style={estilos.iconeDoVazio}>
                  <Feather name="message-circle" size={22} color={COR.primaria} />
                </View>
                <Text style={estilos.vazioTitulo}>Nenhum comentário ainda</Text>
                <Text style={estilos.vazioApoio}>
                  Diga o que precisa mudar nesta versão — quem for mexer nela vai ler aqui.
                </Text>
              </View>
            ) : (
              comentarios.map((c) => {
                const tempo = relogio(c.time_seconds);
                return (
                  <View key={c.id} style={estilos.comentario}>
                    {c.author_avatar ? (
                      <Image source={{ uri: c.author_avatar }} style={estilos.avatarFoto} />
                    ) : (
                      <View style={estilos.avatarVazio}>
                        <Text style={estilos.avatarTexto}>{iniciais(c.author_name)}</Text>
                      </View>
                    )}
                    <View style={estilos.flex}>
                      <View style={estilos.linhaDoAutor}>
                        <Text style={estilos.autor}>{c.author_name}</Text>
                        {/* O comentário preso a um ponto do áudio mostra o ponto: sem isso ele
                            lê como um comentário solto, e a referência se perde. */}
                        {!!tempo && (
                          <View style={estilos.marca}>
                            <Feather name="clock" size={10} color={COR.primaria} />
                            <Text style={estilos.marcaTexto}>{tempo}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={estilos.data}>{quando(c.created_at)}</Text>
                      <Text style={estilos.texto}>{c.text}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={estilos.compositor}>
            <TextInput
              style={estilos.entrada}
              value={texto}
              onChangeText={setTexto}
              maxLength={5000}
              placeholder="Escreva um comentário…"
              placeholderTextColor={COR_JAM.rotulo}
              editable={!enviando}
              accessibilityLabel="Comentário sobre esta versão"
            />
            <Pressable
              style={[estilos.enviar, (!texto.trim() || enviando) && estilos.enviarApagado]}
              onPress={enviar}
              disabled={!texto.trim() || enviando}
              accessibilityRole="button"
              accessibilityLabel="Enviar comentário"
            >
              {enviando
                ? <ActivityIndicator size="small" color={COR_JAM.papel} />
                : <Feather name="send" size={16} color={COR_JAM.papel} />}
            </Pressable>
          </View>

          {!!erro && <Text style={estilos.erro}>{erro}</Text>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23, 35, 58, .45)' },
  folha: {
    height: '82%', backgroundColor: COR_JAM.papel,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 22, borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  sobrenome: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.76,
    textTransform: 'uppercase', color: COR_JAM.rotulo,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: COR_JAM.titulo, marginTop: 6 },
  apoio: { fontSize: 12, color: COR_JAM.apoio, lineHeight: 18, marginTop: 6 },
  lista: { padding: 22, gap: 16 },
  espera: { marginVertical: 30 },
  comentario: { flexDirection: 'row', gap: 10 },
  avatarFoto: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: COR_JAM.papel },
  avatarVazio: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: COR_JAM.papel,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_JAM.avatarDe,
  },
  avatarTexto: { fontSize: 11, fontWeight: '800', color: COR_JAM.papel },
  linhaDoAutor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autor: { fontSize: 13, fontWeight: '800', color: COR_JAM.texto },
  marca: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
    backgroundColor: COR_JAM.acaoFundo,
  },
  marcaTexto: { fontSize: 10, fontWeight: '800', color: COR.primaria },
  data: { fontSize: 10, color: COR_JAM.rotulo, marginTop: 2 },
  texto: { fontSize: 13, lineHeight: 19, color: COR_JAM.legenda, marginTop: 6 },
  vazio: { alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 50 },
  iconeDoVazio: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },
  vazioTitulo: { fontSize: 14, fontWeight: '700', color: COR_JAM.texto },
  vazioApoio: { fontSize: 12, lineHeight: 18, color: COR_JAM.apoio, textAlign: 'center' },
  compositor: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 14, paddingHorizontal: 18, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: COR_JAM.fio,
  },
  entrada: {
    flex: 1, height: 42, paddingHorizontal: 11, borderRadius: 12,
    borderWidth: 1, borderColor: COR_JAM.fio, backgroundColor: COR_JAM.entradaFundo,
    fontSize: 14, color: COR_JAM.texto,
  },
  enviar: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.primaria,
  },
  enviarApagado: { opacity: 0.45 },
  erro: { paddingHorizontal: 18, paddingBottom: 18, fontSize: 13, color: COR.erro },
});
