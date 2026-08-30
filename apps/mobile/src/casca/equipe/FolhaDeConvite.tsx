import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_EQUIPE, RAIO } from '@maestra/core/constants/design';
import type { AccessLevel, ArtistMember } from '@maestra/core/interfaces/maestra';
import * as membrosDb from '@maestra/core/services/db/members';

import { Permissoes } from '@/casca/equipe/Permissoes';

// Convidar alguém para o perfil.
//
// Eu tinha escrito que isto "se faz melhor sentado, e a web já tem" e deixado a tela em leitura.
// É um e-mail, um nome e quatro caixas de seleção — cabe no celular sem esforço, e quem precisa
// dar acesso a alguém costuma precisar disso no momento em que a pessoa está do lado.
//
// O convite parte com `plan` marcado, como na web: é o acesso que quase todo colaborador
// precisa, e sai da tela com uma decisão a menos.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FolhaDeConvite = ({ aberta, artistaId, aoFechar, aoConvidar }: {
  aberta: boolean;
  artistaId: string;
  aoFechar: () => void;
  aoConvidar: (membro: ArtistMember) => void;
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [niveis, setNiveis] = useState<AccessLevel[]>(['plan']);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setNome('');
    setEmail('');
    setNiveis(['plan']);
    setErro(null);
  }, [aberta]);

  const convidar = async () => {
    const endereco = email.trim();
    if (!EMAIL.test(endereco)) { setErro('Informe um e-mail válido.'); return; }
    // Convite sem nenhum acesso entra na equipe sem poder abrir nada — provável esquecimento,
    // já que dá para desmarcar tudo de uma vez pelo "Acesso completo".
    if (!niveis.length) {
      setErro('Escolha ao menos um módulo que esta pessoa poderá acessar.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const membro = await membrosDb.inviteMember({
        artistId: artistaId, email: endereco, name: nome.trim(), accessLevels: niveis,
      });
      aoConvidar(membro);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao convidar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={aberta} animationType="slide" onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={estilos.folha}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={estilos.cabecalho}>
          <View style={estilos.flex}>
            <Text style={estilos.sobrenome}>EQUIPE</Text>
            <View style={estilos.linhaDoTitulo}>
              <View style={estilos.ponto} />
              <Text style={estilos.titulo}>Convidar membro</Text>
            </View>
            <Text style={estilos.apoio}>Envie um convite e defina os acessos iniciais.</Text>
          </View>
          <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Feather name="x" size={20} color={COR_EQUIPE.email} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>Nome</Text>
            <TextInput
              style={estilos.entrada}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome do convidado"
              placeholderTextColor={COR_EQUIPE.email}
              accessibilityLabel="Nome do convidado"
            />
          </View>

          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>E-mail *</Text>
            <TextInput
              style={estilos.entrada}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@exemplo.com"
              placeholderTextColor={COR_EQUIPE.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="E-mail do convidado"
            />
          </View>

          <View style={estilos.campo}>
            <Text style={estilos.subtitulo}>O que esta pessoa pode acessar</Text>
            <Text style={estilos.apoioDoCampo}>
              Cada módulo marcado libera ver e editar aquele módulo. Pode marcar mais de um, e dá
              para alterar depois.
            </Text>
            <Permissoes escolhidos={niveis} aoMudar={setNiveis} />
          </View>

          {!!erro && <Text style={estilos.erro}>{erro}</Text>}
        </ScrollView>

        <View style={estilos.rodape}>
          <Pressable
            style={[estilos.enviar, enviando && estilos.enviarOcupado]}
            onPress={convidar}
            disabled={enviando}
            accessibilityRole="button"
            accessibilityLabel="Enviar convite"
          >
            {enviando
              ? <ActivityIndicator size="small" color={COR.superficie} />
              : <Text style={estilos.enviarTexto}>Enviar convite</Text>}
          </Pressable>
        </View>
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
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: COR.primaria },
  titulo: { fontSize: 20, fontWeight: '800', color: COR_EQUIPE.nome },
  apoio: { fontSize: 13, color: COR_EQUIPE.email, lineHeight: 19, marginTop: 8 },
  corpo: { padding: 22, gap: 20 },
  campo: { gap: 8 },
  rotulo: { fontSize: 13, fontWeight: '700', color: COR_EQUIPE.email },
  subtitulo: { fontSize: 14, fontWeight: '800', color: COR_EQUIPE.nome },
  apoioDoCampo: { fontSize: 12, lineHeight: 18, color: COR_EQUIPE.permissaoApoio, marginBottom: 4 },
  entrada: {
    minHeight: 46, paddingHorizontal: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_EQUIPE.contorno,
    backgroundColor: COR_EQUIPE.permissaoFundo, fontSize: 15, color: COR_EQUIPE.nome,
  },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
  rodape: {
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COR_EQUIPE.fio,
  },
  enviar: {
    minHeight: 46, borderRadius: RAIO.campo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  enviarOcupado: { opacity: 0.7 },
  enviarTexto: { fontSize: 15, fontWeight: '700', color: COR.superficie },
});
