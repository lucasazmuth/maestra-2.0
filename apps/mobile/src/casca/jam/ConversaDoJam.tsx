import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { AZUL_DO_EDITOR, COR, COR_EDITOR } from '@maestra/core/constants/design';
import type { CatalogProjectMessage } from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import * as catalogo from '@maestra/core/services/db/catalog';

import { Folha } from '@/casca/Folha';
import { PALETA_ESCURA, PaletaDaFolhaProvider } from '@/casca/paleta';

// A CONVERSA do Espaço JAM: a equipa a falar sobre a música.
//
// ⚠️ ELA NÃO É COMENTÁRIO DE FAIXA, e a diferença é o ponto. Um comentário preso a uma gravação
// responde "o que muda NESTA versão" e morre com ela; a conversa é o fio do trabalho — "consegue
// gravar quinta?", "o baixo ficou alto", "mandei a letra". Presa a uma versão, ela ficava
// espalhada por V1, V2 e V3, e quem chegava tinha de abrir três sítios para saber o que se
// passou.
//
// A tabela (`catalog_project_messages`), a RLS e o realtime nunca saíram do ar: o chat existia,
// foi retirado das telas em 09/09/2026 e volta agora pela porta certa — uma por projeto.

const quando = (valor?: string | null) => (valor
  ? new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : '');

const iniciais = (valor?: string | null) => (valor || '?').trim().slice(0, 1).toUpperCase();

export const ConversaDoJam = ({ aberta, projetoId, autor, podeFalar, aoFechar }: {
  aberta: boolean;
  projetoId: string;
  autor: { id?: string | null; nome: string; foto?: string | null };
  /** Quem só olha o catálogo lê a conversa, mas não escreve nela. */
  podeFalar: boolean;
  aoFechar: () => void;
}) => {
  const [mensagens, setMensagens] = useState<CatalogProjectMessage[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef<ScrollView>(null);

  const buscar = useCallback(async () => {
    try {
      setMensagens(await catalogo.listCatalogProjectMessages(projetoId));
    } catch {
      setErro('Não foi possível carregar a conversa.');
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => { if (aberta) void buscar(); }, [aberta, buscar]);

  // ⚠️ EM TEMPO REAL, e não só ao abrir: dois membros a falar ao mesmo tempo é o caso normal de
  // um chat, e sem isto cada um veria a própria metade da conversa até fechar e reabrir.
  useEffect(() => {
    if (!aberta) return undefined;
    const canal = supabase
      .channel(`jam-conversa:${projetoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'catalog_project_messages',
          filter: `project_id=eq.${projetoId}`,
        },
        () => { void buscar(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [aberta, projetoId, buscar]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || enviando || !podeFalar) return;
    setEnviando(true);
    setErro('');
    try {
      const criada = await catalogo.createCatalogProjectMessage({
        project_id: projetoId,
        author_id: autor.id ?? null,
        author_name: autor.nome,
        author_avatar: autor.foto ?? null,
        text: conteudo,
      });
      // Entra na hora, sem esperar o realtime dar a volta: quem escreveu tem de ver o que
      // escreveu no instante em que carrega em enviar.
      setMensagens((atuais) => (atuais.some((m) => m.id === criada.id) ? atuais : [...atuais, criada]));
      setTexto('');
    } catch {
      setErro('Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PaletaDaFolhaProvider value={PALETA_ESCURA}>
      <Folha aberta={aberta} titulo="Conversa" aoFechar={aoFechar} semRolagem>
        <View style={estilos.miolo}>
          <ScrollView
            ref={fim}
            contentContainerStyle={estilos.lista}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => fim.current?.scrollToEnd({ animated: false })}
          >
            {carregando ? (
              <ActivityIndicator color={AZUL_DO_EDITOR} style={estilos.espera} />
            ) : mensagens.length === 0 ? (
              <View style={estilos.vazio}>
                <View style={estilos.iconeDoVazio}>
                  <Feather name="message-circle" size={22} color={AZUL_DO_EDITOR} />
                </View>
                <Text style={estilos.vazioTitulo}>Ninguém falou ainda</Text>
                <Text style={estilos.vazioApoio}>
                  Aqui é a conversa da equipa sobre esta música — combinar uma gravação, dizer o
                  que mudar, mandar um recado. Fica tudo num sítio só.
                </Text>
              </View>
            ) : mensagens.map((m) => (
              <View key={m.id} style={estilos.mensagem}>
                {m.author_avatar ? (
                  <Image source={{ uri: m.author_avatar }} style={estilos.avatarFoto} />
                ) : (
                  <View style={estilos.avatarVazio}>
                    <Text style={estilos.avatarTexto}>{iniciais(m.author_name)}</Text>
                  </View>
                )}
                <View style={estilos.flex}>
                  <View style={estilos.linhaDoAutor}>
                    <Text style={estilos.autor}>{m.author_name}</Text>
                    <Text style={estilos.data}>{quando(m.created_at)}</Text>
                  </View>
                  <Text style={estilos.texto}>{m.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {!!erro && <Text style={estilos.erro}>{erro}</Text>}

          {podeFalar && (
            <View style={estilos.barra}>
              <TextInput
                style={estilos.campo}
                value={texto}
                onChangeText={setTexto}
                placeholder="Escreva para a equipe…"
                placeholderTextColor={COR_EDITOR.estrela}
                multiline
                accessibilityLabel="Mensagem para a equipe"
              />
              <Pressable
                onPress={() => { void enviar(); }}
                disabled={!texto.trim() || enviando}
                style={[estilos.enviar, (!texto.trim() || enviando) && estilos.enviarInerte]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !texto.trim() || enviando }}
                accessibilityLabel="Enviar mensagem"
              >
                {enviando
                  ? <ActivityIndicator size="small" color={COR_EDITOR.papel} />
                  : <Feather name="send" size={16} color={COR_EDITOR.papel} />}
              </Pressable>
            </View>
          )}
        </View>
      </Folha>
    </PaletaDaFolhaProvider>
  );
};

const estilos = StyleSheet.create({
  miolo: { flex: 1, minHeight: 0, backgroundColor: COR_EDITOR.fundoDe },
  flex: { flex: 1, minWidth: 0 },
  lista: { padding: 16, gap: 16 },
  espera: { marginTop: 40 },

  vazio: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
  iconeDoVazio: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.cabecaDaVersao,
  },
  vazioTitulo: { fontSize: 15, fontWeight: '700', color: COR_EDITOR.titulo },
  vazioApoio: { fontSize: 13, lineHeight: 19, color: COR_EDITOR.rotulo, textAlign: 'center' },

  mensagem: { flexDirection: 'row', gap: 10 },
  avatarFoto: { width: 34, height: 34, borderRadius: 17 },
  avatarVazio: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.cabecaDaVersao,
  },
  avatarTexto: { fontSize: 13, fontWeight: '800', color: COR_EDITOR.apoio },
  linhaDoAutor: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  autor: { fontSize: 13, fontWeight: '700', color: COR_EDITOR.titulo },
  data: { fontSize: 11, color: COR_EDITOR.rotulo },
  texto: { marginTop: 2, fontSize: 14, lineHeight: 20, color: COR_EDITOR.texto },

  erro: { paddingHorizontal: 16, paddingBottom: 6, fontSize: 13, color: COR.erro },

  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12,
    borderTopWidth: 1, borderTopColor: COR_EDITOR.fio,
    backgroundColor: COR_EDITOR.painel,
  },
  campo: {
    flex: 1, minHeight: 40, maxHeight: 120,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COR_EDITOR.fio, backgroundColor: COR_EDITOR.acaoFundo,
    fontSize: 14, color: COR_EDITOR.texto,
  },
  enviar: {
    width: 40, height: 40, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: AZUL_DO_EDITOR,
  },
  enviarInerte: { opacity: 0.4 },
});
