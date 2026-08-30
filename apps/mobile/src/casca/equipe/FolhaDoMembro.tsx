import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_EQUIPE, RAIO } from '@maestra/core/constants/design';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import type { AccessLevel, ArtistMember } from '@maestra/core/interfaces/maestra';
import * as membrosDb from '@maestra/core/services/db/members';

import { Permissoes } from '@/casca/equipe/Permissoes';

// A folha de UM membro: o "···" da linha.
//
// Serve para os dois papéis, como o modal da web. Quem é dono do perfil edita o nome e os
// acessos e pode remover; quem é membro só lê — e o rodapé some, porque um botão "Salvar" que
// não salva é pior do que botão nenhum.
//
// O e-mail nunca se edita: é a chave do convite. Mudá-lo seria convidar outra pessoa.

const ESTADOS: Record<string, { rotulo: string; cor: string; ponto: string }> = {
  active: { rotulo: 'Ativo', cor: COR_EQUIPE.ativoTexto, ponto: COR_EQUIPE.ativoPonto },
  pending: { rotulo: 'Pendente', cor: COR_EQUIPE.pendenteTexto, ponto: COR_EQUIPE.pendentePonto },
  rejected: { rotulo: 'Recusado', cor: COR_EQUIPE.recusadoTexto, ponto: COR_EQUIPE.recusadoPonto },
};

export const SeloDeEstado = ({ estado }: { estado: string }) => {
  const visual = ESTADOS[estado] ?? { rotulo: estado, cor: COR_EQUIPE.pendente, ponto: COR_EQUIPE.pendente };
  return (
    <View style={estilos.selo}>
      <View style={[estilos.ponto, { backgroundColor: visual.ponto }]} />
      <Text style={[estilos.seloTexto, { color: visual.cor }]}>{visual.rotulo}</Text>
    </View>
  );
};

export const FolhaDoMembro = ({ membro, souODono, foto, aoFechar, aoSalvar, aoRemover }: {
  membro: ArtistMember | null;
  souODono: boolean;
  foto?: string | null;
  aoFechar: () => void;
  aoSalvar: (atualizado: ArtistMember) => void;
  aoRemover: (id: string) => void;
}) => {
  const [nome, setNome] = useState('');
  const [niveis, setNiveis] = useState<AccessLevel[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!membro) return;
    setNome(membro.name || '');
    setNiveis(membro.access_levels || []);
    setErro(null);
  }, [membro]);

  const salvar = async () => {
    if (!membro || !souODono) return;
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await membrosDb.updateMember(membro.id, {
        name: nome.trim(),
        access_levels: niveis,
      });
      aoSalvar(atualizado);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar membro.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = () => {
    if (!membro) return;
    Alert.alert(
      'Remover membro?',
      'Esta pessoa perderá o acesso ao perfil do artista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await membrosDb.removeMember(membro.id);
              aoRemover(membro.id);
              aoFechar();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Erro ao remover.');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={!!membro} animationType="slide" onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={estilos.folha}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={estilos.cabecalho}>
          <View style={estilos.flex}>
            <Text style={estilos.sobrenome}>MEMBRO DA EQUIPE</Text>
            <View style={estilos.linhaDoTitulo}>
              <View style={estilos.pontoDoTitulo} />
              <Text style={estilos.titulo} numberOfLines={2}>
                {membro?.name || membro?.email}
              </Text>
            </View>
            <Text style={estilos.apoio}>Revise os dados e os acessos desta pessoa.</Text>
          </View>
          <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Feather name="x" size={20} color={COR_EQUIPE.email} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
          <View style={estilos.resumo}>
            <Image source={{ uri: foto || ARTISTS_DEFAULT_IMAGE }} style={estilos.avatar} />
            <View style={estilos.flex}>
              {!!membro && <SeloDeEstado estado={membro.status} />}
              <Text style={estilos.convidado}>Convidado para este perfil</Text>
            </View>
          </View>

          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>Nome</Text>
            <TextInput
              style={[estilos.entrada, !souODono && estilos.entradaTravada]}
              value={nome}
              onChangeText={setNome}
              editable={souODono}
              placeholder="Nome do membro"
              placeholderTextColor={COR_EQUIPE.email}
              accessibilityLabel="Nome do membro"
            />
          </View>

          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>E-mail</Text>
            {/* Não editável nem para o dono: é a chave do convite. */}
            <TextInput
              style={[estilos.entrada, estilos.entradaTravada]}
              value={membro?.email ?? ''}
              editable={false}
              accessibilityLabel="E-mail do membro"
            />
          </View>

          <View style={estilos.campo}>
            <Text style={estilos.subtitulo}>O que esta pessoa pode acessar</Text>
            <Text style={estilos.apoioDoCampo}>
              Cada módulo marcado libera ver e editar aquele módulo. Pode marcar mais de um.
            </Text>
            <Permissoes escolhidos={niveis} travado={!souODono} aoMudar={setNiveis} />
          </View>

          {!!erro && <Text style={estilos.erro}>{erro}</Text>}
        </ScrollView>

        {souODono && (
          <View style={estilos.rodape}>
            <Pressable onPress={remover} accessibilityRole="button" accessibilityLabel="Excluir membro">
              <Text style={estilos.remover}>Excluir membro</Text>
            </Pressable>
            <Pressable
              style={[estilos.salvar, salvando && estilos.salvarOcupado]}
              onPress={salvar}
              disabled={salvando}
              accessibilityRole="button"
              accessibilityLabel="Salvar alterações"
            >
              {salvando
                ? <ActivityIndicator size="small" color={COR.superficie} />
                : <Text style={estilos.salvarTexto}>Salvar alterações</Text>}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  folha: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingTop: 60, paddingHorizontal: 22, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: COR_EQUIPE.fio,
  },
  sobrenome: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', color: COR_EQUIPE.email,
  },
  linhaDoTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pontoDoTitulo: { width: 8, height: 8, borderRadius: 4, backgroundColor: COR.primaria },
  titulo: { flex: 1, fontSize: 20, fontWeight: '800', color: COR_EQUIPE.nome },
  apoio: { fontSize: 13, color: COR_EQUIPE.email, lineHeight: 19, marginTop: 8 },
  corpo: { padding: 22, gap: 20 },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COR_EQUIPE.avatarFundo },
  convidado: { fontSize: 12, color: COR_EQUIPE.email, marginTop: 6 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  seloTexto: { fontSize: 10, fontWeight: '800' },
  campo: { gap: 8 },
  rotulo: { fontSize: 13, fontWeight: '700', color: COR_EQUIPE.email },
  subtitulo: { fontSize: 14, fontWeight: '800', color: COR_EQUIPE.nome },
  apoioDoCampo: { fontSize: 12, lineHeight: 18, color: COR_EQUIPE.permissaoApoio, marginBottom: 4 },
  entrada: {
    minHeight: 46, paddingHorizontal: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_EQUIPE.contorno,
    backgroundColor: COR_EQUIPE.permissaoFundo, fontSize: 15, color: COR_EQUIPE.nome,
  },
  entradaTravada: { color: COR_EQUIPE.email },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COR_EQUIPE.fio,
  },
  remover: { fontSize: 14, fontWeight: '700', color: COR.erro },
  salvar: {
    minHeight: 46, minWidth: 170, paddingHorizontal: 22, borderRadius: RAIO.campo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  salvarOcupado: { opacity: 0.7 },
  salvarTexto: { fontSize: 15, fontWeight: '700', color: COR.superficie },
});
